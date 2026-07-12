import Anthropic from '@anthropic-ai/sdk';
import { queue, type CueEngine } from '@cue/engine';

/**
 * Cue's assistant runs entirely client-side (zero-knowledge): the user's own
 * Anthropic API key is stored locally and requests go straight from the
 * browser to the API. The model never gets a data dump — it asks for exactly
 * what it needs through tools that execute against the local engine.
 */

export const AI_KEY_STORAGE = 'cue-ai-key';
export const MODEL = 'claude-opus-4-8';
const MAX_TOOL_ROUNDS = 6;

export interface ChatTurn {
  role: 'user' | 'assistant';
  text: string;
}

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'get_queue',
    description:
      'Get the current state of the user\'s queue: items waiting in the inbox (in processing order) and counts of scheduled, delegated, done and dropped items. Call this for any question about what the user has to do.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'get_calendar_events',
    description:
      'Get everything on the user\'s master calendar between two dates: imported events from their external calendars (read-only) merged with their own scheduled Cue items. Call this for any question about events, meetings, schedule or availability.',
    input_schema: {
      type: 'object',
      properties: {
        start: { type: 'string', description: 'Start date, inclusive, format YYYY-MM-DD' },
        end: { type: 'string', description: 'End date, exclusive, format YYYY-MM-DD' },
      },
      required: ['start', 'end'],
      additionalProperties: false,
    },
  },
  {
    name: 'search_items',
    description:
      'Search everything the user has ever captured (all statuses, including done and dropped) for a text fragment. Call this when the user asks whether they noted, captured or wrote something down.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Text to search for (case-insensitive substring)' },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
];

/** Executes a tool against the local engine. Returns a JSON string for the tool_result. */
export function executeTool(engine: CueEngine, name: string, input: unknown): string {
  const args = (input ?? {}) as Record<string, unknown>;
  switch (name) {
    case 'get_queue': {
      const items = engine.getItems();
      const inbox = queue.inboxItems(items).slice(0, 50);
      const count = (s: string) => items.filter((i) => i.status === s).length;
      return JSON.stringify({
        inbox: inbox.map((i) => ({
          body: i.body,
          captured_at: new Date(i.createdAt).toISOString(),
        })),
        counts: {
          inbox: count('inbox'),
          scheduled: count('scheduled'),
          delegated: count('delegated'),
          done: count('done'),
          dropped: count('dropped'),
        },
      });
    }
    case 'get_calendar_events': {
      const start = new Date(String(args.start)).getTime();
      const end = new Date(String(args.end)).getTime();
      if (Number.isNaN(start) || Number.isNaN(end)) {
        return JSON.stringify({ error: 'invalid dates — use YYYY-MM-DD' });
      }
      const sources = engine.getSources();
      const events = engine.getCalendarEvents(start, end).slice(0, 100);
      return JSON.stringify({
        events: events.map((e) => ({
          title: e.title,
          start: new Date(e.start).toISOString(),
          end: new Date(e.end).toISOString(),
          all_day: e.allDay,
          source: e.locked
            ? (sources.find((s) => s.id === e.refId)?.name ?? 'imported calendar')
            : 'cue (own item)',
        })),
      });
    }
    case 'search_items': {
      const q = String(args.query ?? '').toLowerCase();
      const hits = engine
        .getItems()
        .filter((i) => i.body.toLowerCase().includes(q))
        .slice(0, 50);
      return JSON.stringify({
        matches: hits.map((i) => ({
          body: i.body,
          status: i.status,
          captured_at: new Date(i.createdAt).toISOString(),
        })),
      });
    }
    default:
      return JSON.stringify({ error: `unknown tool: ${name}` });
  }
}

function systemPrompt(): string {
  return (
    'You are the assistant inside Cue, a local-first capture-and-do app. ' +
    'The user captures items into a queue, processes them one at a time, and sees all their calendars merged into one. ' +
    `Right now it is ${new Date().toString()}. ` +
    'Always look up the user\'s real data with the tools before answering — never invent items or events. ' +
    'Answer briefly and concretely; use short lists when listing items or events. ' +
    'All of the user\'s data stays on their device; you only ever see what the tools return.'
  );
}

/** Minimal client surface so tests can inject a fake. */
export type MessagesClient = {
  messages: { create: (params: Anthropic.MessageCreateParamsNonStreaming) => Promise<Anthropic.Message> };
};

export function defaultClientFactory(apiKey: string): MessagesClient {
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
}

const OUT_OF_ROUNDS =
  'I could not finish answering — too many lookup rounds. Try a more specific question.';

export interface AskOpts {
  engine: CueEngine;
  apiKey: string;
  history: ChatTurn[];
  question: string;
  /** 'anthropic' (default) or 'openai' (any OpenAI-compatible endpoint). */
  dialect?: 'anthropic' | 'openai';
  model?: string;
  baseURL?: string;
  /** Injectable for tests (anthropic dialect). */
  clientFactory?: (apiKey: string) => MessagesClient;
  /** Injectable for tests (openai dialect). */
  fetchImpl?: typeof fetch;
}

export async function askCue(opts: AskOpts): Promise<string> {
  return (opts.dialect ?? 'anthropic') === 'openai' ? askOpenAI(opts) : askAnthropic(opts);
}

async function askAnthropic(opts: AskOpts): Promise<string> {
  const client = (opts.clientFactory ?? defaultClientFactory)(opts.apiKey);
  const messages: Anthropic.MessageParam[] = [
    ...opts.history.map((t) => ({ role: t.role, content: t.text })),
    { role: 'user' as const, content: opts.question },
  ];

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    const response = await client.messages.create({
      model: opts.model || MODEL,
      max_tokens: 4096,
      thinking: { type: 'adaptive' },
      system: systemPrompt(),
      tools: TOOLS,
      messages,
    });

    if (response.stop_reason !== 'tool_use') {
      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('\n')
        .trim();
      return text || '(no answer)';
    }

    messages.push({ role: 'assistant', content: response.content });
    const results: Anthropic.ToolResultBlockParam[] = response.content
      .filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
      .map((b) => ({
        type: 'tool_result',
        tool_use_id: b.id,
        content: executeTool(opts.engine, b.name, b.input),
      }));
    messages.push({ role: 'user', content: results });
  }
  return OUT_OF_ROUNDS;
}

// ---- OpenAI-compatible dialect (raw fetch, function-calling) ---------------

interface OAToolCall {
  id: string;
  function: { name: string; arguments: string };
}
interface OAMessage {
  role: string;
  content?: string | null;
  tool_calls?: OAToolCall[];
}

const OPENAI_TOOLS = TOOLS.map((t) => ({
  type: 'function' as const,
  function: { name: t.name, description: t.description, parameters: t.input_schema },
}));

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}

async function askOpenAI(opts: AskOpts): Promise<string> {
  const doFetch = opts.fetchImpl ?? fetch;
  const baseURL = (opts.baseURL || 'https://api.openai.com/v1').replace(/\/+$/, '');
  const model = opts.model || 'gpt-4o';
  const messages: OAMessage[] = [
    { role: 'system', content: systemPrompt() },
    ...opts.history.map((t) => ({ role: t.role, content: t.text })),
    { role: 'user', content: opts.question },
  ];

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    const res = await doFetch(`${baseURL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${opts.apiKey}` },
      body: JSON.stringify({ model, messages, tools: OPENAI_TOOLS, tool_choice: 'auto' }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`AI request failed (${res.status}). ${detail.slice(0, 200)}`);
    }
    const data = (await res.json()) as { choices?: { message?: OAMessage }[] };
    const msg = data.choices?.[0]?.message;
    if (!msg) return '(no answer)';

    if (msg.tool_calls?.length) {
      messages.push(msg);
      for (const call of msg.tool_calls) {
        messages.push({
          role: 'tool',
          content: executeTool(opts.engine, call.function.name, safeJson(call.function.arguments)),
          ...({ tool_call_id: call.id } as object),
        });
      }
      continue;
    }
    return (msg.content ?? '').trim() || '(no answer)';
  }
  return OUT_OF_ROUNDS;
}

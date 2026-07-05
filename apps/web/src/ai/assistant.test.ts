import { describe, it, expect, vi } from 'vitest';
import { createEngine } from '@cue/engine';
import { askCue, executeTool, type MessagesClient } from './assistant';

function fakeClient(responses: unknown[]): MessagesClient & { calls: unknown[] } {
  const create = vi.fn();
  for (const r of responses) create.mockResolvedValueOnce(r);
  const calls: unknown[] = [];
  return {
    calls,
    messages: {
      create: (async (params: unknown) => {
        calls.push(params);
        return create();
      }) as MessagesClient['messages']['create'],
    },
  };
}

describe('executeTool', () => {
  it('get_queue reports inbox bodies and status counts', () => {
    const engine = createEngine();
    engine.addItem('buy milk');
    const done = engine.addItem('old task');
    engine.complete(done.id);

    const out = JSON.parse(executeTool(engine, 'get_queue', {}));
    expect(out.inbox.map((i: { body: string }) => i.body)).toEqual(['buy milk']);
    expect(out.counts).toMatchObject({ inbox: 1, done: 1 });
  });

  it('search_items finds matches across statuses, case-insensitive', () => {
    const engine = createEngine();
    engine.addItem('Call the DENTIST tomorrow');
    const dropped = engine.addItem('dentist insurance form');
    engine.drop(dropped.id);
    engine.addItem('unrelated');

    const out = JSON.parse(executeTool(engine, 'search_items', { query: 'dentist' }));
    expect(out.matches).toHaveLength(2);
  });

  it('get_calendar_events returns scheduled items in range', () => {
    const engine = createEngine();
    const item = engine.addItem('prep meeting');
    engine.schedule(item.id, new Date('2026-07-10T10:00:00Z').getTime());

    const out = JSON.parse(
      executeTool(engine, 'get_calendar_events', { start: '2026-07-01', end: '2026-08-01' }),
    );
    expect(out.events).toHaveLength(1);
    expect(out.events[0].title).toBe('prep meeting');
    expect(out.events[0].source).toBe('cue (own item)');
  });

  it('rejects bad dates without throwing', () => {
    const engine = createEngine();
    const out = JSON.parse(
      executeTool(engine, 'get_calendar_events', { start: 'nope', end: 'also nope' }),
    );
    expect(out.error).toMatch(/YYYY-MM-DD/);
  });
});

describe('askCue tool loop', () => {
  it('executes requested tools locally and returns the final text', async () => {
    const engine = createEngine();
    engine.addItem('write the report');

    const client = fakeClient([
      {
        stop_reason: 'tool_use',
        content: [{ type: 'tool_use', id: 'tu_1', name: 'get_queue', input: {} }],
      },
      {
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: 'You have one item: write the report.' }],
      },
    ]);

    const answer = await askCue({
      engine,
      apiKey: 'test-key',
      history: [],
      question: 'what do I have to do?',
      clientFactory: () => client,
    });

    expect(answer).toBe('You have one item: write the report.');
    // second request must carry the tool_result with the matching id and real data
    const second = client.calls[1] as {
      messages: Array<{ role: string; content: unknown }>;
    };
    const toolResultTurn = second.messages.at(-1)!;
    expect(toolResultTurn.role).toBe('user');
    const block = (toolResultTurn.content as Array<Record<string, unknown>>)[0]!;
    expect(block.tool_use_id).toBe('tu_1');
    expect(String(block.content)).toContain('write the report');
  });

  it('gives up after too many tool rounds instead of looping forever', async () => {
    const engine = createEngine();
    const loopResponse = {
      stop_reason: 'tool_use',
      content: [{ type: 'tool_use', id: 'tu_x', name: 'get_queue', input: {} }],
    };
    const client = fakeClient(Array(10).fill(loopResponse));

    const answer = await askCue({
      engine,
      apiKey: 'test-key',
      history: [],
      question: 'loop please',
      clientFactory: () => client,
    });
    expect(answer).toMatch(/could not finish/i);
  });
});

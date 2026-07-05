import { useRef, useState, type FormEvent } from 'react';
import { Panel } from '../components/Panel';
import { Button } from '../components/ui/button';
import { useEngine } from '../useEngine';
import { navigate } from '../router';
import { askCue, AI_KEY_STORAGE, MODEL, type ChatTurn } from '../ai/assistant';
import { cn } from '../lib/utils';

export function AskView() {
  const engine = useEngine();
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const apiKey = localStorage.getItem(AI_KEY_STORAGE);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const question = input.trim();
    if (!question || busy || !apiKey) return;
    setError(null);
    setInput('');
    const history = turns;
    setTurns((t) => [...t, { role: 'user', text: question }]);
    setBusy(true);
    try {
      const answer = await askCue({ engine, apiKey, history, question });
      setTurns((t) => [...t, { role: 'assistant', text: answer }]);
    } catch (err) {
      setError(
        err instanceof Error && /401|auth/i.test(err.message)
          ? 'That API key was rejected — check it in settings.'
          : `Something went wrong: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setBusy(false);
      setTimeout(() => listRef.current?.scrollTo({ top: 999999 }), 50);
    }
  }

  return (
    <Panel delay={60}>
      <div className="flex min-h-[420px] flex-col px-5 py-5 pb-8 sm:px-6">
        <div className="mb-3 flex items-baseline justify-between">
          <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            <span className="bg-primary px-1.5 py-0.5 font-semibold text-primary-foreground">
              03
            </span>
            <span>Ask</span>
          </div>
          <span className="hidden font-mono text-[11px] text-muted-foreground sm:block">
            runs on your key · data stays local
          </span>
        </div>

        {!apiKey ? (
          <div className="flex flex-col items-center gap-3 border border-dashed border-border bg-card/50 px-6 py-14 text-center">
            <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
              No API key
            </span>
            <p className="max-w-sm text-sm text-muted-foreground">
              The assistant uses your own Anthropic API key, stored only on this device. Requests
              go straight from your browser to the model — no middleman.
            </p>
            <Button variant="outline" onClick={() => navigate('settings')}>
              Add a key in settings
            </Button>
          </div>
        ) : (
          <>
            <div ref={listRef} className="mb-3 flex-1 space-y-3 overflow-y-auto">
              {turns.length === 0 && (
                <div className="border border-dashed border-border px-4 py-6 font-mono text-xs leading-relaxed text-muted-foreground">
                  try: &ldquo;what&rsquo;s on my plate today?&rdquo; · &ldquo;what does my week
                  look like?&rdquo; · &ldquo;did I capture anything about the dentist?&rdquo;
                </div>
              )}
              {turns.map((t, i) => (
                <div
                  key={i}
                  className={cn(
                    'max-w-[85%] border px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]',
                    t.role === 'user'
                      ? 'ml-auto border-border-strong bg-accent'
                      : 'border-border bg-card shadow-[var(--stack-sm)]',
                  )}
                >
                  {t.text}
                </div>
              ))}
              {busy && (
                <div className="max-w-[85%] border border-border bg-card px-3 py-2 font-mono text-xs text-muted-foreground">
                  looking through your data…
                </div>
              )}
              {error && (
                <div className="border border-border-strong bg-primary/20 px-3 py-2 text-xs">
                  {error}
                </div>
              )}
            </div>

            <form onSubmit={submit} className="flex gap-2">
              <input
                aria-label="Ask"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about your queue, calendar or notes…"
                className="h-10 min-w-0 flex-1 border border-border-strong bg-card px-3 text-sm shadow-[var(--stack-sm)] outline-none transition-[transform,box-shadow] focus:translate-x-[2px] focus:translate-y-[2px] focus:shadow-none"
              />
              <Button type="submit" disabled={busy || !input.trim()}>
                Ask
              </Button>
            </form>
            <p className="mt-2 font-mono text-[10px] text-muted-foreground/70">
              model {MODEL} · your data is fetched by tools on this device and only the fetched
              slices are sent
            </p>
          </>
        )}
      </div>
    </Panel>
  );
}

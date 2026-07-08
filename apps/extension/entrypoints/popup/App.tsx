import { useEffect, useMemo, useState, useSyncExternalStore, type FormEvent } from 'react';
import { queue, parseLinkCode, normalizeHubUrl, type CueEngine, type SyncStatus } from '@cue/engine';
import { getSyncConfig, setSyncConfig, onSyncStatus } from './main';

const APP_URL_KEY = 'cue-app-url';
// Both configurable at build time so a published extension points at the
// deployed app/hub; fall back to the local dev servers otherwise.
const DEFAULT_APP_URL = import.meta.env.VITE_APP_URL || 'http://localhost:5178';
const DEFAULT_HUB = import.meta.env.VITE_DEFAULT_HUB
  ? normalizeHubUrl(import.meta.env.VITE_DEFAULT_HUB)
  : 'ws://localhost:4444';

function useItems(engine: CueEngine) {
  return useSyncExternalStore(engine.subscribe, engine.getItems, engine.getItems);
}

function useSyncStatusExt(): SyncStatus {
  const [s, setS] = useState<SyncStatus>('offline');
  useEffect(() => onSyncStatus(setS), []);
  return s;
}

export function PopupApp({ engine }: { engine: CueEngine }) {
  const items = useItems(engine);
  const inbox = useMemo(() => queue.inboxItems(items), [items]);
  const current = inbox[0];
  const status = useSyncStatusExt();

  const [text, setText] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [appUrl, setAppUrl] = useState(() => localStorage.getItem(APP_URL_KEY) ?? DEFAULT_APP_URL);
  const linked = getSyncConfig() !== null;

  // clear the "+" badge once the popup has drained pending captures
  useEffect(() => {
    void browser.action.setBadgeText({ text: '' });
  }, []);

  function capture(e: FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    engine.addItem(body);
    setText('');
  }

  function join(e: FormEvent) {
    e.preventDefault();
    const parsed = parseLinkCode(joinCode.trim());
    if (!parsed) {
      setJoinError('Invalid link code');
      return;
    }
    setSyncConfig({ room: parsed.room, key: parsed.key, hub: parsed.hub ?? DEFAULT_HUB });
    setJoinCode('');
    setJoinError(null);
  }

  function saveAppUrl(url: string) {
    setAppUrl(url);
    try {
      localStorage.setItem(APP_URL_KEY, url);
    } catch {
      /* fine */
    }
  }

  const chip =
    'bg-primary px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-widest text-primary-foreground';

  return (
    <div className="p-3">
      <header className="mb-3 flex items-center justify-between border-b border-border pb-2">
        <h1 className="flex items-baseline gap-1 font-sans text-lg font-extrabold tracking-tight">
          Cue
          <span
            aria-hidden="true"
            className="inline-block h-2 w-2 bg-primary ring-1 ring-border-strong"
          />
        </h1>
        <div className="flex items-center gap-2">
          <span
            title={`sync: ${status}`}
            className={
              'font-mono text-[9px] uppercase tracking-widest ' +
              (status === 'connected' ? 'text-foreground' : 'text-muted-foreground')
            }
          >
            {linked ? status : 'not linked'}
          </span>
          <button
            type="button"
            onClick={() => setShowSettings((v) => !v)}
            className="border border-border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-muted-foreground hover:border-border-strong hover:text-foreground"
          >
            {showSettings ? 'close' : 'setup'}
          </button>
        </div>
      </header>

      {showSettings ? (
        <div className="space-y-3">
          <div>
            <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              link this extension
            </p>
            {linked ? (
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[11px] text-muted-foreground">
                  linked · {status}
                </span>
                <button
                  type="button"
                  onClick={() => setSyncConfig(null)}
                  className="border border-border px-2 py-1 font-mono text-[10px] uppercase text-muted-foreground hover:border-border-strong hover:text-foreground"
                >
                  unlink
                </button>
              </div>
            ) : (
              <form onSubmit={join} className="flex gap-1.5">
                <input
                  aria-label="Link code"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  placeholder="paste link code (cue1.…)"
                  className="h-8 min-w-0 flex-1 border border-border bg-card px-2 font-mono text-[11px] outline-none focus:border-border-strong"
                />
                <button
                  type="submit"
                  className="border border-border-strong bg-primary px-2.5 font-sans text-xs font-semibold text-primary-foreground shadow-[2px_2px_0_0_var(--color-border-strong)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
                >
                  Join
                </button>
              </form>
            )}
            {joinError && <p className="mt-1 font-mono text-[10px] text-muted-foreground">{joinError}</p>}
            <p className="mt-1 font-mono text-[9px] leading-relaxed text-muted-foreground">
              get the code from the Cue app → settings → link a device
            </p>
          </div>

          <div>
            <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              cue app url
            </p>
            <input
              aria-label="App URL"
              value={appUrl}
              onChange={(e) => saveAppUrl(e.target.value)}
              className="h-8 w-full border border-border bg-card px-2 font-mono text-[11px] outline-none focus:border-border-strong"
            />
          </div>
        </div>
      ) : (
        <>
          <form onSubmit={capture} className="mb-3">
            <input
              aria-label="Capture"
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Capture anything…"
              className="h-10 w-full border border-border-strong bg-card px-3 text-sm shadow-[var(--stack-sm)] outline-none transition-[transform,box-shadow] focus:translate-x-[2px] focus:translate-y-[2px] focus:shadow-none"
            />
          </form>

          {current ? (
            <div className="relative mb-3 border border-border-strong bg-card p-3 pt-6 shadow-[var(--stack-sm)]">
              <span className={'absolute left-0 top-0 border-b border-r border-border-strong ' + chip}>
                now
              </span>
              <p className="text-sm font-semibold leading-snug [overflow-wrap:anywhere]">
                {current.body}
              </p>
              <div className="mt-2.5 flex gap-1.5">
                <button
                  type="button"
                  onClick={() => engine.complete(current.id)}
                  className="border border-border-strong bg-primary px-2.5 py-1 font-sans text-xs font-semibold text-primary-foreground shadow-[2px_2px_0_0_var(--color-border-strong)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
                >
                  Do now
                </button>
                <button
                  type="button"
                  onClick={() => engine.drop(current.id)}
                  className="border border-border-strong bg-card px-2.5 py-1 font-sans text-xs font-semibold shadow-[2px_2px_0_0_var(--color-border-strong)] hover:bg-accent active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
                >
                  Drop
                </button>
                <button
                  type="button"
                  onClick={() => engine.bump(current.id)}
                  className="px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
                >
                  Bump
                </button>
              </div>
            </div>
          ) : (
            <p className="mb-3 border border-dashed border-border px-3 py-4 text-center font-mono text-[11px] text-muted-foreground">
              inbox zero — nothing to process
            </p>
          )}

          <footer className="flex items-center justify-between border-t border-border pt-2">
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              inbox ({inbox.length})
            </span>
            <a
              href={appUrl}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              open cue →
            </a>
          </footer>
        </>
      )}
    </div>
  );
}

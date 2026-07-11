import { useEffect, useMemo, useState } from 'react';
import { queue, type Item } from '@cue/engine';
import { useEngine, useItems } from '../useEngine';
import { formatDue, timeAgo, toDatetimeLocal } from '../lib/time';
import { useDueNotifications, notificationPermission, requestNotifications } from '../lib/notify';
import { Button } from './ui/button';
import { NoteChips } from '../notes/NoteChips';

/** The one item being processed. Keyed by item id so state and animation reset per item. */
function FocusCard({ item }: { item: Item }) {
  const engine = useEngine();
  const [schedOpen, setSchedOpen] = useState(false);
  const [due, setDue] = useState(() => toDatetimeLocal(Date.now() + 60 * 60 * 1000));

  function setSchedule() {
    const ts = new Date(due).getTime();
    if (Number.isNaN(ts)) return;
    engine.schedule(item.id, ts);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && t.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (e.key === 'd') engine.complete(item.id);
      else if (e.key === 's') setSchedOpen((v) => !v);
      else if (e.key === 'x') engine.drop(item.id);
      else if (e.key === 'b') engine.bump(item.id);
      else if (e.key === 'u') engine.undo();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [engine, item.id]);

  return (
    <div className="sheet deal relative p-6 pt-10 sm:p-7 sm:pt-11">
      <span className="absolute left-0 top-0 border-b border-r border-border-strong bg-primary px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-primary-foreground">
        now
      </span>

      <p className="font-sans text-2xl font-semibold leading-snug tracking-tight [overflow-wrap:anywhere] sm:text-[28px]">
        {item.body}
      </p>
      <p className="mt-3 font-mono text-[11px] text-muted-foreground">
        captured {timeAgo(item.createdAt)}
      </p>
      <NoteChips noteRefs={item.noteRefs} />

      <div className="mt-7 flex flex-wrap gap-2">
        <Button onClick={() => engine.complete(item.id)}>Do now</Button>
        <Button variant="outline" onClick={() => setSchedOpen((v) => !v)}>
          Schedule
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            const who = window.prompt('Delegate to?')?.trim();
            if (who) engine.delegate(item.id, who);
          }}
        >
          Delegate
        </Button>
        <Button variant="outline" onClick={() => engine.drop(item.id)}>
          Drop
        </Button>
        <Button variant="ghost" onClick={() => engine.bump(item.id)}>
          Bump
        </Button>
      </div>

      {schedOpen && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <input
            type="datetime-local"
            aria-label="Due"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            className="h-9 rounded-[2px] border border-border-strong bg-card px-2 font-mono text-xs text-foreground outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          />
          <Button size="sm" onClick={setSchedule}>
            Set
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSchedOpen(false)}>
            Cancel
          </Button>
        </div>
      )}

      <p className="mt-4 font-mono text-[10px] tracking-wide text-muted-foreground/70">
        keys · d do · s schedule · x drop · b bump · u undo
      </p>
    </div>
  );
}

export function Focus() {
  const engine = useEngine();
  const items = useItems();
  const inbox = useMemo(() => queue.inboxItems(items), [items]);
  const current = inbox[0];

  // re-check scheduled items every 30s while the app is open
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  useDueNotifications(items, now);
  const [perm, setPerm] = useState(notificationPermission());

  const dueItems = useMemo(
    () =>
      items
        .filter((i) => i.status === 'scheduled' && typeof i.dueAt === 'number' && i.dueAt <= now)
        .sort((a, b) => (a.dueAt ?? 0) - (b.dueAt ?? 0)),
    [items, now],
  );

  return (
    <div className="px-5 py-5 sm:px-6">
      <div className="mb-3 flex items-baseline justify-between">
        <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          <span className="bg-primary px-1.5 py-0.5 font-semibold text-primary-foreground">02</span>
          <span>Focus</span>
        </div>
        <div className="flex items-baseline gap-3">
          {current && (
            <span className="font-mono text-[11px] text-muted-foreground">
              1 of {inbox.length} queued
            </span>
          )}
          <button
            type="button"
            onClick={() => engine.undo()}
            className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
          >
            undo
          </button>
        </div>
      </div>

      {dueItems.length > 0 && perm === 'default' && (
        <button
          type="button"
          onClick={() => void requestNotifications().then(setPerm)}
          className="mb-3 w-full border border-dashed border-border px-3 py-2 text-left font-mono text-[11px] text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
        >
          enable reminders → get a notification when an item comes due
        </button>
      )}

      {dueItems.length > 0 && (
        <div className="mb-3 border border-border-strong bg-accent shadow-[var(--stack-sm)]">
          {dueItems.map((d) => (
            <div
              key={d.id}
              className="flex items-center gap-3 border-b border-border px-3 py-2 last:border-b-0"
            >
              <span className="bg-primary px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-widest text-primary-foreground">
                due
              </span>
              <span className="min-w-0 flex-1 truncate text-sm">{d.body}</span>
              <span className="hidden font-mono text-[11px] text-muted-foreground sm:block">
                {formatDue(d.dueAt ?? 0)}
              </span>
              <Button size="sm" variant="outline" onClick={() => engine.requeue(d.id)}>
                Requeue
              </Button>
            </div>
          ))}
        </div>
      )}

      <section aria-label="Focus">
        {current ? (
          <FocusCard key={current.id} item={current} />
        ) : (
          <div className="flex flex-col items-center gap-3 border border-dashed border-border bg-card/50 px-6 py-14 text-center">
            <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
              Queue empty
            </span>
            <p className="font-sans text-xl font-medium text-muted-foreground">
              Inbox zero — nothing to process.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

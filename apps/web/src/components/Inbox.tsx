import { useMemo, useState } from 'react';
import { queue, type Item } from '@cue/engine';
import { useEngine, useItems } from '../useEngine';
import { formatDue, timeAgo } from '../lib/time';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { NoteChips } from '../notes/NoteChips';

type View = 'queue' | 'scheduled' | 'delegated' | 'log';

const listShell = 'border border-border-strong bg-card shadow-[var(--stack-sm)]';
const emptyShell =
  'border border-dashed border-border px-4 py-6 text-center font-mono text-xs text-muted-foreground';

export function Inbox() {
  const engine = useEngine();
  const items = useItems();
  const [view, setView] = useState<View>('queue');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const inbox = useMemo(() => queue.inboxItems(items), [items]);
  const scheduled = useMemo(
    () =>
      items.filter((i) => i.status === 'scheduled').sort((a, b) => (a.dueAt ?? 0) - (b.dueAt ?? 0)),
    [items],
  );
  const delegated = useMemo(
    () => items.filter((i) => i.status === 'delegated').sort((a, b) => b.updatedAt - a.updatedAt),
    [items],
  );
  const log = useMemo(
    () =>
      items
        .filter((i) => i.status === 'done' || i.status === 'dropped')
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, 50),
    [items],
  );

  const counts: Record<View, number> = {
    queue: inbox.length,
    scheduled: scheduled.length,
    delegated: delegated.length,
    log: log.length,
  };

  function startEdit(i: Item) {
    setEditingId(i.id);
    setDraft(i.body);
  }

  function saveEdit(id: string) {
    const body = draft.trim();
    if (body) engine.edit(id, body);
    setEditingId(null);
  }

  return (
    <div className="px-5 py-5 pb-8 sm:px-6">
      <section aria-label="Inbox">
        <div className="mb-3 flex items-baseline justify-between">
          <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            <span className="bg-primary px-1.5 py-0.5 font-semibold text-primary-foreground">
              03
            </span>
            <h2 className="font-mono text-[11px] font-normal uppercase tracking-[0.2em]">
              Inbox ({inbox.length})
            </h2>
          </div>
          {view === 'queue' && (
            <span className="hidden font-mono text-[11px] text-muted-foreground sm:block">
              fifo · oldest first
            </span>
          )}
        </div>

        <div className="mb-3 flex flex-wrap gap-1.5">
          {(['queue', 'scheduled', 'delegated', 'log'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={cn(
                'rounded-[2px] border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.15em] transition-colors',
                view === v
                  ? 'border-border-strong bg-primary font-semibold text-primary-foreground'
                  : 'border-border text-muted-foreground hover:border-border-strong hover:text-foreground',
              )}
            >
              {v} ({counts[v]})
            </button>
          ))}
        </div>

        {view === 'queue' &&
          (inbox.length === 0 ? (
            <p className={emptyShell}>nothing queued</p>
          ) : (
            <ul className={listShell}>
              {inbox.map((i, idx) => (
                <li
                  key={i.id}
                  className={cn(
                    'group grid grid-cols-[2.75rem_1fr_auto] items-baseline gap-3 px-4 py-3 transition-colors hover:bg-accent/50',
                    idx > 0 && 'border-t border-border',
                  )}
                >
                  <span className="font-mono text-xs text-muted-foreground">
                    {String(idx + 1).padStart(2, '0')}
                  </span>

                  <div className="min-w-0">
                    {editingId === i.id ? (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          saveEdit(i.id);
                        }}
                      >
                        <input
                          autoFocus
                          aria-label="Edit item"
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          onBlur={() => setEditingId(null)}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          className="w-full border-b border-border-strong bg-transparent pb-0.5 text-[15px] outline-none"
                        />
                      </form>
                    ) : (
                      <span className="flex items-baseline gap-2 text-[15px] leading-snug">
                        <span className="[overflow-wrap:anywhere]">{i.body}</span>
                        <button
                          type="button"
                          onClick={() => startEdit(i)}
                          className="shrink-0 font-mono text-[10px] uppercase tracking-widest text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
                        >
                          edit
                        </button>
                      </span>
                    )}
                    <NoteChips noteRefs={i.noteRefs} />
                  </div>

                  {idx === 0 ? (
                    <span className="bg-primary px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-widest text-primary-foreground">
                      next
                    </span>
                  ) : (
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {timeAgo(i.createdAt)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ))}

        {view === 'scheduled' &&
          (scheduled.length === 0 ? (
            <p className={emptyShell}>nothing scheduled</p>
          ) : (
            <ul className={listShell}>
              {scheduled.map((i, idx) => (
                <li
                  key={i.id}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3',
                    idx > 0 && 'border-t border-border',
                  )}
                >
                  <span className="min-w-0 flex-1 text-[15px] leading-snug [overflow-wrap:anywhere]">
                    {i.body}
                  </span>
                  <span
                    className={cn(
                      'shrink-0 font-mono text-[11px]',
                      (i.dueAt ?? 0) <= Date.now()
                        ? 'bg-primary px-1.5 py-0.5 font-semibold text-primary-foreground'
                        : 'text-muted-foreground',
                    )}
                  >
                    {formatDue(i.dueAt ?? 0)}
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => engine.requeue(i.id)}>
                    Requeue
                  </Button>
                </li>
              ))}
            </ul>
          ))}

        {view === 'delegated' &&
          (delegated.length === 0 ? (
            <p className={emptyShell}>nothing delegated</p>
          ) : (
            <ul className={listShell}>
              {delegated.map((i, idx) => (
                <li
                  key={i.id}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3',
                    idx > 0 && 'border-t border-border',
                  )}
                >
                  <span className="min-w-0 flex-1 text-[15px] leading-snug [overflow-wrap:anywhere]">
                    {i.body}
                  </span>
                  <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                    → {i.delegatedTo}
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => engine.requeue(i.id)}>
                    Requeue
                  </Button>
                </li>
              ))}
            </ul>
          ))}

        {view === 'log' &&
          (log.length === 0 ? (
            <p className={emptyShell}>no history yet</p>
          ) : (
            <ul className={listShell}>
              {log.map((i, idx) => (
                <li
                  key={i.id}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3',
                    idx > 0 && 'border-t border-border',
                  )}
                >
                  <span
                    className={cn(
                      'min-w-0 flex-1 text-[15px] leading-snug [overflow-wrap:anywhere]',
                      i.status === 'dropped' && 'text-muted-foreground line-through',
                    )}
                  >
                    {i.body}
                  </span>
                  <span className="shrink-0 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    {i.status}
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => engine.requeue(i.id)}>
                    Requeue
                  </Button>
                </li>
              ))}
            </ul>
          ))}
      </section>
    </div>
  );
}

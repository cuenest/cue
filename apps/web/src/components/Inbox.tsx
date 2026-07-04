import { useMemo } from 'react';
import { queue } from '@cue/engine';
import { useItems } from '../useEngine';
import { timeAgo } from '../lib/time';
import { cn } from '../lib/utils';

export function Inbox() {
  const items = useItems();
  const inbox = useMemo(() => queue.inboxItems(items), [items]);

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
          <span className="hidden font-mono text-[11px] text-muted-foreground sm:block">
            fifo · oldest first
          </span>
        </div>

        {inbox.length === 0 ? (
          <p className="border border-dashed border-border px-4 py-6 text-center font-mono text-xs text-muted-foreground">
            nothing queued
          </p>
        ) : (
          <ul className="border border-border-strong bg-card shadow-[var(--stack-sm)]">
            {inbox.map((i, idx) => (
              <li
                key={i.id}
                className={cn(
                  'grid grid-cols-[2.75rem_1fr_auto] items-baseline gap-3 px-4 py-3 transition-colors hover:bg-accent/50',
                  idx > 0 && 'border-t border-border',
                )}
              >
                <span className="font-mono text-xs text-muted-foreground">
                  {String(idx + 1).padStart(2, '0')}
                </span>
                <span className="text-[15px] leading-snug [overflow-wrap:anywhere]">{i.body}</span>
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
        )}
      </section>
    </div>
  );
}

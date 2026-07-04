import { useMemo } from 'react';
import { queue } from '@cue/engine';
import { useEngine, useItems } from '../useEngine';
import { timeAgo } from '../lib/time';
import { Button } from './ui/button';

export function Focus() {
  const engine = useEngine();
  const items = useItems();
  const inbox = useMemo(() => queue.inboxItems(items), [items]);
  const current = inbox[0];

  return (
    <div className="px-5 py-5 sm:px-6">
      <div className="mb-3 flex items-baseline justify-between">
        <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          <span className="bg-primary px-1.5 py-0.5 font-semibold text-primary-foreground">02</span>
          <span>Focus</span>
        </div>
        {current && (
          <span className="font-mono text-[11px] text-muted-foreground">
            1 of {inbox.length} queued
          </span>
        )}
      </div>

      <section aria-label="Focus">
        {current ? (
          <div className="sheet relative p-6 pt-10 transition-transform duration-150 hover:translate-x-[1px] hover:translate-y-[1px] sm:p-7 sm:pt-11">
            <span className="absolute left-0 top-0 border-b border-r border-border-strong bg-primary px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-primary-foreground">
              now
            </span>

            <p className="font-sans text-2xl font-semibold leading-snug tracking-tight [overflow-wrap:anywhere] sm:text-[28px]">
              {current.body}
            </p>
            <p className="mt-3 font-mono text-[11px] text-muted-foreground">
              captured {timeAgo(current.createdAt)}
            </p>

            <div className="mt-7 flex flex-wrap gap-2">
              <Button onClick={() => engine.complete(current.id)}>Do now</Button>
              <Button variant="outline" onClick={() => engine.schedule(current.id, Date.now())}>
                Schedule
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  const who = window.prompt('Delegate to?')?.trim();
                  if (who) engine.delegate(current.id, who);
                }}
              >
                Delegate
              </Button>
              <Button variant="outline" onClick={() => engine.drop(current.id)}>
                Drop
              </Button>
              <Button variant="ghost" onClick={() => engine.bump(current.id)}>
                Bump
              </Button>
            </div>
          </div>
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

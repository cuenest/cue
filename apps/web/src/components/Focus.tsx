import { useMemo } from 'react';
import { queue } from '@cue/engine';
import { useEngine, useItems } from '../useEngine';

export function Focus() {
  const engine = useEngine();
  const items = useItems();
  const current = useMemo(() => queue.nextInboxItem(items), [items]);

  if (!current) {
    return (
      <section aria-label="Focus">
        <p>Inbox zero — nothing to process.</p>
      </section>
    );
  }

  return (
    <section aria-label="Focus">
      <p>{current.body}</p>
      <button onClick={() => engine.complete(current.id)}>Do now</button>
      <button onClick={() => engine.schedule(current.id, Date.now())}>Schedule</button>
      <button
        onClick={() => {
          const who = window.prompt('Delegate to?')?.trim();
          if (who) engine.delegate(current.id, who);
        }}
      >
        Delegate
      </button>
      <button onClick={() => engine.drop(current.id)}>Drop</button>
      <button onClick={() => engine.bump(current.id)}>Bump</button>
    </section>
  );
}

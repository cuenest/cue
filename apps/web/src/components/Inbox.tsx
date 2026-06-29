import { useMemo } from 'react';
import { queue } from '@cue/engine';
import { useItems } from '../useEngine';

export function Inbox() {
  const items = useItems();
  const inbox = useMemo(() => queue.inboxItems(items), [items]);

  return (
    <section aria-label="Inbox">
      <h2>Inbox ({inbox.length})</h2>
      <ul>
        {inbox.map((i) => (
          <li key={i.id}>{i.body}</li>
        ))}
      </ul>
    </section>
  );
}

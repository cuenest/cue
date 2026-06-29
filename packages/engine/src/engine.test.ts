import { describe, it, expect, vi } from 'vitest';
import { createEngine } from './index';

describe('createEngine', () => {
  it('addItem then getInbox/getNext reflect it', () => {
    const engine = createEngine();
    engine.addItem('a');
    expect(engine.getInbox()).toHaveLength(1);
    expect(engine.getNext()?.body).toBe('a');
  });

  it('getItems returns a stable reference until data changes', () => {
    const engine = createEngine();
    const first = engine.getItems();
    expect(engine.getItems()).toBe(first); // same ref, no change
    engine.addItem('a');
    expect(engine.getItems()).not.toBe(first); // changed ref after mutation
  });

  it('subscribe is notified on change', () => {
    const engine = createEngine();
    const listener = vi.fn();
    engine.subscribe(listener);
    engine.addItem('a');
    expect(listener).toHaveBeenCalled();
  });
});

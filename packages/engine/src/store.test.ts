import { describe, it, expect, vi } from 'vitest';
import { CueStore } from './store';

describe('CueStore create/read', () => {
  it('addItem creates an inbox item with order == createdAt', () => {
    const store = new CueStore();
    const item = store.addItem('buy milk', 1000);
    expect(item.body).toBe('buy milk');
    expect(item.status).toBe('inbox');
    expect(item.createdAt).toBe(1000);
    expect(item.order).toBe(1000);
    expect(item.updatedAt).toBe(1000);
    expect(item.id).toBeTruthy();
  });

  it('getItem returns the stored item, undefined when missing', () => {
    const store = new CueStore();
    const item = store.addItem('a', 1);
    expect(store.getItem(item.id)?.body).toBe('a');
    expect(store.getItem('nope')).toBeUndefined();
  });

  it('getAllItems returns every item', () => {
    const store = new CueStore();
    store.addItem('a', 1);
    store.addItem('b', 2);
    expect(store.getAllItems().map((i) => i.body).sort()).toEqual(['a', 'b']);
  });
});

describe('CueStore update/subscribe', () => {
  it('updateItem patches fields and bumps updatedAt', () => {
    const store = new CueStore();
    const item = store.addItem('a', 1);
    const updated = store.updateItem(item.id, { status: 'done' }, 50);
    expect(updated.status).toBe('done');
    expect(updated.updatedAt).toBe(50);
    expect(updated.createdAt).toBe(1);
  });

  it('updateItem throws when the item is missing', () => {
    const store = new CueStore();
    expect(() => store.updateItem('nope', { status: 'done' })).toThrow();
  });

  it('subscribe fires on mutation and unsubscribe stops it', () => {
    const store = new CueStore();
    const listener = vi.fn();
    const unsub = store.subscribe(listener);
    store.addItem('a', 1);
    expect(listener).toHaveBeenCalledTimes(1);
    unsub();
    store.addItem('b', 2);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

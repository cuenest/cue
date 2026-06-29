import { describe, it, expect } from 'vitest';
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

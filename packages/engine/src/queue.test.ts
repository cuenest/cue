import { describe, it, expect } from 'vitest';
import { inboxItems, nextInboxItem, nextBumpOrder } from './queue';
import type { Item } from './types';

function item(p: Partial<Item> & { id: string }): Item {
  return {
    body: p.id,
    createdAt: p.createdAt ?? 0,
    status: p.status ?? 'inbox',
    order: p.order ?? p.createdAt ?? 0,
    updatedAt: 0,
    ...p,
  };
}

describe('queue ordering', () => {
  it('inboxItems returns only inbox items, oldest order first', () => {
    const items: Item[] = [
      item({ id: 'b', createdAt: 2 }),
      item({ id: 'a', createdAt: 1 }),
      item({ id: 'done', createdAt: 0, status: 'done' }),
    ];
    expect(inboxItems(items).map((i) => i.id)).toEqual(['a', 'b']);
  });

  it('nextInboxItem returns the single lowest-order inbox item', () => {
    const items: Item[] = [
      item({ id: 'a', createdAt: 1 }),
      item({ id: 'b', createdAt: 2 }),
    ];
    expect(nextInboxItem(items)?.id).toBe('a');
  });

  it('nextInboxItem returns undefined when no inbox items', () => {
    expect(nextInboxItem([item({ id: 'x', status: 'done' })])).toBeUndefined();
  });

  it('a lower order wins even with a later createdAt (bumped item)', () => {
    const items: Item[] = [
      item({ id: 'old', createdAt: 1, order: 1 }),
      item({ id: 'bumped', createdAt: 5, order: -1 }),
    ];
    expect(nextInboxItem(items)?.id).toBe('bumped');
  });
});

describe('nextBumpOrder', () => {
  it('returns a value below the current minimum inbox order', () => {
    const items: Item[] = [
      item({ id: 'a', createdAt: 10, order: 10 }),
      item({ id: 'b', createdAt: 20, order: 20 }),
    ];
    expect(nextBumpOrder(items)).toBeLessThan(10);
  });

  it('an item updated to nextBumpOrder becomes next', () => {
    const items: Item[] = [
      item({ id: 'a', createdAt: 10, order: 10 }),
      item({ id: 'b', createdAt: 20, order: 20 }),
    ];
    const bumped = nextBumpOrder(items);
    const after: Item[] = items.map((i) =>
      i.id === 'b' ? { ...i, order: bumped } : i,
    );
    expect(nextInboxItem(after)?.id).toBe('b');
  });
});

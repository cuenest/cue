import type { Item } from './types';

export function effectiveOrder(item: Item): number {
  return item.order;
}

export function inboxItems(items: Item[]): Item[] {
  return items
    .filter((i) => i.status === 'inbox')
    .sort((a, b) => effectiveOrder(a) - effectiveOrder(b) || a.createdAt - b.createdAt);
}

export function nextInboxItem(items: Item[]): Item | undefined {
  return inboxItems(items)[0];
}

export function nextBumpOrder(items: Item[]): number {
  const orders = inboxItems(items).map(effectiveOrder);
  const min = orders.length ? Math.min(...orders) : Date.now();
  return min - 1;
}

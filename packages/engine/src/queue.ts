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

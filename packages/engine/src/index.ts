import * as Y from 'yjs';
import { CueStore } from './store';
import { inboxItems, nextInboxItem } from './queue';
import type { Item } from './types';

export const VERSION = '0.0.0';

export interface CueEngine {
  getItems(): Item[];
  getInbox(): Item[];
  getNext(): Item | undefined;
  addItem(body: string): Item;
  subscribe(listener: () => void): () => void;
}

export function createEngine(doc: Y.Doc = new Y.Doc()): CueEngine {
  const store = new CueStore(doc);
  let snapshot: Item[] = store.getAllItems();
  const listeners = new Set<() => void>();

  store.subscribe(() => {
    snapshot = store.getAllItems();
    listeners.forEach((l) => l());
  });

  return {
    getItems: () => snapshot,
    getInbox: () => inboxItems(snapshot),
    getNext: () => nextInboxItem(snapshot),
    addItem: (body) => store.addItem(body),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export * from './types';
export { CueStore } from './store';
export * as queue from './queue';

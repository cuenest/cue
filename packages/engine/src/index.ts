import * as Y from 'yjs';
import { CueStore } from './store';
import { inboxItems, nextInboxItem, nextBumpOrder } from './queue';
import type { Item, ItemId } from './types';

export const VERSION = '0.0.0';

export interface CueEngine {
  getItems(): Item[];
  getInbox(): Item[];
  getNext(): Item | undefined;
  addItem(body: string): Item;
  subscribe(listener: () => void): () => void;
  complete(id: ItemId): Item;
  schedule(id: ItemId, dueAt: number): Item;
  delegate(id: ItemId, delegatedTo: string): Item;
  drop(id: ItemId): Item;
  bump(id: ItemId): Item;
  /** Return a processed item to the front of the queue. */
  requeue(id: ItemId): Item;
  /** Rewrite an item's body. */
  edit(id: ItemId, body: string): Item;
  /** Revert the most recent local mutation. No-op when there is nothing to undo. */
  undo(): void;
}

export function createEngine(doc: Y.Doc = new Y.Doc()): CueEngine {
  const store = new CueStore(doc);
  const undoManager = store.createUndoManager();
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
    complete: (id) => store.updateItem(id, { status: 'done' }),
    schedule: (id, dueAt) => store.updateItem(id, { status: 'scheduled', dueAt }),
    delegate: (id, delegatedTo) =>
      store.updateItem(id, { status: 'delegated', delegatedTo }),
    drop: (id) => store.updateItem(id, { status: 'dropped' }),
    bump: (id) => store.updateItem(id, { order: nextBumpOrder(snapshot) }),
    requeue: (id) => store.updateItem(id, { status: 'inbox', order: nextBumpOrder(snapshot) }),
    edit: (id, body) => store.updateItem(id, { body }),
    undo: () => {
      undoManager.undo();
    },
  };
}

export * from './types';
export { CueStore } from './store';
export * as queue from './queue';

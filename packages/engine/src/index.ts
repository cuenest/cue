import * as Y from 'yjs';
import { CueStore } from './store';
import { inboxItems, nextInboxItem, nextBumpOrder } from './queue';
import { parseIcsEvents, type CalendarEvent, type CalendarSource } from './calendar';
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
  /** Import a read-only calendar feed. */
  addSource(input: { name: string; color: string; icsText: string; url?: string }): CalendarSource;
  removeSource(id: string): void;
  getSources(): CalendarSource[];
  /** Master calendar: imported (locked) events merged with scheduled Cue items, sorted by start. */
  getCalendarEvents(rangeStart: number, rangeEnd: number): CalendarEvent[];
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
  store.subscribeSources(() => {
    snapshot = store.getAllItems(); // fresh ref so UI snapshots invalidate on source changes too
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
    addSource: (input) => store.addSource(input),
    removeSource: (id) => store.removeSource(id),
    getSources: () => store.getSources(),
    getCalendarEvents: (rangeStart, rangeEnd) => {
      const events: CalendarEvent[] = [];
      for (const src of store.getSources()) {
        const ics = store.getSourceIcs(src.id);
        if (!ics) continue;
        for (const e of parseIcsEvents(ics, rangeStart, rangeEnd)) {
          events.push({ ...e, locked: true, refId: src.id, color: src.color });
        }
      }
      for (const item of snapshot) {
        if (item.status !== 'scheduled' || typeof item.dueAt !== 'number') continue;
        if (item.dueAt >= rangeEnd || item.dueAt + 60 * 60 * 1000 <= rangeStart) continue;
        events.push({
          id: `item:${item.id}`,
          title: item.body,
          start: item.dueAt,
          end: item.dueAt + 60 * 60 * 1000,
          allDay: false,
          locked: false,
          refId: item.id,
        });
      }
      return events.sort((a, b) => a.start - b.start);
    },
  };
}

export * from './types';
export { CueStore } from './store';
export * as queue from './queue';
export { parseIcsEvents } from './calendar';
export type { CalendarEvent, CalendarSource } from './calendar';
export { generateSyncKey, encryptUpdate, decryptUpdate } from './sync/crypto';
export { makeLinkCode, parseLinkCode, type LinkPayload } from './sync/link';
export { HubProvider, type SyncStatus, type HubProviderOptions } from './sync/provider';

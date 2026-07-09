import * as Y from 'yjs';
import { CueStore } from './store';
import type { FileManifest } from './files';
import type { DeviceInfo } from './devices';
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
  /** Add a file manifest to the space doc (bytes are uploaded to the hub separately). */
  addFileManifest(m: FileManifest): void;
  getFileManifests(): FileManifest[];
  setHubComplete(id: string, complete: boolean): void;
  removeFile(id: string): void;
  /** Announce a device in this space; call again to heartbeat (updates lastSeen). */
  registerDevice(input: { id: string; name: string; surface: string }): void;
  touchDevice(id: string): void;
  removeDevice(id: string): void;
  getDevices(): DeviceInfo[];
  subscribeDevices(listener: () => void): () => void;
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
  store.subscribeFiles(() => {
    snapshot = store.getAllItems(); // same trick for file changes
    listeners.forEach((l) => l());
  });
  store.subscribeDevices(() => {
    snapshot = store.getAllItems(); // same trick so device-list changes invalidate UI
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
    addFileManifest: (m) => store.addFileManifest(m),
    getFileManifests: () => store.getFileManifests(),
    setHubComplete: (id, complete) => store.setHubComplete(id, complete),
    removeFile: (id) => store.removeFile(id),
    registerDevice: (input) => store.registerDevice(input),
    touchDevice: (id) => store.touchDevice(id),
    removeDevice: (id) => store.removeDevice(id),
    getDevices: () => store.getDevices(),
    subscribeDevices: (listener) => store.subscribeDevices(listener),
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
export {
  planUpload,
  uploadChunks,
  downloadChunks,
  assembleFile,
  chunkBytes,
  sha256,
  DEFAULT_CHUNK_SIZE,
  type FileManifest,
  type BlobIO,
} from './files';
export { isOnline, DEVICE_ONLINE_MS, type DeviceInfo } from './devices';
export { generateSyncKey, encryptUpdate, decryptUpdate } from './sync/crypto';
export { makeLinkCode, parseLinkCode, normalizeHubUrl, type LinkPayload } from './sync/link';
export { HubProvider, type SyncStatus, type HubProviderOptions } from './sync/provider';

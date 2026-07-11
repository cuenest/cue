import * as Y from 'yjs';
import type { Item, ItemId, ItemStatus } from './types';
import type { CalendarSource } from './calendar';
import type { FileManifest } from './files';
import type { DeviceInfo } from './devices';
import type { Note } from './notes';

const ITEMS_KEY = 'items';
const SOURCES_KEY = 'sources';
const FILES_KEY = 'files';
const DEVICES_KEY = 'devices';
const NOTES_KEY = 'notes';

export class CueStore {
  readonly doc: Y.Doc;
  private readonly items: Y.Map<Y.Map<unknown>>;
  private readonly sources: Y.Map<Y.Map<unknown>>;
  private readonly files: Y.Map<Y.Map<unknown>>;
  private readonly devices: Y.Map<Y.Map<unknown>>;
  private readonly notes: Y.Map<Y.Map<unknown>>;

  constructor(doc: Y.Doc = new Y.Doc()) {
    this.doc = doc;
    this.items = doc.getMap(ITEMS_KEY);
    this.sources = doc.getMap(SOURCES_KEY);
    this.files = doc.getMap(FILES_KEY);
    this.devices = doc.getMap(DEVICES_KEY);
    this.notes = doc.getMap(NOTES_KEY);
  }

  addItem(body: string, now: number = Date.now()): Item {
    const id = crypto.randomUUID();
    this.doc.transact(() => {
      const ymap = new Y.Map<unknown>();
      ymap.set('id', id);
      ymap.set('body', body);
      ymap.set('createdAt', now);
      ymap.set('status', 'inbox' satisfies ItemStatus);
      ymap.set('order', now);
      ymap.set('updatedAt', now);
      this.items.set(id, ymap);
    });
    return this.getItem(id)!;
  }

  getItem(id: ItemId): Item | undefined {
    const ymap = this.items.get(id);
    return ymap ? toItem(ymap) : undefined;
  }

  getAllItems(): Item[] {
    const out: Item[] = [];
    this.items.forEach((ymap) => out.push(toItem(ymap)));
    return out;
  }

  updateItem(
    id: ItemId,
    patch: Partial<Omit<Item, 'id' | 'createdAt'>>,
    now: number = Date.now(),
  ): Item {
    const ymap = this.items.get(id);
    if (!ymap) throw new Error(`Item not found: ${id}`);
    this.doc.transact(() => {
      for (const [key, value] of Object.entries(patch)) {
        if (value !== undefined) ymap.set(key, value);
      }
      ymap.set('updatedAt', now);
    });
    return toItem(ymap);
  }

  subscribe(listener: () => void): () => void {
    const handler = () => listener();
    this.items.observeDeep(handler);
    return () => this.items.unobserveDeep(handler);
  }

  /** Undo manager over the items map. captureTimeout 0 keeps each mutation a separate undo step. */
  createUndoManager(): Y.UndoManager {
    return new Y.UndoManager(this.items, { captureTimeout: 0 });
  }

  addSource(input: { name: string; color: string; icsText: string; url?: string }): CalendarSource {
    const id = crypto.randomUUID();
    const now = Date.now();
    this.doc.transact(() => {
      const ymap = new Y.Map<unknown>();
      ymap.set('id', id);
      ymap.set('name', input.name);
      ymap.set('color', input.color);
      ymap.set('icsText', input.icsText);
      if (input.url) ymap.set('url', input.url);
      ymap.set('addedAt', now);
      this.sources.set(id, ymap);
    });
    return { id, name: input.name, color: input.color, url: input.url, addedAt: now };
  }

  removeSource(id: string): void {
    this.doc.transact(() => {
      this.sources.delete(id);
    });
  }

  getSources(): CalendarSource[] {
    const out: CalendarSource[] = [];
    this.sources.forEach((y) => {
      out.push({
        id: y.get('id') as string,
        name: y.get('name') as string,
        color: y.get('color') as string,
        url: y.get('url') as string | undefined,
        addedAt: y.get('addedAt') as number,
      });
    });
    return out.sort((a, b) => a.addedAt - b.addedAt);
  }

  getSourceIcs(id: string): string | undefined {
    return this.sources.get(id)?.get('icsText') as string | undefined;
  }

  /** Subscribe to calendar-source changes (items subscription does not cover this map). */
  subscribeSources(listener: () => void): () => void {
    const handler = () => listener();
    this.sources.observeDeep(handler);
    return () => this.sources.unobserveDeep(handler);
  }

  /** Store a file manifest in the doc (the bytes live on the hub, not here). */
  addFileManifest(m: FileManifest): void {
    this.doc.transact(() => {
      const ymap = new Y.Map<unknown>();
      ymap.set('id', m.id);
      ymap.set('name', m.name);
      ymap.set('mime', m.mime);
      ymap.set('size', m.size);
      ymap.set('chunkHashes', m.chunkHashes);
      ymap.set('hubComplete', m.hubComplete);
      ymap.set('addedAt', m.addedAt);
      this.files.set(m.id, ymap);
    });
  }

  getFileManifests(): FileManifest[] {
    const out: FileManifest[] = [];
    this.files.forEach((y) => {
      out.push({
        id: y.get('id') as string,
        name: y.get('name') as string,
        mime: y.get('mime') as string,
        size: y.get('size') as number,
        chunkHashes: (y.get('chunkHashes') as string[]) ?? [],
        hubComplete: (y.get('hubComplete') as boolean) ?? false,
        addedAt: y.get('addedAt') as number,
      });
    });
    return out.sort((a, b) => b.addedAt - a.addedAt);
  }

  setHubComplete(id: string, complete: boolean): void {
    const y = this.files.get(id);
    if (!y) return;
    this.doc.transact(() => {
      y.set('hubComplete', complete);
    });
  }

  removeFile(id: string): void {
    this.doc.transact(() => {
      this.files.delete(id);
    });
  }

  subscribeFiles(listener: () => void): () => void {
    const handler = () => listener();
    this.files.observeDeep(handler);
    return () => this.files.unobserveDeep(handler);
  }

  /** Announce a device in this space (idempotent — updates name/lastSeen, keeps addedAt). */
  registerDevice(input: { id: string; name: string; surface: string }, now: number = Date.now()): void {
    this.doc.transact(() => {
      let y = this.devices.get(input.id);
      if (!y) {
        y = new Y.Map<unknown>();
        y.set('id', input.id);
        y.set('addedAt', now);
        this.devices.set(input.id, y);
      }
      y.set('name', input.name);
      y.set('surface', input.surface);
      y.set('lastSeen', now);
    });
  }

  /** Heartbeat: refresh a device's lastSeen (no-op if it isn't registered). */
  touchDevice(id: string, now: number = Date.now()): void {
    const y = this.devices.get(id);
    if (!y) return;
    this.doc.transact(() => y.set('lastSeen', now));
  }

  removeDevice(id: string): void {
    this.doc.transact(() => {
      this.devices.delete(id);
    });
  }

  getDevices(): DeviceInfo[] {
    const out: DeviceInfo[] = [];
    this.devices.forEach((y) => {
      out.push({
        id: y.get('id') as string,
        name: y.get('name') as string,
        surface: (y.get('surface') as string) ?? 'web',
        addedAt: y.get('addedAt') as number,
        lastSeen: y.get('lastSeen') as number,
      });
    });
    return out.sort((a, b) => a.addedAt - b.addedAt);
  }

  subscribeDevices(listener: () => void): () => void {
    const handler = () => listener();
    this.devices.observeDeep(handler);
    return () => this.devices.unobserveDeep(handler);
  }

  // ---- Notes ----------------------------------------------------------------
  createNote(input: { title: string; body?: string }, now: number = Date.now()): Note {
    const id = crypto.randomUUID();
    this.doc.transact(() => {
      const y = new Y.Map<unknown>();
      y.set('id', id);
      y.set('title', input.title);
      y.set('body', input.body ?? '');
      y.set('createdAt', now);
      y.set('updatedAt', now);
      this.notes.set(id, y);
    });
    return this.getNote(id)!;
  }

  updateNote(id: string, patch: { title?: string; body?: string }, now: number = Date.now()): void {
    const y = this.notes.get(id);
    if (!y) return;
    this.doc.transact(() => {
      if (patch.title !== undefined) y.set('title', patch.title);
      if (patch.body !== undefined) y.set('body', patch.body);
      y.set('updatedAt', now);
    });
  }

  removeNote(id: string): void {
    this.doc.transact(() => {
      this.notes.delete(id);
    });
  }

  getNote(id: string): Note | undefined {
    const y = this.notes.get(id);
    return y ? toNote(y) : undefined;
  }

  getNotes(): Note[] {
    const out: Note[] = [];
    this.notes.forEach((y) => out.push(toNote(y)));
    return out.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  subscribeNotes(listener: () => void): () => void {
    const handler = () => listener();
    this.notes.observeDeep(handler);
    return () => this.notes.unobserveDeep(handler);
  }
}

function toNote(y: Y.Map<unknown>): Note {
  return {
    id: y.get('id') as string,
    title: y.get('title') as string,
    body: (y.get('body') as string) ?? '',
    createdAt: y.get('createdAt') as number,
    updatedAt: y.get('updatedAt') as number,
  };
}

function toItem(y: Y.Map<unknown>): Item {
  return {
    id: y.get('id') as string,
    body: y.get('body') as string,
    createdAt: y.get('createdAt') as number,
    status: y.get('status') as ItemStatus,
    order: y.get('order') as number,
    dueAt: y.get('dueAt') as number | undefined,
    delegatedTo: y.get('delegatedTo') as string | undefined,
    updatedAt: y.get('updatedAt') as number,
    noteRefs: y.get('noteRefs') as string[] | undefined,
  };
}

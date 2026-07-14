import { useEffect, useState } from 'react';
import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import {
  createEngine,
  generateSyncKey,
  HubProvider,
  keyringFromLegacy,
  currentEpochKey,
  rotateKeyring,
  type Keyring,
  type EpochKey,
  type CueEngine,
  type SyncStatus,
} from '@cue/engine';
import { DEFAULT_HUB, syncManager } from '../sync/manager';

/**
 * Shared spaces (Phase 3 MVP): each space is its own Yjs document, hub room and
 * AES key — a fully separate encrypted world. Sharing the space's link code
 * grants access. Per-person keys/signatures are future work; this is the
 * "shared vault" model, stated honestly. Rotation ("change the locks") is the
 * escape hatch: it moves the space to a fresh key + room, so old invite codes
 * stop granting access to anything new. Devices re-join by scanning the new code.
 */

export interface SpaceInfo {
  id: string;
  name: string;
  /** Current room — mirrors the current epoch (kept flat for older stored JSON). */
  room: string;
  /** Current key — mirrors the current epoch. */
  key: string;
  hub: string;
  /** Full key history; absent on never-rotated spaces stored by older builds. */
  epochs?: EpochKey[];
  current?: number;
}

/** The space's full key history; legacy entries (no epochs) migrate to epoch 0. */
export function spaceKeyring(s: Pick<SpaceInfo, 'room' | 'key' | 'epochs' | 'current'>): Keyring {
  if (s.epochs && s.epochs.length > 0) return { current: s.current ?? 0, epochs: s.epochs };
  return keyringFromLegacy(s.key, s.room);
}

/** Room history, current first — older rooms still hold pre-rotation file chunks. */
export function spaceRooms(s: Pick<SpaceInfo, 'room' | 'key' | 'epochs' | 'current'>): string[] {
  const kr = spaceKeyring(s);
  return [...kr.epochs].sort((a, b) => b.epoch - a.epoch).map((e) => e.room);
}

export const PERSONAL_SPACE = 'personal';
const LIST_KEY = 'cue-spaces';
const ACTIVE_KEY = 'cue-active-space';

interface LiveSpace {
  engine: CueEngine;
  doc: Y.Doc;
  provider: HubProvider;
  status: SyncStatus;
}

class SpaceManager {
  private personal: CueEngine | null = null;
  private live = new Map<string, LiveSpace>();
  private listeners = new Set<() => void>();

  init(personalEngine: CueEngine): void {
    this.personal = personalEngine;
  }

  list(): SpaceInfo[] {
    try {
      const raw = localStorage.getItem(LIST_KEY);
      return raw ? (JSON.parse(raw) as SpaceInfo[]) : [];
    } catch {
      return [];
    }
  }

  private saveList(spaces: SpaceInfo[]): void {
    try {
      localStorage.setItem(LIST_KEY, JSON.stringify(spaces));
    } catch {
      /* private mode */
    }
    this.emit();
  }

  activeId(): string {
    const id = localStorage.getItem(ACTIVE_KEY) ?? PERSONAL_SPACE;
    return id === PERSONAL_SPACE || this.list().some((s) => s.id === id) ? id : PERSONAL_SPACE;
  }

  setActive(id: string): void {
    try {
      localStorage.setItem(ACTIVE_KEY, id);
    } catch {
      /* fine */
    }
    this.emit();
  }

  async create(name: string, hub: string): Promise<SpaceInfo> {
    const space: SpaceInfo = {
      id: crypto.randomUUID(),
      name: name.trim() || 'Shared space',
      room: crypto.randomUUID(),
      key: await generateSyncKey(),
      hub: hub.trim() || DEFAULT_HUB,
    };
    this.saveList([...this.list(), space]);
    return space;
  }

  join(input: {
    name: string;
    room: string;
    key: string;
    hub: string;
    /** Full history from a v2 invite — lets this device read pre-rotation files. */
    keyring?: Keyring;
  }): SpaceInfo {
    const existing = this.list().find((s) => s.room === input.room);
    if (existing) return existing;
    const space: SpaceInfo = {
      id: crypto.randomUUID(),
      name: input.name,
      room: input.room,
      key: input.key,
      hub: input.hub,
    };
    if (input.keyring && input.keyring.epochs.length > 1) {
      space.epochs = input.keyring.epochs;
      space.current = input.keyring.current;
    }
    this.saveList([...this.list(), space]);
    return space;
  }

  /**
   * Change the locks: fresh key + fresh room as a new epoch. Old invite codes
   * keep opening only what they could already read; everything from now on
   * needs the new code. Other devices re-join by scanning it — their local
   * replica re-pushes into the new room on connect, so no data is lost.
   */
  async rotate(id: string): Promise<SpaceInfo | null> {
    const info = this.list().find((s) => s.id === id);
    if (!info) return null;
    const rotated = await rotateKeyring(spaceKeyring(info));
    const cur = currentEpochKey(rotated);
    const updated: SpaceInfo = {
      ...info,
      room: cur.room,
      key: cur.key,
      epochs: rotated.epochs,
      current: rotated.current,
    };
    this.saveList(this.list().map((s) => (s.id === id ? updated : s)));

    // reconnect the live provider (if any) to the new room under the new key
    const live = this.live.get(id);
    if (live) {
      live.provider.destroy();
      live.provider = new HubProvider(live.doc, {
        url: updated.hub,
        room: updated.room,
        key: updated.key,
        keyring: rotated,
      });
      live.provider.onStatus((s) => {
        live.status = s;
        this.emit();
      });
    }
    return updated;
  }

  leave(id: string): void {
    const l = this.live.get(id);
    l?.provider.destroy();
    this.live.delete(id);
    this.saveList(this.list().filter((s) => s.id !== id));
    if (this.activeId() === id) this.setActive(PERSONAL_SPACE);
  }

  engine(id: string): CueEngine {
    if (id === PERSONAL_SPACE) {
      if (!this.personal) throw new Error('SpaceManager not initialised');
      return this.personal;
    }
    const cached = this.live.get(id);
    if (cached) return cached.engine;

    const info = this.list().find((s) => s.id === id);
    if (!info) return this.engine(PERSONAL_SPACE);

    const doc = new Y.Doc();
    if (typeof indexedDB !== 'undefined') new IndexeddbPersistence(`cue-space-${info.id}`, doc);
    const engine = createEngine(doc);
    const provider = new HubProvider(doc, {
      url: info.hub,
      room: info.room,
      key: info.key,
      keyring: spaceKeyring(info),
    });
    const entry: LiveSpace = { engine, doc, provider, status: 'offline' };
    provider.onStatus((s) => {
      entry.status = s;
      this.emit();
    });
    this.live.set(id, entry);
    return engine;
  }

  status(id: string): SyncStatus | null {
    if (id === PERSONAL_SPACE) return null;
    return this.live.get(id)?.status ?? 'offline';
  }

  /**
   * Hub/room/key(ring) for the active space — needed to upload/download file
   * chunks. `rooms` is the room history (current first): pre-rotation chunks
   * still live under older rooms on the hub. Null if no hub is configured.
   */
  activeTransport(): {
    hub: string;
    room: string;
    key: string;
    keyring: Keyring;
    rooms: string[];
  } | null {
    const id = this.activeId();
    const s =
      id === PERSONAL_SPACE ? syncManager.getConfig() : this.list().find((x) => x.id === id);
    if (!s) return null;
    return {
      hub: s.hub,
      room: s.room,
      key: s.key,
      keyring: spaceKeyring(s),
      rooms: spaceRooms(s),
    };
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    this.listeners.forEach((l) => l());
  }
}

export const spaceManager = new SpaceManager();

/** Active space id + its engine; re-renders on any space change. */
export function useActiveSpace(): { spaceId: string; engine: CueEngine; spaces: SpaceInfo[] } {
  const [, force] = useState(0);
  useEffect(() => spaceManager.onChange(() => force((n) => n + 1)), []);
  const spaceId = spaceManager.activeId();
  return { spaceId, engine: spaceManager.engine(spaceId), spaces: spaceManager.list() };
}

import { useEffect, useState } from 'react';
import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import {
  createEngine,
  generateSyncKey,
  HubProvider,
  type CueEngine,
  type SyncStatus,
} from '@cue/engine';
import { DEFAULT_HUB, syncManager } from '../sync/manager';

/**
 * Shared spaces (Phase 3 MVP): each space is its own Yjs document, hub room and
 * AES key — a fully separate encrypted world. Sharing the space's link code
 * grants access. Per-person keys/signatures are future work; this is the
 * "shared vault" model, stated honestly.
 */

export interface SpaceInfo {
  id: string;
  name: string;
  room: string;
  key: string;
  hub: string;
}

export const PERSONAL_SPACE = 'personal';
const LIST_KEY = 'cue-spaces';
const ACTIVE_KEY = 'cue-active-space';

interface LiveSpace {
  engine: CueEngine;
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

  join(input: { name: string; room: string; key: string; hub: string }): SpaceInfo {
    const existing = this.list().find((s) => s.room === input.room);
    if (existing) return existing;
    const space: SpaceInfo = { id: crypto.randomUUID(), ...input };
    this.saveList([...this.list(), space]);
    return space;
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
    const provider = new HubProvider(doc, { url: info.hub, room: info.room, key: info.key });
    const entry: LiveSpace = { engine, provider, status: 'offline' };
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

  /** Hub/room/key for the active space — needed to upload/download file chunks. Null if none. */
  activeTransport(): { hub: string; room: string; key: string } | null {
    const id = this.activeId();
    if (id === PERSONAL_SPACE) {
      const cfg = syncManager.getConfig();
      return cfg ? { hub: cfg.hub, room: cfg.room, key: cfg.key } : null;
    }
    const s = this.list().find((x) => x.id === id);
    return s ? { hub: s.hub, room: s.room, key: s.key } : null;
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

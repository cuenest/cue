import { useEffect, useState } from 'react';
import * as Y from 'yjs';
import {
  HubProvider,
  normalizeHubUrl,
  keyringFromLegacy,
  currentEpochKey,
  rotateKeyring,
  type EpochKey,
  type Keyring,
  type SyncStatus,
} from '@cue/engine';

export interface SyncConfig {
  /** Current room — mirrors the current epoch. */
  room: string;
  /** Current key — mirrors the current epoch. */
  key: string;
  hub: string;
  /** Full key history; absent until the first rotation. */
  epochs?: EpochKey[];
  current?: number;
}

/** The personal space's full key history; pre-epoch configs migrate to epoch 0. */
export function configKeyring(cfg: SyncConfig): Keyring {
  if (cfg.epochs && cfg.epochs.length > 0) return { current: cfg.current ?? 0, epochs: cfg.epochs };
  return keyringFromLegacy(cfg.key, cfg.room);
}

const STORAGE_KEY = 'cue-sync';

// Configurable at build time (VITE_DEFAULT_HUB) so a deployed app points at a
// real hub; falls back to the local dev hub. A bare host is normalized to wss://
// (see normalizeHubUrl) — that's what Render's `fromService` host injection
// provides. Users can still override the hub per-space in Settings.
export const DEFAULT_HUB = import.meta.env.VITE_DEFAULT_HUB
  ? normalizeHubUrl(import.meta.env.VITE_DEFAULT_HUB)
  : 'ws://localhost:4444';

class SyncManager {
  private doc: Y.Doc | null = null;
  private provider: HubProvider | null = null;
  private listeners = new Set<(s: SyncStatus) => void>();
  status: SyncStatus = 'offline';

  /** Call once at startup with the app's Y.Doc; starts sync if configured. */
  init(doc: Y.Doc): void {
    this.doc = doc;
    const cfg = this.getConfig();
    if (cfg) this.start(cfg);
  }

  getConfig(): SyncConfig | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const cfg = JSON.parse(raw) as SyncConfig;
      return cfg.room && cfg.key && cfg.hub ? cfg : null;
    } catch {
      return null;
    }
  }

  /** Set (and persist) a config, or null to leave the sync space. */
  configure(cfg: SyncConfig | null): void {
    this.provider?.destroy();
    this.provider = null;
    try {
      if (cfg) localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* private mode */
    }
    if (cfg && this.doc) this.start(cfg);
    else this.emit('offline');
  }

  /**
   * Change the locks on the personal space: new key + room as a new epoch.
   * Other devices re-join by scanning the new link code; their replicas
   * re-push on connect. Returns the new config, or null if sync isn't set up.
   */
  async rotate(): Promise<SyncConfig | null> {
    const cfg = this.getConfig();
    if (!cfg) return null;
    const rotated = await rotateKeyring(configKeyring(cfg));
    const cur = currentEpochKey(rotated);
    const next: SyncConfig = {
      ...cfg,
      room: cur.room,
      key: cur.key,
      epochs: rotated.epochs,
      current: rotated.current,
    };
    this.configure(next); // persists + restarts the provider against the new room
    return next;
  }

  private start(cfg: SyncConfig): void {
    if (!this.doc) return;
    this.provider = new HubProvider(this.doc, {
      url: cfg.hub,
      room: cfg.room,
      key: cfg.key,
      keyring: configKeyring(cfg),
    });
    this.provider.onStatus((s) => this.emit(s));
  }

  private emit(s: SyncStatus): void {
    this.status = s;
    this.listeners.forEach((l) => l(s));
  }

  onStatus(listener: (s: SyncStatus) => void): () => void {
    this.listeners.add(listener);
    listener(this.status);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export const syncManager = new SyncManager();

export function useSyncStatus(): SyncStatus {
  const [status, setStatus] = useState<SyncStatus>(syncManager.status);
  useEffect(() => syncManager.onStatus(setStatus), []);
  return status;
}

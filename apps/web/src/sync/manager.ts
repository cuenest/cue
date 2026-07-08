import { useEffect, useState } from 'react';
import * as Y from 'yjs';
import { HubProvider, normalizeHubUrl, type SyncStatus } from '@cue/engine';

export interface SyncConfig {
  room: string;
  key: string;
  hub: string;
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

  private start(cfg: SyncConfig): void {
    if (!this.doc) return;
    this.provider = new HubProvider(this.doc, { url: cfg.hub, room: cfg.room, key: cfg.key });
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

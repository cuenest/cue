import './style.css';
import { createRoot } from 'react-dom/client';
import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import { createEngine, HubProvider, type SyncStatus } from '@cue/engine';
import { drainPending } from '../../lib/pending';
import { PopupApp } from './App';

// theme follows the OS in the popup
if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
  document.documentElement.classList.add('dark');
}

const doc = new Y.Doc();
new IndexeddbPersistence('cue-ext', doc);
const engine = createEngine(doc);

// context-menu captures collected while the popup was closed
void drainPending(browser.storage.local, (body) => engine.addItem(body));

// join the sync space if this extension has been linked
export interface ExtSyncConfig {
  room: string;
  key: string;
  hub: string;
}
let provider: HubProvider | null = null;
let status: SyncStatus = 'offline';
const statusListeners = new Set<(s: SyncStatus) => void>();

export function getSyncConfig(): ExtSyncConfig | null {
  try {
    const raw = localStorage.getItem('cue-sync');
    return raw ? (JSON.parse(raw) as ExtSyncConfig) : null;
  } catch {
    return null;
  }
}

export function setSyncConfig(cfg: ExtSyncConfig | null): void {
  provider?.destroy();
  provider = null;
  if (cfg) localStorage.setItem('cue-sync', JSON.stringify(cfg));
  else localStorage.removeItem('cue-sync');
  start();
}

function start(): void {
  const cfg = getSyncConfig();
  if (!cfg) {
    status = 'offline';
    statusListeners.forEach((l) => l(status));
    return;
  }
  provider = new HubProvider(doc, { url: cfg.hub, room: cfg.room, key: cfg.key });
  provider.onStatus((s) => {
    status = s;
    statusListeners.forEach((l) => l(s));
  });
}
start();

export function onSyncStatus(listener: (s: SyncStatus) => void): () => void {
  statusListeners.add(listener);
  listener(status);
  return () => {
    statusListeners.delete(listener);
  };
}

createRoot(document.getElementById('root')!).render(<PopupApp engine={engine} />);

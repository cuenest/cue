import './styles/globals.css';
import { createRoot } from 'react-dom/client';
import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import { createEngine } from '@cue/engine';
import { App } from './App';
import { syncManager } from './sync/manager';
import { registerFileWorker } from './files/preview';

void registerFileWorker(); // enables streaming file previews

const doc = new Y.Doc();
const persistent = typeof indexedDB !== 'undefined';
if (persistent) {
  new IndexeddbPersistence('cue', doc);
}
const engine = createEngine(doc);
syncManager.init(doc); // starts encrypted sync if this device is in a sync space

if (import.meta.env.DEV) {
  // dev-only debug handles
  (window as unknown as Record<string, unknown>).__cueDoc = doc;
  (window as unknown as Record<string, unknown>).__cueEngine = engine;
}

createRoot(document.getElementById('root')!).render(
  <App engine={engine} persistent={persistent} />,
);

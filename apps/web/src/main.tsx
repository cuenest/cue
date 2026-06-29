import { createRoot } from 'react-dom/client';
import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import { createEngine } from '@cue/engine';
import { App } from './App';

const doc = new Y.Doc();
const persistent = typeof indexedDB !== 'undefined';
if (persistent) {
  new IndexeddbPersistence('cue', doc);
}
const engine = createEngine(doc);

createRoot(document.getElementById('root')!).render(
  <App engine={engine} persistent={persistent} />,
);

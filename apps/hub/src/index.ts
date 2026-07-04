import { createHub } from './server';

const port = Number(process.env.PORT ?? 4444);
const dataDir = process.env.CUE_HUB_DATA ?? './data';

createHub({ port, dataDir }).then((hub) => {
  console.log(`[cue-hub] listening on ws://0.0.0.0:${hub.port}`);
  console.log(`[cue-hub] persisting encrypted rooms to ${dataDir}`);
  console.log('[cue-hub] this node relays ciphertext only — it cannot read your data');
});

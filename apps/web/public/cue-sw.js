/*
 * Cue Service Worker — two jobs in one worker (a page can only have one).
 *
 * 1. App shell / PWA: precache the shell on install and serve it offline, so
 *    Cue launches with no network. The app is local-first (its data lives in
 *    IndexedDB), so once the shell loads it's fully usable offline.
 *      - navigations  → network-first, fall back to the cached shell
 *      - /assets/*    → cache-first (Vite hashes these, so they're immutable)
 *      - dev modules  → left untouched, so Vite HMR keeps working in dev
 *
 * 2. File streaming: intercept /cue-file/:id and serve the decrypted file by
 *    pulling only the encrypted chunks it needs (local cache first, then the
 *    hub), decrypting in the worker, honouring HTTP Range. The file is never
 *    fully downloaded and the hub only ever serves ciphertext. The page hands
 *    the worker fetch info by postMessage (also persisted to IndexedDB so it
 *    survives the worker being recycled).
 */

const APP_CACHE = 'cue-app-v1';
// Static, non-hashed shell files worth caching by path (icons, manifest).
const APP_SHELL_STATIC = new Set([
  '/manifest.webmanifest',
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
  '/favicon.png',
]);

const files = new Map(); // id -> { httpHub, room, key, chunkHashes, chunkSize, size, mime }

self.addEventListener('install', (e) => {
  self.skipWaiting();
  // Best-effort precache: cache each entry on its own so one 404 (e.g. in dev)
  // doesn't abort the whole batch.
  e.waitUntil(
    caches.open(APP_CACHE).then((cache) =>
      Promise.allSettled(['/', ...APP_SHELL_STATIC].map((u) => cache.add(u))),
    ),
  );
});

self.addEventListener('activate', (e) =>
  e.waitUntil(
    (async () => {
      // Drop caches from older SW versions.
      const names = await caches.keys();
      await Promise.all(names.map((n) => (n !== APP_CACHE ? caches.delete(n) : null)));
      await self.clients.claim();
    })(),
  ),
);

// network-first: keep the shell fresh online, fall back to cache offline
async function serveShell(req) {
  const cache = await caches.open(APP_CACHE);
  try {
    const fresh = await fetch(req);
    cache.put('/', fresh.clone()); // hash routing → every navigation is path "/"
    return fresh;
  } catch {
    return (await cache.match('/')) || new Response('offline', { status: 503 });
  }
}

// cache-first with background revalidate: instant for immutable hashed assets
async function serveAsset(req) {
  const cache = await caches.open(APP_CACHE);
  const cached = await cache.match(req);
  const network = fetch(req)
    .then((res) => {
      if (res && res.status === 200 && res.type === 'basic') cache.put(req, res.clone());
      return res;
    })
    .catch(() => null);
  return cached || (await network) || new Response('offline', { status: 503 });
}

self.addEventListener('message', (event) => {
  const d = event.data;
  if (d && d.type === 'cue-file' && d.id && d.info) files.set(d.id, d.info);
  if (d && d.type === 'cue-file-forget' && d.id) files.delete(d.id);
});

function fromB64url(s) {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  const o = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) o[i] = b.charCodeAt(i);
  return o;
}

// read a chunk's ciphertext from the local cache (IndexedDB), else the hub
function localGet(hash) {
  return new Promise((resolve) => {
    const r = indexedDB.open('cue-blobs', 1);
    r.onupgradeneeded = () => {
      if (!r.result.objectStoreNames.contains('chunks')) r.result.createObjectStore('chunks');
    };
    r.onsuccess = () => {
      try {
        const g = r.result.transaction('chunks').objectStore('chunks').get(hash);
        g.onsuccess = () => resolve(g.result || null);
        g.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    };
    r.onerror = () => resolve(null);
  });
}

async function decryptChunk(info, key, hash) {
  let payload = await localGet(hash);
  if (!payload) {
    const res = await fetch(`${info.httpHub}/blob/${info.room}/${hash}`);
    if (!res.ok) throw new Error('blob ' + res.status);
    payload = new Uint8Array(await res.arrayBuffer());
  } else {
    payload = new Uint8Array(payload);
  }
  // Envelope: [suite:1][iv:12][ciphertext+tag]. 0x01 = AES-256-GCM.
  // Must match encryptUpdate in packages/engine/src/sync/crypto.ts.
  if (payload[0] !== 0x01) throw new Error('unknown crypto suite ' + payload[0]);
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: payload.slice(1, 13) },
    key,
    payload.slice(13),
  );
  return new Uint8Array(plain);
}

// file info persisted by the page (survives this worker being recycled)
function loadInfo(id) {
  return new Promise((resolve) => {
    const r = indexedDB.open('cue-fileinfo', 1);
    r.onupgradeneeded = () => {
      if (!r.result.objectStoreNames.contains('info')) r.result.createObjectStore('info');
    };
    r.onsuccess = () => {
      try {
        const g = r.result.transaction('info').objectStore('info').get(id);
        g.onsuccess = () => resolve(g.result || null);
        g.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    };
    r.onerror = () => resolve(null);
  });
}

async function serve(request, id) {
  let info = files.get(id);
  if (!info) {
    info = await loadInfo(id); // rebuild from IndexedDB if the worker was restarted
    if (info) files.set(id, info);
  }
  if (!info) return new Response('unknown file', { status: 404 });

  const key = await crypto.subtle.importKey('raw', fromB64url(info.key), { name: 'AES-GCM' }, false, [
    'decrypt',
  ]);
  const size = info.size;
  const chunkSize = info.chunkSize;

  const rangeHeader = request.headers.get('range');
  let start = 0;
  let end = size - 1;
  let status = 200;
  if (rangeHeader) {
    const rm = /bytes=(\d*)-(\d*)/.exec(rangeHeader);
    if (rm) {
      start = rm[1] ? parseInt(rm[1], 10) : 0;
      end = rm[2] ? parseInt(rm[2], 10) : size - 1;
      status = 206;
    }
  }
  if (end >= size) end = size - 1;
  if (size === 0) {
    return new Response(new Uint8Array(0), {
      status: 200,
      headers: { 'Content-Type': info.mime || 'application/octet-stream', 'Content-Length': '0' },
    });
  }

  const first = Math.floor(start / chunkSize);
  const last = Math.floor(end / chunkSize);
  const parts = [];
  for (let i = first; i <= last; i++) {
    const plain = await decryptChunk(info, key, info.chunkHashes[i]);
    const chunkStart = i * chunkSize;
    const from = Math.max(0, start - chunkStart);
    const to = Math.min(plain.length, end - chunkStart + 1);
    parts.push(plain.subarray(from, to));
  }
  let total = 0;
  for (const p of parts) total += p.length;
  const body = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    body.set(p, o);
    o += p.length;
  }

  const headers = {
    'Content-Type': info.mime || 'application/octet-stream',
    'Accept-Ranges': 'bytes',
    'Content-Length': String(body.length),
  };
  if (status === 206) headers['Content-Range'] = `bytes ${start}-${end}/${size}`;
  return new Response(body, { status, headers });
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  // Cross-origin (hub blobs, Google Fonts) is left to the browser.
  if (url.origin !== self.location.origin) return;

  // 1) virtual file streaming
  const m = /^\/cue-file\/(.+)$/.exec(url.pathname);
  if (m) {
    event.respondWith(serve(req, decodeURIComponent(m[1])));
    return;
  }

  if (req.method !== 'GET') return;

  // 2) page navigations → app shell (offline launch)
  if (req.mode === 'navigate') {
    event.respondWith(serveShell(req));
    return;
  }

  // 3) built assets + static icons → cache-first. Dev module requests
  //    (/src/*, /@vite/*, /node_modules/*) fall through untouched for HMR.
  if (url.pathname.startsWith('/assets/') || APP_SHELL_STATIC.has(url.pathname)) {
    event.respondWith(serveAsset(req));
  }
});

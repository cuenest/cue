/*
 * Cue file-streaming Service Worker.
 *
 * Intercepts requests to /cue-file/:id and serves the decrypted file by pulling
 * only the encrypted chunks it needs from the hub, decrypting them in the worker,
 * and honouring HTTP Range. This lets <video>/<audio>/<img> play or preview a
 * file straight from the hub — the file is never fully downloaded, and only the
 * requested byte range's chunks are fetched. The hub only ever serves ciphertext.
 *
 * The page tells the worker how to fetch a file by postMessage before setting the
 * element's src; the worker keeps that map in memory.
 */

const files = new Map(); // id -> { httpHub, room, key, chunkHashes, chunkSize, size, mime }

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

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
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: payload.slice(0, 12) },
    key,
    payload.slice(12),
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
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  const m = /^\/cue-file\/(.+)$/.exec(url.pathname);
  if (!m) return;
  event.respondWith(serve(event.request, decodeURIComponent(m[1])));
});

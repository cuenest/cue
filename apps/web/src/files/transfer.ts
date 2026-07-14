import {
  sha256,
  keyringFromLegacy,
  encryptForKeyring,
  decryptWithKeyring,
  DEFAULT_CHUNK_SIZE,
  type BlobIO,
  type FileManifest,
  type Keyring,
} from '@cue/engine';
import { localChunks, setPinned } from './localStore';

/** Bare key (pre-rotation spaces) or the full key history. */
export type TransferKey = string | Keyring;

function asKeyring(key: TransferKey): Keyring {
  return typeof key === 'string' ? keyringFromLegacy(key, '') : key;
}

/**
 * A BlobIO backed by the hub's HTTP blob store. Converts the ws:// hub URL to
 * http://. `rooms` is the room history, current first — after a key rotation
 * the space moves to a new room, but chunks uploaded earlier still live under
 * the old one, so reads fall back through the history. Writes always go to the
 * current room.
 */
export function hubBlobIO(hubWsUrl: string, rooms: string | string[]): BlobIO {
  const base = hubWsUrl.replace(/^ws/, 'http').replace(/\/+$/, '');
  const roomList = typeof rooms === 'string' ? [rooms] : rooms;
  const url = (room: string, hash: string) =>
    `${base}/blob/${encodeURIComponent(room)}/${encodeURIComponent(hash)}`;
  return {
    async has(hash) {
      for (const room of roomList) {
        try {
          const r = await fetch(url(room, hash), { method: 'HEAD' });
          if (r.ok) return true;
        } catch {
          /* try the next room */
        }
      }
      return false;
    },
    async put(hash, cipher) {
      const r = await fetch(url(roomList[0]!, hash), { method: 'PUT', body: cipher as BodyInit });
      if (!r.ok) throw new Error(`blob put failed: ${r.status}`);
    },
    async get(hash) {
      let lastStatus = 0;
      for (const room of roomList) {
        try {
          const r = await fetch(url(room, hash));
          if (r.ok) return new Uint8Array(await r.arrayBuffer());
          lastStatus = r.status;
        } catch {
          /* try the next room */
        }
      }
      throw new Error(`blob get failed: ${lastStatus || 'network'}`);
    },
  };
}

const CHUNK = DEFAULT_CHUNK_SIZE;

function chunkCount(size: number): number {
  return size === 0 ? 1 : Math.ceil(size / CHUNK);
}

async function sliceBytes(file: File, i: number): Promise<Uint8Array> {
  return new Uint8Array(await file.slice(i * CHUNK, (i + 1) * CHUNK).arrayBuffer());
}

/** Hash a File one slice at a time (peak memory = one chunk), without loading it whole. */
export async function hashFileChunks(file: File): Promise<string[]> {
  const n = chunkCount(file.size);
  const hashes: string[] = [];
  for (let i = 0; i < n; i++) hashes.push(await sha256(await sliceBytes(file, i)));
  return hashes;
}

/**
 * Encrypt + upload each missing chunk, reading one slice at a time. Dedup by
 * hash. Chunks upload with limited concurrency so a multi-chunk file isn't stuck
 * doing one slow round-trip at a time (the dominant cost on a remote hub), while
 * capping how much is in flight at once for low-memory devices.
 */
export async function uploadFileChunks(
  file: File,
  hashes: string[],
  key: TransferKey,
  io: BlobIO,
  onProgress?: (done: number, total: number) => void,
  concurrency = 3,
): Promise<void> {
  const kr = asKeyring(key);
  let done = 0;
  let cursor = 0;
  async function worker(): Promise<void> {
    for (;;) {
      const i = cursor++;
      if (i >= hashes.length) return;
      const hash = hashes[i]!;
      if (!(await io.has(hash))) {
        await io.put(hash, await encryptForKeyring(kr, await sliceBytes(file, i)));
      }
      done += 1;
      onProgress?.(done, hashes.length);
    }
  }
  const workers = Math.max(1, Math.min(concurrency, hashes.length));
  await Promise.all(Array.from({ length: workers }, () => worker()));
}

/**
 * Read-through BlobIO: serves chunks from the local cache first, falling back to
 * the hub. Used for download/preview so pinned files keep working when the hub is
 * offline. Writes still go to the hub.
 */
export function localFirstIO(hub: BlobIO): BlobIO {
  return {
    async has(hash) {
      return (await localChunks.has(hash)) || hub.has(hash);
    },
    async get(hash) {
      const cached = await localChunks.get(hash);
      if (cached) return cached;
      return hub.get(hash);
    },
    put: hub.put,
  };
}

/** "Keep offline": download every chunk from the hub into the local cache. */
export async function pinFile(
  manifest: FileManifest,
  hub: BlobIO,
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  const total = manifest.chunkHashes.length;
  for (let i = 0; i < total; i++) {
    const hash = manifest.chunkHashes[i]!;
    if (!(await localChunks.has(hash))) {
      await localChunks.put(hash, await hub.get(hash));
    }
    onProgress?.(i + 1, total);
  }
  setPinned(manifest.id, true);
}

export async function unpinFile(manifest: FileManifest): Promise<void> {
  for (const hash of manifest.chunkHashes) await localChunks.del(hash);
  setPinned(manifest.id, false);
}

/**
 * "Send a copy": assemble the plaintext file from local cache / hub for the user
 * to hand off over any channel (AirDrop, USB, chat). Returns the decrypted bytes.
 */
export async function assemblePlaintext(
  manifest: FileManifest,
  key: TransferKey,
  io: BlobIO,
): Promise<Uint8Array> {
  const kr = asKeyring(key);
  const out = new Uint8Array(manifest.size);
  let offset = 0;
  for (const hash of manifest.chunkHashes) {
    const cipher = await io.get(hash);
    const plain = await decryptWithKeyring(kr, cipher);
    if ((await sha256(plain)) !== hash) throw new Error('chunk hash mismatch');
    out.set(plain, offset);
    offset += plain.length;
  }
  return out;
}

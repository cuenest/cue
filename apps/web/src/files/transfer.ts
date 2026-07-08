import {
  sha256,
  encryptUpdate,
  decryptUpdate,
  DEFAULT_CHUNK_SIZE,
  type BlobIO,
  type FileManifest,
} from '@cue/engine';
import { localChunks, setPinned } from './localStore';

/** A BlobIO backed by the hub's HTTP blob store. Converts the ws:// hub URL to http://. */
export function hubBlobIO(hubWsUrl: string, room: string): BlobIO {
  const base = hubWsUrl.replace(/^ws/, 'http').replace(/\/+$/, '');
  const url = (hash: string) =>
    `${base}/blob/${encodeURIComponent(room)}/${encodeURIComponent(hash)}`;
  return {
    async has(hash) {
      try {
        const r = await fetch(url(hash), { method: 'HEAD' });
        return r.ok;
      } catch {
        return false;
      }
    },
    async put(hash, cipher) {
      const r = await fetch(url(hash), { method: 'PUT', body: cipher as BodyInit });
      if (!r.ok) throw new Error(`blob put failed: ${r.status}`);
    },
    async get(hash) {
      const r = await fetch(url(hash));
      if (!r.ok) throw new Error(`blob get failed: ${r.status}`);
      return new Uint8Array(await r.arrayBuffer());
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

/** Encrypt + upload each missing chunk, reading one slice at a time. Dedup by hash. */
export async function uploadFileChunks(
  file: File,
  hashes: string[],
  key: string,
  io: BlobIO,
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  for (let i = 0; i < hashes.length; i++) {
    const hash = hashes[i]!;
    if (!(await io.has(hash))) {
      await io.put(hash, await encryptUpdate(key, await sliceBytes(file, i)));
    }
    onProgress?.(i + 1, hashes.length);
  }
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
  key: string,
  io: BlobIO,
): Promise<Uint8Array> {
  const out = new Uint8Array(manifest.size);
  let offset = 0;
  for (const hash of manifest.chunkHashes) {
    const cipher = await io.get(hash);
    const plain = await decryptUpdate(key, cipher);
    if ((await sha256(plain)) !== hash) throw new Error('chunk hash mismatch');
    out.set(plain, offset);
    offset += plain.length;
  }
  return out;
}

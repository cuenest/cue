import { sha256, encryptUpdate, DEFAULT_CHUNK_SIZE, type BlobIO } from '@cue/engine';

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

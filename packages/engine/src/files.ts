import { encryptUpdate, decryptUpdate } from './sync/crypto';

/**
 * File transfer: files are split into chunks, each chunk is content-addressed by
 * the SHA-256 of its *plaintext* and stored on the hub as AES-GCM ciphertext.
 *
 * Addressing by plaintext hash gives dedup (identical chunks upload once, by
 * whoever is first) while staying zero-knowledge: any space member can decrypt
 * any member's ciphertext because they all share the space key, and the hash is
 * verified after decryption. The document holds only the manifest (hashes +
 * metadata); the bytes live on the hub and are fetched on demand.
 */

export interface FileManifest {
  id: string;
  name: string;
  mime: string;
  size: number;
  chunkHashes: string[];
  /** true once every chunk has been uploaded to the hub. */
  hubComplete: boolean;
  addedAt: number;
}

/** Injected byte transport — an in-memory map in tests, the hub's HTTP blob store in the app. */
export interface BlobIO {
  has(hash: string): Promise<boolean>;
  put(hash: string, cipher: Uint8Array): Promise<void>;
  get(hash: string): Promise<Uint8Array>;
}

export const DEFAULT_CHUNK_SIZE = 4 * 1024 * 1024; // 4 MB

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as unknown as ArrayBuffer);
  return toBase64Url(new Uint8Array(digest));
}

export function chunkBytes(bytes: Uint8Array, chunkSize = DEFAULT_CHUNK_SIZE): Uint8Array[] {
  if (bytes.length === 0) return [new Uint8Array(0)];
  const out: Uint8Array[] = [];
  for (let i = 0; i < bytes.length; i += chunkSize) out.push(bytes.subarray(i, i + chunkSize));
  return out;
}

/** Hash all chunks and build the manifest (hubComplete=false). Bytes are NOT uploaded yet. */
export async function planUpload(
  bytes: Uint8Array,
  name: string,
  mime: string,
  chunkSize = DEFAULT_CHUNK_SIZE,
): Promise<{ manifest: FileManifest; chunks: Uint8Array[] }> {
  const chunks = chunkBytes(bytes, chunkSize);
  const chunkHashes = await Promise.all(chunks.map((c) => sha256(c)));
  const manifest: FileManifest = {
    id: crypto.randomUUID(),
    name,
    mime: mime || 'application/octet-stream',
    size: bytes.length,
    chunkHashes,
    hubComplete: false,
    addedAt: Date.now(),
  };
  return { manifest, chunks };
}

/** Encrypt and upload each missing chunk (dedup: skip chunks already on the hub). */
export async function uploadChunks(
  chunks: Uint8Array[],
  hashes: string[],
  key: string,
  io: BlobIO,
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  for (let i = 0; i < chunks.length; i++) {
    const hash = hashes[i]!;
    if (!(await io.has(hash))) {
      const cipher = await encryptUpdate(key, chunks[i]!);
      await io.put(hash, cipher);
    }
    onProgress?.(i + 1, chunks.length);
  }
}

/** Stream decrypted chunks in order, verifying each against its hash. Peak memory = one chunk. */
export async function* downloadChunks(
  manifest: FileManifest,
  key: string,
  io: BlobIO,
): AsyncGenerator<Uint8Array> {
  for (const hash of manifest.chunkHashes) {
    const cipher = await io.get(hash);
    const plain = await decryptUpdate(key, cipher);
    if ((await sha256(plain)) !== hash) throw new Error(`chunk hash mismatch: ${hash}`);
    yield plain;
  }
}

/** Convenience: reassemble the whole file in memory (tests / small files). */
export async function assembleFile(
  manifest: FileManifest,
  key: string,
  io: BlobIO,
): Promise<Uint8Array> {
  const out = new Uint8Array(manifest.size);
  let offset = 0;
  for await (const chunk of downloadChunks(manifest, key, io)) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

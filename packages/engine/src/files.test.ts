import { describe, it, expect } from 'vitest';
import { planUpload, uploadChunks, assembleFile, downloadChunks, type BlobIO } from './files';
import { generateSyncKey, encryptUpdate } from './sync/crypto';
import { keyringFromLegacy, rotateKeyring } from './sync/keyring';

/** In-memory hub, plus a counter to prove dedup. */
function memIO() {
  const store = new Map<string, Uint8Array>();
  let puts = 0;
  const io: BlobIO = {
    has: (h) => Promise.resolve(store.has(h)),
    put: (h, c) => {
      puts += 1;
      store.set(h, c);
      return Promise.resolve();
    },
    get: (h) => {
      const v = store.get(h);
      if (!v) return Promise.reject(new Error('missing ' + h));
      return Promise.resolve(v);
    },
  };
  return { io, store, puts: () => puts };
}

function bytesOf(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

describe('file transfer round-trip', () => {
  it('uploads then reassembles a multi-chunk file byte-for-byte', async () => {
    const key = await generateSyncKey();
    const io = memIO();
    // 10 bytes, 4-byte chunks → 3 chunks
    const original = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);

    const { manifest, chunks } = await planUpload(original, 'nums.bin', 'application/octet-stream', 4);
    expect(manifest.chunkHashes).toHaveLength(3);
    expect(manifest.size).toBe(10);

    await uploadChunks(chunks, manifest.chunkHashes, key, io.io);
    const back = await assembleFile(manifest, key, io.io);
    expect(Array.from(back)).toEqual(Array.from(original));
  });

  it('streams chunks in order with low peak memory', async () => {
    const key = await generateSyncKey();
    const io = memIO();
    const original = bytesOf('the quick brown fox jumps'); // 25 bytes
    const { manifest, chunks } = await planUpload(original, 'f.txt', 'text/plain', 8);
    await uploadChunks(chunks, manifest.chunkHashes, key, io.io);

    const seen: number[] = [];
    for await (const chunk of downloadChunks(manifest, key, io.io)) seen.push(chunk.length);
    expect(seen).toEqual([8, 8, 8, 1]); // never more than one 8-byte chunk in hand
  });

  it('deduplicates identical chunks — repeated content uploads once', async () => {
    const key = await generateSyncKey();
    const io = memIO();
    // four identical 4-byte chunks
    const original = new Uint8Array([7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7]);
    const { manifest, chunks } = await planUpload(original, 'dup.bin', '', 4);
    expect(manifest.chunkHashes.every((h) => h === manifest.chunkHashes[0])).toBe(true);

    await uploadChunks(chunks, manifest.chunkHashes, key, io.io);
    expect(io.puts()).toBe(1); // stored once despite four chunks
    expect(Array.from(await assembleFile(manifest, key, io.io))).toEqual(Array.from(original));
  });

  it('rejects a tampered chunk (hash mismatch)', async () => {
    const key = await generateSyncKey();
    const io = memIO();
    const { manifest, chunks } = await planUpload(bytesOf('hello'), 'h.txt', 'text/plain', 8);
    await uploadChunks(chunks, manifest.chunkHashes, key, io.io);
    // overwrite the stored chunk with ciphertext of different plaintext
    io.store.set(manifest.chunkHashes[0]!, await encryptUpdate(key, bytesOf('WRONG')));
    await expect(assembleFile(manifest, key, io.io)).rejects.toThrow(/mismatch/);
  });

  it('a keyring reads chunks uploaded before AND after a rotation', async () => {
    const kr0 = keyringFromLegacy(await generateSyncKey(), 'room-a');
    const io = memIO();

    // uploaded pre-rotation, under the bare epoch-0 key (the legacy path)
    const before = await planUpload(bytesOf('written before'), 'a.txt', 'text/plain', 8);
    await uploadChunks(before.chunks, before.manifest.chunkHashes, kr0.epochs[0]!.key, io.io);

    // rotate, then upload under the keyring (current epoch 1)
    const kr1 = await rotateKeyring(kr0);
    const after = await planUpload(bytesOf('written after'), 'b.txt', 'text/plain', 8);
    await uploadChunks(after.chunks, after.manifest.chunkHashes, kr1, io.io);

    // the rotated ring reassembles both files
    expect(Array.from(await assembleFile(before.manifest, kr1, io.io))).toEqual(
      Array.from(bytesOf('written before')),
    );
    expect(Array.from(await assembleFile(after.manifest, kr1, io.io))).toEqual(
      Array.from(bytesOf('written after')),
    );
    // but the pre-rotation ring cannot read post-rotation chunks (revocation forward)
    await expect(assembleFile(after.manifest, kr0, io.io)).rejects.toThrow(/epoch/);
  });
});

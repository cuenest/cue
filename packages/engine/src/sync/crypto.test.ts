import { describe, it, expect } from 'vitest';
import { generateSyncKey, encryptUpdate, decryptUpdate, CRYPTO_SUITE } from './crypto';

describe('sync crypto', () => {
  it('generateSyncKey returns distinct base64url keys', async () => {
    const a = await generateSyncKey();
    const b = await generateSyncKey();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('encrypt/decrypt round-trips an update', async () => {
    const key = await generateSyncKey();
    const update = new Uint8Array([1, 2, 3, 250, 251, 252]);
    const cipher = await encryptUpdate(key, update);
    expect(cipher).not.toEqual(update);
    const plain = await decryptUpdate(key, cipher);
    expect(Array.from(plain)).toEqual(Array.from(update));
  });

  it('same plaintext encrypts differently each time (fresh IV)', async () => {
    const key = await generateSyncKey();
    const update = new Uint8Array([9, 9, 9]);
    const c1 = await encryptUpdate(key, update);
    const c2 = await encryptUpdate(key, update);
    expect(Array.from(c1)).not.toEqual(Array.from(c2));
  });

  it('tampered ciphertext is rejected', async () => {
    const key = await generateSyncKey();
    const cipher = await encryptUpdate(key, new Uint8Array([1, 2, 3]));
    cipher[cipher.length - 1]! ^= 0xff;
    await expect(decryptUpdate(key, cipher)).rejects.toThrow();
  });

  it('wrong key is rejected', async () => {
    const cipher = await encryptUpdate(await generateSyncKey(), new Uint8Array([1]));
    await expect(decryptUpdate(await generateSyncKey(), cipher)).rejects.toThrow();
  });

  it('tags the ciphertext with a self-describing suite byte', async () => {
    const cipher = await encryptUpdate(await generateSyncKey(), new Uint8Array([1, 2, 3]));
    expect(cipher[0]).toBe(CRYPTO_SUITE.AES_256_GCM);
    // suite(1) + iv(12) + at least the GCM tag(16)
    expect(cipher.length).toBeGreaterThanOrEqual(1 + 12 + 16);
  });

  it('rejects an unknown crypto suite (agility guard)', async () => {
    const key = await generateSyncKey();
    const cipher = await encryptUpdate(key, new Uint8Array([1, 2, 3]));
    cipher[0] = 0x7f; // pretend it was produced by some future/unknown suite
    await expect(decryptUpdate(key, cipher)).rejects.toThrow(/unknown crypto suite 0x7f/);
  });
});

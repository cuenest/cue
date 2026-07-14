import { describe, it, expect } from 'vitest';
import { generateSyncKey, decryptUpdate, encryptUpdate, CRYPTO_SUITE } from './crypto';
import {
  keyringFromLegacy,
  currentEpochKey,
  rotateKeyring,
  encryptForKeyring,
  decryptWithKeyring,
  payloadEpoch,
  MissingEpochKeyError,
  type Keyring,
} from './keyring';

async function legacyRing(): Promise<Keyring> {
  return keyringFromLegacy(await generateSyncKey(), 'room-a');
}

describe('keyring', () => {
  it('wraps a legacy key+room as epoch 0', async () => {
    const key = await generateSyncKey();
    const kr = keyringFromLegacy(key, 'room-a');
    expect(kr.current).toBe(0);
    expect(kr.epochs).toEqual([{ epoch: 0, key, room: 'room-a' }]);
    expect(currentEpochKey(kr)).toEqual({ epoch: 0, key, room: 'room-a' });
  });

  it('epoch-0 writes stay suite 0x01 so pre-epoch clients can read them', async () => {
    const kr = await legacyRing();
    const cipher = await encryptForKeyring(kr, new Uint8Array([1, 2, 3]));
    expect(cipher[0]).toBe(CRYPTO_SUITE.AES_256_GCM);
    // a legacy client holding the bare key decrypts it directly
    const plain = await decryptUpdate(kr.epochs[0]!.key, cipher);
    expect(Array.from(plain)).toEqual([1, 2, 3]);
  });

  it('rotation bumps the epoch and issues a fresh key and room, keeping history', async () => {
    const kr = await legacyRing();
    const rotated = await rotateKeyring(kr);
    expect(rotated.current).toBe(1);
    expect(rotated.epochs).toHaveLength(2);
    const cur = currentEpochKey(rotated);
    expect(cur.epoch).toBe(1);
    expect(cur.key).not.toBe(kr.epochs[0]!.key);
    expect(cur.room).not.toBe(kr.epochs[0]!.room);
    // old epoch is preserved untouched
    expect(rotated.epochs[0]).toEqual(kr.epochs[0]);
  });

  it('post-rotation writes use the epoch envelope (suite 0x02) naming their epoch', async () => {
    const rotated = await rotateKeyring(await legacyRing());
    const cipher = await encryptForKeyring(rotated, new Uint8Array([7]));
    expect(cipher[0]).toBe(CRYPTO_SUITE.AES_256_GCM_EPOCH);
    expect(payloadEpoch(cipher)).toBe(1);
  });

  it('payloadEpoch reads suite 0x01 payloads as epoch 0', async () => {
    const kr = await legacyRing();
    const cipher = await encryptForKeyring(kr, new Uint8Array([7]));
    expect(payloadEpoch(cipher)).toBe(0);
  });

  it('decryptWithKeyring round-trips both epoch-0 and rotated payloads', async () => {
    const kr = await legacyRing();
    const old = await encryptForKeyring(kr, new Uint8Array([1, 2]));
    const rotated = await rotateKeyring(kr);
    const fresh = await encryptForKeyring(rotated, new Uint8Array([3, 4]));
    // rotated ring still reads old data — "change the locks going forward, never erase the past"
    expect(Array.from(await decryptWithKeyring(rotated, old))).toEqual([1, 2]);
    expect(Array.from(await decryptWithKeyring(rotated, fresh))).toEqual([3, 4]);
  });

  it('a ring missing the payload epoch fails with MissingEpochKeyError, not a crypto error', async () => {
    const kr = await legacyRing();
    const rotated = await rotateKeyring(kr);
    const fresh = await encryptForKeyring(rotated, new Uint8Array([5]));
    // kr never learned epoch 1 — "I don't have the key yet" must be distinguishable from "corrupt"
    await expect(decryptWithKeyring(kr, fresh)).rejects.toThrow(MissingEpochKeyError);
  });

  it('tampered epoch-envelope ciphertext is rejected', async () => {
    const rotated = await rotateKeyring(await legacyRing());
    const cipher = await encryptForKeyring(rotated, new Uint8Array([9, 9]));
    cipher[cipher.length - 1]! ^= 0xff;
    await expect(decryptWithKeyring(rotated, cipher)).rejects.toThrow();
  });

  it('several rotations stack: every historical epoch stays readable', async () => {
    let kr = await legacyRing();
    const payloads: Uint8Array[] = [await encryptForKeyring(kr, new Uint8Array([0]))];
    for (let i = 1; i <= 3; i++) {
      kr = await rotateKeyring(kr);
      payloads.push(await encryptForKeyring(kr, new Uint8Array([i])));
    }
    expect(kr.current).toBe(3);
    for (let i = 0; i < payloads.length; i++) {
      expect(Array.from(await decryptWithKeyring(kr, payloads[i]!))).toEqual([i]);
    }
  });

  it('legacy suite-0x01 ciphertext made outside the keyring API decrypts too', async () => {
    const kr = await legacyRing();
    const cipher = await encryptUpdate(kr.epochs[0]!.key, new Uint8Array([4, 2]));
    expect(Array.from(await decryptWithKeyring(kr, cipher))).toEqual([4, 2]);
  });
});

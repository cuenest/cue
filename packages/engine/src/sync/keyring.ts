/**
 * Key epochs: a space's history of sync keys. Rotation ("change the locks")
 * appends a fresh key + room as a new epoch; old epochs stay so historical
 * ciphertext — file chunks especially — remains readable forever. Rotation
 * protects new data only: anyone holding an old epoch keeps whatever they
 * already synced. That is a law of local-first systems, not a bug here.
 *
 * The room travels with each epoch because rotation moves the space to a new
 * hub room — otherwise a holder of the old key could still inject writes the
 * remaining members would accept.
 */

import { generateSyncKey, encryptUpdate, encryptUpdateEpoch, decryptUpdate, payloadEpoch } from './crypto';

export { payloadEpoch } from './crypto';

export interface EpochKey {
  epoch: number;
  key: string;
  room: string;
}

export interface Keyring {
  current: number;
  epochs: EpochKey[];
}

/** "This payload needs a key epoch the ring doesn't hold" — distinct from corruption. */
export class MissingEpochKeyError extends Error {
  constructor(readonly epoch: number) {
    super(`no key for epoch ${epoch} — rotated key not received yet?`);
    this.name = 'MissingEpochKeyError';
  }
}

/** Wrap a pre-epoch space (one key, one room) as epoch 0. */
export function keyringFromLegacy(key: string, room: string): Keyring {
  return { current: 0, epochs: [{ epoch: 0, key, room }] };
}

export function epochKey(kr: Keyring, epoch: number): EpochKey | undefined {
  return kr.epochs.find((e) => e.epoch === epoch);
}

export function currentEpochKey(kr: Keyring): EpochKey {
  const cur = epochKey(kr, kr.current);
  if (!cur) throw new Error(`keyring is missing its own current epoch ${kr.current}`);
  return cur;
}

/** Change the locks: fresh key + fresh room as epoch current+1. History is kept. */
export async function rotateKeyring(kr: Keyring): Promise<Keyring> {
  const epoch = kr.current + 1;
  return {
    current: epoch,
    epochs: [...kr.epochs, { epoch, key: await generateSyncKey(), room: crypto.randomUUID() }],
  };
}

/**
 * Encrypt under the current epoch. Epoch 0 keeps the pre-epoch envelope
 * (suite 0x01) so never-rotated spaces stay readable by older clients.
 */
export async function encryptForKeyring(kr: Keyring, update: Uint8Array): Promise<Uint8Array> {
  const cur = currentEpochKey(kr);
  return cur.epoch === 0
    ? encryptUpdate(cur.key, update)
    : encryptUpdateEpoch(cur.key, cur.epoch, update);
}

/** Decrypt any payload whose epoch the ring holds, whatever suite produced it. */
export async function decryptWithKeyring(kr: Keyring, payload: Uint8Array): Promise<Uint8Array> {
  const epoch = payloadEpoch(payload);
  const entry = epochKey(kr, epoch);
  if (!entry) throw new MissingEpochKeyError(epoch);
  return decryptUpdate(entry.key, payload);
}

/**
 * Zero-knowledge transport crypto: Yjs updates and file chunks are AES-256-GCM
 * encrypted with a shared sync key before leaving the device. Relays only ever
 * see ciphertext. Uses WebCrypto, which exists in both browsers and Node.
 *
 * Crypto agility (post-quantum readiness): every ciphertext is self-describing —
 * its first byte names the suite that produced it. Decryption dispatches on that
 * byte, so a new suite (e.g. a post-quantum-derived AEAD) can be added later and
 * coexist with existing data, no migration required. AES-256 itself is already
 * quantum-resistant (Grover only halves its strength → ~128-bit), so the value
 * here is the *format*, not an urgent algorithm change. See the PQC design note
 * in docs/superpowers/specs for the full strategy.
 *
 * Envelope layout: [suite:1][iv:12][ciphertext+tag].
 */

/** Registry of AEAD suites. The byte value is wire-stable; never reuse a value. */
export const CRYPTO_SUITE = {
  /** AES-256-GCM with a 12-byte IV — the founding suite. */
  AES_256_GCM: 0x01,
} as const;

const CURRENT_SUITE = CRYPTO_SUITE.AES_256_GCM;
const SUITE_LENGTH = 1;
const IV_LENGTH = 12;

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** 32 random bytes as base64url — the shared secret of a sync space. */
export async function generateSyncKey(): Promise<string> {
  const raw = crypto.getRandomValues(new Uint8Array(32));
  return toBase64Url(raw);
}

/** Engine tsconfig has no DOM lib; WebCrypto buffer params are cast through this. */
type Bytes = ArrayBuffer;

async function importKey(keyB64: string) {
  const raw = fromBase64Url(keyB64);
  return crypto.subtle.importKey('raw', raw as unknown as Bytes, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ]);
}

/** Returns [suite:1][iv:12][ciphertext+tag]. */
export async function encryptUpdate(keyB64: string, update: Uint8Array): Promise<Uint8Array> {
  const key = await importKey(keyB64);
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as unknown as Bytes },
    key,
    update as unknown as Bytes,
  );
  const out = new Uint8Array(SUITE_LENGTH + IV_LENGTH + cipher.byteLength);
  out[0] = CURRENT_SUITE;
  out.set(iv, SUITE_LENGTH);
  out.set(new Uint8Array(cipher), SUITE_LENGTH + IV_LENGTH);
  return out;
}

export async function decryptUpdate(keyB64: string, payload: Uint8Array): Promise<Uint8Array> {
  const suite = payload[0];
  if (suite !== CRYPTO_SUITE.AES_256_GCM) {
    throw new Error(`unknown crypto suite 0x${(suite ?? 0).toString(16).padStart(2, '0')}`);
  }
  const key = await importKey(keyB64);
  const iv = payload.slice(SUITE_LENGTH, SUITE_LENGTH + IV_LENGTH);
  const cipher = payload.slice(SUITE_LENGTH + IV_LENGTH);
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as unknown as Bytes },
    key,
    cipher as unknown as Bytes,
  );
  return new Uint8Array(plain);
}

export { toBase64Url, fromBase64Url };

/**
 * Zero-knowledge transport crypto: Yjs updates are AES-256-GCM encrypted with a
 * shared sync key before leaving the device. Relays only ever see ciphertext.
 * Uses WebCrypto, which exists in both browsers and Node.
 */

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

/** Returns IV (12 bytes) followed by ciphertext+tag. */
export async function encryptUpdate(keyB64: string, update: Uint8Array): Promise<Uint8Array> {
  const key = await importKey(keyB64);
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as unknown as Bytes },
    key,
    update as unknown as Bytes,
  );
  const out = new Uint8Array(IV_LENGTH + cipher.byteLength);
  out.set(iv, 0);
  out.set(new Uint8Array(cipher), IV_LENGTH);
  return out;
}

export async function decryptUpdate(keyB64: string, payload: Uint8Array): Promise<Uint8Array> {
  const key = await importKey(keyB64);
  const iv = payload.slice(0, IV_LENGTH);
  const cipher = payload.slice(IV_LENGTH);
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as unknown as Bytes },
    key,
    cipher as unknown as Bytes,
  );
  return new Uint8Array(plain);
}

export { toBase64Url, fromBase64Url };

/**
 * Link codes carry everything a new device needs to join a sync space:
 * the room id, the sync key, and optionally the hub URL. Rendered as a QR
 * code or copied as text.
 *
 * Phase 1 MVP: the code contains the key directly (like sharing a Syncthing
 * device id). An interactive ECDH handshake can replace this later without
 * changing the payload versioning.
 */

export interface LinkPayload {
  v: 1;
  room: string;
  key: string;
  hub?: string;
}

const PREFIX = 'cue1.';

export function makeLinkCode(input: { room: string; key: string; hub?: string }): string {
  const payload: LinkPayload = { v: 1, room: input.room, key: input.key };
  if (input.hub) payload.hub = input.hub;
  const json = JSON.stringify(payload);
  const b64 = btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return PREFIX + b64;
}

export function parseLinkCode(code: string): LinkPayload | null {
  try {
    if (!code.startsWith(PREFIX)) return null;
    const b64 = code.slice(PREFIX.length).replace(/-/g, '+').replace(/_/g, '/');
    const parsed = JSON.parse(atob(b64)) as LinkPayload;
    if (parsed.v !== 1 || typeof parsed.room !== 'string' || typeof parsed.key !== 'string') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

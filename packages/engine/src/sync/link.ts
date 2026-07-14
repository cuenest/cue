/**
 * Link codes carry everything a new device needs to join a sync space:
 * the room id, the sync key(s), and optionally the hub URL. Rendered as a QR
 * code or copied as text.
 *
 * Two payload versions share the `cue1.` container:
 *   v1 — one room + one key. Emitted for never-rotated spaces so older
 *        clients keep joining them.
 *   v2 — the full keyring (every epoch's key + room). Emitted once a space
 *        has rotated; the history is what lets a new device read pre-rotation
 *        file chunks. Old clients reject v2 codes cleanly (they check v === 1).
 *
 * Phase 1 MVP: the code contains the key(s) directly (like sharing a Syncthing
 * device id). An interactive ECDH handshake can replace this later without
 * changing the payload versioning.
 */

import { keyringFromLegacy, currentEpochKey, type Keyring } from './keyring';

export interface LinkPayload {
  v: 1 | 2;
  /** Current room — the one a joining device should connect to. */
  room: string;
  /** Current key. */
  key: string;
  hub?: string;
  /** Full key history; for v1 codes this is the single epoch-0 entry. */
  keyring: Keyring;
}

/** Wire shape of a v2 payload (kept terse — this travels inside a QR code). */
interface WireV2 {
  v: 2;
  cur: number;
  keys: { e: number; k: string; r: string }[];
  hub?: string;
}

const PREFIX = 'cue1.';

function encode(json: string): string {
  return PREFIX + btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function makeLinkCode(
  input: { room: string; key: string; hub?: string } | { keyring: Keyring; hub?: string },
): string {
  const keyring =
    'keyring' in input ? input.keyring : keyringFromLegacy(input.key, input.room);
  // Never-rotated spaces emit v1 so pre-epoch clients can still join them.
  if (keyring.current === 0 && keyring.epochs.length === 1) {
    const { key, room } = currentEpochKey(keyring);
    const payload: { v: 1; room: string; key: string; hub?: string } = { v: 1, room, key };
    if (input.hub) payload.hub = input.hub;
    return encode(JSON.stringify(payload));
  }
  const wire: WireV2 = {
    v: 2,
    cur: keyring.current,
    keys: keyring.epochs.map((e) => ({ e: e.epoch, k: e.key, r: e.room })),
  };
  if (input.hub) wire.hub = input.hub;
  return encode(JSON.stringify(wire));
}

/**
 * Normalize a hub value that may come from build config or a user field.
 * A value with a scheme is returned as-is; a bare host is treated as a secure
 * `wss://` endpoint (that's what host-only deploy injection provides).
 */
export function normalizeHubUrl(value: string): string {
  const v = value.trim();
  return /^wss?:\/\//.test(v) ? v : `wss://${v}`;
}

export function parseLinkCode(code: string): LinkPayload | null {
  try {
    if (!code.startsWith(PREFIX)) return null;
    const b64 = code.slice(PREFIX.length).replace(/-/g, '+').replace(/_/g, '/');
    const parsed = JSON.parse(atob(b64)) as { v?: number };

    if (parsed.v === 1) {
      const p = parsed as { v: 1; room?: string; key?: string; hub?: string };
      if (typeof p.room !== 'string' || typeof p.key !== 'string') return null;
      const out: LinkPayload = {
        v: 1,
        room: p.room,
        key: p.key,
        keyring: keyringFromLegacy(p.key, p.room),
      };
      if (typeof p.hub === 'string') out.hub = p.hub;
      return out;
    }

    if (parsed.v === 2) {
      const p = parsed as Partial<WireV2>;
      if (typeof p.cur !== 'number' || !Array.isArray(p.keys)) return null;
      const epochs = p.keys.map((k) => ({ epoch: k.e, key: k.k, room: k.r }));
      if (
        epochs.some(
          (e) => typeof e.epoch !== 'number' || typeof e.key !== 'string' || typeof e.room !== 'string',
        )
      ) {
        return null;
      }
      const keyring: Keyring = { current: p.cur, epochs };
      const cur = epochs.find((e) => e.epoch === p.cur);
      if (!cur) return null;
      const out: LinkPayload = { v: 2, room: cur.room, key: cur.key, keyring };
      if (typeof p.hub === 'string') out.hub = p.hub;
      return out;
    }

    return null;
  } catch {
    return null;
  }
}

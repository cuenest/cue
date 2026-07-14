import { describe, it, expect } from 'vitest';
import { makeLinkCode, parseLinkCode, normalizeHubUrl } from './link';
import { keyringFromLegacy, rotateKeyring } from './keyring';

describe('link codes', () => {
  it('round-trips room, key and hub url', () => {
    const code = makeLinkCode({ room: 'room-1', key: 'kkk_key', hub: 'ws://pi.local:4444' });
    const parsed = parseLinkCode(code);
    expect(parsed).toMatchObject({ v: 1, room: 'room-1', key: 'kkk_key', hub: 'ws://pi.local:4444' });
  });

  it('hub is optional', () => {
    const parsed = parseLinkCode(makeLinkCode({ room: 'r', key: 'k' }));
    expect(parsed?.room).toBe('r');
    expect(parsed?.hub).toBeUndefined();
  });

  it('returns null for garbage', () => {
    expect(parseLinkCode('definitely not a code')).toBeNull();
    expect(parseLinkCode('')).toBeNull();
  });

  it('every parsed code exposes a keyring (v1 → epoch 0)', () => {
    const parsed = parseLinkCode(makeLinkCode({ room: 'r', key: 'k' }));
    expect(parsed?.keyring).toEqual({ current: 0, epochs: [{ epoch: 0, key: 'k', room: 'r' }] });
  });

  it('a never-rotated keyring emits a v1 code old clients can still parse', () => {
    const kr = keyringFromLegacy('k', 'r');
    const parsed = parseLinkCode(makeLinkCode({ keyring: kr, hub: 'ws://h' }));
    expect(parsed?.v).toBe(1);
    expect(parsed?.room).toBe('r');
    expect(parsed?.key).toBe('k');
    expect(parsed?.hub).toBe('ws://h');
  });

  it('a rotated keyring round-trips through a v2 code with full history', async () => {
    const kr = await rotateKeyring(keyringFromLegacy('old-key', 'old-room'));
    const parsed = parseLinkCode(makeLinkCode({ keyring: kr, hub: 'wss://hub' }));
    expect(parsed?.v).toBe(2);
    expect(parsed?.keyring).toEqual(kr);
    // room/key surface the CURRENT epoch so existing call sites keep working
    expect(parsed?.room).toBe(kr.epochs[1]!.room);
    expect(parsed?.key).toBe(kr.epochs[1]!.key);
    expect(parsed?.hub).toBe('wss://hub');
  });

  it('rejects a malformed v2 payload', () => {
    const bogus = 'cue1.' + btoa(JSON.stringify({ v: 2, cur: 1, keys: 'nope' }))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    expect(parseLinkCode(bogus)).toBeNull();
  });
});

describe('normalizeHubUrl', () => {
  it('treats a bare host as a secure wss endpoint', () => {
    expect(normalizeHubUrl('cue-hub.onrender.com')).toBe('wss://cue-hub.onrender.com');
  });

  it('leaves an explicit scheme untouched', () => {
    expect(normalizeHubUrl('ws://localhost:4444')).toBe('ws://localhost:4444');
    expect(normalizeHubUrl('wss://hub.example.com')).toBe('wss://hub.example.com');
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeHubUrl('  hub.example.com  ')).toBe('wss://hub.example.com');
  });
});

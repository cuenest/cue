import { describe, it, expect } from 'vitest';
import { makeLinkCode, parseLinkCode, normalizeHubUrl } from './link';

describe('link codes', () => {
  it('round-trips room, key and hub url', () => {
    const code = makeLinkCode({ room: 'room-1', key: 'kkk_key', hub: 'ws://pi.local:4444' });
    const parsed = parseLinkCode(code);
    expect(parsed).toEqual({ v: 1, room: 'room-1', key: 'kkk_key', hub: 'ws://pi.local:4444' });
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

import { describe, it, expect } from 'vitest';
import { makeLinkCode, parseLinkCode } from './link';

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

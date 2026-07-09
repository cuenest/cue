import { describe, it, expect } from 'vitest';
import { hubUrls } from './lan';

describe('hubUrls', () => {
  it('lists external IPv4 addresses first, loopback last', () => {
    const urls = hubUrls(4444, {
      eth0: [{ address: '192.168.1.20', family: 'IPv4', internal: false } as never],
      lo: [{ address: '127.0.0.1', family: 'IPv4', internal: true } as never],
    });
    expect(urls[0]).toBe('ws://192.168.1.20:4444');
    expect(urls.at(-1)).toBe('ws://localhost:4444');
  });

  it('accepts the numeric family (4) some Node versions report', () => {
    const urls = hubUrls(5000, {
      wlan0: [{ address: '10.0.0.5', family: 4 as unknown, internal: false } as never],
    });
    expect(urls).toContain('ws://10.0.0.5:5000');
  });

  it('skips IPv6 and internal interfaces', () => {
    const urls = hubUrls(4444, {
      eth0: [
        { address: 'fe80::1', family: 'IPv6', internal: false } as never,
        { address: '127.0.0.1', family: 'IPv4', internal: true } as never,
      ],
    });
    expect(urls).toEqual(['ws://localhost:4444']);
  });
});

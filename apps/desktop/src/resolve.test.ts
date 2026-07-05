import { describe, it, expect } from 'vitest';
import { resolveStart, devUrlFromArgv } from './resolve';

describe('resolveStart', () => {
  it('prefers the dev url when provided', () => {
    const start = resolveStart({ devUrl: 'http://localhost:5178', distIndex: 'x', exists: () => true });
    expect(start).toEqual({ kind: 'url', value: 'http://localhost:5178' });
  });

  it('falls back to the built web app when it exists', () => {
    const start = resolveStart({ distIndex: '/web/dist/index.html', exists: (p) => p === '/web/dist/index.html' });
    expect(start).toEqual({ kind: 'file', value: '/web/dist/index.html' });
  });

  it('reports none when nothing is available', () => {
    expect(resolveStart({ distIndex: 'missing', exists: () => false })).toEqual({ kind: 'none' });
  });
});

describe('devUrlFromArgv', () => {
  it('reads the --dev-url flag', () => {
    expect(devUrlFromArgv(['electron', '.', '--dev-url=http://x:1'], {})).toBe('http://x:1');
  });
  it('falls back to CUE_DEV_URL env', () => {
    expect(devUrlFromArgv([], { CUE_DEV_URL: 'http://y:2' })).toBe('http://y:2');
  });
  it('undefined when neither set', () => {
    expect(devUrlFromArgv([], {})).toBeUndefined();
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { hubBlobIO } from './transfer';

/**
 * After a key rotation the space lives in a new room, but chunks uploaded
 * before the rotation still sit under the old room on the hub. The blob IO
 * must look in every room (current first) and always upload to the current one.
 */

const stores = new Map<string, Map<string, Uint8Array>>(); // room → hash → bytes

function fakeFetch(url: string, init?: { method?: string; body?: unknown }): Promise<Response> {
  const m = /\/blob\/([^/]+)\/([^/]+)$/.exec(url);
  if (!m) return Promise.resolve(new Response(null, { status: 404 }));
  const room = decodeURIComponent(m[1]!);
  const hash = decodeURIComponent(m[2]!);
  const store = stores.get(room) ?? new Map<string, Uint8Array>();
  stores.set(room, store);
  const method = init?.method ?? 'GET';
  if (method === 'PUT') {
    store.set(hash, new Uint8Array(init!.body as Uint8Array));
    return Promise.resolve(new Response(null, { status: 200 }));
  }
  if (!store.has(hash)) return Promise.resolve(new Response(null, { status: 404 }));
  if (method === 'HEAD') return Promise.resolve(new Response(null, { status: 200 }));
  return Promise.resolve(new Response(store.get(hash)!.slice() as BodyInit, { status: 200 }));
}

beforeEach(() => {
  stores.clear();
  vi.stubGlobal('fetch', vi.fn(fakeFetch));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('hubBlobIO room fallback', () => {
  it('finds a chunk that only exists under an older room', async () => {
    stores.set('old-room', new Map([['h1', new Uint8Array([1, 2, 3])]]));
    const io = hubBlobIO('ws://hub', ['new-room', 'old-room']);
    expect(await io.has('h1')).toBe(true);
    expect(Array.from(await io.get('h1'))).toEqual([1, 2, 3]);
  });

  it('prefers the current room when both hold the chunk', async () => {
    stores.set('new-room', new Map([['h1', new Uint8Array([9])]]));
    stores.set('old-room', new Map([['h1', new Uint8Array([1])]]));
    const io = hubBlobIO('ws://hub', ['new-room', 'old-room']);
    expect(Array.from(await io.get('h1'))).toEqual([9]);
  });

  it('uploads go to the current room only', async () => {
    const io = hubBlobIO('ws://hub', ['new-room', 'old-room']);
    await io.put('h2', new Uint8Array([7]));
    expect(stores.get('new-room')?.has('h2')).toBe(true);
    expect(stores.get('old-room')?.has('h2') ?? false).toBe(false);
  });

  it('a single room string keeps working (pre-rotation call sites)', async () => {
    stores.set('only-room', new Map([['h1', new Uint8Array([4])]]));
    const io = hubBlobIO('ws://hub', 'only-room');
    expect(Array.from(await io.get('h1'))).toEqual([4]);
  });

  it('reports missing when no room has the chunk', async () => {
    const io = hubBlobIO('ws://hub', ['a', 'b']);
    expect(await io.has('nope')).toBe(false);
    await expect(io.get('nope')).rejects.toThrow();
  });
});

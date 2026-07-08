import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import WebSocket from 'ws';
import { createHub, type Hub } from './server';

let hub: Hub | null = null;
afterEach(async () => {
  await hub?.close();
  hub = null;
});

function connect(port: number): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
  });
}

function nextMessage(ws: WebSocket): Promise<{ t: string; seq: number; data: string }> {
  return new Promise((resolve) => {
    ws.once('message', (raw) => resolve(JSON.parse(String(raw))));
  });
}

describe('hub relay', () => {
  it('broadcasts pushed updates to room members with sequence numbers', async () => {
    hub = await createHub();
    const a = await connect(hub.port);
    const b = await connect(hub.port);
    a.send(JSON.stringify({ t: 'hello', room: 'r1', since: 0 }));
    b.send(JSON.stringify({ t: 'hello', room: 'r1', since: 0 }));

    const receivedByB = nextMessage(b);
    a.send(JSON.stringify({ t: 'push', data: 'CIPHERTEXT' }));

    const msg = await receivedByB;
    expect(msg).toEqual({ t: 'update', seq: 1, data: 'CIPHERTEXT' });
    a.close();
    b.close();
  });

  it('replays history after `since` to late joiners', async () => {
    hub = await createHub();
    const a = await connect(hub.port);
    const echoes: unknown[] = [];
    a.on('message', (raw) => echoes.push(JSON.parse(String(raw))));
    a.send(JSON.stringify({ t: 'hello', room: 'r2', since: 0 }));
    a.send(JSON.stringify({ t: 'push', data: 'ONE' }));
    a.send(JSON.stringify({ t: 'push', data: 'TWO' }));
    // wait for both to be assigned seqs (they echo back to sender)
    while (echoes.length < 2) await new Promise((r) => setTimeout(r, 10));

    const late = await connect(hub.port);
    const first = nextMessage(late);
    late.send(JSON.stringify({ t: 'hello', room: 'r2', since: 1 }));
    const msg = await first;
    expect(msg).toEqual({ t: 'update', seq: 2, data: 'TWO' });
    a.close();
    late.close();
  });

  it('rooms are isolated', async () => {
    hub = await createHub();
    const a = await connect(hub.port);
    const other = await connect(hub.port);
    a.send(JSON.stringify({ t: 'hello', room: 'roomA', since: 0 }));
    other.send(JSON.stringify({ t: 'hello', room: 'roomB', since: 0 }));

    let leaked = false;
    other.on('message', () => {
      leaked = true;
    });
    a.send(JSON.stringify({ t: 'push', data: 'SECRET' }));
    await nextMessage(a); // sender echo confirms broadcast happened
    await new Promise((r) => setTimeout(r, 100));
    expect(leaked).toBe(false);
    a.close();
    other.close();
  });

  it('persists rooms to disk and reloads them after restart', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'cue-hub-'));
    try {
      hub = await createHub({ dataDir: dir });
      const a = await connect(hub.port);
      a.send(JSON.stringify({ t: 'hello', room: 'persist', since: 0 }));
      a.send(JSON.stringify({ t: 'push', data: 'DURABLE' }));
      await nextMessage(a);
      a.close();
      await hub.close();

      hub = await createHub({ dataDir: dir });
      const b = await connect(hub.port);
      const replay = nextMessage(b);
      b.send(JSON.stringify({ t: 'hello', room: 'persist', since: 0 }));
      expect(await replay).toEqual({ t: 'update', seq: 1, data: 'DURABLE' });
      b.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('hub blob store', () => {
  function url(port: number, room: string, hash: string) {
    return `http://127.0.0.1:${port}/blob/${room}/${hash}`;
  }

  it('PUT then GET returns the identical bytes', async () => {
    hub = await createHub();
    const bytes = new Uint8Array([1, 2, 3, 4, 5, 250, 251, 252]);
    const put = await fetch(url(hub.port, 'r1', 'abc'), { method: 'PUT', body: bytes });
    expect(put.status).toBe(201);
    const got = await fetch(url(hub.port, 'r1', 'abc'));
    expect(got.status).toBe(200);
    const back = new Uint8Array(await got.arrayBuffer());
    expect(Array.from(back)).toEqual(Array.from(bytes));
  });

  it('HEAD reports existence and size', async () => {
    hub = await createHub();
    await fetch(url(hub.port, 'r1', 'h'), { method: 'PUT', body: new Uint8Array([9, 9, 9]) });
    const head = await fetch(url(hub.port, 'r1', 'h'), { method: 'HEAD' });
    expect(head.status).toBe(200);
    expect(head.headers.get('content-length')).toBe('3');
    const missing = await fetch(url(hub.port, 'r1', 'nope'), { method: 'HEAD' });
    expect(missing.status).toBe(404);
  });

  it('GET with a Range header returns a 206 partial slice', async () => {
    hub = await createHub();
    const bytes = new Uint8Array([10, 11, 12, 13, 14, 15]);
    await fetch(url(hub.port, 'r1', 'rng'), { method: 'PUT', body: bytes });
    const res = await fetch(url(hub.port, 'r1', 'rng'), { headers: { Range: 'bytes=2-4' } });
    expect(res.status).toBe(206);
    const slice = new Uint8Array(await res.arrayBuffer());
    expect(Array.from(slice)).toEqual([12, 13, 14]);
  });

  it('PUT is idempotent by hash (second write keeps the content)', async () => {
    hub = await createHub();
    await fetch(url(hub.port, 'r1', 'dup'), { method: 'PUT', body: new Uint8Array([1, 1]) });
    const second = await fetch(url(hub.port, 'r1', 'dup'), { method: 'PUT', body: new Uint8Array([1, 1]) });
    expect([200, 201, 204]).toContain(second.status);
    const got = await fetch(url(hub.port, 'r1', 'dup'));
    expect(Array.from(new Uint8Array(await got.arrayBuffer()))).toEqual([1, 1]);
  });

  it('rooms are isolated — same hash, different room, is a separate blob', async () => {
    hub = await createHub();
    await fetch(url(hub.port, 'roomA', 'x'), { method: 'PUT', body: new Uint8Array([1]) });
    const inB = await fetch(url(hub.port, 'roomB', 'x'), { method: 'HEAD' });
    expect(inB.status).toBe(404);
  });

  it('persists blobs to disk across a restart when a dataDir is given', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'cue-hub-blob-'));
    try {
      hub = await createHub({ dataDir: dir });
      await fetch(url(hub.port, 'r1', 'durable'), { method: 'PUT', body: new Uint8Array([7, 7, 7]) });
      await hub.close();
      hub = await createHub({ dataDir: dir });
      const got = await fetch(url(hub.port, 'r1', 'durable'));
      expect(Array.from(new Uint8Array(await got.arrayBuffer()))).toEqual([7, 7, 7]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

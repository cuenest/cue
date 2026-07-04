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

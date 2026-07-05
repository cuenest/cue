import { describe, it, expect, vi } from 'vitest';
import * as Y from 'yjs';
import { HubProvider, type WebSocketLike } from './provider';
import { generateSyncKey, encryptUpdate, toBase64Url } from './crypto';

class MockWebSocket implements WebSocketLike {
  static instances: MockWebSocket[] = [];
  readyState = 0;
  sent: string[] = [];
  onopen: ((ev?: unknown) => void) | null = null;
  onclose: ((ev?: unknown) => void) | null = null;
  onerror: ((ev?: unknown) => void) | null = null;
  onmessage: ((ev: { data: unknown }) => void) | null = null;

  constructor(public url: string) {
    MockWebSocket.instances.push(this);
  }
  send(data: string) {
    this.sent.push(data);
  }
  close() {
    this.readyState = 3;
    this.onclose?.();
  }
  open() {
    this.readyState = 1;
    this.onopen?.();
  }
}

const flush = () => new Promise((r) => setTimeout(r, 20));

describe('HubProvider', () => {
  it('sends hello with room, then pushes encrypted local updates', async () => {
    const doc = new Y.Doc();
    const key = await generateSyncKey();
    const provider = new HubProvider(doc, {
      url: 'ws://test',
      room: 'r1',
      key,
      WebSocketImpl: MockWebSocket,
    });
    const ws = MockWebSocket.instances.at(-1)!;
    ws.open();
    await flush();

    const hello = JSON.parse(ws.sent[0]!);
    expect(hello).toMatchObject({ t: 'hello', room: 'r1', since: 0 });

    doc.getMap('items').set('x', 'y');
    await flush();

    const pushes = ws.sent.map((s) => JSON.parse(s)).filter((m) => m.t === 'push');
    expect(pushes.length).toBeGreaterThan(0);
    // payload is ciphertext, not a raw Yjs update
    expect(pushes.at(-1)!.data).toMatch(/^[A-Za-z0-9_-]+$/);
    provider.destroy();
  });

  it('applies inbound updates without echoing them back', async () => {
    const key = await generateSyncKey();

    // source doc produces an encrypted update
    const source = new Y.Doc();
    source.getMap('items').set('greeting', 'hello');
    const cipher = await encryptUpdate(key, Y.encodeStateAsUpdate(source));

    const doc = new Y.Doc();
    const provider = new HubProvider(doc, {
      url: 'ws://test',
      room: 'r1',
      key,
      WebSocketImpl: MockWebSocket,
    });
    const ws = MockWebSocket.instances.at(-1)!;
    ws.open();
    await flush();
    const sentBefore = ws.sent.length;

    ws.onmessage?.({
      data: JSON.stringify({ t: 'update', seq: 1, data: toBase64Url(cipher) }),
    });
    await flush();

    expect(doc.getMap('items').get('greeting')).toBe('hello');
    // remote-applied update must not be pushed back
    const newPushes = ws.sent.slice(sentBefore).map((s) => JSON.parse(s)).filter((m) => m.t === 'push');
    expect(newPushes).toHaveLength(0);
    provider.destroy();
  });

  it('reports status transitions and reconnects after close', async () => {
    vi.useFakeTimers();
    const doc = new Y.Doc();
    const key = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    const statuses: string[] = [];
    const provider = new HubProvider(doc, {
      url: 'ws://test',
      room: 'r1',
      key,
      WebSocketImpl: MockWebSocket,
      reconnectBaseMs: 10,
    });
    provider.onStatus((s) => statuses.push(s));
    const first = MockWebSocket.instances.at(-1)!;
    first.open();
    expect(statuses).toContain('connected');

    first.close();
    expect(statuses.at(-1)).toBe('offline');

    vi.advanceTimersByTime(50);
    expect(MockWebSocket.instances.at(-1)).not.toBe(first); // new socket created
    provider.destroy();
    vi.useRealTimers();
  });
});

import { WebSocketServer, WebSocket } from 'ws';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The Cue hub: a zero-knowledge rendezvous node.
 *
 * Protocol (JSON text frames):
 *   client -> hub : { t: 'hello', room, since }   join a room, request replay after `since`
 *   client -> hub : { t: 'push', data }           an encrypted update (base64url)
 *   hub -> client : { t: 'update', seq, data }    replayed and live updates (all members, incl. sender)
 *
 * The hub never sees plaintext — `data` is AES-GCM ciphertext it cannot decrypt.
 */

interface Room {
  seq: number;
  updates: Array<{ seq: number; data: string }>;
  clients: Set<WebSocket>;
}

export interface HubOptions {
  port?: number;
  /** Directory for per-room persistence. Omit for in-memory only. */
  dataDir?: string;
}

export interface Hub {
  port: number;
  close(): Promise<void>;
}

export function createHub(options: HubOptions = {}): Promise<Hub> {
  const rooms = new Map<string, Room>();
  const dataDir = options.dataDir;
  if (dataDir) mkdirSync(dataDir, { recursive: true });

  function roomFile(name: string): string {
    // room ids are uuids/base64url — keep filenames safe regardless
    return join(dataDir!, encodeURIComponent(name) + '.json');
  }

  function getRoom(name: string): Room {
    let room = rooms.get(name);
    if (!room) {
      room = { seq: 0, updates: [], clients: new Set() };
      if (dataDir && existsSync(roomFile(name))) {
        try {
          const saved = JSON.parse(readFileSync(roomFile(name), 'utf8')) as {
            seq: number;
            updates: Array<{ seq: number; data: string }>;
          };
          room.seq = saved.seq;
          room.updates = saved.updates;
        } catch {
          // corrupt file — start fresh rather than crash the hub
        }
      }
      rooms.set(name, room);
    }
    return room;
  }

  function persist(name: string, room: Room) {
    if (!dataDir) return;
    try {
      writeFileSync(roomFile(name), JSON.stringify({ seq: room.seq, updates: room.updates }));
    } catch {
      // disk trouble must not kill the relay
    }
  }

  return new Promise((resolve) => {
    const wss = new WebSocketServer({ port: options.port ?? 0 }, () => {
      const address = wss.address();
      const port = typeof address === 'object' && address ? address.port : (options.port ?? 0);
      resolve({
        port,
        close: () =>
          new Promise<void>((res) => {
            for (const ws of wss.clients) ws.terminate();
            wss.close(() => res());
          }),
      });
    });

    wss.on('connection', (ws) => {
      let joined: string | null = null;

      ws.on('message', (raw) => {
        let msg: { t?: string; room?: string; since?: number; data?: string };
        try {
          msg = JSON.parse(String(raw));
        } catch {
          return;
        }

        if (msg.t === 'hello' && typeof msg.room === 'string') {
          joined = msg.room;
          const room = getRoom(joined);
          room.clients.add(ws);
          const since = typeof msg.since === 'number' ? msg.since : 0;
          for (const u of room.updates) {
            if (u.seq > since) ws.send(JSON.stringify({ t: 'update', seq: u.seq, data: u.data }));
          }
          return;
        }

        if (msg.t === 'push' && joined && typeof msg.data === 'string') {
          const room = getRoom(joined);
          room.seq += 1;
          const entry = { seq: room.seq, data: msg.data };
          room.updates.push(entry);
          persist(joined, room);
          const frame = JSON.stringify({ t: 'update', seq: entry.seq, data: entry.data });
          for (const client of room.clients) {
            if (client.readyState === WebSocket.OPEN) client.send(frame);
          }
        }
      });

      ws.on('close', () => {
        if (joined) rooms.get(joined)?.clients.delete(ws);
      });
    });
  });
}

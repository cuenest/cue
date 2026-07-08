import { WebSocketServer, WebSocket } from 'ws';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
  statSync,
  createReadStream,
  mkdtempSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * The Cue hub: a zero-knowledge rendezvous node.
 *
 * Two surfaces on one port:
 *   - WebSocket: relays encrypted Yjs updates (the sync doc).
 *   - HTTP /blob/:room/:hash: a content-addressed store for encrypted file
 *     chunks. The hub never sees plaintext — chunks are AES-GCM ciphertext it
 *     cannot decrypt, addressed by the hash of the plaintext.
 *
 * Sync protocol (JSON text frames over WS):
 *   client -> hub : { t: 'hello', room, since }   join a room, replay after `since`
 *   client -> hub : { t: 'push', data }           an encrypted update (base64url)
 *   hub -> client : { t: 'update', seq, data }     replayed + live updates
 *
 * Blob protocol (HTTP):
 *   PUT  /blob/:room/:hash   store an encrypted chunk (idempotent by hash)
 *   GET  /blob/:room/:hash   fetch a chunk (supports Range → 206 partial)
 *   HEAD /blob/:room/:hash   existence + size (for resume / availability)
 */

interface Room {
  seq: number;
  updates: Array<{ seq: number; data: string }>;
  clients: Set<WebSocket>;
}

export interface HubOptions {
  port?: number;
  /** Directory for per-room persistence (sync log + blobs). Omit for in-memory sync + temp blobs. */
  dataDir?: string;
}

export interface Hub {
  port: number;
  close(): Promise<void>;
}

const SAFE = /^[A-Za-z0-9_-]+$/;

function cors(res: ServerResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');
}

export function createHub(options: HubOptions = {}): Promise<Hub> {
  const rooms = new Map<string, Room>();
  const dataDir = options.dataDir;
  if (dataDir) mkdirSync(dataDir, { recursive: true });

  const blobDir = dataDir
    ? join(dataDir, 'blobs')
    : mkdtempSync(join(tmpdir(), 'cue-hub-blobs-'));
  mkdirSync(blobDir, { recursive: true });

  function roomFile(name: string): string {
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

  // ---- blob store ----

  function blobPath(room: string, hash: string): string | null {
    if (!SAFE.test(room) || !SAFE.test(hash)) return null; // reject traversal / odd names
    return join(blobDir, room, hash);
  }

  function handleBlob(req: IncomingMessage, res: ServerResponse, room: string, hash: string): void {
    cors(res);
    const path = blobPath(room, hash);
    if (!path) {
      res.statusCode = 400;
      res.end();
      return;
    }

    if (req.method === 'PUT') {
      const chunks: Buffer[] = [];
      req.on('data', (c: Buffer) => chunks.push(c));
      req.on('end', () => {
        try {
          if (!existsSync(path)) {
            mkdirSync(join(blobDir, room), { recursive: true });
            writeFileSync(path, Buffer.concat(chunks)); // content-addressed → idempotent
          }
          res.statusCode = 201;
          res.end();
        } catch {
          res.statusCode = 500;
          res.end();
        }
      });
      return;
    }

    const exists = existsSync(path);
    if (!exists) {
      res.statusCode = 404;
      res.end();
      return;
    }
    const size = statSync(path).size;
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Type', 'application/octet-stream');

    if (req.method === 'HEAD') {
      res.setHeader('Content-Length', String(size));
      res.statusCode = 200;
      res.end();
      return;
    }

    if (req.method === 'GET') {
      const range = req.headers.range;
      const m = range ? /^bytes=(\d*)-(\d*)$/.exec(range) : null;
      if (m) {
        const start = m[1] ? parseInt(m[1], 10) : 0;
        const end = m[2] ? parseInt(m[2], 10) : size - 1;
        if (start > end || end >= size) {
          res.statusCode = 416;
          res.setHeader('Content-Range', `bytes */${size}`);
          res.end();
          return;
        }
        res.statusCode = 206;
        res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
        res.setHeader('Content-Length', String(end - start + 1));
        createReadStream(path, { start, end }).pipe(res);
        return;
      }
      res.statusCode = 200;
      res.setHeader('Content-Length', String(size));
      createReadStream(path).pipe(res);
      return;
    }

    res.statusCode = 405;
    res.end();
  }

  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      if (req.method === 'OPTIONS') {
        cors(res);
        res.statusCode = 204;
        res.end();
        return;
      }
      const parts = (req.url ?? '/').split('?')[0]!.split('/').filter(Boolean);
      if (parts[0] === 'blob' && parts.length === 3) {
        handleBlob(req, res, decodeURIComponent(parts[1]!), decodeURIComponent(parts[2]!));
        return;
      }
      res.statusCode = 404;
      res.end();
    });

    const wss = new WebSocketServer({ server });

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

    server.listen(options.port ?? 0, () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : (options.port ?? 0);
      resolve({
        port,
        close: () =>
          new Promise<void>((res) => {
            for (const ws of wss.clients) ws.terminate();
            wss.close(() => server.close(() => res()));
          }),
      });
    });
  });
}

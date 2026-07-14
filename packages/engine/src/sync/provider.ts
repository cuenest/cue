import * as Y from 'yjs';
import { toBase64Url, fromBase64Url } from './crypto';
import {
  keyringFromLegacy,
  encryptForKeyring,
  decryptWithKeyring,
  type Keyring,
} from './keyring';

export type SyncStatus = 'offline' | 'connecting' | 'connected';

/** Minimal structural WebSocket type so a mock can be injected in tests. */
export interface WebSocketLike {
  readyState: number;
  send(data: string): void;
  close(): void;
  onopen: ((ev?: unknown) => void) | null;
  onclose: ((ev?: unknown) => void) | null;
  onerror: ((ev?: unknown) => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
}

export interface HubProviderOptions {
  url: string;
  room: string;
  key: string;
  /**
   * Full key history for rotated spaces: outbound updates encrypt under the
   * current epoch, inbound updates decrypt by whatever epoch they name.
   * Omitted → a single-epoch ring is built from `key` (pre-rotation spaces).
   */
  keyring?: Keyring;
  /** Injectable for tests; defaults to the global WebSocket. */
  WebSocketImpl?: new (url: string) => WebSocketLike;
  /** Base reconnect delay in ms (doubles per attempt, capped). */
  reconnectBaseMs?: number;
}

const OPEN = 1;

/**
 * Relays encrypted Yjs updates through a hub. The hub sees only ciphertext.
 * Replays history on (re)connect via a per-room sequence number; Yjs updates
 * are idempotent, so replaying already-applied updates is harmless.
 */
export class HubProvider {
  private readonly doc: Y.Doc;
  private readonly opts: Required<Pick<HubProviderOptions, 'url' | 'room' | 'key'>> &
    HubProviderOptions;
  private readonly keyring: Keyring;
  private ws: WebSocketLike | null = null;
  private lastSeq = 0;
  private destroyed = false;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private statusListeners = new Set<(s: SyncStatus) => void>();
  private _status: SyncStatus = 'offline';

  constructor(doc: Y.Doc, opts: HubProviderOptions) {
    this.doc = doc;
    this.opts = opts;
    this.keyring = opts.keyring ?? keyringFromLegacy(opts.key, opts.room);
    doc.on('update', this.onDocUpdate);
    this.connect();
  }

  get status(): SyncStatus {
    return this._status;
  }

  onStatus(listener: (s: SyncStatus) => void): () => void {
    this.statusListeners.add(listener);
    listener(this._status);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  private setStatus(s: SyncStatus) {
    if (this._status === s) return;
    this._status = s;
    this.statusListeners.forEach((l) => l(s));
  }

  private onDocUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin === this) return; // came from the hub — don't echo
    void this.push(update);
  };

  private async push(update: Uint8Array) {
    const ws = this.ws;
    if (!ws || ws.readyState !== OPEN) return; // offline edits arrive via replay later
    const cipher = await encryptForKeyring(this.keyring, update);
    // the socket may have closed/destroyed during the await — re-check before sending
    if (ws.readyState === OPEN) ws.send(JSON.stringify({ t: 'push', data: toBase64Url(cipher) }));
  }

  private connect() {
    if (this.destroyed) return;
    const Impl =
      this.opts.WebSocketImpl ??
      (globalThis.WebSocket as unknown as new (url: string) => WebSocketLike);
    this.setStatus('connecting');
    const ws = new Impl(this.opts.url);
    this.ws = ws;

    ws.onopen = () => {
      this.reconnectAttempts = 0;
      ws.send(JSON.stringify({ t: 'hello', room: this.opts.room, since: this.lastSeq }));
      this.setStatus('connected');
      // send current state so peers converge even after offline edits
      void this.push(Y.encodeStateAsUpdate(this.doc));
    };

    ws.onmessage = (ev) => {
      void (async () => {
        try {
          const msg = JSON.parse(String(ev.data)) as { t: string; seq?: number; data?: string };
          if (msg.t === 'update' && typeof msg.seq === 'number' && msg.data) {
            this.lastSeq = Math.max(this.lastSeq, msg.seq);
            const plain = await decryptWithKeyring(this.keyring, fromBase64Url(msg.data));
            Y.applyUpdate(this.doc, plain, this);
          }
        } catch (err) {
          // a frame that cannot be decrypted (wrong key) or parsed must not corrupt
          // the doc — but it must be VISIBLE, silent drops make sync undebuggable
          console.warn('[cue-sync] dropped frame:', err);
        }
      })();
    };

    ws.onclose = () => {
      this.setStatus('offline');
      this.scheduleReconnect();
    };
    ws.onerror = () => {
      // onclose follows; nothing to do
    };
  }

  private scheduleReconnect() {
    if (this.destroyed) return;
    const base = this.opts.reconnectBaseMs ?? 1000;
    const delay = Math.min(base * 2 ** this.reconnectAttempts, 30_000);
    this.reconnectAttempts += 1;
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  destroy() {
    this.destroyed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.doc.off('update', this.onDocUpdate);
    this.ws?.close();
    this.ws = null;
    this.setStatus('offline');
  }
}

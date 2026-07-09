/**
 * Runs an embedded Cue sync hub inside the desktop app's main process, so an
 * always-on desktop can double as the hub for the user's other devices ("hub
 * mode"). The hub relays ciphertext only — hosting it does not expose data.
 *
 * The real hub is loaded from @cue/hub at runtime via a dynamic import that is
 * hidden from the (CommonJS) TypeScript compiler, so it stays a native ESM
 * import at runtime. Tests inject a fake factory instead.
 */

export interface HubLike {
  port: number;
  close(): Promise<void>;
}

export type HubFactory = (opts: { port?: number; dataDir?: string }) => Promise<HubLike>;

// Hidden from tsc's module transform so it emits a real ESM import() at runtime
// (a CommonJS build can then load the ESM @cue/hub package).
const importHub = (): Promise<{ createHub: HubFactory }> =>
  (Function('return import("@cue/hub")')() as Promise<{ createHub: HubFactory }>);

export interface HubControllerOptions {
  /** Where the hub persists encrypted rooms + blobs (under the app's userData). */
  dataDir: string;
  /** Preferred port; defaults to the hub's own default (4444). */
  port?: number;
  /** Injectable for tests; defaults to the real @cue/hub. */
  loadFactory?: () => Promise<HubFactory>;
}

export class HubController {
  private hub: HubLike | null = null;
  private starting: Promise<number> | null = null;

  constructor(private readonly opts: HubControllerOptions) {}

  get running(): boolean {
    return this.hub !== null;
  }

  get port(): number | null {
    return this.hub?.port ?? null;
  }

  /** Start the hub (idempotent — concurrent calls share one start). */
  async start(): Promise<number> {
    if (this.hub) return this.hub.port;
    if (this.starting) return this.starting;
    this.starting = (async () => {
      const load = this.opts.loadFactory ?? (async () => (await importHub()).createHub);
      const createHub = await load();
      const hub = await createHub({ port: this.opts.port, dataDir: this.opts.dataDir });
      this.hub = hub;
      return hub.port;
    })();
    try {
      return await this.starting;
    } finally {
      this.starting = null;
    }
  }

  async stop(): Promise<void> {
    const hub = this.hub;
    this.hub = null;
    await hub?.close();
  }
}

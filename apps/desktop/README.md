# @cue/desktop

**Windows / macOS / Linux** app — an Electron shell that loads the same local-first web UI, with a global capture hotkey (`Alt+Shift+C`) and two modes.

## Two modes

### Normal device (default)
The desktop is a sync **client**, exactly like the web app and phone. It loads the built web app (or `--dev-url` in development) and joins spaces via link codes.

### Hub mode — this device hosts the hub
Toggle **Hub → "Host a sync hub on this device"** in the menu bar. The app then also runs an embedded Cue hub in its own process, so an always-on desktop becomes the sync hub for your other devices — no separate hosting. It stays a normal client too; hub mode is additive.

- **Zero-knowledge still holds:** the embedded hub only relays/stores *ciphertext*. Hosting it does not let this machine read your data.
- **Point other devices at it:** menu **Hub → "Show hub address…"** lists this machine's `ws://<lan-ip>:4444` addresses. On another device (same network), paste one as the hub when creating or joining a space.
- **Persistence:** the hub stores encrypted rooms + file blobs under the app's `userData/hub-data`. The choice to host is remembered across restarts.

## What about two hubs?

A space names **one** hub at a time, and every device holds a **full local replica** (CRDT), so:

- **Two hubs for two different spaces** — normal. e.g. your personal space uses this desktop hub at home; a shared space uses a hosted hub.
- **Same space, devices split across two unconnected hubs** — a temporary *partition*: each side keeps working offline and **merges losslessly** once they share a hub again (no conflicts, no data loss).
- **Switching a space's hub** is always safe — re-point and it re-syncs from replicas.

So hub mode makes this machine *one of the hubs you can point a space at* — ideal on your LAN, with a hosted hub (see `render.yaml`) as the away-from-home option. A primary + fallback list and hub-to-hub federation are natural future upgrades — both safe to add because CRDT merges are idempotent.

## Run / build

```bash
pnpm --filter @cue/web build           # the UI the shell loads (bakes the prod hub)
pnpm --filter @cue/desktop start       # builds the embeddable hub, compiles, launches Electron
pnpm --filter @cue/desktop dev         # same, against the web dev server (--dev-url)
```

`start`/`dev` build `@cue/hub` first so hub mode works immediately. Packaging a distributable (electron-builder) and bundling the hub for it is a later step.

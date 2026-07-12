# Cue

**A local-first, zero-knowledge app for capturing anything and processing it one item at a time — notes, a master calendar, encrypted file transfer, and an AI assistant, across all your devices, with no account and no server able to read your data.**

This is the core monorepo: the shared engine, every platform application, and the self-hostable sync hub. The organization-wide overview lives at [github.com/cuenest](https://github.com/cuenest).

---

## Why Cue

Most task apps become a second job: sorting, tagging, and re-ordering a growing pile. Cue is built on a different discipline — **capture instantly, then process one item at a time**. There is no pile to curate. Each item is resolved by exactly one action: do it now, schedule it, delegate it, or drop it.

Around that core loop, Cue adds the things a capture tool actually needs:

- **No account.** Devices link by scanning a QR code or pasting a short code. Identity never touches a server.
- **Local-first.** Every device holds a complete replica of your data and works fully offline. Sync is a convenience, not a dependency.
- **Zero-knowledge sync.** Data is encrypted on your device before it leaves. The relay in the middle stores and forwards ciphertext it cannot read — whether you run it yourself or use a hosted one.
- **Open source.** Everything that touches user data is in this repository, under AGPL-3.0.

---

## What it does today

### Capture and the queue
A single input captures anything. Typing `#` opens a command palette that enriches the item as you type:

- `#notes:<name>` links the item to a note, with autocomplete over existing notes and inline creation of new ones.
- `#due:<when>` schedules it with natural language — `#due:tomorrow`, `#due:fri 9:30am`, `#due:in 2 hours` — and fires a reminder notification when it comes due.
- `#to:<who>` delegates it.

Processing happens in the Focus view: one card, oldest first, four ways out (do, schedule, delegate, drop), with keyboard shortcuts and undo. The inbox shows the queue, the scheduled, the delegated, and the log.

### Notes
Notes are persistent reference material, distinct from queue items. They render a safe markdown subset — headings, lists, quotes, code, links, images and video by URL — and are linked two ways: an item shows chips for the notes it references, and a note lists every item that references it. Because notes sync into shared spaces, rendering is sanitized by construction (markdown parses to React nodes, never raw HTML; URLs pass an allow-list).

### Master calendar
Import any calendar as a read-only ICS feed (Google, Outlook, and Apple all export one) and see it merged with your own scheduled items in one month view and agenda. Imported events are visually distinct and locked; recurrence rules are expanded by the engine.

### Files
Send files of any size between devices in a space. Files are split into content-addressed chunks, encrypted, and stored on the hub; only the small manifest lives in the synced document, so bytes move on demand instead of replicating to every device. Media previews stream — a Service Worker fetches, decrypts, and range-serves chunks so a video plays without downloading fully. "Keep offline" pins a file's chunks into local storage so it opens and downloads even when the hub is down.

### Shared spaces and devices
A space is a separate encrypted world — its own queue, calendar, notes, and files — shared with whoever holds its invite code (shown as a QR, scannable in-app with the camera). Settings lists every device in a space with live presence, and each device can be named.

### Assistant
Ask questions about your own data — "what's on my plate today?", "did I capture anything about the dentist?" — answered by a model using your own API key, called directly from the browser with no middleman. Any Anthropic key or any OpenAI-compatible key works (OpenAI, Groq, OpenRouter, Gemini, DeepSeek, Ollama, or a custom endpoint); paste a key and the provider is detected automatically. The model never receives a data dump: it requests exactly what it needs through tools that execute locally, and only those slices are sent.

### The web app is an installable PWA
Open the deployed site, choose "Install" or "Add to Home Screen", and Cue runs as an app with its own icon, an animated launch screen, and full offline capability — the service worker caches the shell, and the data was always local. On phones, navigation moves to a bottom tab bar.

---

## How sync works

- **Spaces and hubs.** A space names one hub — a small relay that stores and forwards encrypted updates. Devices in a space connect to that hub; each keeps a full local replica (a Yjs CRDT document), so concurrent and offline edits merge deterministically when devices reconnect. If a space's hub is unreachable, every device keeps working; they converge when it returns. Switching a space to a different hub is always safe, because replicas re-push on connect.
- **Link codes.** Creating a space generates a random room id and a random 256-bit key. Both travel inside the QR/link code, never through the hub. The hub learns which room to relay for — it never learns the key, so it stores ciphertext it cannot open.
- **Encryption.** Updates and file chunks are encrypted with AES-256-GCM. Every ciphertext is self-describing — a leading suite byte names the algorithm that produced it — so future cipher suites (including post-quantum constructions for the planned per-person key layer) can be introduced without migrating existing data.
- **Trust model, stated honestly.** Today a space is a shared vault: everyone holding the invite code has equal read/write access, so share it like a house key. A membership model with per-person keys — enabling revocation and attribution — is designed and planned; it wraps the existing shared key rather than replacing the data encryption.

You can run the hub anywhere Node runs, host it on a free cloud instance, or turn the desktop app into one (see below). One hub can serve many users: rooms are isolated and the content is ciphertext either way.

---

## Repository structure

```
cue/
  packages/
    engine/        Shared core: items and queue, notes, calendar, files,
                   devices, replicated store, crypto, link codes, sync provider.
                   No interface code, no network assumptions.
    ui/            Placeholder for components shared across surfaces
                   (components currently live in apps/web while the design settles).
  apps/
    web/           The primary application: installable, offline-capable PWA.
    desktop/       Electron shell around the web app, with a global capture
                   hotkey (Alt+Shift+C) and an optional hub mode.
    extension/     Browser extension (WXT, MV3): quick-capture popup and
                   right-click capture; syncs as its own device via a link code.
    mobile/        Capacitor wrapper for Android and (later) iOS.
    hub/           Self-hostable sync node: WebSocket relay for encrypted
                   updates plus an HTTP blob store for encrypted file chunks,
                   on one port. Also embeddable as a library.
```

The dependency direction is strict: applications depend on the engine, never the reverse. The engine is pure TypeScript over a replicated document — the queue rules, note linking, calendar expansion, chunked file transfer, and crypto are all unit-tested in isolation, with no browser required.

---

## Getting started

Prerequisites: Node.js (current LTS) and pnpm (`corepack enable`).

```bash
git clone https://github.com/cuenest/cue.git
cd cue
pnpm install          # one install for the whole workspace
pnpm dev              # runs everything: web (localhost:5178), hub (4444),
                      # extension dev build, desktop shell
```

To run only what you need:

```bash
pnpm --filter @cue/web dev        # just the web app
pnpm --filter @cue/hub dev        # just a local sync hub on :4444
pnpm --filter @cue/extension dev  # extension → load .output/chrome-mv3-dev unpacked
pnpm --filter @cue/desktop dev    # Electron shell against the web dev server
```

Quality gates, run from the root: `pnpm test` (Vitest across all packages), `pnpm typecheck`, `pnpm build`. CI runs all three on every push.

---

## Deploy

Cue deploys as two pieces: the **hub** (a small Node service that relays and stores ciphertext only) and the **web app** (a static site). [`render.yaml`](render.yaml) wires both as a one-click Render blueprint, but nothing is Render-specific.

**One-click (Render):** create a Blueprint pointing at this repository. It provisions `cue-hub` (web service) and `cue-web` (static site) with the hub URL baked into the web build.

**Manual / self-host:**

```bash
# 1. Run a hub anywhere Node runs (VPS, Raspberry Pi, always-on desktop)
PORT=4444 CUE_HUB_DATA=./data pnpm --filter @cue/hub start

# 2. Build the web app pointed at that hub, then serve apps/web/dist statically
VITE_DEFAULT_HUB=wss://your-hub.example.com pnpm --filter @cue/web build
```

`VITE_DEFAULT_HUB` accepts a full `ws(s)://` URL or a bare host (treated as `wss://`). It only sets the default offered when creating a space — every space can point at a different hub in Settings, so one build can talk to many hubs.

**Durability:** on a free tier the hub's disk is ephemeral, so relay state and file chunks are wiped on redeploy. This is usually harmless — every device holds a full replica and re-pushes on reconnect — but a file whose bytes existed only on the hub is lost unless some device pinned it. For durable file storage, attach a persistent disk (a commented block in `render.yaml`) or self-host.

**Other surfaces** inherit the hub. The desktop app bundles the web build, so building the web app with `VITE_DEFAULT_HUB` set is enough. The extension takes `VITE_DEFAULT_HUB` (a fallback — the hub inside a pasted link code always wins) and `VITE_APP_URL` at build time; see [`apps/extension/.env.example`](apps/extension/.env.example).

---

## Development conventions

- The engine must not import React, touch the DOM, or assume a network. If an engine change seems to need any of those, the design needs revisiting.
- Local-first and zero-knowledge are requirements, not options. No feature may depend on a server reading user data.
- Engine behavior is developed test-first. Anything rendered from synced content is treated as untrusted input.
- Floating interface elements (menus, dialogs, overlays) render through portals so they are never clipped by layout containers.
- TypeScript throughout. Match the style of the surrounding code.

---

## Status

Working today, verified end to end: capture with the `#` command palette, the processing queue, notes with two-way links, the master calendar, encrypted sync between devices, shared spaces with device presence and QR join, chunked encrypted file transfer with streaming preview and offline pinning, the multi-provider assistant, and the installable offline PWA.

| Surface | State |
| --- | --- |
| Web | Working — the primary surface; installable PWA, offline-capable |
| Browser extension | Working — quick-capture popup, right-click capture, syncs as its own device |
| Desktop | Working — Electron shell, global capture hotkey, optional hub mode that hosts the sync hub for your other devices |
| Mobile | Android project wired and branded (Capacitor); APK build and on-device testing require the Android SDK. iOS planned. |
| Hub | Working — deployable service, embeddable library, or desktop hub mode |

Planned next: per-person space keys (membership, revocation, attribution — with a hybrid post-quantum key exchange), media uploads inside notes via the existing file pipeline, share-to-capture on Android, and local-network peer-to-peer file transfer.

---

## Contributing

Contributions are welcome. The engine is the most approachable entry point, since its logic stands alone and is fully unit-tested. Please read the organization-wide [contributing guidelines](https://github.com/cuenest/.github/blob/main/CONTRIBUTING.md), and open an issue to discuss substantial changes before submitting a pull request.

## License

[AGPL-3.0](LICENSE). The copyleft applies even when Cue is run as a network service, which keeps the project open. The hosted convenience service (`cue-cloud`) is a separate, private repository; every feature and everything that touches user data is here.

# Cue

**Local-first, zero-knowledge capture-and-do.** Dump anything from any device, process it one item at a time, see all your calendars in one view, and ask an AI about it — with **no account** and your data stored on **your own devices**.

> Part of [@cuenest](https://github.com/cuenest). This is the open-source monorepo (engine + all client surfaces). The paid zero-knowledge sync relay lives in a separate private repo (`cue-cloud`).

## Why Cue

- **No account.** Identity is a keypair generated on your device. We literally cannot read your data.
- **Queue discipline.** Capture lands in one Inbox; you process it **one item at a time** (Do / Schedule / Delegate / Drop) — not a sorted pile.
- **Yours to host.** Sync over your LAN or your own always-on hub for free. The subscription only sells zero-setup cross-internet convenience.

## Layout

```
packages/
  engine/   pure TypeScript: queue logic, CRDT (Yjs), identity, crypto, sync
  ui/       shared React components
apps/
  web/      Vite + React (the first surface)
docs/
  superpowers/specs/   design specs
```

## Status

Early development. See the design spec: [`docs/superpowers/specs/2026-06-28-cue-phase-0-1-design.md`](docs/superpowers/specs/2026-06-28-cue-phase-0-1-design.md).

**Phase 0** (current): single-device capture + queue. **Phase 1**: multi-device CRDT sync + QR linking.

## Stack

TypeScript everywhere · React + Vite · pnpm + Turborepo · Yjs (CRDT) · Capacitor (mobile/desktop, later) · WXT (extension, later).

## License

Recommended: **AGPL-3.0** (to be confirmed before first public release). See the spec's "Open decisions."

## Contributing

See the org-wide guide in [cuenest/.github](https://github.com/cuenest/.github). Community lives on Discord and Reddit (links in the org profile).

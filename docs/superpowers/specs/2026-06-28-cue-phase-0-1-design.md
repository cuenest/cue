# Cue — Phase 0 + 1 Design Spec

**Date:** 2026-06-28
**Status:** Draft for review
**Scope:** Phase 0 (single-device MVP) and Phase 1 (multi-device sync). Phases 2–4 are summarized in the Vision Appendix and are explicitly **out of scope** for this spec.

---

## 1. Product summary

**Cue** is a local-first, zero-knowledge capture-and-do app. You dump anything from any device, process it one item at a time, see all your calendars merged into one view, and ask an AI about it — with **no account required** and your data stored on **your own devices**.

**The wedge** (vs. TickTick and similar):
1. **No account / local-first** — identity is a cryptographic keypair generated on-device; "we literally cannot read your data."
2. **True queue discipline** — process one item at a time, not a sorted pile.
3. **Open source** with a self-hostable sync hub; subscription funds a zero-knowledge convenience relay.

**Org:** `cuenest` (GitHub). **Product name:** Cue.

### Priority order (from the user)

`A → D → B → C`: **Capture** (fast dump) → **Queue/Process** (one-by-one) → **Master Calendar** (merged view) → **AI** (query layer).

---

## 2. Scope of this spec

| Phase | In this spec? | Contents |
|---|---|---|
| **Phase 0 — Single-device MVP** | ✅ | Capture → Inbox → Queue/Process (Focus mode), local storage, web app + engine package. No sync, no crypto, no calendar, no AI. |
| **Phase 1 — Multi-device sync** | ✅ | Keypair identity, QR device linking, CRDT (Yjs) sync, LAN P2P + self-host hub. Single shared identity (model A under the hood). |
| Phase 2 — Master Calendar | ❌ Appendix only | Two-layer calendar (imported read-only / editable). |
| Phase 3 — Shared spaces + permissions (model B) | ❌ Appendix only | Per-person access, file transfer. |
| Phase 4 — AI layer | ❌ Appendix only | Client-side RAG + tool-calling + memory, pluggable providers (local / BYOK / managed). |

**Why this split:** a spec that tries to cover all five phases becomes unimplementable. Phase 0+1 delivers the differentiating core loop (capture + queue discipline) and the foundational sync architecture everything else builds on.

---

## 3. Tech stack

TypeScript end-to-end, so contributors only need one language.

| Layer | Choice | Rationale |
|---|---|---|
| Language | TypeScript | One language across engine, all surfaces, backend → maximum contributor pool |
| Frontend | React + Vite | Fast, familiar, huge ecosystem |
| Monorepo tooling | pnpm workspaces + Turborepo | One clone, one install, shared packages |
| CRDT / sync | Yjs | Mature, tiny, fast; binary diffs ideal for encrypted relay |
| Local storage (web) | IndexedDB (via `y-indexeddb`) | Offline persistence for CRDT docs |
| Mobile / desktop (later) | Capacitor | Web → native, no new language |
| Extension (later) | WXT | Reuses React components |
| Self-host hub (Phase 1) | Node/Bun + `y-websocket`-style relay | Headless sync node |
| Paid backend (later) | Hono on Bun + Supabase | Fast TS backend; zero-knowledge relay + billing |

---

## 4. Architecture overview

```
┌─────────────────────────────────────────────────────────┐
│  SURFACES (React + Vite)        Phase 0: web only        │
│  apps/web  ·  (later: mobile, desktop, extension)        │
├─────────────────────────────────────────────────────────┤
│  ENGINE  (packages/engine — pure TypeScript, no UI)      │
│  • queue logic   • CRDT documents (Yjs)                  │
│  • identity/crypto (Phase 1)   • sync transport (Phase 1)│
├─────────────────────────────────────────────────────────┤
│  STORAGE (local-first)                                    │
│  Phase 0: in-memory + IndexedDB                          │
├─────────────────────────────────────────────────────────┤
│  SYNC TRANSPORT (pluggable — Phase 1)                     │
│  LAN P2P (WebRTC) · self-host hub                        │
│  — carries only ENCRYPTED Yjs diffs (zero-knowledge)     │
└─────────────────────────────────────────────────────────┘
```

**Key isolation principle:** the **engine** knows nothing about UI or which transport is used. The web app imports the engine and renders it. This is what lets one engine later power five surfaces and three sync tiers, and lets contributors work on queue logic without touching crypto.

### Repo / package layout

```
github.com/cuenest/

  cue                       ← OSS monorepo (this repo)
    packages/
      engine/               queue · CRDT · (Phase 1) identity, crypto, sync
      ui/                   shared React components (extracted as it grows)
    apps/
      web/                  Vite + React (Phase 0 starts here)
    docs/
      superpowers/specs/    design specs (this file)

  .github                   ← OSS org profile (profile/README.md) + community defaults
  cue-cloud                 ← PRIVATE — paid zero-knowledge relay + billing (later)
```

---

## 5. Phase 0 — Single-device MVP

### 5.1 Core loop

```
  CAPTURE                 PROCESS                     (done)
  ┌──────────┐            ┌──────────────────┐
  │ Inbox    │  ───────▶  │ Focus mode:      │
  │ (dump,   │            │ one item at a    │
  │  no      │            │ time             │
  │  fields) │            │ Do/Schedule/     │
  └──────────┘            │ Delegate/Drop    │
                          └──────────────────┘
```

### 5.2 Data model

The unit is an **Item**. Everything captured is an Item; an Item can be promoted to a task with a due time.

```ts
type ItemId = string; // uuid

interface Item {
  id: ItemId;
  body: string;           // the captured text (required, can be empty briefly)
  createdAt: number;      // epoch ms — drives FIFO order
  status: 'inbox' | 'scheduled' | 'done' | 'dropped' | 'delegated';
  order: number;          // manual-bump override; default = createdAt
  dueAt?: number;         // set when scheduled
  delegatedTo?: string;   // free text in Phase 0
  updatedAt: number;
}
```

### 5.3 Queue ordering rule (decided)

**FIFO with optional manual bump.**
- Default order = `createdAt` ascending (oldest first).
- A user can **bump** an item to the top of the queue; bumping sets `order` below the current minimum so it surfaces next.
- Focus mode always presents the single item with the lowest effective order among `status === 'inbox'`.

### 5.4 The four process actions

In Focus mode, the current item shows four actions, then advances to the next:

| Action | Effect |
|---|---|
| **Do now** | `status = 'done'` |
| **Schedule** | prompt for `dueAt` → `status = 'scheduled'` (becomes a reminder later) |
| **Delegate** | capture `delegatedTo` → `status = 'delegated'` |
| **Drop** | `status = 'dropped'` |

### 5.5 Capture surface (Phase 0, web)

- A single always-available input (keyboard focus on load) that creates an `inbox` Item on submit and clears.
- No required fields beyond non-empty body. Capture must feel sub-2-seconds.
- (Global hotkey, share-sheet, extension popup come with later surfaces.)

### 5.6 Storage (Phase 0)

- Items live in a **Yjs document** from day one (even single-device), persisted to **IndexedDB** via `y-indexeddb`.
- Rationale: starting on Yjs now means Phase 1 sync is "add a transport," not "rewrite the data layer."

### 5.7 Components (Phase 0)

| Unit | Responsibility | Depends on |
|---|---|---|
| `engine/store` | Yjs doc + Item CRUD + ordering | Yjs |
| `engine/queue` | "next item" selection, bump logic | `engine/store` |
| `apps/web/Capture` | capture input → `engine` | `engine` |
| `apps/web/Focus` | render current item + 4 actions | `engine` |
| `apps/web/Inbox` | list view (review/bump) | `engine` |

### 5.8 Error handling (Phase 0)

- IndexedDB unavailable (private mode / quota) → fall back to in-memory, show a non-blocking banner "changes won't persist."
- Empty submit → ignored, no error.
- All engine mutations are synchronous on the in-memory Yjs doc; persistence is async and best-effort (never blocks the UI).

### 5.9 Testing (Phase 0)

- Unit tests on `engine/store` and `engine/queue` (ordering, bump, status transitions) — pure functions over a Yjs doc, no UI needed.
- Component tests on Capture/Focus/Inbox with a fresh in-memory engine per test.
- TDD: write the engine tests first (ordering and the four actions are well-specified).

---

## 6. Phase 1 — Multi-device sync

### 6.1 Identity (no account)

- On first launch, generate an **Ed25519 keypair** on-device. Public key (or a hash of it) = the user's **ID**.
- No email, no signup. "Guest" is the only mode; an "account" = a set of devices sharing a sync key.

### 6.2 Device linking (QR)

1. Device A: "Link device" → shows a QR encoding a one-time payload to start an **ECDH** key exchange.
2. Device B: scans → both derive a shared **sync key**.
3. Device B pulls the full replica from A (LAN if reachable, else via hub).

### 6.3 Sync model (CRDT)

- All data is a Yjs document. Every device holds a **full replica**.
- Edits merge **conflict-free** on reconnect (CRDT guarantee). No "server is source of truth."
- Data is safe the instant it exists on ≥2 devices.

### 6.4 Sync transport (pluggable)

| Tier | Transport | Infra | Server sees |
|---|---|---|---|
| Local only | none | none | nothing |
| LAN P2P | WebRTC (mDNS discovery) | none | nothing |
| Self-host hub | always-on node running the relay | user-run (VPS / Pi / desktop) | only ciphertext |

- All transports carry **encrypted Yjs diffs** (encrypted with the sync key). The transport is an opaque relay.
- Cross-internet zero-setup sync is **deferred to the paid `cue-cloud` relay** (later phase). Phase 1 power users self-host or use a tunnel (e.g. Tailscale).

### 6.5 Encryption

- Yjs update messages are encrypted with a symmetric key derived from the sync key before leaving the device. Hub/relay store and forward ciphertext only.
- Single shared identity in Phase 1 (one sync key per account). Per-space keys and permissions (model B) are Phase 3.

### 6.6 New components (Phase 1)

| Unit | Responsibility |
|---|---|
| `engine/identity` | keypair generation, storage, ID derivation |
| `engine/linking` | QR payload, ECDH handshake, sync-key derivation |
| `engine/sync` | pluggable transport interface; LAN + hub providers |
| `engine/crypto` | encrypt/decrypt Yjs updates |
| `apps/hub` (or `cue-hub`) | headless relay node |

### 6.7 Error handling (Phase 1)

- Linking handshake failure / QR expired → clear retry path, no partial-link state.
- Transport unreachable → app stays fully functional offline; queued updates flush on reconnect.
- Clock skew → rely on Yjs logical clocks, not wall-clock, for merge ordering.

### 6.8 Testing (Phase 1)

- Two-replica merge tests (offline edits on both → converge).
- Linking handshake unit tests (ECDH derivation produces matching keys).
- Encryption round-trip tests (encrypt on A, decrypt on B, tamper → reject).

---

## 7. Free (OSS) vs Paid split

| | Free / OSS | Paid (subscription) |
|---|---|---|
| All core features | ✅ | ✅ |
| Local-first, offline, no account | ✅ | ✅ |
| LAN sync | ✅ | ✅ |
| Self-hosted hub | ✅ | ✅ |
| Zero-setup cross-internet sync | — | ✅ (`cue-cloud` relay) |
| Always-on cloud backup | — | ✅ |
| Managed AI (no key needed) | — | ✅ (later) |

**Principle:** sell **convenience, not capability.** The OSS version is genuinely complete.

---

## 8. Open decisions / risks

1. **License** — recommend **AGPL-3.0** for the OSS core (prevents a competitor running a closed SaaS fork) with the private `cue-cloud` kept proprietary. **To confirm before first public push.**
2. **Hub packaging** — Phase 1 ships hub-as-a-mode is simplest, but a headless package (`cue-hub`) is the contributor magnet. Start with the engine relay; extract headless package when stable.
3. **Mobile QR camera** — needs Capacitor camera plugin; only relevant once mobile surface exists (post Phase 1 web↔web linking, which can use a manual code as fallback).

---

## Vision Appendix (out of scope for this spec)

The full product, for context — **not to be built in Phase 0+1.**

- **Phase 2 — Master Calendar:** import read-only feeds (Google / Outlook / Apple / ICS), merge into one view. Two layers: **imported = locked, dotted, color-per-source**; **Cue events/tasks = solid, editable**. Locked events are still readable by scheduling/AI logic.
- **Phase 3 — Shared spaces + permissions (model B):** data grouped into **Spaces**, each with its own symmetric key. Share a space by **wrapping its key with a recipient's public key**. Read vs write enforced via **signed updates + allowed-writers list** at the sync layer. Revocation = **rotate space key + re-wrap** (cannot un-send already-synced data — stated honestly). **File transfer** is a degenerate shared space: encrypt a file, wrap the key for one recipient, auto-expire.
- **Phase 4 — AI layer:** **client-side** (zero-knowledge forces this — server only sees ciphertext). Three parts:
  1. **Memory** — small editable profile/preferences, always in context (no fine-tuning).
  2. **Tool-calling** for structured data (calendar/tasks) — precise local DB queries, no hallucination.
  3. **Local RAG** for free-text notes — on-device embeddings + local vector index (brute-force cosine at this scale; `sqlite-vec` only when needed).
  - **Pluggable providers:** local model (Ollama) / **BYOK** (user's own Claude/OpenAI key) / managed (paid). Default to a capable Claude model when a key is present.
- **Surfaces:** web → mobile (Capacitor) → desktop (Capacitor) → extension (WXT), all sharing `packages/engine` + `packages/ui`.
- **No blockchain:** secure transfer is solved by E2E-encrypted shared spaces; blockchain adds friction without benefit for personal/family sync.

# Cue

**The core monorepo for Cue — a local-first, zero-knowledge application for capturing, processing, and organizing what matters, with no account and no server able to read your data.**

This repository contains the shared engine, the shared interface components, and every platform application. It is the heart of the project; the organization-wide overview lives at [github.com/cuenest](https://github.com/cuenest).

---

## What is in this repository

Cue is built as a single monorepo rather than a separate repository per platform. All platform applications — web, desktop, mobile, and browser extension — depend on one shared engine and one shared interface library. A change to the core logic therefore applies everywhere at once, and a contributor needs to clone and install only one project to run the entire system.

This repository is open source. The hosted synchronization service and billing are kept in a separate, private repository (`cue-cloud`), because they constitute the business rather than the software. Everything that touches user data, and every feature, is here and runs on the user's device.

---

## Architecture

Cue is organized in layers, with a strict dependency direction: platform applications depend on the engine, never the reverse. The engine contains no interface code and makes no assumptions about how it is displayed or how it synchronizes.

```
  Surfaces            apps/web, apps/desktop, apps/mobile, apps/extension
  (React)             Thin platform shells. Render the engine; hold no business logic.
       |
       v
  Engine              packages/engine
  (TypeScript)        Queue and item model, replicated documents, identity,
                      encryption, and a pluggable synchronization interface.
       |
       v
  Storage             Per-device persistence of the replicated document.
       |
       v
  Sync transport      Local network, self-hosted node, or hosted relay.
  (pluggable)         Carries only encrypted data.
```

This separation is deliberate. Because the engine is independent of any interface and any transport, the same core can power four platforms and several synchronization modes without duplication, and contributors can work on the queue logic without touching cryptography, or on a platform shell without understanding the sync internals.

### Core concepts

- **Items and the queue.** Everything you capture is an item that begins in a single inbox. The engine presents items one at a time, oldest first, with the ability to promote any item to the front. Each item is resolved by exactly one action: complete, schedule, delegate, or drop.
- **Local-first replicas.** Each device holds a complete copy of the data, modeled as a conflict-free replicated data type. Edits made independently — including offline — merge deterministically when devices reconnect. No central server is required for correctness.
- **Zero-knowledge identity and sync.** Identity is a key pair generated on the device; there is no account. Devices are linked by exchanging keys through a scanned QR code. Synchronized data is encrypted before it leaves the device, so any relay forwards only data it cannot read.

---

## Repository structure

```
cue/
  packages/
    engine/        Shared core logic. No interface, no network assumptions.
    ui/            Shared React components used by every surface.
  apps/
    web/           Browser application (the first surface).
    desktop/       Windows, macOS, and Linux application.
    mobile/        iOS and Android application.
    extension/     Browser extension for quick capture.
    hub/           Headless, self-hostable synchronization node.
```

| Package or application | Responsibility |
| --- | --- |
| `packages/engine` | The item and queue model, replicated documents, identity, encryption, and the synchronization interface. The most isolated and most testable part of the system, and the recommended place to begin contributing. |
| `packages/ui` | Presentation-only React components — capture input, the focus view, the inbox list — shared across all surfaces. |
| `apps/web` | The browser application, and the first platform to be built. Persists locally and runs entirely offline. |
| `apps/desktop` | A native desktop build of the shared interface, with a global capture shortcut. A desktop left running is a natural always-on node for a household. |
| `apps/mobile` | A native mobile build, integrating with the system share sheet and camera for device linking. |
| `apps/extension` | Quick capture from any web page, reusing the shared components. |
| `apps/hub` | A user-runnable node with no interface that relays encrypted data between devices and retains an encrypted backup. The free alternative to the hosted relay. |

---

## Getting started

> The project is in early development. The workspace is being scaffolded as part of the first phase; the commands below describe the intended developer workflow.

### Prerequisites

- Node.js (current LTS) and the pnpm package manager.

### Install and run

```bash
git clone https://github.com/cuenest/cue.git
cd cue
pnpm install        # install all workspace dependencies
pnpm dev            # run the web application in development
pnpm test           # run the test suite
```

A single install brings up the entire workspace. You do not need to install or build packages individually.

---

## Development

### Where to make changes

- Logic that defines behavior — how the queue orders items, how documents merge, how data is encrypted — belongs in `packages/engine`.
- Anything visual belongs in `packages/ui` or in a specific application under `apps/`.
- Platform applications should remain thin: they render the engine and the shared components, and contain as little logic of their own as possible.

### Conventions

- The engine must not import React, access the DOM, or assume a network. If a change to the engine seems to need any of those, the design needs revisiting.
- Local-first and zero-knowledge behavior are requirements, not options. No feature may depend on a server being able to read user data.
- The codebase is TypeScript throughout. Match the style of the surrounding code.

### Testing

The engine is composed of pure logic over a replicated document and is tested directly, without an interface. Ordering rules, the four processing actions, document merges across replicas, and encryption round-trips are all unit-testable in isolation. New engine behavior should be developed test-first.

---

## Project status and roadmap

Cue is in early development. The work is divided into phases, each independently usable.

| Phase | Scope | State |
| --- | --- | --- |
| 0 | Single-device capture and the processing queue | In progress |
| 1 | Multi-device synchronization, QR linking, and the self-hosted node | Planned |
| 2 | Master calendar with multi-source import | Planned |
| 3 | Shared spaces, per-person permissions, and secure file transfer | Planned |
| 4 | On-device assistant | Planned |

---

## Contributing

Contributions are welcome. The shared engine is the most approachable entry point, since its logic stands alone. Please read the organization-wide [contributing guidelines](https://github.com/cuenest/.github/blob/main/CONTRIBUTING.md), and open an issue to discuss substantial changes before submitting a pull request.

---

## License

This repository is intended to be released under the GNU Affero General Public License v3.0, which keeps the project open even when it is run as a network service. The hosted service in `cue-cloud` is proprietary. Final license terms are being confirmed prior to the first public release.

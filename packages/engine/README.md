# @cue/engine

The shared **brain** of Cue — pure TypeScript, no UI, no platform assumptions. Every surface imports this.

**Owns:** Item/queue model & ordering (FIFO + manual bump), CRDT documents (Yjs), and — in Phase 1 — identity (keypair), QR linking (ECDH), encryption, and the pluggable sync transport.

**Must not contain:** React, DOM, or any network/platform code. Surfaces and transports layer on top.

Status: not implemented — Phase 0 starts here (`store` + `queue`).

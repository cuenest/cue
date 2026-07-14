---
name: verify
description: Build, launch, and drive Cue's web app + hub to verify changes end-to-end in the running app.
---

# Verifying Cue changes at runtime

## Launch

Two dev servers, both needed for any sync/files flow (from the repo parent dir, launch.json lives at `../.claude/launch.json`):

- `pnpm -C cue --filter @cue/hub dev` → ws+http on **:4444**
- `pnpm -C cue --filter @cue/web dev` → Vite on **:5178** (strictPort)

Settings view: `http://localhost:5178/#settings` (hash routing).

## Driving flows

- **Create personal sync space**: Settings → hub field defaults to `ws://localhost:4444` → "Create sync space" → badge flips to CONNECTED, room id shown truncated.
- **Link code**: "Link a device" reveals QR + `cue1.…` code. Decode payload: strip `cue1.`, base64url→JSON. v1 = never rotated; v2 = `{v:2,cur,keys:[{e,k,r}]}`.
- **Rotate key**: "Rotate key…" → inline confirm → "Rotate now". Expect: room id changes, still CONNECTED, link code auto-shown as v2.
- **File upload**: the file input is hidden; deliver a file via JS (`DataTransfer` + `dispatchEvent(new Event('change', {bubbles:true}))` on `input[aria-label="Add file"]`). Real upload path runs against the hub.
- **Replication status**: file row badge — `HUB ONLY` (warn) → "Keep offline" → `HUB + THIS DEVICE`. Same button unpins.
- **Room fallback after rotation**: unpin a pre-rotation file, click Download, then read the network log: expect `GET /blob/<new-room>/<hash> → 404` followed by `GET /blob/<old-room>/<hash> → 200` and no UI error.
- **Envelope on the wire**: fetch a chunk from `http://localhost:4444/blob/<room>/<hash>` (CORS is open); first byte `0x01` = pre-epoch, `0x02` = epoch envelope with epoch as BE uint32 at offset 1.

## Gotchas

- Browser-pane screenshots can time out; `read_page` / `get_page_text` work fine.
- Synthetic Enter (CDP key event) does **not** submit the Capture form — the value lands in the input but `runCapture` never fires. Their RTL tests with `userEvent.keyboard('{Enter}')` pass, so it's a synthetic-event quirk, not an app bug. Don't use Capture as a verification signal from the driver; use Files/Settings flows instead.
- Chunk hash = base64url(SHA-256(plaintext)) — recompute it to locate a chunk on the hub when you know the bytes you uploaded.
- App state persists in the profile (localStorage + IndexedDB). "Leave sync space" resets sync config for a fresh run.

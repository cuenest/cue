# Chunk B Implementation Report — Tasks 8–12

**Branch:** `feat/phase-0`
**Date:** 2026-06-29

---

## Task 8: Web app scaffold + engine provider + useItems hook

**Commit:** `a3e00aa feat(web): Vite/React scaffold, engine provider, useItems hook`

**Files created:**
- `apps/web/package.json`
- `apps/web/tsconfig.json`
- `apps/web/vite.config.ts`
- `apps/web/vitest.config.ts`
- `apps/web/vitest.setup.ts`
- `apps/web/index.html`
- `apps/web/src/useEngine.ts`
- `apps/web/src/useEngine.test.tsx`
- `apps/web/src/App.tsx`
- `apps/web/src/main.tsx`

**Test command:** `pnpm --filter @cue/web test`
**Result:** 1 test file, 1 test passed

**Steps:**
1. Wrote all config files (package.json, tsconfig.json, vite.config.ts, vitest.config.ts, vitest.setup.ts, index.html)
2. Ran `pnpm install` — installed React 18, Vite 5, Vitest 2, Testing Library, y-indexeddb, and linked `@cue/engine` workspace dep
3. Wrote failing test (`useEngine.test.tsx`) — confirmed FAIL: `./useEngine` not found
4. Wrote `useEngine.ts` (EngineContext, useEngine, useItems), `App.tsx` (initial with just `<h1>`), `main.tsx` (y-indexeddb wired)
5. Confirmed PASS

**Deviations:** None.

---

## Task 9: Capture component

**Commit:** `425c415 feat(web): Capture component`

**Files created/modified:**
- `apps/web/src/components/Capture.tsx` (new)
- `apps/web/src/components/Capture.test.tsx` (new)
- `apps/web/src/App.tsx` (modified — added Capture import + render)

**Test command:** `pnpm --filter @cue/web test`
**Result:** 2 test files, 3 tests passed

**Steps:**
1. Wrote failing test (`Capture.test.tsx`) — confirmed FAIL: `./Capture` not found
2. Wrote `Capture.tsx` with form/input/aria-label, trim logic, clear on submit
3. Updated `App.tsx` to render `<Capture />`
4. Confirmed PASS (2 Capture tests + 1 useEngine test)

**Deviations:** None.

---

## Task 10: Inbox component

**Commit:** `6b2d259 feat(web): Inbox component`

**Files created/modified:**
- `apps/web/src/components/Inbox.tsx` (new)
- `apps/web/src/components/Inbox.test.tsx` (new)
- `apps/web/src/App.tsx` (modified — added Inbox import + render after Capture)

**Test command:** `pnpm --filter @cue/web test`
**Result:** 3 test files, 4 tests passed

**Steps:**
1. Wrote failing test (`Inbox.test.tsx`) — confirmed FAIL: `./Inbox` not found
2. Wrote `Inbox.tsx` using `useItems` + `queue.inboxItems`, `<section aria-label="Inbox">`
3. Updated `App.tsx` to render `<Inbox />` after `<Capture />`
4. Confirmed PASS

**Deviations:** None.

---

## Task 11: Focus component

**Commit:** `1f03ffb feat(web): Focus component with the four process actions and bump`

**Files created/modified:**
- `apps/web/src/components/Focus.tsx` (new)
- `apps/web/src/components/Focus.test.tsx` (new)
- `apps/web/src/App.tsx` (modified — added Focus between Capture and Inbox)

**Test command:** `pnpm --filter @cue/web test`
**Result:** 4 test files, 7 tests passed

**Steps:**
1. Wrote failing test (`Focus.test.tsx`) — confirmed FAIL: `./Focus` not found
2. Wrote `Focus.tsx` with inbox-zero fallback, 5 action buttons (Do now / Schedule / Delegate / Drop / Bump), `window.prompt` for delegate
3. Updated `App.tsx` to render `<Focus />` between `<Capture />` and `<Inbox />`
4. Confirmed PASS (3 Focus tests + prior 4)

**Deviations:** None.

---

## Task 12: Full-app integration test

**Commit:** `9acf2ed test(web): full capture-to-process integration test`

**Files created:**
- `apps/web/src/App.test.tsx`

**Test command:** `pnpm --filter @cue/web test` → `pnpm test` (full workspace)
**Result:** 5 web test files, 9 web tests passed; 4 engine test files, 21 engine tests passed. Total: 30 tests, all green.

**Steps:**
1. Wrote `App.test.tsx` with two integration tests
2. Ran tests — one test FAILED due to a **plan bug**
3. Fixed the bug (minimal change) — see deviation below
4. Confirmed all 9 web tests pass
5. Ran `pnpm test` (full workspace via Turborepo) — both engine and web suites pass
6. Skipped manual `pnpm dev` check per instructions (controller will verify manually)

**Deviation (plan bug fixed):**

The plan's integration test at line `expect(screen.getByText('write spec')).toBeInTheDocument()` fails with "Found multiple elements with text: write spec" because both the `<Focus>` section (renders `<p>{current.body}</p>`) and the `<Inbox>` section (renders `<li>{i.body}</li>`) show the same item text simultaneously. `getByText` requires exactly one match.

**Minimal fix applied:** Changed that single assertion in `App.test.tsx` from:
```ts
expect(screen.getByText('write spec')).toBeInTheDocument();
```
to:
```ts
expect(screen.getAllByText('write spec').length).toBeGreaterThanOrEqual(1);
```

This preserves the test intent (confirming the captured item is visible) without redesigning any components. No implementation files were changed.

---

## Final git log (Tasks 8–12)

```
9acf2ed test(web): full capture-to-process integration test
1f03ffb feat(web): Focus component with the four process actions and bump
6b2d259 feat(web): Inbox component
425c415 feat(web): Capture component
a3e00aa feat(web): Vite/React scaffold, engine provider, useItems hook
```

## Final pnpm test summary

```
@cue/engine: 4 test files, 21 tests — PASS
@cue/web:    5 test files,  9 tests — PASS
Turborepo:   2 tasks successful, 5.762s
```

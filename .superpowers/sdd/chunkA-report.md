# Chunk A Report: Engine Package Tasks 1–7

## Task 1: Workspace + engine package scaffold

**Commit:** `01f6957` — `chore: scaffold pnpm/turborepo workspace and @cue/engine package`

**Test command:** `pnpm --filter @cue/engine test`
**Result:** 1 passed (smoke.test.ts — exports a version string)

**Deviations from plan:**
- Root `package.json` uses `"packageManager": "pnpm@10.30.2"` instead of the plan's `"pnpm@9.0.0"` as instructed in the task rules (installed pnpm is 10.30.2; a mismatch would break corepack).

---

## Task 2: Item types + CueStore create/read

**Commit:** `4dfcd7c` — `feat(engine): Item types and CueStore create/read`

**Test command:** `pnpm --filter @cue/engine test`
**Result:** 4 passed (smoke: 1, store: 3)

**Deviations:** None.

---

## Task 3: CueStore update + subscribe

**Commit:** `016445f` — `feat(engine): CueStore update and subscribe`

**Test command:** `pnpm --filter @cue/engine test`
**Result:** 7 passed (smoke: 1, store: 6)

**Deviations:** None.

---

## Task 4: Queue ordering (FIFO)

**Commit:** `06fccd3` — `feat(engine): FIFO queue selection`

**Test command:** `pnpm --filter @cue/engine test`
**Result:** 11 passed (smoke: 1, queue: 4, store: 6)

**Deviations:** None.

---

## Task 5: Bump order

**Commit:** `bb478e6` — `feat(engine): bump order computation`

**Test command:** `pnpm --filter @cue/engine test`
**Result:** 13 passed (smoke: 1, queue: 6, store: 6)

**Deviations:** None.

---

## Task 6: Engine facade (createEngine) with snapshot caching

**Commit:** `b0e4406` — `feat(engine): createEngine facade with cached snapshot`

**Test command:** `pnpm --filter @cue/engine test`
**Result:** 16 passed (smoke: 1, queue: 6, store: 6, engine: 3)

**Deviations:**
- The plan says "Replace the entire contents of `packages/engine/src/index.ts`" with a new file that has no `VERSION` export. However, `smoke.test.ts` (created in Task 1) imports `VERSION` from `./index`. Replacing the file without keeping `VERSION` caused the smoke test to fail. Fix: added `export const VERSION = '0.0.0';` to the new index.ts. This is a minimal preservation — no redesign.

---

## Task 7: The four process actions + bump on the engine

**Commit:** `00faa4e` — `feat(engine): process actions (do/schedule/delegate/drop) and bump`

**Test command:** `pnpm --filter @cue/engine test`
**Result:** 21 passed (smoke: 1, queue: 6, store: 6, engine: 8)

**Deviations:** None.

---

## Final engine suite

Command: `pnpm --filter @cue/engine test`

```
 ✓ src/queue.test.ts (6 tests)
 ✓ src/store.test.ts (6 tests)
 ✓ src/engine.test.ts (8 tests)
 ✓ src/smoke.test.ts (1 test)

 Test Files  4 passed (4)
       Tests  21 passed (21)
    Start at  22:36:26
    Duration  659ms
```

---

## Git log (7 new commits)

```
00faa4e feat(engine): process actions (do/schedule/delegate/drop) and bump
b0e4406 feat(engine): createEngine facade with cached snapshot
bb478e6 feat(engine): bump order computation
06fccd3 feat(engine): FIFO queue selection
016445f feat(engine): CueStore update and subscribe
4dfcd7c feat(engine): Item types and CueStore create/read
01f6957 chore: scaffold pnpm/turborepo workspace and @cue/engine package
```

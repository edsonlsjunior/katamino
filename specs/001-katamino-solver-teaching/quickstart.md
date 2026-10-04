# Quickstart: Validating the Katamino Teaching App

This is a runnable validation guide, not an implementation guide — it proves the feature
works end-to-end once the tasks in `tasks.md` are implemented. It references
[data-model.md](./data-model.md) and [contracts/](./contracts) instead of duplicating
their detail.

## Prerequisites

- Node.js 20 LTS and npm installed
- Repository cloned, on branch `001-katamino-solver-teaching`

## Setup

```bash
npm install
npm run dev
```

Open the printed local URL in a browser. Per SC-005, the app should be interactive
(challenge list visible, ready to pick a challenge) within ~3 seconds.

## Scenario 1 — Manual play (User Story 1, P1)

1. From the challenge list, select any challenge.
2. Select a piece from the tray, use the rotate/flip controls, then click a board cell to
   place it.
   - **Expected**: the piece appears on the board at the chosen cell.
3. Attempt to place a piece so it overlaps an already-placed piece, or extends past the
   board edge.
   - **Expected**: the app rejects the placement and shows immediate visual feedback
     (per FR-004 / SC-006 — this should be distinguishable from a valid placement without
     reading instructions).
4. Continue placing all required pieces until the board is completely, validly filled.
   - **Expected**: the app confirms the challenge as solved (FR-005).
5. Click "reset" mid-attempt on a different challenge.
   - **Expected**: the board returns to empty (FR-006).
6. Reload the browser tab (or fully close and reopen it) after solving a challenge.
   - **Expected**: the challenge list still shows that challenge as completed
     (FR-007 / SC-004) — validates the [persistence contract](./contracts/persistence-contract.md).

## Scenario 2 — Watch an algorithm solve step by step (User Story 2, P2)

1. Select any challenge, then trigger automatic solving with the "backtracking"
   strategy.
   - **Expected**: the app shows a sequence of discrete piece placement/removal steps,
     not the finished board immediately (FR-010); the first step should appear quickly or
     a visible "computing" indicator is shown (SC-007) — validates the streaming
     guarantee in [solver-worker-protocol.md](./contracts/solver-worker-protocol.md).
2. While it plays, click pause.
   - **Expected**: playback stops and the board holds its current in-progress state
     (FR-011).
3. While paused, step forward one step, then step backward one step.
   - **Expected**: the board updates by exactly one placement or removal each time
     (FR-011).
4. Let playback run (or skip) to completion.
   - **Expected**: the board is fully and validly solved, matching the same win
     condition as Scenario 1 (Acceptance Scenario US2#4).
5. Adjust the playback speed control and resume.
   - **Expected**: step advancement rate visibly changes (FR-012).

## Scenario 3 — Compare strategies (User Story 3, P3)

1. Run Scenario 2 on a given challenge with the "backtracking" strategy; note the total
   step count and backtrack count shown during/after playback (FR-013).
2. Reset and run the same challenge with the "constraint-guided" strategy.
   - **Expected**: the displayed step count and/or backtrack count differ visibly from
     the first run (SC-003), and each strategy shows its own short plain-language
     description (FR-017).
3. Switch the interface language (PT ⇄ EN) via the language control.
   - **Expected**: interface labels and the strategy descriptions/educational text all
     switch language together (FR-018 / SC-008).

## Automated validation

```bash
npm run test:unit        # domain logic + both solvers (Vitest) — includes step-log
                          # determinism checks from solver-worker-protocol.md
npm run test:integration # store/component integration (Vitest + Testing Library)
npm run test:e2e         # Playwright: Scenarios 1-3 above, desktop + a mobile viewport
npm run verify:challenges # scripts/generate-challenges solvability check — all 500
                          # challenges solvable by both strategies (FR-014 / SC-002)
```

All four MUST pass (Constitution II: full suite green before merge).

## Production build sanity check (GitHub Pages target)

```bash
npm run build
npm run preview
```

Open the preview URL and re-run Scenario 1 at minimum, to confirm the static production
build behaves identically to dev (no server-only behavior was accidentally relied upon —
FR-015).

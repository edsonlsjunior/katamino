---

description: "Task list for Katamino Combinatorial Optimization Teaching App"
---

# Tasks: Katamino Combinatorial Optimization Teaching App

**Input**: Design documents from `/specs/001-katamino-solver-teaching/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Included. Constitution II (Testing Standards) makes test-first the default
workflow for non-trivial logic and requires a green suite before merge; plan.md and
quickstart.md already commit to Vitest + Testing Library + Playwright + a
challenge-solvability check as the project's testing strategy, so test tasks are part of
each user story rather than optional.

**Organization**: Tasks are grouped by user story (spec.md priorities P1/P2/P3) to enable
independent implementation and testing of each story. Per spec.md, User Story 2 reuses
the board/challenge-selection infrastructure built for User Story 1, and User Story 3
reuses the single-strategy playback infrastructure built for User Story 2 — this is an
explicit dependency noted in the spec itself ("It depends on challenges and a board
already existing (User Story 1)..."), not an accidental coupling.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Single static frontend project at the repository root, per plan.md's Project Structure:
`src/`, `scripts/`, `tests/unit/`, `tests/integration/`, `tests/e2e/` at repo root.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic tooling

- [X] T001 Initialize the Vite + React + TypeScript project at the repository root (`package.json`, `tsconfig.json` in strict mode, `vite.config.ts` with the correct GitHub Pages `base` path per research.md §11)
- [X] T002 [P] Configure ESLint + Prettier as the formatting source of truth with a zero-warning gate in `.eslintrc.cjs`/`eslint.config.js` and `.prettierrc` (Constitution I)
- [X] T003 [P] Configure Vitest + @testing-library/react for unit/integration tests in `vitest.config.ts`
- [X] T004 [P] Configure Playwright with a desktop and a small mobile-viewport project in `playwright.config.ts` (FR-016)
- [X] T005 [P] Scaffold the GitHub Actions workflow file for build + Pages deploy in `.github/workflows/deploy.yml` (research.md §11)
- [X] T006 Create the base folder structure per plan.md: `src/domain/`, `src/solvers/`, `src/workers/`, `src/data/`, `src/state/`, `src/components/`, `src/app/`, `src/i18n/`, `src/styles/`, `scripts/generate-challenges/`, `tests/unit/`, `tests/integration/`, `tests/e2e/`

**Checkpoint**: Toolchain runs (`npm run dev`, `npm run lint`, `npm run test:unit` all execute, even with no real code yet)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core domain model, data, and app shell that every user story is built on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T007 Implement the pentomino domain model (12 `PieceType`s, `baseShape`, deduplicated `orientations` for rotate/flip) in `src/domain/pentomino.ts` per data-model.md "Pentomino / PieceType"
- [X] T008 Implement the `Board` domain model (grid creation, in-bounds/overlap placement validation, solved-check) in `src/domain/board.ts` per data-model.md "Board"
- [X] T009 [P] Define shared domain TypeScript types (`Challenge`, `PieceInstance`, `SolveStep`, etc.) in `src/domain/types.ts` per data-model.md
- [X] T010 [P] Implement `scripts/generate-challenges` to produce the 500-challenge dataset (5×k boards, required-piece multisets) conforming to `contracts/challenge-data.schema.json`, writing `src/data/challenges.json`
- [X] T011 [P] Implement the challenge data loader with runtime schema validation in `src/data/loadChallenges.ts` per `contracts/challenge-data.schema.json`
- [X] T012 [P] Set up i18next + react-i18next with PT/EN resource files for shared UI chrome (nav, common actions, errors) in `src/i18n/`
- [X] T013 [P] Implement the persistence module (progress read/write, language read/write, defensive fallback on missing/corrupt/unavailable storage) in `src/state/persistence.ts` per `contracts/persistence-contract.md`
- [X] T014 Implement the app shell, routing between challenge selection / manual play / auto-solve screens, and a language switcher wired to `src/state/persistence.ts` in `src/app/App.tsx` (depends on T012, T013)

**Checkpoint**: Domain model, challenge dataset, i18n, and persistence are all in place — user story implementation can now begin

---

## Phase 3: User Story 1 - Play challenges manually (Priority: P1) 🎯 MVP

**Goal**: A visitor can browse the 500 challenges, manually place/rotate/flip pieces on a
board with invalid-placement feedback, get a solved confirmation, reset an attempt, and
have completion status persist across visits.

**Independent Test**: Open the app, select a challenge, place all required pieces to
fully and validly fill the board, and confirm the app recognizes it as solved; verify an
overlapping/out-of-bounds placement is rejected with visible feedback; verify reset
clears the board; verify completion persists after a reload.

### Tests for User Story 1 ⚠️

> Write these tests FIRST, ensure they FAIL before implementation

- [X] T015 [P] [US1] Unit tests for placement validation (valid / overlap / out-of-bounds) and solved-detection in `tests/unit/domain/board.test.ts`
- [X] T016 [P] [US1] Unit tests for pentomino orientation transforms (rotation/flip correctness, dedup count per piece) in `tests/unit/domain/pentomino.test.ts`
- [X] T017 [P] [US1] Integration tests for the manual-attempt store (place/remove/reset/isSolved transitions) in `tests/integration/state/manualAttempt.test.ts`
- [X] T018 [P] [US1] Playwright E2E covering Scenario 1 from quickstart.md (select, place, invalid feedback, solve, reset, reload-persists) in `tests/e2e/manual-play.spec.ts`

### Implementation for User Story 1

- [X] T019 [P] [US1] Implement `ChallengeList` component (browse/select any of the 500 challenges) in `src/components/ChallengeList.tsx` (FR-002)
- [X] T020 [P] [US1] Implement `Board` rendering component (grid + placed pieces) in `src/components/Board.tsx`
- [X] T021 [P] [US1] Implement `PieceTray` component (select a piece, rotate/flip controls) in `src/components/PieceTray.tsx` (FR-003)
- [X] T022 [US1] Implement the `ManualAttempt` Zustand store (select/rotate/flip/place/remove/reset/isSolved) in `src/state/manualAttempt.ts` (depends on T007, T008, T009)
- [X] T023 [US1] Wire select-then-place interaction and invalid-placement visual feedback between `Board` and `PieceTray` (FR-003, FR-004, SC-006) (depends on T020, T021, T022)
- [X] T024 [US1] Implement the solved-confirmation success state (e.g., `src/components/SolvedBanner.tsx`) (FR-005)
- [X] T025 [US1] Implement the reset control wired to `ManualAttempt` (FR-006)
- [X] T026 [US1] Wire completion persistence: write to `src/state/persistence.ts` when `isSolved` becomes true, read it to badge completed challenges in `ChallengeList` (FR-007, SC-004) (depends on T013, T019, T022)
- [X] T027 [US1] Add PT/EN copy for challenge list, board, piece tray, and solved/invalid feedback in `src/i18n/` resource files (FR-018)
- [X] T028 [US1] Assemble the manual-play screen composing `ChallengeList` + `Board` + `PieceTray` + persistence in `src/app/ManualPlayPage.tsx`

**Checkpoint**: User Story 1 is fully functional and independently testable (MVP)

---

## Phase 4: User Story 2 - Watch an algorithm solve a challenge step by step (Priority: P2)

**Goal**: A visitor can trigger automatic solving on a selected challenge and watch the
backtracking algorithm's search unfold as discrete, controllable playback steps.

**Independent Test**: Select any challenge, trigger automatic solving, and confirm the
app visibly replays a sequence of individual piece placement/removal steps (with
pause/step-forward/step-backward/resume) ending in a fully solved board.

### Tests for User Story 2 ⚠️

- [X] T029 [P] [US2] Unit tests for the backtracking solver (correctness on sample challenges, well-formed/deterministic step log) in `tests/unit/solvers/backtracking.test.ts`
- [X] T030 [P] [US2] Unit tests for the solver Web Worker message protocol (request supersession, ordered `step` events, terminal `done`/`error`) in `tests/unit/workers/solverProtocol.test.ts` per `contracts/solver-worker-protocol.md`
- [X] T031 [P] [US2] Playwright E2E covering Scenario 2 from quickstart.md (start solve, computing indicator, pause, step forward/back, resume, completes solved) in `tests/e2e/solver-playback.spec.ts`

### Implementation for User Story 2

- [X] T032 [US2] Implement the exhaustive backtracking solver as a step-logging generator in `src/solvers/backtracking.ts` (research.md §6) (depends on T007, T008, T009)
- [X] T033 [US2] Implement the Web Worker entry point and message protocol types in `src/workers/solver.worker.ts` and `src/workers/protocol.ts` per `contracts/solver-worker-protocol.md` (depends on T032)
- [X] T034 [US2] Implement the `SolveRun`/playback Zustand store with the `idle → computing → playing → paused → complete → error` state machine in `src/state/playback.ts` (depends on T033)
- [X] T035 [US2] Implement `PlaybackControls` component (play/pause/step forward/step backward/reset/speed) in `src/components/PlaybackControls.tsx` (FR-011, FR-012)
- [X] T036 [US2] Extend `Board` to render the board state at the current playback step (reuse from US1) in `src/components/Board.tsx` (depends on T020, T034)
- [X] T037 [US2] Implement the "computing" / error UI states for a triggered solve in `src/components/SolverStatus.tsx` (Constitution III, SC-007)
- [X] T038 [US2] Assemble the auto-solve screen composing `ChallengeList` + `Board` + `PlaybackControls` + `SolverStatus` in `src/app/AutoSolvePage.tsx` (depends on T034, T035, T036, T037)
- [X] T039 [US2] Add PT/EN copy for playback controls and solver status in `src/i18n/` resource files (FR-018)

**Checkpoint**: User Stories 1 AND 2 both work independently

---

## Phase 5: User Story 3 - Compare solving strategies and learn the concepts (Priority: P3)

**Goal**: A visitor can choose between the two solving strategies, see supporting
combinatorial-optimization metrics (step count, backtrack count) and a plain-language
description while a solve plays, and compare two runs' behavior.

**Independent Test**: Run two different solving strategies on the same challenge and
confirm the app displays distinguishable behavior/metrics and a description for each.

### Tests for User Story 3 ⚠️

- [X] T040 [P] [US3] Unit tests for the constraint-guided (Dancing-Links-style) solver (correctness, deterministic step log) in `tests/unit/solvers/constraintGuided.test.ts`
- [X] T041 [P] [US3] Unit test asserting step count and/or backtrack count differ between the two strategies on sample challenges in `tests/unit/solvers/compareStrategies.test.ts`
- [X] T042 [P] [US3] Playwright E2E covering Scenario 3 from quickstart.md (strategy selection, comparison metrics, PT/EN switch) in `tests/e2e/strategy-comparison.spec.ts`

### Implementation for User Story 3

- [X] T043 [US3] Implement the constraint-guided/most-constrained-first (Dancing-Links-style exact cover) solver as a step-logging generator in `src/solvers/constraintGuided.ts` (research.md §7) (depends on T007, T008, T009)
- [X] T044 [US3] Register the constraint-guided solver in the Worker's strategy dispatch in `src/workers/solver.worker.ts` (depends on T033, T043)
- [X] T045 [US3] Implement `StrategySelector` component (choose backtracking vs. constraint-guided) in `src/components/StrategySelector.tsx` (FR-009)
- [X] T046 [US3] Extend the playback store to expose `totalSteps`/`backtrackCount`/strategy description in `src/state/playback.ts` (FR-013) (depends on T034)
- [X] T047 [US3] Implement `MetricsPanel` component (live step count, backtrack count, strategy description) in `src/components/MetricsPanel.tsx` (FR-013, FR-017)
- [X] T048 [US3] Implement `ComparisonPanel` component showing the last two runs' metrics side by side in `src/components/ComparisonPanel.tsx` (SC-003)
- [X] T049 [US3] Add plain-language PT/EN educational copy explaining each strategy and the combinatorial-optimization concepts it illustrates in `src/i18n/` resource files (FR-017, FR-018)
- [X] T050 [US3] Wire `StrategySelector`, `MetricsPanel`, and `ComparisonPanel` into the auto-solve screen in `src/app/AutoSolvePage.tsx` (depends on T038, T045, T046, T047, T048)

**Checkpoint**: All three user stories are independently functional

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Whole-app quality gates that span every user story

- [X] T051 [P] Implement the "all 500 challenges solvable by both strategies" verification test in `tests/verify/challengesSolvable.test.ts` (own Vitest config so it's excluded from the fast default suite), run as `npm run verify:challenges` (FR-014, SC-002) (depends on T010, T032, T043) — 1001/1001 assertions pass
- [X] T052 [P] Accessibility pass across `Board`, `PieceTray`, `PlaybackControls`, `StrategySelector` (keyboard operability, ARIA labels, color contrast) (Constitution III) — added `contrastTextColor` for readable piece-color text, `lang` attribute sync on language switch, semantic fieldset/legend/radio for strategy choice
- [X] T053 [P] Responsive/mobile-viewport layout pass for `Board`, `PieceTray`, `PlaybackControls` on small screens (FR-016) — verified via Playwright `mobile-chromium` project and manual mobile-viewport screenshots; fixed `StrategySelector` row layout
- [X] T054 Wire lint + unit + integration + e2e + `verify:challenges` into the CI workflow as a required PR gate (Constitution II, Quality & Performance Constraints) in `.github/workflows/ci.yml`
- [X] T055 Finalize the GitHub Pages deploy workflow and smoke-test the production build (`npm run build && npm run preview`) (research.md §11) — `.github/workflows/deploy.yml` gates on lint+unit before building; full Playwright e2e suite (10/10) re-verified against the production build
- [X] T056 Run the full quickstart.md validation (all three scenarios plus automated commands) end-to-end and record results

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational only
- **User Story 2 (Phase 4)**: Depends on Foundational; per spec.md, also builds on User Story 1's `Board`/`ChallengeList` components (T020, T019) being in place
- **User Story 3 (Phase 5)**: Depends on Foundational; per spec.md, also builds on User Story 2's Web Worker/playback infrastructure (T033, T034, T038) being in place
- **Polish (Phase 6)**: Depends on all desired user stories being complete (T051 specifically needs both solvers from US2 and US3)

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Domain/data before state stores; state stores before UI wiring; UI wiring before screen assembly
- Story complete before moving to the next priority (or proceed in parallel once Foundational is done, if staffed)

### Parallel Opportunities

- All Setup tasks marked [P] (T002-T005) can run in parallel after T001
- Foundational tasks T009-T013 marked [P] can run in parallel (T007, T008 first since T009's types and later tasks build on them; T014 needs T012+T013 done)
- All [P] tests within a story can run in parallel with each other
- T019, T020, T021 (US1 components) can run in parallel
- Different user stories can be staffed in parallel once their prerequisite story's blocking pieces (noted above) exist

---

## Parallel Example: User Story 1

```bash
# Tests for User Story 1, launched together:
Task: "Unit tests for placement validation in tests/unit/domain/board.test.ts"
Task: "Unit tests for pentomino orientation transforms in tests/unit/domain/pentomino.test.ts"
Task: "Integration tests for manual-attempt store in tests/integration/state/manualAttempt.test.ts"
Task: "Playwright E2E for manual play in tests/e2e/manual-play.spec.ts"

# Components for User Story 1, launched together:
Task: "Implement ChallengeList component in src/components/ChallengeList.tsx"
Task: "Implement Board rendering component in src/components/Board.tsx"
Task: "Implement PieceTray component in src/components/PieceTray.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: run `tests/e2e/manual-play.spec.ts` and quickstart.md Scenario 1 independently
5. Deploy/demo if ready (satisfies SC-001, SC-004, SC-005, SC-006 on their own)

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. Add User Story 1 → validate independently → deploy/demo (MVP!)
3. Add User Story 2 (reuses US1's Board/ChallengeList) → validate independently → deploy/demo
4. Add User Story 3 (reuses US2's Worker/playback) → validate independently → deploy/demo
5. Phase 6 polish (accessibility, mobile layout, CI gate, deploy hardening) → final release

### Parallel Team Strategy

1. Team completes Setup + Foundational together
2. One developer takes User Story 1 through to its checkpoint first (since US2 needs `Board`/`ChallengeList` and US3 needs the Worker/playback store from US2)
3. Once those specific prerequisite pieces land, US2 and US3 work can be staffed in parallel by different developers, converging at Phase 6

---

## Notes

- [P] tasks = different files, no unmet dependency
- [Story] label maps task to its user story for traceability
- Verify tests fail before implementing against them
- Commit after each task or logical group
- Stop at any checkpoint to validate a story independently
- Avoid: vague tasks, same-file conflicts between parallel tasks, cross-story dependencies beyond the spec-acknowledged ones noted above

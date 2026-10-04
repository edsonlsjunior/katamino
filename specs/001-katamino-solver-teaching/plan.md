# Implementation Plan: Katamino Combinatorial Optimization Teaching App

**Branch**: `001-katamino-solver-teaching` | **Date**: 2026-08-09 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-katamino-solver-teaching/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

A static, client-only web app (hostable on GitHub Pages) that lets visitors play all 500
Katamino pentomino challenges by hand, or watch either of two solving algorithms
(exhaustive backtracking vs. a constraint-guided/heuristic search) replay their search
step by step, with playback controls, comparative metrics, and bilingual (PT/EN)
plain-language explanations connecting the visualization to combinatorial optimization
concepts. Technical approach: a React + TypeScript SPA built with Vite, pure-function
domain logic for pentomino transforms/board validation, both solvers implemented as
step-logging generators executed inside a Web Worker (keeping the UI thread responsive
per Constitution IV), challenge data and per-user completion progress stored entirely in
the browser (static JSON + localStorage — no backend, per FR-015).

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode), Node.js 20 LTS for the build toolchain only (nothing Node-specific ships to the browser)

**Primary Dependencies**: React 18 (UI), Vite 5 (build/static output for GitHub Pages), Zustand (lightweight client state for board/attempt/playback state), react-i18next + i18next (PT/EN i18n), no drag-and-drop library — piece placement uses tap/click-to-select + click-to-place plus explicit rotate/flip controls (see research.md for rationale)

**Storage**: Browser `localStorage` only — per-challenge completion status (FR-007) and last-used language preference; no server-side storage; challenge definitions ship as static generated JSON bundled with the app

**Testing**: Vitest + @testing-library/react (unit/component/integration), Playwright (browser E2E: manual solve, solver playback, i18n switching, mobile viewport checks); a Node script asserts all 500 challenges are solvable by both solvers as part of the test suite (verifies FR-014 / SC-002)

**Target Platform**: Static site served from GitHub Pages; evergreen desktop browsers (Chrome, Firefox, Safari, Edge) and mobile/touch browsers (iOS Safari, Android Chrome)

**Project Type**: Web — single static frontend project, no backend service

**Performance Goals**: App interactive within 3s on typical broadband (SC-005); piece select/rotate/flip/place UI feedback within ~100ms (60fps feel, Constitution IV); automatic solve's first visible step appears within ~1s or a visible "working" indicator is shown (SC-007); playback stepping (forward/back/play) renders each step within one animation frame budget

**Constraints**: Must run fully client-side with no backend (FR-015); solver execution MUST NOT block the UI thread — both solvers run inside a Web Worker and stream step events back for playback (Constitution IV); works on small mobile viewports (FR-016, edge case on small screens); solvers must terminate and reveal every step for a solve up to the largest board (5×12, 12 pieces) within an interactive time budget

**Scale/Scope**: 500 challenges; 12 standard free pentomino piece types (F, I, L, N, P, T, U, V, W, X, Y, Z), each with up to 8 orientations (4 rotations × mirror), fewer for symmetric pieces; board is a fixed-height 5-row grid whose width equals the challenge's required piece count (3–12 columns — 2 is excluded because no pair of distinct pentominoes tiles a 5×2 rectangle, confirmed empirically during dataset generation), matching the physical Katamino tray

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Plan compliance | Status |
|---|---|---|
| I. Code Quality | TypeScript strict mode + ESLint + Prettier as the formatting source of truth, zero-warning CI gate; domain logic (pentomino transforms, board validation, solvers) isolated in small single-responsibility modules under `src/domain` and `src/solvers`, independent of UI framework code; self-review checklist applied per commit since this is currently solo work | PASS |
| II. Testing Standards | Test-first for all domain/solver logic (Vitest): transforms, board validity, both solvers' correctness and step-log integrity, before wiring to UI; regression tests added for any bug fix; Playwright E2E covers the three user stories; a deterministic "all 500 challenges solvable" check runs in the suite | PASS |
| III. UX Consistency | Single shared component set (Board, PieceTray, PlaybackControls, ChallengeList, Modal/Toast feedback) reused across manual play and solver playback so interactions/terminology match; all interactive features define loading/empty/error/success states (e.g., solver "computing first step", invalid-placement feedback, solved confirmation); keyboard operability and color contrast considered for the piece palette and board from the start; i18n copy centralized so PT/EN stay consistent | PASS |
| IV. Performance Requirements | Explicit frame/latency budgets stated above; solver work is asynchronous via a Web Worker with streamed progress, never blocking the UI thread; solver complexity documented in research.md; performance-sensitive claims (first-step latency, step playback smoothness) verified with Playwright timing assertions, not guesswork | PASS |

No violations identified — Complexity Tracking table is left empty.

## Post-Design Constitution Check

*Re-evaluated after Phase 1 (data-model.md, contracts/, quickstart.md).*

| Principle | Design confirms | Status |
|---|---|---|
| I. Code Quality | Data model (data-model.md) keeps `Challenge`/`Piece`/`Board`/`SolveRun`/`SolveStep` as small, single-purpose value types with no cross-cutting god objects; contracts define narrow module boundaries (challenge-data schema, solver-engine contract, persistence contract) that keep domain code framework-agnostic | PASS |
| II. Testing Standards | Contracts are written in a form directly testable by Vitest (solver engine contract: input/output/step-event shapes; persistence contract: storage key/shape); quickstart.md defines runnable validation scenarios per user story that double as E2E test outlines | PASS |
| III. UX Consistency | data-model.md's `Solve Step` / playback state machine (idle → computing → playing → paused → complete) gives one consistent vocabulary and state set reused by both solvers and by the UI's loading/empty/error/success states | PASS |
| IV. Performance Requirements | Solver engine contract requires streaming step events (not a single blocking return) and running off the main thread, directly enforcing the async/non-blocking requirement at the design level, not just as an intention | PASS |

No new violations introduced by the design. Complexity Tracking remains empty.

## Project Structure

### Documentation (this feature)

```text
specs/001-katamino-solver-teaching/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
src/
├── domain/              # pure logic: pentomino shapes/orientations, board model, placement validation
├── solvers/             # backtracking solver + constraint-guided/DLX-style solver, shared step-log types
├── workers/             # Web Worker entry point wrapping solvers, posts SolveStep events back to the UI
├── data/                # generated 500-challenge JSON dataset + loader
├── state/               # Zustand stores: challenge progress, manual attempt, solve playback
├── components/          # Board, PieceTray, PlaybackControls, ChallengeList, shared UI primitives
├── app/                 # app shell, routing/screens, composition of components + stores
├── i18n/                # pt/en locale resource files, i18next setup
└── styles/

scripts/
└── generate-challenges/ # build-time generation of the 500 challenges + solvability verification script

public/                  # static assets for GitHub Pages

tests/
├── unit/                 # domain + solver logic (Vitest) — test-first per Constitution II
├── integration/           # store + component integration (Vitest + Testing Library)
└── e2e/                    # Playwright specs, one suite per user story (manual play, solver playback, strategy comparison)

index.html
vite.config.ts
package.json
tsconfig.json
```

**Structure Decision**: Single static frontend project at the repository root (no
backend/API — everything in FR-015 runs in the browser). This maps to the "single
project" layout rather than the frontend+backend web-application split, since there is
no server component. Domain logic (`src/domain`, `src/solvers`) is kept independent of
React so it can be unit-tested directly and reused unchanged inside the Web Worker
(`src/workers`).

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations were identified in either the initial or post-design Constitution Check —
this table is intentionally empty.

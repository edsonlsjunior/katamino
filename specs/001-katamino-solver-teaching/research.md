# Phase 0 Research: Katamino Combinatorial Optimization Teaching App

All items below were open technology/approach decisions in the Technical Context (the
feature spec itself had no remaining `NEEDS CLARIFICATION` markers — it was already
validated in the spec-quality checklist). Each entry follows Decision / Rationale /
Alternatives Considered.

## 1. Frontend framework & build tool

- **Decision**: React 18 + TypeScript, built and bundled as a static site with Vite 5.
- **Rationale**: Vite produces a pure static `dist/` output that deploys directly to
  GitHub Pages (FR-015) with no server. React's component model maps cleanly onto the
  app's reusable UI pieces (Board, PieceTray, PlaybackControls, ChallengeList) that
  Constitution III requires to be shared/consistent across manual play and solver
  playback. TypeScript strict mode supports Constitution I's readability/correctness bar.
- **Alternatives considered**: Plain Vue or Svelte (also static-friendly; rejected only
  because React has the deepest ecosystem for the testing-library/Playwright combo
  already standardized in Testing Standards); a framework-less Canvas/vanilla-TS app
  (rejected — would reinvent component composition and hurt Constitution I's
  maintainability bar for no real performance benefit at this app's scale).

## 2. Client state management

- **Decision**: Zustand for board/manual-attempt/solve-playback state.
- **Rationale**: The app's state (current challenge, placed pieces, playback position,
  language) is small and local to the browser tab — Zustand gives simple, testable
  stores without Redux's boilerplate or prop-drilling through React Context for
  frequently-updating board state (piece placement during playback needs fast,
  fine-grained updates).
- **Alternatives considered**: React Context + `useReducer` (rejected — re-render cost
  on every solve step during fast playback is worse, and it's harder to unit-test in
  isolation from React); Redux Toolkit (rejected — more ceremony than this scope needs,
  a dependency the Quality & Performance Constraints section would require extra
  justification for).

## 3. Piece manipulation interaction model

- **Decision**: Select-then-place: user taps/clicks a piece in the tray to select it
  (with rotate/flip buttons or keyboard shortcuts to change its orientation), then
  taps/clicks a board cell to place it. No drag-and-drop.
- **Rationale**: FR-016 requires desktop and mobile/touch usability, and FR-003 requires
  rotate/flip controls regardless. Tap-to-select/tap-to-place is far more reliable on
  small touch screens (edge case: small mobile viewport) than drag-and-drop, and it is
  natively keyboard-and-screen-reader operable, directly supporting Constitution III's
  accessibility requirement without extra work. It also avoids taking on a drag-and-drop
  dependency (react-dnd, dnd-kit) that the Quality & Performance Constraints section
  would require justifying.
- **Alternatives considered**: Drag-and-drop via `dnd-kit` (rejected — meaningfully worse
  touch ergonomics at small viewport sizes and adds a dependency and its own
  accessibility retrofitting cost); native HTML5 drag events (rejected — no touch support
  without a polyfill).

## 4. Internationalization (PT/EN)

- **Decision**: `react-i18next` + `i18next`, with locale resource files under `src/i18n`,
  keyed by feature area (nav, challenge list, board, playback, concept explanations).
- **Rationale**: FR-018 requires full interface + educational content in both languages
  with runtime switching; i18next is the standard, well-tested choice for this and
  supports lazy-loading namespaces if the explanatory content grows.
- **Alternatives considered**: Hand-rolled string-lookup object (rejected — reinvents
  pluralization/interpolation and language switching state management that i18next
  already solves correctly).

## 5. Persistence (completion progress)

- **Decision**: Browser `localStorage`, one JSON blob keyed by a stable app+version
  prefix (e.g., `katamino:v1:progress`), mapping challenge id → completion state.
  Language preference stored similarly. All reads are defensive (missing/corrupt data is
  treated as "no progress yet," never a crash).
- **Rationale**: FR-007 requires persistence across visits with no account, consistent
  with the "no backend" constraint (FR-015). The edge case "local storage unavailable or
  cleared" must degrade gracefully — a defensive read/parse with a safe fallback directly
  satisfies that.
- **Alternatives considered**: IndexedDB (rejected — unnecessary complexity for a small
  flat map of 500 boolean-ish completion records); cookies (rejected — unnecessary size
  limits and server-oriented semantics for data that never leaves the browser).

## 6. Solving Strategy (a): exhaustive backtracking search

- **Decision**: A recursive/iterative backtracking search over board cells in a fixed
  scan order (e.g., first empty cell, row-major): at each empty cell, try every
  unplaced piece in every orientation that covers that cell without overlap/out-of-bounds,
  recurse, and undo (backtrack) on dead ends. Every attempted placement and every
  undo/backtrack is emitted as a `SolveStep`.
- **Rationale**: This is the textbook exhaustive constructive-search approach and gives
  a clear, honest "tries things, undoes on dead ends" visualization for FR-009(a) and the
  teaching goal in FR-013/FR-017 — it's the natural baseline to contrast with strategy (b).
- **Alternatives considered**: Brute-force enumerate-all-placements-then-filter
  (rejected — does not produce a meaningful incremental step sequence for playback, and
  is far more wasteful).

## 7. Solving Strategy (b): constraint-guided/heuristic search

- **Decision**: An exact-cover formulation solved with Algorithm X / Dancing Links (DLX)
  style constraint propagation, choosing the most-constrained board cell or piece
  (minimum-remaining-values heuristic) at each step rather than a fixed scan order, so it
  prunes far more aggressively than strategy (a). Placement/removal of a piece under this
  strategy is likewise emitted as a `SolveStep`, so the same playback UI drives both.
- **Rationale**: Pentomino tiling is a classic exact-cover problem, and Algorithm X/DLX
  with a most-constrained-first heuristic is the standard, well-documented "smart search"
  approach — a legitimate, explainable contrast to plain backtracking for FR-009(b) and
  FR-013 (it visibly backtracks less and explores less of the space, which is the whole
  pedagogical point of comparing the two in User Story 3).
- **Alternatives considered**: Simulated annealing / genetic search (rejected — the
  "step" concept and "backtrack count" metric required by FR-013 don't map cleanly onto
  stochastic optimization, and it isn't guaranteed to find a solution, which conflicts
  with FR-014); plain backtracking with a different cell order only (rejected — too close
  to strategy (a) to give a genuinely distinguishable strategy per FR-009).

## 8. Keeping the UI thread responsive during solving

- **Decision**: Both solvers run inside a single reusable Web Worker
  (`src/workers`), which executes the solve to completion internally but streams every
  `SolveStep` back to the main thread via `postMessage` as it's generated (or in small
  batches), rather than blocking until the whole solve finishes. The UI stores the
  streamed steps and drives playback (play/pause/step/reset/speed) entirely from that
  already-computed step log — no further worker interaction is needed once a solve
  completes.
- **Rationale**: Constitution IV explicitly forbids long-running work blocking the UI
  thread and requires visible progress; large boards (5×12, 12 pieces) can have a large
  search space, matching the edge case about first-step latency. Streaming steps as they
  are produced lets the UI show a "computing…" state immediately and start playback as
  soon as enough steps exist, satisfying SC-007.
- **Alternatives considered**: `requestIdleCallback`/chunked main-thread execution
  (rejected — still competes with rendering and input handling, weaker isolation than a
  dedicated worker); running the solve fully synchronously and only presenting the
  final step array (rejected — directly violates Constitution IV and risks a frozen UI on
  larger boards).

## 9. Challenge dataset (500 challenges)

- **Decision**: Board height is fixed at 5 rows (matching the physical Katamino tray);
  board width equals the challenge's required piece count *k* (3–12; *k*=2 is skipped —
  verified empirically that no pair of distinct pentominoes tiles a 5×2 rectangle),
  since every pentomino covers 5 cells and a fully-packed 5×k board requires exactly k
  pieces. The
  12 standard free pentominoes (F, I, L, N, P, T, U, V, W, X, Y, Z) are the piece
  vocabulary; each of the 500 challenges specifies a required subset/order of pieces
  and, implicitly, the 5×k board. Challenge data is generated once at build time by a
  script (`scripts/generate-challenges`) into static JSON shipped with the app, and that
  same script (reused as a test) verifies every challenge is solvable by both solvers,
  covering FR-014/SC-002 without paying search cost at runtime for the dataset itself.
- **Rationale**: This matches how the physical commercial game actually works (a sliding
  gate sets tray length = piece count) and satisfies the Assumptions section's note that
  challenges are recreated from the official puzzle mechanics, not proprietary
  artwork/branding/text.
- **Alternatives considered**: Hand-authoring all 500 challenges as data (rejected —
  error-prone and doesn't guarantee solvability up front); variable board height
  (rejected — physical Katamino doesn't vary tray height, only length).

## 10. Testing strategy

- **Decision**: Vitest for domain logic and solver unit tests plus store/component
  integration tests (with @testing-library/react); Playwright for end-to-end coverage of
  each user story (manual solve/win/reset/persistence, automatic solve playback controls,
  strategy comparison) across a desktop and a small mobile viewport; a dedicated
  "all challenges solvable" script run as part of the automated suite.
- **Rationale**: Matches Constitution II (test-first for non-trivial logic, full suite
  green before merge) and gives direct, automatable coverage of the acceptance scenarios
  in spec.md.
- **Alternatives considered**: Jest instead of Vitest (rejected — slower with Vite's
  native ESM pipeline, no meaningful benefit here); Cypress instead of Playwright
  (rejected — Playwright's multi-browser + mobile-viewport emulation is a better fit for
  FR-016's desktop/mobile requirement).

## 11. Deployment to GitHub Pages

- **Decision**: A GitHub Actions workflow builds the Vite static output and publishes it
  to GitHub Pages on push to `main`; `vite.config.ts` sets the correct `base` path for the
  repository's Pages URL.
- **Rationale**: Directly satisfies the "hosted on github.io" input constraint and
  FR-015, with zero manual deployment steps once configured.
- **Alternatives considered**: Manual `gh-pages` branch publishing via a local script
  (rejected — less reliable/repeatable than CI-driven deploys, and Constitution's
  Quality & Performance Constraints already expects CI to gate every change).

## 12. Accessibility approach

- **Decision**: All interactive controls (piece selection, rotate/flip, board cells,
  playback controls, strategy/challenge selection) are real buttons/elements with
  keyboard focus support and ARIA labels; pentomino colors are chosen to meet contrast
  guidelines and are paired with shape/letter identity (not color alone) so placement
  state doesn't rely on color perception.
- **Rationale**: Constitution III requires accessibility to be considered from the start
  for every user-facing change, not retrofitted; the select-then-place interaction model
  (§3) already makes this straightforward since it needs no pointer-drag gesture.
- **Alternatives considered**: Treating accessibility as a later pass (rejected — directly
  conflicts with Constitution III's "not retrofitted later" requirement).

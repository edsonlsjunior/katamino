# Phase 1 Data Model: Katamino Combinatorial Optimization Teaching App

Entities below correspond to the Key Entities section of [spec.md](./spec.md). Types are
given as TypeScript shapes for direct implementation; all data lives in the browser
(bundled static JSON for challenge definitions, `localStorage` for progress) per FR-015.

## Pentomino / PieceType

The static vocabulary of the 12 standard free pentominoes.

```ts
type PieceTypeId = 'F' | 'I' | 'L' | 'N' | 'P' | 'T' | 'U' | 'V' | 'W' | 'X' | 'Y' | 'Z';

interface PieceType {
  id: PieceTypeId;
  color: string;                 // WCAG-contrast-checked, distinct from all others
  baseShape: readonly [number, number][]; // cell offsets (row, col) in canonical orientation
  orientations: readonly (readonly [number, number][])[]; // pre-computed unique rotations/flips (1, 2, or 4 for symmetric pieces, up to 8 otherwise)
}
```

- **Validation rules**: `baseShape` MUST have exactly 5 cells; `orientations` MUST be the
  deduplicated set of the 8 possible rotation/flip transforms of `baseShape` (fewer for
  symmetric pieces, e.g., `I` and `X` have fewer unique orientations).
- Computed once at module load (or build time) and treated as immutable, shared data —
  not per-challenge state.

## Challenge

One of the 500 puzzles (FR-001, FR-002).

```ts
type ChallengeTier = 'small-slam' | 'slam' | 'grand-slam' | 'super-slam' | 'challenge' | 'bonus';

interface Challenge {
  id: number;                    // 1..500, stable identifier
  boardRows: 5;                  // fixed, per research.md §9
  boardCols: number;             // 3..12, equals requiredPieces.length
  requiredPieces: PieceTypeId[]; // exact multiset of pieces needed to fill the board
  tier: ChallengeTier;           // manual-inspired grouping for browsing (ChallengeList)
  line: string;                  // manual-style row label within the tier; '' for bonus
  difficulty: number;            // legacy alias of boardCols (= boardCols); sort-only, superseded by tier/line for grouping
}
```

- **Relationships**: A Challenge's `boardCols`/`requiredPieces` define one `Board` shape
  and the exact set of `Piece` instances available in the `PieceTray` for that attempt.
- **Validation rules**: `requiredPieces.length === boardCols`; the multiset's total area
  (`requiredPieces.length * 5`) MUST equal `boardRows * boardCols`; every challenge MUST
  be solvable by both solving strategies (verified by the build-time script in
  research.md §9, covering FR-014/SC-002); `difficulty === boardCols` for every challenge.
- Completion status is **not** stored on the Challenge record itself — it lives in the
  separate `Progress` persistence entity (below) so challenge data can stay static,
  immutable, bundled JSON.

### Challenge tiers

The physical Katamino manual organizes its 500 "PENTA" puzzles into 5 named tiers, each a
grid of lettered "Lines" (reusing ♠♥♦♣ once the alphabet is exhausted) crossed with the
board width ("PENTA N", 3-11). This app's generated dataset mirrors that structure for
browsing, with one addition (`bonus`) for board-width 12 content that has no equivalent in
the physical game (its widest column is PENTA 11):

| Tier | Lines | PENTA (boardCols) range | Count |
|---|---|---|---|
| `small-slam` | A-G | 3-8 | 42 |
| `slam` | A-N @ 5-9, O-V/♠/♥/♦/♣ @ 6-8 | 5-9 | 118 |
| `grand-slam` | A-L | 4-11 | 96 |
| `super-slam` | A-L @ 5-11, + bonus PENTA-9-only column | 5-11 | 96 |
| `challenge` | N°1-N°25 | 7-10 | 100 |
| `bonus` | (none — `line` is `''`) | 12 only | 48 |

Total: 500. The `challenge` tier's count (100, not the manual's 160) and the `bonus`
tier's count (48, not a full 50) are a deliberate reconciliation so the grand total stays
exactly 500 once the unofficial `bonus` tier is included — the dataset is synthetic
(seeded-random, solvability-verified), not a literal transcription of the manual's
puzzles, so tier *counts* following the manual closely matters more than an exact digit
match on the two flexible tiers.

## Board

The grid for the currently selected challenge (FR-004, FR-005).

```ts
interface Board {
  rows: number;                  // = challenge.boardRows
  cols: number;                  // = challenge.boardCols
  cells: (PlacedPieceId | null)[][]; // rows x cols grid; null = empty
}
```

- **Derived, not persisted**: a Board is recomputed from the current `ManualAttempt` or
  `SolveStep` position; it is never itself the source of truth.
- **Validation rules**: a placement is valid only if every cell the piece's current
  orientation would occupy is within `[0, rows) x [0, cols)` and currently `null`
  (FR-004). "Solved" (FR-005) means every cell is non-null and the set of pieces placed
  exactly equals `challenge.requiredPieces`.

## Piece (in-play instance)

One instance of a `PieceType` available for the current challenge, with mutable
orientation/position while a challenge is being attempted (FR-003).

```ts
type PlacedPieceId = string; // unique per instance within one attempt/board

interface PieceInstance {
  instanceId: PlacedPieceId;
  typeId: PieceTypeId;
  orientationIndex: number;      // index into PieceType.orientations
  position: { row: number; col: number } | null; // top-left anchor cell, or null = unplaced (in tray)
}
```

- **State transitions**: `unplaced → placed` (valid placement), `placed → unplaced`
  (removed/reset), `orientationIndex` may change while `position` is `null` (rotate/flip
  in tray) or, if the app allows in-place reorientation, while placed (re-validated
  against the board on change).

## Manual Attempt

The user's in-progress or completed manual placement for a challenge (FR-003, FR-006).

```ts
interface ManualAttempt {
  challengeId: number;
  pieces: PieceInstance[];       // one entry per required piece, per Challenge.requiredPieces
  isSolved: boolean;             // recomputed after every placement/removal
}
```

- **Relationships**: exactly one active `ManualAttempt` per selected `Challenge` per
  session; not persisted across reloads (only the boolean completion outcome is — see
  `Progress`), consistent with Assumptions ("no time limit/competitive scoring" and
  progress being just completion status).
- **Validation rules**: `reset` (FR-006) sets every `PieceInstance.position` back to
  `null`; `isSolved` becomes `true` only under the Board "solved" rule above, at which
  point `Progress` for `challengeId` is updated (see below).

## Progress (persistence)

Per-challenge completion tracking, persisted across visits with no account (FR-007).

```ts
interface ProgressStore {
  version: 1;
  completed: Record<number, true>; // challengeId -> completed; absence = not completed
}
```

- **Storage**: one JSON blob at `localStorage['katamino:v1:progress']` (research.md §5).
- **Validation rules**: reads MUST tolerate missing/corrupt/absent storage by treating it
  as `{ version: 1, completed: {} }` (graceful degradation edge case); writes happen only
  when a `ManualAttempt.isSolved` transitions to `true` (manual play) — per FR-007 this
  tracks user-achieved completion, so an automatic solve alone does not mark a challenge
  completed.

## Solving Strategy (Algorithm)

A named, distinct automatic-solving approach (FR-009).

```ts
type SolvingStrategyId = 'backtracking' | 'constraint-guided';

interface SolvingStrategy {
  id: SolvingStrategyId;
  descriptionKey: string;        // i18n key for a short plain-language description (FR-017)
}
```

- Exactly two values exist, matching FR-009(a) exhaustive backtracking and FR-009(b)
  constraint-guided/heuristic (Dancing-Links-style) search, per research.md §6–7.

## Solve Run

One execution of a chosen Solving Strategy against a Challenge (FR-008–FR-013).

```ts
interface SolveRun {
  challengeId: number;
  strategyId: SolvingStrategyId;
  steps: SolveStep[];            // ordered, produced by the Web Worker (research.md §8)
  totalSteps: number;            // = steps.length
  backtrackCount: number;        // count of steps with kind === 'remove'
  solvedAtStepIndex: number;     // index into steps where the board first becomes fully solved
}
```

- **Relationships**: belongs to exactly one Challenge + one SolvingStrategy; independent
  of any `ManualAttempt` for the same challenge (edge case: starting an automatic solve
  while manual pieces are placed — the Solve Run always starts from an empty board and
  does not read `ManualAttempt` state, avoiding ambiguity).
- **Validation rules**: `steps` MUST end with a board state matching the same "solved"
  definition used by manual play (Board rule above), satisfying Acceptance Scenario
  US2#4; `totalSteps`/`backtrackCount` are what FR-013's supporting info and User Story
  3's comparison are computed from.

## Solve Step

A single unit of Solve Run playback (FR-010, FR-011).

```ts
interface SolveStep {
  index: number;                 // position within SolveRun.steps
  kind: 'place' | 'remove';      // 'remove' = backtrack/undo
  instanceId: PlacedPieceId;
  typeId: PieceTypeId;
  orientationIndex: number;
  position: { row: number; col: number };
}
```

- **Validation rules**: applying `steps[0..i]` in order to an empty Board MUST always
  yield a valid (non-overlapping, in-bounds) board state for every `i`, so step-backward
  navigation (FR-011) can be implemented either by replaying from the start or by storing
  precomputed board snapshots — an implementation detail, not a data-model requirement.

## Playback State (derived UI state, not persisted)

Drives FR-011/FR-012 and the loading/empty/error/success states required by
Constitution III.

```ts
type PlaybackStatus = 'idle' | 'computing' | 'playing' | 'paused' | 'complete' | 'error';

interface PlaybackState {
  status: PlaybackStatus;
  currentStepIndex: number;      // -1 before the first step
  speed: number;                 // steps per second, user-adjustable (FR-012)
}
```

- **State transitions**: `idle → computing` (solve triggered, worker started) →
  `playing` (steps available, autoplay running) ⇄ `paused` (user pause, or arrival via
  step forward/back while not autoplaying) → `complete` (last step reached) ; `computing`
  may also transition to `error` if the worker fails unexpectedly, which the UI must
  surface per Constitution III's "every interactive feature defines its error state."
- Selecting a different challenge or strategy resets `PlaybackState` to `idle` and
  discards the current `SolveRun`.

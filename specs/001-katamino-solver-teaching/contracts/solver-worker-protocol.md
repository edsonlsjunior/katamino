# Contract: Solver Engine (UI thread ⇄ Web Worker)

Boundary between the main UI thread and the Web Worker that runs both solving
strategies (research.md §8, Constitution IV). This is the app's internal "API" for
FR-008–FR-014; the message shapes below are what Vitest exercises directly (worker
logic is pure/testable without a real `Worker` in unit tests) and what the UI's
`PlaybackState` (data-model.md) is driven by.

## Request: `SolveRequest` (UI → Worker)

```ts
interface SolveRequest {
  type: 'solve';
  requestId: string;             // correlates response events to this request; a new request supersedes any prior one
  challenge: Challenge;          // as defined in data-model.md
  strategyId: SolvingStrategyId; // 'backtracking' | 'constraint-guided'
}
```

- Posting a new `SolveRequest` while a previous one is still running MUST cause the
  worker to abandon the previous run and emit no further events for its `requestId`
  (covers the edge case of rapidly switching challenges/strategies).

## Responses: Worker → UI (streamed, in order)

```ts
type SolveResponse =
  | { type: 'started'; requestId: string }
  | { type: 'step'; requestId: string; step: SolveStep }         // one per placement/removal, emitted incrementally — never batched into a single final payload
  | { type: 'done'; requestId: string; totalSteps: number; backtrackCount: number; solvedAtStepIndex: number }
  | { type: 'error'; requestId: string; message: string };
```

- **Streaming guarantee**: `step` events MUST be posted as they are produced during the
  search, not accumulated and sent only after the solve finishes — this is what keeps the
  UI thread responsive and lets `PlaybackState` move `computing → playing` as soon as the
  first step (or a small initial batch) has arrived, satisfying SC-007.
- **Ordering guarantee**: for a given `requestId`, `step.step.index` values are emitted
  in strictly increasing order starting at 0, and exactly one `done` (or one `error`)
  event follows the last `step` event.
- **Termination guarantee**: for every challenge in the bundled dataset, the worker MUST
  eventually emit `done` (FR-014); `error` is reserved for unexpected runtime failures,
  not "no solution found" (which cannot happen for a validated challenge — see the
  dataset invariants in `challenge-data.schema.json`).
- **Determinism**: given the same `Challenge` and `strategyId`, the emitted step sequence
  MUST be identical across runs (both solvers use a fixed, deterministic search/tie-break
  order) — this is what makes User Story 3's strategy comparison meaningful and what
  Vitest snapshots the step logs against.

## Consumer contract (UI side)

- The UI MUST treat the worker as the single source of truth for `SolveRun` data
  (data-model.md) — it does not recompute or duplicate solver logic.
- The UI MAY buffer `step` events in a queue and drive playback speed (FR-012)
  independently of how fast the worker actually produces steps — playback speed is a
  presentation concern, not a solver concern.
- On an `error` event, the UI MUST transition `PlaybackState.status` to `'error'` and
  present actionable feedback (Constitution III), not silently ignore it.

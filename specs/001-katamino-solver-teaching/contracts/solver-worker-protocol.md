# Contract: Solver Engine (UI thread ⇄ Web Worker)

> **Updated after the original spec**: the two fixed strategies were replaced by one
> solver configured with a list of additive criteria (`src/solvers/criteria.ts`), runs
> can end at a step limit, and steps cross the worker boundary in batches.

Boundary between the main UI thread and the Web Worker that runs the solver
(research.md §8, Constitution IV). This is the app's internal "API" for
FR-008–FR-014; the message shapes below are what Vitest exercises directly (worker
logic is pure/testable without a real `Worker` in unit tests) and what the UI's
`PlaybackState` (data-model.md) is driven by.

## Request: `SolveRequest` (UI → Worker)

```ts
interface SolveRequest {
  type: 'solve';
  requestId: string;             // correlates response events to this request; a new request supersedes any prior one
  challenge: Challenge;          // as defined in data-model.md
  criteria: CriterionId[];       // criteria added on top of plain backtracking (src/solvers/criteria.ts)
  maxSteps?: number;             // overrides the solver's default step limit
}

interface CancelRequest { type: 'cancel' } // abandons the run in progress
```

- Posting a new `SolveRequest` while a previous one is still running MUST cause the
  worker to abandon the previous run and emit no further events for its `requestId`
  (covers the edge case of rapidly switching challenges/strategies).

## Responses: Worker → UI (streamed, in order)

```ts
type SolveResponse =
  | { type: 'started'; requestId: string }
  | { type: 'step'; requestId: string; step: SolveStep }         // one per placement/removal, emitted incrementally — never batched into a single final payload
  | { type: 'done'; requestId: string; totalSteps: number; backtrackCount: number; solvedAtStepIndex: number;
      outcome: 'solved' | 'exhausted' | 'limit'; pruneCounts: Partial<Record<CriterionId, number>> }
  | { type: 'error'; requestId: string; message: string };
```

- **Batching**: the list above is the logical event stream (what `solverEngine.runSolve`
  yields and unit tests exercise). On the wire, the worker packs consecutive `step` events
  into `{ type: 'steps'; requestId; steps: SolveStep[] }` messages — the first step alone,
  then batches closed by size or elapsed time — so a long search doesn't flood the UI thread.
- **Step limit**: a run that reaches `maxSteps` ends with `done` and `outcome: 'limit'`
  (`solvedAtStepIndex: -1`); it is a normal result, not an `error`.
- **Pruned placements**: a `remove` step carries `prunedBy` when a pruning criterion
  ruled the placement out immediately; `pruneCounts` totals them per criterion.

- **Streaming guarantee**: `step` events MUST be posted as they are produced during the
  search, not accumulated and sent only after the solve finishes — this is what keeps the
  UI thread responsive and lets `PlaybackState` move `computing → playing` as soon as the
  first step (or a small initial batch) has arrived, satisfying SC-007.
- **Ordering guarantee**: for a given `requestId`, `step.step.index` values are emitted
  in strictly increasing order starting at 0, and exactly one `done` (or one `error`)
  event follows the last `step` event.
- **Termination guarantee**: for every challenge in the bundled dataset, the worker MUST
  eventually emit `done` (FR-014); `error` is reserved for unexpected runtime failures,
  not "no solution found". With few criteria on a large board the run may end at the step
  limit instead of a solution; the default criteria solve every bundled challenge within it.
- **Determinism**: given the same `Challenge` and set of `criteria`, the emitted step sequence
  MUST be identical across runs (the solver uses a fixed, deterministic search/tie-break
  order, and the order the criteria are listed in does not matter) — this is what makes User Story 3's strategy comparison meaningful and what
  Vitest snapshots the step logs against.

## Consumer contract (UI side)

- The UI MUST treat the worker as the single source of truth for `SolveRun` data
  (data-model.md) — it does not recompute or duplicate solver logic.
- The UI MAY buffer `step` events in a queue and drive playback speed (FR-012)
  independently of how fast the worker actually produces steps — playback speed is a
  presentation concern, not a solver concern.
- On an `error` event, the UI MUST transition `PlaybackState.status` to `'error'` and
  present actionable feedback (Constitution III), not silently ignore it.

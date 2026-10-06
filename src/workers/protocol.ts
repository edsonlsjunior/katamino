/** UI thread <-> solver Web Worker message contract. See contracts/solver-worker-protocol.md. */
import type { Challenge, SolveOutcome, SolveStep } from '../domain/types';
import type { CriterionId } from '../solvers/criteria';

export interface SolveRequest {
  type: 'solve';
  requestId: string;
  challenge: Challenge;
  /** The criteria to add on top of plain backtracking (solvers/criteria.ts). */
  criteria: CriterionId[];
  /** Overrides the solver's default step limit. */
  maxSteps?: number;
}

/** Abandons whatever run is in progress. */
export interface CancelRequest {
  type: 'cancel';
}

export type WorkerRequest = SolveRequest | CancelRequest;

export type SolveResponse =
  | { type: 'started'; requestId: string }
  | { type: 'step'; requestId: string; step: SolveStep }
  | {
      type: 'done';
      requestId: string;
      totalSteps: number;
      backtrackCount: number;
      solvedAtStepIndex: number;
      outcome: SolveOutcome;
      pruneCounts: Partial<Record<CriterionId, number>>;
    }
  | { type: 'error'; requestId: string; message: string };

/**
 * What actually crosses the worker boundary: the same events, with runs of
 * consecutive `step` events packed into one `steps` message so a long search
 * doesn't flood the UI thread with one message per step.
 */
export type WorkerMessage =
  | Exclude<SolveResponse, { type: 'step' }>
  | { type: 'steps'; requestId: string; steps: SolveStep[] };

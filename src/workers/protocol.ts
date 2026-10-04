/** UI thread <-> solver Web Worker message contract. See contracts/solver-worker-protocol.md. */
import type { Challenge, SolveStep, SolvingStrategyId } from '../domain/types';

export interface SolveRequest {
  type: 'solve';
  requestId: string;
  challenge: Challenge;
  strategyId: SolvingStrategyId;
}

export type SolveResponse =
  | { type: 'started'; requestId: string }
  | { type: 'step'; requestId: string; step: SolveStep }
  | {
      type: 'done';
      requestId: string;
      totalSteps: number;
      backtrackCount: number;
      solvedAtStepIndex: number;
    }
  | { type: 'error'; requestId: string; message: string };

/**
 * Shared domain types per data-model.md. Types owned by a specific module
 * (PieceTypeId/PieceType/Cell in pentomino.ts, Board in board.ts) are re-exported
 * here for convenience.
 */

import type { PieceTypeId } from './pentomino';
import type { CriterionId } from '../solvers/criteria';

export type { PieceTypeId, PieceType, Cell } from './pentomino';
export type { Board, CellValue } from './board';

export type ChallengeTier = 'small-slam' | 'slam' | 'grand-slam' | 'super-slam' | 'challenge' | 'bonus';

export interface Challenge {
  id: number;
  boardRows: 5;
  boardCols: number;
  requiredPieces: PieceTypeId[];
  tier: ChallengeTier;
  /** Manual-style row label within the tier (e.g. 'A', 'N°12'); '' for the bonus tier. */
  line: string;
  /** Legacy alias of boardCols, kept for sort-only use; tier/line now drive grouping. */
  difficulty: number;
}

export type PlacedPieceId = string;

export interface PieceInstance {
  instanceId: PlacedPieceId;
  typeId: PieceTypeId;
  orientationIndex: number;
  position: { row: number; col: number } | null;
}

export interface ManualAttempt {
  challengeId: number;
  pieces: PieceInstance[];
  isSolved: boolean;
}

export interface ProgressStore {
  version: 1;
  completed: Record<number, true>;
}

/**
 * How a solver run ended: it found a solution, tried everything without
 * finding one, or hit its step limit first.
 */
export type SolveOutcome = 'solved' | 'exhausted' | 'limit';

export interface SolveStep {
  index: number;
  kind: 'place' | 'remove';
  instanceId: PlacedPieceId;
  typeId: PieceTypeId;
  orientationIndex: number;
  position: { row: number; col: number };
  /** On a 'remove' step: the pruning criterion that ruled the placement out
   * right away, when it wasn't undone by ordinary backtracking. */
  prunedBy?: CriterionId;
}

export interface SolveRun {
  challengeId: number;
  /** The criteria the strategy was built from (see solvers/criteria.ts). */
  criteria: CriterionId[];
  steps: SolveStep[];
  totalSteps: number;
  backtrackCount: number;
  solvedAtStepIndex: number;
  outcome: SolveOutcome;
}

export type PlaybackStatus = 'idle' | 'computing' | 'playing' | 'paused' | 'complete' | 'error';

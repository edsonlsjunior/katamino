/**
 * The one solver behind every strategy the player can assemble. Its core is
 * plain exhaustive backtracking — pick an empty cell, try every piece and
 * orientation that covers it, recurse, undo on dead ends — and each enabled
 * criterion (see criteria.ts) refines that:
 *
 * - scarce-pieces-first: try pieces with the fewest orientations first.
 * - most-constrained-cell: instead of the next empty cell in reading order,
 *   work on the empty cell with the fewest legal placements (the
 *   minimum-remaining-values heuristic of exact-cover solvers).
 * - dead-regions: a placement that walls off an empty area whose size isn't
 *   a multiple of 5 is a dead end.
 * - stranded-cells: a placement after which some empty cell can't be covered
 *   by any remaining piece is a dead end.
 * - stranded-pieces: a placement after which some remaining piece no longer
 *   fits anywhere is a dead end.
 *
 * Every attempted placement and every undo is yielded as a SolveStep, so the
 * caller can stream/replay the search step by step. A placement rejected by a
 * pruning criterion is still shown (place, then remove) and its remove step
 * names the criterion in `prunedBy`.
 */
import { PIECE_TYPES, cellsAt, type Cell, type PieceTypeId } from '../domain/pentomino';
import { canPlace, createEmptyBoard, isFull, placeCells, type Board } from '../domain/board';
import type { Challenge, SolveOutcome, SolveStep } from '../domain/types';
import { PRUNE_CRITERION_IDS, type CriterionId } from './criteria';

export interface SolveSummary {
  backtrackCount: number;
  solvedAtStepIndex: number;
  outcome: SolveOutcome;
  /** How many branches each pruning criterion cut. */
  pruneCounts: Partial<Record<CriterionId, number>>;
}

export interface SolveOptions {
  /** Give up (outcome 'limit') once this many steps have been produced. */
  maxSteps?: number;
}

/** Few criteria on a big board can mean billions of steps; nobody watches that many. */
export const DEFAULT_MAX_STEPS = 200_000;

interface Option {
  typeId: PieceTypeId;
  orientationIndex: number;
  row: number;
  col: number;
}

const DIRECTIONS: readonly Cell[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

class StepLimitReached extends Error {}

export function instanceIdFor(typeId: PieceTypeId): string {
  return `solve-${typeId}`;
}

function firstEmptyCell(board: Board): Cell | null {
  for (let r = 0; r < board.rows; r++) {
    for (let c = 0; c < board.cols; c++) {
      if (board.cells[r][c] === null) return [r, c];
    }
  }
  return null;
}

/**
 * Placements whose first cell (in reading order) lands on (row, col). When
 * (row, col) is the first empty cell of the board, these are exactly the
 * placements that cover it: everything before it is already filled.
 */
function optionsAnchoredAt(board: Board, remaining: readonly PieceTypeId[], row: number, col: number): Option[] {
  const options: Option[] = [];
  for (const typeId of remaining) {
    const orientations = PIECE_TYPES[typeId].orientations;
    for (let orientationIndex = 0; orientationIndex < orientations.length; orientationIndex++) {
      const [anchorRow, anchorCol] = orientations[orientationIndex][0];
      const placeRow = row - anchorRow;
      const placeCol = col - anchorCol;
      if (canPlace(board, cellsAt(typeId, orientationIndex, [placeRow, placeCol]))) {
        options.push({ typeId, orientationIndex, row: placeRow, col: placeCol });
      }
    }
  }
  return options;
}

/** Every placement of a remaining piece that covers (row, col) with any of its cells. */
export function optionsCovering(board: Board, remaining: readonly PieceTypeId[], row: number, col: number): Option[] {
  const options: Option[] = [];
  for (const typeId of remaining) {
    const orientations = PIECE_TYPES[typeId].orientations;
    for (let orientationIndex = 0; orientationIndex < orientations.length; orientationIndex++) {
      for (const [dr, dc] of orientations[orientationIndex]) {
        const placeRow = row - dr;
        const placeCol = col - dc;
        if (canPlace(board, cellsAt(typeId, orientationIndex, [placeRow, placeCol]))) {
          options.push({ typeId, orientationIndex, row: placeRow, col: placeCol });
        }
      }
    }
  }
  return options;
}

function canBeCovered(board: Board, remaining: readonly PieceTypeId[], row: number, col: number): boolean {
  for (const typeId of remaining) {
    const orientations = PIECE_TYPES[typeId].orientations;
    for (let orientationIndex = 0; orientationIndex < orientations.length; orientationIndex++) {
      for (const [dr, dc] of orientations[orientationIndex]) {
        if (canPlace(board, cellsAt(typeId, orientationIndex, [row - dr, col - dc]))) return true;
      }
    }
  }
  return false;
}

/** The empty cell with the fewest legal placements, and those placements. */
function mostConstrainedCell(board: Board, remaining: readonly PieceTypeId[]): Option[] {
  let best: Option[] | null = null;
  for (let r = 0; r < board.rows; r++) {
    for (let c = 0; c < board.cols; c++) {
      if (board.cells[r][c] !== null) continue;
      const options = optionsCovering(board, remaining, r, c);
      if (options.length === 0) return options; // can't get more constrained than that
      if (!best || options.length < best.length) best = options;
    }
  }
  return best ?? [];
}

/**
 * False if any connected region of empty cells has a size that isn't a multiple
 * of 5 — such a region can never be exactly filled by whole pentominoes.
 */
function emptyRegionsAreViable(board: Board): boolean {
  const seen: boolean[][] = board.cells.map((row) => row.map(() => false));
  for (let r = 0; r < board.rows; r++) {
    for (let c = 0; c < board.cols; c++) {
      if (board.cells[r][c] !== null || seen[r][c]) continue;
      let size = 0;
      const stack: Cell[] = [[r, c]];
      seen[r][c] = true;
      while (stack.length > 0) {
        const [cr, cc] = stack.pop()!;
        size++;
        for (const [dr, dc] of DIRECTIONS) {
          const nr = cr + dr;
          const nc = cc + dc;
          if (
            nr >= 0 &&
            nr < board.rows &&
            nc >= 0 &&
            nc < board.cols &&
            board.cells[nr][nc] === null &&
            !seen[nr][nc]
          ) {
            seen[nr][nc] = true;
            stack.push([nr, nc]);
          }
        }
      }
      if (size % 5 !== 0) return false;
    }
  }
  return true;
}

function everyEmptyCellCanBeCovered(board: Board, remaining: readonly PieceTypeId[]): boolean {
  for (let r = 0; r < board.rows; r++) {
    for (let c = 0; c < board.cols; c++) {
      if (board.cells[r][c] === null && !canBeCovered(board, remaining, r, c)) return false;
    }
  }
  return true;
}

export function fitsSomewhere(board: Board, typeId: PieceTypeId): boolean {
  const orientations = PIECE_TYPES[typeId].orientations;
  for (let orientationIndex = 0; orientationIndex < orientations.length; orientationIndex++) {
    for (let r = 0; r < board.rows; r++) {
      for (let c = 0; c < board.cols; c++) {
        if (canPlace(board, cellsAt(typeId, orientationIndex, [r, c]))) return true;
      }
    }
  }
  return false;
}

function byFewestOrientationsFirst(pieces: readonly PieceTypeId[]): PieceTypeId[] {
  return [...pieces].sort(
    (a, b) => PIECE_TYPES[a].orientations.length - PIECE_TYPES[b].orientations.length,
  );
}

export function* solve(
  challenge: Challenge,
  criteria: Iterable<CriterionId>,
  { maxSteps = DEFAULT_MAX_STEPS }: SolveOptions = {},
): Generator<SolveStep, SolveSummary, void> {
  const enabled = new Set(criteria);
  const state = { stepIndex: 0, backtrackCount: 0, solvedAtStepIndex: -1 };
  const pruneCounts: Partial<Record<CriterionId, number>> = {};
  for (const id of PRUNE_CRITERION_IDS) {
    if (enabled.has(id)) pruneCounts[id] = 0;
  }

  /** The first enabled pruning criterion that rules this position out, if any. */
  function deadEndReason(board: Board, remaining: readonly PieceTypeId[]): CriterionId | null {
    if (enabled.has('dead-regions') && !emptyRegionsAreViable(board)) return 'dead-regions';
    if (enabled.has('stranded-pieces') && !remaining.every((typeId) => fitsSomewhere(board, typeId))) {
      return 'stranded-pieces';
    }
    if (enabled.has('stranded-cells') && !everyEmptyCellCanBeCovered(board, remaining)) return 'stranded-cells';
    return null;
  }

  function nextOptions(board: Board, remaining: readonly PieceTypeId[]): Option[] {
    if (enabled.has('most-constrained-cell')) return mostConstrainedCell(board, remaining);
    const target = firstEmptyCell(board);
    return target ? optionsAnchoredAt(board, remaining, target[0], target[1]) : [];
  }

  function* search(board: Board, remaining: readonly PieceTypeId[]): Generator<SolveStep, boolean, void> {
    if (remaining.length === 0) return isFull(board);

    for (const { typeId, orientationIndex, row, col } of nextOptions(board, remaining)) {
      if (state.stepIndex >= maxSteps) throw new StepLimitReached();

      const instanceId = instanceIdFor(typeId);
      const nextBoard = placeCells(board, instanceId, cellsAt(typeId, orientationIndex, [row, col]));
      const placeIndex = state.stepIndex++;
      yield { index: placeIndex, kind: 'place', instanceId, typeId, orientationIndex, position: { row, col } };

      const nextRemaining = remaining.filter((id) => id !== typeId);
      const full = isFull(nextBoard);
      if (full) {
        state.solvedAtStepIndex = placeIndex;
        return true;
      }

      const prunedBy = deadEndReason(nextBoard, nextRemaining);
      if (prunedBy) pruneCounts[prunedBy] = (pruneCounts[prunedBy] ?? 0) + 1;
      else if (yield* search(nextBoard, nextRemaining)) return true;

      state.backtrackCount++;
      yield {
        index: state.stepIndex++,
        kind: 'remove',
        instanceId,
        typeId,
        orientationIndex,
        position: { row, col },
        ...(prunedBy ? { prunedBy } : undefined),
      };
    }
    return false;
  }

  const pieces = enabled.has('scarce-pieces-first')
    ? byFewestOrientationsFirst(challenge.requiredPieces)
    : challenge.requiredPieces;

  let outcome: SolveOutcome;
  try {
    const solved = yield* search(createEmptyBoard(challenge.boardRows, challenge.boardCols), pieces);
    outcome = solved ? 'solved' : 'exhausted';
  } catch (error) {
    if (!(error instanceof StepLimitReached)) throw error;
    outcome = 'limit';
  }
  return {
    backtrackCount: state.backtrackCount,
    solvedAtStepIndex: state.solvedAtStepIndex,
    outcome,
    pruneCounts,
  };
}

/**
 * How many ways there are to put every piece of the challenge somewhere on the
 * board (any orientation, any position that keeps it inside) when overlaps are
 * not checked: the size of the haystack a search with no cleverness at all
 * would have to go through.
 */
export function countArrangements(challenge: Challenge): bigint {
  let total = 1n;
  for (const typeId of challenge.requiredPieces) {
    let placements = 0;
    for (const orientation of PIECE_TYPES[typeId].orientations) {
      const height = Math.max(...orientation.map(([r]) => r)) + 1;
      const width = Math.max(...orientation.map(([, c]) => c)) + 1;
      placements += Math.max(0, challenge.boardRows - height + 1) * Math.max(0, challenge.boardCols - width + 1);
    }
    total *= BigInt(placements);
  }
  return total;
}

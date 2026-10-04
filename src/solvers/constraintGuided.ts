/**
 * Constraint-guided search (FR-009b, research.md §7): at every step, instead of
 * always looking at the next empty cell in a fixed scan order, it evaluates every
 * empty cell's number of legal (piece, orientation) placements and commits to
 * whichever cell has the *fewest* options — the minimum-remaining-values (MRV)
 * heuristic used by Algorithm X / Dancing-Links-style exact-cover solvers. A cell
 * with zero options is an immediate, exact dead-end signal, so this strategy
 * typically backtracks far less than plain backtracking for the same challenge.
 * Every attempted placement and every undo is still yielded as a SolveStep, using
 * the same step shape as the backtracking solver so both can drive the same
 * playback UI.
 */
import { PIECE_TYPES, cellsAt, type Cell, type PieceTypeId } from '../domain/pentomino';
import { canPlace, createEmptyBoard, isFull, placeCells, type Board } from '../domain/board';
import type { Challenge, SolveStep } from '../domain/types';
import type { SolveSummary } from './backtracking';

export function instanceIdFor(typeId: PieceTypeId): string {
  return `solve-${typeId}`;
}

interface Option {
  typeId: PieceTypeId;
  orientationIndex: number;
  row: number;
  col: number;
}

/**
 * Every placement of every remaining piece/orientation that covers (row, col) —
 * via ANY of the piece's cells, not just its top-left anchor. (Anchor-only
 * checking is a valid shortcut when the target is always the first empty cell in
 * a fixed scan order — see backtracking.ts — but this solver's target cell is
 * chosen by MRV and can be anywhere, so every covering cell must be considered.)
 */
function optionsAt(
  board: Board,
  remaining: readonly PieceTypeId[],
  row: number,
  col: number,
): Option[] {
  const options: Option[] = [];
  for (const typeId of remaining) {
    const orientations = PIECE_TYPES[typeId].orientations;
    for (let orientationIndex = 0; orientationIndex < orientations.length; orientationIndex++) {
      for (const [dr, dc] of orientations[orientationIndex]) {
        const placeRow = row - dr;
        const placeCol = col - dc;
        const cells = cellsAt(typeId, orientationIndex, [placeRow, placeCol]);
        if (canPlace(board, cells)) {
          options.push({ typeId, orientationIndex, row: placeRow, col: placeCol });
        }
      }
    }
  }
  return options;
}

/** The empty cell with the fewest legal placements, and those placements. Null cell means the board is full. */
function mostConstrainedCell(
  board: Board,
  remaining: readonly PieceTypeId[],
): { cell: Cell; options: Option[] } | null {
  let best: { cell: Cell; options: Option[] } | null = null;

  for (let r = 0; r < board.rows; r++) {
    for (let c = 0; c < board.cols; c++) {
      if (board.cells[r][c] !== null) continue;
      const options = optionsAt(board, remaining, r, c);
      if (options.length === 0) return { cell: [r, c], options }; // exact dead end — most constrained possible
      if (!best || options.length < best.options.length) {
        best = { cell: [r, c], options };
      }
    }
  }
  return best;
}

export function* solveConstraintGuided(
  challenge: Challenge,
): Generator<SolveStep, SolveSummary, void> {
  const state = { stepIndex: 0, backtrackCount: 0, solvedAtStepIndex: -1 };

  function* search(board: Board, remaining: readonly PieceTypeId[]): Generator<SolveStep, boolean, void> {
    const found = mostConstrainedCell(board, remaining);
    if (found === null) return remaining.length === 0;
    const { options } = found;

    for (const option of options) {
      const { typeId, orientationIndex, row, col } = option;
      const cells = cellsAt(typeId, orientationIndex, [row, col]);
      const instanceId = instanceIdFor(typeId);
      const nextBoard = placeCells(board, instanceId, cells);
      const placeIndex = state.stepIndex++;
      yield { index: placeIndex, kind: 'place', instanceId, typeId, orientationIndex, position: { row, col } };

      if (state.solvedAtStepIndex === -1 && isFull(nextBoard)) {
        state.solvedAtStepIndex = placeIndex;
      }

      const nextRemaining = remaining.filter((id) => id !== typeId);
      const success = yield* search(nextBoard, nextRemaining);
      if (success) return true;

      state.backtrackCount++;
      yield {
        index: state.stepIndex++,
        kind: 'remove',
        instanceId,
        typeId,
        orientationIndex,
        position: { row, col },
      };
    }
    return false;
  }

  const board0 = createEmptyBoard(challenge.boardRows, challenge.boardCols);
  yield* search(board0, challenge.requiredPieces);
  return { backtrackCount: state.backtrackCount, solvedAtStepIndex: state.solvedAtStepIndex };
}

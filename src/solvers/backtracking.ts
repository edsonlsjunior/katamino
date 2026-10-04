/**
 * Exhaustive backtracking solver (FR-009a, research.md §6). Scans the board in a
 * fixed row-major order and, at the first empty cell, tries every unplaced piece
 * in every orientation that can anchor there, recursing and undoing (backtracking)
 * on dead ends. Every attempted placement and every undo is yielded as a
 * SolveStep, so the caller can stream/replay the search step by step.
 *
 * Two small, standard feasibility refinements keep this practical on the largest
 * boards (5x12) without changing what makes it "naive" versus the constraint-guided
 * strategy: pieces are tried in a fixed order (fewest orientations first, so highly
 * constrained pieces are placed while there's still room for them), and a placement
 * that would wall off an empty region whose size isn't a multiple of 5 is recognized
 * as an immediate dead end (such a region can never be exactly covered by whole
 * pentominoes) instead of being searched further. Neither refinement reorders cells
 * or pieces *based on the current board state* the way the constraint-guided
 * strategy's most-constrained-first heuristic does — the try order is fixed before
 * the search starts, and the region check is a validity check, not a search order.
 */
import { PIECE_TYPES, cellsAt, type Cell, type PieceTypeId } from '../domain/pentomino';
import { canPlace, createEmptyBoard, isFull, placeCells, type Board } from '../domain/board';
import type { Challenge, SolveStep } from '../domain/types';

export interface SolveSummary {
  backtrackCount: number;
  solvedAtStepIndex: number;
}

const DIRECTIONS: readonly Cell[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

function firstEmptyCell(board: Board): Cell | null {
  for (let r = 0; r < board.rows; r++) {
    for (let c = 0; c < board.cols; c++) {
      if (board.cells[r][c] === null) return [r, c];
    }
  }
  return null;
}

/**
 * False if any connected region of empty cells has a size that isn't a multiple
 * of 5 — such a region can never be exactly filled by whole pentominoes, so the
 * placement that created it is a dead end.
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

export function instanceIdFor(typeId: PieceTypeId): string {
  return `solve-${typeId}`;
}

function byFewestOrientationsFirst(pieces: readonly PieceTypeId[]): PieceTypeId[] {
  return [...pieces].sort(
    (a, b) => PIECE_TYPES[a].orientations.length - PIECE_TYPES[b].orientations.length,
  );
}

export function* solveBacktracking(
  challenge: Challenge,
): Generator<SolveStep, SolveSummary, void> {
  const state = { stepIndex: 0, backtrackCount: 0, solvedAtStepIndex: -1 };

  function* search(board: Board, remaining: readonly PieceTypeId[]): Generator<SolveStep, boolean, void> {
    const target = firstEmptyCell(board);
    if (target === null) return remaining.length === 0;
    if (remaining.length === 0) return false;

    const [targetRow, targetCol] = target;
    for (const typeId of remaining) {
      const orientations = PIECE_TYPES[typeId].orientations;
      for (let orientationIndex = 0; orientationIndex < orientations.length; orientationIndex++) {
        const [anchorRow, anchorCol] = orientations[orientationIndex][0];
        const row = targetRow - anchorRow;
        const col = targetCol - anchorCol;
        const cells = cellsAt(typeId, orientationIndex, [row, col]);
        if (!canPlace(board, cells)) continue;

        const instanceId = instanceIdFor(typeId);
        const nextBoard = placeCells(board, instanceId, cells);
        const placeIndex = state.stepIndex++;
        yield { index: placeIndex, kind: 'place', instanceId, typeId, orientationIndex, position: { row, col } };

        const full = isFull(nextBoard);
        if (state.solvedAtStepIndex === -1 && full) {
          state.solvedAtStepIndex = placeIndex;
        }

        const nextRemaining = remaining.filter((id) => id !== typeId);
        const deadEnd = !full && !emptyRegionsAreViable(nextBoard);
        const success = deadEnd ? false : yield* search(nextBoard, nextRemaining);
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
    }
    return false;
  }

  const board0 = createEmptyBoard(challenge.boardRows, challenge.boardCols);
  yield* search(board0, byFewestOrientationsFirst(challenge.requiredPieces));
  return { backtrackCount: state.backtrackCount, solvedAtStepIndex: state.solvedAtStepIndex };
}

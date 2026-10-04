import { PIECE_TYPES, type PieceTypeId, type Cell } from '../../src/domain/pentomino';
import { canPlace, createEmptyBoard, placeCells, type Board } from '../../src/domain/board';
import { shuffle } from './rng';

const MAX_ATTEMPTS = 300_000;

/** First empty cell in row-major order, or null if the board is full. */
function firstEmptyCell(board: Board): Cell | null {
  for (let r = 0; r < board.rows; r++) {
    for (let c = 0; c < board.cols; c++) {
      if (board.cells[r][c] === null) return [r, c];
    }
  }
  return null;
}

/**
 * Attempts to find ANY valid tiling of a rows x cols board using exactly one of
 * each given piece type. Anchors each placement's top-left-most cell to the
 * board's first empty cell (row-major) to keep the branching factor small —
 * this is the standard optimization for exact-cover pentomino tiling and is why
 * this finishes quickly even via plain backtracking at this board scale.
 *
 * Returns null if no tiling is found within the attempt budget (treated by the
 * caller as "not tileable" and simply tries a different piece subset).
 */
export function findTiling(
  rows: number,
  cols: number,
  pieceTypeIds: readonly PieceTypeId[],
  rand: () => number,
): boolean {
  const board = createEmptyBoard(rows, cols);
  const orderedTypes = shuffle(pieceTypeIds, rand);
  let attempts = 0;

  function search(current: Board, remaining: readonly PieceTypeId[]): boolean {
    const target = firstEmptyCell(current);
    if (target === null) return remaining.length === 0;
    if (remaining.length === 0) return false;
    if (++attempts > MAX_ATTEMPTS) return false;

    const [targetRow, targetCol] = target;
    const typesToTry = shuffle(remaining, rand);

    for (const typeId of typesToTry) {
      const orientations = shuffle(PIECE_TYPES[typeId].orientations, rand);
      for (const orientation of orientations) {
        const [anchorRow, anchorCol] = orientation[0];
        const row = targetRow - anchorRow;
        const col = targetCol - anchorCol;
        const cells = orientation.map(([r, c]) => [r + row, c + col] as Cell);
        if (!canPlace(current, cells)) continue;

        const next = placeCells(current, typeId, cells);
        const nextRemaining = remaining.filter((id) => id !== typeId);
        if (search(next, nextRemaining)) return true;
        if (attempts > MAX_ATTEMPTS) return false;
      }
    }
    return false;
  }

  return search(board, orderedTypes);
}

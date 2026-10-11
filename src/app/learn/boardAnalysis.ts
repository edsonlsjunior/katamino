/**
 * Small board computations behind the teaching page's illustrations. The
 * pictures are derived from the same domain functions the solver uses, so
 * what they show is what the solver would actually see.
 */
import { PIECE_TYPES, cellsAt, type Cell, type PieceTypeId } from '../../domain/pentomino';
import { createEmptyBoard, placeCells, type Board } from '../../domain/board';
import { optionsCovering } from '../../solvers/configurableSolver';

export interface PlacementSpec {
  typeId: PieceTypeId;
  orientationIndex: number;
  row: number;
  col: number;
}

export function cellKey(row: number, col: number): string {
  return `${row},${col}`;
}

/** A board with the given pieces on it; cells hold piece type ids. */
export function boardWith(rows: number, cols: number, placements: readonly PlacementSpec[]): Board {
  let board = createEmptyBoard(rows, cols);
  for (const { typeId, orientationIndex, row, col } of placements) {
    board = placeCells(board, typeId, cellsAt(typeId, orientationIndex, [row, col]));
  }
  return board;
}

/** The board seen in a mirror (left and right swapped). */
export function mirrorBoard(board: Board): Board {
  return { ...board, cells: board.cells.map((row) => [...row].reverse()) };
}

/** Connected groups of empty cells. */
export function emptyRegions(board: Board): Cell[][] {
  const seen = board.cells.map((row) => row.map(() => false));
  const regions: Cell[][] = [];
  for (let r = 0; r < board.rows; r++) {
    for (let c = 0; c < board.cols; c++) {
      if (board.cells[r][c] !== null || seen[r][c]) continue;
      const region: Cell[] = [];
      const stack: Cell[] = [[r, c]];
      seen[r][c] = true;
      while (stack.length > 0) {
        const [cr, cc] = stack.pop()!;
        region.push([cr, cc]);
        for (const [dr, dc] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const nr = cr + dr;
          const nc = cc + dc;
          if (nr < 0 || nr >= board.rows || nc < 0 || nc >= board.cols) continue;
          if (board.cells[nr][nc] !== null || seen[nr][nc]) continue;
          seen[nr][nc] = true;
          stack.push([nr, nc]);
        }
      }
      regions.push(region);
    }
  }
  return regions;
}

/** For every empty cell (in reading order), how many placements of the remaining pieces cover it. */
export function coverCounts(
  board: Board,
  remaining: readonly PieceTypeId[],
): { row: number; col: number; count: number }[] {
  const counts: { row: number; col: number; count: number }[] = [];
  for (let r = 0; r < board.rows; r++) {
    for (let c = 0; c < board.cols; c++) {
      if (board.cells[r][c] !== null) continue;
      counts.push({ row: r, col: c, count: optionsCovering(board, remaining, r, c).length });
    }
  }
  return counts;
}

/** How many ways one piece can be put on an empty board (any orientation, any position). */
export function placementCount(typeId: PieceTypeId, rows: number, cols: number): number {
  let total = 0;
  for (const orientation of PIECE_TYPES[typeId].orientations) {
    const height = Math.max(...orientation.map(([r]) => r)) + 1;
    const width = Math.max(...orientation.map(([, c]) => c)) + 1;
    total += Math.max(0, rows - height + 1) * Math.max(0, cols - width + 1);
  }
  return total;
}

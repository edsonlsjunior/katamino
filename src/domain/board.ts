/**
 * Pure board grid model: occupancy, placement validity, and the "fully filled"
 * win condition shared by manual play and solver playback (data-model.md "Board").
 */

import type { Cell } from './pentomino';

export type CellValue = string | null; // PieceInstance.instanceId, or null when empty

export interface Board {
  rows: number;
  cols: number;
  cells: CellValue[][];
}

export function createEmptyBoard(rows: number, cols: number): Board {
  return {
    rows,
    cols,
    cells: Array.from({ length: rows }, () => Array<CellValue>(cols).fill(null)),
  };
}

export function isInBounds(board: Board, cells: readonly Cell[]): boolean {
  return cells.every(([r, c]) => r >= 0 && r < board.rows && c >= 0 && c < board.cols);
}

export function isOverlapping(board: Board, cells: readonly Cell[]): boolean {
  return cells.some(([r, c]) => board.cells[r][c] !== null);
}

/** A placement is valid only if every cell is in-bounds and currently empty (FR-004). */
export function canPlace(board: Board, cells: readonly Cell[]): boolean {
  return isInBounds(board, cells) && !isOverlapping(board, cells);
}

export function placeCells(board: Board, instanceId: string, cells: readonly Cell[]): Board {
  if (!canPlace(board, cells)) {
    throw new Error(`Cannot place piece "${instanceId}": overlapping another piece or out of bounds`);
  }
  const nextCells = board.cells.map((row) => row.slice());
  for (const [r, c] of cells) {
    nextCells[r][c] = instanceId;
  }
  return { ...board, cells: nextCells };
}

export function removeInstance(board: Board, instanceId: string): Board {
  const nextCells = board.cells.map((row) =>
    row.map((value) => (value === instanceId ? null : value)),
  );
  return { ...board, cells: nextCells };
}

/**
 * A board with every cell occupied is the win condition (FR-005). Because every
 * challenge's total piece area exactly equals the board area, and placements are
 * never allowed to overlap, a full board can only be reached by validly placing
 * every required piece — no extra bookkeeping is needed to confirm "solved".
 */
export function isFull(board: Board): boolean {
  return board.cells.every((row) => row.every((value) => value !== null));
}

/**
 * The positions drawn next to each criterion on the teaching page. They are
 * real positions of one small challenge; what each picture calls out (the
 * walled-off area, the square nothing reaches, the piece that no longer
 * fits…) is computed, not drawn by hand. tests/unit/app/illustrations.test.ts
 * checks each one still shows what its caption says.
 */
import type { PieceTypeId } from '../../domain/pentomino';
import type { Board } from '../../domain/board';
import type { Challenge } from '../../domain/types';
import { fitsSomewhere } from '../../solvers/configurableSolver';
import { boardWith, cellKey, coverCounts, emptyRegions, type PlacementSpec } from './boardAnalysis';
import type { CellMark } from './MiniBoard';

/** A · PENTA 4: L, P, T and V on a 5×4 board. */
export const EXAMPLE_CHALLENGE_ID = 2;

const MOST_CONSTRAINED: PlacementSpec = { typeId: 'L', orientationIndex: 0, row: 0, col: 0 };
const DEAD_REGION: PlacementSpec = { typeId: 'L', orientationIndex: 5, row: 0, col: 0 };
const STRANDED_CELL: PlacementSpec = { typeId: 'L', orientationIndex: 4, row: 1, col: 0 };
const STRANDED_PIECE: PlacementSpec = { typeId: 'P', orientationIndex: 0, row: 1, col: 1 };

function after(challenge: Challenge, placement: PlacementSpec): { board: Board; remaining: PieceTypeId[] } {
  return {
    board: boardWith(challenge.boardRows, challenge.boardCols, [placement]),
    remaining: challenge.requiredPieces.filter((id) => id !== placement.typeId),
  };
}

export function mostConstrainedExample(challenge: Challenge) {
  const { board, remaining } = after(challenge, MOST_CONSTRAINED);
  const counts = coverCounts(board, remaining);
  const min = Math.min(...counts.map((c) => c.count));
  const labels: Record<string, number> = {};
  const marks: Record<string, CellMark> = {};
  for (const { row, col, count } of counts) {
    labels[cellKey(row, col)] = count;
    if (count === min) marks[cellKey(row, col)] = 'focus';
  }
  return { board, labels, marks, first: counts[0].count, min };
}

export function deadRegionExample(challenge: Challenge) {
  const { board } = after(challenge, DEAD_REGION);
  const walledOff = emptyRegions(board)
    .filter((region) => region.length % 5 !== 0)
    .sort((a, b) => a.length - b.length)[0];
  const marks: Record<string, CellMark> = {};
  for (const [row, col] of walledOff ?? []) marks[cellKey(row, col)] = 'bad';
  return { board, marks, size: walledOff?.length ?? 0 };
}

export function strandedCellExample(challenge: Challenge) {
  const { board, remaining } = after(challenge, STRANDED_CELL);
  const marks: Record<string, CellMark> = {};
  const labels: Record<string, string> = {};
  for (const { row, col, count } of coverCounts(board, remaining)) {
    if (count > 0) continue;
    marks[cellKey(row, col)] = 'bad';
    labels[cellKey(row, col)] = '✕';
  }
  return { board, marks, labels, remaining, regionCount: emptyRegions(board).length };
}

export function strandedPieceExample(challenge: Challenge) {
  const { board, remaining } = after(challenge, STRANDED_PIECE);
  return { board, remaining, stranded: remaining.filter((id) => !fitsSomewhere(board, id)) };
}

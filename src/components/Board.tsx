import type { MouseEvent } from 'react';
import { PIECE_TYPES, type Cell, type PieceTypeId } from '../domain/pentomino';
import type { Board as BoardModel, PieceInstance } from '../domain/types';
import { contrastTextColor } from './contrastText';
import './Board.css';

interface BoardProps {
  board: BoardModel;
  pieces: readonly PieceInstance[];
  onCellClick?: (row: number, col: number, event: MouseEvent<HTMLButtonElement>) => void;
  /** Preview of where the held piece would land; `valid` is false when it
   * would overlap a piece already there. */
  ghost?: { cells: readonly Cell[]; valid: boolean } | null;
  /** "row,col" keys of cells holding overlapping pieces. */
  conflictKeys?: ReadonlySet<string>;
  /** Cell side in px (manual play sizes the board to its arena). Without
   * it, cells keep the fixed size from Board.css. */
  cellSize?: number;
}

export function Board({ board, pieces, onCellClick, ghost, conflictKeys, cellSize }: BoardProps) {
  const typeByInstance = new Map<string, PieceTypeId>(pieces.map((p) => [p.instanceId, p.typeId]));
  const ghostKeys = ghost ? new Set(ghost.cells.map(([r, c]) => `${r},${c}`)) : null;
  const sizeStyle =
    cellSize !== undefined
      ? { width: cellSize, height: cellSize, fontSize: Math.max(10, Math.round(cellSize * 0.3)) }
      : undefined;

  return (
    <div
      data-testid="board"
      className="board"
      style={{ gridTemplateColumns: `repeat(${board.cols}, ${cellSize !== undefined ? `${cellSize}px` : 'auto'})` }}
    >
      {board.cells.map((rowCells, row) =>
        rowCells.map((cellValue, col) => {
          const typeId = cellValue ? typeByInstance.get(cellValue) : undefined;
          const color = typeId ? PIECE_TYPES[typeId].color : undefined;
          const key = `${row},${col}`;
          const isConflict = conflictKeys?.has(key) ?? false;
          const ghostClass = ghostKeys?.has(key)
            ? ghost!.valid
              ? ' board-cell--ghost-valid'
              : ' board-cell--ghost-invalid'
            : '';
          return (
            <button
              key={`${row}-${col}`}
              type="button"
              data-testid={`board-cell-${row}-${col}`}
              data-occupied={cellValue !== null}
              data-conflict={isConflict}
              data-piece-id={cellValue ?? undefined}
              className={`board-cell${isConflict ? ' board-cell--conflict' : ''}${ghostClass}`}
              style={{
                ...sizeStyle,
                ...(color ? { backgroundColor: color, color: contrastTextColor(color) } : undefined),
              }}
              aria-label={
                typeId ? `${row},${col}: ${typeId}${isConflict ? ' (overlap)' : ''}` : `${row},${col}: empty`
              }
              onClick={(event) => onCellClick?.(row, col, event)}
            >
              {typeId ?? ''}
            </button>
          );
        }),
      )}
    </div>
  );
}

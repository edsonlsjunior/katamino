import { useState } from 'react';
import { cellsAt, PIECE_TYPES, type PieceTypeId } from '../domain/pentomino';
import { canPlace } from '../domain/board';
import type { Board as BoardModel, PieceInstance } from '../domain/types';
import { contrastTextColor } from './contrastText';
import './Board.css';

interface BoardProps {
  board: BoardModel;
  pieces: readonly PieceInstance[];
  selectedPiece: PieceInstance | null;
  onCellClick: (row: number, col: number) => void;
  onCellRightClick: (row: number, col: number) => void;
}

export function Board({ board, pieces, selectedPiece, onCellClick, onCellRightClick }: BoardProps) {
  const typeByInstance = new Map<string, PieceTypeId>(pieces.map((p) => [p.instanceId, p.typeId]));
  const [hovered, setHovered] = useState<{ row: number; col: number } | null>(null);

  const ghostCells = (() => {
    if (!selectedPiece || !hovered) return null;
    const cells = cellsAt(selectedPiece.typeId, selectedPiece.orientationIndex, [hovered.row, hovered.col]);
    return { cells, valid: canPlace(board, cells) };
  })();
  const ghostKeys = ghostCells ? new Set(ghostCells.cells.map(([r, c]) => `${r},${c}`)) : null;

  return (
    <div
      data-testid="board"
      className="board"
      style={{ gridTemplateColumns: `repeat(${board.cols}, 1fr)` }}
    >
      {board.cells.map((rowCells, row) =>
        rowCells.map((cellValue, col) => {
          const typeId = cellValue ? typeByInstance.get(cellValue) : undefined;
          const color = typeId ? PIECE_TYPES[typeId].color : undefined;
          const isGhost = ghostKeys?.has(`${row},${col}`) ?? false;
          const ghostClass = isGhost ? (ghostCells!.valid ? ' board-cell--ghost-valid' : ' board-cell--ghost-invalid') : '';
          return (
            <button
              key={`${row}-${col}`}
              type="button"
              data-testid={`board-cell-${row}-${col}`}
              data-occupied={cellValue !== null}
              className={`board-cell${ghostClass}`}
              style={color ? { backgroundColor: color, color: contrastTextColor(color) } : undefined}
              aria-label={
                typeId ? `${row},${col}: ${typeId}` : `${row},${col}: empty`
              }
              onClick={() => onCellClick(row, col)}
              onContextMenu={(event) => {
                event.preventDefault();
                onCellRightClick(row, col);
              }}
              onMouseEnter={() => setHovered({ row, col })}
              onMouseLeave={() => setHovered((h) => (h?.row === row && h?.col === col ? null : h))}
            >
              {typeId ?? ''}
            </button>
          );
        }),
      )}
    </div>
  );
}

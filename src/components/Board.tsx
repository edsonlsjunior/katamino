import { PIECE_TYPES, type PieceTypeId } from '../domain/pentomino';
import type { Board as BoardModel, PieceInstance } from '../domain/types';
import { contrastTextColor } from './contrastText';
import './Board.css';

interface BoardProps {
  board: BoardModel;
  pieces: readonly PieceInstance[];
  onCellClick: (row: number, col: number) => void;
}

export function Board({ board, pieces, onCellClick }: BoardProps) {
  const typeByInstance = new Map<string, PieceTypeId>(pieces.map((p) => [p.instanceId, p.typeId]));

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
          return (
            <button
              key={`${row}-${col}`}
              type="button"
              data-testid={`board-cell-${row}-${col}`}
              data-occupied={cellValue !== null}
              className="board-cell"
              style={color ? { backgroundColor: color, color: contrastTextColor(color) } : undefined}
              aria-label={
                typeId ? `${row},${col}: ${typeId}` : `${row},${col}: empty`
              }
              onClick={() => onCellClick(row, col)}
            >
              {typeId ?? ''}
            </button>
          );
        }),
      )}
    </div>
  );
}

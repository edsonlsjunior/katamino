import { useEffect, useRef, useState } from 'react';
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
  /** Size the cells so the board fills this element's box (manual play).
   * Without it, cells keep the fixed size from Board.css. */
  fitTo?: React.RefObject<HTMLElement>;
}

const MIN_CELL_PX = 20;
const GRID_GAP_PX = 2;

/**
 * Cell size in px that makes the board (board.cols x board.rows cells, plus
 * gaps) as large as possible while fitting entirely inside the given
 * container box — the "no scroll, no distortion" sizing the manual-play
 * screen asks for. Recomputed whenever the container is resized.
 */
function useFittedCellSize(
  containerRef: React.RefObject<HTMLElement>,
  fitTo: React.RefObject<HTMLElement> | undefined,
  cols: number,
  rows: number,
) {
  const [cellSize, setCellSize] = useState<number | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    const area = fitTo?.current;
    if (!el || !area) {
      setCellSize(null);
      return;
    }

    function compute() {
      const rect = area!.getBoundingClientRect();
      const style = getComputedStyle(el!);
      const padX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
      const padY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
      const availableW = rect.width - padX - GRID_GAP_PX * (cols - 1);
      const availableH = rect.height - padY - GRID_GAP_PX * (rows - 1);
      const size = Math.floor(Math.min(availableW / cols, availableH / rows));
      setCellSize(Math.max(MIN_CELL_PX, size));
    }

    compute();
    const observer = new ResizeObserver(compute);
    observer.observe(area);
    window.addEventListener('resize', compute);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', compute);
    };
  }, [containerRef, fitTo, cols, rows]);

  return cellSize;
}

export function Board({ board, pieces, selectedPiece, onCellClick, onCellRightClick, fitTo }: BoardProps) {
  const typeByInstance = new Map<string, PieceTypeId>(pieces.map((p) => [p.instanceId, p.typeId]));
  const [hovered, setHovered] = useState<{ row: number; col: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const cellSize = useFittedCellSize(containerRef, fitTo, board.cols, board.rows);

  const ghostCells = (() => {
    if (!selectedPiece || !hovered) return null;
    const cells = cellsAt(selectedPiece.typeId, selectedPiece.orientationIndex, [hovered.row, hovered.col]);
    return { cells, valid: canPlace(board, cells) };
  })();
  const ghostKeys = ghostCells ? new Set(ghostCells.cells.map(([r, c]) => `${r},${c}`)) : null;

  return (
    <div
      ref={containerRef}
      data-testid="board"
      className="board"
      style={{ gridTemplateColumns: `repeat(${board.cols}, ${cellSize === null ? 'auto' : `${cellSize}px`})` }}
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
              style={{
                ...(cellSize !== null
                  ? { width: cellSize, height: cellSize, fontSize: Math.max(10, Math.round(cellSize * 0.3)) }
                  : undefined),
                ...(color ? { backgroundColor: color, color: contrastTextColor(color) } : undefined),
              }}
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

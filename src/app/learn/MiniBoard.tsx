import type { CSSProperties } from 'react';
import { PIECE_TYPES, type Cell, type PieceTypeId } from '../../domain/pentomino';
import type { Board } from '../../domain/board';
import { contrastTextColor } from '../../components/contrastText';
import { cellKey } from './boardAnalysis';

export type CellMark = 'bad' | 'focus';

interface MiniBoardProps {
  /** Cells hold piece type ids (or null when empty). */
  board: Board;
  /** Side of one cell, in px. */
  cell: number;
  /** Empty cells to call out, keyed by "row,col". */
  marks?: Readonly<Record<string, CellMark>>;
  /** Text to write inside cells, keyed by "row,col". */
  labels?: Readonly<Record<string, string | number>>;
  /** Accessible description; without it the board is decorative. */
  label?: string;
}

function pieceColor(value: string | null): string | undefined {
  return value !== null && value in PIECE_TYPES ? PIECE_TYPES[value as PieceTypeId].color : undefined;
}

/** A small, static picture of a board. */
export function MiniBoard({ board, cell, marks, labels, label }: MiniBoardProps) {
  const style = {
    '--mini-cell': `${cell}px`,
    gridTemplateColumns: `repeat(${board.cols}, var(--mini-cell))`,
  } as CSSProperties;

  return (
    <div
      className="mini-board"
      style={style}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {board.cells.flatMap((row, r) =>
        row.map((value, c) => {
          const key = cellKey(r, c);
          const mark = marks?.[key];
          return (
            <span
              key={key}
              className={`mini-board__cell${mark ? ` mini-board__cell--${mark}` : ''}`}
              style={{ backgroundColor: pieceColor(value) }}
            >
              {labels?.[key]}
            </span>
          );
        }),
      )}
    </div>
  );
}

interface PieceGlyphProps {
  typeId: PieceTypeId;
  orientationIndex?: number;
  cell: number;
  /** Write the piece's letter on it. */
  lettered?: boolean;
}

/** One pentomino, drawn alone in a given orientation. */
export function PieceGlyph({ typeId, orientationIndex = 0, cell, lettered = false }: PieceGlyphProps) {
  const { color, orientations } = PIECE_TYPES[typeId];
  const cells: readonly Cell[] = orientations[orientationIndex];
  const cols = Math.max(...cells.map(([, c]) => c)) + 1;
  const style = {
    '--mini-cell': `${cell}px`,
    gridTemplateColumns: `repeat(${cols}, var(--mini-cell))`,
  } as CSSProperties;
  // The letter goes on the cell closest to the middle of the shape.
  const middle = cells[Math.floor(cells.length / 2)];

  return (
    <span className="piece-glyph" style={style} aria-hidden="true">
      {cells.map(([r, c]) => (
        <span
          key={cellKey(r, c)}
          className="piece-glyph__cell"
          style={{
            gridRow: r + 1,
            gridColumn: c + 1,
            backgroundColor: color,
            color: contrastTextColor(color),
          }}
        >
          {lettered && r === middle[0] && c === middle[1] ? typeId : null}
        </span>
      ))}
    </span>
  );
}

import type { CSSProperties, MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { PIECE_TYPES } from '../domain/pentomino';
import type { PieceInstance } from '../domain/types';
import './PieceTray.css';

export type PieceTrayPosition = 'top' | 'right' | 'bottom' | 'left';

interface PieceTrayProps {
  /** Every piece whose starting slot is in this ring. */
  pieces: readonly PieceInstance[];
  /** Whether a piece has left its slot (in hand, on the board or loose elsewhere). */
  isAway: (piece: PieceInstance) => boolean;
  /** Without it the pieces are only shown, not pickable (solver mode). */
  onPick?: (instanceId: string, event: MouseEvent<HTMLElement>) => void;
  /** Which ring around the board this group renders in — only affects
   * layout direction (row vs. column) and the listbox's aria-label. */
  position: PieceTrayPosition;
  /** Side of the square slot (in cells) reserved for a given piece. */
  slotSpan: (piece: PieceInstance) => number;
}

/** The piece itself, drawn cell by cell at the board's cell size (`--cell`,
 * inherited from the arena). */
export function PieceShape({ instance }: { instance: PieceInstance }) {
  const orientation = PIECE_TYPES[instance.typeId].orientations[instance.orientationIndex];
  const cols = Math.max(...orientation.map(([, c]) => c)) + 1;
  const color = PIECE_TYPES[instance.typeId].color;

  return (
    <div className="piece-shape" style={{ gridTemplateColumns: `repeat(${cols}, var(--cell))` }}>
      {orientation.map(([r, c]) => (
        <span
          key={`${r},${c}`}
          className="piece-shape__cell"
          style={{ gridRow: r + 1, gridColumn: c + 1, backgroundColor: color }}
        />
      ))}
    </div>
  );
}

const POSITION_LABEL_KEYS: Record<PieceTrayPosition, string> = {
  top: 'pieceTray.position.top',
  right: 'pieceTray.position.right',
  bottom: 'pieceTray.position.bottom',
  left: 'pieceTray.position.left',
};

export function PieceTray({ pieces, isAway, onPick, position, slotSpan }: PieceTrayProps) {
  const { t } = useTranslation();
  const isVertical = position === 'left' || position === 'right';

  if (pieces.length === 0) return null;

  return (
    <div
      className={`piece-tray__list${isVertical ? ' piece-tray__list--column' : ''}`}
      role={onPick ? 'listbox' : 'group'}
      aria-label={`${t('pieceTray.label', 'Available pieces')} — ${t(POSITION_LABEL_KEYS[position])}`}
    >
      {pieces.map((piece) => {
        const slotStyle = { '--span': slotSpan(piece) } as CSSProperties;
        // A piece that left keeps its (empty) slot so the others don't shift around.
        if (isAway(piece)) {
          return <span key={piece.instanceId} className="piece-tray__slot" style={slotStyle} aria-hidden="true" />;
        }
        if (!onPick) {
          return (
            <span
              key={piece.instanceId}
              role="img"
              aria-label={piece.typeId}
              data-testid={`tray-piece-${piece.instanceId}`}
              className="piece-tray__slot piece-tray__item piece-tray__item--static"
              style={slotStyle}
            >
              <PieceShape instance={piece} />
            </span>
          );
        }
        return (
          <button
            key={piece.instanceId}
            type="button"
            data-testid={`tray-piece-${piece.instanceId}`}
            data-piece-id={piece.instanceId}
            role="option"
            aria-selected={false}
            aria-label={piece.typeId}
            className="piece-tray__slot piece-tray__item"
            style={slotStyle}
            onClick={(event) => onPick(piece.instanceId, event)}
          >
            <PieceShape instance={piece} />
          </button>
        );
      })}
    </div>
  );
}

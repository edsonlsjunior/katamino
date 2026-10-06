import { useTranslation } from 'react-i18next';
import { PIECE_TYPES } from '../domain/pentomino';
import type { PieceInstance } from '../domain/types';
import './PieceTray.css';

export type PieceTrayPosition = 'top' | 'right' | 'bottom' | 'left';

interface PieceTrayProps {
  pieces: readonly PieceInstance[];
  selectedInstanceId: string | null;
  onSelect: (instanceId: string) => void;
  onDeselect: () => void;
  onRotate: () => void;
  /** Which ring around the board this group renders in — only affects
   * layout direction (row vs. column wrap) and the listbox's aria-label. */
  position: PieceTrayPosition;
}

function PiecePreview({ instance }: { instance: PieceInstance }) {
  const orientation = PIECE_TYPES[instance.typeId].orientations[instance.orientationIndex];
  const rows = Math.max(...orientation.map(([r]) => r)) + 1;
  const cols = Math.max(...orientation.map(([, c]) => c)) + 1;
  const occupied = new Set(orientation.map(([r, c]) => `${r},${c}`));
  const color = PIECE_TYPES[instance.typeId].color;

  return (
    <div
      className="piece-preview"
      style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)` }}
    >
      {Array.from({ length: rows * cols }, (_, i) => {
        const r = Math.floor(i / cols);
        const c = i % cols;
        const filled = occupied.has(`${r},${c}`);
        return (
          <span
            key={i}
            className="piece-preview__cell"
            style={{ backgroundColor: filled ? color : 'transparent' }}
          />
        );
      })}
    </div>
  );
}

const POSITION_LABEL_KEYS: Record<PieceTrayPosition, string> = {
  top: 'pieceTray.position.top',
  right: 'pieceTray.position.right',
  bottom: 'pieceTray.position.bottom',
  left: 'pieceTray.position.left',
};

export function PieceTray({ pieces, selectedInstanceId, onSelect, onDeselect, onRotate, position }: PieceTrayProps) {
  const { t } = useTranslation();
  const unplaced = pieces.filter((p) => p.position === null);
  const isVertical = position === 'left' || position === 'right';

  if (unplaced.length === 0) return null;

  return (
    <div
      className={`piece-tray__list${isVertical ? ' piece-tray__list--column' : ''}`}
      role="listbox"
      aria-label={`${t('pieceTray.label', 'Available pieces')} — ${t(POSITION_LABEL_KEYS[position])}`}
    >
      {unplaced.map((piece) => {
        const isSelected = piece.instanceId === selectedInstanceId;
        return (
          <button
            key={piece.instanceId}
            type="button"
            data-testid={`tray-piece-${piece.instanceId}`}
            data-selected={isSelected}
            role="option"
            aria-selected={isSelected}
            className={`piece-tray__item${isSelected ? ' piece-tray__item--selected' : ''}`}
            onClick={() => (isSelected ? onDeselect() : onSelect(piece.instanceId))}
            onContextMenu={(event) => {
              event.preventDefault();
              onSelect(piece.instanceId);
              onRotate();
            }}
          >
            <PiecePreview instance={piece} />
            <span>{piece.typeId}</span>
          </button>
        );
      })}
    </div>
  );
}

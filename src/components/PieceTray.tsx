import { useTranslation } from 'react-i18next';
import { PIECE_TYPES } from '../domain/pentomino';
import type { PieceInstance } from '../domain/types';
import './PieceTray.css';

interface PieceTrayProps {
  pieces: readonly PieceInstance[];
  selectedInstanceId: string | null;
  onSelect: (instanceId: string) => void;
  onRotate: () => void;
  onFlip: () => void;
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

export function PieceTray({ pieces, selectedInstanceId, onSelect, onRotate, onFlip }: PieceTrayProps) {
  const { t } = useTranslation();
  const unplaced = pieces.filter((p) => p.position === null);

  return (
    <div className="piece-tray">
      <div className="piece-tray__list" role="listbox" aria-label={t('pieceTray.label', 'Available pieces')}>
        {unplaced.map((piece) => (
          <button
            key={piece.instanceId}
            type="button"
            data-testid={`tray-piece-${piece.instanceId}`}
            data-selected={piece.instanceId === selectedInstanceId}
            role="option"
            aria-selected={piece.instanceId === selectedInstanceId}
            className={`piece-tray__item${piece.instanceId === selectedInstanceId ? ' piece-tray__item--selected' : ''}`}
            onClick={() => onSelect(piece.instanceId)}
          >
            <PiecePreview instance={piece} />
            <span>{piece.typeId}</span>
          </button>
        ))}
      </div>
      <div className="piece-tray__controls">
        <button type="button" onClick={onRotate} disabled={!selectedInstanceId}>
          {t('pieceTray.rotate', 'Rotate')}
        </button>
        <button type="button" onClick={onFlip} disabled={!selectedInstanceId}>
          {t('pieceTray.flip', 'Flip')}
        </button>
      </div>
    </div>
  );
}

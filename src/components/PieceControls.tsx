import { useTranslation } from 'react-i18next';
import './PieceControls.css';

interface PieceControlsProps {
  hasSelection: boolean;
  onRotate: () => void;
  onFlip: () => void;
}

/**
 * Rotate/Flip controls for whichever piece is currently selected, rendered
 * once regardless of which ring around the board that piece's button lives
 * in — keeps a single, always-reachable keyboard/touch path to rotate/flip
 * (research.md §3/§12) even though pieces themselves are split across four
 * groups (PieceTray position="top"/"right"/"bottom"/"left").
 */
export function PieceControls({ hasSelection, onRotate, onFlip }: PieceControlsProps) {
  const { t } = useTranslation();

  return (
    <div className="piece-controls">
      <div className="piece-controls__buttons">
        <button type="button" onClick={onRotate} disabled={!hasSelection}>
          {t('pieceTray.rotate', 'Rotate')}
        </button>
        <button type="button" onClick={onFlip} disabled={!hasSelection}>
          {t('pieceTray.flip', 'Flip')}
        </button>
      </div>
      <p className="piece-controls__hint">{t('pieceTray.rotateHint', 'Right-click or press R to rotate')}</p>
    </div>
  );
}

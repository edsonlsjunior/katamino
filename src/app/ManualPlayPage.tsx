import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Board } from '../components/Board';
import { PieceTray } from '../components/PieceTray';
import { SolvedBanner } from '../components/SolvedBanner';
import { getChallengeById } from '../data/loadChallenges';
import { useManualAttemptStore } from '../state/manualAttempt';
import { useNavigationStore } from '../state/navigation';

const INVALID_FEEDBACK_MS = 1500;

interface ManualPlayPageProps {
  challengeId: number;
}

export function ManualPlayPage({ challengeId }: ManualPlayPageProps) {
  const { t } = useTranslation();
  const goToChallenges = useNavigationStore((s) => s.goToChallenges);

  const loadChallenge = useManualAttemptStore((s) => s.loadChallenge);
  const board = useManualAttemptStore((s) => s.board);
  const pieces = useManualAttemptStore((s) => s.pieces);
  const selectedInstanceId = useManualAttemptStore((s) => s.selectedInstanceId);
  const isSolved = useManualAttemptStore((s) => s.isSolved);
  const selectPiece = useManualAttemptStore((s) => s.selectPiece);
  const rotateSelected = useManualAttemptStore((s) => s.rotateSelected);
  const flipSelected = useManualAttemptStore((s) => s.flipSelected);
  const placeSelectedAt = useManualAttemptStore((s) => s.placeSelectedAt);
  const removePiece = useManualAttemptStore((s) => s.removePiece);
  const reset = useManualAttemptStore((s) => s.reset);

  const [showInvalid, setShowInvalid] = useState(false);
  const invalidTimeout = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const challenge = getChallengeById(challengeId);
    if (challenge) loadChallenge(challenge);
  }, [challengeId, loadChallenge]);

  useEffect(() => () => clearTimeout(invalidTimeout.current), []);

  function flashInvalid() {
    setShowInvalid(true);
    clearTimeout(invalidTimeout.current);
    invalidTimeout.current = setTimeout(() => setShowInvalid(false), INVALID_FEEDBACK_MS);
  }

  function handleCellClick(row: number, col: number) {
    // A piece selected from the tray always attempts a placement first — including
    // onto an occupied cell, so overlap is rejected with feedback (FR-004) rather
    // than silently removing the piece already there.
    if (selectedInstanceId) {
      const placed = placeSelectedAt(row, col);
      if (!placed) flashInvalid();
      else setShowInvalid(false);
      return;
    }
    const occupant = board.cells[row]?.[col];
    if (occupant) {
      removePiece(occupant);
      setShowInvalid(false);
    }
  }

  return (
    <div className="manual-play-page">
      <button type="button" onClick={goToChallenges}>
        {t('common.back')}
      </button>

      <div className="manual-play-page__layout">
        <Board board={board} pieces={pieces} onCellClick={handleCellClick} />
        <PieceTray
          pieces={pieces}
          selectedInstanceId={selectedInstanceId}
          onSelect={selectPiece}
          onRotate={rotateSelected}
          onFlip={flipSelected}
        />
      </div>

      {showInvalid && (
        <p data-testid="invalid-feedback" role="alert">
          {t('manualPlay.invalid', "That piece can't go there.")}
        </p>
      )}

      {isSolved && <SolvedBanner />}

      <button type="button" onClick={reset}>
        {t('manualPlay.reset', 'Reset')}
      </button>
    </div>
  );
}

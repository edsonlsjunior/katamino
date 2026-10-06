import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Board } from '../components/Board';
import { PieceTray, type PieceTrayPosition } from '../components/PieceTray';
import { PieceControls } from '../components/PieceControls';
import { SolvedBanner } from '../components/SolvedBanner';
import { getChallengeById } from '../data/loadChallenges';
import { useManualAttemptStore } from '../state/manualAttempt';
import { useNavigationStore } from '../state/navigation';
import type { PieceInstance } from '../domain/types';

const INVALID_FEEDBACK_MS = 1500;
const RING_ORDER: readonly PieceTrayPosition[] = ['top', 'right', 'bottom', 'left'];

interface ManualPlayPageProps {
  challengeId: number;
}

export function ManualPlayPage({ challengeId }: ManualPlayPageProps) {
  const { t } = useTranslation();
  const goToAutoSolve = useNavigationStore((s) => s.goToAutoSolve);
  const goToManualPlay = useNavigationStore((s) => s.goToManualPlay);

  const loadChallenge = useManualAttemptStore((s) => s.loadChallenge);
  const board = useManualAttemptStore((s) => s.board);
  const pieces = useManualAttemptStore((s) => s.pieces);
  const selectedInstanceId = useManualAttemptStore((s) => s.selectedInstanceId);
  const isSolved = useManualAttemptStore((s) => s.isSolved);
  const selectPiece = useManualAttemptStore((s) => s.selectPiece);
  const deselect = useManualAttemptStore((s) => s.deselect);
  const rotateSelected = useManualAttemptStore((s) => s.rotateSelected);
  const flipSelected = useManualAttemptStore((s) => s.flipSelected);
  const placeSelectedAt = useManualAttemptStore((s) => s.placeSelectedAt);
  const removePiece = useManualAttemptStore((s) => s.removePiece);
  const reset = useManualAttemptStore((s) => s.reset);

  const selectedPiece = useMemo(
    () => pieces.find((p) => p.instanceId === selectedInstanceId) ?? null,
    [pieces, selectedInstanceId],
  );

  // Pieces are split into 4 rings around the board by index (stable across
  // the whole attempt, since `pieces` keeps its original order — only
  // `position`/`orientationIndex` mutate per-piece). Each ring then filters
  // down to its own unplaced pieces at render time.
  const ringGroups = useMemo(() => {
    const groups: Record<PieceTrayPosition, PieceInstance[]> = { top: [], right: [], bottom: [], left: [] };
    pieces.forEach((piece, index) => {
      groups[RING_ORDER[index % 4]].push(piece);
    });
    return groups;
  }, [pieces]);

  const nextChallenge = useMemo(() => getChallengeById(challengeId + 1), [challengeId]);

  const [showInvalid, setShowInvalid] = useState(false);
  const invalidTimeout = useRef<ReturnType<typeof setTimeout>>();
  const fitAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const challenge = getChallengeById(challengeId);
    if (challenge) loadChallenge(challenge);
  }, [challengeId, loadChallenge]);

  useEffect(() => () => clearTimeout(invalidTimeout.current), []);

  // Keyboard accelerators, additive to the always-present Rotate button and
  // on-screen controls (research.md §3/§12): "R" rotates the selected piece,
  // "Escape" puts it back down. Neither is the only way to do either action.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!selectedInstanceId) return;
      if (event.key === 'r' || event.key === 'R') {
        rotateSelected();
      } else if (event.key === 'Escape') {
        deselect();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedInstanceId, rotateSelected, deselect]);

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

  function handleCellRightClick(_row: number, _col: number) {
    if (!selectedInstanceId) return;
    rotateSelected();
  }

  return (
    <div className="manual-play-page">
      <div className="manual-play-page__toolbar">
        <button type="button" onClick={() => goToAutoSolve(challengeId)}>
          {t('nav.autoSolve')}
        </button>
        <button type="button" onClick={reset}>
          {t('manualPlay.reset', 'Reset')}
        </button>
      </div>

      {showInvalid && (
        <p data-testid="invalid-feedback" role="alert">
          {t('manualPlay.invalid', "That piece can't go there.")}
        </p>
      )}

      {isSolved && (
        <div className="manual-play-page__solved-row">
          <SolvedBanner />
          {nextChallenge && (
            <button type="button" className="btn-primary" onClick={() => goToManualPlay(nextChallenge.id)}>
              {t('manualPlay.next', 'Next challenge')}
            </button>
          )}
        </div>
      )}

      <div className="board-arena">
        <div className="board-arena__top">
          <PieceTray
            pieces={ringGroups.top}
            position="top"
            selectedInstanceId={selectedInstanceId}
            onSelect={selectPiece}
            onDeselect={deselect}
            onRotate={rotateSelected}
          />
        </div>
        <div className="board-arena__board-shell">
          <div className="board-arena__fit" ref={fitAreaRef}>
            {/* Side rings are anchored to the board's own edges, so they stay
                next to it however narrow the board is. */}
            <div className="board-arena__anchor">
              <div className="board-arena__left">
                <PieceTray
                  pieces={ringGroups.left}
                  position="left"
                  selectedInstanceId={selectedInstanceId}
                  onSelect={selectPiece}
                  onDeselect={deselect}
                  onRotate={rotateSelected}
                />
              </div>
              <Board
                board={board}
                pieces={pieces}
                selectedPiece={selectedPiece}
                onCellClick={handleCellClick}
                onCellRightClick={handleCellRightClick}
                fitTo={fitAreaRef}
              />
              <div className="board-arena__right">
                <PieceTray
                  pieces={ringGroups.right}
                  position="right"
                  selectedInstanceId={selectedInstanceId}
                  onSelect={selectPiece}
                  onDeselect={deselect}
                  onRotate={rotateSelected}
                />
              </div>
            </div>
          </div>
        </div>
        <div className="board-arena__bottom">
          <PieceTray
            pieces={ringGroups.bottom}
            position="bottom"
            selectedInstanceId={selectedInstanceId}
            onSelect={selectPiece}
            onDeselect={deselect}
            onRotate={rotateSelected}
          />
        </div>
      </div>

      <PieceControls hasSelection={!!selectedInstanceId} onRotate={rotateSelected} onFlip={flipSelected} />
    </div>
  );
}

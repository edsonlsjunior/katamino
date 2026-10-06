import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Board } from '../components/Board';
import { PieceShape, PieceTray, type PieceTrayPosition } from '../components/PieceTray';
import { PieceControls } from '../components/PieceControls';
import { SolvedBanner } from '../components/SolvedBanner';
import { getChallengeById } from '../data/loadChallenges';
import { cellsAt, PIECE_TYPES } from '../domain/pentomino';
import { useManualAttemptStore } from '../state/manualAttempt';
import { useNavigationStore } from '../state/navigation';
import type { PieceInstance } from '../domain/types';
import { BOARD_PADDING_PX, CELL_GAP_PX, planArena, pieceSpan } from './arenaLayout';

const FALLBACK_CELL_PX = 40;
/** How far the pointer must travel with the button down to count as a drag. */
const DRAG_THRESHOLD_PX = 24;

interface ManualPlayPageProps {
  challengeId: number;
}

interface Point {
  x: number;
  y: number;
}

/** Where the held piece would go if dropped at a given pointer position. */
type DropTarget =
  | { kind: 'board'; row: number; col: number }
  | { kind: 'free'; x: number; y: number }
  | { kind: 'none' };

function slotSpan(piece: PieceInstance) {
  return pieceSpan(piece.typeId);
}

/** Bounding box of the piece's current orientation, in cells. */
function pieceDims(piece: PieceInstance) {
  const cells = PIECE_TYPES[piece.typeId].orientations[piece.orientationIndex];
  return {
    w: Math.max(...cells.map(([, c]) => c)) + 1,
    h: Math.max(...cells.map(([r]) => r)) + 1,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function useElementSize(ref: React.RefObject<HTMLElement>) {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    function update() {
      const { width, height } = el!.getBoundingClientRect();
      setSize((prev) => (prev && prev.width === width && prev.height === height ? prev : { width, height }));
    }
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);

  return size;
}

export function ManualPlayPage({ challengeId }: ManualPlayPageProps) {
  const { t } = useTranslation();
  const goToAutoSolve = useNavigationStore((s) => s.goToAutoSolve);
  const goToManualPlay = useNavigationStore((s) => s.goToManualPlay);

  const loadChallenge = useManualAttemptStore((s) => s.loadChallenge);
  const board = useManualAttemptStore((s) => s.board);
  const pieces = useManualAttemptStore((s) => s.pieces);
  const conflictKeys = useManualAttemptStore((s) => s.conflictKeys);
  const freePositions = useManualAttemptStore((s) => s.freePositions);
  const stack = useManualAttemptStore((s) => s.stack);
  const selectedInstanceId = useManualAttemptStore((s) => s.selectedInstanceId);
  const isSolved = useManualAttemptStore((s) => s.isSolved);
  const pickUp = useManualAttemptStore((s) => s.pickUp);
  const cancelHold = useManualAttemptStore((s) => s.cancelHold);
  const rotateSelected = useManualAttemptStore((s) => s.rotateSelected);
  const flipSelected = useManualAttemptStore((s) => s.flipSelected);
  const placeSelectedAt = useManualAttemptStore((s) => s.placeSelectedAt);
  const dropSelectedAt = useManualAttemptStore((s) => s.dropSelectedAt);
  const reset = useManualAttemptStore((s) => s.reset);

  const heldPiece = useMemo(
    () => pieces.find((p) => p.instanceId === selectedInstanceId) ?? null,
    [pieces, selectedInstanceId],
  );
  const conflictSet = useMemo(() => new Set(conflictKeys), [conflictKeys]);

  // Which ring each piece starts in (and the cell size) depends only on the
  // arena size and the challenge's piece types, so nothing moves or resizes
  // as pieces are rotated or placed.
  const arenaRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const arenaSize = useElementSize(arenaRef);
  const plan = useMemo(
    () => (arenaSize ? planArena(arenaSize.width, arenaSize.height, board.cols, board.rows, pieces) : null),
    [arenaSize, board.cols, board.rows, pieces],
  );
  const cellSize = plan?.layout.cellSize ?? FALLBACK_CELL_PX;
  const pitch = cellSize + CELL_GAP_PX;
  const spanPx = (cells: number) => cells * cellSize + (cells - 1) * CELL_GAP_PX;

  // Top-left of the board's first cell inside the arena: the origin loose
  // pieces' positions are relative to.
  const [boardOrigin, setBoardOrigin] = useState<Point | null>(null);
  useLayoutEffect(() => {
    const arena = arenaRef.current;
    const boardEl = boardRef.current;
    if (!arena || !boardEl) return;
    const a = arena.getBoundingClientRect();
    const b = boardEl.getBoundingClientRect();
    const x = b.left - a.left + BOARD_PADDING_PX;
    const y = b.top - a.top + BOARD_PADDING_PX;
    setBoardOrigin((prev) => (prev && prev.x === x && prev.y === y ? prev : { x, y }));
  }, [plan]);

  // The held piece follows the pointer everywhere, centered on it.
  const [pointer, setPointer] = useState<Point | null>(null);
  useEffect(() => {
    if (!selectedInstanceId) return;
    function handlePointerMove(event: PointerEvent) {
      setPointer({ x: event.clientX, y: event.clientY });
    }
    window.addEventListener('pointermove', handlePointerMove);
    return () => window.removeEventListener('pointermove', handlePointerMove);
  }, [selectedInstanceId]);

  // With the pointer over the board the piece snaps to the grid (nudged to
  // stay inside); anywhere else it is left loose exactly where it is.
  function dropTargetAt(point: Point, piece: PieceInstance): DropTarget {
    const arena = arenaRef.current?.getBoundingClientRect();
    const boardRect = boardRef.current?.getBoundingClientRect();
    if (!arena || !boardRect) return { kind: 'none' };

    const { w, h } = pieceDims(piece);
    const left = point.x - spanPx(w) / 2;
    const top = point.y - spanPx(h) / 2;
    const originX = boardRect.left + BOARD_PADDING_PX;
    const originY = boardRect.top + BOARD_PADDING_PX;

    const overBoard =
      point.x >= boardRect.left && point.x <= boardRect.right && point.y >= boardRect.top && point.y <= boardRect.bottom;
    if (overBoard) {
      if (w > board.cols || h > board.rows) return { kind: 'none' };
      return {
        kind: 'board',
        row: clamp(Math.round((top - originY) / pitch), 0, board.rows - h),
        col: clamp(Math.round((left - originX) / pitch), 0, board.cols - w),
      };
    }
    return {
      kind: 'free',
      x: (clamp(left, arena.left, arena.right - spanPx(w)) - originX) / pitch,
      y: (clamp(top, arena.top, arena.bottom - spanPx(h)) - originY) / pitch,
    };
  }

  const [target, setTarget] = useState<DropTarget | null>(null);
  useLayoutEffect(() => {
    setTarget(heldPiece && pointer ? dropTargetAt(pointer, heldPiece) : null);
    // dropTargetAt only reads layout that changes together with these deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heldPiece, pointer, cellSize, board.cols, board.rows]);

  const ghost = useMemo(() => {
    if (!heldPiece || target?.kind !== 'board') return null;
    const cells = cellsAt(heldPiece.typeId, heldPiece.orientationIndex, [target.row, target.col]);
    return { cells, valid: cells.every(([r, c]) => board.cells[r][c] === null) };
  }, [heldPiece, target, board]);

  const nextChallenge = useMemo(() => getChallengeById(challengeId + 1), [challengeId]);

  useEffect(() => {
    const challenge = getChallengeById(challengeId);
    if (challenge) loadChallenge(challenge);
  }, [challengeId, loadChallenge]);

  // Keyboard accelerators, additive to the always-present Rotate/Flip buttons
  // (research.md §3/§12): "R" rotates the held piece, "E" mirrors it and
  // "Escape" puts it back where it was picked up from.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!selectedInstanceId) return;
      if (event.key === 'r' || event.key === 'R') {
        rotateSelected();
      } else if (event.key === 'e' || event.key === 'E') {
        flipSelected();
      } else if (event.key === 'Escape') {
        cancelHold();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedInstanceId, rotateSelected, flipSelected, cancelHold]);

  // Right-click anywhere rotates the held piece; on a loose piece with
  // nothing held, it picks that piece up first. (The browser's own context
  // menu is suppressed app-wide, see App.tsx.)
  useEffect(() => {
    function handleContextMenu(event: MouseEvent) {
      const store = useManualAttemptStore.getState();
      if (!store.selectedInstanceId) {
        const id = (event.target as Element | null)?.closest?.('[data-piece-id]')?.getAttribute('data-piece-id');
        if (!id) return;
        setPointer({ x: event.clientX, y: event.clientY });
        store.pickUp(id);
      }
      useManualAttemptStore.getState().rotateSelected();
    }
    window.addEventListener('contextmenu', handleContextMenu);
    return () => window.removeEventListener('contextmenu', handleContextMenu);
  }, []);

  // Press-and-drag mirrors the piece along the dragged direction: sideways
  // swaps its left and right, up/down swaps its top and bottom. Starting the
  // drag on a piece that isn't in hand picks it up first. One flip per drag,
  // and the click that ends the drag is swallowed so it doesn't drop the piece.
  useEffect(() => {
    let drag: { x: number; y: number; pieceId: string | null } | null = null;
    let swallowClick = false;

    function handlePointerDown(event: PointerEvent) {
      swallowClick = false;
      if (event.button !== 0) return;
      const pieceId =
        (event.target as Element | null)?.closest?.('[data-piece-id]')?.getAttribute('data-piece-id') ?? null;
      drag = { x: event.clientX, y: event.clientY, pieceId };
    }
    function handlePointerMove(event: PointerEvent) {
      if (!drag) return;
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < DRAG_THRESHOLD_PX) return;
      const { pieceId } = drag;
      drag = null;

      const store = useManualAttemptStore.getState();
      if (!store.selectedInstanceId) {
        if (!pieceId) return;
        setPointer({ x: event.clientX, y: event.clientY });
        store.pickUp(pieceId);
      }
      useManualAttemptStore.getState().flipSelected(Math.abs(dx) >= Math.abs(dy) ? 'horizontal' : 'vertical');
      swallowClick = true;
    }
    function handlePointerEnd() {
      drag = null;
    }
    function handleClickCapture(event: MouseEvent) {
      if (!swallowClick) return;
      swallowClick = false;
      event.stopPropagation();
      event.preventDefault();
    }

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerEnd);
    window.addEventListener('pointercancel', handlePointerEnd);
    window.addEventListener('click', handleClickCapture, true);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerEnd);
      window.removeEventListener('pointercancel', handlePointerEnd);
      window.removeEventListener('click', handleClickCapture, true);
    };
  }, []);

  function pick(instanceId: string, event: ReactMouseEvent<HTMLElement>) {
    // With a piece already in hand this click is a drop — let it reach the arena.
    if (selectedInstanceId) return;
    event.stopPropagation();
    if (event.detail === 0) {
      // Keyboard activation has no pointer position: hold it over the element.
      const rect = event.currentTarget.getBoundingClientRect();
      setPointer({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
    } else {
      setPointer({ x: event.clientX, y: event.clientY });
    }
    pickUp(instanceId);
  }

  function handleArenaClick(event: ReactMouseEvent<HTMLDivElement>) {
    if (!heldPiece || event.detail === 0) return;
    const drop = dropTargetAt({ x: event.clientX, y: event.clientY }, heldPiece);
    if (drop.kind === 'board') placeSelectedAt(drop.row, drop.col);
    else if (drop.kind === 'free') dropSelectedAt(drop.x, drop.y);
  }

  function handleCellClick(row: number, col: number, event: ReactMouseEvent<HTMLButtonElement>) {
    if (heldPiece) {
      // Mouse drops are resolved from the pointer position by the arena;
      // keyboard activation of a cell places the piece with its corner there.
      if (event.detail !== 0) return;
      event.stopPropagation();
      const { w, h } = pieceDims(heldPiece);
      if (w > board.cols || h > board.rows) return;
      placeSelectedAt(clamp(row, 0, board.rows - h), clamp(col, 0, board.cols - w));
      return;
    }
    const occupant = board.cells[row]?.[col];
    if (occupant) pick(occupant, event);
  }

  function isAway(piece: PieceInstance) {
    return (
      piece.instanceId === selectedInstanceId ||
      piece.position !== null ||
      freePositions[piece.instanceId] !== undefined
    );
  }

  function renderRing(position: PieceTrayPosition, span: number) {
    // Opposite rings reserve the same thickness (even when one is empty) so
    // the board stays centered.
    if (!plan || span === 0) return null;
    return (
      <div className={`board-arena__ring board-arena__${position}`} style={{ '--span': span } as CSSProperties}>
        <PieceTray
          pieces={plan.rings[position]}
          position={position}
          slotSpan={slotSpan}
          isAway={isAway}
          onPick={pick}
        />
      </div>
    );
  }

  const heldDims = heldPiece ? pieceDims(heldPiece) : null;

  return (
    <div className="manual-play-page">
      <div className="manual-play-page__toolbar">
        <button type="button" onClick={() => goToAutoSolve(challengeId)}>
          {t('nav.autoSolve')}
        </button>
        <button type="button" onClick={reset}>
          {t('manualPlay.reset', 'Reset')}
        </button>

        <div className="manual-play-page__status">
          {conflictKeys.length > 0 && (
            <p data-testid="invalid-feedback" role="alert" className="manual-play-page__warning">
              {t('manualPlay.overlap', 'Pieces overlap — move the ones marked in red to continue.')}
            </p>
          )}
          {isSolved && (
            <>
              <SolvedBanner />
              {nextChallenge && (
                <button type="button" className="btn-primary" onClick={() => goToManualPlay(nextChallenge.id)}>
                  {t('manualPlay.next', 'Next challenge')}
                </button>
              )}
            </>
          )}
        </div>

        <PieceControls hasSelection={!!selectedInstanceId} onRotate={rotateSelected} onFlip={() => flipSelected()} />
      </div>

      <div
        className={`board-arena${heldPiece ? ' board-arena--holding' : ''}`}
        ref={arenaRef}
        style={{ '--cell': `${cellSize}px` } as CSSProperties}
        onClick={handleArenaClick}
      >
        {plan && (
          <>
            {renderRing('top', plan.layout.bandSpan)}
            {renderRing('left', plan.layout.sideSpan)}
            <div className="board-arena__board" ref={boardRef}>
              <Board
                board={board}
                pieces={pieces}
                onCellClick={handleCellClick}
                ghost={ghost}
                conflictKeys={conflictSet}
                cellSize={cellSize}
              />
            </div>
            {renderRing('right', plan.layout.sideSpan)}
            {renderRing('bottom', plan.layout.bandSpan)}
          </>
        )}

        {/* Pieces left loose outside the board, in the order they were dropped. */}
        {boardOrigin &&
          stack.map((instanceId) => {
            const free = freePositions[instanceId];
            const piece = pieces.find((p) => p.instanceId === instanceId);
            if (!free || !piece) return null;
            return (
              <button
                key={instanceId}
                type="button"
                data-testid={`free-piece-${instanceId}`}
                data-piece-id={instanceId}
                aria-label={piece.typeId}
                className="piece-tray__item board-arena__loose"
                style={{ left: boardOrigin.x + free.x * pitch, top: boardOrigin.y + free.y * pitch }}
                onClick={(event) => pick(instanceId, event)}
              >
                <PieceShape instance={piece} />
              </button>
            );
          })}

        {heldPiece && heldDims && pointer && (
          <div
            className="board-arena__held"
            data-testid="held-piece"
            style={{ left: pointer.x - spanPx(heldDims.w) / 2, top: pointer.y - spanPx(heldDims.h) / 2 }}
          >
            <PieceShape instance={heldPiece} />
          </div>
        )}
      </div>
    </div>
  );
}

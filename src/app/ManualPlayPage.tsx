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
import { PlaybackControls } from '../components/PlaybackControls';
import { SolverPanel } from '../components/SolverPanel';
import { SolvedBanner } from '../components/SolvedBanner';
import { getChallengeById } from '../data/loadChallenges';
import { createEmptyBoard, isInBounds, isOverlapping } from '../domain/board';
import { cellsAt, flipOrientation, PIECE_TYPES, type FlipAxis } from '../domain/pentomino';
import { useManualAttemptStore } from '../state/manualAttempt';
import { useNavigationStore } from '../state/navigation';
import { isChallengeCompleted } from '../state/persistence';
import { usePlaybackStore } from '../state/playback';
import type { PieceInstance } from '../domain/types';
import { BOARD_PADDING_PX, CELL_GAP_PX, planArena, pieceSpan } from './arenaLayout';

const FALLBACK_CELL_PX = 40;
/** How far the pointer must travel with the button down to count as a drag. */
const DRAG_THRESHOLD_PX = 24;
/** Autoplay never ticks faster than this; higher speeds advance several steps per tick. */
const MIN_AUTOPLAY_TICK_MS = 16;

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
  | { kind: 'home' }
  | { kind: 'none' };

/*
 * On narrow screens the board may be drawn transposed (mirrored along its
 * diagonal, see arenaLayout.ts). The model never changes, so what the player
 * does on screen is translated: a clockwise quarter turn on a transposed
 * drawing is a counter-clockwise one in the model, and a left-right flip is a
 * top-bottom one. (tests/unit/domain/transposedDisplay.test.ts checks both.)
 */
function turnsForScreenRotation(transposed: boolean) {
  return transposed ? 3 : 1;
}

function modelFlipAxis(screenAxis: FlipAxis, transposed: boolean): FlipAxis {
  if (!transposed) return screenAxis;
  return screenAxis === 'horizontal' ? 'vertical' : 'horizontal';
}

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
      setSize((prev) =>
        prev && prev.width === width && prev.height === height ? prev : { width, height },
      );
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
  const goToManualPlay = useNavigationStore((s) => s.goToManualPlay);
  const goToChallenge = useNavigationStore((s) => s.goToChallenge);
  // Solver mode: same screen, but the board shows the solver's playback and
  // the pieces can't be handled; the player's own attempt is kept underneath.
  const solverOpen = useNavigationStore((s) => s.solverOpen);
  const openSolver = useNavigationStore((s) => s.openSolver);
  const closeSolver = useNavigationStore((s) => s.closeSolver);
  const challenge = useMemo(() => getChallengeById(challengeId), [challengeId]);

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
  const returnSelectedHome = useManualAttemptStore((s) => s.returnSelectedHome);
  const reset = useManualAttemptStore((s) => s.reset);

  const playback = usePlaybackStore();
  const resetPlayback = playback.reset;
  const stepPlaybackForward = playback.stepForward;
  const selectedCriteria = useMemo(
    () => new Set(playback.selectedCriteria),
    [playback.selectedCriteria],
  );
  const challengeRuns = useMemo(
    () => playback.runHistory.filter((run) => run.challengeId === challengeId),
    [playback.runHistory, challengeId],
  );

  // Entering solver mode puts down whatever is in hand; leaving it (or
  // switching challenge) abandons the run on screen.
  useEffect(() => {
    if (!solverOpen) return;
    cancelHold();
    return () => resetPlayback();
  }, [solverOpen, challengeId, cancelHold, resetPlayback]);

  // Autoplay: while playing, advance at the chosen speed.
  useEffect(() => {
    if (!solverOpen || playback.status !== 'playing') return;
    const tickMs = Math.max(1000 / playback.speed, MIN_AUTOPLAY_TICK_MS);
    const stepsPerTick = Math.max(1, Math.round((playback.speed * tickMs) / 1000));
    const id = setInterval(() => stepPlaybackForward(stepsPerTick), tickMs);
    return () => clearInterval(id);
  }, [solverOpen, playback.status, playback.speed, stepPlaybackForward]);

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
  const stripRef = useRef<HTMLDivElement>(null);
  const arenaSize = useElementSize(arenaRef);
  const plan = useMemo(
    () =>
      arenaSize
        ? planArena(arenaSize.width, arenaSize.height, board.cols, board.rows, pieces)
        : null,
    [arenaSize, board.cols, board.rows, pieces],
  );
  const cellSize = plan?.cellSize ?? FALLBACK_CELL_PX;
  const transposed = plan?.transposed ?? false;
  // For the window-level listeners below, which outlive any one render.
  const transposedRef = useRef(transposed);
  useEffect(() => {
    transposedRef.current = transposed;
  }, [transposed]);
  // Board and piece sizes as drawn; `board.rows`/`board.cols` and pieceDims() are the model's.
  const shownCols = transposed ? board.rows : board.cols;
  const shownRows = transposed ? board.cols : board.rows;
  const shownDims = (piece: PieceInstance) => {
    const { w, h } = pieceDims(piece);
    return transposed ? { w: h, h: w } : { w, h };
  };
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

  // The held piece follows the pointer everywhere, centered on it — except
  // while the button is pressed: a press-and-drag is the mirror gesture, so
  // the piece stays put where the press started and catches up on release.
  const [pointer, setPointer] = useState<Point | null>(null);
  useEffect(() => {
    if (!selectedInstanceId) return;
    function handlePointerMove(event: PointerEvent) {
      if (event.buttons & 1) return;
      setPointer({ x: event.clientX, y: event.clientY });
    }
    function handlePointerUp(event: PointerEvent) {
      if (event.button === 0) setPointer({ x: event.clientX, y: event.clientY });
    }
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [selectedInstanceId]);

  // With the pointer over the board the piece snaps to the grid (nudged to
  // stay inside); over the strip of unplaced pieces it goes back there;
  // anywhere else it is left loose exactly where it is. Geometry is worked
  // out as drawn and converted to model coordinates at the end.
  function dropTargetAt(point: Point, piece: PieceInstance): DropTarget {
    const arena = arenaRef.current?.getBoundingClientRect();
    const boardRect = boardRef.current?.getBoundingClientRect();
    if (!arena || !boardRect) return { kind: 'none' };
    const within = (rect: DOMRect) =>
      point.x >= rect.left &&
      point.x <= rect.right &&
      point.y >= rect.top &&
      point.y <= rect.bottom;

    const { w, h } = shownDims(piece);
    const left = point.x - spanPx(w) / 2;
    const top = point.y - spanPx(h) / 2;
    const originX = boardRect.left + BOARD_PADDING_PX;
    const originY = boardRect.top + BOARD_PADDING_PX;

    if (within(boardRect)) {
      if (w > shownCols || h > shownRows) return { kind: 'none' };
      const shownRow = clamp(Math.round((top - originY) / pitch), 0, shownRows - h);
      const shownCol = clamp(Math.round((left - originX) / pitch), 0, shownCols - w);
      return transposed
        ? { kind: 'board', row: shownCol, col: shownRow }
        : { kind: 'board', row: shownRow, col: shownCol };
    }
    const stripRect = stripRef.current?.getBoundingClientRect();
    if (stripRect && within(stripRect)) return { kind: 'home' };

    const across = (clamp(left, arena.left, arena.right - spanPx(w)) - originX) / pitch;
    const down = (clamp(top, arena.top, arena.bottom - spanPx(h)) - originY) / pitch;
    return transposed ? { kind: 'free', x: down, y: across } : { kind: 'free', x: across, y: down };
  }

  const [target, setTarget] = useState<DropTarget | null>(null);
  useLayoutEffect(() => {
    setTarget(heldPiece && pointer ? dropTargetAt(pointer, heldPiece) : null);
    // dropTargetAt only reads layout that changes together with these deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heldPiece, pointer, cellSize, board.cols, board.rows, plan]);

  const ghost = useMemo(() => {
    if (!heldPiece || target?.kind !== 'board') return null;
    const cells = cellsAt(heldPiece.typeId, heldPiece.orientationIndex, [target.row, target.col]);
    // Right after a rotate/flip, `target` is still the one computed for the
    // previous orientation (it is refreshed in the layout effect above), so
    // near the board's edge the new shape may not fit there: no ghost for
    // that one render rather than reading cells outside the board.
    if (!isInBounds(board, cells)) return null;
    return { cells, valid: !isOverlapping(board, cells) };
  }, [heldPiece, target, board]);

  // Challenge ids follow the order of the challenge list.
  const previousChallenge = useMemo(() => getChallengeById(challengeId - 1), [challengeId]);
  const nextChallenge = useMemo(() => getChallengeById(challengeId + 1), [challengeId]);
  // Completed now or in an earlier visit (progress is persisted when solved).
  const isCompleted = useMemo(
    () => isSolved || isChallengeCompleted(challengeId),
    [isSolved, challengeId],
  );

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
        rotateSelected(turnsForScreenRotation(transposed));
      } else if (event.key === 'e' || event.key === 'E') {
        flipSelected(modelFlipAxis('horizontal', transposed));
      } else if (event.key === 'Escape') {
        cancelHold();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedInstanceId, rotateSelected, flipSelected, cancelHold, transposed]);

  // Right-click anywhere rotates the held piece; on a loose piece with
  // nothing held, it picks that piece up first. (The browser's own context
  // menu is suppressed app-wide, see App.tsx.)
  useEffect(() => {
    function handleContextMenu(event: MouseEvent) {
      if (useNavigationStore.getState().solverOpen) return;
      const store = useManualAttemptStore.getState();
      if (!store.selectedInstanceId) {
        const id = (event.target as Element | null)
          ?.closest?.('[data-piece-id]')
          ?.getAttribute('data-piece-id');
        if (!id) return;
        setPointer({ x: event.clientX, y: event.clientY });
        store.pickUp(id);
      }
      useManualAttemptStore
        .getState()
        .rotateSelected(turnsForScreenRotation(transposedRef.current));
    }
    window.addEventListener('contextmenu', handleContextMenu);
    return () => window.removeEventListener('contextmenu', handleContextMenu);
  }, []);

  // Press-and-drag mirrors the piece, and keeps doing so for as long as the
  // button is down: the piece always shows the orientation it had when the
  // press started, mirrored along wherever the pointer currently is relative
  // to that point — sideways swaps left and right, up/down swaps top and
  // bottom, back near the start undoes it. Starting the drag on a piece that
  // isn't in hand picks it up first, and the click that ends a drag is
  // swallowed so it doesn't drop the piece.
  useEffect(() => {
    let drag: {
      x: number;
      y: number;
      pieceId: string | null;
      /** Orientation when the drag began; null until it passes the threshold. */
      baseOrientation: number | null;
    } | null = null;
    let swallowClick = false;

    function handlePointerDown(event: PointerEvent) {
      swallowClick = false;
      if (event.button !== 0 || useNavigationStore.getState().solverOpen) return;
      const pieceId =
        (event.target as Element | null)
          ?.closest?.('[data-piece-id]')
          ?.getAttribute('data-piece-id') ?? null;
      drag = { x: event.clientX, y: event.clientY, pieceId, baseOrientation: null };
    }
    function handlePointerMove(event: PointerEvent) {
      if (!drag) return;
      // The release can be missed (e.g. outside the window): not a drag anymore.
      if (!(event.buttons & 1)) {
        drag = null;
        return;
      }
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      const beyondThreshold = Math.max(Math.abs(dx), Math.abs(dy)) >= DRAG_THRESHOLD_PX;

      if (drag.baseOrientation === null) {
        if (!beyondThreshold) return;
        const store = useManualAttemptStore.getState();
        if (!store.selectedInstanceId) {
          if (!drag.pieceId) {
            drag = null;
            return;
          }
          // Held where it was grabbed until the button is released.
          setPointer({ x: drag.x, y: drag.y });
          store.pickUp(drag.pieceId);
        }
        const { pieces, selectedInstanceId } = useManualAttemptStore.getState();
        const held = pieces.find((p) => p.instanceId === selectedInstanceId);
        if (!held) {
          drag = null;
          return;
        }
        drag.baseOrientation = held.orientationIndex;
        swallowClick = true;
      }

      const { pieces, selectedInstanceId, setSelectedOrientation } =
        useManualAttemptStore.getState();
      const held = pieces.find((p) => p.instanceId === selectedInstanceId);
      if (!held) return;
      const screenAxis: FlipAxis = Math.abs(dx) >= Math.abs(dy) ? 'horizontal' : 'vertical';
      const wanted = beyondThreshold
        ? flipOrientation(
            held.typeId,
            drag.baseOrientation,
            modelFlipAxis(screenAxis, transposedRef.current),
          )
        : drag.baseOrientation;
      if (wanted !== held.orientationIndex) setSelectedOrientation(wanted);
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
    else if (drop.kind === 'home') returnSelectedHome();
  }

  function handleCellClick(row: number, col: number, event: ReactMouseEvent<HTMLButtonElement>) {
    if (solverOpen) return;
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

  // In solver mode the rings show the challenge's pieces as dealt, minus the
  // ones the solver currently has on the board.
  const solverPlacedTypes = useMemo(
    () => new Set(playback.pieces.map((p) => p.typeId)),
    [playback.pieces],
  );
  const emptyBoard = useMemo(
    () => createEmptyBoard(board.rows, board.cols),
    [board.rows, board.cols],
  );
  const solverBoard = playback.status === 'idle' ? emptyBoard : playback.board;

  // Narrow screens: every unplaced piece in one scrolling strip.
  function renderStrip() {
    if (plan?.mode !== 'strip') return null;
    const position: PieceTrayPosition = plan.side === 'below' ? 'bottom' : 'right';
    return (
      <div
        className="board-arena__strip"
        data-testid="piece-strip"
        ref={stripRef}
        style={{ '--span': plan.stripSpan } as CSSProperties}
      >
        {solverOpen ? (
          <PieceTray
            pieces={pieces.map((piece) => ({ ...piece, orientationIndex: 0 }))}
            position={position}
            slotSpan={slotSpan}
            isAway={(piece) => solverPlacedTypes.has(piece.typeId)}
            transposed={transposed}
            collapseAway
          />
        ) : (
          <PieceTray
            pieces={pieces}
            position={position}
            slotSpan={slotSpan}
            isAway={isAway}
            onPick={pick}
            transposed={transposed}
            collapseAway
          />
        )}
      </div>
    );
  }

  function renderRing(position: PieceTrayPosition, span: number) {
    // Opposite rings reserve the same thickness (even when one is empty) so
    // the board stays centered.
    if (plan?.mode !== 'rings' || span === 0) return null;
    // A side ring may be wrapped into several columns (see arenaLayout.ts).
    const columns =
      plan.sideColumns && (position === 'left' || position === 'right') ? plan.sideColumns[position] : null;
    const groups = columns ?? [plan.rings[position]];
    return (
      <div
        className={`board-arena__ring board-arena__${position}${columns ? ' board-arena__ring--columns' : ''}`}
        style={
          columns ? { width: plan.sideColumns!.widthPx } : ({ '--span': span } as CSSProperties)
        }
      >
        {groups.map((group, index) =>
          solverOpen ? (
            <PieceTray
              key={index}
              pieces={group.map((piece) => ({ ...piece, orientationIndex: 0 }))}
              position={position}
              slotSpan={slotSpan}
              transposed={transposed}
              isAway={(piece) => solverPlacedTypes.has(piece.typeId)}
            />
          ) : (
            <PieceTray
              key={index}
              pieces={group}
              position={position}
              slotSpan={slotSpan}
              transposed={transposed}
              isAway={isAway}
              onPick={pick}
            />
          ),
        )}
      </div>
    );
  }

  const heldDims = heldPiece ? shownDims(heldPiece) : null;
  const ringLayout = plan?.mode === 'rings' ? plan.layout : null;
  const arenaClasses = [
    'board-arena',
    heldPiece ? 'board-arena--holding' : '',
    plan?.mode === 'strip' ? `board-arena--strip board-arena--strip-${plan.side}` : '',
  ]
    .filter(Boolean)
    .join(' ');
  const stepsKnown = playback.isSolving ? playback.steps.length : playback.totalSteps;

  return (
    <div className="manual-play-page">
      <div className="manual-play-page__toolbar">
        <nav className="challenge-nav" aria-label={t('manualPlay.navLabel')}>
          <button
            type="button"
            aria-label={t('manualPlay.previous')}
            disabled={!previousChallenge}
            onClick={() => previousChallenge && goToChallenge(previousChallenge.id)}
          >
            ‹
          </button>
          <span
            className="challenge-nav__title"
            data-testid="challenge-title"
            data-completed={isCompleted}
          >
            {challenge &&
              // The bonus tier has no line label: drop the separator it would leave behind.
              t('challenges.cardLabel', {
                line: challenge.line,
                boardCols: challenge.boardCols,
                id: challenge.id,
              }).replace(/^s*·s*/, '')}
            {isCompleted && (
              <span className="challenge-nav__badge" data-testid="challenge-completed">
                ✓ {t('challenges.completed', 'Completed')}
              </span>
            )}
          </span>
          <button
            type="button"
            aria-label={t('manualPlay.following')}
            disabled={!nextChallenge}
            onClick={() => nextChallenge && goToChallenge(nextChallenge.id)}
          >
            ›
          </button>
        </nav>

        {solverOpen ? (
          <button type="button" onClick={closeSolver} data-testid="close-solver">
            {t('solver.backToPlay')}
          </button>
        ) : (
          <>
            <button type="button" onClick={openSolver}>
              {t('nav.autoSolve')}
            </button>
            <button type="button" onClick={reset}>
              {t('manualPlay.reset', 'Reset')}
            </button>
          </>
        )}

        <div className="manual-play-page__status">
          {!solverOpen && conflictKeys.length > 0 && (
            <p data-testid="invalid-feedback" role="alert" className="manual-play-page__warning">
              {t('manualPlay.overlap', 'Pieces overlap — move the ones marked in red to continue.')}
            </p>
          )}
          {!solverOpen && isSolved && (
            <>
              <SolvedBanner />
              {nextChallenge && (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => goToManualPlay(nextChallenge.id)}
                >
                  {t('manualPlay.next', 'Next challenge')}
                </button>
              )}
            </>
          )}
        </div>

        {!solverOpen && (
          <PieceControls
            hasSelection={!!selectedInstanceId}
            onRotate={() => rotateSelected(turnsForScreenRotation(transposed))}
            onFlip={() => flipSelected(modelFlipAxis('horizontal', transposed))}
          />
        )}
      </div>

      <div className="manual-play-page__body">
        <div className="manual-play-page__stage">
          <div
            className={arenaClasses}
            ref={arenaRef}
            style={{ '--cell': `${cellSize}px` } as CSSProperties}
            onClick={handleArenaClick}
          >
            {plan && (
              <>
                {renderRing('top', ringLayout?.bandSpan ?? 0)}
                {renderRing('left', ringLayout?.sideSpan ?? 0)}
                <div className="board-arena__board" ref={boardRef}>
                  {solverOpen ? (
                    <Board
                      board={solverBoard}
                      pieces={playback.pieces}
                      cellSize={cellSize}
                      transposed={transposed}
                    />
                  ) : (
                    <Board
                      board={board}
                      pieces={pieces}
                      onCellClick={handleCellClick}
                      ghost={ghost}
                      conflictKeys={conflictSet}
                      cellSize={cellSize}
                      transposed={transposed}
                    />
                  )}
                </div>
                {renderRing('right', ringLayout?.sideSpan ?? 0)}
                {renderRing('bottom', ringLayout?.bandSpan ?? 0)}
                {renderStrip()}
              </>
            )}

            {/* Pieces left loose outside the board, in the order they were dropped. */}
            {!solverOpen &&
              boardOrigin &&
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
                    style={{
                      left: boardOrigin.x + (transposed ? free.y : free.x) * pitch,
                      top: boardOrigin.y + (transposed ? free.x : free.y) * pitch,
                    }}
                    onClick={(event) => pick(instanceId, event)}
                  >
                    <PieceShape instance={piece} transposed={transposed} />
                  </button>
                );
              })}

            {!solverOpen && heldPiece && heldDims && pointer && (
              <div
                className="board-arena__held"
                data-testid="held-piece"
                style={{
                  left: pointer.x - spanPx(heldDims.w) / 2,
                  top: pointer.y - spanPx(heldDims.h) / 2,
                }}
              >
                <PieceShape instance={heldPiece} transposed={transposed} />
              </div>
            )}
          </div>

          {solverOpen && (
            <div className="manual-play-page__playback">
              <p data-testid="step-counter">
                {t('solver.stepCounter', 'Step {{current}} of {{total}}', {
                  current: Math.max(playback.currentStepIndex + 1, 0),
                  total: playback.isSolving ? `${stepsKnown}…` : stepsKnown,
                })}
              </p>
              <PlaybackControls
                status={playback.status}
                speed={playback.speed}
                canStepBackward={playback.currentStepIndex >= 0}
                canStepForward={playback.currentStepIndex < playback.steps.length - 1}
                // Before the first run, Play starts one with the ticked criteria.
                onPlay={
                  playback.status === 'idle' && challenge
                    ? () => playback.startSolve(challenge, playback.selectedCriteria)
                    : playback.play
                }
                onPause={playback.pause}
                onStepForward={() => playback.stepForward()}
                onStepBackward={playback.stepBackward}
                onRewind={playback.rewind}
                onSkipToEnd={() => playback.stepForward(Number.MAX_SAFE_INTEGER)}
                onSpeedChange={playback.setSpeed}
              />
            </div>
          )}
        </div>

        {solverOpen && challenge && (
          <SolverPanel
            challenge={challenge}
            selectedCriteria={selectedCriteria}
            onToggleCriterion={playback.toggleCriterion}
            onStart={() => playback.startSolve(challenge, playback.selectedCriteria)}
            onClose={closeSolver}
            status={playback.status}
            isSolving={playback.isSolving}
            outcome={playback.outcome}
            errorMessage={playback.errorMessage}
            stepsShown={Math.max(playback.currentStepIndex + 1, 0)}
            stepsKnown={stepsKnown}
            backtracksSoFar={playback.backtracksSoFar}
            prunesSoFar={playback.prunesSoFar}
            runs={challengeRuns}
          />
        )}
      </div>
    </div>
  );
}

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
import { isInBounds, isOverlapping } from '../domain/board';
import { cellsAt, flipOrientation, PIECE_TYPES, type FlipAxis } from '../domain/pentomino';
import { useManualAttemptStore } from '../state/manualAttempt';
import { useNavigationStore } from '../state/navigation';
import { isChallengeCompleted } from '../state/persistence';
import { usePlaybackStore } from '../state/playback';
import { startFrame } from '../state/playbackFrame';
import { remainingPieces } from '../solvers/configurableSolver';
import type { PieceInstance, StartPlacement } from '../domain/types';
import { BOARD_PADDING_PX, CELL_GAP_PX, planArena, pieceSpan } from './arenaLayout';

const FALLBACK_CELL_PX = 40;
/** How far the pointer must travel with the button down to count as a drag. */
const DRAG_THRESHOLD_PX = 24;
/** How far a finger must travel on a piece before it is being dragged rather than tapped. */
const TOUCH_DRAG_THRESHOLD_PX = 12;
/** A piece dragged by touch is drawn with its lower edge this far above the finger, so the finger doesn't hide it. */
const TOUCH_LIFT_PX = 16;
/** Autoplay never ticks faster than this; higher speeds advance several steps per tick. */
const MIN_AUTOPLAY_TICK_MS = 16;
/** How long the "board is locked" notice stays up in solver mode. */
const LOCKED_NOTICE_MS = 4000;

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
  const focusedInstanceId = useManualAttemptStore((s) => s.focusedInstanceId);
  const focusPiece = useManualAttemptStore((s) => s.focusPiece);
  const rotateInPlace = useManualAttemptStore((s) => s.rotateInPlace);
  const flipInPlace = useManualAttemptStore((s) => s.flipInPlace);
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
    return () => {
      resetPlayback();
      setLockedNotice(0);
    };
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
      if (event.pointerType !== 'mouse' || event.buttons & 1) return;
      setPointer({ x: event.clientX, y: event.clientY });
    }
    function handlePointerUp(event: PointerEvent) {
      if (event.pointerType !== 'mouse') return;
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

  // Where the finger is while it drags a piece (the piece is drawn above it, see liftedPoint()).
  const [finger, setFinger] = useState<Point | null>(null);

  const [target, setTarget] = useState<DropTarget | null>(null);
  useLayoutEffect(() => {
    if (!heldPiece || !pointer) setTarget(null);
    else setTarget(finger ? touchDropTarget(finger, heldPiece) : dropTargetAt(pointer, heldPiece));
    // Both only read layout that changes together with these deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heldPiece, pointer, finger, cellSize, board.cols, board.rows, plan]);

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
      // A long press on a touch screen also asks for the context menu.
      if (touchInputRef.current || useNavigationStore.getState().solverOpen) return;
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
      drag = null;
      // By touch, dragging moves the piece instead (see below).
      if (event.pointerType !== 'mouse') return;
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

  // Where a piece dragged by touch is drawn: above the finger. Everything
  // else (the preview, where it lands) follows from that point, so the piece
  // goes where it is seen, not where the finger is.
  function liftedPoint(finger: Point, piece: PieceInstance): Point {
    const { h } = shownDims(piece);
    return { x: finger.x, y: finger.y - spanPx(h) / 2 - TOUCH_LIFT_PX };
  }

  // The strip is at the edge of the screen, where the lifted piece may not
  // reach: a finger back on the strip returns the piece, wherever the piece
  // is drawn.
  function touchDropTarget(finger: Point, piece: PieceInstance): DropTarget {
    const strip = stripRef.current?.getBoundingClientRect();
    const onStrip =
      strip &&
      finger.x >= strip.left &&
      finger.x <= strip.right &&
      finger.y >= strip.top &&
      finger.y <= strip.bottom;
    return onStrip ? { kind: 'home' } : dropTargetAt(liftedPoint(finger, piece), piece);
  }

  // For the window-level touch listeners below, which outlive any one render.
  const touchLayoutRef = useRef({ liftedPoint, touchDropTarget, stripScrolls: null as 'x' | 'y' | null });
  useLayoutEffect(() => {
    touchLayoutRef.current = {
      liftedPoint,
      touchDropTarget,
      stripScrolls: plan?.mode === 'strip' ? (plan.side === 'below' ? 'x' : 'y') : null,
    };
  });

  // Touch (and pen) has no pointer hovering around with a piece in hand, so
  // there the piece is dragged: it is picked up once the finger moves on it,
  // follows the finger and is dropped where the finger lifts. A tap, instead,
  // turns the piece where it lies. The strip of unplaced pieces scrolls along
  // its length, so only a drag across it takes a piece out.
  const touchInputRef = useRef(false);
  // Set once a touch has moved or turned a piece: the click the browser may
  // send for that same touch is then not a tap on empty space.
  const touchHandledRef = useRef(false);
  useEffect(() => {
    let gesture: {
      pointerId: number;
      x: number;
      y: number;
      pieceId: string;
      inStrip: boolean;
      dragging: boolean;
    } | null = null;

    function heldPieceNow() {
      const { pieces, selectedInstanceId } = useManualAttemptStore.getState();
      return pieces.find((p) => p.instanceId === selectedInstanceId) ?? null;
    }
    function handlePointerDown(event: PointerEvent) {
      touchInputRef.current = event.pointerType !== 'mouse';
      touchHandledRef.current = false;
      if (!touchInputRef.current || !event.isPrimary) return;
      gesture = null;
      if (useNavigationStore.getState().solverOpen) return;
      // A piece left in hand by the mouse stays the mouse's business.
      if (useManualAttemptStore.getState().selectedInstanceId) return;
      const target = event.target as Element | null;
      const pieceId = target?.closest?.('[data-piece-id]')?.getAttribute('data-piece-id');
      if (!pieceId) return;
      gesture = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        pieceId,
        inStrip: !!target?.closest?.('.board-arena__strip'),
        dragging: false,
      };
    }
    function handlePointerMove(event: PointerEvent) {
      if (!gesture || event.pointerId !== gesture.pointerId) return;
      const finger = { x: event.clientX, y: event.clientY };
      if (!gesture.dragging) {
        const dx = Math.abs(finger.x - gesture.x);
        const dy = Math.abs(finger.y - gesture.y);
        if (Math.max(dx, dy) < TOUCH_DRAG_THRESHOLD_PX) return;
        const scrolls = gesture.inStrip ? touchLayoutRef.current.stripScrolls : null;
        if ((scrolls === 'x' && dx > dy) || (scrolls === 'y' && dy > dx)) {
          // Along the strip: the browser scrolls it.
          gesture = null;
          return;
        }
        useManualAttemptStore.getState().pickUp(gesture.pieceId);
        if (useManualAttemptStore.getState().selectedInstanceId !== gesture.pieceId) {
          gesture = null;
          return;
        }
        gesture.dragging = true;
        // The element the finger went down on may be gone now (the piece
        // left its slot): keep the rest of the gesture coming here.
        try {
          arenaRef.current?.setPointerCapture(event.pointerId);
        } catch {
          // Not capturable (the pointer is already gone): the release still ends the drag.
        }
      }
      const held = heldPieceNow();
      if (!held) return;
      setFinger(finger);
      setPointer(touchLayoutRef.current.liftedPoint(finger, held));
    }
    function handlePointerUp(event: PointerEvent) {
      if (!gesture || event.pointerId !== gesture.pointerId) return;
      const { dragging, pieceId } = gesture;
      gesture = null;
      touchHandledRef.current = true;
      if (!dragging) {
        // A tap. Handled here rather than on the click that normally follows,
        // which browsers may hold back (right after a drag, for one).
        useManualAttemptStore
          .getState()
          .rotateInPlace(pieceId, turnsForScreenRotation(transposedRef.current));
        return;
      }
      setFinger(null);
      const held = heldPieceNow();
      if (!held) return;
      const store = useManualAttemptStore.getState();
      const drop = touchLayoutRef.current.touchDropTarget({ x: event.clientX, y: event.clientY }, held);
      if (drop.kind === 'board') store.placeSelectedAt(drop.row, drop.col);
      else if (drop.kind === 'free') store.dropSelectedAt(drop.x, drop.y);
      else if (drop.kind === 'home') store.returnSelectedHome();
      // Nowhere to put it (it doesn't fit on the board): back where it came from.
      useManualAttemptStore.getState().cancelHold();
      store.focusPiece(pieceId);
    }
    function handlePointerCancel(event: PointerEvent) {
      if (!gesture || event.pointerId !== gesture.pointerId) return;
      if (gesture.dragging) {
        setFinger(null);
        useManualAttemptStore.getState().cancelHold();
      }
      gesture = null;
    }

    window.addEventListener('pointerdown', handlePointerDown, true);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerCancel);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown, true);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerCancel);
    };
  }, []);

  /** Whether a click came from a finger (or pen) rather than the mouse or the keyboard. */
  function isTouchClick(event: ReactMouseEvent<HTMLElement>) {
    return touchInputRef.current && event.detail !== 0;
  }

  function pick(instanceId: string, event: ReactMouseEvent<HTMLElement>) {
    // With a piece already in hand this click is a drop — let it reach the arena.
    if (selectedInstanceId) return;
    event.stopPropagation();
    // By touch a piece is moved by dragging it, and a tap has already turned
    // it when the finger lifted (see above).
    if (isTouchClick(event)) return;
    if (event.detail === 0) {
      // Keyboard activation has no pointer position: hold it over the element.
      const rect = event.currentTarget.getBoundingClientRect();
      setPointer({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
    } else {
      setPointer({ x: event.clientX, y: event.clientY });
    }
    pickUp(instanceId);
  }

  // Solver mode: a click on the board or on a piece is an attempt to play,
  // so say why nothing happens and point at the way back. The number counts
  // the attempts, which restarts the notice's animation on each one.
  const [lockedNotice, setLockedNotice] = useState(0);
  useEffect(() => {
    if (lockedNotice === 0) return;
    const id = setTimeout(() => setLockedNotice(0), LOCKED_NOTICE_MS);
    return () => clearTimeout(id);
  }, [lockedNotice]);
  const showLockedNotice = solverOpen && lockedNotice > 0;

  function handleArenaClick(event: ReactMouseEvent<HTMLDivElement>) {
    if (solverOpen) {
      if ((event.target as Element).closest('.board, .piece-tray__item')) {
        setLockedNotice((count) => count + 1);
      }
      return;
    }
    if (!heldPiece) {
      // A tap away from every piece lets go of the one Rotate/Flip act on.
      if (isTouchClick(event) && !touchHandledRef.current) focusPiece(null);
      return;
    }
    if (event.detail === 0) return;
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

  // A solver run can begin from the pieces the player has on the board, as
  // long as they don't overlap; pieces left loose around it don't count.
  const attemptStart = useMemo<StartPlacement[]>(
    () =>
      pieces.flatMap((piece) =>
        piece.position
          ? [{ typeId: piece.typeId, orientationIndex: piece.orientationIndex, position: piece.position }]
          : [],
      ),
    [pieces],
  );
  const attemptOverlaps = conflictKeys.length > 0;
  const solverStart = useMemo(
    () =>
      playback.startFrom === 'attempt' && attemptStart.length > 0 && !attemptOverlaps ? attemptStart : [],
    [playback.startFrom, attemptStart, attemptOverlaps],
  );
  const piecesToPlace = useMemo(
    () => (challenge ? remainingPieces(challenge, solverStart) : []),
    [challenge, solverStart],
  );
  // Before a run, the board already shows where it will begin.
  const idleFrame = useMemo(
    () => startFrame(board.rows, board.cols, solverStart),
    [board.rows, board.cols, solverStart],
  );
  const solverIdle = playback.status === 'idle';
  const solverBoard = solverIdle ? idleFrame.board : playback.board;
  const solverPieces = solverIdle ? idleFrame.pieces : playback.pieces;
  // In solver mode the rings show the challenge's pieces as dealt, minus the
  // ones currently on the board.
  const solverPlacedTypes = useMemo(() => new Set(solverPieces.map((p) => p.typeId)), [solverPieces]);

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
            focusedInstanceId={focusedInstanceId}
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
              focusedInstanceId={focusedInstanceId}
            />
          ),
        )}
      </div>
    );
  }

  const heldDims = heldPiece ? shownDims(heldPiece) : null;
  // The piece Rotate/Flip act on: the one in hand, else the one last touched.
  const controlledInstanceId = selectedInstanceId ?? focusedInstanceId;
  const ringLayout = plan?.mode === 'rings' ? plan.layout : null;
  const arenaClasses = [
    'board-arena',
    heldPiece ? 'board-arena--holding' : '',
    solverOpen ? 'board-arena--locked' : '',
    plan?.mode === 'strip' ? `board-arena--strip board-arena--strip-${plan.side}` : '',
  ]
    .filter(Boolean)
    .join(' ');
  const stepsKnown = playback.isSolving ? playback.steps.length : playback.totalSteps;

  return (
    <div className="manual-play-page">
      <div className="manual-play-page__toolbar">
        <div className="manual-play-page__tools">
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
            <button
              type="button"
              className={showLockedNotice ? 'btn-attention' : undefined}
              onClick={closeSolver}
              data-testid="close-solver"
            >
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

        </div>

        {!solverOpen && (
          <PieceControls
            hasSelection={!!controlledInstanceId}
            onRotate={() => {
              const turns = turnsForScreenRotation(transposed);
              if (selectedInstanceId) rotateSelected(turns);
              else if (focusedInstanceId) rotateInPlace(focusedInstanceId, turns);
            }}
            onFlip={() => {
              const axis = modelFlipAxis('horizontal', transposed);
              if (selectedInstanceId) flipSelected(axis);
              else if (focusedInstanceId) flipInPlace(focusedInstanceId, axis);
            }}
          />
        )}

        <div className="manual-play-page__status">
          {!solverOpen && conflictKeys.length > 0 && (
            <p data-testid="invalid-feedback" role="alert" className="manual-play-page__warning">
              {t('manualPlay.overlap', 'Pieces overlap: move the ones marked in red to continue.')}
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
                      pieces={solverPieces}
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
                      focusedInstanceId={focusedInstanceId}
                      cellSize={cellSize}
                      transposed={transposed}
                    />
                  )}
                  {showLockedNotice && (
                    <p
                      key={lockedNotice}
                      className="board-arena__locked"
                      data-testid="solver-locked"
                      role="status"
                    >
                      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
                        <rect x="3" y="7" width="10" height="7" rx="1.5" fill="currentColor" />
                        <path
                          d="M5.25 7V5a2.75 2.75 0 0 1 5.5 0v2"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          fill="none"
                        />
                      </svg>
                      {t('solver.locked')}
                    </p>
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
                    className={`piece-tray__item board-arena__loose${
                      instanceId === focusedInstanceId ? ' piece-tray__item--focused' : ''
                    }`}
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
                    ? () => playback.startSolve(challenge, playback.selectedCriteria, solverStart)
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
            onStart={() => playback.startSolve(challenge, playback.selectedCriteria, solverStart)}
            onClose={closeSolver}
            highlightClose={showLockedNotice}
            status={playback.status}
            isSolving={playback.isSolving}
            outcome={playback.outcome}
            errorMessage={playback.errorMessage}
            stepsShown={Math.max(playback.currentStepIndex + 1, 0)}
            stepsKnown={stepsKnown}
            backtracksSoFar={playback.backtracksSoFar}
            prunesSoFar={playback.prunesSoFar}
            runs={challengeRuns}
            startFrom={playback.startFrom}
            onStartFromChange={(startFrom) => {
              // The board on screen should show the new starting point.
              resetPlayback();
              playback.setStartFrom(startFrom);
            }}
            attemptPieces={attemptStart.length}
            attemptOverlaps={attemptOverlaps}
            piecesToPlace={piecesToPlace}
            runFromAttempt={playback.start.length > 0}
          />
        )}
      </div>
    </div>
  );
}

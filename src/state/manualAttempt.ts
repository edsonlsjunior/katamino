import { create } from 'zustand';
import {
  cellsAt,
  flipOrientation,
  rotateOrientation,
  type FlipAxis,
  type PieceTypeId,
} from '../domain/pentomino';
import { createEmptyBoard, isInBounds, stackPlacements, type Board } from '../domain/board';
import type { Challenge, PieceInstance } from '../domain/types';
import { markChallengeCompleted } from './persistence';

/** Where a loose piece was left outside the board: the top-left of its
 * bounding box, in (fractional) cell units relative to the board's top-left
 * cell — so it scales with the board instead of being tied to pixels. */
export interface FreePosition {
  x: number;
  y: number;
}

interface HeldOrigin {
  orientationIndex: number;
  position: PieceInstance['position'];
  free: FreePosition | null;
}

interface ManualAttemptState {
  challengeId: number | null;
  pieces: PieceInstance[];
  /** What the board shows: on an overlapped cell, the last piece put there. */
  board: Board;
  /** "row,col" keys of the cells holding more than one piece. */
  conflictKeys: string[];
  /** Pieces left loose outside the board; a piece that is neither here nor
   * placed sits in its starting slot. */
  freePositions: Record<string, FreePosition>;
  /** Pieces on the board or loose, oldest drop first (stacking order). */
  stack: string[];
  /** The piece currently held (following the pointer), if any. */
  selectedInstanceId: string | null;
  heldOrigin: HeldOrigin | null;
  isSolved: boolean;
  loadChallenge: (challenge: Challenge) => void;
  pickUp: (instanceId: string) => void;
  cancelHold: () => void;
  /** Quarter turns clockwise (default 1). */
  rotateSelected: (turns?: number) => void;
  flipSelected: (axis?: FlipAxis) => void;
  setSelectedOrientation: (orientationIndex: number) => void;
  placeSelectedAt: (row: number, col: number) => boolean;
  dropSelectedAt: (x: number, y: number) => void;
  /** Puts the held piece back among the unplaced ones, keeping its orientation. */
  returnSelectedHome: () => void;
  reset: () => void;
}

function makeInstanceId(typeId: PieceTypeId, index: number): string {
  return `piece-${typeId}-${index}`;
}

function initialPieces(requiredPieces: readonly PieceTypeId[]): PieceInstance[] {
  return requiredPieces.map((typeId, index) => ({
    instanceId: makeInstanceId(typeId, index),
    typeId,
    orientationIndex: 0,
    position: null,
  }));
}

/**
 * Board contents, overlaps and the win condition, derived from the pieces.
 * Solved means every piece is on the board with no overlap: pieces are only
 * ever placed in-bounds and their total area equals the board's, so that is
 * the same as the board being exactly covered (FR-005).
 */
function settle(pieces: readonly PieceInstance[], stack: readonly string[], rows: number, cols: number) {
  const byId = new Map(pieces.map((p) => [p.instanceId, p]));
  const placements = stack.flatMap((id) => {
    const piece = byId.get(id);
    if (!piece?.position) return [];
    const cells = cellsAt(piece.typeId, piece.orientationIndex, [piece.position.row, piece.position.col]);
    return [{ instanceId: id, cells }];
  });
  const { board, conflicts } = stackPlacements(rows, cols, placements);
  return {
    board,
    conflictKeys: conflicts.map(([r, c]) => `${r},${c}`),
    isSolved: pieces.length > 0 && conflicts.length === 0 && pieces.every((p) => p.position !== null),
  };
}

function without<T>(record: Record<string, T>, key: string): Record<string, T> {
  const next = { ...record };
  delete next[key];
  return next;
}

export const useManualAttemptStore = create<ManualAttemptState>((set, get) => ({
  challengeId: null,
  pieces: [],
  board: createEmptyBoard(5, 0),
  conflictKeys: [],
  freePositions: {},
  stack: [],
  selectedInstanceId: null,
  heldOrigin: null,
  isSolved: false,

  loadChallenge: (challenge) => {
    set({
      challengeId: challenge.id,
      pieces: initialPieces(challenge.requiredPieces),
      board: createEmptyBoard(challenge.boardRows, challenge.boardCols),
      conflictKeys: [],
      freePositions: {},
      stack: [],
      selectedInstanceId: null,
      heldOrigin: null,
      isSolved: false,
    });
  },

  // Lifts a piece from wherever it is (starting slot, loose, or on the board).
  pickUp: (instanceId) => {
    const { selectedInstanceId, pieces, freePositions, stack, board } = get();
    if (selectedInstanceId) return;
    const piece = pieces.find((p) => p.instanceId === instanceId);
    if (!piece) return;

    const nextPieces = pieces.map((p) => (p.instanceId === instanceId ? { ...p, position: null } : p));
    const nextStack = stack.filter((id) => id !== instanceId);
    set({
      pieces: nextPieces,
      stack: nextStack,
      freePositions: without(freePositions, instanceId),
      selectedInstanceId: instanceId,
      heldOrigin: {
        orientationIndex: piece.orientationIndex,
        position: piece.position,
        free: freePositions[instanceId] ?? null,
      },
      ...settle(nextPieces, nextStack, board.rows, board.cols),
    });
  },

  // Puts the held piece back exactly where (and how) it was picked up from.
  cancelHold: () => {
    const { selectedInstanceId, heldOrigin, pieces, freePositions, stack, board } = get();
    if (!selectedInstanceId || !heldOrigin) return;

    const nextPieces = pieces.map((p) =>
      p.instanceId === selectedInstanceId
        ? { ...p, orientationIndex: heldOrigin.orientationIndex, position: heldOrigin.position }
        : p,
    );
    const wasOut = heldOrigin.position !== null || heldOrigin.free !== null;
    const nextStack = wasOut ? [...stack, selectedInstanceId] : stack;
    set({
      pieces: nextPieces,
      stack: nextStack,
      freePositions: heldOrigin.free
        ? { ...freePositions, [selectedInstanceId]: heldOrigin.free }
        : freePositions,
      selectedInstanceId: null,
      heldOrigin: null,
      ...settle(nextPieces, nextStack, board.rows, board.cols),
    });
  },

  rotateSelected: (turns = 1) => {
    const { selectedInstanceId, pieces } = get();
    if (!selectedInstanceId) return;
    set({
      pieces: pieces.map((p) => {
        if (p.instanceId !== selectedInstanceId) return p;
        let orientationIndex = p.orientationIndex;
        for (let i = 0; i < turns; i++) orientationIndex = rotateOrientation(p.typeId, orientationIndex);
        return { ...p, orientationIndex };
      }),
    });
  },

  flipSelected: (axis = 'horizontal') => {
    const { selectedInstanceId, pieces } = get();
    if (!selectedInstanceId) return;
    set({
      pieces: pieces.map((p) =>
        p.instanceId === selectedInstanceId
          ? { ...p, orientationIndex: flipOrientation(p.typeId, p.orientationIndex, axis) }
          : p,
      ),
    });
  },

  setSelectedOrientation: (orientationIndex) => {
    const { selectedInstanceId, pieces } = get();
    if (!selectedInstanceId) return;
    set({
      pieces: pieces.map((p) => (p.instanceId === selectedInstanceId ? { ...p, orientationIndex } : p)),
    });
  },

  // Puts the held piece on the board with its top-left at (row, col). Overlapping
  // other pieces is allowed (and flagged in `conflictKeys`); only a placement
  // that sticks out of the board is refused.
  placeSelectedAt: (row, col) => {
    const { selectedInstanceId, pieces, board, stack, challengeId } = get();
    if (!selectedInstanceId) return false;
    const piece = pieces.find((p) => p.instanceId === selectedInstanceId);
    if (!piece) return false;
    if (!isInBounds(board, cellsAt(piece.typeId, piece.orientationIndex, [row, col]))) return false;

    const nextPieces = pieces.map((p) =>
      p.instanceId === piece.instanceId ? { ...p, position: { row, col } } : p,
    );
    const nextStack = [...stack, piece.instanceId];
    const settled = settle(nextPieces, nextStack, board.rows, board.cols);
    set({ pieces: nextPieces, stack: nextStack, selectedInstanceId: null, heldOrigin: null, ...settled });

    if (settled.isSolved && challengeId !== null) {
      markChallengeCompleted(challengeId);
    }
    return true;
  },

  // Leaves the held piece loose outside the board.
  dropSelectedAt: (x, y) => {
    const { selectedInstanceId, freePositions, stack } = get();
    if (!selectedInstanceId) return;
    set({
      freePositions: { ...freePositions, [selectedInstanceId]: { x, y } },
      stack: [...stack, selectedInstanceId],
      selectedInstanceId: null,
      heldOrigin: null,
    });
  },

  returnSelectedHome: () => {
    if (!get().selectedInstanceId) return;
    // Picking it up already took it off the board / out of the loose pieces.
    set({ selectedInstanceId: null, heldOrigin: null });
  },

  reset: () => {
    const { pieces, board } = get();
    set({
      board: createEmptyBoard(board.rows, board.cols),
      pieces: pieces.map((p) => ({ ...p, orientationIndex: 0, position: null })),
      conflictKeys: [],
      freePositions: {},
      stack: [],
      selectedInstanceId: null,
      heldOrigin: null,
      isSolved: false,
    });
  },
}));

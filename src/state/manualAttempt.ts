import { create } from 'zustand';
import {
  cellsAt,
  flipOrientation,
  rotateOrientation,
  type PieceTypeId,
} from '../domain/pentomino';
import { canPlace, createEmptyBoard, isFull, placeCells, removeInstance, type Board } from '../domain/board';
import type { Challenge, PieceInstance } from '../domain/types';
import { markChallengeCompleted } from './persistence';

interface ManualAttemptState {
  challengeId: number | null;
  pieces: PieceInstance[];
  board: Board;
  selectedInstanceId: string | null;
  isSolved: boolean;
  loadChallenge: (challenge: Challenge) => void;
  selectPiece: (instanceId: string) => void;
  deselect: () => void;
  rotateSelected: () => void;
  flipSelected: () => void;
  placeSelectedAt: (row: number, col: number) => boolean;
  removePiece: (instanceId: string) => void;
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

export const useManualAttemptStore = create<ManualAttemptState>((set, get) => ({
  challengeId: null,
  pieces: [],
  board: createEmptyBoard(5, 0),
  selectedInstanceId: null,
  isSolved: false,

  loadChallenge: (challenge) => {
    set({
      challengeId: challenge.id,
      pieces: initialPieces(challenge.requiredPieces),
      board: createEmptyBoard(challenge.boardRows, challenge.boardCols),
      selectedInstanceId: null,
      isSolved: false,
    });
  },

  selectPiece: (instanceId) => {
    const piece = get().pieces.find((p) => p.instanceId === instanceId);
    if (!piece || piece.position !== null) return;
    set({ selectedInstanceId: instanceId });
  },

  deselect: () => {
    set({ selectedInstanceId: null });
  },

  rotateSelected: () => {
    const { selectedInstanceId, pieces } = get();
    if (!selectedInstanceId) return;
    set({
      pieces: pieces.map((p) =>
        p.instanceId === selectedInstanceId
          ? { ...p, orientationIndex: rotateOrientation(p.typeId, p.orientationIndex) }
          : p,
      ),
    });
  },

  flipSelected: () => {
    const { selectedInstanceId, pieces } = get();
    if (!selectedInstanceId) return;
    set({
      pieces: pieces.map((p) =>
        p.instanceId === selectedInstanceId
          ? { ...p, orientationIndex: flipOrientation(p.typeId, p.orientationIndex) }
          : p,
      ),
    });
  },

  placeSelectedAt: (row, col) => {
    const { selectedInstanceId, pieces, board, challengeId } = get();
    if (!selectedInstanceId) return false;
    const piece = pieces.find((p) => p.instanceId === selectedInstanceId);
    if (!piece || piece.position !== null) return false;

    const cells = cellsAt(piece.typeId, piece.orientationIndex, [row, col]);
    if (!canPlace(board, cells)) return false;

    const nextBoard = placeCells(board, piece.instanceId, cells);
    const nextPieces = pieces.map((p) =>
      p.instanceId === piece.instanceId ? { ...p, position: { row, col } } : p,
    );
    const solved = isFull(nextBoard);

    set({
      board: nextBoard,
      pieces: nextPieces,
      selectedInstanceId: null,
      isSolved: solved,
    });

    if (solved && challengeId !== null) {
      markChallengeCompleted(challengeId);
    }
    return true;
  },

  removePiece: (instanceId) => {
    const { pieces, board } = get();
    const piece = pieces.find((p) => p.instanceId === instanceId);
    if (!piece || piece.position === null) return;

    set({
      board: removeInstance(board, instanceId),
      pieces: pieces.map((p) => (p.instanceId === instanceId ? { ...p, position: null } : p)),
      isSolved: false,
    });
  },

  reset: () => {
    const { pieces, board } = get();
    set({
      board: createEmptyBoard(board.rows, board.cols),
      pieces: pieces.map((p) => ({ ...p, orientationIndex: 0, position: null })),
      selectedInstanceId: null,
      isSolved: false,
    });
  },
}));

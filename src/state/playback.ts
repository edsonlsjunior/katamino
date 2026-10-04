import { create } from 'zustand';
import { createEmptyBoard, placeCells, removeInstance, type Board } from '../domain/board';
import { cellsAt } from '../domain/pentomino';
import type { Challenge, PieceInstance, PlaybackStatus, SolveStep, SolvingStrategyId } from '../domain/types';
import type { SolveRequest, SolveResponse } from '../workers/protocol';
import SolverWorker from '../workers/solver.worker?worker';

export interface RunSummary {
  challengeId: number;
  strategyId: SolvingStrategyId;
  totalSteps: number;
  backtrackCount: number;
}

interface PlaybackState {
  challengeId: number | null;
  strategyId: SolvingStrategyId | null;
  status: PlaybackStatus;
  steps: SolveStep[];
  currentStepIndex: number;
  speed: number;
  totalSteps: number;
  backtrackCount: number;
  solvedAtStepIndex: number;
  errorMessage: string | null;
  board: Board;
  pieces: PieceInstance[];
  /** Most recent completed runs first, across challenges/strategies (FR-013, SC-003). */
  runHistory: RunSummary[];

  startSolve: (challenge: Challenge, strategyId: SolvingStrategyId) => void;
  play: () => void;
  pause: () => void;
  stepForward: () => void;
  stepBackward: () => void;
  rewind: () => void;
  setSpeed: (stepsPerSecond: number) => void;
}

let worker: Worker | null = null;
let currentRequestId: string | null = null;

function getWorker(): Worker {
  if (!worker) worker = new SolverWorker();
  return worker;
}

/** Recomputes board + placed-piece list for rendering up to (and including) currentStepIndex. */
function computeBoardAndPieces(
  rows: number,
  cols: number,
  steps: readonly SolveStep[],
  upToIndex: number,
): { board: Board; pieces: PieceInstance[] } {
  let board = createEmptyBoard(rows, cols);
  const pieces = new Map<string, PieceInstance>();

  for (let i = 0; i <= upToIndex && i < steps.length; i++) {
    const step = steps[i];
    if (step.kind === 'place') {
      const cells = cellsAtStep(step);
      board = placeCells(board, step.instanceId, cells);
      pieces.set(step.instanceId, {
        instanceId: step.instanceId,
        typeId: step.typeId,
        orientationIndex: step.orientationIndex,
        position: step.position,
      });
    } else {
      board = removeInstance(board, step.instanceId);
      pieces.delete(step.instanceId);
    }
  }

  return { board, pieces: [...pieces.values()] };
}

function cellsAtStep(step: SolveStep) {
  return cellsAt(step.typeId, step.orientationIndex, [step.position.row, step.position.col]);
}

export const usePlaybackStore = create<PlaybackState>((set, get) => ({
  challengeId: null,
  strategyId: null,
  status: 'idle',
  steps: [],
  currentStepIndex: -1,
  speed: 3,
  totalSteps: 0,
  backtrackCount: 0,
  solvedAtStepIndex: -1,
  errorMessage: null,
  board: createEmptyBoard(5, 0),
  pieces: [],
  runHistory: [],

  startSolve: (challenge, strategyId) => {
    const requestId = `${challenge.id}-${strategyId}-${Date.now()}`;
    currentRequestId = requestId;

    set({
      challengeId: challenge.id,
      strategyId,
      status: 'computing',
      steps: [],
      currentStepIndex: -1,
      totalSteps: 0,
      backtrackCount: 0,
      solvedAtStepIndex: -1,
      errorMessage: null,
      board: createEmptyBoard(challenge.boardRows, challenge.boardCols),
      pieces: [],
    });

    const w = getWorker();
    w.onmessage = (event: MessageEvent<SolveResponse>) => {
      const message = event.data;
      if (message.requestId !== currentRequestId) return;

      if (message.type === 'started') {
        return;
      }
      if (message.type === 'step') {
        const { steps, currentStepIndex, status } = get();
        const nextSteps = [...steps, message.step];
        const shouldAutoAdvance = status === 'computing' && currentStepIndex === steps.length - 1;
        const nextIndex = shouldAutoAdvance ? currentStepIndex + 1 : currentStepIndex;
        const { board, pieces } = computeBoardAndPieces(get().board.rows, get().board.cols, nextSteps, nextIndex);
        set({
          steps: nextSteps,
          currentStepIndex: nextIndex,
          status: 'playing',
          board,
          pieces,
        });
        return;
      }
      if (message.type === 'done') {
        const { challengeId, strategyId: currentStrategyId, runHistory } = get();
        const summary: RunSummary = {
          challengeId: challengeId!,
          strategyId: currentStrategyId!,
          totalSteps: message.totalSteps,
          backtrackCount: message.backtrackCount,
        };
        set({
          totalSteps: message.totalSteps,
          backtrackCount: message.backtrackCount,
          solvedAtStepIndex: message.solvedAtStepIndex,
          runHistory: [summary, ...runHistory].slice(0, 5),
        });
        const { currentStepIndex, steps } = get();
        if (currentStepIndex >= steps.length - 1) {
          set({ status: 'complete' });
        }
        return;
      }
      if (message.type === 'error') {
        set({ status: 'error', errorMessage: message.message });
      }
    };

    const request: SolveRequest = { type: 'solve', requestId, challenge, strategyId };
    w.postMessage(request);
  },

  play: () => {
    const { status } = get();
    if (status === 'paused' || status === 'idle') set({ status: 'playing' });
  },

  pause: () => {
    if (get().status === 'playing') set({ status: 'paused' });
  },

  stepForward: () => {
    const { steps, currentStepIndex, totalSteps, board } = get();
    if (currentStepIndex >= steps.length - 1) return;
    const nextIndex = currentStepIndex + 1;
    const { board: nextBoard, pieces } = computeBoardAndPieces(board.rows, board.cols, steps, nextIndex);
    const reachedEnd = totalSteps > 0 && nextIndex >= totalSteps - 1;
    set({ currentStepIndex: nextIndex, board: nextBoard, pieces, status: reachedEnd ? 'complete' : get().status });
  },

  stepBackward: () => {
    const { steps, currentStepIndex, board } = get();
    if (currentStepIndex < 0) return;
    const nextIndex = currentStepIndex - 1;
    const { board: nextBoard, pieces } = computeBoardAndPieces(board.rows, board.cols, steps, nextIndex);
    set({
      currentStepIndex: nextIndex,
      board: nextBoard,
      pieces,
      status: get().status === 'complete' ? 'paused' : get().status,
    });
  },

  rewind: () => {
    const { board } = get();
    const empty = createEmptyBoard(board.rows, board.cols);
    set({ currentStepIndex: -1, board: empty, pieces: [], status: 'paused' });
  },

  setSpeed: (stepsPerSecond) => set({ speed: Math.max(0.5, stepsPerSecond) }),
}));

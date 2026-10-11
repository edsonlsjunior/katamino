import { create } from 'zustand';
import type { Board } from '../domain/board';
import type {
  Challenge,
  PieceInstance,
  PlaybackStatus,
  SolveOutcome,
  SolveStep,
  StartPlacement,
} from '../domain/types';
import { CRITERION_IDS, DEFAULT_CRITERIA, criteriaKey, type CriterionId } from '../solvers/criteria';
import type { SolveRequest, WorkerMessage, WorkerRequest } from '../workers/protocol';
import SolverWorker from '../workers/solver.worker?worker';
import { applyStep, emptyFrame, startFrame, undoStep, type PlaybackFrame } from './playbackFrame';

export interface RunSummary {
  challengeId: number;
  criteria: CriterionId[];
  totalSteps: number;
  backtrackCount: number;
  outcome: SolveOutcome;
  /** How many of the player's pieces the run started from (0: empty board). */
  startPieces: number;
}

/** Where the next run begins: the empty board, or the pieces the player has placed. */
export type StartFrom = 'empty' | 'attempt';

const RUN_HISTORY_SIZE = 8;

interface PlaybackState {
  challengeId: number | null;
  /** The criteria of the run being shown; null before the first run. */
  criteria: CriterionId[] | null;
  /** The pieces the run being shown started with. */
  start: StartPlacement[];
  status: PlaybackStatus;
  /** Steps received from the solver so far (all of them once `isSolving` is false). */
  steps: SolveStep[];
  currentStepIndex: number;
  speed: number;
  /** True while the worker is still searching. */
  isSolving: boolean;
  /** Known only once the solver is done; 0 until then. */
  totalSteps: number;
  backtrackCount: number;
  solvedAtStepIndex: number;
  outcome: SolveOutcome | null;
  errorMessage: string | null;
  /** The position at `currentStepIndex`. */
  board: Board;
  pieces: PieceInstance[];
  backtracksSoFar: number;
  prunesSoFar: Partial<Record<CriterionId, number>>;
  /** Most recent completed runs first, across challenges (FR-013, SC-003). */
  runHistory: RunSummary[];
  /** The criteria ticked for the next run. */
  selectedCriteria: CriterionId[];
  /** Where the next run should begin. */
  startFrom: StartFrom;

  toggleCriterion: (id: CriterionId) => void;
  setStartFrom: (startFrom: StartFrom) => void;
  startSolve: (
    challenge: Challenge,
    criteria: readonly CriterionId[],
    start?: readonly StartPlacement[],
  ) => void;
  play: () => void;
  pause: () => void;
  stepForward: (count?: number) => void;
  stepBackward: () => void;
  rewind: () => void;
  setSpeed: (stepsPerSecond: number) => void;
  /** Abandons the current run and clears the playback (run history is kept). */
  reset: () => void;
}

let worker: Worker | null = null;
let currentRequestId: string | null = null;
let requestCounter = 0;

function getWorker(): Worker {
  if (!worker) worker = new SolverWorker();
  return worker;
}

function send(request: WorkerRequest) {
  getWorker().postMessage(request);
}

function frameOf(state: PlaybackState): PlaybackFrame {
  return {
    board: state.board,
    pieces: state.pieces,
    backtracks: state.backtracksSoFar,
    prunes: state.prunesSoFar,
  };
}

function frameFields(frame: PlaybackFrame) {
  return {
    board: frame.board,
    pieces: frame.pieces,
    backtracksSoFar: frame.backtracks,
    prunesSoFar: frame.prunes,
  };
}

const IDLE = {
  challengeId: null,
  criteria: null,
  start: [] as StartPlacement[],
  status: 'idle' as PlaybackStatus,
  steps: [] as SolveStep[],
  currentStepIndex: -1,
  isSolving: false,
  totalSteps: 0,
  backtrackCount: 0,
  solvedAtStepIndex: -1,
  outcome: null,
  errorMessage: null,
  ...frameFields(emptyFrame(5, 0)),
};

export const usePlaybackStore = create<PlaybackState>((set, get) => ({
  ...IDLE,
  speed: 3,
  runHistory: [],
  selectedCriteria: [...DEFAULT_CRITERIA],
  startFrom: 'empty',

  setStartFrom: (startFrom) => set({ startFrom }),

  toggleCriterion: (id) => {
    const current = new Set(get().selectedCriteria);
    if (current.has(id)) current.delete(id);
    else current.add(id);
    set({ selectedCriteria: CRITERION_IDS.filter((c) => current.has(c)) });
  },

  startSolve: (challenge, criteria, start = []) => {
    const requestId = `${challenge.id}-${criteriaKey(criteria)}-${++requestCounter}`;
    currentRequestId = requestId;

    set({
      ...IDLE,
      challengeId: challenge.id,
      criteria: [...criteria],
      start: [...start],
      status: 'computing',
      isSolving: true,
      ...frameFields(startFrame(challenge.boardRows, challenge.boardCols, start)),
    });

    const w = getWorker();
    w.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const message = event.data;
      if (message.requestId !== currentRequestId) return;

      if (message.type === 'steps') {
        const { steps, status } = get();
        set({
          steps: steps.concat(message.steps),
          // Playback starts as soon as there is something to show; the
          // autoplay timer (see ManualPlayPage) advances from there.
          status: status === 'computing' ? 'playing' : status,
        });
        return;
      }
      if (message.type === 'done') {
        const {
          challengeId,
          criteria: runCriteria,
          start: runStart,
          runHistory,
          currentStepIndex,
          steps,
          status,
        } = get();
        const summary: RunSummary = {
          challengeId: challengeId!,
          criteria: runCriteria ?? [],
          totalSteps: message.totalSteps,
          backtrackCount: message.backtrackCount,
          outcome: message.outcome,
          startPieces: runStart.length,
        };
        const atEnd = currentStepIndex >= steps.length - 1;
        set({
          isSolving: false,
          totalSteps: message.totalSteps,
          backtrackCount: message.backtrackCount,
          solvedAtStepIndex: message.solvedAtStepIndex,
          outcome: message.outcome,
          runHistory: [summary, ...runHistory].slice(0, RUN_HISTORY_SIZE),
          status: atEnd ? 'complete' : status,
        });
        return;
      }
      if (message.type === 'error') {
        set({ status: 'error', isSolving: false, errorMessage: message.message });
      }
    };

    const request: SolveRequest = {
      type: 'solve',
      requestId,
      challenge,
      criteria: [...criteria],
      start: [...start],
    };
    w.postMessage(request);
  },

  play: () => {
    const { status } = get();
    if (status === 'paused' || status === 'idle') set({ status: 'playing' });
  },

  pause: () => {
    if (get().status === 'playing') set({ status: 'paused' });
  },

  stepForward: (count = 1) => {
    const state = get();
    const { steps, isSolving } = state;
    let index = state.currentStepIndex;
    if (index >= steps.length - 1) return;

    let frame = frameOf(state);
    for (let i = 0; i < count && index < steps.length - 1; i++) {
      frame = applyStep(frame, steps[++index]);
    }
    const reachedEnd = !isSolving && index >= steps.length - 1;
    set({
      currentStepIndex: index,
      ...frameFields(frame),
      status: reachedEnd ? 'complete' : state.status,
    });
  },

  stepBackward: () => {
    const state = get();
    const { steps, currentStepIndex } = state;
    if (currentStepIndex < 0) return;
    set({
      currentStepIndex: currentStepIndex - 1,
      ...frameFields(undoStep(frameOf(state), steps[currentStepIndex])),
      status: state.status === 'complete' ? 'paused' : state.status,
    });
  },

  rewind: () => {
    const { board, start } = get();
    set({
      currentStepIndex: -1,
      ...frameFields(startFrame(board.rows, board.cols, start)),
      status: 'paused',
    });
  },

  setSpeed: (stepsPerSecond) => set({ speed: Math.max(0.5, stepsPerSecond) }),

  reset: () => {
    if (currentRequestId !== null) {
      currentRequestId = null;
      send({ type: 'cancel' });
    }
    set({ ...IDLE });
  },
}));

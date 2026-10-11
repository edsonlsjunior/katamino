/**
 * What the playback shows at a given point of a solver run, and how one step
 * forward or backward changes it. Pure, so stepping through a long run costs
 * the same at step 100,000 as at step 1 (no replay from the start).
 */
import { createEmptyBoard, placeCells, removeInstance, type Board } from '../domain/board';
import { cellsAt } from '../domain/pentomino';
import type { PieceInstance, SolveStep, StartPlacement } from '../domain/types';
import { instanceIdFor } from '../solvers/configurableSolver';
import type { CriterionId } from '../solvers/criteria';

export interface PlaybackFrame {
  board: Board;
  pieces: PieceInstance[];
  /** Placements undone so far. */
  backtracks: number;
  /** Of those, how many each pruning criterion ruled out on the spot. */
  prunes: Partial<Record<CriterionId, number>>;
}

export function emptyFrame(rows: number, cols: number): PlaybackFrame {
  return { board: createEmptyBoard(rows, cols), pieces: [], backtracks: 0, prunes: {} };
}

/** The frame a run begins on: the board with the pieces it was told to keep. */
export function startFrame(rows: number, cols: number, start: readonly StartPlacement[]): PlaybackFrame {
  let frame = emptyFrame(rows, cols);
  for (const { typeId, orientationIndex, position } of start) {
    const instanceId = instanceIdFor(typeId);
    const cells = cellsAt(typeId, orientationIndex, [position.row, position.col]);
    frame = {
      ...frame,
      board: placeCells(frame.board, instanceId, cells),
      pieces: [...frame.pieces, { instanceId, typeId, orientationIndex, position }],
    };
  }
  return frame;
}

function withPiece(frame: PlaybackFrame, step: SolveStep): Pick<PlaybackFrame, 'board' | 'pieces'> {
  const cells = cellsAt(step.typeId, step.orientationIndex, [step.position.row, step.position.col]);
  return {
    board: placeCells(frame.board, step.instanceId, cells),
    pieces: [
      ...frame.pieces,
      {
        instanceId: step.instanceId,
        typeId: step.typeId,
        orientationIndex: step.orientationIndex,
        position: step.position,
      },
    ],
  };
}

function withoutPiece(frame: PlaybackFrame, step: SolveStep): Pick<PlaybackFrame, 'board' | 'pieces'> {
  return {
    board: removeInstance(frame.board, step.instanceId),
    pieces: frame.pieces.filter((p) => p.instanceId !== step.instanceId),
  };
}

function countPrune(frame: PlaybackFrame, step: SolveStep, delta: 1 | -1): PlaybackFrame['prunes'] {
  if (!step.prunedBy) return frame.prunes;
  return { ...frame.prunes, [step.prunedBy]: (frame.prunes[step.prunedBy] ?? 0) + delta };
}

/** The frame after `step` has happened. */
export function applyStep(frame: PlaybackFrame, step: SolveStep): PlaybackFrame {
  if (step.kind === 'place') return { ...frame, ...withPiece(frame, step) };
  return {
    ...withoutPiece(frame, step),
    backtracks: frame.backtracks + 1,
    prunes: countPrune(frame, step, 1),
  };
}

/** The frame before `step` happened (the inverse of applyStep). */
export function undoStep(frame: PlaybackFrame, step: SolveStep): PlaybackFrame {
  if (step.kind === 'place') return { ...frame, ...withoutPiece(frame, step) };
  return {
    ...withPiece(frame, step),
    backtracks: frame.backtracks - 1,
    prunes: countPrune(frame, step, -1),
  };
}

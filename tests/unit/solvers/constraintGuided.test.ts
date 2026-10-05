import { describe, expect, it } from 'vitest';
import { solveConstraintGuided } from '../../../src/solvers/constraintGuided';
import { createEmptyBoard, isFull, placeCells, removeInstance } from '../../../src/domain/board';
import { cellsAt } from '../../../src/domain/pentomino';
import type { Challenge, SolveStep } from '../../../src/domain/types';

const challenge: Challenge = {
  id: 1,
  boardRows: 5,
  boardCols: 3,
  requiredPieces: ['P', 'U', 'Y'],
  tier: 'small-slam',
  line: 'A',
  difficulty: 3,
};

function runToCompletion(c: Challenge) {
  const steps: SolveStep[] = [];
  const gen = solveConstraintGuided(c);
  let result = gen.next();
  while (!result.done) {
    steps.push(result.value);
    result = gen.next();
  }
  return { steps, summary: result.value };
}

function replay(c: Challenge, steps: SolveStep[]) {
  let board = createEmptyBoard(c.boardRows, c.boardCols);
  for (const step of steps) {
    const cells = cellsAt(step.typeId, step.orientationIndex, [step.position.row, step.position.col]);
    board = step.kind === 'place' ? placeCells(board, step.instanceId, cells) : removeInstance(board, step.instanceId);
  }
  return board;
}

describe('constraint-guided (MRV) solver', () => {
  it('finds a complete, valid solution for a solvable challenge', () => {
    const { steps } = runToCompletion(challenge);
    expect(steps.length).toBeGreaterThan(0);
    expect(isFull(replay(challenge, steps))).toBe(true);
  });

  it('yields step indices in strictly increasing order starting at 0', () => {
    const { steps } = runToCompletion(challenge);
    steps.forEach((step, i) => expect(step.index).toBe(i));
  });

  it('reports solvedAtStepIndex pointing at a place step after which the board is full', () => {
    const { steps, summary } = runToCompletion(challenge);
    const boardAtThatPoint = replay(challenge, steps.slice(0, summary.solvedAtStepIndex + 1));
    expect(isFull(boardAtThatPoint)).toBe(true);
  });

  it('backtrackCount matches the number of remove steps', () => {
    const { steps, summary } = runToCompletion(challenge);
    expect(summary.backtrackCount).toBe(steps.filter((s) => s.kind === 'remove').length);
  });

  it('is deterministic: the same challenge always yields the same step sequence', () => {
    const first = runToCompletion(challenge);
    const second = runToCompletion(challenge);
    expect(second.steps).toEqual(first.steps);
  });
});

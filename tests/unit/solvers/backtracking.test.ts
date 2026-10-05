import { describe, expect, it } from 'vitest';
import { solveBacktracking } from '../../../src/solvers/backtracking';
import { createEmptyBoard, isFull, placeCells, removeInstance } from '../../../src/domain/board';
import { cellsAt } from '../../../src/domain/pentomino';
import type { Challenge, SolveStep } from '../../../src/domain/types';

// Confirmed tileable by the dataset generator (challenge #1 in src/data/challenges.json).
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
  const gen = solveBacktracking(c);
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

describe('exhaustive backtracking solver', () => {
  it('finds a complete, valid solution for a solvable challenge', () => {
    const { steps } = runToCompletion(challenge);
    expect(steps.length).toBeGreaterThan(0);
    const finalBoard = replay(challenge, steps);
    expect(isFull(finalBoard)).toBe(true);
  });

  it('yields step indices in strictly increasing order starting at 0', () => {
    const { steps } = runToCompletion(challenge);
    steps.forEach((step, i) => expect(step.index).toBe(i));
  });

  it('reports solvedAtStepIndex pointing at a place step after which the board is full', () => {
    const { steps, summary } = runToCompletion(challenge);
    expect(summary.solvedAtStepIndex).toBeGreaterThanOrEqual(0);
    const solvingStep = steps[summary.solvedAtStepIndex];
    expect(solvingStep.kind).toBe('place');
    const boardAtThatPoint = replay(challenge, steps.slice(0, summary.solvedAtStepIndex + 1));
    expect(isFull(boardAtThatPoint)).toBe(true);
  });

  it('backtrackCount matches the number of remove steps', () => {
    const { steps, summary } = runToCompletion(challenge);
    const removeCount = steps.filter((s) => s.kind === 'remove').length;
    expect(summary.backtrackCount).toBe(removeCount);
  });

  it('is deterministic: the same challenge always yields the same step sequence', () => {
    const first = runToCompletion(challenge);
    const second = runToCompletion(challenge);
    expect(second.steps).toEqual(first.steps);
    expect(second.summary).toEqual(first.summary);
  });
});

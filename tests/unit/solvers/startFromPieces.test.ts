import { describe, expect, it } from 'vitest';
import { getChallengeById } from '../../../src/data/loadChallenges';
import { isFull } from '../../../src/domain/board';
import type { SolveStep, StartPlacement } from '../../../src/domain/types';
import { countArrangements, remainingPieces, solve } from '../../../src/solvers/configurableSolver';
import { applyStep, startFrame } from '../../../src/state/playbackFrame';
import { runSolve } from '../../../src/workers/solverEngine';

// Challenge #1: P, U and Y on a 5x3 board.
const challenge = getChallengeById(1)!;
// A Y that is part of a solution, and one that isn't.
const goodY: StartPlacement = { typeId: 'Y', orientationIndex: 0, position: { row: 0, col: 1 } };
const badY: StartPlacement = { typeId: 'Y', orientationIndex: 0, position: { row: 0, col: 0 } };

function run(start: StartPlacement[]) {
  const steps: SolveStep[] = [];
  const gen = solve(challenge, ['most-constrained-cell', 'dead-regions'], { start });
  let result = gen.next();
  while (!result.done) {
    steps.push(result.value);
    result = gen.next();
  }
  return { steps, summary: result.value };
}

describe('solving from pieces already on the board', () => {
  it('keeps the given pieces in place and only places the others', () => {
    const { steps, summary } = run([goodY]);

    expect(summary.outcome).toBe('solved');
    expect(steps.length).toBeGreaterThan(0);
    expect(steps.every((step) => step.typeId !== 'Y')).toBe(true);

    // Replaying the steps on top of the starting position fills the board.
    let frame = startFrame(challenge.boardRows, challenge.boardCols, [goodY]);
    expect(frame.pieces.map((piece) => piece.typeId)).toEqual(['Y']);
    for (const step of steps) frame = applyStep(frame, step);
    expect(isFull(frame.board)).toBe(true);
    expect(frame.pieces.map((piece) => piece.typeId).sort()).toEqual(['P', 'U', 'Y']);
  });

  it('says there is no solution when the given pieces cannot be completed', () => {
    expect(run([badY]).summary.outcome).toBe('exhausted');
  });

  it('with no pieces given it is the ordinary run from the empty board', () => {
    const fromEmpty = run([]);
    const gen = solve(challenge, ['most-constrained-cell', 'dead-regions']);
    let count = 0;
    while (!gen.next().done) count++;
    expect(fromEmpty.steps).toHaveLength(count);
  });

  it('counts the haystack over the pieces still to place', () => {
    expect(remainingPieces(challenge, [goodY])).toEqual(['P', 'U']);
    expect(countArrangements(challenge, ['P', 'U'])).toBeLessThan(countArrangements(challenge));
    expect(countArrangements(challenge, challenge.requiredPieces)).toBe(countArrangements(challenge));
  });

  it('goes through the worker protocol', () => {
    const events = [
      ...runSolve({ type: 'solve', requestId: 'r', challenge, criteria: ['dead-regions'], start: [goodY] }),
    ];
    const done = events[events.length - 1];
    expect(done).toMatchObject({ type: 'done', outcome: 'solved' });
    expect(events.some((e) => e.type === 'step' && e.step.typeId === 'Y')).toBe(false);
  });
});

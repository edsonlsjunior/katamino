import { describe, expect, it } from 'vitest';
import { solveBacktracking } from '../../../src/solvers/backtracking';
import { solveConstraintGuided } from '../../../src/solvers/constraintGuided';
import { getChallengeById } from '../../../src/data/loadChallenges';
import type { Challenge, SolveStep } from '../../../src/domain/types';

function run(solve: (c: Challenge) => Generator<SolveStep, { backtrackCount: number }, void>, c: Challenge) {
  const gen = solve(c);
  let steps = 0;
  let result = gen.next();
  while (!result.done) {
    steps++;
    result = gen.next();
  }
  return { steps, backtrackCount: result.value.backtrackCount };
}

describe('backtracking vs. constraint-guided comparison (FR-013, SC-003)', () => {
  it('the two strategies produce a visibly different step/backtrack count on a non-trivial challenge', () => {
    // Challenge #222 (7 pieces) is a fast-to-compute case where naive backtracking's
    // fixed scan order happens to explore far more of the search space than the
    // MRV heuristic — a clean, quick demonstration of the two strategies diverging.
    const challenge = getChallengeById(222);
    expect(challenge).toBeDefined();

    const backtracking = run(solveBacktracking, challenge!);
    const constraintGuided = run(solveConstraintGuided, challenge!);

    expect(backtracking.steps).not.toBe(constraintGuided.steps);
    expect(backtracking.backtrackCount).not.toBe(constraintGuided.backtrackCount);
    // The whole point of the constraint-guided heuristic is exploring less of the
    // search space than plain fixed-order backtracking.
    expect(constraintGuided.steps).toBeLessThan(backtracking.steps);
  });
});

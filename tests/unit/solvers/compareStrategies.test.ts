import { describe, expect, it } from 'vitest';
import { solve } from '../../../src/solvers/configurableSolver';
import type { CriterionId } from '../../../src/solvers/criteria';
import { getChallengeById } from '../../../src/data/loadChallenges';
import type { Challenge } from '../../../src/domain/types';

function run(c: Challenge, criteria: readonly CriterionId[]) {
  const gen = solve(c, criteria);
  let steps = 0;
  let result = gen.next();
  while (!result.done) {
    steps++;
    result = gen.next();
  }
  return { steps, backtrackCount: result.value.backtrackCount };
}

describe('comparing strategies built from different criteria (FR-013, SC-003)', () => {
  it('two sets of criteria produce a visibly different step/backtrack count on a non-trivial challenge', () => {
    // Challenge #222 (9 pieces) is a fast-to-compute case where a fixed scan
    // order explores far more of the search space than the hardest-square-first
    // heuristic — a clean, quick demonstration of strategies diverging.
    const challenge = getChallengeById(222);
    expect(challenge).toBeDefined();

    const fixedOrder = run(challenge!, ['scarce-pieces-first', 'dead-regions']);
    const guided = run(challenge!, ['most-constrained-cell']);

    expect(fixedOrder.steps).not.toBe(guided.steps);
    expect(fixedOrder.backtrackCount).not.toBe(guided.backtrackCount);
    expect(guided.steps).toBeLessThan(fixedOrder.steps);
  });
});

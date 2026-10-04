import { describe, expect, it } from 'vitest';
import { loadChallenges } from '../../src/data/loadChallenges';
import { solveBacktracking } from '../../src/solvers/backtracking';
import { solveConstraintGuided } from '../../src/solvers/constraintGuided';
import type { Challenge, SolveStep } from '../../src/domain/types';

function isSolvable(solve: (c: Challenge) => Generator<SolveStep, { solvedAtStepIndex: number }, void>, c: Challenge) {
  const gen = solve(c);
  let result = gen.next();
  while (!result.done) result = gen.next();
  return result.value.solvedAtStepIndex !== -1;
}

// Slow (both solvers x 500 challenges) — run via `npm run verify:challenges`, not
// the default fast test suite. Verifies FR-014 / SC-002.
describe('all 500 challenges are solvable by both solving strategies', () => {
  const challenges = loadChallenges();

  it('has exactly 500 challenges', () => {
    expect(challenges).toHaveLength(500);
  });

  it.each(challenges)(
    'challenge #$id is solvable by backtracking',
    (challenge) => {
      expect(isSolvable(solveBacktracking, challenge)).toBe(true);
    },
    15_000,
  );

  it.each(challenges)(
    'challenge #$id is solvable by the constraint-guided strategy',
    (challenge) => {
      expect(isSolvable(solveConstraintGuided, challenge)).toBe(true);
    },
    15_000,
  );
});

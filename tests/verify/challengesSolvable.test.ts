import { describe, expect, it } from 'vitest';
import { loadChallenges } from '../../src/data/loadChallenges';
import { solve } from '../../src/solvers/configurableSolver';
import { CRITERION_IDS, DEFAULT_CRITERIA, type CriterionId } from '../../src/solvers/criteria';
import type { Challenge } from '../../src/domain/types';

// With the solver's default step limit, i.e. what a player actually gets.
function isSolvable(c: Challenge, criteria: readonly CriterionId[]) {
  const gen = solve(c, criteria);
  let result = gen.next();
  while (!result.done) result = gen.next();
  return result.value.outcome === 'solved';
}

// Slow (three strategies x 500 challenges) — run via `npm run verify:challenges`, not
// the default fast test suite. Verifies FR-014 / SC-002.
describe('all 500 challenges are solvable within the step limit', () => {
  const challenges = loadChallenges();

  it('has exactly 500 challenges', () => {
    expect(challenges).toHaveLength(500);
  });

  it('has the expected per-tier counts (data-model.md "Challenge tiers")', () => {
    const counts = new Map<string, number>();
    for (const c of challenges) counts.set(c.tier, (counts.get(c.tier) ?? 0) + 1);
    expect(Object.fromEntries(counts)).toEqual({
      'small-slam': 42,
      slam: 118,
      'grand-slam': 96,
      'super-slam': 96,
      challenge: 100,
      bonus: 48,
    });
  });

  it('has the expected per-boardCols counts', () => {
    const counts = new Map<number, number>();
    for (const c of challenges) counts.set(c.boardCols, (counts.get(c.boardCols) ?? 0) + 1);
    expect(Object.fromEntries(counts)).toEqual({
      3: 7,
      4: 19,
      5: 45,
      6: 61,
      7: 86,
      8: 86,
      9: 75,
      10: 49,
      11: 24,
      12: 48,
    });
  });

  it.each(challenges)(
    'challenge #$id is solvable with the default criteria',
    (challenge) => {
      expect(isSolvable(challenge, DEFAULT_CRITERIA)).toBe(true);
    },
    15_000,
  );

  it.each(challenges)(
    'challenge #$id is solvable with hardest-square-first alone',
    (challenge) => {
      expect(isSolvable(challenge, ['most-constrained-cell'])).toBe(true);
    },
    15_000,
  );

  it.each(challenges)(
    'challenge #$id is solvable with every criterion on',
    (challenge) => {
      expect(isSolvable(challenge, CRITERION_IDS)).toBe(true);
    },
    15_000,
  );
});

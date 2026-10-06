import { describe, expect, it } from 'vitest';
import { countArrangements, solve } from '../../../src/solvers/configurableSolver';
import { CRITERION_IDS, PRUNE_CRITERION_IDS, type CriterionId } from '../../../src/solvers/criteria';
import { createEmptyBoard, isFull, placeCells, removeInstance } from '../../../src/domain/board';
import { cellsAt } from '../../../src/domain/pentomino';
import { getChallengeById } from '../../../src/data/loadChallenges';
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

function runToCompletion(c: Challenge, criteria: readonly CriterionId[], maxSteps?: number) {
  const steps: SolveStep[] = [];
  const gen = solve(c, criteria, maxSteps === undefined ? undefined : { maxSteps });
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

// The plain search, each criterion on its own, and everything together.
const CONFIGS: Array<[string, CriterionId[]]> = [
  ['no criteria', []],
  ...CRITERION_IDS.map((id) => [id, [id]] as [string, CriterionId[]]),
  ['every criterion', [...CRITERION_IDS]],
];

describe.each(CONFIGS)('configurable solver with %s', (_name, criteria) => {
  it('finds a complete, valid solution for a solvable challenge', () => {
    const { steps, summary } = runToCompletion(challenge, criteria);
    expect(summary.outcome).toBe('solved');
    expect(steps.length).toBeGreaterThan(0);
    // replay() places with the strict placeCells, so this also proves no step ever overlapped.
    expect(isFull(replay(challenge, steps))).toBe(true);
  });

  it('yields step indices in strictly increasing order starting at 0', () => {
    const { steps } = runToCompletion(challenge, criteria);
    steps.forEach((step, i) => expect(step.index).toBe(i));
  });

  it('reports solvedAtStepIndex pointing at the last step, a placement that fills the board', () => {
    const { steps, summary } = runToCompletion(challenge, criteria);
    expect(summary.solvedAtStepIndex).toBe(steps.length - 1);
    expect(steps[summary.solvedAtStepIndex].kind).toBe('place');
  });

  it('backtrackCount matches the number of remove steps, and pruneCounts the ones a criterion cut', () => {
    const { steps, summary } = runToCompletion(challenge, criteria);
    const removes = steps.filter((s) => s.kind === 'remove');
    expect(summary.backtrackCount).toBe(removes.length);

    // Exactly the enabled pruning criteria are reported, each with its own tally.
    const enabledPrunes = PRUNE_CRITERION_IDS.filter((id) => criteria.includes(id));
    expect(Object.keys(summary.pruneCounts).sort()).toEqual([...enabledPrunes].sort());
    for (const id of enabledPrunes) {
      expect(summary.pruneCounts[id]).toBe(removes.filter((s) => s.prunedBy === id).length);
    }
    expect(removes.every((s) => s.prunedBy === undefined || enabledPrunes.includes(s.prunedBy))).toBe(true);
  });

  it('is deterministic: the same challenge and criteria always yield the same step sequence', () => {
    const first = runToCompletion(challenge, criteria);
    const second = runToCompletion(challenge, criteria);
    expect(second.steps).toEqual(first.steps);
    expect(second.summary).toEqual(first.summary);
  });
});

describe('configurable solver — criteria are additive', () => {
  // Challenge #353 (7 pieces): big enough for the criteria to matter, small
  // enough for even the plain search to finish in a few hundred steps.
  const harder = getChallengeById(353)!;

  it('the order criteria do not depend on the order they are listed in', () => {
    const a = runToCompletion(harder, ['dead-regions', 'scarce-pieces-first']);
    const b = runToCompletion(harder, ['scarce-pieces-first', 'dead-regions']);
    expect(b.steps).toEqual(a.steps);
  });

  it('adding a pruning criterion to the plain search never costs steps', () => {
    const plain = runToCompletion(harder, []).steps.length;
    for (const id of PRUNE_CRITERION_IDS) {
      expect(runToCompletion(harder, [id]).steps.length).toBeLessThanOrEqual(plain);
    }
  });

  it('a pruned placement is undone immediately and says which criterion ruled it out', () => {
    const { steps } = runToCompletion(harder, ['dead-regions']);
    const pruned = steps.filter((s) => s.prunedBy === 'dead-regions');
    expect(pruned.length).toBeGreaterThan(0);
    for (const remove of pruned) {
      const place = steps[remove.index - 1];
      expect(place.kind).toBe('place');
      expect(place.instanceId).toBe(remove.instanceId);
    }
  });

  it('hardest-square-first explores far less than the plain search', () => {
    const plain = runToCompletion(harder, []);
    const guided = runToCompletion(harder, ['most-constrained-cell']);
    expect(guided.steps.length).toBeLessThan(plain.steps.length / 5);
    expect(guided.summary.backtrackCount).toBeLessThan(plain.summary.backtrackCount);
  });
});

describe('configurable solver — step limit', () => {
  it('stops with outcome "limit" once maxSteps placements/removals have been produced', () => {
    const { steps, summary } = runToCompletion(getChallengeById(222)!, [], 50);
    expect(summary.outcome).toBe('limit');
    expect(summary.solvedAtStepIndex).toBe(-1);
    expect(steps.length).toBeGreaterThanOrEqual(50);
    // The limit is checked before each new placement, so the removals that
    // unwind the pieces already on the board (at most 9 here) can still follow.
    expect(steps.length).toBeLessThanOrEqual(50 + 9);
    // What was produced is still a valid, replayable prefix of the search.
    expect(() => replay(getChallengeById(222)!, steps)).not.toThrow();
  });
});

describe('countArrangements', () => {
  const base: Challenge = { ...challenge, id: 900, boardCols: 1, requiredPieces: ['I'] };

  it('counts every in-bounds position of every orientation of a piece', () => {
    // 5x1: the I only fits standing up, in one position.
    expect(countArrangements(base)).toBe(1n);
    // 5x5: five positions standing up + five lying down.
    expect(countArrangements({ ...base, boardCols: 5 })).toBe(10n);
    // X has a single 3x3 orientation: 3x3 positions on a 5x5 board.
    expect(countArrangements({ ...base, boardCols: 5, requiredPieces: ['X'] })).toBe(9n);
  });

  it('multiplies the pieces together, overlaps included', () => {
    expect(countArrangements({ ...base, boardCols: 5, requiredPieces: ['I', 'X'] })).toBe(90n);
  });

  it('stays exact where a JS number would not', () => {
    const bonus = getChallengeById(500)!; // all 12 pieces on 5x12
    const total = countArrangements(bonus);
    expect(total > BigInt(Number.MAX_SAFE_INTEGER)).toBe(true);
    expect(total.toString()).toBe('41329531870494326784000000');
  });
});

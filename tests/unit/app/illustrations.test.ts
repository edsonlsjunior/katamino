import { describe, expect, it } from 'vitest';
import { getChallengeById } from '../../../src/data/loadChallenges';
import {
  EXAMPLE_CHALLENGE_ID,
  deadRegionExample,
  mostConstrainedExample,
  strandedCellExample,
  strandedPieceExample,
} from '../../../src/app/learn/illustrations';
import { emptyRegions } from '../../../src/app/learn/boardAnalysis';
import { buildSearchTree, treeTotals } from '../../../src/app/learn/searchTree';

const challenge = getChallengeById(EXAMPLE_CHALLENGE_ID)!;

// Each picture on the teaching page has a caption making a claim about it;
// these keep the pictures honest if pieces or orientations are ever reordered.
describe('teaching page illustrations', () => {
  it('most-constrained square: reading order starts on a busy square, far from the tightest one', () => {
    const { first, min, marks } = mostConstrainedExample(challenge);
    expect(min).toBeGreaterThan(0);
    expect(first).toBeGreaterThan(min * 3);
    expect(Object.keys(marks).length).toBeGreaterThan(0);
  });

  it('dead region: a small area at the top is walled off', () => {
    const { size, marks } = deadRegionExample(challenge);
    expect(size).toBeGreaterThan(0);
    expect(size).toBeLessThan(5);
    expect(Object.keys(marks)).toHaveLength(size);
    expect(Object.keys(marks).every((key) => key.startsWith('0,'))).toBe(true);
  });

  it('stranded square: unreachable although the empty area is one viable region', () => {
    const { marks, regionCount, board } = strandedCellExample(challenge);
    expect(Object.keys(marks).length).toBeGreaterThan(0);
    expect(regionCount).toBe(1);
    expect(emptyRegions(board)[0].length % 5).toBe(0);
  });

  it('stranded piece: exactly one of the pieces left fits nowhere', () => {
    const { stranded, board } = strandedPieceExample(challenge);
    expect(stranded).toHaveLength(1);
    expect(emptyRegions(board).every((region) => region.length % 5 === 0)).toBe(true);
  });

  it('pruning criteria never add attempts, as the page says', () => {
    const pruning = ['dead-regions', 'stranded-cells', 'stranded-pieces'] as const;
    const orderings = [[], ['most-constrained-cell'], ['scarce-pieces-first']] as const;
    for (const id of [2, 3, 33]) {
      const lab = getChallengeById(id)!;
      for (const ordering of orderings) {
        const without = treeTotals(buildSearchTree(lab, ordering)).tried;
        for (const prune of pruning) {
          const withPrune = treeTotals(buildSearchTree(lab, [...ordering, prune])).tried;
          expect(withPrune).toBeLessThanOrEqual(without);
        }
        expect(treeTotals(buildSearchTree(lab, [...ordering, ...pruning])).tried).toBeLessThanOrEqual(without);
      }
    }
  });

  it('the lab has a challenge where "scarce pieces first" backfires, as the page says', () => {
    const backfiring = getChallengeById(33)!;
    const plain = treeTotals(buildSearchTree(backfiring, [])).tried;
    const ordered = treeTotals(buildSearchTree(backfiring, ['scarce-pieces-first'])).tried;
    expect(ordered).toBeGreaterThan(plain);
  });
});

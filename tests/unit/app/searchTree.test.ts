import { describe, expect, it } from 'vitest';
import { getChallengeById } from '../../../src/data/loadChallenges';
import { isFull } from '../../../src/domain/board';
import { CRITERION_IDS } from '../../../src/solvers/criteria';
import {
  buildSearchTree,
  isVisibleAt,
  solutionBoard,
  statusAt,
  treeTotals,
} from '../../../src/app/learn/searchTree';

// A · PENTA 4: L, P, T and V on a 5x4 board.
const challenge = getChallengeById(2)!;

describe('search tree of a solver run', () => {
  it('has one node per placement tried, hanging from the state it was tried on', () => {
    const tree = buildSearchTree(challenge, []);
    const totals = treeTotals(tree);

    expect(tree.outcome).toBe('solved');
    expect(tree.nodes[0].typeId).toBeNull();
    expect(totals.tried).toBe(tree.nodes.length - 1);
    // Every step either places a node or closes one.
    expect(tree.ticks).toBe(totals.tried + totals.deadEnds + totals.cuts);
    for (const node of tree.nodes.slice(1)) {
      const parent = tree.nodes[node.parent!];
      expect(node.depth).toBe(parent.depth + 1);
      expect(parent.children).toContain(node.id);
      expect(node.placedAt).toBeGreaterThan(parent.placedAt);
    }
  });

  it('leaves exactly the solution path open, ending on a full board', () => {
    const tree = buildSearchTree(challenge, []);
    const open = tree.nodes.filter((node) => node.closedAt === null);

    // The root plus one node per piece.
    expect(open).toHaveLength(challenge.requiredPieces.length + 1);
    expect(open.every((node) => statusAt(tree, node, tree.ticks) === 'solution')).toBe(true);
    expect(isFull(solutionBoard(tree)!)).toBe(true);
  });

  it('replays: nodes appear when placed and turn into dead ends when undone', () => {
    const tree = buildSearchTree(challenge, []);
    const undone = tree.nodes.find((node) => node.closedAt !== null)!;

    expect(isVisibleAt(undone, undone.placedAt - 1)).toBe(false);
    expect(statusAt(tree, undone, undone.placedAt)).toBe('open');
    expect(statusAt(tree, undone, undone.closedAt!)).toBe('dead');
    expect(tree.nodes.filter((node) => isVisibleAt(node, 0))).toHaveLength(1);
  });

  it('marks placements ruled out by a criterion as pruned, and they have no children', () => {
    const tree = buildSearchTree(challenge, CRITERION_IDS);
    const pruned = tree.nodes.filter((node) => node.prunedBy);

    expect(pruned.length).toBeGreaterThan(0);
    expect(pruned.every((node) => node.children.length === 0)).toBe(true);
    expect(statusAt(tree, pruned[0], tree.ticks)).toBe('pruned');
    expect(treeTotals(tree).tried).toBeLessThan(treeTotals(buildSearchTree(challenge, [])).tried);
  });

  it('lays leaves out in visit order with parents centred over their children', () => {
    const tree = buildSearchTree(challenge, []);
    const leaves = tree.nodes.filter((node) => node.children.length === 0);

    expect(leaves.map((node) => node.x)).toEqual(leaves.map((_, index) => index));
    expect(tree.leafCount).toBe(leaves.length);
    for (const node of tree.nodes.filter((n) => n.children.length > 0)) {
      const first = tree.nodes[node.children[0]].x;
      const last = tree.nodes[node.children[node.children.length - 1]].x;
      expect(node.x).toBe((first + last) / 2);
    }
  });
});

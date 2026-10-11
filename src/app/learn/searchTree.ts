/**
 * Turns a solver run into the tree it walked, for the teaching page: every
 * placement the solver tries is a node under the state it was tried from, and
 * every undo closes that node. Nodes are laid out left to right in the order
 * the solver visited them, so the picture reads as the search itself.
 */
import { cellsAt, type PieceTypeId } from '../../domain/pentomino';
import { createEmptyBoard, placeCells, type Board } from '../../domain/board';
import type { Challenge, SolveOutcome } from '../../domain/types';
import { solve } from '../../solvers/configurableSolver';
import type { CriterionId } from '../../solvers/criteria';

export type NodeStatus = 'open' | 'dead' | 'pruned' | 'solution';

export interface SearchNode {
  id: number;
  parent: number | null;
  children: number[];
  depth: number;
  /** The board after this node's piece was placed (cells hold piece type ids). */
  board: Board;
  /** The piece this node placed; null for the root (the empty board). */
  typeId: PieceTypeId | null;
  /** Tick at which the solver tried this placement (0 for the root). */
  placedAt: number;
  /** Tick at which it was undone; null if it never was (the solution path). */
  closedAt: number | null;
  /** The pruning criterion that ruled it out right away, if one did. */
  prunedBy?: CriterionId;
  /** Horizontal position, in leaf slots. */
  x: number;
}

export interface SearchTree {
  nodes: SearchNode[];
  /** One tick per solver step; tick 0 is the empty board alone. */
  ticks: number;
  outcome: SolveOutcome;
  leafCount: number;
  maxDepth: number;
}

/** Plenty for the small challenges the teaching page uses. */
const MAX_STEPS = 4000;

export function buildSearchTree(challenge: Challenge, criteria: Iterable<CriterionId>): SearchTree {
  const root: SearchNode = {
    id: 0,
    parent: null,
    children: [],
    depth: 0,
    board: createEmptyBoard(challenge.boardRows, challenge.boardCols),
    typeId: null,
    placedAt: 0,
    closedAt: null,
    x: 0,
  };
  const nodes: SearchNode[] = [root];
  let current = root;
  let ticks = 0;

  const run = solve(challenge, criteria, { maxSteps: MAX_STEPS });
  let result = run.next();
  while (!result.done) {
    const step = result.value;
    ticks = step.index + 1;
    if (step.kind === 'place') {
      const cells = cellsAt(step.typeId, step.orientationIndex, [step.position.row, step.position.col]);
      const node: SearchNode = {
        id: nodes.length,
        parent: current.id,
        children: [],
        depth: current.depth + 1,
        board: placeCells(current.board, step.typeId, cells),
        typeId: step.typeId,
        placedAt: ticks,
        closedAt: null,
        x: 0,
      };
      nodes.push(node);
      current.children.push(node.id);
      current = node;
    } else {
      current.closedAt = ticks;
      if (step.prunedBy) current.prunedBy = step.prunedBy;
      current = nodes[current.parent ?? 0];
    }
    result = run.next();
  }

  // Leaves take consecutive slots; a parent sits centred over its children.
  let leafCount = 0;
  let maxDepth = 0;
  function place(node: SearchNode): void {
    maxDepth = Math.max(maxDepth, node.depth);
    if (node.children.length === 0) {
      node.x = leafCount++;
      return;
    }
    for (const childId of node.children) place(nodes[childId]);
    node.x = (nodes[node.children[0]].x + nodes[node.children[node.children.length - 1]].x) / 2;
  }
  place(root);

  return { nodes, ticks, outcome: result.value.outcome, leafCount, maxDepth };
}

/** Whether the node exists yet at a given tick. */
export function isVisibleAt(node: SearchNode, tick: number): boolean {
  return node.placedAt <= tick;
}

/** What the node looks like at a given tick of the run. */
export function statusAt(tree: SearchTree, node: SearchNode, tick: number): NodeStatus {
  if (node.closedAt !== null && node.closedAt <= tick) return node.prunedBy ? 'pruned' : 'dead';
  // Once a solved run is over, whatever was never undone is the solution.
  if (tick >= tree.ticks && tree.outcome === 'solved') return 'solution';
  return 'open';
}

export interface TreeTotals {
  /** Placements tried (every node but the root). */
  tried: number;
  /** Placements undone after exploring (or finding nothing to explore) below them. */
  deadEnds: number;
  /** Placements ruled out on the spot by a pruning criterion. */
  cuts: number;
}

export function treeTotals(tree: SearchTree): TreeTotals {
  let deadEnds = 0;
  let cuts = 0;
  for (const node of tree.nodes) {
    if (node.closedAt === null) continue;
    if (node.prunedBy) cuts++;
    else deadEnds++;
  }
  return { tried: tree.nodes.length - 1, deadEnds, cuts };
}

/** The full board the run ended on, or null if it didn't find a solution. */
export function solutionBoard(tree: SearchTree): Board | null {
  if (tree.outcome !== 'solved') return null;
  let deepest: SearchNode | null = null;
  for (const node of tree.nodes) {
    if (node.closedAt === null && (!deepest || node.depth > deepest.depth)) deepest = node;
  }
  return deepest ? deepest.board : null;
}

/**
 * Generates the static 500-challenge dataset (contracts/challenge-data.schema.json)
 * into src/data/challenges.json. Run via `npm run generate:challenges`.
 *
 * Every challenge's piece subset is verified tileable into its 5xk board before
 * being included, guaranteeing FR-014 ("every challenge MUST be solvable") at the
 * data level — independent of, and prior to, the teaching solvers built later.
 *
 * Challenges are grouped into tiers mirroring the physical Katamino manual's own
 * structure (Small Slam / Slam / Grand Slam / Super Slam / Challenge, each a grid
 * of lettered "Lines" crossed with board-width "PENTA N" columns), plus one
 * unofficial `bonus` tier for 12-piece (boardCols=12) content that has no
 * equivalent in the manual (its widest column is PENTA 11). See data-model.md
 * "Challenge tiers" for the full count table and the reconciliation that keeps
 * the grand total at exactly 500.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { PIECE_TYPE_IDS, type PieceTypeId } from '../../src/domain/pentomino';
import { solve } from '../../src/solvers/configurableSolver';
import { combinations } from './combinations';
import { mulberry32, shuffle } from './rng';

type ChallengeTier = 'small-slam' | 'slam' | 'grand-slam' | 'super-slam' | 'challenge' | 'bonus';

interface Challenge {
  id: number;
  boardRows: 5;
  boardCols: number;
  requiredPieces: PieceTypeId[];
  tier: ChallengeTier;
  line: string;
  difficulty: number;
}

interface TierCell {
  tier: ChallengeTier;
  line: string;
  boardCols: number;
}

const TOTAL_CHALLENGES = 500;
// k=2 is excluded: no pair of distinct pentominoes tiles a 5x2 rectangle
// (verified empirically — every one of the C(12,2)=66 pairs is untileable),
// so the smallest usable challenge uses 3 pieces on a 5x3 board.
const MIN_K = 3;
const MAX_K = 12;
const K_VALUES = Array.from({ length: MAX_K - MIN_K + 1 }, (_, i) => MIN_K + i);

const SMALL_SLAM_LINES = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
const SLAM_PART1_LINES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N'];
const SLAM_PART2_LINES = [
  'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', '♠', '♥', '♦', '♣',
];
const GRAND_SLAM_LINES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
const SUPER_SLAM_LINES = GRAND_SLAM_LINES;
const SUPER_SLAM_BONUS_LINES = SUPER_SLAM_LINES.map((line) => `${line}2`);
const CHALLENGE_COUNT = 25;
const BONUS_COUNT = 48;

/**
 * Ordered list of every (tier, line, boardCols) cell the dataset must contain.
 * Order here is id order: tier by manual order, then line-major/width-minor
 * within each tier (matching the manual's own "complete PENTA 3, 4, 5... of
 * Line A, then start Line B" progression). This keeps id:1 = small-slam/A/3,
 * which existing e2e specs rely on (they click challenge-card-1/-2 with no
 * prior interaction, assuming the easiest challenges sort first).
 */
function buildTierCells(): TierCell[] {
  const cells: TierCell[] = [];

  for (const line of SMALL_SLAM_LINES) {
    for (let k = 3; k <= 8; k++) cells.push({ tier: 'small-slam', line, boardCols: k });
  }

  for (const line of SLAM_PART1_LINES) {
    for (let k = 5; k <= 9; k++) cells.push({ tier: 'slam', line, boardCols: k });
  }
  for (const line of SLAM_PART2_LINES) {
    for (let k = 6; k <= 8; k++) cells.push({ tier: 'slam', line, boardCols: k });
  }

  for (const line of GRAND_SLAM_LINES) {
    for (let k = 4; k <= 11; k++) cells.push({ tier: 'grand-slam', line, boardCols: k });
  }

  for (const line of SUPER_SLAM_LINES) {
    for (let k = 5; k <= 11; k++) cells.push({ tier: 'super-slam', line, boardCols: k });
  }
  for (const line of SUPER_SLAM_BONUS_LINES) {
    cells.push({ tier: 'super-slam', line, boardCols: 9 });
  }

  for (let n = 1; n <= CHALLENGE_COUNT; n++) {
    const line = `N°${n}`;
    for (const k of [7, 8, 9, 10]) cells.push({ tier: 'challenge', line, boardCols: k });
  }

  for (let i = 0; i < BONUS_COUNT; i++) {
    cells.push({ tier: 'bonus', line: '', boardCols: 12 });
  }

  return cells;
}

function neededPerK(cells: readonly TierCell[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const cell of cells) {
    counts.set(cell.boardCols, (counts.get(cell.boardCols) ?? 0) + 1);
  }
  return counts;
}

function comboKey(combo: readonly PieceTypeId[]): string {
  return combo.slice().sort().join('');
}

/**
 * Checks whether `combo` tiles a 5xk board, by running the app's own
 * constraint-guided (MRV) solver to completion. This is the same solver
 * verify:challenges already proves solves every real challenge — including
 * the hardest case, all 12 pentominoes on a 5x12 board — in about a second,
 * so it's both faster and more reliable here than a bespoke, unpruned
 * backtracking tiler would be.
 */
function isTileable(k: number, combo: readonly PieceTypeId[]): boolean {
  const probe = {
    id: 0,
    boardRows: 5 as const,
    boardCols: k,
    requiredPieces: combo as PieceTypeId[],
    tier: 'bonus' as const,
    line: '',
    difficulty: k,
  };
  const gen = solve(probe, ['most-constrained-cell'], { maxSteps: Infinity });
  let step = gen.next();
  while (!step.done) step = gen.next();
  return step.value.solvedAtStepIndex !== -1;
}

/** Finds (at least) `needed` distinct tileable k-piece combinations, in shuffled order. */
function tileableCombosForK(
  k: number,
  needed: number,
  rand: () => number,
  tileableCache: Map<string, boolean>,
): PieceTypeId[][] {
  const allCombos = shuffle(combinations(PIECE_TYPE_IDS, k), rand);
  if (allCombos.length === 0) {
    throw new Error(`No combinations of size ${k} available`);
  }

  const tileableCombos: PieceTypeId[][] = [];
  for (const combo of allCombos) {
    const key = comboKey(combo);
    let tileable = tileableCache.get(key);
    if (tileable === undefined) {
      tileable = isTileable(k, combo);
      tileableCache.set(key, tileable);
    }
    if (tileable) tileableCombos.push(combo);
    if (tileableCombos.length >= needed) break;
  }

  if (tileableCombos.length === 0) {
    throw new Error(`No tileable ${k}-piece combination found for a 5x${k} board`);
  }
  return tileableCombos;
}

function generate(): Challenge[] {
  const tileableCache = new Map<string, boolean>();
  const cells = buildTierCells();
  const counts = neededPerK(cells);

  const combosByK = new Map<number, PieceTypeId[][]>();
  const cursorByK = new Map<number, number>();
  for (const k of K_VALUES) {
    const needed = counts.get(k) ?? 0;
    if (needed === 0) continue;
    // Each board width gets its own independent, deterministic RNG stream, so
    // a given width's chosen combos never shift just because another tier's
    // quota changed (which combo ends up picked is still reproducible per k).
    const kRand = mulberry32(20260809 + k);
    combosByK.set(k, tileableCombosForK(k, needed, kRand, tileableCache));
    cursorByK.set(k, 0);
  }

  const challenges: Challenge[] = [];
  let nextId = 1;
  for (const cell of cells) {
    const combos = combosByK.get(cell.boardCols)!;
    const cursor = cursorByK.get(cell.boardCols)!;
    const combo = combos[cursor % combos.length];
    cursorByK.set(cell.boardCols, cursor + 1);

    challenges.push({
      id: nextId++,
      boardRows: 5,
      boardCols: cell.boardCols,
      requiredPieces: combo.slice().sort(
        (a, b) => PIECE_TYPE_IDS.indexOf(a) - PIECE_TYPE_IDS.indexOf(b),
      ),
      tier: cell.tier,
      line: cell.line,
      difficulty: cell.boardCols,
    });
  }

  return challenges;
}

const EXPECTED_TIER_COUNTS: Record<ChallengeTier, number> = {
  'small-slam': 42,
  slam: 118,
  'grand-slam': 96,
  'super-slam': 96,
  challenge: 100,
  bonus: 48,
};

function assertTierCounts(challenges: readonly Challenge[]) {
  const actual = new Map<ChallengeTier, number>();
  for (const c of challenges) actual.set(c.tier, (actual.get(c.tier) ?? 0) + 1);

  for (const [tier, expected] of Object.entries(EXPECTED_TIER_COUNTS) as [ChallengeTier, number][]) {
    const got = actual.get(tier) ?? 0;
    if (got !== expected) {
      throw new Error(`Tier "${tier}": expected ${expected} challenges, got ${got}`);
    }
  }
}

function main() {
  const challenges = generate();
  if (challenges.length !== TOTAL_CHALLENGES) {
    throw new Error(`Expected ${TOTAL_CHALLENGES} challenges, generated ${challenges.length}`);
  }
  assertTierCounts(challenges);

  const dataset = { version: 2 as const, challenges };
  const outPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../src/data/challenges.json',
  );
  writeFileSync(outPath, JSON.stringify(dataset, null, 2) + '\n', 'utf-8');
  console.log(`Wrote ${challenges.length} challenges to ${outPath}`);
}

main();

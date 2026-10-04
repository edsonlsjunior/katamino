/**
 * Generates the static 500-challenge dataset (contracts/challenge-data.schema.json)
 * into src/data/challenges.json. Run via `npm run generate:challenges`.
 *
 * Every challenge's piece subset is verified tileable into its 5xk board before
 * being included, guaranteeing FR-014 ("every challenge MUST be solvable") at the
 * data level — independent of, and prior to, the teaching solvers built later.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { PIECE_TYPE_IDS, type PieceTypeId } from '../../src/domain/pentomino';
import { combinations } from './combinations';
import { findTiling } from './tiler';
import { mulberry32, shuffle } from './rng';

interface Challenge {
  id: number;
  boardRows: 5;
  boardCols: number;
  requiredPieces: PieceTypeId[];
  difficulty: number;
}

const TOTAL_CHALLENGES = 500;
// k=2 is excluded: no pair of distinct pentominoes tiles a 5x2 rectangle
// (verified empirically — every one of the C(12,2)=66 pairs is untileable),
// so the smallest usable challenge uses 3 pieces on a 5x3 board.
const MIN_K = 3;
const MAX_K = 12;
const K_VALUES = Array.from({ length: MAX_K - MIN_K + 1 }, (_, i) => MIN_K + i);

// 500 / 11 = 45 remainder 5: give the first 5 (smallest, easiest) k-values one extra.
function countsPerK(): Map<number, number> {
  const base = Math.floor(TOTAL_CHALLENGES / K_VALUES.length);
  const remainder = TOTAL_CHALLENGES - base * K_VALUES.length;
  const counts = new Map<number, number>();
  K_VALUES.forEach((k, i) => counts.set(k, base + (i < remainder ? 1 : 0)));
  return counts;
}

function comboKey(combo: readonly PieceTypeId[]): string {
  return combo.slice().sort().join('');
}

function generate(): Challenge[] {
  const rand = mulberry32(20260809);
  const tileableCache = new Map<string, boolean>();
  const challenges: Challenge[] = [];
  let nextId = 1;

  for (const k of K_VALUES) {
    const needed = countsPerK().get(k)!;
    const allCombos = shuffle(combinations(PIECE_TYPE_IDS, k), rand);
    if (allCombos.length === 0) {
      throw new Error(`No combinations of size ${k} available`);
    }

    const tileableCombos: PieceTypeId[][] = [];
    for (const combo of allCombos) {
      const key = comboKey(combo);
      let tileable = tileableCache.get(key);
      if (tileable === undefined) {
        tileable = findTiling(5, k, combo, rand);
        tileableCache.set(key, tileable);
      }
      if (tileable) tileableCombos.push(combo);
      if (tileableCombos.length >= needed) break;
    }

    if (tileableCombos.length === 0) {
      throw new Error(`No tileable ${k}-piece combination found for a 5x${k} board`);
    }

    for (let i = 0; i < needed; i++) {
      const combo = tileableCombos[i % tileableCombos.length];
      challenges.push({
        id: nextId++,
        boardRows: 5,
        boardCols: k,
        requiredPieces: combo.slice().sort(
          (a, b) => PIECE_TYPE_IDS.indexOf(a) - PIECE_TYPE_IDS.indexOf(b),
        ),
        difficulty: k,
      });
    }
  }

  return challenges;
}

function main() {
  const challenges = generate();
  if (challenges.length !== TOTAL_CHALLENGES) {
    throw new Error(`Expected ${TOTAL_CHALLENGES} challenges, generated ${challenges.length}`);
  }

  const dataset = { version: 1 as const, challenges };
  const outPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../src/data/challenges.json',
  );
  writeFileSync(outPath, JSON.stringify(dataset, null, 2) + '\n', 'utf-8');
  console.log(`Wrote ${challenges.length} challenges to ${outPath}`);
}

main();

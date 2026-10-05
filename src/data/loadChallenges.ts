import raw from './challenges.json';
import { PIECE_TYPE_IDS, type PieceTypeId } from '../domain/pentomino';
import type { Challenge, ChallengeTier } from '../domain/types';

interface RawDataset {
  version: number;
  challenges: Array<{
    id: number;
    boardRows: number;
    boardCols: number;
    requiredPieces: string[];
    tier: string;
    line: string;
    difficulty: number;
  }>;
}

const VALID_PIECE_IDS = new Set<string>(PIECE_TYPE_IDS);
const VALID_TIERS = new Set<ChallengeTier>([
  'small-slam',
  'slam',
  'grand-slam',
  'super-slam',
  'challenge',
  'bonus',
]);

function isPieceTypeId(value: string): value is PieceTypeId {
  return VALID_PIECE_IDS.has(value);
}

function isChallengeTier(value: string): value is ChallengeTier {
  return VALID_TIERS.has(value as ChallengeTier);
}

function validate(dataset: RawDataset): Challenge[] {
  if (dataset.version !== 2) {
    throw new Error(`Unsupported challenge dataset version: ${dataset.version}`);
  }
  return dataset.challenges.map((c) => {
    if (c.boardRows !== 5) {
      throw new Error(`Challenge ${c.id}: boardRows must be 5, got ${c.boardRows}`);
    }
    if (c.requiredPieces.length !== c.boardCols) {
      throw new Error(`Challenge ${c.id}: requiredPieces length must equal boardCols`);
    }
    if (!c.requiredPieces.every(isPieceTypeId)) {
      throw new Error(`Challenge ${c.id}: contains an unknown piece type id`);
    }
    if (!isChallengeTier(c.tier)) {
      throw new Error(`Challenge ${c.id}: unknown tier "${c.tier}"`);
    }
    return {
      id: c.id,
      boardRows: 5,
      boardCols: c.boardCols,
      requiredPieces: c.requiredPieces as PieceTypeId[],
      tier: c.tier,
      line: c.line,
      difficulty: c.difficulty,
    } satisfies Challenge;
  });
}

let cached: Challenge[] | null = null;
let cachedByTier: Map<ChallengeTier, Challenge[]> | null = null;

/** All 500 bundled challenges, validated once and cached (FR-001, FR-002). */
export function loadChallenges(): Challenge[] {
  if (!cached) {
    cached = validate(raw as RawDataset);
  }
  return cached;
}

/** Manual order tiers should be browsed/displayed in. */
export const CHALLENGE_TIER_ORDER: readonly ChallengeTier[] = [
  'small-slam',
  'slam',
  'grand-slam',
  'super-slam',
  'challenge',
  'bonus',
];

/** The 500 challenges partitioned by tier, in manual display order; computed once and cached. */
export function loadChallengesByTier(): Map<ChallengeTier, Challenge[]> {
  if (!cachedByTier) {
    const map = new Map<ChallengeTier, Challenge[]>();
    for (const tier of CHALLENGE_TIER_ORDER) map.set(tier, []);
    for (const challenge of loadChallenges()) {
      map.get(challenge.tier)!.push(challenge);
    }
    cachedByTier = map;
  }
  return cachedByTier;
}

export function getChallengeById(id: number): Challenge | undefined {
  return loadChallenges().find((c) => c.id === id);
}

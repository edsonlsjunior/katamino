import raw from './challenges.json';
import { PIECE_TYPE_IDS, type PieceTypeId } from '../domain/pentomino';
import type { Challenge } from '../domain/types';

interface RawDataset {
  version: number;
  challenges: Array<{
    id: number;
    boardRows: number;
    boardCols: number;
    requiredPieces: string[];
    difficulty: number;
  }>;
}

const VALID_PIECE_IDS = new Set<string>(PIECE_TYPE_IDS);

function isPieceTypeId(value: string): value is PieceTypeId {
  return VALID_PIECE_IDS.has(value);
}

function validate(dataset: RawDataset): Challenge[] {
  if (dataset.version !== 1) {
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
    return {
      id: c.id,
      boardRows: 5,
      boardCols: c.boardCols,
      requiredPieces: c.requiredPieces as PieceTypeId[],
      difficulty: c.difficulty,
    } satisfies Challenge;
  });
}

let cached: Challenge[] | null = null;

/** All 500 bundled challenges, validated once and cached (FR-001, FR-002). */
export function loadChallenges(): Challenge[] {
  if (!cached) {
    cached = validate(raw as RawDataset);
  }
  return cached;
}

export function getChallengeById(id: number): Challenge | undefined {
  return loadChallenges().find((c) => c.id === id);
}

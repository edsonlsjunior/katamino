import { describe, expect, it } from 'vitest';
import {
  PIECE_TYPES,
  PIECE_TYPE_IDS,
  cellsAt,
  rotateOrientation,
  flipOrientation,
} from '../../../src/domain/pentomino';

const EXPECTED_ORIENTATION_COUNTS: Record<string, number> = {
  F: 8,
  I: 2,
  L: 8,
  N: 8,
  P: 8,
  T: 4,
  U: 4,
  V: 4,
  W: 4,
  X: 1,
  Y: 8,
  Z: 4,
};

describe('pentomino domain model', () => {
  it('defines all 12 standard pentominoes', () => {
    expect(PIECE_TYPE_IDS).toHaveLength(12);
  });

  it('gives every piece exactly 5 cells in its base shape', () => {
    for (const id of PIECE_TYPE_IDS) {
      expect(PIECE_TYPES[id].baseShape).toHaveLength(5);
    }
  });

  it.each(PIECE_TYPE_IDS)('deduplicates orientations for %s to the expected symmetry count', (id) => {
    expect(PIECE_TYPES[id].orientations.length).toBe(EXPECTED_ORIENTATION_COUNTS[id]);
  });

  it('every orientation has exactly 5 cells and is top-left normalized', () => {
    for (const id of PIECE_TYPE_IDS) {
      for (const orientation of PIECE_TYPES[id].orientations) {
        expect(orientation).toHaveLength(5);
        const minRow = Math.min(...orientation.map(([r]) => r));
        const minCol = Math.min(...orientation.map(([, c]) => c));
        expect(minRow).toBe(0);
        expect(minCol).toBe(0);
      }
    }
  });

  it('has no duplicate orientations (each is a genuinely distinct shape)', () => {
    for (const id of PIECE_TYPE_IDS) {
      const keys = PIECE_TYPES[id].orientations.map((o) =>
        o
          .slice()
          .sort((a, b) => a[0] - b[0] || a[1] - b[1])
          .map(([r, c]) => `${r},${c}`)
          .join('|'),
      );
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it('rotateOrientation cycles through every orientation and wraps around', () => {
    let index = 0;
    const seen = new Set<number>();
    const total = PIECE_TYPES.L.orientations.length;
    for (let i = 0; i < total; i++) {
      seen.add(index);
      index = rotateOrientation('L', index);
    }
    expect(seen.size).toBe(total);
    expect(index).toBe(0); // wrapped back to the start
  });

  it('flipOrientation is a no-op for the fully symmetric X piece', () => {
    expect(flipOrientation('X', 0)).toBe(0);
  });

  it('flipOrientation lands on a valid orientation index for an asymmetric piece', () => {
    const flipped = flipOrientation('F', 0);
    expect(flipped).toBeGreaterThanOrEqual(0);
    expect(flipped).toBeLessThan(PIECE_TYPES.F.orientations.length);
  });

  it('cellsAt translates an orientation to an absolute board position', () => {
    const cells = cellsAt('X', 0, [2, 3]);
    // X (plus-shape) orientation 0 is its only orientation: (0,1)(1,0)(1,1)(1,2)(2,1)
    expect(cells).toEqual([
      [2, 4],
      [3, 3],
      [3, 4],
      [3, 5],
      [4, 4],
    ]);
  });
});

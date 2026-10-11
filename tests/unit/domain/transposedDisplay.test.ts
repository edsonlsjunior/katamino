import { describe, expect, it } from 'vitest';
import {
  PIECE_TYPES,
  PIECE_TYPE_IDS,
  flipOrientation,
  rotateOrientation,
  type Cell,
} from '../../../src/domain/pentomino';

// On narrow screens the board (and every piece) may be drawn transposed —
// mirrored along the diagonal — while the model stays untouched. These tests
// pin down the translation the UI relies on (ManualPlayPage.tsx): what the
// player does to the piece *as drawn* must be exactly what they see happen.

type Shape = readonly Cell[];

const key = (cells: Shape) =>
  [...cells]
    .sort((a, b) => a[0] - b[0] || a[1] - b[1])
    .map(([r, c]) => `${r},${c}`)
    .join('|');

function normalize(cells: Shape): Cell[] {
  const minRow = Math.min(...cells.map(([r]) => r));
  const minCol = Math.min(...cells.map(([, c]) => c));
  return cells.map(([r, c]) => [r - minRow, c - minCol] as Cell);
}

// Plain geometry on a set of cells, independent of the domain code.
const transpose = (cells: Shape) => cells.map(([r, c]) => [c, r] as Cell);
const turnClockwise = (cells: Shape) => normalize(cells.map(([r, c]) => [c, -r] as Cell));
const flipLeftRight = (cells: Shape) => normalize(cells.map(([r, c]) => [r, -c] as Cell));
const flipTopBottom = (cells: Shape) => normalize(cells.map(([r, c]) => [-r, c] as Cell));

/** Every (piece, orientation) pair. */
const cases = PIECE_TYPE_IDS.flatMap((id) => PIECE_TYPES[id].orientations.map((_, index) => [id, index] as const));

describe('transposed drawing of pieces', () => {
  it('a transposed piece is still one of that piece’s own orientations', () => {
    for (const [id, index] of cases) {
      const { orientations } = PIECE_TYPES[id];
      const drawn = key(transpose(orientations[index]));
      expect(orientations.some((o) => key(o) === drawn)).toBe(true);
    }
  });

  it('a clockwise turn on screen is three clockwise turns of the model', () => {
    for (const [id, index] of cases) {
      const { orientations } = PIECE_TYPES[id];
      let modelIndex = index;
      for (let i = 0; i < 3; i++) modelIndex = rotateOrientation(id, modelIndex);

      const seenBefore = transpose(orientations[index]);
      const seenAfter = transpose(orientations[modelIndex]);
      expect(key(seenAfter)).toBe(key(turnClockwise(seenBefore)));
    }
  });

  it('a left-right flip on screen is a top-bottom flip of the model, and vice versa', () => {
    for (const [id, index] of cases) {
      const { orientations } = PIECE_TYPES[id];
      const seenBefore = transpose(orientations[index]);

      const afterVertical = transpose(orientations[flipOrientation(id, index, 'vertical')]);
      expect(key(afterVertical)).toBe(key(flipLeftRight(seenBefore)));

      const afterHorizontal = transpose(orientations[flipOrientation(id, index, 'horizontal')]);
      expect(key(afterHorizontal)).toBe(key(flipTopBottom(seenBefore)));
    }
  });

  it('without transposing, turns and flips are what they say', () => {
    for (const [id, index] of cases) {
      const { orientations } = PIECE_TYPES[id];
      const before = orientations[index];
      expect(key(orientations[rotateOrientation(id, index)])).toBe(key(turnClockwise(before)));
      expect(key(orientations[flipOrientation(id, index, 'horizontal')])).toBe(key(flipLeftRight(before)));
      expect(key(orientations[flipOrientation(id, index, 'vertical')])).toBe(key(flipTopBottom(before)));
    }
  });
});

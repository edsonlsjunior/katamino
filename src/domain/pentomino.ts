/**
 * The 12 standard free pentominoes used by Katamino, their canonical shapes,
 * and the deduplicated set of orientations (rotations + mirror) each supports.
 * See data-model.md "Pentomino / PieceType".
 */

export type PieceTypeId = 'F' | 'I' | 'L' | 'N' | 'P' | 'T' | 'U' | 'V' | 'W' | 'X' | 'Y' | 'Z';

export type Cell = readonly [row: number, col: number];

export interface PieceType {
  id: PieceTypeId;
  color: string;
  baseShape: readonly Cell[];
  orientations: readonly (readonly Cell[])[];
}

export const PIECE_TYPE_IDS: readonly PieceTypeId[] = [
  'F',
  'I',
  'L',
  'N',
  'P',
  'T',
  'U',
  'V',
  'W',
  'X',
  'Y',
  'Z',
];

const BASE_SHAPES: Record<PieceTypeId, readonly Cell[]> = {
  F: [
    [0, 1],
    [0, 2],
    [1, 0],
    [1, 1],
    [2, 1],
  ],
  I: [
    [0, 0],
    [1, 0],
    [2, 0],
    [3, 0],
    [4, 0],
  ],
  L: [
    [0, 0],
    [1, 0],
    [2, 0],
    [3, 0],
    [3, 1],
  ],
  N: [
    [0, 1],
    [1, 1],
    [2, 0],
    [2, 1],
    [3, 0],
  ],
  P: [
    [0, 0],
    [0, 1],
    [1, 0],
    [1, 1],
    [2, 0],
  ],
  T: [
    [0, 0],
    [0, 1],
    [0, 2],
    [1, 1],
    [2, 1],
  ],
  U: [
    [0, 0],
    [0, 2],
    [1, 0],
    [1, 1],
    [1, 2],
  ],
  V: [
    [0, 0],
    [1, 0],
    [2, 0],
    [2, 1],
    [2, 2],
  ],
  W: [
    [0, 0],
    [1, 0],
    [1, 1],
    [2, 1],
    [2, 2],
  ],
  X: [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, 2],
    [2, 1],
  ],
  Y: [
    [0, 1],
    [1, 0],
    [1, 1],
    [2, 1],
    [3, 1],
  ],
  Z: [
    [0, 0],
    [0, 1],
    [1, 1],
    [2, 1],
    [2, 2],
  ],
};

const PIECE_COLORS: Record<PieceTypeId, string> = {
  F: '#4E79A7',
  I: '#F28E2B',
  L: '#E15759',
  N: '#76B7B2',
  P: '#59A14F',
  T: '#EDC948',
  U: '#B07AA1',
  V: '#FF9DA7',
  W: '#9C755F',
  X: '#BAB0AC',
  Y: '#D37295',
  Z: '#86BCB6',
};

/** Rotate cells 90 degrees clockwise: (r, c) -> (c, -r). */
function rotate90(cells: readonly Cell[]): Cell[] {
  return cells.map(([r, c]) => [c, -r] as Cell);
}

/** Mirror cells horizontally: (r, c) -> (r, -c). */
function mirror(cells: readonly Cell[]): Cell[] {
  return cells.map(([r, c]) => [r, -c] as Cell);
}

/** Mirror cells vertically: (r, c) -> (-r, c). */
function mirrorVertically(cells: readonly Cell[]): Cell[] {
  return cells.map(([r, c]) => [-r, c] as Cell);
}

/** Shift cells so the minimum row and column are both 0. */
function normalize(cells: readonly Cell[]): Cell[] {
  const minRow = Math.min(...cells.map(([r]) => r));
  const minCol = Math.min(...cells.map(([, c]) => c));
  return cells
    .map(([r, c]) => [r - minRow, c - minCol] as Cell)
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}

function cellsKey(cells: readonly Cell[]): string {
  return cells.map(([r, c]) => `${r},${c}`).join('|');
}

/** All 8 rotation/mirror transforms of a shape, deduplicated and normalized. */
function computeOrientations(baseShape: readonly Cell[]): Cell[][] {
  const seen = new Map<string, Cell[]>();
  let current = baseShape;
  for (const source of [baseShape, mirror(baseShape)]) {
    current = source;
    for (let i = 0; i < 4; i++) {
      const normalized = normalize(current);
      const key = cellsKey(normalized);
      if (!seen.has(key)) {
        seen.set(key, normalized);
      }
      current = rotate90(current);
    }
  }
  return [...seen.values()];
}

function buildPieceTypes(): Record<PieceTypeId, PieceType> {
  const result = {} as Record<PieceTypeId, PieceType>;
  for (const id of PIECE_TYPE_IDS) {
    const baseShape = BASE_SHAPES[id];
    result[id] = {
      id,
      color: PIECE_COLORS[id],
      baseShape,
      orientations: computeOrientations(baseShape),
    };
  }
  return result;
}

export const PIECE_TYPES: Readonly<Record<PieceTypeId, PieceType>> = buildPieceTypes();

export function getPieceType(id: PieceTypeId): PieceType {
  return PIECE_TYPES[id];
}

/** Cells (normalized, top-left anchored) for a piece's orientation, translated to a board position. */
export function cellsAt(
  typeId: PieceTypeId,
  orientationIndex: number,
  position: Cell,
): Cell[] {
  const orientation = PIECE_TYPES[typeId].orientations[orientationIndex];
  const [row, col] = position;
  return orientation.map(([r, c]) => [r + row, c + col] as Cell);
}

/**
 * The current orientation turned 90 degrees clockwise (FR-003 "rotate"). A
 * true rotation: it never turns a piece into its mirror image (that is what
 * flipOrientation is for), so four rotations always come back to the start.
 */
export function rotateOrientation(typeId: PieceTypeId, orientationIndex: number): number {
  const { orientations } = PIECE_TYPES[typeId];
  const rotatedKey = cellsKey(normalize(rotate90(orientations[orientationIndex])));
  const found = orientations.findIndex((o) => cellsKey(o) === rotatedKey);
  return found === -1 ? orientationIndex : found;
}

/** 'horizontal' swaps left and right; 'vertical' swaps top and bottom. */
export type FlipAxis = 'horizontal' | 'vertical';

/**
 * The mirrored counterpart of the current orientation (FR-003 "flip"). For
 * pieces symmetric under mirroring (e.g. I, X), this is a no-op (returns the
 * same index), which matches how those pieces behave physically.
 */
export function flipOrientation(
  typeId: PieceTypeId,
  orientationIndex: number,
  axis: FlipAxis = 'horizontal',
): number {
  const { orientations } = PIECE_TYPES[typeId];
  const flip = axis === 'vertical' ? mirrorVertically : mirror;
  const mirroredKey = cellsKey(normalize(flip(orientations[orientationIndex])));
  const found = orientations.findIndex((o) => cellsKey(o) === mirroredKey);
  return found === -1 ? orientationIndex : found;
}

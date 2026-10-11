import { PIECE_TYPES, type PieceTypeId } from '../domain/pentomino';
import type { PieceInstance } from '../domain/types';

export type RingPosition = 'top' | 'right' | 'bottom' | 'left';
export type RingGroups = Record<RingPosition, PieceInstance[]>;

// Must match Board.css (.board gap / padding) and App.css (.board-arena).
export const CELL_GAP_PX = 2;
export const BOARD_PADDING_PX = 4;
const SLOT_GAP_PX = 12;
const RING_GAP_PX = 16;

/** Extra thickness of the strip around its pieces: padding plus a thin scrollbar. */
const STRIP_CHROME_PX = 20;
/** Below this arena width there is no room for pieces around the board. */
const NARROW_ARENA_PX = 600;

const MIN_CELL_PX = 12;
const MAX_CELL_PX = 200;

/** Longest side of a piece's bounding box, in cells — the same for every
 * orientation, so a square slot of this size holds the piece however it is
 * rotated or flipped. */
export function pieceSpan(typeId: PieceTypeId): number {
  const cells = PIECE_TYPES[typeId].orientations[0];
  return Math.max(...cells.map(([r]) => r), ...cells.map(([, c]) => c)) + 1;
}

/**
 * Ways of splitting the pieces into the four rings around the board:
 * - mixed: long pieces (I, L, N, Y) on the sides, compact ones above/below,
 *   which keeps the top/bottom rings thin (the board is always 5 rows tall,
 *   so height is usually the scarce dimension);
 * - sides: everything left/right (best for few pieces on a wide screen);
 * - bands: everything above/below (best on a narrow, tall screen).
 */
type RingStrategy = 'mixed' | 'sides' | 'bands';
const RING_STRATEGIES: readonly RingStrategy[] = ['mixed', 'sides', 'bands'];

function assignRings(pieces: readonly PieceInstance[], strategy: RingStrategy): RingGroups {
  const groups: RingGroups = { top: [], right: [], bottom: [], left: [] };
  let side = 0;
  let band = 0;
  for (const piece of pieces) {
    const onSide = strategy === 'sides' || (strategy === 'mixed' && pieceSpan(piece.typeId) > 3);
    if (onSide) groups[side++ % 2 === 0 ? 'left' : 'right'].push(piece);
    else groups[band++ % 2 === 0 ? 'top' : 'bottom'].push(piece);
  }
  return groups;
}

export interface ArenaLayout {
  /** Side of one cell in px, shared by the board and the loose pieces. */
  cellSize: number;
  /** Slot size (in cells) of the left/right rings; 0 when both are empty. */
  sideSpan: number;
  /** Slot size (in cells) of the top/bottom rings; 0 when both are empty. */
  bandSpan: number;
}

/**
 * Largest cell size at which the board plus its four rings of real-size
 * pieces fit inside a width x height box. Opposite rings reserve the same
 * thickness so the board stays centered, and the result depends only on which
 * pieces the challenge has — not on what is placed or how it is rotated — so
 * the board never resizes mid-attempt.
 */
function fitArena(
  width: number,
  height: number,
  cols: number,
  rows: number,
  rings: RingGroups,
): ArenaLayout {
  const spans = (ring: PieceInstance[]) => ring.map((p) => pieceSpan(p.typeId));
  const sideSpan = Math.max(0, ...spans(rings.left), ...spans(rings.right));
  const bandSpan = Math.max(0, ...spans(rings.top), ...spans(rings.bottom));

  const slot = (span: number, u: number) => (span > 0 ? span * u + (span - 1) * CELL_GAP_PX : 0);
  const run = (ring: PieceInstance[], u: number) =>
    spans(ring).reduce((sum, span) => sum + slot(span, u), 0) +
    Math.max(0, ring.length - 1) * SLOT_GAP_PX;

  function fits(u: number) {
    const boardW = slot(cols, u) + 2 * BOARD_PADDING_PX;
    const boardH = slot(rows, u) + 2 * BOARD_PADDING_PX;
    const sides = sideSpan > 0 ? 2 * (slot(sideSpan, u) + RING_GAP_PX) : 0;
    const bands = bandSpan > 0 ? 2 * (slot(bandSpan, u) + RING_GAP_PX) : 0;
    const totalW = Math.max(boardW, run(rings.top, u), run(rings.bottom, u)) + sides;
    const totalH = Math.max(boardH + bands, run(rings.left, u), run(rings.right, u));
    return totalW <= width && totalH <= height;
  }

  let cellSize = MAX_CELL_PX;
  while (cellSize > MIN_CELL_PX && !fits(cellSize)) cellSize--;
  return { cellSize, sideSpan, bandSpan };
}

/**
 * The board is always drawn transposed: the model is 5 rows by N columns,
 * but on screen it is 5 cells across and grows downwards with the challenge.
 * Only the drawing changes — the model, the solver and the saved attempt
 * keep rows x cols (see the translation helpers in ManualPlayPage.tsx).
 */
const TRANSPOSED = true;

/** Pieces dealt in rings around the board (wide screens). */
export interface RingsPlan {
  mode: 'rings';
  transposed: boolean;
  cellSize: number;
  rings: RingGroups;
  layout: ArenaLayout;
  /**
   * Set when every piece sits beside the board, each side wrapped into as
   * many columns as the arena's height requires. Both sides get the same
   * width so the board stays centered.
   */
  sideColumns?: { left: PieceInstance[][]; right: PieceInstance[][]; widthPx: number };
}

/**
 * Every piece beside the board (alternating sides), each side wrapped into
 * columns that fit the arena's height — which leaves the whole height to the
 * board itself.
 */
function fitSideColumns(
  width: number,
  height: number,
  cols: number,
  rows: number,
  pieces: readonly PieceInstance[],
): Pick<RingsPlan, 'cellSize' | 'rings' | 'layout' | 'sideColumns'> {
  const rings = assignRings(pieces, 'sides');
  const slot = (span: number, u: number) => span * u + (span - 1) * CELL_GAP_PX;

  function wrap(ring: PieceInstance[], u: number): PieceInstance[][] {
    const columns: PieceInstance[][] = [];
    let current: PieceInstance[] = [];
    let used = 0;
    for (const piece of ring) {
      const size = slot(pieceSpan(piece.typeId), u);
      if (current.length > 0 && used + SLOT_GAP_PX + size > height) {
        columns.push(current);
        current = [];
        used = 0;
      }
      used += (current.length > 0 ? SLOT_GAP_PX : 0) + size;
      current.push(piece);
    }
    if (current.length > 0) columns.push(current);
    return columns;
  }
  const widthOf = (columns: PieceInstance[][], u: number) =>
    columns.reduce(
      (sum, column) => sum + slot(Math.max(...column.map((p) => pieceSpan(p.typeId))), u),
      0,
    ) +
    Math.max(0, columns.length - 1) * SLOT_GAP_PX;

  function arrange(u: number) {
    const left = wrap(rings.left, u);
    const right = wrap(rings.right, u);
    return { left, right, widthPx: Math.max(widthOf(left, u), widthOf(right, u)) };
  }
  function fits(u: number) {
    const boardW = slot(cols, u) + 2 * BOARD_PADDING_PX;
    const boardH = slot(rows, u) + 2 * BOARD_PADDING_PX;
    const tallestSlot = slot(Math.max(1, ...pieces.map((p) => pieceSpan(p.typeId))), u);
    const { widthPx } = arrange(u);
    const sides = widthPx > 0 ? 2 * (widthPx + RING_GAP_PX) : 0;
    return boardW + sides <= width && boardH <= height && tallestSlot <= height;
  }

  let cellSize = MAX_CELL_PX;
  while (cellSize > MIN_CELL_PX && !fits(cellSize)) cellSize--;
  const sideColumns = arrange(cellSize);
  return {
    cellSize,
    rings,
    // No top/bottom rings; the side width comes from sideColumns instead of a span.
    layout: { cellSize, sideSpan: pieces.length > 0 ? 1 : 0, bandSpan: 0 },
    sideColumns,
  };
}

/**
 * Narrow screens: the board plus one scrollable strip holding the pieces,
 * either below it or beside it.
 */
export interface StripPlan {
  mode: 'strip';
  transposed: boolean;
  cellSize: number;
  side: 'below' | 'beside';
  /** Thickness of the strip, in cells (the largest piece slot). */
  stripSpan: number;
}

export type ArenaPlan = RingsPlan | StripPlan;

/**
 * Picks the arrangement of pieces that lets the cells be largest: rings
 * around the board, or everything in columns beside it (rings win ties).
 * `cols` and `rows` are the model's.
 */
function planRings(
  width: number,
  height: number,
  cols: number,
  rows: number,
  pieces: readonly PieceInstance[],
): RingsPlan {
  const shownCols = rows;
  const shownRows = cols;
  let best: RingsPlan | null = null;
  for (const strategy of RING_STRATEGIES) {
    const rings = assignRings(pieces, strategy);
    const layout = fitArena(width, height, shownCols, shownRows, rings);
    if (!best || layout.cellSize > best.cellSize) {
      best = { mode: 'rings', transposed: TRANSPOSED, cellSize: layout.cellSize, rings, layout };
    }
  }
  const columns = fitSideColumns(width, height, shownCols, shownRows, pieces);
  if (columns.cellSize > best!.cellSize)
    best = { mode: 'rings', transposed: TRANSPOSED, ...columns };
  return best!;
}

/** Picks the strip side that lets the cells be largest (`cols`/`rows` are the model's). */
function planStrip(
  width: number,
  height: number,
  cols: number,
  rows: number,
  pieces: readonly PieceInstance[],
): StripPlan {
  const stripSpan = Math.max(1, ...pieces.map((p) => pieceSpan(p.typeId)));
  const extent = (cells: number, u: number) => cells * u + (cells - 1) * CELL_GAP_PX;
  const strip = (u: number) => extent(stripSpan, u) + STRIP_CHROME_PX + RING_GAP_PX;

  let best: StripPlan | null = null;
  {
    const transposed = TRANSPOSED;
    const shownCols = rows;
    const shownRows = cols;
    for (const side of ['below', 'beside'] as const) {
      const fits = (u: number) => {
        const boardW = extent(shownCols, u) + 2 * BOARD_PADDING_PX;
        const boardH = extent(shownRows, u) + 2 * BOARD_PADDING_PX;
        return side === 'below'
          ? boardW <= width && boardH + strip(u) <= height
          : boardW + strip(u) <= width && boardH <= height;
      };
      let cellSize = MAX_CELL_PX;
      while (cellSize > MIN_CELL_PX && !fits(cellSize)) cellSize--;
      if (!best || cellSize > best.cellSize)
        best = { mode: 'strip', transposed, cellSize, side, stripSpan };
    }
  }
  return best!;
}

/** How to lay the board and its pieces out in a width x height arena. */
export function planArena(
  width: number,
  height: number,
  cols: number,
  rows: number,
  pieces: readonly PieceInstance[],
): ArenaPlan {
  return width < NARROW_ARENA_PX
    ? planStrip(width, height, cols, rows, pieces)
    : planRings(width, height, cols, rows, pieces);
}

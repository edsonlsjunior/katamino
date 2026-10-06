import { PIECE_TYPES, type PieceTypeId } from '../domain/pentomino';
import type { PieceInstance } from '../domain/types';

export type RingPosition = 'top' | 'right' | 'bottom' | 'left';
export type RingGroups = Record<RingPosition, PieceInstance[]>;

// Must match Board.css (.board gap / padding) and App.css (.board-arena).
export const CELL_GAP_PX = 2;
export const BOARD_PADDING_PX = 4;
const SLOT_GAP_PX = 12;
const RING_GAP_PX = 16;

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
function fitArena(width: number, height: number, cols: number, rows: number, rings: RingGroups): ArenaLayout {
  const spans = (ring: PieceInstance[]) => ring.map((p) => pieceSpan(p.typeId));
  const sideSpan = Math.max(0, ...spans(rings.left), ...spans(rings.right));
  const bandSpan = Math.max(0, ...spans(rings.top), ...spans(rings.bottom));

  const slot = (span: number, u: number) => (span > 0 ? span * u + (span - 1) * CELL_GAP_PX : 0);
  const run = (ring: PieceInstance[], u: number) =>
    spans(ring).reduce((sum, span) => sum + slot(span, u), 0) + Math.max(0, ring.length - 1) * SLOT_GAP_PX;

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

/** Picks the ring arrangement that lets the cells be largest in a
 * width x height arena. */
export function planArena(
  width: number,
  height: number,
  cols: number,
  rows: number,
  pieces: readonly PieceInstance[],
): { rings: RingGroups; layout: ArenaLayout } {
  let best: { rings: RingGroups; layout: ArenaLayout } | null = null;
  for (const strategy of RING_STRATEGIES) {
    const rings = assignRings(pieces, strategy);
    const layout = fitArena(width, height, cols, rows, rings);
    if (!best || layout.cellSize > best.layout.cellSize) best = { rings, layout };
  }
  return best!;
}

import { describe, expect, it } from 'vitest';
import {
  canPlace,
  createEmptyBoard,
  isFull,
  isInBounds,
  isOverlapping,
  placeCells,
  removeInstance,
} from '../../../src/domain/board';
import type { Cell } from '../../../src/domain/pentomino';

describe('board domain model', () => {
  it('creates an empty rows x cols grid', () => {
    const board = createEmptyBoard(5, 3);
    expect(board.rows).toBe(5);
    expect(board.cols).toBe(3);
    expect(board.cells).toHaveLength(5);
    expect(board.cells[0]).toHaveLength(3);
    expect(board.cells.flat().every((v) => v === null)).toBe(true);
  });

  it('rejects placements that fall outside the board', () => {
    const board = createEmptyBoard(5, 3);
    const outOfBounds: Cell[] = [
      [0, 0],
      [0, 3],
    ];
    expect(isInBounds(board, outOfBounds)).toBe(false);
    expect(canPlace(board, outOfBounds)).toBe(false);
  });

  it('rejects placements that overlap an already-placed piece', () => {
    let board = createEmptyBoard(5, 3);
    const first: Cell[] = [
      [0, 0],
      [0, 1],
    ];
    board = placeCells(board, 'piece-a', first);

    const overlapping: Cell[] = [
      [0, 1],
      [1, 1],
    ];
    expect(isOverlapping(board, overlapping)).toBe(true);
    expect(canPlace(board, overlapping)).toBe(false);
  });

  it('accepts a valid, non-overlapping, in-bounds placement', () => {
    const board = createEmptyBoard(5, 3);
    const cells: Cell[] = [
      [0, 0],
      [0, 1],
    ];
    expect(canPlace(board, cells)).toBe(true);
    const next = placeCells(board, 'piece-a', cells);
    expect(next.cells[0][0]).toBe('piece-a');
    expect(next.cells[0][1]).toBe('piece-a');
  });

  it('throws if placeCells is called with an invalid placement', () => {
    const board = createEmptyBoard(5, 3);
    expect(() => placeCells(board, 'x', [[10, 10]])).toThrow();
  });

  it('removeInstance clears exactly the cells belonging to that instance', () => {
    let board = createEmptyBoard(5, 3);
    board = placeCells(board, 'piece-a', [
      [0, 0],
      [0, 1],
    ]);
    board = placeCells(board, 'piece-b', [[1, 0]]);

    const cleared = removeInstance(board, 'piece-a');
    expect(cleared.cells[0][0]).toBeNull();
    expect(cleared.cells[0][1]).toBeNull();
    expect(cleared.cells[1][0]).toBe('piece-b');
  });

  it('isFull is false until every cell is occupied, true once it is', () => {
    let board = createEmptyBoard(1, 2);
    expect(isFull(board)).toBe(false);
    board = placeCells(board, 'a', [[0, 0]]);
    expect(isFull(board)).toBe(false);
    board = placeCells(board, 'b', [[0, 1]]);
    expect(isFull(board)).toBe(true);
  });
});

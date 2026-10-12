import { describe, it, expect, beforeEach } from 'vitest';
import { useManualAttemptStore } from '../../../src/state/manualAttempt';
import type { Challenge } from '../../../src/domain/types';

// Minimal, hand-built challenges (not from the generated dataset) so the store's
// mechanics can be tested in isolation.
// A single 'I' piece exactly fills a 5x1 board.
const challenge: Challenge = {
  id: 999,
  boardRows: 5,
  boardCols: 1,
  requiredPieces: ['I'],
  tier: 'bonus',
  line: '',
  difficulty: 1,
};

// Two 'I' pieces fill a 5x2 board side by side (not a real Katamino set, but
// the store doesn't care) — the simplest setup that can overlap.
const twoPieceChallenge: Challenge = { ...challenge, id: 998, boardCols: 2, requiredPieces: ['I', 'I'] };

const store = () => useManualAttemptStore.getState();

function placePiece(index: number, row: number, col: number): boolean {
  store().pickUp(store().pieces[index].instanceId);
  // I has 2 orientations (horizontal/vertical); try both to find the one that fits.
  for (let attempt = 0; attempt < 2; attempt++) {
    if (store().placeSelectedAt(row, col)) return true;
    store().rotateSelected();
  }
  return false;
}

describe('manual attempt store', () => {
  beforeEach(() => {
    store().loadChallenge(challenge);
  });

  it('initializes one unplaced piece instance per required piece', () => {
    const { pieces, isSolved } = store();
    expect(pieces).toHaveLength(1);
    expect(pieces[0].typeId).toBe('I');
    expect(pieces[0].position).toBeNull();
    expect(isSolved).toBe(false);
  });

  it('placing the only piece to fully fill the board marks the attempt solved', () => {
    expect(placePiece(0, 0, 0)).toBe(true);
    expect(store().pieces[0].position).toEqual({ row: 0, col: 0 });
    expect(store().isSolved).toBe(true);
  });

  it('rejects an out-of-bounds placement and keeps the piece in hand', () => {
    const { instanceId } = store().pieces[0];
    store().pickUp(instanceId);
    expect(store().placeSelectedAt(10, 10)).toBe(false);
    expect(store().pieces[0].position).toBeNull();
    expect(store().selectedInstanceId).toBe(instanceId);
    expect(store().isSolved).toBe(false);
  });

  it('picking a placed piece up takes it off the board and un-solves the attempt', () => {
    placePiece(0, 0, 0);
    const { instanceId } = store().pieces[0];
    store().pickUp(instanceId);
    expect(store().pieces[0].position).toBeNull();
    expect(store().selectedInstanceId).toBe(instanceId);
    expect(store().board.cells.flat().every((cell) => cell === null)).toBe(true);
    expect(store().isSolved).toBe(false);
  });

  it('reset clears every placement back to unplaced (FR-006)', () => {
    placePiece(0, 0, 0);
    store().reset();
    expect(store().pieces.every((p) => p.position === null)).toBe(true);
    expect(store().isSolved).toBe(false);
  });

  it('cancelHold puts a piece picked from its slot back without placing it', () => {
    const { instanceId } = store().pieces[0];
    store().pickUp(instanceId);
    expect(store().selectedInstanceId).toBe(instanceId);

    store().cancelHold();

    expect(store().selectedInstanceId).toBeNull();
    expect(store().pieces[0].position).toBeNull();
    expect(store().freePositions).toEqual({});
  });

  it('cancelHold returns a piece to the board cell and orientation it was lifted from', () => {
    placePiece(0, 0, 0);
    const placedOrientation = store().pieces[0].orientationIndex;
    store().pickUp(store().pieces[0].instanceId);
    store().rotateSelected();

    store().cancelHold();

    expect(store().pieces[0].position).toEqual({ row: 0, col: 0 });
    expect(store().pieces[0].orientationIndex).toBe(placedOrientation);
    expect(store().isSolved).toBe(true);
  });

  it('dropSelectedAt leaves the piece loose at a continuous position off the board', () => {
    const { instanceId } = store().pieces[0];
    store().pickUp(instanceId);
    store().dropSelectedAt(-3.25, 1.5);

    expect(store().selectedInstanceId).toBeNull();
    expect(store().pieces[0].position).toBeNull();
    expect(store().freePositions[instanceId]).toEqual({ x: -3.25, y: 1.5 });

    // Picking it up again clears the loose position.
    store().pickUp(instanceId);
    expect(store().freePositions[instanceId]).toBeUndefined();
  });

  describe('overlapping placements', () => {
    beforeEach(() => {
      store().loadChallenge(twoPieceChallenge);
    });

    it('allows a piece on top of another, flags the shared cells and is not solved', () => {
      expect(placePiece(0, 0, 0)).toBe(true);
      expect(placePiece(1, 0, 0)).toBe(true);

      const state = store();
      expect(state.pieces.every((p) => p.position !== null)).toBe(true);
      expect(state.conflictKeys).toEqual(['0,0', '1,0', '2,0', '3,0', '4,0']);
      // The piece placed last is the one shown on the shared cells.
      expect(state.board.cells[0][0]).toBe(state.pieces[1].instanceId);
      expect(state.isSolved).toBe(false);
    });

    it('moving the overlapping piece away clears the conflict and solves the board', () => {
      placePiece(0, 0, 0);
      placePiece(1, 0, 0);

      store().pickUp(store().pieces[1].instanceId);
      expect(store().conflictKeys).toEqual([]);
      expect(store().board.cells[0][0]).toBe(store().pieces[0].instanceId);

      expect(store().placeSelectedAt(0, 1)).toBe(true);
      expect(store().conflictKeys).toEqual([]);
      expect(store().isSolved).toBe(true);
    });
  });

  // Touch: a piece is turned where it lies, without being picked up.
  describe('turning a piece in place', () => {
    const wide: Challenge = { ...challenge, id: 997, boardCols: 5, requiredPieces: ['L', 'I'] };
    const dimsOf = (index: number) => {
      const { board, pieces } = store();
      const id = pieces[index].instanceId;
      const cells = board.cells.flatMap((row, r) => row.flatMap((cell, c) => (cell === id ? [[r, c]] : [])));
      return {
        rows: new Set(cells.map(([r]) => r)).size,
        cols: new Set(cells.map(([, c]) => c)).size,
        count: cells.length,
      };
    };

    beforeEach(() => {
      store().loadChallenge(wide);
    });

    it('turns an unplaced piece and makes it the one the controls act on', () => {
      const { instanceId, orientationIndex } = store().pieces[0];
      store().rotateInPlace(instanceId);

      expect(store().pieces[0].orientationIndex).not.toBe(orientationIndex);
      expect(store().pieces[0].position).toBeNull();
      expect(store().selectedInstanceId).toBeNull();
      expect(store().focusedInstanceId).toBe(instanceId);
    });

    it('turns a piece on the board, which stays on it, and four turns bring it back', () => {
      const id = store().pieces[0].instanceId;
      store().pickUp(id);
      expect(store().placeSelectedAt(1, 1)).toBe(true);
      const start = { ...store().pieces[0] };
      const before = dimsOf(0);

      store().rotateInPlace(id);
      expect(dimsOf(0)).toEqual({ rows: before.cols, cols: before.rows, count: 5 });

      for (let i = 0; i < 3; i++) store().rotateInPlace(id);
      expect(store().pieces[0].orientationIndex).toBe(start.orientationIndex);
      expect(store().pieces[0].position).toEqual(start.position);
    });

    it('keeps a turned piece inside the board at its edge', () => {
      const id = store().pieces[1].instanceId;
      store().pickUp(id);
      // I upright in the last column: lying down it has to slide back in.
      for (let attempt = 0; attempt < 2 && !store().placeSelectedAt(0, 4); attempt++) store().rotateSelected();
      expect(store().pieces[1].position).toEqual({ row: 0, col: 4 });

      store().rotateInPlace(id);
      expect(dimsOf(1)).toEqual({ rows: 1, cols: 5, count: 5 });
    });

    it('skips an orientation that cannot fit on the board', () => {
      store().loadChallenge(twoPieceChallenge);
      placePiece(0, 0, 0);
      const { instanceId, orientationIndex } = store().pieces[0];

      store().rotateInPlace(instanceId);
      expect(store().pieces[0].orientationIndex).toBe(orientationIndex);
      expect(store().pieces[0].position).toEqual({ row: 0, col: 0 });
    });

    it('mirrors a piece in place, flagging the overlap it may cause', () => {
      const [l, i] = store().pieces.map((p) => p.instanceId);
      store().pickUp(l);
      store().placeSelectedAt(0, 0);
      const before = store().pieces[0].orientationIndex;
      store().flipInPlace(l);
      expect(store().pieces[0].orientationIndex).not.toBe(before);
      expect(store().pieces[0].position).toEqual({ row: 0, col: 0 });

      store().pickUp(i);
      for (let attempt = 0; attempt < 2 && !store().placeSelectedAt(0, 4); attempt++) store().rotateSelected();
      expect(store().conflictKeys).toEqual([]);
      store().rotateInPlace(i);
      expect(store().conflictKeys.length).toBeGreaterThan(0);
      expect(store().isSolved).toBe(false);
    });

    it('leaves a piece that is in hand alone', () => {
      const { instanceId, orientationIndex } = store().pieces[0];
      store().pickUp(instanceId);
      store().rotateInPlace(instanceId);
      expect(store().pieces[0].orientationIndex).toBe(orientationIndex);
    });
  });
});

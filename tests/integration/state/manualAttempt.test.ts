import { describe, it, expect, beforeEach } from 'vitest';
import { useManualAttemptStore } from '../../../src/state/manualAttempt';
import type { Challenge } from '../../../src/domain/types';

// A minimal, hand-built challenge (not from the generated dataset) so the store's
// mechanics can be tested in isolation: a single 'I' piece exactly fills a 5x1 board.
const challenge: Challenge = {
  id: 999,
  boardRows: 5,
  boardCols: 1,
  requiredPieces: ['I'],
  tier: 'bonus',
  line: '',
  difficulty: 1,
};

function placeFirstPiece(row: number, col: number): boolean {
  const { pieces } = useManualAttemptStore.getState();
  useManualAttemptStore.getState().selectPiece(pieces[0].instanceId);
  // I has 2 orientations (horizontal/vertical); try both to find the one that fits.
  for (let attempt = 0; attempt < 2; attempt++) {
    if (useManualAttemptStore.getState().placeSelectedAt(row, col)) return true;
    useManualAttemptStore.getState().rotateSelected();
  }
  return false;
}

describe('manual attempt store', () => {
  beforeEach(() => {
    useManualAttemptStore.getState().loadChallenge(challenge);
  });

  it('initializes one unplaced piece instance per required piece', () => {
    const { pieces, isSolved } = useManualAttemptStore.getState();
    expect(pieces).toHaveLength(1);
    expect(pieces[0].typeId).toBe('I');
    expect(pieces[0].position).toBeNull();
    expect(isSolved).toBe(false);
  });

  it('placing the only piece to fully fill the board marks the attempt solved', () => {
    expect(placeFirstPiece(0, 0)).toBe(true);
    const state = useManualAttemptStore.getState();
    expect(state.pieces[0].position).toEqual({ row: 0, col: 0 });
    expect(state.isSolved).toBe(true);
  });

  it('rejects an out-of-bounds placement and leaves the piece unplaced', () => {
    const { pieces } = useManualAttemptStore.getState();
    useManualAttemptStore.getState().selectPiece(pieces[0].instanceId);
    const placed = useManualAttemptStore.getState().placeSelectedAt(10, 10);
    expect(placed).toBe(false);
    expect(useManualAttemptStore.getState().pieces[0].position).toBeNull();
    expect(useManualAttemptStore.getState().isSolved).toBe(false);
  });

  it('removePiece unplaces a placed piece and un-solves the attempt', () => {
    placeFirstPiece(0, 0);
    const instanceId = useManualAttemptStore.getState().pieces[0].instanceId;
    useManualAttemptStore.getState().removePiece(instanceId);
    const state = useManualAttemptStore.getState();
    expect(state.pieces[0].position).toBeNull();
    expect(state.isSolved).toBe(false);
  });

  it('reset clears every placement back to unplaced (FR-006)', () => {
    placeFirstPiece(0, 0);
    useManualAttemptStore.getState().reset();
    const state = useManualAttemptStore.getState();
    expect(state.pieces.every((p) => p.position === null)).toBe(true);
    expect(state.isSolved).toBe(false);
  });

  it('deselect puts the selected piece back down without placing it', () => {
    const { pieces } = useManualAttemptStore.getState();
    useManualAttemptStore.getState().selectPiece(pieces[0].instanceId);
    expect(useManualAttemptStore.getState().selectedInstanceId).toBe(pieces[0].instanceId);

    useManualAttemptStore.getState().deselect();

    const state = useManualAttemptStore.getState();
    expect(state.selectedInstanceId).toBeNull();
    expect(state.pieces[0].position).toBeNull();
  });
});

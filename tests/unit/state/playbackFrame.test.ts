import { describe, expect, it } from 'vitest';
import { applyStep, emptyFrame, undoStep, type PlaybackFrame } from '../../../src/state/playbackFrame';
import { solve } from '../../../src/solvers/configurableSolver';
import { isFull } from '../../../src/domain/board';
import type { Challenge, SolveStep } from '../../../src/domain/types';

const challenge: Challenge = {
  id: 1,
  boardRows: 5,
  boardCols: 3,
  requiredPieces: ['P', 'U', 'Y'],
  tier: 'small-slam',
  line: 'A',
  difficulty: 3,
};

function stepsOf(c: Challenge): SolveStep[] {
  const steps: SolveStep[] = [];
  const gen = solve(c, ['dead-regions']);
  let result = gen.next();
  while (!result.done) {
    steps.push(result.value);
    result = gen.next();
  }
  return steps;
}

describe('playback frame', () => {
  const steps = stepsOf(challenge);
  const start = emptyFrame(challenge.boardRows, challenge.boardCols);

  it('stepping forward through a whole run ends on the solved board with the run totals', () => {
    const end = steps.reduce(applyStep, start);
    expect(isFull(end.board)).toBe(true);
    expect(end.pieces.map((p) => p.typeId).sort()).toEqual(['P', 'U', 'Y']);
    expect(end.backtracks).toBe(steps.filter((s) => s.kind === 'remove').length);
    expect(end.prunes['dead-regions'] ?? 0).toBe(steps.filter((s) => s.prunedBy === 'dead-regions').length);
  });

  it('undoStep is the exact inverse of applyStep at every point of the run', () => {
    const frames: PlaybackFrame[] = [start];
    for (const step of steps) frames.push(applyStep(frames[frames.length - 1], step));

    let frame = frames[frames.length - 1];
    for (let i = steps.length - 1; i >= 0; i--) {
      frame = undoStep(frame, steps[i]);
      expect(frame.board).toEqual(frames[i].board);
      expect(frame.pieces.map((p) => p.instanceId).sort()).toEqual(frames[i].pieces.map((p) => p.instanceId).sort());
      expect(frame.backtracks).toBe(frames[i].backtracks);
      expect(frame.prunes['dead-regions'] ?? 0).toBe(frames[i].prunes['dead-regions'] ?? 0);
    }
    expect(frame.pieces).toEqual([]);
  });
});

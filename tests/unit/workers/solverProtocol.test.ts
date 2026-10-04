import { describe, expect, it } from 'vitest';
import { runSolve } from '../../../src/workers/solverEngine';
import type { Challenge } from '../../../src/domain/types';

const challenge: Challenge = {
  id: 1,
  boardRows: 5,
  boardCols: 3,
  requiredPieces: ['P', 'U', 'Y'],
  difficulty: 3,
};

function collect(challenge: Challenge, strategyId: 'backtracking' | 'constraint-guided') {
  return [
    ...runSolve({ type: 'solve', requestId: 'req-1', challenge, strategyId }),
  ];
}

describe('solver worker protocol (solverEngine.runSolve)', () => {
  it('starts with a "started" event carrying the request id', () => {
    const events = collect(challenge, 'backtracking');
    expect(events[0]).toEqual({ type: 'started', requestId: 'req-1' });
  });

  it('emits "step" events in strictly increasing index order', () => {
    const events = collect(challenge, 'backtracking');
    const steps = events.filter((e) => e.type === 'step').map((e) => (e as { step: { index: number } }).step.index);
    steps.forEach((index, i) => expect(index).toBe(i));
  });

  it('ends with exactly one "done" event whose totalSteps matches the number of step events', () => {
    const events = collect(challenge, 'backtracking');
    const doneEvents = events.filter((e) => e.type === 'done');
    expect(doneEvents).toHaveLength(1);
    const stepCount = events.filter((e) => e.type === 'step').length;
    expect((doneEvents[0] as { totalSteps: number }).totalSteps).toBe(stepCount);
    expect(events[events.length - 1].type).toBe('done');
  });

  it('is deterministic across runs for the same request', () => {
    expect(collect(challenge, 'backtracking')).toEqual(collect(challenge, 'backtracking'));
  });

  it('also runs the constraint-guided strategy end to end (started -> steps -> done)', () => {
    const events = collect(challenge, 'constraint-guided');
    expect(events[0]).toEqual({ type: 'started', requestId: 'req-1' });
    expect(events[events.length - 1].type).toBe('done');
    expect(events.some((e) => e.type === 'step')).toBe(true);
  });

  it('yields an "error" event for an unknown strategy id', () => {
    const events = [
      ...runSolve({
        type: 'solve',
        requestId: 'req-1',
        challenge,
        strategyId: 'not-a-real-strategy' as unknown as 'backtracking',
      }),
    ];
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('error');
  });
});

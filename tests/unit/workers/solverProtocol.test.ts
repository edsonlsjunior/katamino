import { describe, expect, it } from 'vitest';
import { runSolve } from '../../../src/workers/solverEngine';
import type { CriterionId } from '../../../src/solvers/criteria';
import type { Challenge } from '../../../src/domain/types';

const challenge: Challenge = {
  id: 1,
  boardRows: 5,
  boardCols: 3,
  requiredPieces: ['P', 'U', 'Y'],
  tier: 'small-slam',
  line: 'A',
  difficulty: 3,
};

function collect(c: Challenge, criteria: CriterionId[], maxSteps?: number) {
  return [...runSolve({ type: 'solve', requestId: 'req-1', challenge: c, criteria, maxSteps })];
}

describe('solver worker protocol (solverEngine.runSolve)', () => {
  it('starts with a "started" event carrying the request id', () => {
    const events = collect(challenge, []);
    expect(events[0]).toEqual({ type: 'started', requestId: 'req-1' });
  });

  it('emits "step" events in strictly increasing index order', () => {
    const events = collect(challenge, []);
    const steps = events.filter((e) => e.type === 'step').map((e) => (e as { step: { index: number } }).step.index);
    steps.forEach((index, i) => expect(index).toBe(i));
  });

  it('ends with exactly one "done" event whose totalSteps matches the number of step events', () => {
    const events = collect(challenge, []);
    const doneEvents = events.filter((e) => e.type === 'done');
    expect(doneEvents).toHaveLength(1);
    const stepCount = events.filter((e) => e.type === 'step').length;
    expect(doneEvents[0]).toMatchObject({ totalSteps: stepCount, outcome: 'solved' });
    expect(events[events.length - 1].type).toBe('done');
  });

  it('is deterministic across runs for the same request', () => {
    expect(collect(challenge, ['dead-regions'])).toEqual(collect(challenge, ['dead-regions']));
  });

  it('runs with criteria end to end (started -> steps -> done) and reports their cut counts', () => {
    const events = collect(challenge, ['most-constrained-cell', 'dead-regions']);
    expect(events[0]).toEqual({ type: 'started', requestId: 'req-1' });
    expect(events.some((e) => e.type === 'step')).toBe(true);
    const done = events[events.length - 1];
    expect(done.type).toBe('done');
    expect((done as { pruneCounts: object }).pruneCounts).toHaveProperty('dead-regions');
  });

  it('reports a step limit as a "done" with outcome "limit", not as an error', () => {
    const events = collect(challenge, [], 2);
    const done = events[events.length - 1];
    expect(done).toMatchObject({ type: 'done', outcome: 'limit', solvedAtStepIndex: -1 });
  });

  it('yields an "error" event for an unknown criterion', () => {
    const events = collect(challenge, ['not-a-real-criterion' as unknown as CriterionId]);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('error');
  });
});

import { beforeEach, describe, expect, it } from 'vitest';
import {
  consumeFirstVisit,
  exportProgress,
  importProgress,
  markChallengeCompleted,
  readProgress,
  readTheme,
  writeTheme,
} from '../../../src/state/persistence';

const isKnown = (id: number) => id >= 1 && id <= 500;

describe('progress export and import', () => {
  beforeEach(() => window.localStorage.clear());

  it('exports the completed challenges as sorted ids', () => {
    markChallengeCompleted(12);
    markChallengeCompleted(3);

    const exported = JSON.parse(exportProgress(new Date('2026-01-02T03:04:05Z')));
    expect(exported).toEqual({
      app: 'katamino',
      version: 1,
      exportedAt: '2026-01-02T03:04:05.000Z',
      completed: [3, 12],
    });
  });

  it('imports by merging: keeps what was done, adds what is new, ignores unknown ids', () => {
    markChallengeCompleted(3);

    const added = importProgress(JSON.stringify({ completed: [3, 4, 5, 9999] }), isKnown);

    expect(added).toBe(2);
    expect(Object.keys(readProgress().completed).map(Number).sort((a, b) => a - b)).toEqual([3, 4, 5]);
  });

  it('round-trips its own export, and accepts the raw stored shape too', () => {
    markChallengeCompleted(8);
    const file = exportProgress();
    window.localStorage.clear();

    expect(importProgress(file, isKnown)).toBe(1);
    expect(importProgress(JSON.stringify({ version: 1, completed: { 20: true } }), isKnown)).toBe(1);
    expect(readProgress().completed).toEqual({ 8: true, 20: true });
  });

  it('rejects anything that is not a progress file, leaving progress untouched', () => {
    markChallengeCompleted(3);

    for (const text of ['not json', '{}', '{"completed": "all"}', '{"completed": [1, "two"]}', 'null']) {
      expect(() => importProgress(text, isKnown)).toThrow();
    }
    expect(readProgress().completed).toEqual({ 3: true });
  });
});

describe('preferences', () => {
  beforeEach(() => window.localStorage.clear());

  it('the theme defaults to following the system and remembers a choice', () => {
    expect(readTheme()).toBe('system');
    writeTheme('dark');
    expect(readTheme()).toBe('dark');
    window.localStorage.setItem('katamino:v1:theme', 'sepia');
    expect(readTheme()).toBe('system');
  });

  it('the first visit is reported exactly once', () => {
    expect(consumeFirstVisit()).toBe(true);
    expect(consumeFirstVisit()).toBe(false);
  });
});

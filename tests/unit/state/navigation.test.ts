import { describe, expect, it } from 'vitest';
import { formatRoute, parseRoute, type Route } from '../../../src/state/navigation';

const ROOT: Route = { screen: 'challenges', challengeId: null, solverOpen: false };

describe('navigation routes', () => {
  it('treats an empty hash and "#/" as the challenge list', () => {
    expect(parseRoute('')).toEqual(ROOT);
    expect(parseRoute('#/')).toEqual(ROOT);
  });

  it('parses the challenge, solver and about routes', () => {
    expect(parseRoute('#/challenge/12')).toEqual({
      screen: 'manual',
      challengeId: 12,
      solverOpen: false,
    });
    expect(parseRoute('#/challenge/12/solver')).toEqual({
      screen: 'manual',
      challengeId: 12,
      solverOpen: true,
    });
    expect(parseRoute('#/about')).toEqual({ screen: 'about', challengeId: null, solverOpen: false });
    expect(parseRoute('#/learn')).toEqual({ screen: 'learn', challengeId: null, solverOpen: false });
  });

  it('falls back to the list for anything it does not recognise', () => {
    expect(parseRoute('#/challenge/0')).toEqual(ROOT);
    expect(parseRoute('#/challenge/9999')).toEqual(ROOT);
    expect(parseRoute('#/challenge/abc')).toEqual(ROOT);
    expect(parseRoute('#/nowhere')).toEqual(ROOT);
  });

  it('formats every route back to the hash it was parsed from', () => {
    for (const hash of ['#/', '#/challenge/12', '#/challenge/12/solver', '#/learn', '#/about']) {
      expect(formatRoute(parseRoute(hash))).toBe(hash);
    }
  });
});

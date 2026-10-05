import { describe, expect, it } from 'vitest';
import { CHALLENGE_TIER_ORDER, loadChallenges, loadChallengesByTier } from '../../../src/data/loadChallenges';

describe('loadChallengesByTier', () => {
  it('partitions every challenge into exactly one tier, covering all 500', () => {
    const byTier = loadChallengesByTier();
    const total = CHALLENGE_TIER_ORDER.reduce((sum, tier) => sum + (byTier.get(tier)?.length ?? 0), 0);
    expect(total).toBe(500);
    expect(total).toBe(loadChallenges().length);
  });

  it('keeps every challenge under the tier its own `tier` field names', () => {
    const byTier = loadChallengesByTier();
    for (const tier of CHALLENGE_TIER_ORDER) {
      for (const challenge of byTier.get(tier) ?? []) {
        expect(challenge.tier).toBe(tier);
      }
    }
  });

  it('matches the documented per-tier counts', () => {
    const byTier = loadChallengesByTier();
    expect(byTier.get('small-slam')).toHaveLength(42);
    expect(byTier.get('slam')).toHaveLength(118);
    expect(byTier.get('grand-slam')).toHaveLength(96);
    expect(byTier.get('super-slam')).toHaveLength(96);
    expect(byTier.get('challenge')).toHaveLength(100);
    expect(byTier.get('bonus')).toHaveLength(48);
  });

  it('returns the same cached map instance on repeated calls', () => {
    expect(loadChallengesByTier()).toBe(loadChallengesByTier());
  });
});

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CHALLENGE_TIER_ORDER, loadChallengesByTier } from '../data/loadChallenges';
import { isChallengeCompleted } from '../state/persistence';
import type { Challenge, ChallengeTier } from '../domain/types';
import './ChallengeList.css';

interface ChallengeListProps {
  onPlay: (challengeId: number) => void;
  onWatchSolver?: (challengeId: number) => void;
}

const PAGE_SIZE = 24;

const TIER_LABEL_KEYS: Record<ChallengeTier, string> = {
  'small-slam': 'challenges.tier.smallSlam',
  slam: 'challenges.tier.slam',
  'grand-slam': 'challenges.tier.grandSlam',
  'super-slam': 'challenges.tier.superSlam',
  challenge: 'challenges.tier.challenge',
  bonus: 'challenges.tier.bonus',
};

interface TierSectionProps {
  tier: ChallengeTier;
  challenges: readonly Challenge[];
  onPlay: (challengeId: number) => void;
  onWatchSolver?: (challengeId: number) => void;
}

function TierSection({ tier, challenges, onPlay, onWatchSolver }: TierSectionProps) {
  const { t } = useTranslation();
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(challenges.length / PAGE_SIZE));
  const pageItems = challenges.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <section className="challenge-group">
      <h2>{t(TIER_LABEL_KEYS[tier])}</h2>
      <div className="challenge-grid">
        {pageItems.map((challenge) => {
          const completed = isChallengeCompleted(challenge.id);
          return (
            <div
              key={challenge.id}
              data-testid={`challenge-card-${challenge.id}`}
              data-completed={completed}
              className={`challenge-card${completed ? ' challenge-card--completed' : ''}`}
            >
              <span className="challenge-card__id">
                {t('challenges.cardLabel', {
                  line: challenge.line,
                  boardCols: challenge.boardCols,
                  id: challenge.id,
                })}
              </span>
              {completed && <span aria-label={t('challenges.completed', 'Completed')}>✓</span>}
              <div className="challenge-card__actions">
                <button type="button" onClick={() => onPlay(challenge.id)}>
                  {t('nav.manualPlay')}
                </button>
                {onWatchSolver && (
                  <button type="button" onClick={() => onWatchSolver(challenge.id)}>
                    {t('nav.autoSolve')}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {totalPages > 1 && (
        <div className="challenge-pagination">
          <button
            type="button"
            data-testid={`challenge-tier-${tier}-prev`}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
          >
            {t('challenges.pagination.prev', 'Previous')}
          </button>
          <span data-testid={`challenge-tier-${tier}-page-indicator`}>
            {t('challenges.pagination.pageIndicator', { current: page + 1, total: totalPages })}
          </span>
          <button
            type="button"
            data-testid={`challenge-tier-${tier}-next`}
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
          >
            {t('challenges.pagination.next', 'Next')}
          </button>
        </div>
      )}
    </section>
  );
}

// The screen this list lives on is always freshly mounted on navigation (App.tsx
// switches screens, unmounting/remounting), so reading localStorage directly on
// render — no extra subscription — already reflects the latest completion state.
export function ChallengeList({ onPlay, onWatchSolver }: ChallengeListProps) {
  const byTier = useMemo(() => loadChallengesByTier(), []);

  return (
    <div className="challenge-list">
      {CHALLENGE_TIER_ORDER.map((tier) => {
        const challenges = byTier.get(tier) ?? [];
        if (challenges.length === 0) return null;
        return (
          <TierSection
            key={tier}
            tier={tier}
            challenges={challenges}
            onPlay={onPlay}
            onWatchSolver={onWatchSolver}
          />
        );
      })}
    </div>
  );
}

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { loadChallenges } from '../data/loadChallenges';
import { isChallengeCompleted } from '../state/persistence';
import type { Challenge } from '../domain/types';
import './ChallengeList.css';

interface ChallengeListProps {
  onPlay: (challengeId: number) => void;
  onWatchSolver?: (challengeId: number) => void;
}

function groupByDifficulty(challenges: readonly Challenge[]): Map<number, Challenge[]> {
  const groups = new Map<number, Challenge[]>();
  for (const challenge of challenges) {
    const group = groups.get(challenge.difficulty) ?? [];
    group.push(challenge);
    groups.set(challenge.difficulty, group);
  }
  return new Map([...groups.entries()].sort((a, b) => a[0] - b[0]));
}

// The screen this list lives on is always freshly mounted on navigation (App.tsx
// switches screens, unmounting/remounting), so reading localStorage directly on
// render — no extra subscription — already reflects the latest completion state.
export function ChallengeList({ onPlay, onWatchSolver }: ChallengeListProps) {
  const { t } = useTranslation();
  const challenges = useMemo(() => loadChallenges(), []);
  const groups = useMemo(() => groupByDifficulty(challenges), [challenges]);

  return (
    <div className="challenge-list">
      {[...groups.entries()].map(([difficulty, group]) => (
        <section key={difficulty} className="challenge-group">
          <h2>{t('challenges.difficulty', { difficulty, defaultValue: `Difficulty ${difficulty}` })}</h2>
          <div className="challenge-grid">
            {group.map((challenge) => {
              const completed = isChallengeCompleted(challenge.id);
              return (
                <div
                  key={challenge.id}
                  data-testid={`challenge-card-${challenge.id}`}
                  data-completed={completed}
                  className={`challenge-card${completed ? ' challenge-card--completed' : ''}`}
                >
                  <span className="challenge-card__id">#{challenge.id}</span>
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
        </section>
      ))}
    </div>
  );
}

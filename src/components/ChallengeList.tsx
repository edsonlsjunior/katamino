import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { CHALLENGE_TIER_ORDER, loadChallenges, loadChallengesByTier } from '../data/loadChallenges';
import { readProgress } from '../state/persistence';
import type { Challenge, ChallengeTier } from '../domain/types';
import './ChallengeList.css';

interface ChallengeListProps {
  onPlay: (challengeId: number) => void;
}

const TIER_LABEL_KEYS: Record<ChallengeTier, string> = {
  'small-slam': 'challenges.tier.smallSlam',
  slam: 'challenges.tier.slam',
  'grand-slam': 'challenges.tier.grandSlam',
  'super-slam': 'challenges.tier.superSlam',
  challenge: 'challenges.tier.challenge',
  bonus: 'challenges.tier.bonus',
};

interface LineGroup {
  /** The booklet's line label (a letter, a suit, "N°3"…); empty for the bonus tier. */
  line: string;
  challenges: Challenge[];
}

/** Splits a tier into its booklet lines, keeping the dataset's order. */
function groupByLine(challenges: readonly Challenge[]): LineGroup[] {
  const groups: LineGroup[] = [];
  for (const challenge of challenges) {
    const last = groups[groups.length - 1];
    if (last && last.line === challenge.line) last.challenges.push(challenge);
    else groups.push({ line: challenge.line, challenges: [challenge] });
  }
  return groups;
}

function percent(done: number, total: number): number {
  return total === 0 ? 0 : Math.round((done / total) * 100);
}

interface ProgressBarProps {
  done: number;
  total: number;
  label: string;
}

function ProgressBar({ done, total, label }: ProgressBarProps) {
  return (
    <div
      className="progress-bar"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={done}
    >
      <div className="progress-bar__fill" style={{ width: `${percent(done, total)}%` }} />
    </div>
  );
}

interface TierColumnProps {
  tier: ChallengeTier;
  challenges: readonly Challenge[];
  completed: Record<number, boolean>;
  onPlay: (challengeId: number) => void;
}

function TierColumn({ tier, challenges, completed, onPlay }: TierColumnProps) {
  const { t } = useTranslation();
  const groups = useMemo(() => groupByLine(challenges), [challenges]);
  const name = t(TIER_LABEL_KEYS[tier]);
  const done = challenges.filter((c) => completed[c.id] === true).length;

  return (
    <section
      className="tier-column"
      data-testid={`challenge-tier-${tier}`}
      data-tier={tier}
      aria-label={name}
    >
      <header className="tier-column__header">
        <div className="tier-column__heading">
          <h2>{name}</h2>
          <span className="tier-column__count" data-testid={`challenge-tier-${tier}-count`}>
            {done}/{challenges.length}
          </span>
        </div>
        <ProgressBar
          done={done}
          total={challenges.length}
          label={t('challenges.progress.tier', { tier: name })}
        />
      </header>
      <ul className="tier-column__lines">
        {groups.map((group) => {
          const lineDone = group.challenges.every((c) => completed[c.id] === true);
          return (
            <li
              key={group.line}
              className={`challenge-line${lineDone ? ' challenge-line--completed' : ''}`}
            >
              {group.line !== '' && <span className="challenge-line__label">{group.line}</span>}
              <ul className="challenge-line__chips">
                {group.challenges.map((challenge, index) => {
                  const isDone = completed[challenge.id] === true;
                  // A line is one set of pieces played on growing boards, so the
                  // board size tells its challenges apart; the bonus tier has
                  // no lines and a single board size, so those are numbered.
                  const chipText = group.line === '' ? index + 1 : challenge.boardCols;
                  const title = [group.line, `PENTA ${challenge.boardCols}`, `#${challenge.id}`]
                    .filter(Boolean)
                    .join(' · ');
                  return (
                    <li
                      key={challenge.id}
                      data-testid={`challenge-card-${challenge.id}`}
                      data-completed={isDone}
                    >
                      <button
                        type="button"
                        className={`challenge-chip${isDone ? ' challenge-chip--completed' : ''}`}
                        title={title}
                        aria-label={
                          isDone
                            ? t('challenges.playCompleted', { challenge: title })
                            : t('challenges.play', { challenge: title })
                        }
                        onClick={() => onPlay(challenge.id)}
                      >
                        {chipText}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// The screen this list lives on is always freshly mounted on navigation (App.tsx
// switches screens, unmounting/remounting), so reading localStorage directly on
// render — no extra subscription — already reflects the latest completion state.
export function ChallengeList({ onPlay }: ChallengeListProps) {
  const { t } = useTranslation();
  const byTier = useMemo(() => loadChallengesByTier(), []);
  const all = useMemo(() => loadChallenges(), []);
  const completed = readProgress().completed;
  const done = all.filter((c) => completed[c.id] === true).length;
  const nextUp = all.find((c) => completed[c.id] !== true);

  return (
    <div className="challenge-list">
      <div className="challenge-summary">
        <div className="challenge-summary__progress">
          <p className="challenge-summary__count" data-testid="challenge-progress-total">
            {t('challenges.progress.summary', {
              done,
              total: all.length,
              percent: percent(done, all.length),
            })}
          </p>
          <ProgressBar done={done} total={all.length} label={t('challenges.progress.overall')} />
        </div>
        {nextUp && (
          <button
            type="button"
            className="btn-primary"
            data-testid="challenge-continue"
            onClick={() => onPlay(nextUp.id)}
          >
            {t(done === 0 ? 'challenges.start' : 'challenges.continue')}
          </button>
        )}
      </div>
      <p className="challenge-list__hint">{t('challenges.hint')}</p>
      <div className="challenge-board">
        {CHALLENGE_TIER_ORDER.map((tier) => {
          const challenges = byTier.get(tier) ?? [];
          if (challenges.length === 0) return null;
          return (
            <TierColumn
              key={tier}
              tier={tier}
              challenges={challenges}
              completed={completed}
              onPlay={onPlay}
            />
          );
        })}
      </div>
    </div>
  );
}

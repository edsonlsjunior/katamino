import { useTranslation } from 'react-i18next';
import type { PlaybackStatus, SolveOutcome } from '../domain/types';
import './SolverStatus.css';

interface SolverStatusProps {
  status: PlaybackStatus;
  outcome: SolveOutcome | null;
  errorMessage: string | null;
  totalSteps: number;
  /** Whether the run started from the player's own pieces. */
  fromAttempt?: boolean;
}

export function SolverStatus({ status, outcome, errorMessage, totalSteps, fromAttempt }: SolverStatusProps) {
  const { t, i18n } = useTranslation();

  if (status === 'computing') {
    return (
      <p data-testid="solver-computing" role="status">
        {t('solver.computing', 'Working it out…')}
      </p>
    );
  }
  if (status === 'error') {
    return (
      <p data-testid="solver-error" role="alert">
        {t('solver.error', 'The solver ran into a problem: {{message}}', { message: errorMessage ?? '' })}
      </p>
    );
  }
  if (status === 'complete') {
    if (outcome === 'limit') {
      return (
        <p data-testid="solver-limit" role="status">
          {t('solver.limit', { steps: new Intl.NumberFormat(i18n.language).format(totalSteps) })}
        </p>
      );
    }
    if (outcome === 'exhausted') {
      return (
        <p data-testid="solver-exhausted" role="status">
          {t(fromAttempt ? 'solver.exhaustedFromAttempt' : 'solver.exhausted')}
        </p>
      );
    }
    return (
      <p data-testid="solver-complete" role="status">
        {t('solver.complete', 'Solved! Every piece fits.')}
      </p>
    );
  }
  return null;
}

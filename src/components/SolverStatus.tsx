import { useTranslation } from 'react-i18next';
import type { PlaybackStatus } from '../domain/types';
import './SolverStatus.css';

interface SolverStatusProps {
  status: PlaybackStatus;
  errorMessage: string | null;
}

export function SolverStatus({ status, errorMessage }: SolverStatusProps) {
  const { t } = useTranslation();

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
    return (
      <p data-testid="solver-complete" role="status">
        {t('solver.complete', 'Solved! Every piece fits.')}
      </p>
    );
  }
  return null;
}

import { useTranslation } from 'react-i18next';
import type { SolvingStrategyId } from '../domain/types';

interface MetricsPanelProps {
  strategyId: SolvingStrategyId;
  currentStepIndex: number;
  totalSteps: number;
  backtrackCountSoFar: number;
}

export function MetricsPanel({
  strategyId,
  currentStepIndex,
  totalSteps,
  backtrackCountSoFar,
}: MetricsPanelProps) {
  const { t } = useTranslation();
  const nameKey = strategyId === 'backtracking' ? 'strategy.backtracking.name' : 'strategy.constraintGuided.name';
  const descriptionKey =
    strategyId === 'backtracking' ? 'strategy.backtracking.description' : 'strategy.constraintGuided.description';

  return (
    <div className="metrics-panel" data-testid="metrics-panel">
      <p>
        <strong>{t(nameKey)}</strong> — {t(descriptionKey)}
      </p>
      <dl>
        <dt>{t('metrics.step', 'Step')}</dt>
        <dd data-testid="metrics-step">
          {Math.max(currentStepIndex + 1, 0)} / {totalSteps || '…'}
        </dd>
        <dt>{t('metrics.backtracks', 'Backtracks so far')}</dt>
        <dd data-testid="metrics-backtracks">{backtrackCountSoFar}</dd>
      </dl>
    </div>
  );
}

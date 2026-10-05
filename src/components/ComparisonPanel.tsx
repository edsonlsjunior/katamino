import { useTranslation } from 'react-i18next';
import type { RunSummary } from '../state/playback';
import './ComparisonPanel.css';

interface ComparisonPanelProps {
  runs: readonly RunSummary[];
}

/** Shows the two most recent completed runs side by side (User Story 3, SC-003). */
export function ComparisonPanel({ runs }: ComparisonPanelProps) {
  const { t } = useTranslation();
  const lastTwo = runs.slice(0, 2);
  if (lastTwo.length < 2) return null;

  return (
    <table className="comparison-panel" data-testid="comparison-panel">
      <caption>{t('comparison.title', 'Compare the last two runs')}</caption>
      <thead>
        <tr>
          <th scope="col">{t('comparison.strategy', 'Strategy')}</th>
          <th scope="col">{t('metrics.step', 'Step')}</th>
          <th scope="col">{t('metrics.backtracks', 'Backtracks so far')}</th>
        </tr>
      </thead>
      <tbody>
        {lastTwo.map((run, i) => (
          <tr key={i}>
            <td>
              {t(
                run.strategyId === 'backtracking' ? 'strategy.backtracking.name' : 'strategy.constraintGuided.name',
              )}
            </td>
            <td>{run.totalSteps}</td>
            <td>{run.backtrackCount}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

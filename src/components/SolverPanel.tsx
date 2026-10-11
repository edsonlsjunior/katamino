import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Challenge, PlaybackStatus, SolveOutcome } from '../domain/types';
import { countArrangements } from '../solvers/configurableSolver';
import { CRITERIA, type CriterionId } from '../solvers/criteria';
import type { RunSummary } from '../state/playback';
import { CriteriaList } from './CriteriaList';
import { SolverStatus } from './SolverStatus';
import './SolverPanel.css';

interface SolverPanelProps {
  challenge: Challenge;
  selectedCriteria: ReadonlySet<CriterionId>;
  onToggleCriterion: (id: CriterionId) => void;
  onStart: () => void;
  onClose: () => void;
  status: PlaybackStatus;
  /** Whether the solver is still searching (the total isn't known yet). */
  isSolving: boolean;
  outcome: SolveOutcome | null;
  errorMessage: string | null;
  /** Steps played back so far / steps the solver has produced so far. */
  stepsShown: number;
  stepsKnown: number;
  backtracksSoFar: number;
  prunesSoFar: Partial<Record<CriterionId, number>>;
  /** Finished runs of this challenge, most recent first. */
  runs: readonly RunSummary[];
}

const SUPERSCRIPT_DIGITS = '⁰¹²³⁴⁵⁶⁷⁸⁹';

/** Exact below a million; beyond that "4.1 × 10²⁵", which is as much as anyone can picture. */
function formatHuge(value: bigint, locale: string): string {
  const digits = value.toString();
  if (digits.length <= 6) return new Intl.NumberFormat(locale).format(Number(value));
  const mantissa = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(
    Number(`${digits[0]}.${digits.slice(1, 3)}`),
  );
  const exponent = [...String(digits.length - 1)]
    .map((d) => SUPERSCRIPT_DIGITS[Number(d)])
    .join('');
  return `≈ ${mantissa} × 10${exponent}`;
}

export function SolverPanel({
  challenge,
  selectedCriteria,
  onToggleCriterion,
  onStart,
  onClose,
  status,
  isSolving,
  outcome,
  errorMessage,
  stepsShown,
  stepsKnown,
  backtracksSoFar,
  prunesSoFar,
  runs,
}: SolverPanelProps) {
  const { t, i18n } = useTranslation();
  const count = new Intl.NumberFormat(i18n.language);
  const arrangements = useMemo(() => countArrangements(challenge), [challenge]);
  const hasRun = status !== 'idle';
  // On narrow screens the panel is a drawer under the board: collapsed, only
  // its header and the run status stay visible (see SolverPanel.css). Wide
  // screens ignore this and always show everything.
  const [collapsed, setCollapsed] = useState(false);

  function handleStart() {
    // Get out of the way so the playback can be watched.
    setCollapsed(true);
    onStart();
  }

  function describeCriteria(ids: readonly CriterionId[]) {
    const names = CRITERIA.filter((c) => ids.includes(c.id)).map((c) => t(`${c.i18nKey}.name`));
    return names.length > 0 ? names.join(' + ') : t('solver.baseOnly');
  }

  return (
    <aside
      className={`solver-panel${collapsed ? ' solver-panel--collapsed' : ''}`}
      data-testid="solver-panel"
      aria-label={t('solver.title')}
    >
      <header className="solver-panel__header">
        <h2>{t('solver.title')}</h2>
        <button
          type="button"
          className="solver-panel__toggle"
          data-testid="solver-panel-toggle"
          aria-expanded={!collapsed}
          onClick={() => setCollapsed((value) => !value)}
        >
          {t(collapsed ? 'solver.showSettings' : 'solver.hideSettings')}
        </button>
        <button type="button" onClick={onClose} aria-label={t('solver.close')}>
          ✕
        </button>
      </header>

      <div className="solver-panel__scroll">
        <section className="solver-panel__space">
          <p className="solver-panel__space-label">{t('solver.arrangements.label')}</p>
          <p
            className="solver-panel__space-value"
            data-testid="arrangements"
            title={count.format(arrangements)}
          >
            {formatHuge(arrangements, i18n.language)}
          </p>
          <p className="solver-panel__hint">
            {t('solver.arrangements.hint', { count: challenge.requiredPieces.length })}
          </p>
        </section>

        <CriteriaList
          selected={selectedCriteria}
          onToggle={onToggleCriterion}
          cuts={hasRun ? prunesSoFar : undefined}
        />

        {runs.length > 0 && (
          <table className="solver-panel__runs" data-testid="comparison-panel">
            <caption>{t('comparison.title')}</caption>
            <thead>
              <tr>
                <th scope="col">{t('comparison.strategy')}</th>
                <th scope="col">{t('comparison.steps')}</th>
                <th scope="col">{t('comparison.backtracks')}</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run, i) => (
                <tr key={i} data-outcome={run.outcome}>
                  <td>{describeCriteria(run.criteria)}</td>
                  <td>
                    {run.outcome === 'solved' ? '' : '> '}
                    {count.format(run.totalSteps)}
                  </td>
                  <td>{count.format(run.backtrackCount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <footer className="solver-panel__footer">
        {hasRun && (
          <section className="solver-panel__metrics" data-testid="metrics-panel">
            <dl>
              <dt>{t('metrics.step')}</dt>
              <dd data-testid="metrics-step">
                {count.format(stepsShown)} /{' '}
                {isSolving ? `${count.format(stepsKnown)}…` : count.format(stepsKnown)}
              </dd>
              <dt>{t('metrics.backtracks')}</dt>
              <dd data-testid="metrics-backtracks">{count.format(backtracksSoFar)}</dd>
            </dl>
            <SolverStatus
              status={status}
              outcome={outcome}
              errorMessage={errorMessage}
              totalSteps={stepsKnown}
            />
          </section>
        )}
        <button type="button" className="btn-primary" onClick={handleStart} data-testid="start-solve">
          {t(hasRun ? 'solver.restart' : 'solver.start')}
        </button>
      </footer>
    </aside>
  );
}

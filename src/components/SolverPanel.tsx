import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Challenge, PieceTypeId, PlaybackStatus, SolveOutcome } from '../domain/types';
import { countArrangements } from '../solvers/configurableSolver';
import { CRITERIA, type CriterionId } from '../solvers/criteria';
import type { RunSummary, StartFrom } from '../state/playback';
import { CriteriaList } from './CriteriaList';
import { SolverStatus } from './SolverStatus';
import './SolverPanel.css';

interface SolverPanelProps {
  challenge: Challenge;
  selectedCriteria: ReadonlySet<CriterionId>;
  onToggleCriterion: (id: CriterionId) => void;
  onStart: () => void;
  onClose: () => void;
  /** Draw attention to the close button (the player tried to use the locked board). */
  highlightClose?: boolean;
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
  /** Where the next run begins, as chosen by the player. */
  startFrom: StartFrom;
  onStartFromChange: (startFrom: StartFrom) => void;
  /** How many pieces the player has on the board. */
  attemptPieces: number;
  /** Whether some of those overlap (a run can't start from that). */
  attemptOverlaps: boolean;
  /** The pieces the next run still has to place. */
  piecesToPlace: readonly PieceTypeId[];
  /** Whether the run on screen started from the player's pieces. */
  runFromAttempt: boolean;
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
  highlightClose = false,
  status,
  isSolving,
  outcome,
  errorMessage,
  stepsShown,
  stepsKnown,
  backtracksSoFar,
  prunesSoFar,
  runs,
  startFrom,
  onStartFromChange,
  attemptPieces,
  attemptOverlaps,
  piecesToPlace,
  runFromAttempt,
}: SolverPanelProps) {
  const { t, i18n } = useTranslation();
  const count = new Intl.NumberFormat(i18n.language);
  const arrangements = useMemo(
    () => countArrangements(challenge, piecesToPlace),
    [challenge, piecesToPlace],
  );
  const attemptUsable = attemptPieces > 0 && !attemptOverlaps;
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
        <button
          type="button"
          className={highlightClose ? 'btn-attention' : undefined}
          onClick={onClose}
          aria-label={t('solver.close')}
        >
          ✕
        </button>
      </header>

      <div className="solver-panel__scroll">
        <a className="text-link" href="#/learn" data-testid="solver-learn-more">
          {t('solver.learnMore')} →
        </a>
        <fieldset className="solver-panel__start" data-testid="solver-start">
          <legend>{t('solver.startFrom.label')}</legend>
          <label>
            <input
              type="radio"
              name="solver-start"
              data-testid="solver-start-empty"
              checked={startFrom === 'empty' || !attemptUsable}
              onChange={() => onStartFromChange('empty')}
            />
            {t('solver.startFrom.empty')}
          </label>
          <label>
            <input
              type="radio"
              name="solver-start"
              data-testid="solver-start-attempt"
              checked={startFrom === 'attempt' && attemptUsable}
              disabled={!attemptUsable}
              onChange={() => onStartFromChange('attempt')}
            />
            {t('solver.startFrom.attempt')}
          </label>
          <p className="solver-panel__hint" data-testid="solver-start-hint">
            {attemptOverlaps
              ? t('solver.startFrom.overlap')
              : attemptPieces === 0
                ? t('solver.startFrom.needPieces')
                : t('solver.startFrom.attemptHint', { count: attemptPieces })}
          </p>
        </fieldset>
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
            {t('solver.arrangements.hint', { count: piecesToPlace.length })}
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
                  <td>
                    {describeCriteria(run.criteria)}
                    {run.startPieces > 0 && (
                      <span className="solver-panel__run-tag">
                        {t('solver.startFrom.runTag', { count: run.startPieces })}
                      </span>
                    )}
                  </td>
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
              fromAttempt={runFromAttempt}
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

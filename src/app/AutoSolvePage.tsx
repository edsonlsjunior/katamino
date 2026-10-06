import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Board } from '../components/Board';
import { PlaybackControls } from '../components/PlaybackControls';
import { SolverStatus } from '../components/SolverStatus';
import { StrategySelector } from '../components/StrategySelector';
import { MetricsPanel } from '../components/MetricsPanel';
import { ComparisonPanel } from '../components/ComparisonPanel';
import { getChallengeById } from '../data/loadChallenges';
import { usePlaybackStore } from '../state/playback';
import type { SolvingStrategyId } from '../domain/types';

interface AutoSolvePageProps {
  challengeId: number;
}

export function AutoSolvePage({ challengeId }: AutoSolvePageProps) {
  const { t } = useTranslation();
  const [selectedStrategy, setSelectedStrategy] = useState<SolvingStrategyId>('backtracking');

  const status = usePlaybackStore((s) => s.status);
  const strategyId = usePlaybackStore((s) => s.strategyId);
  const board = usePlaybackStore((s) => s.board);
  const pieces = usePlaybackStore((s) => s.pieces);
  const speed = usePlaybackStore((s) => s.speed);
  const steps = usePlaybackStore((s) => s.steps);
  const currentStepIndex = usePlaybackStore((s) => s.currentStepIndex);
  const totalSteps = usePlaybackStore((s) => s.totalSteps);
  const errorMessage = usePlaybackStore((s) => s.errorMessage);
  const runHistory = usePlaybackStore((s) => s.runHistory);
  const startSolve = usePlaybackStore((s) => s.startSolve);
  const play = usePlaybackStore((s) => s.play);
  const pause = usePlaybackStore((s) => s.pause);
  const stepForward = usePlaybackStore((s) => s.stepForward);
  const stepBackward = usePlaybackStore((s) => s.stepBackward);
  const rewind = usePlaybackStore((s) => s.rewind);
  const setSpeed = usePlaybackStore((s) => s.setSpeed);

  // Autoplay: while status is 'playing', advance one step at the configured speed.
  useEffect(() => {
    if (status !== 'playing') return;
    const id = setInterval(() => stepForward(), 1000 / speed);
    return () => clearInterval(id);
  }, [status, speed, stepForward]);

  function handleStart() {
    const challenge = getChallengeById(challengeId);
    if (challenge) startSolve(challenge, selectedStrategy);
  }

  const known = totalSteps > 0 ? totalSteps : steps.length;
  const backtrackCountSoFar = useMemo(
    () => steps.slice(0, currentStepIndex + 1).filter((s) => s.kind === 'remove').length,
    [steps, currentStepIndex],
  );
  const isBusy = status === 'computing' || status === 'playing' || status === 'paused';

  return (
    <div className="auto-solve-page">
      <StrategySelector selected={selectedStrategy} onChange={setSelectedStrategy} disabled={isBusy} />

      {!isBusy && (
        <button type="button" onClick={handleStart} data-testid="start-solve">
          {t('solver.start', 'Watch the solver')}
        </button>
      )}

      <SolverStatus status={status} errorMessage={errorMessage} />

      {status !== 'idle' && (
        <>
          <p data-testid="step-counter">
            {t('solver.stepCounter', 'Step {{current}} of {{total}}', {
              current: Math.max(currentStepIndex + 1, 0),
              total: known,
            })}
          </p>
          <Board
            board={board}
            pieces={pieces}
          />
          <PlaybackControls
            status={status}
            speed={speed}
            canStepBackward={currentStepIndex >= 0}
            canStepForward={currentStepIndex < steps.length - 1}
            onPlay={play}
            onPause={pause}
            onStepForward={stepForward}
            onStepBackward={stepBackward}
            onRewind={rewind}
            onSpeedChange={setSpeed}
          />
          {strategyId && (
            <MetricsPanel
              strategyId={strategyId}
              currentStepIndex={currentStepIndex}
              totalSteps={totalSteps}
              backtrackCountSoFar={backtrackCountSoFar}
            />
          )}
        </>
      )}

      <ComparisonPanel runs={runHistory} />
    </div>
  );
}

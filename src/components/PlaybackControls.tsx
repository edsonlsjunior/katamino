import { useTranslation } from 'react-i18next';
import type { PlaybackStatus } from '../domain/types';
import './PlaybackControls.css';

interface PlaybackControlsProps {
  status: PlaybackStatus;
  speed: number;
  canStepBackward: boolean;
  canStepForward: boolean;
  onPlay: () => void;
  onPause: () => void;
  onStepForward: () => void;
  onStepBackward: () => void;
  onRewind: () => void;
  /** Jumps to the last step the solver has produced so far. */
  onSkipToEnd: () => void;
  onSpeedChange: (speed: number) => void;
}

const SPEED_OPTIONS = [1, 2, 3, 5, 10, 25, 100, 1000];

export function PlaybackControls({
  status,
  speed,
  canStepBackward,
  canStepForward,
  onPlay,
  onPause,
  onStepForward,
  onStepBackward,
  onRewind,
  onSkipToEnd,
  onSpeedChange,
}: PlaybackControlsProps) {
  const { t } = useTranslation();
  const isPlaying = status === 'playing';
  const canPlay = status === 'paused' || status === 'idle';

  // The label is the accessible name; narrow screens hide its visible copy
  // and keep the icon (PlaybackControls.css).
  function content(icon: string, label: string) {
    return (
      <>
        <span className="playback-controls__icon" aria-hidden="true">
          {icon}
        </span>
        <span className="playback-controls__text">{label}</span>
      </>
    );
  }
  const labels = {
    rewind: t('playback.rewind', 'Restart'),
    stepBack: t('playback.stepBack', 'Step back'),
    pause: t('playback.pause', 'Pause'),
    play: t('playback.play', 'Play'),
    stepForward: t('playback.stepForward', 'Step forward'),
    skipToEnd: t('playback.skipToEnd', 'Jump to the end'),
  };

  return (
    <div className="playback-controls" role="group" aria-label={t('playback.label', 'Playback controls')}>
      <button type="button" aria-label={labels.rewind} onClick={onRewind} disabled={status === 'computing'}>
        {content('⏮', labels.rewind)}
      </button>
      <button type="button" aria-label={labels.stepBack} onClick={onStepBackward} disabled={!canStepBackward}>
        {content('❮', labels.stepBack)}
      </button>
      {isPlaying ? (
        <button type="button" aria-label={labels.pause} className="btn-primary" onClick={onPause}>
          {content('⏸', labels.pause)}
        </button>
      ) : (
        <button type="button" aria-label={labels.play} className="btn-primary" onClick={onPlay} disabled={!canPlay}>
          {content('▶', labels.play)}
        </button>
      )}
      <button type="button" aria-label={labels.stepForward} onClick={onStepForward} disabled={!canStepForward}>
        {content('❯', labels.stepForward)}
      </button>
      <button type="button" aria-label={labels.skipToEnd} onClick={onSkipToEnd} disabled={!canStepForward}>
        {content('⏭', labels.skipToEnd)}
      </button>
      <label>
        {t('playback.speed', 'Speed')}
        <select value={speed} onChange={(e) => onSpeedChange(Number(e.target.value))}>
          {SPEED_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}x
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

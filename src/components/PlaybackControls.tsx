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

  return (
    <div className="playback-controls" role="group" aria-label={t('playback.label', 'Playback controls')}>
      <button type="button" onClick={onRewind} disabled={status === 'computing'}>
        {t('playback.rewind', 'Restart')}
      </button>
      <button type="button" onClick={onStepBackward} disabled={!canStepBackward}>
        {t('playback.stepBack', 'Step back')}
      </button>
      {isPlaying ? (
        <button type="button" className="btn-primary" onClick={onPause}>
          {t('playback.pause', 'Pause')}
        </button>
      ) : (
        <button type="button" className="btn-primary" onClick={onPlay} disabled={!canPlay}>
          {t('playback.play', 'Play')}
        </button>
      )}
      <button type="button" onClick={onStepForward} disabled={!canStepForward}>
        {t('playback.stepForward', 'Step forward')}
      </button>
      <button type="button" onClick={onSkipToEnd} disabled={!canStepForward}>
        {t('playback.skipToEnd', 'Jump to the end')}
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

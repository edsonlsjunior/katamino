import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigationStore, type Screen as ScreenName } from '../state/navigation';
import { LanguageSwitcher } from './LanguageSwitcher';
import { ChallengeList } from '../components/ChallengeList';
import { ManualPlayPage } from './ManualPlayPage';
import './App.css';

export function App() {
  const { t } = useTranslation();
  const screen = useNavigationStore((s) => s.screen);
  const goToChallenges = useNavigationStore((s) => s.goToChallenges);

  // Right-click is a game control (rotate), so the browser's context menu is
  // turned off everywhere in the app, not just over the board.
  useEffect(() => {
    function suppressContextMenu(event: MouseEvent) {
      event.preventDefault();
    }
    document.addEventListener('contextmenu', suppressContextMenu);
    return () => document.removeEventListener('contextmenu', suppressContextMenu);
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header__start">
          {screen !== 'challenges' && (
            <button
              type="button"
              className="app-header__back"
              onClick={goToChallenges}
              aria-label={t('common.back')}
            >
              ← {t('common.back')}
            </button>
          )}
          <h1>{t('app.title')}</h1>
        </div>
        <LanguageSwitcher />
      </header>
      <main className={screen === 'manual' ? 'main--fill' : undefined}>
        <Screen name={screen} />
      </main>
    </div>
  );
}

function Screen({ name }: { name: ScreenName }) {
  const { t } = useTranslation();
  const challengeId = useNavigationStore((s) => s.challengeId);
  const goToManualPlay = useNavigationStore((s) => s.goToManualPlay);
  const goToSolver = useNavigationStore((s) => s.goToSolver);

  switch (name) {
    case 'challenges':
      return <ChallengeList onPlay={goToManualPlay} onWatchSolver={goToSolver} />;
    case 'manual':
      return challengeId !== null ? (
        <ManualPlayPage challengeId={challengeId} />
      ) : (
        <p>{t('common.loading')}</p>
      );
    default:
      return null;
  }
}

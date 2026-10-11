import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigationStore, type Screen as ScreenName } from '../state/navigation';
import { LanguageSwitcher } from './LanguageSwitcher';
import { ChallengeList } from '../components/ChallengeList';
import { ManualPlayPage } from './ManualPlayPage';
import { AboutPage } from './AboutPage';
import './App.css';

// The challenge list and the challenge screen lay themselves out inside the
// viewport (their own parts scroll); the about page is a plain scrolling text.
const MAIN_CLASS: Record<ScreenName, string | undefined> = {
  challenges: 'main--wide',
  manual: 'main--fill',
  about: undefined,
};

export function App() {
  const { t } = useTranslation();
  const screen = useNavigationStore((s) => s.screen);
  const goToChallenges = useNavigationStore((s) => s.goToChallenges);
  const goToAbout = useNavigationStore((s) => s.goToAbout);

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
              ← <span className="app-header__back-text">{t('common.back')}</span>
            </button>
          )}
          <h1>{t('app.title')}</h1>
        </div>
        <div className="app-header__end">
          <button
            type="button"
            className="app-header__about"
            aria-label={t('nav.about')}
            aria-pressed={screen === 'about'}
            onClick={goToAbout}
          >
            <span aria-hidden="true">ⓘ</span>{' '}
            <span className="app-header__about-text">{t('nav.about')}</span>
          </button>
          <LanguageSwitcher />
        </div>
      </header>
      <main className={MAIN_CLASS[screen]}>
        <Screen name={screen} />
      </main>
    </div>
  );
}

function Screen({ name }: { name: ScreenName }) {
  const { t } = useTranslation();
  const challengeId = useNavigationStore((s) => s.challengeId);
  const goToManualPlay = useNavigationStore((s) => s.goToManualPlay);
  const goToChallenges = useNavigationStore((s) => s.goToChallenges);

  switch (name) {
    case 'challenges':
      return <ChallengeList onPlay={goToManualPlay} />;
    case 'manual':
      return challengeId !== null ? (
        <ManualPlayPage challengeId={challengeId} />
      ) : (
        <p>{t('common.loading')}</p>
      );
    case 'about':
      return <AboutPage onBrowseChallenges={goToChallenges} />;
    default:
      return null;
  }
}

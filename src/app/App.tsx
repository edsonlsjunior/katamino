import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigationStore, type Screen as ScreenName } from '../state/navigation';
import { LanguageSwitcher } from './LanguageSwitcher';
import { ChallengeList } from '../components/ChallengeList';
import { ManualPlayPage } from './ManualPlayPage';
import { AboutPage } from './AboutPage';
import { LearnPage } from './LearnPage';
import { SettingsPage } from './SettingsPage';
import './App.css';

// The challenge list and the challenge screen lay themselves out inside the
// viewport (their own parts scroll); the text pages simply scroll.
const MAIN_CLASS: Record<ScreenName, string | undefined> = {
  challenges: 'main--wide',
  manual: 'main--fill',
  learn: undefined,
  about: undefined,
  settings: undefined,
};

export function App() {
  const { t } = useTranslation();
  const screen = useNavigationStore((s) => s.screen);
  const goToChallenges = useNavigationStore((s) => s.goToChallenges);
  const goToAbout = useNavigationStore((s) => s.goToAbout);
  const goToLearn = useNavigationStore((s) => s.goToLearn);
  const goToSettings = useNavigationStore((s) => s.goToSettings);

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
            className="app-header__nav"
            aria-label={t('nav.learn')}
            aria-pressed={screen === 'learn'}
            onClick={goToLearn}
          >
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
              <path d="M8 4v3M8 7L3.5 11M8 7l4.5 4" stroke="currentColor" strokeWidth="1.5" fill="none" />
              <circle cx="8" cy="3" r="2" fill="currentColor" />
              <circle cx="3.5" cy="12.5" r="2" fill="currentColor" />
              <circle cx="12.5" cy="12.5" r="2" fill="currentColor" />
            </svg>{' '}
            <span className="app-header__nav-text">{t('nav.learn')}</span>
          </button>
          <button
            type="button"
            className="app-header__nav"
            aria-label={t('nav.about')}
            aria-pressed={screen === 'about'}
            onClick={goToAbout}
          >
            <span aria-hidden="true">ⓘ</span>{' '}
            <span className="app-header__nav-text">{t('nav.about')}</span>
          </button>
          <button
            type="button"
            className="app-header__nav"
            aria-label={t('nav.settings')}
            aria-pressed={screen === 'settings'}
            onClick={goToSettings}
          >
            <span aria-hidden="true">⚙</span>{' '}
            <span className="app-header__nav-text">{t('nav.settings')}</span>
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
  const goToSolver = useNavigationStore((s) => s.goToSolver);

  switch (name) {
    case 'challenges':
      return <ChallengeList onPlay={goToManualPlay} />;
    case 'manual':
      return challengeId !== null ? (
        <ManualPlayPage challengeId={challengeId} />
      ) : (
        <p>{t('common.loading')}</p>
      );
    case 'learn':
      return <LearnPage onOpenSolver={goToSolver} />;
    case 'about':
      return <AboutPage onBrowseChallenges={goToChallenges} />;
    case 'settings':
      return <SettingsPage />;
    default:
      return null;
  }
}

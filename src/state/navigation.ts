import { create } from 'zustand';
import { getChallengeById } from '../data/loadChallenges';
import { consumeFirstVisit } from './persistence';

export type Screen = 'challenges' | 'manual' | 'learn' | 'about' | 'settings';

/** The part of the navigation state that is mirrored in the URL. */
export interface Route {
  screen: Screen;
  challengeId: number | null;
  /** Whether the challenge screen is in solver mode (solver panel open). */
  solverOpen: boolean;
}

interface NavigationState extends Route {
  goToChallenges: () => void;
  goToLearn: () => void;
  goToAbout: () => void;
  goToSettings: () => void;
  goToManualPlay: (challengeId: number) => void;
  /** Switches challenge without leaving the current mode (play or solver). */
  goToChallenge: (challengeId: number) => void;
  /** Opens a challenge straight into solver mode. */
  goToSolver: (challengeId: number) => void;
  openSolver: () => void;
  closeSolver: () => void;
}

const ROOT: Route = { screen: 'challenges', challengeId: null, solverOpen: false };

/*
 * Routes live in the URL hash, so they work on a static host (GitHub Pages)
 * with no server-side fallback:
 *   #/                        challenge list (the root)
 *   #/challenge/12            playing challenge 12
 *   #/challenge/12/solver     challenge 12 in solver mode
 *   #/learn                   how the solver works
 *   #/about                   about the project
 *   #/settings                preferences and progress export/import
 * Anything unrecognised (including a challenge that doesn't exist) falls back
 * to the root.
 */
export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#/, '').replace(/^\/+|\/+$/g, '');
  if (path === 'about' || path === 'learn' || path === 'settings') {
    return { screen: path, challengeId: null, solverOpen: false };
  }
  const match = /^challenge\/([1-9]\d*)(\/solver)?$/.exec(path);
  if (match && getChallengeById(Number(match[1]))) {
    return { screen: 'manual', challengeId: Number(match[1]), solverOpen: match[2] !== undefined };
  }
  return ROOT;
}

export function formatRoute(route: Route): string {
  if (route.screen === 'about' || route.screen === 'learn' || route.screen === 'settings') {
    return `#/${route.screen}`;
  }
  if (route.screen === 'manual' && route.challengeId !== null) {
    return `#/challenge/${route.challengeId}${route.solverOpen ? '/solver' : ''}`;
  }
  return '#/';
}

const hasWindow = typeof window !== 'undefined';

/**
 * Writes the route to the URL. Moving between screens adds a history entry;
 * changes within the challenge screen (another challenge, solver on/off)
 * replace it, so the browser's back button leaves the challenge in one step.
 */
function writeRoute(route: Route, mode: 'push' | 'replace'): void {
  if (!hasWindow) return;
  const hash = formatRoute(route);
  // An empty hash is the root too: don't add an entry just to spell it out.
  if ((window.location.hash || '#/') === hash) return;
  try {
    if (mode === 'push') window.history.pushState(null, '', hash);
    else window.history.replaceState(null, '', hash);
  } catch {
    // Best-effort only: navigation still works without the URL following it.
  }
}

/**
 * Where the app opens. The root shows the about page the very first time
 * someone arrives, as an introduction; from then on it is the challenge list.
 */
function initialRoute(): Route {
  if (!hasWindow) return ROOT;
  const route = parseRoute(window.location.hash);
  if (!consumeFirstVisit() || route.screen !== 'challenges') return route;
  const about: Route = { screen: 'about', challengeId: null, solverOpen: false };
  writeRoute(about, 'replace');
  return about;
}

export const useNavigationStore = create<NavigationState>((set, get) => {
  function navigate(route: Route, mode: 'push' | 'replace') {
    set(route);
    writeRoute(route, mode);
  }

  return {
    ...initialRoute(),
    goToChallenges: () => navigate(ROOT, 'push'),
    goToLearn: () => navigate({ screen: 'learn', challengeId: null, solverOpen: false }, 'push'),
    goToAbout: () => navigate({ screen: 'about', challengeId: null, solverOpen: false }, 'push'),
    goToManualPlay: (challengeId) =>
      navigate({ screen: 'manual', challengeId, solverOpen: false }, 'push'),
    goToChallenge: (challengeId) =>
      navigate(
        { screen: 'manual', challengeId, solverOpen: get().solverOpen },
        get().screen === 'manual' ? 'replace' : 'push',
      ),
    goToSettings: () => navigate({ screen: 'settings', challengeId: null, solverOpen: false }, 'push'),
    goToSolver: (challengeId) =>
      navigate({ screen: 'manual', challengeId, solverOpen: true }, 'push'),
    openSolver: () => navigate({ ...pickRoute(get()), solverOpen: true }, 'replace'),
    closeSolver: () => navigate({ ...pickRoute(get()), solverOpen: false }, 'replace'),
  };
});

function pickRoute({ screen, challengeId, solverOpen }: Route): Route {
  return { screen, challengeId, solverOpen };
}

// Back/forward buttons and hand-edited URLs.
if (hasWindow) {
  const syncFromUrl = () => useNavigationStore.setState(parseRoute(window.location.hash));
  window.addEventListener('hashchange', syncFromUrl);
  window.addEventListener('popstate', syncFromUrl);
}

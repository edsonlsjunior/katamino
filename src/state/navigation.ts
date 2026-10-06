import { create } from 'zustand';

export type Screen = 'challenges' | 'manual';

interface NavigationState {
  screen: Screen;
  challengeId: number | null;
  /** Whether the challenge screen is in solver mode (solver panel open). */
  solverOpen: boolean;
  goToChallenges: () => void;
  goToManualPlay: (challengeId: number) => void;
  /** Switches challenge without leaving the current mode (play or solver). */
  goToChallenge: (challengeId: number) => void;
  /** Opens a challenge straight into solver mode. */
  goToSolver: (challengeId: number) => void;
  openSolver: () => void;
  closeSolver: () => void;
}

export const useNavigationStore = create<NavigationState>((set) => ({
  screen: 'challenges',
  challengeId: null,
  solverOpen: false,
  goToChallenges: () => set({ screen: 'challenges', challengeId: null, solverOpen: false }),
  goToManualPlay: (challengeId) => set({ screen: 'manual', challengeId, solverOpen: false }),
  goToChallenge: (challengeId) => set({ screen: 'manual', challengeId }),
  goToSolver: (challengeId) => set({ screen: 'manual', challengeId, solverOpen: true }),
  openSolver: () => set({ solverOpen: true }),
  closeSolver: () => set({ solverOpen: false }),
}));

import { create } from 'zustand';

export type Screen = 'challenges' | 'manual' | 'auto';

interface NavigationState {
  screen: Screen;
  challengeId: number | null;
  goToChallenges: () => void;
  goToManualPlay: (challengeId: number) => void;
  goToAutoSolve: (challengeId: number) => void;
}

export const useNavigationStore = create<NavigationState>((set) => ({
  screen: 'challenges',
  challengeId: null,
  goToChallenges: () => set({ screen: 'challenges', challengeId: null }),
  goToManualPlay: (challengeId) => set({ screen: 'manual', challengeId }),
  goToAutoSolve: (challengeId) => set({ screen: 'auto', challengeId }),
}));

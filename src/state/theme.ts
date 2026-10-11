import { create } from 'zustand';
import { readTheme, writeTheme, type ThemePreference } from './persistence';

/**
 * Puts the choice on <html>, where tokens.css picks it up: `data-theme` for an
 * explicit light/dark, nothing for "system" (the OS setting then decides).
 */
function applyTheme(theme: ThemePreference): void {
  if (typeof document === 'undefined') return;
  if (theme === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
}

interface ThemeState {
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;
}

const initialTheme = readTheme();
// Applied as soon as this module loads, before the first render.
applyTheme(initialTheme);

export const useThemeStore = create<ThemeState>((set) => ({
  theme: initialTheme,
  setTheme: (theme) => {
    writeTheme(theme);
    applyTheme(theme);
    set({ theme });
  },
}));

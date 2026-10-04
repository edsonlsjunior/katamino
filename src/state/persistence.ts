/**
 * Local persistence for completion progress and language preference.
 * See contracts/persistence-contract.md. Every read tolerates missing, corrupt,
 * or unavailable storage by falling back to a safe default — it never throws.
 */
import type { ProgressStore } from '../domain/types';

const PROGRESS_KEY = 'katamino:v1:progress';
const LANG_KEY = 'katamino:v1:lang';

export type SupportedLanguage = 'en' | 'pt';

const DEFAULT_PROGRESS: ProgressStore = { version: 1, completed: {} };

function isProgressStore(value: unknown): value is ProgressStore {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { version?: unknown }).version === 1 &&
    typeof (value as { completed?: unknown }).completed === 'object' &&
    (value as { completed?: unknown }).completed !== null
  );
}

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Best-effort only — a failed write must not interrupt the user's action.
  }
}

export function readProgress(): ProgressStore {
  const raw = readStorage(PROGRESS_KEY);
  if (!raw) return DEFAULT_PROGRESS;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isProgressStore(parsed) ? parsed : DEFAULT_PROGRESS;
  } catch {
    return DEFAULT_PROGRESS;
  }
}

export function isChallengeCompleted(challengeId: number): boolean {
  return readProgress().completed[challengeId] === true;
}

export function markChallengeCompleted(challengeId: number): void {
  const current = readProgress();
  if (current.completed[challengeId]) return;
  const next: ProgressStore = {
    version: 1,
    completed: { ...current.completed, [challengeId]: true },
  };
  writeStorage(PROGRESS_KEY, JSON.stringify(next));
}

const SUPPORTED_LANGUAGES: readonly SupportedLanguage[] = ['en', 'pt'];

function detectBrowserLanguage(): SupportedLanguage {
  const nav = typeof navigator !== 'undefined' ? navigator.language : 'en';
  return nav.toLowerCase().startsWith('pt') ? 'pt' : 'en';
}

export function readLanguage(): SupportedLanguage {
  const raw = readStorage(LANG_KEY);
  if (raw && (SUPPORTED_LANGUAGES as readonly string[]).includes(raw)) {
    return raw as SupportedLanguage;
  }
  return detectBrowserLanguage();
}

export function writeLanguage(lang: SupportedLanguage): void {
  writeStorage(LANG_KEY, lang);
}

/**
 * Local persistence for completion progress and preferences (language, theme).
 * Progress can also be exported to / imported from a JSON file.
 * See contracts/persistence-contract.md. Every read tolerates missing, corrupt,
 * or unavailable storage by falling back to a safe default — it never throws.
 */
import type { ProgressStore } from '../domain/types';

const PROGRESS_KEY = 'katamino:v1:progress';
const LANG_KEY = 'katamino:v1:lang';
const THEME_KEY = 'katamino:v1:theme';
const VISITED_KEY = 'katamino:v1:visited';

export const SUPPORTED_LANGUAGES = ['en', 'pt', 'es', 'fr'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/** 'system' follows the browser/OS setting. */
export const THEME_PREFERENCES = ['system', 'light', 'dark'] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];

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

export interface ProgressExport {
  app: 'katamino';
  version: 1;
  exportedAt: string;
  /** Ids of the completed challenges, in ascending order. */
  completed: number[];
}

/** The player's progress as the text of a JSON file. */
export function exportProgress(now: Date = new Date()): string {
  const completed = Object.keys(readProgress().completed)
    .map(Number)
    .filter((id) => Number.isInteger(id))
    .sort((a, b) => a - b);
  const data: ProgressExport = { app: 'katamino', version: 1, exportedAt: now.toISOString(), completed };
  return JSON.stringify(data, null, 2);
}

/** The challenge ids in an exported file; also accepts the raw stored shape (`{ completed: { id: true } }`). */
function parseExportedIds(json: string): number[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('Not a JSON file');
  }
  const completed = (parsed as { completed?: unknown } | null)?.completed;
  let ids: unknown[];
  if (Array.isArray(completed)) ids = completed;
  else if (typeof completed === 'object' && completed !== null) {
    ids = Object.entries(completed)
      .filter(([, done]) => done === true)
      .map(([id]) => Number(id));
  } else {
    throw new Error('No progress in this file');
  }
  if (!ids.every((id) => typeof id === 'number' && Number.isInteger(id))) {
    throw new Error('Invalid challenge id in this file');
  }
  return ids as number[];
}

/**
 * Merges an exported file into the stored progress: nothing already completed
 * is lost, and ids that aren't real challenges are ignored. Returns how many
 * challenges became completed. Throws if the text isn't a progress file.
 */
export function importProgress(json: string, isKnownChallenge: (id: number) => boolean): number {
  const ids = parseExportedIds(json).filter(isKnownChallenge);
  const completed = { ...readProgress().completed };
  let added = 0;
  for (const id of ids) {
    if (completed[id]) continue;
    completed[id] = true;
    added++;
  }
  if (added > 0) writeStorage(PROGRESS_KEY, JSON.stringify({ version: 1, completed } satisfies ProgressStore));
  return added;
}

/** The first supported language among the browser's preferred ones; English otherwise. */
function detectBrowserLanguage(): SupportedLanguage {
  if (typeof navigator === 'undefined') return 'en';
  const preferred = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const tag of preferred) {
    const code = tag?.toLowerCase().split('-')[0];
    const match = SUPPORTED_LANGUAGES.find((lang) => lang === code);
    if (match) return match;
  }
  return 'en';
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

export function readTheme(): ThemePreference {
  const raw = readStorage(THEME_KEY);
  return (THEME_PREFERENCES as readonly string[]).includes(raw ?? '') ? (raw as ThemePreference) : 'system';
}

export function writeTheme(theme: ThemePreference): void {
  writeStorage(THEME_KEY, theme);
}

/**
 * Whether this is the first time the app is opened in this browser. Asking
 * also records the visit, so it is only ever true once.
 */
export function consumeFirstVisit(): boolean {
  if (readStorage(VISITED_KEY) !== null) return false;
  writeStorage(VISITED_KEY, '1');
  return true;
}

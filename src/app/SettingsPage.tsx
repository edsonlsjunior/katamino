import { useRef, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { getChallengeById, loadChallenges } from '../data/loadChallenges';
import {
  THEME_PREFERENCES,
  exportProgress,
  importProgress,
  readProgress,
} from '../state/persistence';
import { useThemeStore } from '../state/theme';
import { LanguageSwitcher } from './LanguageSwitcher';
import './SettingsPage.css';

type ImportResult = { kind: 'added'; count: number } | { kind: 'error' };

function download(filename: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function SettingsPage() {
  const { t } = useTranslation();
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const fileRef = useRef<HTMLInputElement>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  // Read on every render: an import changes it, and re-renders this page.
  const total = loadChallenges().length;
  const done = Object.keys(readProgress().completed).filter((id) => getChallengeById(Number(id))).length;

  async function onFileChosen(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Lets the same file be chosen again later.
    event.target.value = '';
    if (!file) return;
    try {
      const count = importProgress(await file.text(), (id) => getChallengeById(id) !== undefined);
      setImportResult({ kind: 'added', count });
    } catch {
      setImportResult({ kind: 'error' });
    }
  }

  return (
    <article className="settings-page">
      <h2>{t('settings.title')}</h2>

      <section className="settings-card">
        <h3>{t('settings.theme.title')}</h3>
        <p>{t('settings.theme.body')}</p>
        <div className="settings-choice" role="radiogroup" aria-label={t('settings.theme.title')}>
          {THEME_PREFERENCES.map((option) => (
            <label key={option} className="settings-choice__option">
              <input
                type="radio"
                name="theme"
                value={option}
                checked={theme === option}
                onChange={() => setTheme(option)}
              />
              <span>{t(`settings.theme.${option}`)}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="settings-card">
        <h3>{t('settings.language.title')}</h3>
        <p>{t('settings.language.body')}</p>
        <LanguageSwitcher />
      </section>

      <section className="settings-card">
        <h3>{t('settings.progress.title')}</h3>
        <p data-testid="settings-progress">
          {t('challenges.progress.summary', {
            done,
            total,
            percent: Math.round((done / total) * 100),
          })}
        </p>
        <p>{t('settings.progress.body')}</p>
        <div className="settings-actions">
          <button
            type="button"
            className="btn-primary"
            data-testid="settings-export"
            onClick={() => download('katamino-progress.json', exportProgress())}
          >
            {t('settings.progress.export')}
          </button>
          <button type="button" data-testid="settings-import" onClick={() => fileRef.current?.click()}>
            {t('settings.progress.import')}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            data-testid="settings-import-file"
            onChange={(event) => void onFileChosen(event)}
          />
        </div>
        {importResult && (
          <p
            className={`settings-result settings-result--${importResult.kind}`}
            data-testid="settings-import-result"
            role={importResult.kind === 'error' ? 'alert' : 'status'}
          >
            {importResult.kind === 'error'
              ? t('settings.progress.importError')
              : t('settings.progress.imported', { count: importResult.count })}
          </p>
        )}
      </section>
    </article>
  );
}

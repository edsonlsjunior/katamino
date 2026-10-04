import { useTranslation } from 'react-i18next';
import { setLanguage } from '../i18n';
import type { SupportedLanguage } from '../state/persistence';

const LANGUAGES: SupportedLanguage[] = ['en', 'pt'];

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation();

  return (
    <div role="group" aria-label={t('language.label')}>
      {LANGUAGES.map((lang) => (
        <button
          key={lang}
          type="button"
          aria-pressed={i18n.language === lang}
          onClick={() => setLanguage(lang)}
        >
          {t(`language.${lang}`)}
        </button>
      ))}
    </div>
  );
}

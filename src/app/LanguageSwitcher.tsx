import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { setLanguage } from '../i18n';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '../state/persistence';
import './LanguageSwitcher.css';

/** Each language under its own name, so it can be found whatever the current one is. */
const LANGUAGE_NAMES: Record<SupportedLanguage, string> = {
  en: 'English',
  pt: 'Português',
  es: 'Español',
  fr: 'Français',
};

/**
 * Flags are drawn here rather than typed as emoji: Windows has no flag emoji
 * and shows two letters instead. Simplified to what reads at this size.
 */
function Flag({ lang }: { lang: SupportedLanguage }) {
  return (
    <svg className="flag" viewBox="0 0 28 20" width="22" height="16" aria-hidden="true">
      {lang === 'pt' && (
        <>
          <rect width="28" height="20" fill="#009c3b" />
          <path d="M14 2.5 25.5 10 14 17.5 2.5 10z" fill="#ffdf00" />
          <circle cx="14" cy="10" r="4.4" fill="#002776" />
        </>
      )}
      {lang === 'en' && (
        <>
          <rect width="28" height="20" fill="#fff" />
          {[0, 2, 4, 6, 8, 10, 12].map((stripe) => (
            <rect key={stripe} y={(stripe * 20) / 13} width="28" height={20 / 13} fill="#b22234" />
          ))}
          <rect width="12" height={(7 * 20) / 13} fill="#3c3b6e" />
        </>
      )}
      {lang === 'es' && (
        <>
          <rect width="28" height="20" fill="#aa151b" />
          <rect y="5" width="28" height="10" fill="#f1bf00" />
        </>
      )}
      {lang === 'fr' && (
        <>
          <rect width="28" height="20" fill="#fff" />
          <rect width="9.34" height="20" fill="#0055a4" />
          <rect x="18.66" width="9.34" height="20" fill="#ef4135" />
        </>
      )}
    </svg>
  );
}

function isSupported(lang: string): lang is SupportedLanguage {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(lang);
}

/** A dropdown with the current language's flag; opens a list of all of them. */
export function LanguageSwitcher() {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const current: SupportedLanguage = isSupported(i18n.language) ? i18n.language : 'en';

  // Clicking elsewhere or pressing Escape closes the list.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div className="language-menu" ref={rootRef}>
      <button
        type="button"
        className="language-menu__toggle"
        data-testid="language-menu"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`${t('language.label')}: ${LANGUAGE_NAMES[current]}`}
        onClick={() => setOpen((value) => !value)}
      >
        <Flag lang={current} />
        <span className="language-menu__current">{LANGUAGE_NAMES[current]}</span>
        <span className="language-menu__caret" aria-hidden="true">
          ▾
        </span>
      </button>
      {open && (
        <ul className="language-menu__list" id={listId} role="listbox" aria-label={t('language.label')}>
          {SUPPORTED_LANGUAGES.map((lang) => (
            <li key={lang} role="option" aria-selected={lang === current}>
              <button
                type="button"
                lang={lang}
                onClick={() => {
                  setLanguage(lang);
                  setOpen(false);
                }}
              >
                <Flag lang={lang} />
                {LANGUAGE_NAMES[lang]}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

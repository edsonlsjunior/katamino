import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import pt from './locales/pt.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import { readLanguage, writeLanguage, type SupportedLanguage } from '../state/persistence';

const initialLanguage = readLanguage();

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    pt: { translation: pt },
    es: { translation: es },
    fr: { translation: fr },
  },
  lng: initialLanguage,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

if (typeof document !== 'undefined') {
  document.documentElement.lang = initialLanguage;
  i18n.on('languageChanged', (lang) => {
    document.documentElement.lang = lang;
  });
}

export function setLanguage(lang: SupportedLanguage): void {
  writeLanguage(lang);
  void i18n.changeLanguage(lang);
}

export default i18n;

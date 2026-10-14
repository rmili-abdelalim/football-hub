import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';
import ar from './ar';
import en from './en';
import fr from './fr';

export const LANGS = [
  { code: 'fr', label: 'Français', dir: 'ltr' },
  { code: 'ar', label: 'العربية', dir: 'rtl' },
  { code: 'en', label: 'English', dir: 'ltr' },
] as const;
export type Lang = (typeof LANGS)[number]['code'];

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { fr: { translation: fr }, en: { translation: en }, ar: { translation: ar } },
    fallbackLng: 'fr',
    supportedLngs: ['fr', 'ar', 'en'],
    nonExplicitSupportedLngs: true,
    interpolation: { escapeValue: false },
    detection: {
      // Préférence enregistrée d'abord, puis langue du navigateur
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'fh:lang',
      caches: ['localStorage'],
    },
  });

export function applyDocumentLang(lng: string) {
  const code = (lng.split('-')[0] as Lang) ?? 'fr';
  const meta = LANGS.find((l) => l.code === code) ?? LANGS[0];
  document.documentElement.lang = meta.code;
  document.documentElement.dir = meta.dir;
}

i18n.on('languageChanged', applyDocumentLang);
applyDocumentLang(i18n.resolvedLanguage ?? 'fr');

export default i18n;

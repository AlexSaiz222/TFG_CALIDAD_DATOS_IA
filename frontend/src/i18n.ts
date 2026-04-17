import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import es from './locales/es.json';
import en from './locales/en.json';

export const LANGUAGE_STORAGE_KEY = 'app-language';
export type Language = 'es' | 'en';

const savedLanguage: Language =
  typeof window !== 'undefined'
    ? ((localStorage.getItem(LANGUAGE_STORAGE_KEY) as Language) ?? 'es')
    : 'es';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      es: { translation: es },
      en: { translation: en },
    },
    lng: savedLanguage,
    fallbackLng: 'es',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;

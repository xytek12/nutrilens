import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from '../../locales/en/translation.json';
import he from '../../locales/he/translation.json';
import ar from '../../locales/ar/translation.json';
import de from '../../locales/de/translation.json';
import zh from '../../locales/zh/translation.json';

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    he: { translation: he },
    ar: { translation: ar },
    de: { translation: de },
    zh: { translation: zh },
  },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;

/**
 * translationStore.ts — Global i18n state using Zustand.
 *
 * - Persists the user's chosen language to localStorage
 * - Loads translation JSON files dynamically
 * - Provides t(key) function for translations
 * - Fallback to key if translation missing
 * - RTL support via document.dir
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type LangCode = 'en' | 'hi' | 'ar' | 'fr' | 'de' | 'es' | 'pt' | 'zh' | 'ja' | 'ko' | 'ru' | 'tr' | 'id' | 'ms' | 'th' | 'bn' | 'ur' | 'ta' | 'te' | 'mr';

export interface LangMeta {
  code: LangCode;
  label: string; // native name
  english: string; // English name
  flag: string;
  rtl: boolean;
}

export const LANGUAGES: LangMeta[] = [
  { code: 'en', label: 'English', english: 'English', flag: '🇺🇸', rtl: false },
  { code: 'hi', label: 'हिन्दी', english: 'Hindi', flag: '🇮🇳', rtl: false },
  { code: 'ar', label: 'العربية', english: 'Arabic', flag: '🇸🇦', rtl: true },
  { code: 'fr', label: 'Français', english: 'French', flag: '🇫🇷', rtl: false },
  { code: 'de', label: 'Deutsch', english: 'German', flag: '🇩🇪', rtl: false },
  { code: 'es', label: 'Español', english: 'Spanish', flag: '🇪🇸', rtl: false },
  { code: 'pt', label: 'Português', english: 'Portuguese', flag: '🇧🇷', rtl: false },
  { code: 'zh', label: '中文', english: 'Chinese', flag: '🇨🇳', rtl: false },
  { code: 'ja', label: '日本語', english: 'Japanese', flag: '🇯🇵', rtl: false },
  { code: 'ko', label: '한국어', english: 'Korean', flag: '🇰🇷', rtl: false },
  { code: 'ru', label: 'Русский', english: 'Russian', flag: '🇷🇺', rtl: false },
  { code: 'tr', label: 'Türkçe', english: 'Turkish', flag: '🇹🇷', rtl: false },
  { code: 'id', label: 'Indonesia', english: 'Indonesian', flag: '🇮🇩', rtl: false },
  { code: 'ms', label: 'Melayu', english: 'Malay', flag: '🇲🇾', rtl: false },
  { code: 'th', label: 'ภาษาไทย', english: 'Thai', flag: '🇹🇭', rtl: false },
  { code: 'bn', label: 'বাংলা', english: 'Bengali', flag: '🇧🇩', rtl: false },
  { code: 'ur', label: 'اردو', english: 'Urdu', flag: '🇵🇰', rtl: true },
  { code: 'ta', label: 'தமிழ்', english: 'Tamil', flag: '🇮🇳', rtl: false },
  { code: 'te', label: 'తెలుగు', english: 'Telugu', flag: '🇮🇳', rtl: false },
  { code: 'mr', label: 'मराठी', english: 'Marathi', flag: '🇮🇳', rtl: false },
];

type Translations = Record<string, unknown>;

interface TranslationState {
  language: LangCode;
  translations: Translations;
  loading: boolean;

  setLanguage: (code: LangCode) => Promise<void>;
  t: (key: string, params?: Record<string, string | number>) => string;
}

// Helper to get nested value from object using dot notation
function getNestedValue(obj: unknown, path: string): string | undefined {
  const keys = path.split('.');
  let current: unknown = obj;
  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) {
      current = (current as Record<string, unknown>)[key];
    } else {
      return undefined;
    }
  }
  return typeof current === 'string' ? current : undefined;
}

// Load translation JSON file
async function loadTranslations(lang: LangCode): Promise<Translations> {
  try {
    const module = await import(`../locales/${lang}.json`);
    return module.default || module;
  } catch {
    // Fallback to English if file not found
    if (lang !== 'en') {
      try {
        const module = await import(`../locales/en.json`);
        return module.default || module;
      } catch {
        return {};
      }
    }
    return {};
  }
}

export const useTranslationStore = create<TranslationState>()(
  persist(
    (set, get) => ({
      language: 'en',
      translations: {},
      loading: false,

      setLanguage: async (code: LangCode) => {
        const lang = LANGUAGES.find((l) => l.code === code);
        if (!lang) return;

        set({ loading: true });

        // Load translations
        const translations = await loadTranslations(code);

        // Apply RTL direction
        if (typeof document !== 'undefined' && document.documentElement) {
          document.documentElement.dir = lang.rtl ? 'rtl' : 'ltr';
          document.documentElement.lang = code;
        }

        set({ language: code, translations, loading: false });
      },

      t: (key: string, params?: Record<string, string | number>): string => {
        const { translations } = get();
        let value = getNestedValue(translations, key);

        // Fallback to key if not found
        if (!value) return key;

        // Replace params like {count}, {name}, etc.
        if (params) {
          Object.entries(params).forEach(([k, v]) => {
            value = value?.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
          });
        }

        return value || key;
      },
    }),
    {
      name: 'shophub-translation',
      partialize: (s) => ({ language: s.language }),
      onRehydrateStorage: () => async (state) => {
        // Re-load translations on page reload
        if (state?.language) {
          const lang = LANGUAGES.find((l) => l.code === state.language);
          if (lang) {
            const translations = await loadTranslations(state.language);
            if (typeof document !== 'undefined' && document.documentElement) {
              document.documentElement.dir = lang.rtl ? 'rtl' : 'ltr';
              document.documentElement.lang = state.language;
            }
            state.translations = translations;
          }
        }
      },
    },
  ),
);

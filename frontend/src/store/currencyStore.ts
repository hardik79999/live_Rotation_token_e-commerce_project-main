/**
 * currencyStore.ts — Global multi-currency + language/locale state.
 *
 * - Persists the user's chosen currency & language to localStorage
 * - Fetches live exchange rates from /api/currency/rates on first load
 * - All prices in the app are stored as INR; conversion happens at render time
 * - RTL languages automatically set document direction
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '@/api/axios';
import { CURRENCY } from '@/api/routes';

// ── Supported currencies (20+) ────────────────────────────────
export type CurrencyCode =
  | 'INR' | 'USD' | 'EUR' | 'GBP' | 'JPY' | 'AED' | 'SAR' | 'CAD'
  | 'AUD' | 'CHF' | 'CNY' | 'SGD' | 'MYR' | 'BDT' | 'PKR' | 'LKR'
  | 'NPR' | 'THB' | 'IDR' | 'KRW' | 'BRL' | 'MXN' | 'ZAR' | 'NGN';

export interface CurrencyMeta {
  code:   CurrencyCode;
  symbol: string;
  label:  string;
  flag:   string;
  locale: string;
}

export const CURRENCIES: CurrencyMeta[] = [
  { code: 'INR', symbol: '₹',  label: 'Indian Rupee',        flag: '🇮🇳', locale: 'en-IN' },
  { code: 'USD', symbol: '$',  label: 'US Dollar',            flag: '🇺🇸', locale: 'en-US' },
  { code: 'EUR', symbol: '€',  label: 'Euro',                 flag: '🇪🇺', locale: 'de-DE' },
  { code: 'GBP', symbol: '£',  label: 'British Pound',        flag: '🇬🇧', locale: 'en-GB' },
  { code: 'JPY', symbol: '¥',  label: 'Japanese Yen',         flag: '🇯🇵', locale: 'ja-JP' },
  { code: 'AED', symbol: 'د.إ',label: 'UAE Dirham',           flag: '🇦🇪', locale: 'ar-AE' },
  { code: 'SAR', symbol: '﷼',  label: 'Saudi Riyal',          flag: '🇸🇦', locale: 'ar-SA' },
  { code: 'CAD', symbol: 'C$', label: 'Canadian Dollar',      flag: '🇨🇦', locale: 'en-CA' },
  { code: 'AUD', symbol: 'A$', label: 'Australian Dollar',    flag: '🇦🇺', locale: 'en-AU' },
  { code: 'CHF', symbol: 'Fr', label: 'Swiss Franc',          flag: '🇨🇭', locale: 'de-CH' },
  { code: 'CNY', symbol: '¥',  label: 'Chinese Yuan',         flag: '🇨🇳', locale: 'zh-CN' },
  { code: 'SGD', symbol: 'S$', label: 'Singapore Dollar',     flag: '��🇬', locale: 'en-SG' },
  { code: 'MYR', symbol: 'RM', label: 'Malaysian Ringgit',    flag: '🇲🇾', locale: 'ms-MY' },
  { code: 'BDT', symbol: '৳',  label: 'Bangladeshi Taka',     flag: '🇧🇩', locale: 'bn-BD' },
  { code: 'PKR', symbol: '₨',  label: 'Pakistani Rupee',      flag: '🇵🇰', locale: 'ur-PK' },
  { code: 'LKR', symbol: '₨',  label: 'Sri Lankan Rupee',     flag: '🇱🇰', locale: 'si-LK' },
  { code: 'NPR', symbol: '₨',  label: 'Nepalese Rupee',       flag: '🇳🇵', locale: 'ne-NP' },
  { code: 'THB', symbol: '฿',  label: 'Thai Baht',            flag: '🇹🇭', locale: 'th-TH' },
  { code: 'IDR', symbol: 'Rp', label: 'Indonesian Rupiah',    flag: '🇮🇩', locale: 'id-ID' },
  { code: 'KRW', symbol: '₩',  label: 'South Korean Won',     flag: '🇰🇷', locale: 'ko-KR' },
  { code: 'BRL', symbol: 'R$', label: 'Brazilian Real',       flag: '🇧🇷', locale: 'pt-BR' },
  { code: 'MXN', symbol: 'MX$',label: 'Mexican Peso',         flag: '🇲🇽', locale: 'es-MX' },
  { code: 'ZAR', symbol: 'R',  label: 'South African Rand',   flag: '🇿🇦', locale: 'en-ZA' },
  { code: 'NGN', symbol: '₦',  label: 'Nigerian Naira',       flag: '🇳🇬', locale: 'en-NG' },
];

// ── Supported languages ───────────────────────────────────────
export type LangCode =
  | 'en' | 'hi' | 'ar' | 'fr' | 'de' | 'es' | 'pt' | 'zh'
  | 'ja' | 'ko' | 'ru' | 'tr' | 'id' | 'ms' | 'th' | 'bn'
  | 'ur' | 'ta' | 'te' | 'mr';

export interface LangMeta {
  code:    LangCode;
  label:   string;       // native name
  english: string;       // English name
  flag:    string;
  rtl:     boolean;
  locale:  string;
}

export const LANGUAGES: LangMeta[] = [
  { code: 'en', label: 'English',    english: 'English',    flag: '🇺🇸', rtl: false, locale: 'en-US' },
  { code: 'hi', label: 'हिन्दी',      english: 'Hindi',      flag: '🇮🇳', rtl: false, locale: 'hi-IN' },
  { code: 'ar', label: 'العربية',    english: 'Arabic',     flag: '🇸🇦', rtl: true,  locale: 'ar-SA' },
  { code: 'fr', label: 'Français',   english: 'French',     flag: '🇫🇷', rtl: false, locale: 'fr-FR' },
  { code: 'de', label: 'Deutsch',    english: 'German',     flag: '🇩🇪', rtl: false, locale: 'de-DE' },
  { code: 'es', label: 'Español',    english: 'Spanish',    flag: '🇪🇸', rtl: false, locale: 'es-ES' },
  { code: 'pt', label: 'Português',  english: 'Portuguese', flag: '🇧🇷', rtl: false, locale: 'pt-BR' },
  { code: 'zh', label: '中文',        english: 'Chinese',    flag: '🇨🇳', rtl: false, locale: 'zh-CN' },
  { code: 'ja', label: '日本語',      english: 'Japanese',   flag: '🇯🇵', rtl: false, locale: 'ja-JP' },
  { code: 'ko', label: '한국어',      english: 'Korean',     flag: '🇰🇷', rtl: false, locale: 'ko-KR' },
  { code: 'ru', label: 'Русский',    english: 'Russian',    flag: '🇷🇺', rtl: false, locale: 'ru-RU' },
  { code: 'tr', label: 'Türkçe',     english: 'Turkish',    flag: '🇹🇷', rtl: false, locale: 'tr-TR' },
  { code: 'id', label: 'Indonesia',  english: 'Indonesian', flag: '🇮🇩', rtl: false, locale: 'id-ID' },
  { code: 'ms', label: 'Melayu',     english: 'Malay',      flag: '🇲🇾', rtl: false, locale: 'ms-MY' },
  { code: 'th', label: 'ภาษาไทย',    english: 'Thai',       flag: '🇹🇭', rtl: false, locale: 'th-TH' },
  { code: 'bn', label: 'বাংলা',       english: 'Bengali',    flag: '🇧🇩', rtl: false, locale: 'bn-BD' },
  { code: 'ur', label: 'اردو',       english: 'Urdu',       flag: '🇵🇰', rtl: true,  locale: 'ur-PK' },
  { code: 'ta', label: 'தமிழ்',       english: 'Tamil',      flag: '🇮🇳', rtl: false, locale: 'ta-IN' },
  { code: 'te', label: 'తెలుగు',      english: 'Telugu',     flag: '🇮🇳', rtl: false, locale: 'te-IN' },
  { code: 'mr', label: 'मराठी',       english: 'Marathi',    flag: '🇮🇳', rtl: false, locale: 'mr-IN' },
];

// Rates: 1 INR = X foreign currency
export type ExchangeRates = Partial<Record<CurrencyCode, number>>;

const DEFAULT_RATES: ExchangeRates = {
  INR: 1,
  USD: 0.012,
  EUR: 0.011,
  GBP: 0.0095,
  JPY: 1.78,
  AED: 0.044,
  SAR: 0.045,
  CAD: 0.016,
  AUD: 0.018,
  CHF: 0.011,
  CNY: 0.087,
  SGD: 0.016,
  MYR: 0.056,
  BDT: 1.32,
  PKR: 3.34,
  LKR: 3.65,
  NPR: 1.60,
  THB: 0.43,
  IDR: 195,
  KRW: 16.3,
  BRL: 0.062,
  MXN: 0.20,
  ZAR: 0.22,
  NGN: 19.5,
};

interface CurrencyState {
  currency:  CurrencyCode;
  language:  LangCode;
  rates:     ExchangeRates;
  loading:   boolean;
  lastFetch: number | null;

  setCurrency:  (code: CurrencyCode) => void;
  setLanguage:  (code: LangCode) => void;
  fetchRates:   () => Promise<void>;
}

export const useCurrencyStore = create<CurrencyState>()(
  persist(
    (set, get) => ({
      currency:  'INR',
      language:  'en',
      rates:     DEFAULT_RATES,
      loading:   false,
      lastFetch: null,

      setCurrency: (code) => set({ currency: code }),

      setLanguage: (code) => {
        const lang = LANGUAGES.find((l) => l.code === code);
        if (lang) {
          // Apply RTL direction to the document
          document.documentElement.dir  = lang.rtl ? 'rtl' : 'ltr';
          document.documentElement.lang = lang.locale;
        }
        set({ language: code });
      },

      fetchRates: async () => {
        const { lastFetch, loading } = get();
        if (loading) return;
        if (lastFetch && Date.now() - lastFetch < 6 * 60 * 60 * 1000) return;

        set({ loading: true });
        try {
          const res = await api.get<{
            success: boolean;
            data: { base: string; rates: ExchangeRates };
          }>(CURRENCY.RATES);

          if (res.data.success && res.data.data?.rates) {
            set({ rates: res.data.data.rates, lastFetch: Date.now() });
          }
        } catch {
          // Silently keep existing rates
        } finally {
          set({ loading: false });
        }
      },
    }),
    {
      name: 'shophub-currency',
      partialize: (s) => ({
        currency:  s.currency,
        language:  s.language,
        rates:     s.rates,
        lastFetch: s.lastFetch,
      }),
      onRehydrateStorage: () => (state) => {
        // Re-apply RTL direction on page reload
        if (state?.language) {
          const lang = LANGUAGES.find((l) => l.code === state.language);
          if (lang) {
            document.documentElement.dir  = lang.rtl ? 'rtl' : 'ltr';
            document.documentElement.lang = lang.locale;
          }
        }
      },
    },
  ),
);

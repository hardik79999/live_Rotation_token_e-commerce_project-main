/**
 * useCurrency — convenience hook for currency-aware price formatting + language.
 *
 * Usage:
 *   const { fmt, currency, setCurrency, language, setLanguage } = useCurrency();
 *   fmt(product.price)   // "₹1,29,999" | "$1,560" | "€1,430" | "£1,220"
 */
import { useCallback } from 'react';
import {
  useCurrencyStore,
  CURRENCIES,
  LANGUAGES,
  type CurrencyCode,
  type LangCode,
} from '@/store/currencyStore';

export function useCurrency() {
  const { currency, language, rates, setCurrency, setLanguage } = useCurrencyStore();

  const meta     = CURRENCIES.find((c) => c.code === currency) ?? CURRENCIES[0];
  const langMeta = LANGUAGES.find((l) => l.code === language)  ?? LANGUAGES[0];

  /**
   * Convert a price stored in INR to the active currency and format it.
   * @param inrAmount  — the raw INR value from the backend
   * @param decimals   — override decimal places (default: 0 for INR, 2 for others)
   */
  const fmt = useCallback(
    (inrAmount: number | null | undefined, decimals?: number): string => {
      const safe = (typeof inrAmount === 'number' && isFinite(inrAmount)) ? inrAmount : 0;
      const rate           = rates[currency] ?? 1;
      const converted      = safe * rate;
      const fractionDigits = decimals ?? (currency === 'INR' ? 0 : 2);

      try {
        return new Intl.NumberFormat(meta.locale, {
          style:                 'currency',
          currency:              currency,
          maximumFractionDigits: fractionDigits,
          minimumFractionDigits: fractionDigits,
        }).format(converted);
      } catch {
        // Fallback for unsupported locales
        return `${meta.symbol}${converted.toFixed(fractionDigits)}`;
      }
    },
    [currency, rates, meta.locale, meta.symbol],
  );

  return {
    fmt,
    currency,
    language,
    meta,
    langMeta,
    rates,
    isRTL: langMeta.rtl,
    setCurrency: (code: CurrencyCode) => setCurrency(code),
    setLanguage: (code: LangCode)     => setLanguage(code),
    allCurrencies: CURRENCIES,
    allLanguages:  LANGUAGES,
  };
}

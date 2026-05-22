/**
 * translateField — handles both plain strings and multilingual objects.
 *
 * Supports two data shapes from the API:
 *   1. Plain string:  "Running Shoes"
 *   2. i18n object:  { "en": "Running Shoes", "hi": "दौड़ने के जूते" }
 *
 * Usage:
 *   translateField(product.name, 'hi')   // "दौड़ने के जूते" or "Running Shoes" fallback
 *   translateField("Plain text", 'hi')   // "Plain text" (passthrough)
 */

export type TranslatableField = string | Record<string, string> | null | undefined;

export function translateField(
  field: TranslatableField,
  lang: string,
  fallbackLang = 'en',
): string {
  if (!field) return '';

  // Plain string — return as-is
  if (typeof field === 'string') return field;

  // i18n object — pick requested lang, fallback to English, then first available
  if (typeof field === 'object') {
    return (
      field[lang] ||
      field[fallbackLang] ||
      Object.values(field)[0] ||
      ''
    );
  }

  return '';
}

/**
 * useTranslateField — convenience wrapper that reads current language from store.
 * Use this in components instead of calling translateField directly.
 *
 * Usage:
 *   const tf = useTranslateField();
 *   tf(product.name)   // auto-picks current language
 */
import { useTranslationStore } from '@/store/translationStore';

export function useTranslateField() {
  const language = useTranslationStore((s) => s.language);
  return (field: TranslatableField) => translateField(field, language);
}

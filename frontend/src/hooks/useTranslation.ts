/**
 * useTranslation — convenience hook for i18n.
 *
 * Usage:
 *   const { t, language, setLanguage, langMeta } = useTranslation();
 *   t('nav.search_placeholder')   // "Search products..." | "उत्पाद खोजें..."
 *   t('products.clear_filters', { count: 3 })  // "Clear 3 filters"
 */
import { useCallback, useEffect } from 'react';
import { useTranslationStore, LANGUAGES, type LangCode } from '@/store/translationStore';

export function useTranslation() {
  const { language, translations, loading, setLanguage: setLang, t: translate } = useTranslationStore();

  const langMeta = LANGUAGES.find((l) => l.code === language) ?? LANGUAGES[0];

  // Load translations on mount if not loaded
  useEffect(() => {
    if (Object.keys(translations).length === 0 && !loading) {
      setLang(language);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const setLanguage = useCallback(
    async (code: LangCode) => {
      await setLang(code);
    },
    [setLang],
  );

  return {
    t: translate,
    language,
    langMeta,
    isRTL: langMeta.rtl,
    setLanguage,
    allLanguages: LANGUAGES,
    loading,
  };
}

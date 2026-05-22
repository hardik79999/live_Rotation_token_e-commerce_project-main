/**
 * LanguageSelector — standalone language picker for the Navbar (left side).
 * Completely separate from CurrencySelector.
 */
import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Search, Check, Globe } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/utils/cn';

export function LanguageSelector() {
  const { language, langMeta, setLanguage, allLanguages, t } = useTranslation();

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); setSearch(''); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // Focus search when panel opens
  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 80);
    else setSearch('');
  }, [open]);

  const filtered = allLanguages.filter((l) =>
    !search ||
    l.code.toLowerCase().includes(search.toLowerCase()) ||
    l.label.toLowerCase().includes(search.toLowerCase()) ||
    l.english.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium transition-colors select-none',
          open ? 'bg-gray-700 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white',
        )}
        aria-label="Select language"
        aria-expanded={open}
      >
        <Globe size={14} className="shrink-0" />
        <span className="text-base leading-none">{langMeta.flag}</span>
        <span className="hidden sm:inline text-xs tracking-wide">{langMeta.english}</span>
        <ChevronDown size={12} className={cn('transition-transform duration-200', open && 'rotate-180')} />
      </button>

      {/* Panel */}
      {open && (
        <div className="absolute left-0 mt-2 w-64 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-slate-700 overflow-hidden z-50">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700">
            <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Globe size={12} />
              {t('language.select')}
            </p>
          </div>

          {/* Search */}
          <div className="px-3 py-2 border-b border-gray-100 dark:border-slate-700">
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 pointer-events-none" />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('language.search')}
                className="w-full pl-7 pr-3 py-1.5 text-xs bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg focus:outline-none focus:border-orange-400 dark:focus:border-orange-500 text-gray-800 dark:text-slate-100 transition-colors"
              />
            </div>
          </div>

          {/* List */}
          <div className="max-h-64 overflow-y-auto overscroll-contain">
            {filtered.length === 0 ? (
              <p className="text-center text-xs text-gray-400 dark:text-slate-500 py-6">
                {t('language.none_found')}
              </p>
            ) : (
              filtered.map((l) => {
                const isActive = l.code === language;
                return (
                  <button
                    key={l.code}
                    onClick={() => { setLanguage(l.code); setOpen(false); setSearch(''); }}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-left',
                      isActive
                        ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400'
                        : 'text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700',
                    )}
                  >
                    <span className="text-lg leading-none w-6 text-center shrink-0">{l.flag}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-xs">{l.label}</span>
                        {l.rtl && (
                          <span className="text-[10px] bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 px-1 py-0.5 rounded font-medium">RTL</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 dark:text-slate-500 truncate">{l.english}</p>
                    </div>
                    {isActive && <Check size={13} className="text-orange-500 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

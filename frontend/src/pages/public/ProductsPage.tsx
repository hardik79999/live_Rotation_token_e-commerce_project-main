import { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, X, Package, Sparkles, Search, ArrowUpDown, Tag, Filter, ChevronDown, Check } from 'lucide-react';
import { browseApi } from '@/api/user';
import type { Product, Category } from '@/types';
import { ProductCard } from '@/components/product/ProductCard';
import { ProductGridSkeleton } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/Button';
import { cn } from '@/utils/cn';
import { useCurrency } from '@/hooks/useCurrency';
import { useTranslation } from '@/hooks/useTranslation';

const SORT_OPTIONS = [
  { value: 'newest',            label: 'Newest First' },
  { value: 'price_low_to_high', label: 'Price: Low → High' },
  { value: 'price_high_to_low', label: 'Price: High → Low' },
];

// Truncate long search strings for display only
function truncateSearch(s: string, max = 40) {
  return s.length <= max ? s : s.slice(0, max) + '…';
}

// ── Debounce hook ─────────────────────────────────────────────
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ── Toggle switch ─────────────────────────────────────────────
function ToggleSwitch({ checked, onChange, label }: {
  checked: boolean; onChange: (v: boolean) => void; label: string;
}) {
  return (
    <label className="flex items-center justify-between cursor-pointer group">
      <span className="text-sm text-gray-700 dark:text-slate-300 group-hover:text-gray-900 dark:group-hover:text-slate-100 transition-colors">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative w-10 h-5 rounded-full transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500',
          checked ? 'bg-orange-500' : 'bg-gray-200 dark:bg-slate-600',
        )}
      >
        <span className={cn(
          'absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-300',
          checked ? 'translate-x-5' : 'translate-x-0',
        )} />
      </button>
    </label>
  );
}

// ── Custom Sort Dropdown ──────────────────────────────────────
function SortDropdown({ value, onChange, options }: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex items-center gap-2 border rounded-xl pl-3 pr-2.5 py-2 text-sm transition-all bg-gray-50 dark:bg-slate-800 cursor-pointer select-none',
          open
            ? 'border-orange-400 dark:border-orange-500 ring-2 ring-orange-400/20 text-gray-900 dark:text-slate-100'
            : 'border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:border-orange-300 dark:hover:border-orange-600',
        )}
      >
        <ArrowUpDown size={12} className="text-gray-400 dark:text-slate-500 shrink-0" />
        <span className="whitespace-nowrap">{selected.label}</span>
        <ChevronDown size={13} className={cn('text-gray-400 dark:text-slate-500 transition-transform duration-200 shrink-0', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute right-0 mt-1.5 w-52 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-700 overflow-hidden z-30 animate-in fade-in slide-in-from-top-2 duration-150">
          {options.map((opt) => {
            const isActive = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className={cn(
                  'w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors text-left',
                  isActive
                    ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 font-medium'
                    : 'text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700',
                )}
              >
                {opt.label}
                {isActive && <Check size={13} className="text-orange-500 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Modern Number Input with +/- buttons ──────────────────────
function NumberInput({ value, onChange, placeholder, symbol }: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  symbol: string;
}) {
  const num = parseFloat(value) || 0;
  const increment = () => onChange(String(num + 100));
  const decrement = () => onChange(String(Math.max(0, num - 100)));

  return (
    <div className="flex items-stretch h-9 rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 focus-within:border-orange-400 dark:focus-within:border-orange-500 transition-colors overflow-hidden w-full">
      <button
        type="button"
        onClick={decrement}
        className="w-9 shrink-0 flex items-center justify-center text-gray-500 dark:text-slate-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-500/10 transition-colors border-r border-gray-200 dark:border-slate-600 font-bold text-base"
      >
        −
      </button>
      <div className="flex items-center flex-1 min-w-0 px-1.5 gap-0.5">
        <span className="text-gray-400 dark:text-slate-500 text-xs shrink-0">{symbol}</span>
        <input
          type="number"
          min={0}
          step={100}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full text-xs bg-transparent text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
      </div>
      <button
        type="button"
        onClick={increment}
        className="w-9 shrink-0 flex items-center justify-center text-gray-500 dark:text-slate-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-500/10 transition-colors border-l border-gray-200 dark:border-slate-600 font-bold text-base"
      >
        +
      </button>
    </div>
  );
}

// ── Price range filter ────────────────────────────────────────
function PriceRangeFilter({ min, max, onChange, symbol, t }: {
  min: string; max: string;
  onChange: (min: string, max: string) => void;
  symbol: string;
  t: (key: string) => string;
}) {
  const [localMin, setLocalMin] = useState(min);
  const [localMax, setLocalMax] = useState(max);
  useEffect(() => { setLocalMin(min); }, [min]);
  useEffect(() => { setLocalMax(max); }, [max]);
  const commit = () => onChange(localMin, localMax);

  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
        <Tag size={10} /> {t('products.price_range')}
      </p>

      {/* Stacked layout — Min on top, Max below */}
      <div className="space-y-2">
        <div>
          <p className="text-[10px] text-gray-400 dark:text-slate-500 mb-1 ml-0.5">Min</p>
          <NumberInput
            value={localMin}
            onChange={(v) => setLocalMin(v)}
            placeholder="0"
            symbol={symbol}
          />
        </div>
        <div>
          <p className="text-[10px] text-gray-400 dark:text-slate-500 mb-1 ml-0.5">Max</p>
          <NumberInput
            value={localMax}
            onChange={(v) => setLocalMax(v)}
            placeholder="Any"
            symbol={symbol}
          />
        </div>
      </div>

      {(localMin || localMax) && (
        <div className="flex items-center gap-3 mt-2">
          <button
            onClick={commit}
            className="text-xs text-orange-500 hover:text-orange-600 font-semibold transition-colors"
          >
            Apply
          </button>
          <button
            onClick={() => { setLocalMin(''); setLocalMax(''); onChange('', ''); }}
            className="text-xs text-gray-400 hover:text-red-400 transition-colors"
          >
            {t('products.clear_price')}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Zero results state ────────────────────────────────────────
function ZeroResultsState({ search, onClear, t }: { search: string; onClear: () => void; t: (key: string) => string }) {
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    browseApi.getProducts({ limit: 4, sort_by: 'newest' })
      .then((r) => setSuggestions(r.data.data?.slice(0, 4) ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-8">
      <div className="text-center py-16 bg-white dark:bg-slate-800/60 rounded-2xl border border-dashed border-gray-200 dark:border-slate-700">
        <div className="w-16 h-16 bg-gray-100 dark:bg-slate-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Package size={28} className="text-gray-400 dark:text-slate-500" />
        </div>
        <p className="text-lg font-bold text-gray-800 dark:text-slate-200 px-4">
          {t('products.no_results_title')}{' '}
          {search
            ? <span className="text-orange-500 break-all">"{truncateSearch(search)}"</span>
            : t('products.no_results_filters')}
        </p>
        <p className="text-sm text-gray-400 dark:text-slate-500 mt-1 mb-5">
          {t('products.no_results_sub')}
        </p>
        {search && (
          <Button variant="outline" size="sm" onClick={onClear}>
            <X size={14} /> {t('products.clear_search')}
          </Button>
        )}
      </div>
      <div>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 bg-orange-100 dark:bg-orange-500/15 rounded-lg flex items-center justify-center">
            <Sparkles size={14} className="text-orange-500" />
          </div>
          <h3 className="text-base font-bold text-gray-900 dark:text-slate-100">{t('products.you_might_like')}</h3>
        </div>
        {loading ? <ProductGridSkeleton count={4} /> : (
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
            {suggestions.map((p) => <ProductCard key={p.uuid} product={p} />)}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Smart pagination ──────────────────────────────────────────
function Pagination({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (p: number) => void }) {
  const items: (number | string)[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) items.push(i);
  } else {
    items.push(1);
    if (page > 3) items.push('s');
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) items.push(i);
    if (page < totalPages - 2) items.push('e');
    items.push(totalPages);
  }

  return (
    <div className="flex items-center justify-center gap-1.5 mt-10 flex-wrap">
      <button disabled={page <= 1} onClick={() => onPage(page - 1)}
        className="w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 dark:border-slate-600 text-gray-500 dark:text-slate-400 hover:border-orange-400 hover:text-orange-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
        <ChevronLeft size={16} />
      </button>
      {items.map((p, i) =>
        typeof p === 'string' ? (
          <span key={`e${i}`} className="w-9 h-9 flex items-center justify-center text-gray-400 dark:text-slate-500 text-sm">…</span>
        ) : (
          <button key={p} onClick={() => onPage(p)}
            className={cn('w-9 h-9 rounded-xl text-sm font-medium transition-all active:scale-95',
              p === page
                ? 'bg-orange-500 text-white shadow-md shadow-orange-200 dark:shadow-orange-900/40'
                : 'border border-gray-200 dark:border-slate-600 text-gray-700 dark:text-slate-300 hover:border-orange-400 hover:text-orange-500 bg-white dark:bg-slate-800',
            )}>
            {p}
          </button>
        )
      )}
      <button disabled={page >= totalPages} onClick={() => onPage(page + 1)}
        className="w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 dark:border-slate-600 text-gray-500 dark:text-slate-400 hover:border-orange-400 hover:text-orange-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
        <ChevronRight size={16} />
      </button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────
export function ProductsPage() {
  const { meta: currencyMeta, isRTL } = useCurrency();
  const { t } = useTranslation();

  const SORT_OPTIONS = [
    { value: 'newest',            label: t('products.sort_newest') },
    { value: 'price_low_to_high', label: t('products.sort_price_low') },
    { value: 'price_high_to_low', label: t('products.sort_price_high') },
  ];

  const [searchParams, setSearchParams] = useSearchParams();
  const [products,     setProducts]     = useState<Product[]>([]);
  const [categories,   setCategories]   = useState<Category[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [totalPages,   setTotalPages]   = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const [catSearch,    setCatSearch]    = useState('');

  const page     = parseInt(searchParams.get('page')      || '1');
  const search   = searchParams.get('search')   || '';
  const category = searchParams.get('category') || '';
  const sortBy   = searchParams.get('sort_by')  || 'newest';
  const minPrice = searchParams.get('min_price') || '';
  const maxPrice = searchParams.get('max_price') || '';
  const inStock  = searchParams.get('in_stock')  || '';

  // Local search — max 100 chars, debounced 500ms
  const [searchInput, setSearchInput] = useState(search);
  const debouncedSearch = useDebounce(searchInput, 500);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    const next = new URLSearchParams(searchParams);
    if (debouncedSearch) next.set('search', debouncedSearch); else next.delete('search');
    next.set('page', '1');
    setSearchParams(next, { replace: true });
  }, [debouncedSearch]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setSearchInput(search); }, [search]);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit: 12, sort_by: sortBy };
      if (search)   params.search    = search;
      if (category) params.category  = category;
      if (minPrice) params.min_price = minPrice;
      if (maxPrice) params.max_price = maxPrice;
      if (inStock)  params.in_stock  = inStock;
      const res = await browseApi.getProducts(params);
      setProducts(res.data.data || []);
      setTotalPages(res.data.total_pages || 1);
      setTotalResults(res.data.total_results || 0);
    } finally {
      setLoading(false);
    }
  }, [page, search, category, sortBy, minPrice, maxPrice, inStock]);

  useEffect(() => { browseApi.getCategories().then((r) => setCategories(r.data.data || [])); }, []);
  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value); else next.delete(key);
    next.set('page', '1');
    setSearchParams(next);
  };

  const updatePriceRange = (min: string, max: string) => {
    const next = new URLSearchParams(searchParams);
    if (min) next.set('min_price', min); else next.delete('min_price');
    if (max) next.set('max_price', max); else next.delete('max_price');
    next.set('page', '1');
    setSearchParams(next);
  };

  const setPage = (p: number) => {
    const next = new URLSearchParams(searchParams);
    next.set('page', String(p));
    setSearchParams(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const clearAllFilters = () => {
    const next = new URLSearchParams();
    if (search) next.set('search', search);
    next.set('sort_by', sortBy);
    setSearchParams(next);
  };

  const activeFilters = [category, minPrice, maxPrice, inStock].filter(Boolean).length;
  const selectedCategory = categories.find((c) => c.uuid === category);
  const filteredCategories = catSearch
    ? categories.filter((c) => c.name.toLowerCase().includes(catSearch.toLowerCase()))
    : categories;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950" dir={isRTL ? 'rtl' : 'ltr'}>

      {/* ── Header ── */}
      <div className="bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:py-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">

            {/* Title + count */}
            <div className="min-w-0 flex-1">
              <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2 flex-wrap">
                {selectedCategory?.icon && <span className="text-xl shrink-0">{selectedCategory.icon}</span>}
                <span className="truncate max-w-xs sm:max-w-md">
                  {search
                    ? <><span className="text-gray-500 dark:text-slate-400 font-normal text-base">{t('products.results_for')} </span><span className="text-orange-500">"{truncateSearch(search)}"</span></>
                    : selectedCategory ? selectedCategory.name : t('products.all_products')}
                </span>
              </h1>
              {!loading && (
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                  {totalResults.toLocaleString()} {totalResults === 1 ? t('products.product_found') : t('products.products_found')}
                </p>
              )}
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              {/* Search — fixed width, truncates internally */}
              <div className="relative w-40 sm:w-48">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 pointer-events-none" />
                <input
                  type="text"
                  placeholder={t('products.search_placeholder')}
                  value={searchInput}
                  maxLength={100}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="w-full border border-gray-200 dark:border-slate-700 rounded-xl pl-7 pr-7 py-2 text-sm focus:outline-none focus:border-orange-400 dark:focus:border-orange-500 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-slate-100 transition-all overflow-hidden text-ellipsis"
                />
                {searchInput && (
                  <button onClick={() => { setSearchInput(''); updateParam('search', ''); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 transition-colors">
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* Sort — custom dropdown */}
              <SortDropdown value={sortBy} onChange={(v) => updateParam('sort_by', v)} options={SORT_OPTIONS} />
            </div>
          </div>

          {/* Active filter chips */}
          {activeFilters > 0 && (
            <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-slate-800">
              <span className="text-xs text-gray-400 dark:text-slate-500 flex items-center gap-1 shrink-0">
                <Filter size={11} /> {t('products.filters')}:
              </span>
              {selectedCategory && (
                <span className="inline-flex items-center gap-1 bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-500/30 text-xs font-medium px-2.5 py-1 rounded-full">
                  {selectedCategory.icon} {selectedCategory.name}
                  <button onClick={() => updateParam('category', '')}><X size={10} /></button>
                </span>
              )}
              {(minPrice || maxPrice) && (
                <span className="inline-flex items-center gap-1 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30 text-xs font-medium px-2.5 py-1 rounded-full">
                  {currencyMeta.symbol}{minPrice || '0'} – {currencyMeta.symbol}{maxPrice || '∞'}
                  <button onClick={() => updatePriceRange('', '')}><X size={10} /></button>
                </span>
              )}
              {inStock && (
                <span className="inline-flex items-center gap-1 bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-500/30 text-xs font-medium px-2.5 py-1 rounded-full">
                  {t('products.in_stock')} <button onClick={() => updateParam('in_stock', '')}><X size={10} /></button>
                </span>
              )}
              <button onClick={clearAllFilters} className="text-xs text-red-500 hover:text-red-600 font-medium transition-colors">
                {t('products.clear_all')}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="max-w-7xl mx-auto px-4 py-5">

        {/* Mobile category pills */}
        <div className="lg:hidden flex gap-2 overflow-x-auto pb-3 mb-4 scrollbar-hide -mx-4 px-4">
          <button onClick={() => updateParam('category', '')}
            className={cn('shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all active:scale-95',
              !category ? 'bg-orange-500 text-white border-orange-500 shadow-sm' : 'border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400 bg-white dark:bg-slate-800')}>
            {t('products.all_categories')}
          </button>
          {categories.map((cat) => (
            <button key={cat.uuid} onClick={() => updateParam('category', cat.uuid)}
              className={cn('shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all active:scale-95 whitespace-nowrap flex items-center gap-1.5',
                category === cat.uuid ? 'bg-orange-500 text-white border-orange-500 shadow-sm' : 'border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400 bg-white dark:bg-slate-800')}>
              {cat.icon && <span className="text-sm leading-none">{cat.icon}</span>}
              {cat.name}
            </button>
          ))}
        </div>

        <div className="flex gap-5">

          {/* ── Sidebar ── */}
          <aside className="hidden lg:block w-56 shrink-0">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 overflow-hidden sticky top-24 shadow-sm">

              {/* Categories */}
              <div className="p-3 border-b border-gray-100 dark:border-slate-800">
                <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wide mb-2 px-1">{t('products.categories')}</p>

                {/* Category search input */}
                <div className="relative mb-2">
                  <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 pointer-events-none" />
                  <input
                    type="text"
                    placeholder={t('products.search_categories')}
                    value={catSearch}
                    onChange={(e) => setCatSearch(e.target.value)}
                    className="w-full pl-7 pr-7 py-1.5 text-xs border border-gray-200 dark:border-slate-600 rounded-lg bg-gray-50 dark:bg-slate-800 text-gray-800 dark:text-slate-100 focus:outline-none focus:border-orange-400 dark:focus:border-orange-500 transition-colors"
                  />
                  {catSearch && (
                    <button onClick={() => setCatSearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300">
                      <X size={11} />
                    </button>
                  )}
                </div>

                {/* Category list */}
                <ul className="space-y-0.5 max-h-52 overflow-y-auto overscroll-contain">
                  {!catSearch && (
                    <li>
                      <button onClick={() => updateParam('category', '')}
                        className={cn('w-full text-left px-2.5 py-1.5 rounded-xl text-xs transition-all font-medium',
                          !category ? 'bg-orange-500 text-white shadow-sm' : 'text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800')}>
                        {t('products.all_categories')}
                      </button>
                    </li>
                  )}
                  {filteredCategories.length === 0 && (
                    <li className="text-xs text-gray-400 dark:text-slate-500 text-center py-3">{t('products.no_categories')}</li>
                  )}
                  {filteredCategories.map((cat) => (
                    <li key={cat.uuid}>
                      <button onClick={() => { updateParam('category', cat.uuid); setCatSearch(''); }}
                        className={cn('w-full text-left px-2.5 py-1.5 rounded-xl text-xs transition-all flex items-center gap-2',
                          category === cat.uuid ? 'bg-orange-500 text-white font-medium shadow-sm' : 'text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800')}>
                        {cat.icon && <span className="text-sm leading-none shrink-0">{cat.icon}</span>}
                        <span className="truncate">{cat.name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Price range */}
              <div className="p-3 border-b border-gray-100 dark:border-slate-800">
                <PriceRangeFilter min={minPrice} max={maxPrice} onChange={updatePriceRange} symbol={currencyMeta.symbol} t={t} />
              </div>

              {/* In stock */}
              <div className="p-3">
                <ToggleSwitch checked={inStock === '1'} onChange={(v) => updateParam('in_stock', v ? '1' : '')} label={t('products.in_stock_only')} />
              </div>

              {/* Clear filters */}
              {activeFilters > 0 && (
                <div className="px-3 pb-3">
                  <button onClick={clearAllFilters}
                    className="w-full text-xs font-medium text-red-500 hover:text-red-600 border border-red-200 dark:border-red-500/30 rounded-xl py-2 transition-colors hover:bg-red-50 dark:hover:bg-red-500/5">
                    {activeFilters === 1 ? t('products.clear_filters').replace('{count}', '1') : t('products.clear_filters_plural').replace('{count}', String(activeFilters))}
                  </button>
                </div>
              )}
            </div>
          </aside>

          {/* ── Product grid ── */}
          <div className="flex-1 min-w-0">
            {loading ? (
              <ProductGridSkeleton count={12} />
            ) : products.length === 0 ? (
              <ZeroResultsState search={search} onClear={() => { setSearchInput(''); updateParam('search', ''); }} t={t} />
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                  {products.map((p) => <ProductCard key={p.uuid} product={p} onCartUpdate={() => {}} />)}
                </div>
                {totalPages > 1 && <Pagination page={page} totalPages={totalPages} onPage={setPage} />}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

import { Link, useNavigate } from 'react-router-dom';
import {
  ShoppingCart, Heart, User, Search, Menu, X,
  Package, LayoutDashboard, LogOut, Tag, Wallet,
  Zap, TrendingUp,
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useCartStore } from '@/store/cartStore';
import { authApi } from '@/api/auth';
import { useSearch } from '@/hooks/useSearch';
import { useCurrencyStore } from '@/store/currencyStore';
import { useTranslation } from '@/hooks/useTranslation';
import { useTranslateField } from '@/utils/translate';
import { CurrencySelector } from '@/components/ui/CurrencySelector';
import { LanguageSelector } from '@/components/ui/LanguageSelector';
import toast from 'react-hot-toast';
import { cn } from '@/utils/cn';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { formatPrice, getImageUrl } from '@/utils/image';
import type { Product } from '@/types';

export function Navbar() {
  const { user, isAuthenticated, clearUser } = useAuthStore();
  const { itemCount } = useCartStore();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const tf = useTranslateField();

  // ── Fetch exchange rates once on mount ────────────────────
  const fetchRates = useCurrencyStore((s) => s.fetchRates);
  useEffect(() => { fetchRates(); }, [fetchRates]);

  // ── Fuzzy search via useSearch hook ──────────────────────────
  const { results: suggestions, loading: loadingSugg, query: search, setQuery: setSearch, clear: clearSearch } = useSearch({ limit: 6, debounceMs: 300 });

  const [showDropdown, setShowDropdown] = useState(false);
  const [menuOpen,     setMenuOpen]     = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef   = useRef<HTMLDivElement>(null);

  // Show dropdown whenever we have results or are loading
  useEffect(() => {
    setShowDropdown(search.trim().length > 0 && (loadingSugg || suggestions.length > 0));
  }, [search, loadingSugg, suggestions]);

  // ── Close on outside click ────────────────────────────────
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Submit full search ────────────────────────────────────
  const handleSearch = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (search.trim()) {
      navigate(`/products?search=${encodeURIComponent(search.trim())}`);
      clearSearch();
      setShowDropdown(false);
    }
  };

  const handleSuggestionClick = (product: Product) => {
    clearSearch();
    setShowDropdown(false);
    navigate(`/product/${product.uuid}`);
  };

  const handleLogout = async () => {
    try { await authApi.logout(); } catch { /* ignore */ }
    clearUser();
    toast.success(t('nav.logged_out'));
    navigate('/');
  };

  const dashboardLink =
    user?.role === 'admin'   ? '/admin/dashboard' :
    user?.role === 'seller'  ? '/seller/products' :
                               '/user/dashboard';

  const profileLink =
    user?.role === 'admin'   ? '/admin/profile' :
    user?.role === 'seller'  ? '/seller/profile' :
                               '/user/profile';

  // ── Search box (shared between desktop + mobile) ──────────
  function SearchBox({ className }: { className?: string }) {
    return (
      <div ref={searchRef} className={cn('relative', className)}>
        <form onSubmit={handleSearch}>
          <div className="flex w-full rounded-xl overflow-hidden border border-gray-600 focus-within:border-orange-400 transition-colors bg-gray-800">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onFocus={() => { if (search.trim()) setShowDropdown(true); }}
              placeholder={t('nav.search_placeholder')}
              className="flex-1 bg-transparent text-gray-100 placeholder-gray-400 px-4 py-2.5 text-sm outline-none"
              autoComplete="off"
            />
            {search && (
              <button
                type="button"
                onClick={() => { clearSearch(); setShowDropdown(false); }}
                className="px-2 text-gray-400 hover:text-gray-200 transition-colors"
                aria-label={t('nav.search_clear')}
              >
                <X size={15} />
              </button>
            )}
            <button
              type="submit"
              className="bg-orange-500 hover:bg-orange-600 px-4 transition-colors shrink-0 flex items-center justify-center"
              aria-label={t('nav.search_button')}
            >
              {loadingSugg
                ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <Search size={17} className="text-white" />
              }
            </button>
          </div>
        </form>

        {/* ── Suggestions dropdown ── */}
        {showDropdown && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-slate-700 overflow-hidden z-50">

            {/* Loading skeleton */}
            {loadingSugg && suggestions.length === 0 && (
              <div className="px-4 py-3 space-y-2.5">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex items-center gap-3 animate-pulse">
                    <div className="w-10 h-10 rounded-lg bg-gray-200 dark:bg-slate-700 shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 bg-gray-200 dark:bg-slate-700 rounded w-3/4" />
                      <div className="h-2.5 bg-gray-100 dark:bg-slate-600 rounded w-1/3" />
                    </div>
                    <div className="h-3 bg-gray-200 dark:bg-slate-700 rounded w-14 shrink-0" />
                  </div>
                ))}
              </div>
            )}

            {/* Results */}
            {!loadingSugg && suggestions.length > 0 && (
              <>
                {/* Header */}
                <div className="flex items-center gap-1.5 px-4 pt-3 pb-1.5">
                  <Zap size={12} className="text-orange-500" />
                  <span className="text-[11px] font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider">
                    {t('nav.instant_results')}
                  </span>
                </div>

                {suggestions.map((p) => {
                  const displayName = tf(p.name);
                  return (
                  <button
                    key={p.uuid}
                    type="button"
                    onClick={() => handleSuggestionClick(p)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-orange-50 dark:hover:bg-orange-500/10 transition-colors text-left group"
                  >
                    {/* Thumbnail */}
                    <div className="w-10 h-10 rounded-xl overflow-hidden bg-gray-100 dark:bg-slate-700 shrink-0 border border-gray-200 dark:border-slate-600">
                      <img
                        src={getImageUrl(p.primary_image)}
                        alt={displayName}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        onError={(e) => { (e.target as HTMLImageElement).src = '/logo.png'; }}
                      />
                    </div>

                    {/* Name + category */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 dark:text-slate-100 truncate leading-tight">
                        {highlightMatch(displayName, search)}
                      </p>
                      <p className="text-xs text-orange-500 dark:text-orange-400 mt-0.5 truncate">
                        {p.category}
                      </p>
                    </div>

                    {/* Price */}
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-gray-900 dark:text-slate-100">
                        ₹{p.price.toLocaleString('en-IN')}
                      </p>
                    </div>
                  </button>
                  );
                })}

                {/* View all */}
                <button
                  type="button"
                  onClick={() => handleSearch()}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-500/10 font-semibold border-t border-gray-100 dark:border-slate-700 transition-colors"
                >
                  <TrendingUp size={14} />
                  {t('nav.see_all_results')} "<span className="font-bold">{search}</span>"
                </button>
              </>
            )}

            {/* No results */}
            {!loadingSugg && suggestions.length === 0 && search.trim() && (
              <div className="px-4 py-6 text-center">
                <Package size={28} className="text-gray-300 dark:text-slate-600 mx-auto mb-2" />
                <p className="text-sm font-medium text-gray-600 dark:text-slate-400">
                  {t('nav.no_results')} "<span className="text-gray-800 dark:text-slate-200">{search}</span>"
                </p>
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
                  {t('nav.try_different')}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <header className="sticky top-0 z-40 bg-gray-900/95 backdrop-blur-md text-white shadow-lg border-b border-gray-800/50">
      {/* Top bar */}
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
        {/* Language selector — LEFT */}
        <LanguageSelector />

        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 shrink-0">
          <img
            src="/logo.png"
            alt="ShopHub"
            className="h-12 w-auto object-contain"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          <span className="text-xl font-bold tracking-tight">
            Shop<span className="text-orange-400">Hub</span>
          </span>
        </Link>

        {/* Desktop search */}
        <SearchBox className="flex-1 max-w-2xl hidden sm:block" />

        {/* Right actions */}
        <div className="flex items-center gap-2 ml-auto sm:ml-0">
          {/* Cart */}
          <Link to="/cart" className="relative p-2 rounded-lg hover:bg-gray-700 transition-colors" aria-label="Cart">
            <ShoppingCart size={22} />
            {itemCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                {itemCount > 99 ? '99+' : itemCount}
              </span>
            )}
          </Link>

          {/* Wishlist */}
          {isAuthenticated && user?.role === 'customer' && (
            <Link to="/user/wishlist" className="p-2 rounded-lg hover:bg-gray-700 transition-colors" aria-label="Wishlist">
              <Heart size={22} />
            </Link>
          )}

          {/* Theme toggle */}
          <ThemeToggle />

          {/* Currency selector — RIGHT */}
          <CurrencySelector />

          {/* Auth */}
          {isAuthenticated ? (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen((v) => !v)}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-700 transition-colors text-sm"
              >
                <UserAvatar
                  src={user?.profile_photo}
                  name={user?.username ?? '?'}
                  size="xs"
                  className="ring-2 ring-orange-400"
                />
                <span className="hidden md:block max-w-[100px] truncate">{user?.username}</span>
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-52 bg-white text-gray-800 rounded-xl shadow-xl border border-gray-100 py-1 z-50">
                  <div className="px-4 py-2 border-b border-gray-100">
                    <p className="font-semibold text-sm truncate">{user?.username}</p>
                    <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                    <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full capitalize mt-1 inline-block">
                      {user?.role}
                    </span>
                    {user?.role === 'customer' && (
                      <div className="flex items-center gap-1.5 mt-2 bg-orange-50 rounded-lg px-2 py-1.5">
                        <Wallet size={13} className="text-orange-500 shrink-0" />
                        <span className="text-xs font-semibold text-orange-700">
                          {formatPrice(user.wallet_balance ?? 0)}
                        </span>
                        <span className="text-xs text-orange-500">{t('nav.wallet')}</span>
                      </div>
                    )}
                  </div>
                  <Link to={dashboardLink} onClick={() => setDropdownOpen(false)} className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-50 transition-colors">
                    <LayoutDashboard size={15} /> {t('nav.dashboard')}
                  </Link>
                  <Link to={profileLink} onClick={() => setDropdownOpen(false)} className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-50 transition-colors">
                    <User size={15} /> {t('nav.my_profile')}
                  </Link>
                  {user?.role === 'customer' && (
                    <Link to="/user/orders" onClick={() => setDropdownOpen(false)} className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-50 transition-colors">
                      <Package size={15} /> {t('nav.my_orders')}
                    </Link>
                  )}
                  {user?.role === 'customer' && (
                    <Link to="/user/wallet" onClick={() => setDropdownOpen(false)} className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-50 transition-colors">
                      <Wallet size={15} /> {t('nav.wallet_rewards')}
                    </Link>
                  )}
                  <button onClick={handleLogout} className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors">
                    <LogOut size={15} /> {t('nav.logout')}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link to="/login" className="px-3 py-1.5 text-sm rounded-lg hover:bg-gray-700 transition-colors">{t('nav.login')}</Link>
              <Link to="/signup" className="px-3 py-1.5 text-sm bg-orange-500 hover:bg-orange-600 rounded-lg transition-colors font-medium">{t('nav.sign_up')}</Link>
            </div>
          )}

          {/* Mobile menu toggle */}
          <button className="sm:hidden p-2 rounded-lg hover:bg-gray-700 transition-colors" onClick={() => setMenuOpen((v) => !v)}>
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Mobile search */}
      <div className={cn('sm:hidden px-4 pb-3', !menuOpen && 'hidden')}>
        <SearchBox />
      </div>

      {/* Category nav */}
      <nav className="bg-gray-800 border-t border-gray-700">
        <div className="max-w-7xl mx-auto px-4 flex items-center gap-6 overflow-x-auto py-2 text-sm scrollbar-hide">
          <Link to="/products" className="whitespace-nowrap hover:text-orange-400 transition-colors">{t('nav.all_products')}</Link>
          <Link to="/products?category=" className="whitespace-nowrap hover:text-orange-400 transition-colors flex items-center gap-1">
            <Tag size={13} /> {t('nav.categories')}
          </Link>
          {!isAuthenticated && (
            <Link to="/signup?role=seller" className="whitespace-nowrap hover:text-orange-400 transition-colors">{t('nav.sell_on')}</Link>
          )}
        </div>
      </nav>
    </header>
  );
}

// ── Highlight matching substring ──────────────────────────────
function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-orange-100 text-orange-700 rounded px-0.5 not-italic font-semibold">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}
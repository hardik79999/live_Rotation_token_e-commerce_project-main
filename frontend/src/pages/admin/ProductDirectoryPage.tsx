import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Package, Search, RefreshCw, ChevronLeft, ChevronRight,
  Eye, AlertCircle, CheckCircle,
} from 'lucide-react';
import { adminApi } from '@/api/admin';
import type { AdminProduct, Category } from '@/types';
import { formatPrice, getImageUrl } from '@/utils/image';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { AdminProductQuickViewModal } from '@/components/admin/AdminProductQuickViewModal';
import { cn } from '@/utils/cn';
import toast from 'react-hot-toast';

// ── Debounce hook ─────────────────────────────────────────────────────────────
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export function ProductDirectoryPage() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const PER_PAGE = 20;

  const [search, setSearch]           = useState('');
  const [catFilter, setCatFilter]     = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // ── Quick view modal state ────────────────────────────────────────────────
  const [quickViewUuid,   setQuickViewUuid]   = useState<string | null>(null);
  const [quickViewSeller, setQuickViewSeller] = useState<{ name: string; uuid: string } | null>(null);

  const debouncedSearch = useDebounce(search, 300);
  const isFirstRender = useRef(true);

  // Open quick view for a product row
  const openQuickView = (p: AdminProduct) => {
    setQuickViewUuid(p.uuid);
    setQuickViewSeller({ name: p.seller_name, uuid: p.seller_uuid });
  };

  // Load categories for filter dropdown
  useEffect(() => {
    adminApi.listCategories()
      .then((r) => setCategories(r.data.data ?? []))
      .catch(() => {});
  }, []);

  const fetchProducts = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const res = await adminApi.getProductsDirectory({
        search:   debouncedSearch || undefined,
        category: catFilter       || undefined,
        status:   statusFilter,
        page:     p,
        per_page: PER_PAGE,
      });
      setProducts(res.data.data ?? []);
      setTotal(res.data.total ?? 0);
      setTotalPages(res.data.total_pages ?? 1);
    } catch {
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, catFilter, statusFilter]);

  // Reset to page 1 when filters change
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    setPage(1);
  }, [debouncedSearch, catFilter, statusFilter]);

  useEffect(() => {
    fetchProducts(page);
  }, [fetchProducts, page]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Product Directory</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
            Read-only view of every product on the platform
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Read-only notice */}
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 px-3 py-1.5 rounded-lg font-medium">
            <Eye size={12} /> View Only — No Edit Access
          </div>
          <Button variant="outline" size="sm" onClick={() => fetchProducts(page)}>
            <RefreshCw size={14} /> Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" />
          <input
            type="text"
            placeholder="Search product, seller, or category..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:border-orange-500 dark:focus:border-orange-400 transition-colors"
          />
        </div>
        <select
          value={catFilter}
          onChange={(e) => setCatFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 focus:outline-none focus:border-orange-500 dark:focus:border-orange-400 transition-colors"
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c.uuid} value={c.uuid}>{c.name}</option>
          ))}
        </select>
        <div className="flex gap-2">
          {(['all', 'active', 'inactive'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all capitalize',
                statusFilter === f
                  ? 'bg-orange-500 text-white border-orange-500'
                  : 'border-gray-300 dark:border-slate-600 text-gray-600 dark:text-slate-400 bg-white dark:bg-slate-800 hover:border-orange-400'
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Results count */}
      <p className="text-xs text-gray-500 dark:text-slate-400">
        {total} product{total !== 1 ? 's' : ''} found
        {debouncedSearch && ` for "${debouncedSearch}"`}
      </p>

      {/* Table */}
      {loading ? (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-8">
          <div className="space-y-3">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-14 bg-gray-100 dark:bg-slate-700 rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700">
          <Package size={48} className="text-gray-200 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-slate-400">No products match your filters</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-slate-700/50 border-b border-gray-100 dark:border-slate-700">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-slate-300">Product</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-slate-300 hidden sm:table-cell">Category</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-slate-300 hidden md:table-cell">Seller</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600 dark:text-slate-300">Price</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600 dark:text-slate-300 hidden lg:table-cell">Stock</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600 dark:text-slate-300">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
                {products.map((p) => (
                  <tr
                    key={p.uuid}
                    className="hover:bg-orange-50/40 dark:hover:bg-orange-500/5 transition-colors cursor-pointer group"
                    onClick={() => openQuickView(p)}
                    title="Click to quick view"
                  >
                    {/* Product */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-100 dark:bg-slate-700 shrink-0">
                          {p.primary_image ? (
                            <img
                              src={getImageUrl(p.primary_image)}
                              alt={p.name}
                              className="w-full h-full object-cover"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Package size={14} className="text-gray-400 dark:text-slate-500" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-gray-800 dark:text-slate-200 truncate max-w-[180px] group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">{p.name}</p>
                          <p className="text-xs text-gray-400 dark:text-slate-500 font-mono">{p.uuid.slice(0, 8)}</p>
                        </div>
                      </div>
                    </td>
                    {/* Category */}
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="text-xs bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 px-2 py-0.5 rounded-full font-medium">
                        {p.category}
                      </span>
                    </td>
                    {/* Seller */}
                    <td className="px-4 py-3 hidden md:table-cell">
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate(`/admin/sellers/${p.seller_uuid}`); }}
                        className="flex items-center gap-1.5 text-sm text-gray-700 dark:text-slate-300 hover:text-orange-500 dark:hover:text-orange-400 transition-colors group"
                      >
                        <div className="w-5 h-5 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                          {p.seller_name[0]?.toUpperCase()}
                        </div>
                        <span className="truncate max-w-[100px]">{p.seller_name}</span>
                        {!p.seller_active && (
                          <AlertCircle size={11} className="text-red-400 shrink-0" aria-label="Seller is blocked" />
                        )}
                      </button>
                    </td>
                    {/* Price */}
                    <td className="px-4 py-3 text-right font-bold text-gray-900 dark:text-slate-100">
                      {formatPrice(p.price)}
                    </td>
                    {/* Stock */}
                    <td className="px-4 py-3 text-right hidden lg:table-cell">
                      <span className={cn(
                        'font-semibold',
                        p.stock === 0 ? 'text-red-500' :
                        p.stock < 10  ? 'text-yellow-500' :
                                        'text-gray-700 dark:text-slate-300'
                      )}>
                        {p.stock}
                      </span>
                    </td>
                    {/* Status */}
                    <td className="px-4 py-3 text-center">
                      {p.is_active ? (
                        <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                          <CheckCircle size={11} /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-red-500 dark:text-red-400">
                          <AlertCircle size={11} /> Hidden
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Table footer — always visible */}
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-50 dark:border-slate-700/50 bg-gray-50/50 dark:bg-slate-700/20">
            <p className="text-xs text-gray-400 dark:text-slate-500">
              Click any row to quick view · Seller name navigates to seller profile
            </p>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-700/20">
              <p className="text-xs text-gray-500 dark:text-slate-400">
                Page {page} of {totalPages} · {total} total
              </p>
              <div className="flex gap-2">                <Button
                  variant="outline" size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                >
                  <ChevronLeft size={14} /> Prev
                </Button>
                <Button
                  variant="outline" size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                >
                  Next <ChevronRight size={14} />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Read-only disclaimer */}
      <div className="flex items-start gap-2 text-xs text-gray-400 dark:text-slate-500 bg-gray-50 dark:bg-slate-800/50 rounded-xl p-3 border border-gray-100 dark:border-slate-700">
        <Eye size={13} className="mt-0.5 shrink-0 text-amber-500" />
        <span>
          <strong className="text-gray-600 dark:text-slate-400">Admin View Only.</strong>{' '}
          Product editing is the exclusive responsibility of each seller. Admins can manage product visibility
          indirectly by blocking a seller account or deleting a category.
        </span>
      </div>

      {/* Quick View Modal */}
      <AdminProductQuickViewModal
        productUuid={quickViewUuid}
        sellerName={quickViewSeller?.name}
        sellerUuid={quickViewSeller?.uuid}
        onClose={() => { setQuickViewUuid(null); setQuickViewSeller(null); }}
      />
    </div>
  );
}

import { useEffect, useState, useCallback } from 'react';
import { PageSpinner } from '@/components/ui/Spinner';
import { useNavigate } from 'react-router-dom';
import {
  Users, TrendingUp, Package, ShoppingBag, Search,
  RefreshCw, ChevronRight, ShieldOff, ShieldCheck,
  ArrowUpRight, Star, Eye,
} from 'lucide-react';
import { adminApi } from '@/api/admin';
import type { SellerOverviewItem, TopSellerItem } from '@/types';
import { formatPrice, formatDate } from '@/utils/image';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { cn } from '@/utils/cn';
import toast from 'react-hot-toast';

// ── Mini bar chart (pure CSS, no library) ────────────────────────────────────
function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-1.5 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-gray-400 dark:text-slate-500 w-8 text-right tabular-nums">{pct}%</span>
    </div>
  );
}

// ── Top-5 Sellers widget ──────────────────────────────────────────────────────
function TopSellersWidget() {
  const [sellers, setSellers] = useState<TopSellerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    adminApi.getTopSellers()
      .then((r) => setSellers(r.data.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const maxRev = sellers[0]?.total_revenue ?? 1;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-slate-700">
        <h2 className="font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
          <Star size={16} className="text-yellow-500 fill-yellow-400" /> Top 5 Sellers
        </h2>
        <span className="text-xs text-gray-400 dark:text-slate-500">by revenue</span>
      </div>
      {loading ? (
        <div className="p-6 space-y-4">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="h-10 bg-gray-100 dark:bg-slate-700 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : sellers.length === 0 ? (
        <div className="text-center py-10 text-gray-400 dark:text-slate-500">
          <Users size={28} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">No sales data yet</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-50 dark:divide-slate-700/50">
          {sellers.map((s, idx) => (
            <div
              key={s.uuid}
              className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer group"
              onClick={() => navigate(`/admin/sellers/${s.uuid}`)}
            >
              <span className={cn(
                'w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center shrink-0',
                idx === 0 ? 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400' :
                idx === 1 ? 'bg-gray-100 dark:bg-slate-600 text-gray-600 dark:text-slate-300' :
                idx === 2 ? 'bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400' :
                            'bg-gray-50 dark:bg-slate-700 text-gray-500 dark:text-slate-400'
              )}>
                {idx + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1">
                  <p className="text-sm font-semibold text-gray-800 dark:text-slate-200 truncate">{s.username}</p>
                  {!s.is_active && (
                    <span className="text-xs bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded-full">Blocked</span>
                  )}
                </div>
                <MiniBar value={s.total_revenue} max={maxRev} color="bg-orange-400" />
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold text-gray-900 dark:text-slate-100">{formatPrice(s.total_revenue)}</p>
                <p className="text-xs text-gray-400 dark:text-slate-500">{s.total_orders} orders</p>
              </div>
              <ChevronRight size={14} className="text-gray-300 dark:text-slate-600 group-hover:text-orange-400 transition-colors shrink-0" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export function SellerSurveillancePage() {
  const navigate = useNavigate();
  const [sellers, setSellers] = useState<SellerOverviewItem[]>([]);
  const [filtered, setFiltered] = useState<SellerOverviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'blocked'>('all');
  const [sortBy, setSortBy] = useState<'revenue' | 'products' | 'orders' | 'joined'>('revenue');

  const fetchSellers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.getSellersOverview();
      setSellers(res.data.data ?? []);
    } catch {
      toast.error('Failed to load sellers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSellers(); }, [fetchSellers]);

  // Filter + sort
  useEffect(() => {
    let result = [...sellers];
    if (statusFilter === 'active')  result = result.filter(s => s.is_active);
    if (statusFilter === 'blocked') result = result.filter(s => !s.is_active);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(s =>
        s.username.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q)
      );
    }
    result.sort((a, b) => {
      if (sortBy === 'revenue')  return b.total_revenue  - a.total_revenue;
      if (sortBy === 'products') return b.total_products - a.total_products;
      if (sortBy === 'orders')   return b.total_orders   - a.total_orders;
      // joined — newest first
      return new Date(b.joined_at ?? 0).getTime() - new Date(a.joined_at ?? 0).getTime();
    });
    setFiltered(result);
  }, [sellers, search, statusFilter, sortBy]);

  const handleToggle = async (uuid: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setToggling(uuid);
    try {
      await adminApi.toggleSellerStatus(uuid);
      toast.success('Seller status updated');
      fetchSellers();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Failed to update status');
    } finally {
      setToggling(null);
    }
  };

  // Summary stats
  const totalRevenue  = sellers.reduce((s, x) => s + (isFinite(x.total_revenue) ? x.total_revenue : 0), 0);
  const activeSellers = sellers.filter(s => s.is_active).length;
  const totalProducts = sellers.reduce((s, x) => s + (isFinite(x.total_products) ? x.total_products : 0), 0);

  if (loading) return <PageSpinner />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Seller Surveillance</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
            Monitor every seller — performance, revenue, and account health
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchSellers}>
          <RefreshCw size={14} /> Refresh
        </Button>
      </div>

      {/* Summary KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Sellers',    value: sellers.length,       icon: <Users size={20} />,       color: 'text-blue-500',   bg: 'bg-blue-50 dark:bg-blue-500/10' },
          { label: 'Active Sellers',   value: activeSellers,        icon: <ShieldCheck size={20} />, color: 'text-green-500',  bg: 'bg-green-50 dark:bg-green-500/10' },
          { label: 'Platform Revenue', value: formatPrice(totalRevenue), icon: <TrendingUp size={20} />, color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-500/10' },
          { label: 'Total Listings',   value: totalProducts,        icon: <Package size={20} />,     color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-500/10' },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-4 flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${kpi.bg} shrink-0`}>
              <div className={kpi.color}>{kpi.icon}</div>
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-500 dark:text-slate-400 truncate">{kpi.label}</p>
              <p className="text-lg font-bold text-gray-900 dark:text-slate-100 truncate">{kpi.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Two-column: table + top sellers widget */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Seller table — takes 2/3 */}
        <div className="lg:col-span-2 space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" />
              <input
                type="text"
                placeholder="Search seller name or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:border-orange-500 dark:focus:border-orange-400 transition-colors"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              {(['all', 'active', 'blocked'] as const).map((f) => (
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
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-400 focus:outline-none focus:border-orange-500 dark:focus:border-orange-400 transition-colors"
              >
                <option value="revenue">Sort: Revenue</option>
                <option value="products">Sort: Products</option>
                <option value="orders">Sort: Orders</option>
                <option value="joined">Sort: Newest</option>
              </select>
            </div>
          </div>

          {/* Table */}
          {filtered.length === 0 ? (
            <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700">
              <Users size={48} className="text-gray-200 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-slate-400">No sellers match your filter</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-slate-700/50 border-b border-gray-100 dark:border-slate-700">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-slate-300">Seller</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600 dark:text-slate-300 hidden sm:table-cell">Revenue</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600 dark:text-slate-300 hidden md:table-cell">Products</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600 dark:text-slate-300 hidden md:table-cell">Orders</th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-600 dark:text-slate-300">Status</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600 dark:text-slate-300">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
                  {filtered.map((seller) => (
                    <tr
                      key={seller.uuid}
                      className="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer group"
                      onClick={() => navigate(`/admin/sellers/${seller.uuid}`)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                            {seller.username[0]?.toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-800 dark:text-slate-200 truncate">{seller.username}</p>
                            <p className="text-xs text-gray-400 dark:text-slate-500 truncate">{seller.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right hidden sm:table-cell">
                        <p className="font-bold text-gray-900 dark:text-slate-100">{formatPrice(seller.total_revenue)}</p>
                        <p className="text-xs text-gray-400 dark:text-slate-500">{seller.approved_categories} categories</p>
                      </td>
                      <td className="px-4 py-3 text-right hidden md:table-cell">
                        <p className="font-semibold text-gray-800 dark:text-slate-200">{seller.total_products}</p>
                      </td>
                      <td className="px-4 py-3 text-right hidden md:table-cell">
                        <p className="font-semibold text-gray-800 dark:text-slate-200">{seller.total_orders}</p>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant={seller.is_active ? 'success' : 'danger'}>
                          {seller.is_active ? 'Active' : 'Blocked'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => navigate(`/admin/sellers/${seller.uuid}`)}
                            className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors"
                            title="View details"
                          >
                            <Eye size={14} />
                          </button>
                          <Button
                            size="sm"
                            variant={seller.is_active ? 'danger' : 'secondary'}
                            loading={toggling === seller.uuid}
                            onClick={(e) => handleToggle(seller.uuid, e)}
                          >
                            {seller.is_active
                              ? <><ShieldOff size={12} /> Block</>
                              : <><ShieldCheck size={12} /> Unblock</>
                            }
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-4 py-2.5 border-t border-gray-50 dark:border-slate-700/50 bg-gray-50/50 dark:bg-slate-700/20">
                <p className="text-xs text-gray-400 dark:text-slate-500">
                  Showing {filtered.length} of {sellers.length} sellers · Click any row to view full details
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Top sellers widget — 1/3 */}
        <div>
          <TopSellersWidget />
        </div>
      </div>
    </div>
  );
}

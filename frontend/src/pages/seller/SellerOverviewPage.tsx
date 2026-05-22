/**
 * SellerOverviewPage
 * ──────────────────
 * The seller's main landing page — mirrors the Admin's "Seller Performance
 * Report" layout exactly, but scoped to the currently logged-in seller.
 *
 * Data sources (all JWT-authenticated, no UUID in URL):
 *   • Identity        — useAuthStore (already in memory from silent login)
 *   • Metrics         — derived from sellerApi.getProducts() + getOrders()
 *   • Revenue chart   — sellerApi.getAnalytics('6m')  → RevenueChartPoint[]
 *   • Categories      — sellerApi.getMyCategories()
 *
 * Layout (mirrors SellerDetailPage):
 *   1. Profile card   — avatar, name (→ Edit Profile), email, phone, join date,
 *                       approved category tags
 *   2. Metrics row    — Active Products · Total Orders · Total Revenue · Avg Order Value
 *   3. Two-column     — Revenue chart (+ Maximize) | Top Products widget
 *   4. Recent Orders  — last 5 orders table
 */

import { useEffect, useState, useCallback } from 'react';
import { PageSpinner } from '@/components/ui/Spinner';
import { useNavigate, Link } from 'react-router-dom';
import {
  Package, ShoppingBag, TrendingUp, Tag,
  Mail, Phone, Calendar, BarChart3, Star,
  Clock, CheckCircle, Truck, XCircle, Maximize2,
  Pencil, ArrowRight,
} from 'lucide-react';
import { sellerApi } from '@/api/seller';
import type { Product, SellerOrder, RevenueChartPoint } from '@/types';
import type { SellerCategoryItem } from '@/api/seller';
import { formatPrice, formatDate, getImageUrl } from '@/utils/image';
import { Badge, orderStatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { RevenueChartSkeleton } from '@/components/ui/Skeleton';
import { SellerRevenueChart } from '@/components/admin/SellerRevenueChart';
import { ExpandedSellerAnalyticsModal } from '@/components/seller/ExpandedSellerAnalyticsModal';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { useAuthStore } from '@/store/authStore';
import { cn } from '@/utils/cn';
import toast from 'react-hot-toast';

// ── Status icon map ───────────────────────────────────────────────────────────
const STATUS_ICON: Record<string, React.ReactNode> = {
  pending:    <Clock size={13} className="text-yellow-500" />,
  processing: <Package size={13} className="text-blue-500" />,
  shipped:    <Truck size={13} className="text-orange-500" />,
  delivered:  <CheckCircle size={13} className="text-green-500" />,
  cancelled:  <XCircle size={13} className="text-red-500" />,
};

// ── Metric card — same minimal tinted style as AdminDashboardPage ─────────────
function MetricCard({ label, value, icon, accent, sub }: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  accent: 'blue' | 'violet' | 'orange' | 'emerald';
  sub?: string;
}) {
  const styles = {
    blue:    { wrap: 'bg-blue-50    dark:bg-blue-500/10   border-blue-100    dark:border-blue-500/20',   icon: 'bg-blue-100    dark:bg-blue-500/20   text-blue-600    dark:text-blue-400',   val: 'text-blue-700    dark:text-blue-300'   },
    violet:  { wrap: 'bg-violet-50  dark:bg-violet-500/10 border-violet-100  dark:border-violet-500/20', icon: 'bg-violet-100  dark:bg-violet-500/20 text-violet-600  dark:text-violet-400', val: 'text-violet-700  dark:text-violet-300' },
    orange:  { wrap: 'bg-orange-50  dark:bg-orange-500/10 border-orange-100  dark:border-orange-500/20', icon: 'bg-orange-100  dark:bg-orange-500/20 text-orange-600  dark:text-orange-400', val: 'text-orange-700  dark:text-orange-300' },
    emerald: { wrap: 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20', icon: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400', val: 'text-emerald-700 dark:text-emerald-300' },
  }[accent];

  return (
    <div className={cn('rounded-2xl p-5 border', styles.wrap)}>
      <div className="flex items-start justify-between mb-3">
        <p className="text-sm font-medium text-gray-500 dark:text-slate-400">{label}</p>
        <div className={cn('p-2 rounded-xl', styles.icon)}>{icon}</div>
      </div>
      <p className={cn('text-3xl font-bold tracking-tight', styles.val)}>{value}</p>
      {sub && <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function SellerOverviewPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  // ── Data state ────────────────────────────────────────────────────────────
  const [products,    setProducts]    = useState<Product[]>([]);
  const [orders,      setOrders]      = useState<SellerOrder[]>([]);
  const [categories,  setCategories]  = useState<SellerCategoryItem[]>([]);
  const [chartData,   setChartData]   = useState<RevenueChartPoint[]>([]);

  const [loadingMain,  setLoadingMain]  = useState(true);
  const [loadingChart, setLoadingChart] = useState(true);

  // ── Modal state ───────────────────────────────────────────────────────────
  const [analyticsOpen, setAnalyticsOpen] = useState(false);

  // ── Fetch main data ───────────────────────────────────────────────────────
  const fetchMain = useCallback(async () => {
    try {
      const [prodRes, ordRes, catRes] = await Promise.all([
        sellerApi.getProducts(),
        sellerApi.getOrders(),
        sellerApi.getMyCategories(),
      ]);
      setProducts((prodRes.data.data as Product[]) || []);
      setOrders((ordRes.data.data as SellerOrder[]) || []);
      setCategories((catRes.data.data as SellerCategoryItem[]) || []);
    } catch {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoadingMain(false);
    }
  }, []);

  // ── Fetch chart data independently ───────────────────────────────────────
  const fetchChart = useCallback(async () => {
    setLoadingChart(true);
    try {
      // getAnalytics returns AnalyticsPoint[] — we need RevenueChartPoint[]
      // for SellerRevenueChart. Map the fields.
      const res = await sellerApi.getAnalytics('6m');
      const points = (res.data.data ?? []).map(p => ({
        month:      p.label,       // "Jan", "Feb", …
        full_month: p.full_label,  // "Jan 2025"
        revenue:    p.revenue,
        orders:     p.orders,
      }));
      setChartData(points);
    } catch {
      setChartData([]);
    } finally {
      setLoadingChart(false);
    }
  }, []);

  useEffect(() => {
    fetchMain();
    fetchChart();
  }, [fetchMain, fetchChart]);

  if (loadingMain) return <PageSpinner />;

  // ── Derived metrics ───────────────────────────────────────────────────────
  const activeProducts     = products.filter(p => p.is_active).length;
  const nonCancelledOrders = orders.filter(o => o.status !== 'cancelled');
  const totalOrders        = orders.length;
  const totalRevenue       = nonCancelledOrders.reduce((s, o) => s + (isFinite(o.seller_total) ? o.seller_total : 0), 0);
  const avgOrderValue      = nonCancelledOrders.length > 0
    ? totalRevenue / nonCancelledOrders.length
    : 0;

  const approvedCategories = categories.filter(c => c.status === 'approved');

  // Top 5 products by revenue (derived from orders)
  const productRevMap: Record<string, { name: string; image: string | null; revenue: number; units: number }> = {};
  nonCancelledOrders.forEach(order => {
    order.items.forEach(item => {
      if (!item.product_uuid) return;
      if (!productRevMap[item.product_uuid]) {
        productRevMap[item.product_uuid] = {
          name:    item.product_name,
          image:   item.image,
          revenue: 0,
          units:   0,
        };
      }
      productRevMap[item.product_uuid].revenue += isFinite(item.subtotal) ? item.subtotal : 0;
      productRevMap[item.product_uuid].units   += isFinite(item.quantity) ? item.quantity : 0;
    });
  });
  const topProducts = Object.entries(productRevMap)
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, 5);

  // Recent 5 orders
  const recentOrders = [...orders]
    .sort((a, b) => new Date(b.order_date).getTime() - new Date(a.order_date).getTime())
    .slice(0, 5);

  return (
    <div className="space-y-6">

      {/* ── Page header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">
            My Dashboard
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
            Your store performance at a glance
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { fetchMain(); fetchChart(); }}>
          Refresh
        </Button>
      </div>

      {/* ── Profile / Identity card ── */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-5">
        <div className="flex items-center gap-4">
          {/* Avatar */}
          <UserAvatar
            src={user?.profile_photo}
            name={user?.username ?? '?'}
            size="lg"
            className="ring-2 ring-orange-400 shadow-lg"
          />

          {/* Identity info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100">
                {user?.username}
              </h2>
              <span className="text-xs bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded-full font-medium">
                Seller
              </span>
            </div>
            <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5">
                <Mail size={13} /> {user?.email}
              </span>
              {user?.phone && (
                <span className="flex items-center gap-1.5">
                  <Phone size={13} /> {user.phone}
                </span>
              )}
            </div>
          </div>

          {/* Edit Profile button */}
          <Link
            to="/seller/profile"
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-400 hover:border-orange-400 hover:text-orange-500 dark:hover:border-orange-500 dark:hover:text-orange-400 transition-all bg-white dark:bg-slate-800"
          >
            <Pencil size={12} /> Edit Profile
          </Link>
        </div>

        {/* Approved categories */}
        {approvedCategories.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-slate-700">
            <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <Tag size={12} /> Approved Categories
            </p>
            <div className="flex flex-wrap gap-2">
              {approvedCategories.map(cat => (
                <span
                  key={cat.uuid}
                  className="text-xs bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 px-2.5 py-1 rounded-full font-medium"
                >
                  {cat.name}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Metrics row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Active Products"
          value={activeProducts}
          icon={<Package size={18} />}
          accent="blue"
          sub="Live listings"
        />
        <MetricCard
          label="Total Orders"
          value={totalOrders}
          icon={<ShoppingBag size={18} />}
          accent="orange"
          sub="All time"
        />
        <MetricCard
          label="Total Revenue"
          value={formatPrice(totalRevenue)}
          icon={<TrendingUp size={18} />}
          accent="emerald"
          sub="Completed payments"
        />
        <MetricCard
          label="Avg Order Value"
          value={formatPrice(avgOrderValue)}
          icon={<Star size={18} />}
          accent="violet"
          sub="Per order"
        />
      </div>

      {/* ── Two-column: chart + top products ── */}
      <div className="grid lg:grid-cols-2 gap-6">

        {/* Revenue chart */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4 shrink-0">
            <h2 className="font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
              <BarChart3 size={16} className="text-orange-500" /> Revenue (Last 6 Months)
            </h2>
            <button
              onClick={() => setAnalyticsOpen(true)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-500/10 dark:text-slate-500 dark:hover:text-orange-400 transition-colors"
              title="Expand chart"
            >
              <Maximize2 size={15} />
            </button>
          </div>
          <div className="h-52">
            {loadingChart ? (
              <RevenueChartSkeleton />
            ) : (
              <SellerRevenueChart data={chartData} />
            )}
          </div>
        </div>

        {/* Top products */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
            <h2 className="font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
              <Star size={16} className="text-yellow-500 fill-yellow-400" /> Top Products
            </h2>
            <Link
              to="/seller/products"
              className="text-xs text-orange-500 hover:text-orange-600 font-medium flex items-center gap-1"
            >
              View all <ArrowRight size={11} />
            </Link>
          </div>

          {topProducts.length === 0 ? (
            <div className="text-center py-10 text-gray-400 dark:text-slate-500">
              <Package size={28} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No sales data yet</p>
              <Link
                to="/seller/products"
                className="text-xs text-orange-500 hover:text-orange-600 font-medium mt-2 inline-block"
              >
                Add your first product →
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-slate-700/50">
              {topProducts.map(([uuid, p], idx) => (
                <div
                  key={uuid}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
                >
                  <span className={cn(
                    'w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center shrink-0',
                    idx === 0 ? 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400' :
                    idx === 1 ? 'bg-gray-100 dark:bg-slate-600 text-gray-600 dark:text-slate-300' :
                                'bg-orange-50 dark:bg-orange-500/10 text-orange-500 dark:text-orange-400'
                  )}>
                    {idx + 1}
                  </span>
                  <div className="w-9 h-9 rounded-lg overflow-hidden bg-gray-100 dark:bg-slate-700 shrink-0">
                    {p.image ? (
                      <img
                        src={getImageUrl(p.image)}
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
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-slate-200 truncate">{p.name}</p>
                    <p className="text-xs text-gray-400 dark:text-slate-500">{p.units} units sold</p>
                  </div>
                  <p className="font-bold text-gray-900 dark:text-slate-100 text-sm shrink-0">
                    {formatPrice(p.revenue)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Recent orders ── */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
          <h2 className="font-bold text-gray-900 dark:text-slate-100">Recent Orders</h2>
          <Link
            to="/seller/orders"
            className="text-xs text-orange-500 hover:text-orange-600 font-medium flex items-center gap-1"
          >
            View all <ArrowRight size={11} />
          </Link>
        </div>

        {recentOrders.length === 0 ? (
          <div className="text-center py-10 text-gray-400 dark:text-slate-500">
            <ShoppingBag size={28} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">No orders yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-slate-700/50 border-b border-gray-100 dark:border-slate-700">
                <tr>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600 dark:text-slate-300">Order</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600 dark:text-slate-300 hidden sm:table-cell">Customer</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600 dark:text-slate-300">Status</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600 dark:text-slate-300 hidden md:table-cell">Date</th>
                  <th className="text-right px-5 py-3 font-semibold text-gray-600 dark:text-slate-300">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
                {recentOrders.map(o => (
                  <tr
                    key={o.order_uuid}
                    className="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer"
                    onClick={() => navigate('/seller/orders')}
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        {STATUS_ICON[o.status] ?? <Package size={13} />}
                        <span className="font-mono text-xs text-gray-500 dark:text-slate-400">
                          #{o.order_uuid.slice(0, 8).toUpperCase()}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-slate-400 text-xs hidden sm:table-cell">
                      {o.customer.name}
                    </td>
                    <td className="px-5 py-3">
                      <Badge variant={orderStatusBadge(o.status)}>
                        {o.status.charAt(0).toUpperCase() + o.status.slice(1)}
                      </Badge>
                    </td>
                    <td className="px-5 py-3 text-gray-500 dark:text-slate-400 text-xs hidden md:table-cell">
                      {formatDate(o.order_date)}
                    </td>
                    <td className="px-5 py-3 text-right font-bold text-gray-900 dark:text-slate-100">
                      {formatPrice(o.seller_total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Expanded Analytics Modal ── */}
      <ExpandedSellerAnalyticsModal
        isOpen={analyticsOpen}
        onClose={() => setAnalyticsOpen(false)}
      />
    </div>
  );
}

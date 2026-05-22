import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Package, ShoppingBag, TrendingUp, Tag,
  Mail, Phone, Calendar, ShieldCheck, ShieldOff,
  BarChart3, Star, Clock, CheckCircle, Truck, XCircle,
  Maximize2,
} from 'lucide-react';
import { adminApi } from '@/api/admin';
import type { SellerDetail, RevenueChartPoint } from '@/types';
import { formatPrice, formatDate, getImageUrl } from '@/utils/image';
import { Badge, orderStatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { RevenueChartSkeleton } from '@/components/ui/Skeleton';
import { SellerRevenueChart } from '@/components/admin/SellerRevenueChart';
import { AdminProductQuickViewModal } from '@/components/admin/AdminProductQuickViewModal';
import { ExpandedAnalyticsModal } from '@/components/admin/ExpandedAnalyticsModal';
import { SellerKYCModal } from '@/components/admin/SellerKYCModal';
import { cn } from '@/utils/cn';
import toast from 'react-hot-toast';

// ── Skeleton ──────────────────────────────────────────────────────────────────
function Sk({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-xl bg-gray-100 dark:bg-slate-700/60', className)} />;
}

function PageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Sk className="h-8 w-8" />
        <Sk className="h-6 w-48" />
      </div>
      <Sk className="h-40 w-full" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1,2,3,4].map(i => <Sk key={i} className="h-24" />)}
      </div>
      <div className="grid lg:grid-cols-2 gap-6">
        <Sk className="h-64" /><Sk className="h-64" />
      </div>
      <Sk className="h-48 w-full" />
    </div>
  );
}

// ── Status icon ───────────────────────────────────────────────────────────────
const STATUS_ICON: Record<string, React.ReactNode> = {
  pending:    <Clock size={13} className="text-yellow-500" />,
  processing: <Package size={13} className="text-blue-500" />,
  shipped:    <Truck size={13} className="text-orange-500" />,
  delivered:  <CheckCircle size={13} className="text-green-500" />,
  cancelled:  <XCircle size={13} className="text-red-500" />,
};

// ── Metric card ───────────────────────────────────────────────────────────────
function MetricCard({ label, value, icon, bg, color }: {
  label: string; value: string | number;
  icon: React.ReactNode; bg: string; color: string;
}) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-4 flex items-center gap-3">
      <div className={`p-2.5 rounded-xl ${bg} shrink-0`}>
        <div className={color}>{icon}</div>
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 dark:text-slate-400 truncate">{label}</p>
        <p className="text-lg font-bold text-gray-900 dark:text-slate-100 truncate">{value}</p>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export function SellerDetailPage() {
  const { uuid } = useParams<{ uuid: string }>();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<SellerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  // ── Chart state — fetched independently so the page doesn't block ──────────
  const [chartData, setChartData]       = useState<RevenueChartPoint[]>([]);
  const [chartLoading, setChartLoading] = useState(true);

  // ── Quick view modal state ────────────────────────────────────────────────
  const [quickViewUuid, setQuickViewUuid] = useState<string | null>(null);

  // ── Expanded analytics modal ──────────────────────────────────────────────
  const [analyticsOpen, setAnalyticsOpen] = useState(false);

  // ── Seller KYC modal ──────────────────────────────────────────────────────
  const [kycOpen, setKycOpen] = useState(false);

  useEffect(() => {
    if (!uuid) return;
    adminApi.getSellerDetails(uuid)
      .then((r) => setDetail(r.data.data ?? null))
      .catch(() => toast.error('Failed to load seller details'))
      .finally(() => setLoading(false));
  }, [uuid]);

  // Fetch chart data independently — doesn't block the rest of the page
  useEffect(() => {
    if (!uuid) return;
    setChartLoading(true);
    adminApi.getSellerRevenueChart(uuid)
      .then((r) => setChartData(r.data.data ?? []))
      .catch(() => {
        // Non-fatal — chart just stays empty
        setChartData([]);
      })
      .finally(() => setChartLoading(false));
  }, [uuid]);

  const handleToggle = async () => {
    if (!uuid || !detail) return;
    setToggling(true);
    try {
      await adminApi.toggleSellerStatus(uuid);
      toast.success('Seller status updated');
      // Refresh
      const r = await adminApi.getSellerDetails(uuid);
      setDetail(r.data.data ?? null);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Failed');
    } finally {
      setToggling(false);
    }
  };

  if (loading) return <PageSkeleton />;
  if (!detail) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500 dark:text-slate-400">Seller not found.</p>
        <Button variant="ghost" onClick={() => navigate('/admin/sellers')} className="mt-4">
          <ArrowLeft size={14} /> Back to Sellers
        </Button>
      </div>
    );
  }

  const { profile, metrics, top_products, recent_orders, approved_categories } = detail;

  return (
    <div className="space-y-6">
      {/* Back + header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/admin/sellers')}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors text-gray-500 dark:text-slate-400"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">{profile.username}</h1>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">Seller Performance Report</p>
          </div>
        </div>
        <Button
          variant={profile.is_active ? 'danger' : 'secondary'}
          size="sm"
          loading={toggling}
          onClick={handleToggle}
        >
          {profile.is_active
            ? <><ShieldOff size={14} /> Block Seller</>
            : <><ShieldCheck size={14} /> Unblock Seller</>
          }
        </Button>
      </div>

      {/* Profile card */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-5">
        <div className="flex items-center gap-4">
          {/* ── Real profile photo with initial-letter fallback ── */}
          <button
            onClick={() => setKycOpen(true)}
            className="shrink-0 group relative"
            title="View seller identity"
          >
            {profile.profile_photo ? (
              <img
                src={getImageUrl(profile.profile_photo)}
                alt={profile.username}
                className="w-16 h-16 rounded-full object-cover ring-2 ring-orange-400 shadow-lg group-hover:ring-4 transition-all duration-200"
                onError={(e) => {
                  // Swap to fallback div on broken image
                  const parent = (e.target as HTMLImageElement).parentElement;
                  if (parent) {
                    (e.target as HTMLImageElement).style.display = 'none';
                    const fallback = parent.querySelector('[data-fallback]') as HTMLElement | null;
                    if (fallback) fallback.style.display = 'flex';
                  }
                }}
              />
            ) : null}
            {/* Fallback initial — always rendered, hidden when photo loads */}
            <div
              data-fallback
              style={{ display: profile.profile_photo ? 'none' : 'flex' }}
              className="w-16 h-16 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 items-center justify-center text-white text-2xl font-bold shadow-lg ring-2 ring-orange-400 group-hover:ring-4 transition-all duration-200"
            >
              {profile.username[0]?.toUpperCase()}
            </div>
            {/* Hover overlay hint */}
            <div className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/20 transition-colors duration-200 flex items-center justify-center">
              <span className="text-white text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity duration-200">View</span>
            </div>
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {/* ── Clickable seller name → KYC modal ── */}
              <button
                onClick={() => setKycOpen(true)}
                className="text-lg font-bold text-gray-900 dark:text-slate-100 hover:text-blue-500 dark:hover:text-blue-400 hover:underline underline-offset-2 transition-all duration-150 cursor-pointer text-left"
                title="View seller identity"
              >
                {profile.username}
              </button>
              <Badge variant={profile.is_active ? 'success' : 'danger'}>
                {profile.is_active ? 'Active' : 'Blocked'}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5"><Mail size={13} /> {profile.email}</span>
              {profile.phone && <span className="flex items-center gap-1.5"><Phone size={13} /> {profile.phone}</span>}
              <span className="flex items-center gap-1.5">
                <Calendar size={13} /> Joined {profile.joined_at ? formatDate(profile.joined_at) : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Approved categories */}
        {approved_categories.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-slate-700">
            <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <Tag size={12} /> Approved Categories
            </p>
            <div className="flex flex-wrap gap-2">
              {approved_categories.map((cat) => (
                <span key={cat} className="text-xs bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 px-2.5 py-1 rounded-full font-medium">
                  {cat}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Active Products"  value={metrics.total_products_active} icon={<Package size={18} />}     bg="bg-blue-50 dark:bg-blue-500/10"   color="text-blue-500" />
        <MetricCard label="Total Orders"     value={metrics.total_orders}          icon={<ShoppingBag size={18} />} bg="bg-orange-50 dark:bg-orange-500/10" color="text-orange-500" />
        <MetricCard label="Total Revenue"    value={formatPrice(metrics.total_revenue)} icon={<TrendingUp size={18} />} bg="bg-green-50 dark:bg-green-500/10" color="text-green-500" />
        <MetricCard label="Avg Order Value"  value={formatPrice(metrics.avg_order_value)} icon={<Star size={18} />} bg="bg-purple-50 dark:bg-purple-500/10" color="text-purple-500" />
      </div>

      {/* Revenue chart + top products */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Revenue chart */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4 shrink-0">
            <h2 className="font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
              <BarChart3 size={16} className="text-orange-500" /> Revenue (Last 6 Months)
            </h2>
            {/* Maximize button → opens ExpandedAnalyticsModal */}
            <button
              onClick={() => setAnalyticsOpen(true)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-500/10 dark:text-slate-500 dark:hover:text-orange-400 transition-colors"
              title="Expand chart"
            >
              <Maximize2 size={15} />
            </button>
          </div>
          {/* Fixed height so ResponsiveContainer has a concrete parent */}
          <div className="h-52">
            {chartLoading ? (
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
            <span className="text-xs text-gray-400 dark:text-slate-500 hidden sm:block">Click to quick view</span>
          </div>
          {top_products.length === 0 ? (
            <div className="text-center py-10 text-gray-400 dark:text-slate-500">
              <Package size={28} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No sales data yet</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-slate-700/50">
              {top_products.map((p, idx) => (
                <div
                  key={p.uuid}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-orange-50/40 dark:hover:bg-orange-500/5 transition-colors cursor-pointer group"
                  onClick={() => setQuickViewUuid(p.uuid)}
                  title="Click to quick view"
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
                    {p.primary_image ? (
                      <img src={getImageUrl(p.primary_image)} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package size={14} className="text-gray-400 dark:text-slate-500" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-slate-200 truncate group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">{p.name}</p>
                    <p className="text-xs text-gray-400 dark:text-slate-500">{p.units_sold} units sold</p>
                  </div>
                  <p className="font-bold text-gray-900 dark:text-slate-100 text-sm shrink-0">{formatPrice(p.product_revenue)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent orders */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-700">
          <h2 className="font-bold text-gray-900 dark:text-slate-100">Recent Orders (Last 10)</h2>
        </div>
        {recent_orders.length === 0 ? (
          <div className="text-center py-10 text-gray-400 dark:text-slate-500">
            <ShoppingBag size={28} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">No orders yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-slate-700/50 border-b border-gray-100 dark:border-slate-700">
                <tr>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600 dark:text-slate-300">Order ID</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600 dark:text-slate-300">Date</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600 dark:text-slate-300">Status</th>
                  <th className="text-right px-5 py-3 font-semibold text-gray-600 dark:text-slate-300">Items</th>
                  <th className="text-right px-5 py-3 font-semibold text-gray-600 dark:text-slate-300">Seller Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
                {recent_orders.map((o) => (
                  <tr key={o.order_uuid} className="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        {STATUS_ICON[o.status] ?? <Package size={13} />}
                        <span className="font-mono text-xs text-gray-500 dark:text-slate-400">
                          #{o.order_uuid.slice(0, 8).toUpperCase()}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-gray-500 dark:text-slate-400 text-xs">{formatDate(o.date)}</td>
                    <td className="px-5 py-3">
                      <Badge variant={orderStatusBadge(o.status)}>
                        {o.status.charAt(0).toUpperCase() + o.status.slice(1)}
                      </Badge>
                    </td>
                    <td className="px-5 py-3 text-right text-gray-600 dark:text-slate-400">{o.item_count}</td>
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

      {/* Quick View Modal — seller context pre-filled */}
      <AdminProductQuickViewModal
        productUuid={quickViewUuid}
        sellerName={profile.username}
        sellerUuid={profile.uuid}
        onClose={() => setQuickViewUuid(null)}
      />

      {/* Expanded Analytics Modal */}
      <ExpandedAnalyticsModal
        isOpen={analyticsOpen}
        onClose={() => setAnalyticsOpen(false)}
        sellerUuid={profile.uuid}
        sellerName={profile.username}
      />

      {/* Seller KYC / Identity Modal */}
      <SellerKYCModal
        isOpen={kycOpen}
        onClose={() => setKycOpen(false)}
        detail={detail}
      />
    </div>
  );
}

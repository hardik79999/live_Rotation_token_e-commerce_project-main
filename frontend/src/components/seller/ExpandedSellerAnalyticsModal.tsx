/**
 * ExpandedSellerAnalyticsModal
 * ─────────────────────────────
 * Seller-scoped version of the Admin's ExpandedAnalyticsModal.
 * Calls GET /api/seller/analytics?range=... using the seller's own JWT.
 * No seller UUID needed — the backend resolves identity from the token.
 *
 * Identical UX to the admin version:
 *  - Time-range: Last 7 Days / Last 30 Days / Last 6 Months
 *  - Metric toggle: Gross Revenue / Number of Orders
 *  - Rich Recharts AreaChart with growth % tooltip
 *  - Export Data (CSV, client-side)
 *  - Smooth CSS enter/exit animation
 *  - Full dark-mode support
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  X, Download, TrendingUp, TrendingDown, Minus,
  BarChart2, ShoppingBag, RefreshCw,
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip,
  type TooltipProps,
} from 'recharts';
import { sellerApi } from '@/api/seller';
import type { AnalyticsPoint, AnalyticsMetric } from '@/types';
import { formatPrice } from '@/utils/image';
import { useThemeStore } from '@/store/themeStore';
import { cn } from '@/utils/cn';
import toast from 'react-hot-toast';

// ── Seller analytics only supports 7d / 30d / 6m (no ytd) ───────────────────
type SellerRange = '7d' | '30d' | '6m';

const RANGE_LABELS: Record<SellerRange, string> = {
  '7d':  'Last 7 Days',
  '30d': 'Last 30 Days',
  '6m':  'Last 6 Months',
};

// ── Theme tokens ──────────────────────────────────────────────────────────────
const THEME = {
  light: {
    gridStroke:   '#f1f5f9',
    axisText:     '#94a3b8',
    tooltipBg:    '#1e293b',
    tooltipBorder:'#334155',
    revTop:       'rgba(249,115,22,0.30)',
    revBot:       'rgba(249,115,22,0.01)',
    revStroke:    '#f97316',
    revDot:       '#f97316',
    ordTop:       'rgba(99,102,241,0.30)',
    ordBot:       'rgba(99,102,241,0.01)',
    ordStroke:    '#6366f1',
    ordDot:       '#6366f1',
  },
  dark: {
    gridStroke:   '#1e293b',
    axisText:     '#64748b',
    tooltipBg:    '#0f172a',
    tooltipBorder:'#1e293b',
    revTop:       'rgba(251,146,60,0.25)',
    revBot:       'rgba(251,146,60,0.01)',
    revStroke:    '#fb923c',
    revDot:       '#fb923c',
    ordTop:       'rgba(129,140,248,0.25)',
    ordBot:       'rgba(129,140,248,0.01)',
    ordStroke:    '#818cf8',
    ordDot:       '#818cf8',
  },
} as const;

// ── Y-axis formatter ──────────────────────────────────────────────────────────
function fmtY(v: number, metric: AnalyticsMetric): string {
  if (metric === 'orders') return String(v);
  if (v >= 100_000) return `₹${(v / 100_000).toFixed(1)}L`;
  if (v >= 1_000)   return `₹${(v / 1_000).toFixed(0)}K`;
  return `₹${v}`;
}

// ── Growth badge ──────────────────────────────────────────────────────────────
function GrowthBadge({ pct }: { pct: number | null }) {
  if (pct === null) return null;
  const abs = Math.abs(pct);
  if (pct > 0) return (
    <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-green-500">
      <TrendingUp size={11} /> +{abs.toFixed(1)}%
    </span>
  );
  if (pct < 0) return (
    <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-red-400">
      <TrendingDown size={11} /> -{abs.toFixed(1)}%
    </span>
  );
  return (
    <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-gray-400">
      <Minus size={11} /> 0%
    </span>
  );
}

// ── Rich tooltip ──────────────────────────────────────────────────────────────
function RichTooltip({
  active, payload, isDark, metric, allData,
}: TooltipProps<number, string> & {
  isDark: boolean;
  metric: AnalyticsMetric;
  allData: AnalyticsPoint[];
}) {
  if (!active || !payload?.length) return null;
  const c = isDark ? THEME.dark : THEME.light;
  const point = payload[0]?.payload as AnalyticsPoint;
  const value = metric === 'revenue' ? point.revenue : point.orders;

  const idx = allData.findIndex(d => d.date_key === point.date_key);
  let growth: number | null = null;
  if (idx > 0) {
    const prev = metric === 'revenue' ? allData[idx - 1].revenue : allData[idx - 1].orders;
    if (prev > 0) growth = ((value - prev) / prev) * 100;
    else if (value > 0) growth = 100;
    else growth = 0;
  }

  return (
    <div style={{
      background:   c.tooltipBg,
      border:       `1px solid ${c.tooltipBorder}`,
      borderRadius: '12px',
      padding:      '12px 16px',
      boxShadow:    '0 12px 32px rgba(0,0,0,0.3)',
      minWidth:     '160px',
    }}>
      <p style={{ color: '#94a3b8', fontSize: '11px', marginBottom: '8px', fontWeight: 600 }}>
        {point.full_label}
      </p>
      <p style={{
        color:      metric === 'revenue' ? '#f97316' : '#818cf8',
        fontSize:   '18px',
        fontWeight: 700,
        lineHeight: 1.2,
        marginBottom: '4px',
      }}>
        {metric === 'revenue' ? formatPrice(value) : `${value} orders`}
      </p>
      {growth !== null && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
          <span style={{ color: '#64748b', fontSize: '11px' }}>vs prev:</span>
          <span style={{
            color:      growth > 0 ? '#22c55e' : growth < 0 ? '#f87171' : '#94a3b8',
            fontSize:   '11px',
            fontWeight: 600,
          }}>
            {growth > 0 ? '+' : ''}{growth.toFixed(1)}%
          </span>
        </div>
      )}
    </div>
  );
}

// ── Summary stat pill ─────────────────────────────────────────────────────────
function Stat({ label, value, sub }: { label: string; value: string; sub?: React.ReactNode }) {
  return (
    <div className="bg-gray-50 dark:bg-slate-700/40 rounded-xl px-4 py-3 min-w-0">
      <p className="text-xs text-gray-500 dark:text-slate-400 font-medium truncate">{label}</p>
      <p className="text-lg font-bold text-gray-900 dark:text-slate-100 mt-0.5 truncate">{value}</p>
      {sub && <div className="mt-0.5">{sub}</div>}
    </div>
  );
}

// ── CSV export ────────────────────────────────────────────────────────────────
function exportCSV(data: AnalyticsPoint[], range: SellerRange) {
  const header = 'Date,Label,Revenue (₹),Orders\n';
  const rows = data.map(d =>
    `${d.date_key},"${d.full_label}",${d.revenue},${d.orders}`
  ).join('\n');
  const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `my_analytics_${range}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success('Data exported!');
}

// ── Main component ────────────────────────────────────────────────────────────
interface ExpandedSellerAnalyticsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ExpandedSellerAnalyticsModal({
  isOpen,
  onClose,
}: ExpandedSellerAnalyticsModalProps) {
  const { resolved } = useThemeStore();
  const isDark = resolved === 'dark';
  const c = isDark ? THEME.dark : THEME.light;

  const [range,   setRange]   = useState<SellerRange>('6m');
  const [metric,  setMetric]  = useState<AnalyticsMetric>('revenue');
  const [data,    setData]    = useState<AnalyticsPoint[]>([]);
  const [loading, setLoading] = useState(false);

  // ── Animation state ───────────────────────────────────────────────────────
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
    } else {
      setVisible(false);
      timerRef.current = setTimeout(() => setMounted(false), 250);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [isOpen]);

  useEffect(() => {
    if (mounted) document.body.style.overflow = 'hidden';
    else         document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [mounted]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (mounted) document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [mounted, onClose]);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await sellerApi.getAnalytics(range);
      setData(res.data.data ?? []);
    } catch {
      toast.error('Failed to load analytics');
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    if (isOpen) fetchData();
  }, [isOpen, fetchData]);

  if (!mounted) return null;

  // ── Derived stats ─────────────────────────────────────────────────────────
  const totalRevenue = data.reduce((s, d) => s + (isFinite(d.revenue) ? d.revenue : 0), 0);
  const totalOrders  = data.reduce((s, d) => s + (isFinite(d.orders)  ? d.orders  : 0), 0);
  const peakRevenue  = data.length > 0 ? Math.max(...data.map(d => isFinite(d.revenue) ? d.revenue : 0)) : 0;
  const peakPoint    = data.find(d => d.revenue === peakRevenue);
  const avgRevenue   = data.length > 0 ? totalRevenue / data.length : 0;

  let periodGrowth: number | null = null;
  if (data.length >= 2) {
    const half = Math.floor(data.length / 2);
    const first  = data.slice(0, half).reduce((s, d) => s + (metric === 'revenue' ? (isFinite(d.revenue) ? d.revenue : 0) : (isFinite(d.orders) ? d.orders : 0)), 0);
    const second = data.slice(half).reduce((s, d) => s + (metric === 'revenue' ? (isFinite(d.revenue) ? d.revenue : 0) : (isFinite(d.orders) ? d.orders : 0)), 0);
    if (first > 0) periodGrowth = ((second - first) / first) * 100;
    else if (second > 0) periodGrowth = 100;
    else periodGrowth = 0;
  }

  const gradId      = `sellerGrad_${metric}`;
  const stroke      = metric === 'revenue' ? c.revStroke : c.ordStroke;
  const dot         = metric === 'revenue' ? c.revDot    : c.ordDot;
  const gradTop     = metric === 'revenue' ? c.revTop    : c.ordTop;
  const gradBot     = metric === 'revenue' ? c.revBot    : c.ordBot;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-250"
        style={{ opacity: visible ? 1 : 0 }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={cn(
          'relative w-full max-w-5xl max-h-[92vh] flex flex-col',
          'bg-white dark:bg-slate-900',
          'rounded-2xl shadow-2xl dark:shadow-slate-950/80',
          'border border-gray-100 dark:border-slate-700/60',
          'transition-all duration-250',
        )}
        style={{
          opacity:   visible ? 1 : 0,
          transform: visible ? 'scale(1) translateY(0)' : 'scale(0.96) translateY(12px)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-slate-700/60 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-orange-50 dark:bg-orange-500/10 shrink-0">
              <BarChart2 size={16} className="text-orange-500" />
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-gray-900 dark:text-slate-100">My Revenue Analytics</h2>
              <p className="text-xs text-gray-500 dark:text-slate-400">{RANGE_LABELS[range]}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={fetchData}
              disabled={loading}
              className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:text-slate-500 dark:hover:text-slate-300 dark:hover:bg-slate-700/60 transition-colors disabled:opacity-40"
              title="Refresh"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={() => data.length > 0 && exportCSV(data, range)}
              disabled={loading || data.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Download size={13} /> Export Data
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:text-slate-500 dark:hover:text-slate-300 dark:hover:bg-slate-700/60 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── Controls ── */}
        <div className="flex flex-wrap items-center gap-3 px-5 py-3 border-b border-gray-50 dark:border-slate-700/40 shrink-0">
          {/* Range */}
          <div className="flex gap-1.5 flex-wrap">
            {(['7d', '30d', '6m'] as SellerRange[]).map(r => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all',
                  range === r
                    ? 'bg-orange-500 text-white border-orange-500 shadow-sm'
                    : 'border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-400 bg-white dark:bg-slate-800 hover:border-orange-400'
                )}
              >
                {RANGE_LABELS[r]}
              </button>
            ))}
          </div>

          <div className="hidden sm:block w-px h-5 bg-gray-200 dark:bg-slate-700" />

          {/* Metric */}
          <div className="flex gap-1.5">
            <button
              onClick={() => setMetric('revenue')}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all',
                metric === 'revenue'
                  ? 'bg-orange-500 text-white border-orange-500'
                  : 'border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-400 bg-white dark:bg-slate-800 hover:border-orange-400'
              )}
            >
              <TrendingUp size={12} /> Gross Revenue
            </button>
            <button
              onClick={() => setMetric('orders')}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all',
                metric === 'orders'
                  ? 'bg-indigo-500 text-white border-indigo-500'
                  : 'border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-400 bg-white dark:bg-slate-800 hover:border-indigo-400'
              )}
            >
              <ShoppingBag size={12} /> Orders
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Summary stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat
              label="Total Revenue"
              value={formatPrice(totalRevenue)}
              sub={<GrowthBadge pct={metric === 'revenue' ? periodGrowth : null} />}
            />
            <Stat
              label="Total Orders"
              value={String(totalOrders)}
              sub={<GrowthBadge pct={metric === 'orders' ? periodGrowth : null} />}
            />
            <Stat
              label="Avg / Period"
              value={metric === 'revenue'
                ? formatPrice(avgRevenue)
                : `${data.length > 0 ? (totalOrders / data.length).toFixed(1) : '0'}`
              }
            />
            <Stat
              label="Peak"
              value={metric === 'revenue'
                ? formatPrice(peakRevenue)
                : String(data.length > 0 ? Math.max(...data.map(d => isFinite(d.orders) ? d.orders : 0)) : 0)
              }
              sub={peakPoint
                ? <span className="text-xs text-gray-400 dark:text-slate-500">{peakPoint.full_label}</span>
                : undefined
              }
            />
          </div>

          {/* Chart */}
          <div className="bg-gray-50/50 dark:bg-slate-800/40 rounded-2xl border border-gray-100 dark:border-slate-700/50 p-4">
            {loading ? (
              <div className="h-72 flex items-end gap-1.5 animate-pulse px-2 pb-2">
                {[55, 40, 70, 45, 85, 60, 90, 50, 75, 65].map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 bg-gray-200 dark:bg-slate-700 rounded-t-sm"
                    style={{ height: `${h}%` }}
                  />
                ))}
              </div>
            ) : data.length === 0 ? (
              <div className="h-72 flex flex-col items-center justify-center text-gray-400 dark:text-slate-500 gap-2">
                <TrendingUp size={32} className="opacity-20" />
                <p className="text-sm">No data for this period</p>
              </div>
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"   stopColor={gradTop} />
                        <stop offset="100%" stopColor={gradBot} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={c.gridStroke} vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: c.axisText, fontSize: 11, fontWeight: 500 }}
                      axisLine={false} tickLine={false} dy={6}
                      interval={data.length > 15 ? Math.floor(data.length / 8) : 0}
                    />
                    <YAxis
                      tickFormatter={(v) => fmtY(v, metric)}
                      tick={{ fill: c.axisText, fontSize: 11 }}
                      axisLine={false} tickLine={false} width={56} dx={-4}
                    />
                    <Tooltip
                      content={(props: TooltipProps<number, string>) => (
                        <RichTooltip {...props} isDark={isDark} metric={metric} allData={data} />
                      )}
                      cursor={{ stroke: stroke, strokeWidth: 1, strokeDasharray: '4 4', strokeOpacity: 0.4 }}
                    />
                    <Area
                      key={metric}
                      type="monotone"
                      dataKey={metric}
                      stroke={stroke}
                      strokeWidth={2.5}
                      fill={`url(#${gradId})`}
                      dot={data.length <= 12 ? {
                        r: 4, fill: dot,
                        stroke: isDark ? '#0f172a' : '#ffffff', strokeWidth: 2,
                      } : false}
                      activeDot={{
                        r: 6, fill: dot,
                        stroke: isDark ? '#0f172a' : '#ffffff', strokeWidth: 2,
                        filter: `drop-shadow(0 0 6px ${stroke}80)`,
                      }}
                      isAnimationActive animationDuration={600} animationEasing="ease-out"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Data table */}
          {data.length > 0 && !loading && (
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                Recent Data Points
              </p>
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-slate-700/50 border-b border-gray-100 dark:border-slate-700">
                    <tr>
                      <th className="text-left px-4 py-2.5 font-semibold text-gray-600 dark:text-slate-300 text-xs">Period</th>
                      <th className="text-right px-4 py-2.5 font-semibold text-gray-600 dark:text-slate-300 text-xs">Revenue</th>
                      <th className="text-right px-4 py-2.5 font-semibold text-gray-600 dark:text-slate-300 text-xs">Orders</th>
                      <th className="text-right px-4 py-2.5 font-semibold text-gray-600 dark:text-slate-300 text-xs hidden sm:table-cell">vs Prev</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
                    {[...data].reverse().slice(0, 8).map((d, i) => {
                      const prevIdx = data.length - 1 - i - 1;
                      const prev    = prevIdx >= 0 ? data[prevIdx] : null;
                      const prevVal = prev ? (metric === 'revenue' ? prev.revenue : prev.orders) : null;
                      const curVal  = metric === 'revenue' ? d.revenue : d.orders;
                      const growth  = prevVal !== null && prevVal > 0
                        ? ((curVal - prevVal) / prevVal) * 100
                        : null;
                      return (
                        <tr key={d.date_key} className="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                          <td className="px-4 py-2.5 text-gray-700 dark:text-slate-300 text-xs font-medium">{d.full_label}</td>
                          <td className="px-4 py-2.5 text-right font-semibold text-gray-900 dark:text-slate-100 text-xs">{formatPrice(d.revenue)}</td>
                          <td className="px-4 py-2.5 text-right text-gray-600 dark:text-slate-400 text-xs">{d.orders}</td>
                          <td className="px-4 py-2.5 text-right hidden sm:table-cell">
                            <GrowthBadge pct={growth} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

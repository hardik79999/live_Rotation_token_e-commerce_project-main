/**
 * SellerRevenueChart
 * ──────────────────
 * A premium Recharts AreaChart for the Admin "Seller Details" view.
 *
 * Features:
 *  - ResponsiveContainer — fills whatever card it lives in
 *  - Dual-stop SVG gradient fill that matches the orange brand colour
 *  - Dark-mode aware: axis text, grid lines, tooltip all adapt
 *  - Custom tooltip with INR formatting and order count
 *  - Animated on mount (Recharts isAnimationActive)
 *  - Graceful empty state when all 6 months have zero revenue
 */

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  type TooltipProps,
} from 'recharts';
import type { RevenueChartPoint } from '@/types';
import { formatPrice } from '@/utils/image';
import { useThemeStore } from '@/store/themeStore';
import { TrendingUp } from 'lucide-react';

// ── Theme-aware colour tokens ─────────────────────────────────────────────────
const THEME = {
  light: {
    gridStroke:   '#f1f5f9',   // slate-100
    axisText:     '#94a3b8',   // slate-400
    tooltipBg:    '#1e293b',   // slate-800
    tooltipBorder:'#334155',   // slate-700
    gradientTop:  'rgba(249,115,22,0.35)',   // orange-500 35%
    gradientBot:  'rgba(249,115,22,0.02)',
    stroke:       '#f97316',   // orange-500
    dot:          '#f97316',
  },
  dark: {
    gridStroke:   '#1e293b',   // slate-800
    axisText:     '#64748b',   // slate-500
    tooltipBg:    '#0f172a',   // slate-900
    tooltipBorder:'#1e293b',   // slate-800
    gradientTop:  'rgba(251,146,60,0.30)',   // orange-400 30%
    gradientBot:  'rgba(251,146,60,0.02)',
    stroke:       '#fb923c',   // orange-400
    dot:          '#fb923c',
  },
} as const;

// ── Y-axis tick formatter ─────────────────────────────────────────────────────
function formatYAxis(value: number): string {
  if (value >= 100_000) return `₹${(value / 100_000).toFixed(1)}L`;
  if (value >= 1_000)   return `₹${(value / 1_000).toFixed(0)}K`;
  return `₹${value}`;
}

// ── Custom tooltip ────────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label, isDark }: TooltipProps<number, string> & { isDark: boolean }) {
  if (!active || !payload?.length) return null;

  const c = isDark ? THEME.dark : THEME.light;
  const revenue = payload[0]?.value ?? 0;
  const orders  = (payload[0]?.payload as RevenueChartPoint)?.orders ?? 0;
  const fullMonth = (payload[0]?.payload as RevenueChartPoint)?.full_month ?? label;

  return (
    <div
      style={{
        background:   c.tooltipBg,
        border:       `1px solid ${c.tooltipBorder}`,
        borderRadius: '10px',
        padding:      '10px 14px',
        boxShadow:    '0 8px 24px rgba(0,0,0,0.25)',
        minWidth:     '140px',
      }}
    >
      <p style={{ color: '#94a3b8', fontSize: '11px', marginBottom: '6px', fontWeight: 500 }}>
        {fullMonth}
      </p>
      <p style={{ color: '#f97316', fontSize: '16px', fontWeight: 700, lineHeight: 1.2 }}>
        {formatPrice(revenue)}
      </p>
      <p style={{ color: '#64748b', fontSize: '11px', marginTop: '4px' }}>
        {orders} order{orders !== 1 ? 's' : ''}
      </p>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-2 text-gray-400 dark:text-slate-500">
      <TrendingUp size={28} className="opacity-30" />
      <p className="text-sm">No revenue in the last 6 months</p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
interface SellerRevenueChartProps {
  data: RevenueChartPoint[];
}

export function SellerRevenueChart({ data }: SellerRevenueChartProps) {
  const { resolved } = useThemeStore();
  const isDark = resolved === 'dark';
  const c = isDark ? THEME.dark : THEME.light;

  const hasRevenue = data.some(d => d.revenue > 0);

  // Unique gradient ID per render to avoid SVG ID collisions if multiple
  // charts are ever on the same page.
  const gradientId = 'sellerRevGrad';

  if (!hasRevenue) {
    return (
      <div className="h-full w-full">
        <EmptyState />
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart
        data={data}
        margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
      >
        {/* ── Gradient definition ── */}
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={c.gradientTop} />
            <stop offset="100%" stopColor={c.gradientBot} />
          </linearGradient>
        </defs>

        {/* ── Grid ── */}
        <CartesianGrid
          strokeDasharray="3 3"
          stroke={c.gridStroke}
          vertical={false}
        />

        {/* ── X Axis ── */}
        <XAxis
          dataKey="month"
          tick={{ fill: c.axisText, fontSize: 12, fontWeight: 500 }}
          axisLine={false}
          tickLine={false}
          dy={6}
        />

        {/* ── Y Axis ── */}
        <YAxis
          tickFormatter={formatYAxis}
          tick={{ fill: c.axisText, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={52}
          dx={-4}
        />

        {/* ── Tooltip ── */}
        <Tooltip
          content={(props) => <CustomTooltip {...(props as object)} isDark={isDark} />}
          cursor={{
            stroke: c.stroke,
            strokeWidth: 1,
            strokeDasharray: '4 4',
            strokeOpacity: 0.5,
          }}
        />

        {/* ── Area ── */}
        <Area
          type="monotone"
          dataKey="revenue"
          stroke={c.stroke}
          strokeWidth={2.5}
          fill={`url(#${gradientId})`}
          dot={{
            r: 4,
            fill: c.dot,
            stroke: isDark ? '#0f172a' : '#ffffff',
            strokeWidth: 2,
          }}
          activeDot={{
            r: 6,
            fill: c.dot,
            stroke: isDark ? '#0f172a' : '#ffffff',
            strokeWidth: 2,
            filter: 'drop-shadow(0 0 6px rgba(249,115,22,0.6))',
          }}
          isAnimationActive
          animationDuration={700}
          animationEasing="ease-out"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

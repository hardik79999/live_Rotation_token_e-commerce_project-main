import React from 'react';
import { cn } from '@/utils/cn';

// ── Base pulse block ──────────────────────────────────────────
function Bone({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={cn('animate-pulse bg-gray-200 dark:bg-slate-700 rounded-lg', className)}
      style={style}
    />
  );
}

// ── Product card skeleton ─────────────────────────────────────
export function ProductCardSkeleton() {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col">
      {/* Image placeholder */}
      <Bone className="aspect-square w-full rounded-none" />
      {/* Info */}
      <div className="p-3 flex flex-col gap-2 flex-1">
        <Bone className="h-3 w-16" />
        <Bone className="h-4 w-full" />
        <Bone className="h-4 w-3/4" />
        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <Bone className="h-5 w-16" />
          <Bone className="h-7 w-14 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

// ── Product grid skeleton (n cards) ──────────────────────────
export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}

// ── Profile skeleton ──────────────────────────────────────────
export function ProfileSkeleton() {
  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-pulse">
      {/* Avatar + name */}
      <div className="flex items-center gap-4">
        <div className="w-20 h-20 rounded-full bg-gray-200 shrink-0" />
        <div className="flex-1 space-y-2">
          <Bone className="h-5 w-40" />
          <Bone className="h-4 w-56" />
          <Bone className="h-4 w-24" />
        </div>
      </div>
      {/* Form fields */}
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="space-y-1.5">
          <Bone className="h-3.5 w-24" />
          <Bone className="h-10 w-full rounded-xl" />
        </div>
      ))}
      <Bone className="h-10 w-32 rounded-xl" />
    </div>
  );
}

// ── Order card skeleton ───────────────────────────────────────
export function OrderSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-4 space-y-3 animate-pulse">
          <div className="flex items-center justify-between">
            <Bone className="h-4 w-32" />
            <Bone className="h-6 w-20 rounded-full" />
          </div>
          <div className="flex gap-3">
            <Bone className="w-14 h-14 rounded-lg shrink-0" />
            <div className="flex-1 space-y-2">
              <Bone className="h-4 w-3/4" />
              <Bone className="h-3 w-1/2" />
            </div>
            <Bone className="h-5 w-16 shrink-0" />
          </div>
          <div className="flex items-center justify-between pt-1">
            <Bone className="h-3 w-28" />
            <Bone className="h-8 w-24 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Dashboard stats skeleton ──────────────────────────────────
export function StatsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className={`grid grid-cols-2 lg:grid-cols-${count} gap-4`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-4 space-y-3 animate-pulse">
          <div className="flex items-center justify-between">
            <Bone className="h-4 w-24" />
            <Bone className="w-9 h-9 rounded-xl" />
          </div>
          <Bone className="h-7 w-20" />
          <Bone className="h-3 w-32" />
        </div>
      ))}
    </div>
  );
}

// ── Table row skeleton ────────────────────────────────────────
export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden animate-pulse">
      {/* Header */}
      <div className="flex gap-4 px-4 py-3 border-b border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-700/50">
        {Array.from({ length: cols }).map((_, i) => (
          <Bone key={i} className="h-3.5 flex-1" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 px-4 py-3.5 border-b border-gray-50 dark:border-slate-700/50 last:border-0">
          {Array.from({ length: cols }).map((_, j) => (
            <Bone key={j} className="h-4 flex-1" style={{ opacity: 1 - j * 0.1 }} />
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Revenue chart skeleton ────────────────────────────────────
export function RevenueChartSkeleton() {
  // Mimics the shape of an AreaChart: 6 bars of varying heights + axis lines
  const heights = [45, 65, 40, 80, 55, 90]; // % heights for visual variety
  return (
    <div className="w-full h-full flex flex-col gap-3 animate-pulse px-1 pt-1">
      {/* Chart area */}
      <div className="flex-1 flex items-end gap-2 pb-1">
        {heights.map((h, i) => (
          <div key={i} className="flex-1 flex flex-col justify-end gap-1">
            <div
              className="w-full bg-gray-200 dark:bg-slate-700 rounded-t-sm"
              style={{ height: `${h}%` }}
            />
          </div>
        ))}
      </div>
      {/* X-axis labels */}
      <div className="flex gap-2">
        {heights.map((_, i) => (
          <Bone key={i} className="flex-1 h-3" />
        ))}
      </div>
    </div>
  );
}

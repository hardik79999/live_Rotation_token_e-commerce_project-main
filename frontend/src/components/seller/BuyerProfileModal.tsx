/**
 * BuyerProfileModal
 * ─────────────────
 * Shows a buyer's contact details, shipping address, and order history
 * with THIS seller — fetched from the privacy-scoped backend endpoint.
 *
 * Security: the backend verifies the order belongs to this seller before
 * returning any data. The frontend never receives data it shouldn't see.
 *
 * Animation: CSS scale + opacity transition (no Framer Motion).
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  X, Mail, Phone, MapPin, ShoppingBag,
  Clock, CheckCircle, Truck, XCircle, Package,
  Star, TrendingUp,
} from 'lucide-react';
import { sellerApi } from '@/api/seller';
import type { BuyerDetails } from '@/types';
import { formatPrice, formatDate, getImageUrl } from '@/utils/image';
import { Badge, orderStatusBadge } from '@/components/ui/Badge';
import { cn } from '@/utils/cn';
import toast from 'react-hot-toast';

// ── Status icon ───────────────────────────────────────────────────────────────
const STATUS_ICON: Record<string, React.ReactNode> = {
  pending:    <Clock size={12} className="text-yellow-500" />,
  processing: <Package size={12} className="text-blue-500" />,
  shipped:    <Truck size={12} className="text-orange-500" />,
  delivered:  <CheckCircle size={12} className="text-green-500" />,
  cancelled:  <XCircle size={12} className="text-red-500" />,
};

// ── Customer value badge ──────────────────────────────────────────────────────
function ValueBadge({ label, color }: { label: string; color: string }) {
  const colorMap: Record<string, string> = {
    gold:  'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-500/30',
    green: 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-500/30',
    blue:  'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/30',
    gray:  'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-400 border-gray-200 dark:border-slate-600',
  };
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full border',
      colorMap[color] ?? colorMap.gray,
    )}>
      {label}
    </span>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function ModalSkeleton() {
  return (
    <div className="animate-pulse space-y-5 p-5">
      {/* Avatar + name */}
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-gray-200 dark:bg-slate-700 shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-5 w-36 bg-gray-200 dark:bg-slate-700 rounded-lg" />
          <div className="h-3.5 w-48 bg-gray-200 dark:bg-slate-700 rounded" />
          <div className="h-3.5 w-32 bg-gray-200 dark:bg-slate-700 rounded" />
        </div>
      </div>
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-16 bg-gray-200 dark:bg-slate-700 rounded-xl" />
        ))}
      </div>
      {/* Address */}
      <div className="h-20 bg-gray-200 dark:bg-slate-700 rounded-xl" />
      {/* History rows */}
      {[1, 2, 3].map(i => (
        <div key={i} className="h-10 bg-gray-200 dark:bg-slate-700 rounded-lg" />
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
interface BuyerProfileModalProps {
  /** UUID of the order whose buyer we want to view. null = closed. */
  orderUuid: string | null;
  /** Customer name shown in the header while loading */
  customerName?: string;
  onClose: () => void;
}

export function BuyerProfileModal({
  orderUuid,
  customerName,
  onClose,
}: BuyerProfileModalProps) {
  const isOpen = orderUuid !== null;

  const [buyer,   setBuyer]   = useState<BuyerDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(false);

  // Animation
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
    } else {
      setVisible(false);
      timerRef.current = setTimeout(() => setMounted(false), 220);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [isOpen]);

  // Body scroll lock
  useEffect(() => {
    if (mounted) document.body.style.overflow = 'hidden';
    else         document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [mounted]);

  // Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (mounted) document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [mounted, onClose]);

  // Fetch buyer details
  const fetchBuyer = useCallback(async (uuid: string) => {
    setLoading(true);
    setError(false);
    setBuyer(null);
    try {
      const res = await sellerApi.getBuyerDetails(uuid);
      setBuyer(res.data.data ?? null);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 403) {
        toast.error('Access denied: this order is not yours');
      } else {
        toast.error('Failed to load buyer details');
      }
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (orderUuid) fetchBuyer(orderUuid);
  }, [orderUuid, fetchBuyer]);

  if (!mounted) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Buyer Profile"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/55 backdrop-blur-sm transition-opacity duration-220"
        style={{ opacity: visible ? 1 : 0 }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={cn(
          'relative w-full max-w-md max-h-[90vh] flex flex-col',
          'bg-white dark:bg-slate-900',
          'rounded-2xl shadow-2xl dark:shadow-slate-950/70',
          'border border-gray-100 dark:border-slate-700/60',
          'transition-all duration-220',
        )}
        style={{
          opacity:   visible ? 1 : 0,
          transform: visible ? 'scale(1) translateY(0)' : 'scale(0.95) translateY(10px)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-slate-700/60 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-500/10 shrink-0">
              <ShoppingBag size={15} className="text-blue-500" />
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-gray-900 dark:text-slate-100 text-sm truncate">
                Buyer Profile
              </h2>
              {customerName && (
                <p className="text-xs text-gray-400 dark:text-slate-500 truncate">{customerName}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:text-slate-500 dark:hover:text-slate-300 dark:hover:bg-slate-700/60 transition-colors shrink-0"
          >
            <X size={17} />
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto">
          {loading && <ModalSkeleton />}

          {error && !loading && (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-slate-500 px-5">
              <ShoppingBag size={36} className="mb-3 opacity-20" />
              <p className="text-sm font-medium text-center">Could not load buyer details</p>
              <button
                onClick={() => orderUuid && fetchBuyer(orderUuid)}
                className="mt-3 text-xs text-orange-500 hover:text-orange-600 font-medium"
              >
                Try again
              </button>
            </div>
          )}

          {buyer && !loading && (
            <div className="p-5 space-y-5">

              {/* ── Identity ── */}
              <div className="flex items-center gap-4">
                {/* Avatar */}
                {buyer.profile_photo ? (
                  <img
                    src={getImageUrl(buyer.profile_photo)}
                    alt={buyer.name}
                    className="w-16 h-16 rounded-full object-cover ring-2 ring-blue-400 shadow-md shrink-0"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-2xl font-bold shadow-md ring-2 ring-blue-400 shrink-0">
                    {buyer.name[0]?.toUpperCase() ?? '?'}
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100 truncate">
                    {buyer.name}
                  </h3>
                  <div className="space-y-1 mt-1">
                    <p className="text-xs text-gray-500 dark:text-slate-400 flex items-center gap-1.5 truncate">
                      <Mail size={11} className="shrink-0" /> {buyer.email}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-slate-400 flex items-center gap-1.5">
                      <Phone size={11} className="shrink-0" /> {buyer.phone}
                    </p>
                  </div>
                </div>
              </div>

              {/* ── Customer Value ── */}
              <div className="bg-gray-50 dark:bg-slate-800/60 rounded-xl border border-gray-100 dark:border-slate-700/60 p-4">
                <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                  <Star size={11} /> Customer Value
                </p>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <ValueBadge label={buyer.value_label} color={buyer.value_color} />
                  <div className="flex gap-4 text-right">
                    <div>
                      <p className="text-lg font-bold text-gray-900 dark:text-slate-100">
                        {buyer.total_orders_with_seller}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-slate-500">
                        order{buyer.total_orders_with_seller !== 1 ? 's' : ''} with you
                      </p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-gray-900 dark:text-slate-100">
                        {formatPrice(buyer.total_spent_with_seller)}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-slate-500">total spent</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Shipping Address ── */}
              <div className="bg-gray-50 dark:bg-slate-800/60 rounded-xl border border-gray-100 dark:border-slate-700/60 p-4">
                <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <MapPin size={11} /> Shipping Address (This Order)
                </p>
                <p className="text-sm text-gray-700 dark:text-slate-300 leading-relaxed">
                  {buyer.shipping_address}
                </p>
                {buyer.shipping_phone && buyer.shipping_phone !== buyer.phone && (
                  <p className="text-xs text-gray-400 dark:text-slate-500 mt-1.5 flex items-center gap-1">
                    <Phone size={10} /> {buyer.shipping_phone}
                  </p>
                )}
              </div>

              {/* ── Order History with this seller ── */}
              {buyer.order_history.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <TrendingUp size={11} /> Order History with You
                  </p>
                  <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden">
                    <div className="divide-y divide-gray-50 dark:divide-slate-700/50">
                      {buyer.order_history.map((o) => (
                        <div
                          key={o.order_uuid}
                          className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
                        >
                          <div className="shrink-0">
                            {STATUS_ICON[o.status] ?? <Package size={12} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-mono text-xs text-gray-500 dark:text-slate-400">
                              #{o.order_uuid.slice(0, 8).toUpperCase()}
                            </p>
                            {o.date && (
                              <p className="text-xs text-gray-400 dark:text-slate-500">
                                {formatDate(o.date)} · {o.item_count} item{o.item_count !== 1 ? 's' : ''}
                              </p>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <Badge variant={orderStatusBadge(o.status)}>
                              {o.status.charAt(0).toUpperCase() + o.status.slice(1)}
                            </Badge>
                            <p className="text-xs font-bold text-gray-900 dark:text-slate-100">
                              {formatPrice(o.seller_total)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="px-5 py-3.5 border-t border-gray-100 dark:border-slate-700/60 shrink-0 bg-gray-50/50 dark:bg-slate-800/30 rounded-b-2xl">
          <p className="text-xs text-center text-gray-400 dark:text-slate-500">
            Data shown is scoped to your orders only · Privacy protected
          </p>
        </div>
      </div>
    </div>
  );
}

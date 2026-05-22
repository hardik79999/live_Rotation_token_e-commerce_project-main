import { useEffect, useState } from 'react';
import {
  Package, RefreshCw, ChevronDown, Search,
  User, MapPin, CreditCard, Clock, CheckCircle,
  Truck, XCircle, ShoppingBag, Bell, AlertCircle,
  AlertTriangle, Download, RotateCcw, CheckCircle2,
  TrendingUp, DollarSign, ArrowDownLeft,
} from 'lucide-react';
import { sellerApi } from '@/api/seller';
import type { SellerOrder, OrderStatus, SellerOrderReturn } from '@/types';
import { getImageUrl, formatPrice, formatDate } from '@/utils/image';
import { Badge, orderStatusBadge, returnStatusBadge, RETURN_STATUS_LABEL } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { BuyerProfileModal } from '@/components/seller/BuyerProfileModal';
import { useSellerOrders } from '@/hooks/useSellerOrders';
import { cn } from '@/utils/cn';
import toast from 'react-hot-toast';

// ── Status flow — only forward transitions are allowed ────────────────────────
const STATUS_FLOW: OrderStatus[] = ['pending', 'processing', 'shipped', 'delivered'];

// ── Status stepper config ─────────────────────────────────────────────────────
const STATUS_CONFIG: Record<OrderStatus, {
  label: string;
  icon: React.ReactNode;
  activeClass: string;
  doneClass: string;
  idleClass: string;
}> = {
  pending: {
    label: 'Pending',
    icon: <Clock size={13} />,
    activeClass: 'bg-yellow-500 text-white border-yellow-500 shadow-sm shadow-yellow-500/30',
    doneClass:   'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-300 dark:border-yellow-500/40',
    idleClass:   'bg-white dark:bg-slate-800 text-gray-400 dark:text-slate-500 border-gray-200 dark:border-slate-600 hover:border-yellow-400',
  },
  processing: {
    label: 'Processing',
    icon: <Package size={13} />,
    activeClass: 'bg-blue-500 text-white border-blue-500 shadow-sm shadow-blue-500/30',
    doneClass:   'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-500/40',
    idleClass:   'bg-white dark:bg-slate-800 text-gray-400 dark:text-slate-500 border-gray-200 dark:border-slate-600 hover:border-blue-400',
  },
  shipped: {
    label: 'Shipped',
    icon: <Truck size={13} />,
    activeClass: 'bg-orange-500 text-white border-orange-500 shadow-sm shadow-orange-500/30',
    doneClass:   'bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400 border-orange-300 dark:border-orange-500/40',
    idleClass:   'bg-white dark:bg-slate-800 text-gray-400 dark:text-slate-500 border-gray-200 dark:border-slate-600 hover:border-orange-400',
  },
  delivered: {
    label: 'Delivered',
    icon: <CheckCircle size={13} />,
    activeClass: 'bg-green-500 text-white border-green-500 shadow-sm shadow-green-500/30',
    doneClass:   'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 border-green-300 dark:border-green-500/40',
    idleClass:   'bg-white dark:bg-slate-800 text-gray-400 dark:text-slate-500 border-gray-200 dark:border-slate-600 hover:border-green-400',
  },
  cancelled: {
    label: 'Cancelled',
    icon: <XCircle size={13} />,
    activeClass: 'bg-red-500 text-white border-red-500',
    doneClass:   'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400 border-red-300 dark:border-red-500/40',
    idleClass:   'bg-white dark:bg-slate-800 text-gray-400 dark:text-slate-500 border-gray-200 dark:border-slate-600',
  },
};

// ── Return Confirm Modal ──────────────────────────────────────────────────────
function ReturnConfirmModal({
  order,
  onConfirm,
  onClose,
}: {
  order: SellerOrder;
  onConfirm: (note: string) => Promise<void>;
  onClose: () => void;
}) {
  const [note,       setNote]       = useState('');
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleConfirm = async () => {
    setConfirming(true);
    try { await onConfirm(note); onClose(); }
    finally { setConfirming(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-slate-700/60 animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col items-center pt-6 pb-2 px-6">
          <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-500/15 flex items-center justify-center mb-4">
            <CheckCircle2 size={22} className="text-green-600 dark:text-green-400" />
          </div>
          <h2 className="text-base font-bold text-gray-900 dark:text-slate-100 text-center">
            Approve this return?
          </h2>
          <p className="text-xs font-mono text-gray-400 dark:text-slate-500 mt-1">
            #{order.order_uuid.slice(0, 8).toUpperCase()}
          </p>
        </div>

        <div className="px-6 pb-2 space-y-3">
          <div className="bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30 rounded-xl p-4 text-sm text-green-700 dark:text-green-400 space-y-1.5">
            <p className="font-semibold">This will immediately:</p>
            <ul className="text-green-600/90 dark:text-green-400/80 space-y-1 list-disc list-inside text-xs">
              <li>Refund <strong>{formatPrice(order.seller_total)}</strong> to the customer's wallet or original payment</li>
              <li>Restock all your items from this order</li>
              <li>Reverse any loyalty points the customer earned</li>
            </ul>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 dark:text-slate-400 mb-1 block">
              Note to customer <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              maxLength={300}
              placeholder="e.g. Approved. Please ship the item back within 5 days."
              className="w-full border border-gray-300 dark:border-slate-600 rounded-xl px-3 py-2 text-xs bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:border-green-500 resize-none transition-colors"
            />
          </div>
        </div>

        <div className="flex gap-3 px-6 py-5">
          <button
            onClick={onClose}
            disabled={confirming}
            className="flex-1 px-4 py-2.5 text-sm font-semibold rounded-xl border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={confirming}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl bg-green-600 hover:bg-green-700 active:scale-95 text-white transition-all shadow-sm disabled:opacity-60"
          >
            {confirming
              ? <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg>
              : <CheckCircle2 size={15} />
            }
            {confirming ? 'Processing…' : 'Yes, Approve & Refund'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Return Panel — shown inside expanded order ────────────────────────────────
const REASON_LABEL: Record<string, string> = {
  defective:        '🔧 Defective / Not Working',
  wrong_item:       '📦 Wrong Item Delivered',
  wrong_size:       '📏 Wrong Size / Fit',
  not_as_described: '🖼️ Not as Described',
  damaged_shipping: '💥 Damaged During Shipping',
  changed_mind:     '🤔 Changed My Mind',
  other:            '📝 Other',
};

function ReturnPanel({
  ret,
  order,
  onApprove,
  onReject,
}: {
  ret: SellerOrderReturn;
  order: SellerOrder;
  onApprove: () => void;
  onReject: () => void;
}) {
  const isPending  = ret.status === 'pending';
  const isRefunded = ret.status === 'refunded';
  const isRejected = ret.status === 'rejected';

  return (
    <div className={cn(
      'rounded-xl border p-4 space-y-3',
      isPending  && 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30',
      isRefunded && 'bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/30',
      isRejected && 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30',
      !isPending && !isRefunded && !isRejected && 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30',
    )}>
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <RotateCcw size={14} className={cn(
            isPending  && 'text-amber-600 dark:text-amber-400',
            isRefunded && 'text-green-600 dark:text-green-400',
            isRejected && 'text-red-600 dark:text-red-400',
          )} />
          <span className={cn(
            'text-sm font-bold',
            isPending  && 'text-amber-700 dark:text-amber-400',
            isRefunded && 'text-green-700 dark:text-green-400',
            isRejected && 'text-red-700 dark:text-red-400',
          )}>
            Return Request
          </span>
        </div>
        <Badge variant={returnStatusBadge(ret.status)}>
          {RETURN_STATUS_LABEL[ret.status] ?? ret.status}
        </Badge>
      </div>

      {/* Details grid */}
      <div className="grid sm:grid-cols-2 gap-2 text-xs">
        <div>
          <span className="text-gray-500 dark:text-slate-400">Reason: </span>
          <span className="font-medium text-gray-700 dark:text-slate-300">
            {REASON_LABEL[ret.reason] ?? ret.reason}
          </span>
        </div>
        <div>
          <span className="text-gray-500 dark:text-slate-400">Requested: </span>
          <span className="font-medium text-gray-700 dark:text-slate-300">
            {formatDate(ret.created_at ?? '')}
          </span>
        </div>
        {isRefunded && ret.refund_amount && (
          <div>
            <span className="text-gray-500 dark:text-slate-400">Refunded: </span>
            <span className="font-semibold text-green-700 dark:text-green-400">
              {formatPrice(ret.refund_amount)} via {ret.refund_method === 'razorpay' ? 'Razorpay' : 'Wallet'}
            </span>
          </div>
        )}
      </div>

      {/* Customer comment */}
      {ret.customer_comments && (
        <div className="bg-white/60 dark:bg-slate-800/60 rounded-lg px-3 py-2 text-xs italic text-gray-600 dark:text-slate-400 border border-white/80 dark:border-slate-700/50">
          "{ret.customer_comments}"
        </div>
      )}

      {/* Evidence images */}
      {ret.image_urls.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {ret.image_urls.map((url, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => window.open(url, '_blank')}
              className="w-16 h-16 rounded-lg overflow-hidden border border-gray-200 dark:border-slate-600 hover:scale-105 transition-transform shadow-sm"
            >
              <img src={getImageUrl(url)} alt={`evidence ${idx + 1}`} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {/* Action buttons — only for pending */}
      {isPending && (
        <div className="flex gap-2 pt-1">
          <button
            onClick={onApprove}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-green-600 hover:bg-green-700 active:scale-95 text-white transition-all shadow-sm"
          >
            <CheckCircle2 size={13} /> Approve Return
          </button>
          <button
            onClick={onReject}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-red-500 hover:bg-red-600 active:scale-95 text-white transition-all shadow-sm"
          >
            <XCircle size={13} /> Reject Return
          </button>
        </div>
      )}
    </div>
  );
}

// ── Skeleton loader ───────────────────────────────────────────────────────────
function OrderSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-4 animate-pulse">
          <div className="flex items-center gap-4">
            <div className="flex -space-x-2">
              {[1, 2].map((j) => (
                <div key={j} className="w-11 h-11 rounded-xl bg-gray-200 dark:bg-slate-700 border-2 border-white dark:border-slate-800" />
              ))}
            </div>
            <div className="flex-1 space-y-2">
              <div className="h-3 bg-gray-200 dark:bg-slate-700 rounded w-2/3" />
              <div className="flex gap-2">
                <div className="h-5 bg-gray-200 dark:bg-slate-700 rounded-full w-16" />
                <div className="h-5 bg-gray-200 dark:bg-slate-700 rounded-full w-20" />
              </div>
              <div className="h-3 bg-gray-200 dark:bg-slate-700 rounded w-1/3" />
            </div>
            <div className="hidden sm:block space-y-1 text-right">
              <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-20" />
              <div className="h-3 bg-gray-200 dark:bg-slate-700 rounded w-16" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Analytics summary row ─────────────────────────────────────────────────────
function AnalyticsSummaryRow({ analytics }: { analytics: import('@/hooks/useSellerOrders').SellerOrdersAnalytics }) {
  const cards = [
    {
      label:   'Total Revenue',
      value:   formatPrice(analytics.totalRevenue),
      icon:    <DollarSign size={18} />,
      bg:      'bg-green-50 dark:bg-green-500/10',
      iconBg:  'bg-green-100 dark:bg-green-500/20',
      color:   'text-green-600 dark:text-green-400',
      border:  'border-green-100 dark:border-green-500/20',
    },
    {
      label:   'Total Orders',
      value:   analytics.totalOrders,
      icon:    <ShoppingBag size={18} />,
      bg:      'bg-blue-50 dark:bg-blue-500/10',
      iconBg:  'bg-blue-100 dark:bg-blue-500/20',
      color:   'text-blue-600 dark:text-blue-400',
      border:  'border-blue-100 dark:border-blue-500/20',
    },
    {
      label:   'Return Requests',
      value:   analytics.returnCount,
      sub:     analytics.pendingReturns > 0 ? `${analytics.pendingReturns} pending` : 'none pending',
      icon:    <RotateCcw size={18} />,
      bg:      analytics.pendingReturns > 0 ? 'bg-amber-50 dark:bg-amber-500/10' : 'bg-gray-50 dark:bg-slate-700/50',
      iconBg:  analytics.pendingReturns > 0 ? 'bg-amber-100 dark:bg-amber-500/20' : 'bg-gray-100 dark:bg-slate-700',
      color:   analytics.pendingReturns > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-500 dark:text-slate-400',
      border:  analytics.pendingReturns > 0 ? 'border-amber-100 dark:border-amber-500/20' : 'border-gray-100 dark:border-slate-700',
    },
    {
      label:   'Value Refunded',
      value:   formatPrice(analytics.returnedValue),
      sub:     `${analytics.returnCount} return${analytics.returnCount !== 1 ? 's' : ''}`,
      icon:    <ArrowDownLeft size={18} />,
      bg:      'bg-red-50 dark:bg-red-500/10',
      iconBg:  'bg-red-100 dark:bg-red-500/20',
      color:   'text-red-600 dark:text-red-400',
      border:  'border-red-100 dark:border-red-500/20',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
      {cards.map((c) => (
        <div key={c.label} className={cn('rounded-2xl border p-4 flex items-center gap-3', c.bg, c.border)}>
          <div className={cn('p-2.5 rounded-xl shrink-0', c.iconBg)}>
            <span className={c.color}>{c.icon}</span>
          </div>
          <div className="min-w-0">
            <p className="text-xs text-gray-500 dark:text-slate-400 truncate">{c.label}</p>
            <p className={cn('text-lg font-bold truncate', c.color)}>{c.value}</p>
            {c.sub && <p className="text-xs text-gray-400 dark:text-slate-500 truncate">{c.sub}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Cancel Confirmation Modal ─────────────────────────────────────────────────
// Inline — tightly coupled to this page, no need for a separate file.
function CancelConfirmationModal({
  isOpen,
  orderUuid,
  onConfirm,
  onClose,
}: {
  isOpen: boolean;
  orderUuid: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  const [confirming, setConfirming] = useState(false);

  // Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (isOpen) document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div
        className={cn(
          'relative w-full max-w-sm',
          'bg-white dark:bg-slate-900',
          'rounded-2xl shadow-2xl dark:shadow-slate-950/70',
          'border border-gray-100 dark:border-slate-700/60',
          'animate-in fade-in zoom-in-95 duration-200',
        )}
        onClick={e => e.stopPropagation()}
      >
        {/* Warning icon header */}
        <div className="flex flex-col items-center pt-6 pb-2 px-6">
          <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-500/15 flex items-center justify-center mb-4">
            <AlertTriangle size={22} className="text-red-600 dark:text-red-400" />
          </div>
          <h2 className="text-base font-bold text-gray-900 dark:text-slate-100 text-center">
            Cancel this order?
          </h2>
          <p className="text-xs font-mono text-gray-400 dark:text-slate-500 mt-1">
            #{orderUuid.slice(0, 8).toUpperCase()}
          </p>
        </div>

        {/* Body */}
        <div className="px-6 pb-2">
          <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl p-4 text-sm text-red-700 dark:text-red-400 space-y-1.5">
            <p className="font-semibold">This action cannot be undone.</p>
            <p className="text-red-600/80 dark:text-red-400/80">
              The items in this order will be returned to your inventory stock automatically.
              The customer will be notified by email.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-6 py-5">
          <button
            onClick={onClose}
            disabled={confirming}
            className="flex-1 px-4 py-2.5 text-sm font-semibold rounded-xl border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            Keep Order
          </button>
          <button
            onClick={handleConfirm}
            disabled={confirming}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl bg-red-600 hover:bg-red-700 active:scale-95 text-white transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {confirming ? (
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            ) : (
              <XCircle size={15} />
            )}
            {confirming ? 'Cancelling…' : 'Yes, Cancel Order'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Status Stepper component ──────────────────────────────────────────────────
function StatusStepper({
  currentStatus,
  orderUuid,
  onUpdate,
}: {
  currentStatus: OrderStatus;
  orderUuid: string;
  onUpdate: (orderUuid: string, newStatus: OrderStatus) => Promise<void>;
}) {
  const [updating, setUpdating] = useState<OrderStatus | null>(null);
  const [justDone, setJustDone] = useState<OrderStatus | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);

  // ── Terminal states — fully locked ───────────────────────────────────────
  if (currentStatus === 'cancelled') {
    return (
      <div className="flex items-center gap-2 text-sm text-red-500 dark:text-red-400 font-medium">
        <XCircle size={15} /> Order cancelled — no further updates allowed
      </div>
    );
  }

  if (currentStatus === 'delivered') {
    return (
      <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 font-medium">
        <CheckCircle size={15} /> Order delivered — no further updates needed
      </div>
    );
  }

  const currentIdx = STATUS_FLOW.indexOf(currentStatus);

  const handleForwardClick = async (status: OrderStatus) => {
    const targetIdx = STATUS_FLOW.indexOf(status);
    if (targetIdx !== currentIdx + 1) return;

    setUpdating(status);
    try {
      await onUpdate(orderUuid, status);
      setJustDone(status);
      setTimeout(() => setJustDone(null), 2000);
    } finally {
      setUpdating(null);
    }
  };

  const handleCancelConfirm = async () => {
    setUpdating('cancelled');
    try {
      await onUpdate(orderUuid, 'cancelled');
    } finally {
      setUpdating(null);
    }
  };

  const isBusy = updating !== null;

  return (
    <>
      <div className="space-y-3">
        {/* ── Forward progress pills ── */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
            <AlertCircle size={11} /> Update Status
            <span className="font-normal normal-case text-gray-400 dark:text-slate-500">
              — click the next step to advance
            </span>
          </p>
          <div className="flex items-center gap-1.5 flex-wrap">
            {STATUS_FLOW.map((status, idx) => {
              const cfg        = STATUS_CONFIG[status];
              const isDone     = idx < currentIdx;
              const isCurrent  = idx === currentIdx;
              const isNext     = idx === currentIdx + 1;
              const isFuture   = idx > currentIdx + 1;
              const isUpdating = updating === status;
              const isDoneAnim = justDone === status;

              return (
                <button
                  key={status}
                  disabled={!isNext || isBusy}
                  onClick={() => handleForwardClick(status)}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all',
                    isCurrent  && cfg.activeClass,
                    isDone     && cfg.doneClass,
                    isNext     && !isBusy && cn(cfg.idleClass, 'cursor-pointer hover:scale-105 active:scale-95'),
                    isFuture   && 'opacity-30 cursor-not-allowed bg-white dark:bg-slate-800 text-gray-300 dark:text-slate-600 border-gray-100 dark:border-slate-700',
                    isBusy     && 'opacity-60 cursor-not-allowed',
                    isDoneAnim && 'ring-2 ring-green-400 ring-offset-1',
                  )}
                  title={isNext ? `Mark as ${cfg.label}` : isCurrent ? 'Current status' : ''}
                >
                  {isUpdating ? (
                    <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                  ) : isDoneAnim ? (
                    <CheckCircle size={13} />
                  ) : (
                    cfg.icon
                  )}
                  {cfg.label}
                  {isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70 animate-pulse" />}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-gray-400 dark:text-slate-500">
            📧 Customer will receive an email notification on each update
          </p>
        </div>

        {/* ── Divider ── */}
        <div className="border-t border-gray-100 dark:border-slate-700/60" />

        {/* ── Cancel Order button ── */}
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-gray-400 dark:text-slate-500">
            Need to cancel? Stock will be restored automatically.
          </p>
          <button
            disabled={isBusy}
            onClick={() => setShowCancelModal(true)}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all shrink-0',
              'text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/40',
              'hover:bg-red-50 dark:hover:bg-red-500/10 hover:border-red-400 dark:hover:border-red-500/60',
              'active:scale-95',
              isBusy && 'opacity-50 cursor-not-allowed',
            )}
            title="Cancel this order and restore inventory"
          >
            {updating === 'cancelled' ? (
              <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            ) : (
              <XCircle size={13} />
            )}
            Cancel Order
          </button>
        </div>
      </div>

      {/* ── Cancel Confirmation Modal ── */}
      <CancelConfirmationModal
        isOpen={showCancelModal}
        orderUuid={orderUuid}
        onConfirm={handleCancelConfirm}
        onClose={() => setShowCancelModal(false)}
      />
    </>
  );
}

const STATUS_ICONS: Record<string, React.ReactNode> = {
  pending:    <Clock size={15} className="text-yellow-500" />,
  processing: <Package size={15} className="text-blue-500" />,
  shipped:    <Truck size={15} className="text-orange-500" />,
  delivered:  <CheckCircle size={15} className="text-green-500" />,
  cancelled:  <XCircle size={15} className="text-red-500" />,
};

// ── PDF Invoice download button ───────────────────────────────────────────────
function DownloadInvoiceButton({ orderUuid }: { orderUuid: string }) {
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    setLoading(true);
    try {
      const res  = await sellerApi.downloadInvoicePdf(orderUuid);
      const blob = new Blob([res.data as BlobPart], { type: 'application/pdf' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `ShopHub-Invoice-${orderUuid.slice(0, 8).toUpperCase()}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Invoice PDF downloaded!');
    } catch {
      toast.error('Failed to download invoice');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant="outline" size="sm" loading={loading} onClick={handleDownload}>
      <Download size={14} /> Download Invoice PDF
    </Button>
  );
}

// ── Alerts widget for orders ──────────────────────────────────────────────────
function OrderAlertsWidget({
  orders,
  onFilterClick,
}: {
  orders: SellerOrder[];
  onFilterClick: (status: string) => void;
}) {
  const alerts: {
    id:      string;
    message: string;
    type:    'warning' | 'info' | 'success';
    filter:  string;
    hint:    string;
  }[] = [];

  const needsShipping = orders.filter(o => o.status === 'processing');
  if (needsShipping.length > 0) {
    alerts.push({
      id:      'ship',
      type:    'warning',
      message: `${needsShipping.length} order${needsShipping.length > 1 ? 's need' : ' needs'} to be shipped`,
      filter:  'processing',
      hint:    'Click to view',
    });
  }

  const pendingOrders = orders.filter(o => o.status === 'pending');
  if (pendingOrders.length > 0) {
    alerts.push({
      id:      'pending',
      type:    'info',
      message: `${pendingOrders.length} new order${pendingOrders.length > 1 ? 's are' : ' is'} waiting to be processed`,
      filter:  'pending',
      hint:    'Click to view',
    });
  }

  const pendingReturns = orders.filter(o => o.return?.status === 'pending');
  if (pendingReturns.length > 0) {
    alerts.push({
      id:      'returns',
      type:    'warning',
      message: `${pendingReturns.length} return request${pendingReturns.length > 1 ? 's need' : ' needs'} your decision`,
      filter:  'delivered',
      hint:    'Click to view',
    });
  }

  if (alerts.length === 0) return null;

  return (
    <div className="space-y-2 mb-6">
      {alerts.map(a => (
        <button
          key={a.id}
          onClick={() => onFilterClick(a.filter)}
          className={cn(
            'w-full flex items-center gap-2.5 px-4 py-3 rounded-xl border text-sm font-medium',
            'transition-all duration-150 active:scale-[0.99] text-left',
            'hover:shadow-sm hover:brightness-95 dark:hover:brightness-110',
            a.type === 'warning' && 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-400',
            a.type === 'info'    && 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30 text-blue-700 dark:text-blue-400',
            a.type === 'success' && 'bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/30 text-green-700 dark:text-green-400',
          )}
        >
          <Bell size={14} className="shrink-0" />
          <span className="flex-1">{a.message}</span>
          <span className="text-xs opacity-60 shrink-0 flex items-center gap-1">
            {a.hint} →
          </span>
        </button>
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function SellerOrdersPage() {
  const { orders, loading, analytics, fetchOrders, updateStatus, approveReturn, rejectReturn } = useSellerOrders();

  const [filtered,     setFiltered]     = useState<SellerOrder[]>([]);
  const [search,       setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [expandedUuid, setExpandedUuid] = useState<string | null>(null);

  const [buyerOrderUuid,    setBuyerOrderUuid]    = useState<string | null>(null);
  const [buyerCustomerName, setBuyerCustomerName] = useState<string | undefined>();
  const [returnConfirmOrder, setReturnConfirmOrder] = useState<SellerOrder | null>(null);

  useEffect(() => {
    let result = orders;
    if (statusFilter === 'return_requested') {
      result = result.filter(o => o.return?.status === 'pending');
    } else if (statusFilter === 'refunded') {
      result = result.filter(o => o.return?.status === 'refunded');
    } else if (statusFilter !== 'all') {
      result = result.filter(o => o.status === statusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        o =>
          o.order_uuid.toLowerCase().includes(q) ||
          o.customer.name.toLowerCase().includes(q) ||
          o.customer.email.toLowerCase().includes(q) ||
          o.items.some(i => i.product_name.toLowerCase().includes(q))
      );
    }
    setFiltered(result);
  }, [search, statusFilter, orders]);

  const handleUpdateStatus = async (orderUuid: string, newStatus: OrderStatus) => {
    try {
      await updateStatus(orderUuid, newStatus);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Failed to update status');
      throw err;
    }
  };

  const handleApproveReturn = async (orderUuid: string, note: string) => {
    try {
      await approveReturn(orderUuid, note);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Failed to approve return');
      throw err;
    }
  };

  const handleRejectReturn = async (orderUuid: string) => {
    try {
      await rejectReturn(orderUuid);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Failed to reject return');
    }
  };

  const filterTabs = [
    { key: 'all',              label: 'All',              count: orders.length },
    { key: 'pending',          label: 'Pending',          count: analytics.pendingCount },
    { key: 'processing',       label: 'Processing',       count: analytics.processingCount },
    { key: 'shipped',          label: 'Shipped',          count: analytics.shippedCount },
    { key: 'delivered',        label: 'Delivered',        count: analytics.deliveredCount },
    { key: 'cancelled',        label: 'Cancelled',        count: analytics.cancelledCount },
    { key: 'return_requested', label: '↩ Returns',        count: analytics.pendingReturns },
    { key: 'refunded',         label: '💰 Refunded',      count: analytics.returnCount - analytics.pendingReturns },
  ];

  return (
    <div>
      {/* ── Action alerts ── */}
      <OrderAlertsWidget orders={orders} onFilterClick={(status) => setStatusFilter(status)} />

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Order Management</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
            Orders containing your products — update status to notify customers
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchOrders} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </Button>
      </div>

      {/* ── Analytics summary row ── */}
      <AnalyticsSummaryRow analytics={analytics} />

      {/* ── Filters ── */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" />
          <input
            type="text"
            placeholder="Search by order ID, customer, product..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:border-orange-500 dark:focus:border-orange-400 transition-colors"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {filterTabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setStatusFilter(t.key)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                statusFilter === t.key
                  ? 'bg-orange-500 text-white border-orange-500 shadow-sm'
                  : t.key === 'return_requested' && t.count > 0
                  ? 'border-amber-400 dark:border-amber-500/50 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10'
                  : 'border-gray-300 dark:border-slate-600 text-gray-600 dark:text-slate-400 hover:border-orange-400 dark:hover:border-orange-500 bg-white dark:bg-slate-800',
              )}
            >
              {t.label}
              {t.count > 0 && (
                <span className={cn(
                  'ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold',
                  statusFilter === t.key ? 'bg-white/30 text-white' : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-400',
                )}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Orders list ── */}
      {loading ? (
        <OrderSkeleton />
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <ShoppingBag size={64} className="text-gray-200 dark:text-slate-700 mx-auto mb-4" />
          <p className="text-xl font-semibold text-gray-600 dark:text-slate-400 mb-1">
            {orders.length === 0 ? 'No orders yet' : 'No orders match your filter'}
          </p>
          <p className="text-gray-400 dark:text-slate-500 text-sm">
            {orders.length === 0
              ? 'Orders will appear here once customers purchase your products.'
              : 'Try changing the status filter or search term.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((order) => {
            const isExpanded = expandedUuid === order.order_uuid;

            return (
              <div
                key={order.order_uuid}
                className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden shadow-sm hover:shadow-md dark:hover:shadow-slate-900/50 transition-shadow"
              >
                {/* ── Order header row ── */}
                <div
                  className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 cursor-pointer"
                  onClick={() => setExpandedUuid(isExpanded ? null : order.order_uuid)}
                >
                  {/* Product thumbnails */}
                  <div className="flex shrink-0">
                    {order.items.length > 0 ? (
                      <div className="flex -space-x-2">
                        {order.items.slice(0, 3).map((item, idx) => (
                          <div
                            key={idx}
                            style={{ zIndex: 3 - idx }}
                            className="w-11 h-11 rounded-xl overflow-hidden border-2 border-white dark:border-slate-800 bg-gray-100 dark:bg-slate-700 shrink-0 shadow-sm"
                          >
                            <img
                              src={getImageUrl(item.image)}
                              alt={item.product_name}
                              className="w-full h-full object-cover"
                              onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder-product.png'; }}
                            />
                          </div>
                        ))}
                        {order.items.length > 3 && (
                          <div className="w-11 h-11 rounded-xl border-2 border-white dark:border-slate-800 bg-gray-100 dark:bg-slate-700 flex items-center justify-center text-xs font-bold text-gray-500 dark:text-slate-400 shrink-0 shadow-sm">
                            +{order.items.length - 3}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-2 bg-orange-50 dark:bg-orange-500/10 rounded-lg">
                        {STATUS_ICONS[order.status] ?? <Package size={15} />}
                      </div>
                    )}
                  </div>

                  {/* Order info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500 dark:text-slate-400 truncate mb-0.5">
                      {order.items.map((i) => i.product_name).join(', ')}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs text-gray-400 dark:text-slate-500">
                        #{order.order_uuid.slice(0, 8).toUpperCase()}
                      </span>
                      <Badge variant={orderStatusBadge(order.status)}>
                        {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                      </Badge>
                      {/* Return request badge */}
                      {order.return && (
                        <Badge variant={returnStatusBadge(order.return.status)}>
                          <RotateCcw size={10} className="mr-1" />
                          {order.return.status === 'pending' ? 'Return Pending' : RETURN_STATUS_LABEL[order.return.status]}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-gray-800 dark:text-slate-200 mt-0.5 truncate">
                      <button
                        className="hover:text-blue-500 dark:hover:text-blue-400 hover:underline underline-offset-2 transition-colors cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          setBuyerOrderUuid(order.order_uuid);
                          setBuyerCustomerName(order.customer.name);
                        }}
                        title="View buyer profile"
                      >
                        {order.customer.name}
                      </button>
                      <span className="text-gray-400 dark:text-slate-500 font-normal ml-1 text-xs">
                        · {order.items.reduce((s, i) => s + i.quantity, 0)} item{order.items.reduce((s, i) => s + i.quantity, 0) !== 1 ? 's' : ''}
                      </span>
                    </p>
                  </div>

                  {/* Amount + date */}
                  <div className="hidden sm:block text-right shrink-0">
                    <p className="font-bold text-gray-900 dark:text-slate-100">{formatPrice(order.seller_total)}</p>
                    <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{formatDate(order.order_date)}</p>
                  </div>

                  <ChevronDown
                    size={18}
                    className={cn('text-gray-400 dark:text-slate-500 shrink-0 transition-transform', isExpanded && 'rotate-180')}
                  />
                </div>

                {/* ── Expanded detail ── */}
                {isExpanded && (
                  <div className="border-t border-gray-100 dark:border-slate-700 p-4 space-y-5 bg-gray-50/50 dark:bg-slate-900/30">

                    {/* Customer + Address */}
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-4">
                        <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                          <User size={12} /> Customer
                        </p>
                        <button
                          className="font-semibold text-gray-800 dark:text-slate-200 hover:text-blue-500 dark:hover:text-blue-400 hover:underline underline-offset-2 transition-colors cursor-pointer text-left block"
                          onClick={() => {
                            setBuyerOrderUuid(order.order_uuid);
                            setBuyerCustomerName(order.customer.name);
                          }}
                          title="View buyer profile"
                        >
                          {order.customer.name}
                        </button>
                        <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">{order.customer.email}</p>
                        <p className="text-sm text-gray-500 dark:text-slate-400">{order.customer.phone}</p>
                      </div>
                      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-4">
                        <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                          <MapPin size={12} /> Shipping Address
                        </p>
                        <p className="text-sm text-gray-700 dark:text-slate-300 leading-relaxed">{order.shipping_address}</p>
                        <p className="text-xs text-gray-400 dark:text-slate-500 mt-2 flex items-center gap-1">
                          <CreditCard size={11} />
                          {order.payment_method.toUpperCase()}
                        </p>
                      </div>
                    </div>

                    {/* Items */}
                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden">
                      <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide px-4 py-3 border-b border-gray-100 dark:border-slate-700 flex items-center gap-1.5">
                        <ShoppingBag size={12} /> Your Items in This Order
                      </p>
                      <div className="divide-y divide-gray-50 dark:divide-slate-700/50">
                        {order.items.map((item, idx) => (
                          <div key={idx} className="flex items-center gap-3 px-4 py-3">
                            <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 dark:bg-slate-700 shrink-0">
                              <img
                                src={getImageUrl(item.image)}
                                alt={item.product_name}
                                className="w-full h-full object-cover"
                                onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder-product.png'; }}
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-800 dark:text-slate-200 truncate">{item.product_name}</p>
                              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                                {formatPrice(item.price_at_purchase)} × {item.quantity}
                              </p>
                            </div>
                            <p className="font-bold text-gray-900 dark:text-slate-100 text-sm shrink-0">
                              {formatPrice(item.subtotal)}
                            </p>
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-between items-center px-4 py-3 bg-orange-50 dark:bg-orange-500/10 border-t border-orange-100 dark:border-orange-500/20">
                        <span className="text-sm font-semibold text-orange-700 dark:text-orange-400">Your Revenue</span>
                        <span className="font-bold text-orange-700 dark:text-orange-400">{formatPrice(order.seller_total)}</span>
                      </div>
                    </div>

                    {/* ── Return Request Panel ── */}
                    {order.return && (
                      <ReturnPanel
                        ret={order.return}
                        order={order}
                        onApprove={() => setReturnConfirmOrder(order)}
                        onReject={() => handleRejectReturn(order.order_uuid)}
                      />
                    )}

                    {/* ── Status Stepper (replaces dropdown) ── */}
                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-4">
                      <StatusStepper
                        currentStatus={order.status}
                        orderUuid={order.order_uuid}
                        onUpdate={handleUpdateStatus}
                      />
                    </div>

                    {/* ── Invoice PDF download ── */}
                    <div className="flex justify-end">
                      <DownloadInvoiceButton orderUuid={order.order_uuid} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Buyer Profile Modal ── */}
      <BuyerProfileModal
        orderUuid={buyerOrderUuid}
        customerName={buyerCustomerName}
        onClose={() => { setBuyerOrderUuid(null); setBuyerCustomerName(undefined); }}
      />

      {/* ── Return Confirm Modal ── */}
      {returnConfirmOrder && (
        <ReturnConfirmModal
          order={returnConfirmOrder}
          onConfirm={(note) => handleApproveReturn(returnConfirmOrder.order_uuid, note)}
          onClose={() => setReturnConfirmOrder(null)}
        />
      )}
    </div>
  );
}

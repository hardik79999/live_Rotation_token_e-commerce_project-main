import { useEffect, useState, useCallback } from 'react';
import {
  RotateCcw, CheckCircle, XCircle, Clock, ChevronDown,
  ChevronUp, RefreshCw, AlertTriangle, Package, Search, X,
} from 'lucide-react';
import { adminApi } from '@/api/admin';
import type { AdminReturnItem } from '@/types';
import { Badge, returnStatusBadge, RETURN_STATUS_LABEL } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { PageSpinner } from '@/components/ui/Spinner';
import { formatPrice, formatDate, getImageUrl } from '@/utils/image';
import { cn } from '@/utils/cn';
import toast from 'react-hot-toast';

// ── Reason labels ─────────────────────────────────────────────
const REASON_LABEL: Record<string, string> = {
  defective:        '🔧 Defective / Not Working',
  wrong_item:       '📦 Wrong Item Delivered',
  wrong_size:       '📏 Wrong Size / Fit',
  not_as_described: '🖼️ Not as Described',
  damaged_shipping: '💥 Damaged During Shipping',
  changed_mind:     '🤔 Changed My Mind',
  other:            '📝 Other',
};

const STATUS_TABS = ['all', 'pending', 'approved', 'rejected', 'refunded'] as const;
type StatusTab = typeof STATUS_TABS[number];

const TAB_COLORS: Record<StatusTab, string> = {
  all:      'border-gray-400 text-gray-600 dark:text-slate-300',
  pending:  'border-yellow-500 text-yellow-600 dark:text-yellow-400',
  approved: 'border-blue-500 text-blue-600 dark:text-blue-400',
  rejected: 'border-red-500 text-red-600 dark:text-red-400',
  refunded: 'border-green-500 text-green-600 dark:text-green-400',
};

// ── Action Modal ──────────────────────────────────────────────
function ActionModal({
  ret,
  action,
  onClose,
  onDone,
}: {
  ret: AdminReturnItem;
  action: 'approve' | 'reject';
  onClose: () => void;
  onDone: () => void;
}) {
  const [notes,      setNotes]      = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isApprove = action === 'approve';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await adminApi.processReturn(ret.uuid, {
        action,
        admin_notes: notes.trim() || undefined,
      });
      toast.success(
        isApprove
          ? `Return approved. ₹${ret.order?.total_amount?.toLocaleString('en-IN')} refund initiated.`
          : 'Return request rejected.',
      );
      onDone();
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message;
      toast.error(msg || 'Action failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={isApprove ? 'Approve Return & Issue Refund' : 'Reject Return Request'}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Summary banner */}
        <div className={cn(
          'rounded-xl p-4 border text-sm',
          isApprove
            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-500/30'
            : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-500/30',
        )}>
          <p className={cn(
            'font-semibold mb-1',
            isApprove ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400',
          )}>
            {isApprove ? '✓ Approving this return will:' : '✗ Rejecting this return will:'}
          </p>
          {isApprove ? (
            <ul className="text-green-600 dark:text-green-500 space-y-0.5 text-xs list-disc list-inside">
              <li>Refund <strong>₹{ret.order?.total_amount?.toLocaleString('en-IN')}</strong> to customer
                {ret.order?.payment_method && ret.order.payment_method !== 'cod'
                  ? ' via Razorpay or wallet'
                  : ' wallet'}
              </li>
              <li>Restore product stock for all items</li>
              <li>Reverse loyalty points earned from this order</li>
            </ul>
          ) : (
            <p className="text-red-600 dark:text-red-500 text-xs">
              No refund will be issued. The customer will be notified.
            </p>
          )}
        </div>

        {/* Order snapshot */}
        <div className="bg-gray-50 dark:bg-slate-700/50 rounded-xl p-3 text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-slate-400">Order</span>
            <span className="font-mono font-semibold text-gray-700 dark:text-slate-300">
              #{ret.order?.uuid.slice(0, 8).toUpperCase()}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-slate-400">Customer</span>
            <span className="text-gray-700 dark:text-slate-300">{ret.customer?.username}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-slate-400">Reason</span>
            <span className="text-gray-700 dark:text-slate-300">{REASON_LABEL[ret.reason] ?? ret.reason}</span>
          </div>
          <div className="flex justify-between font-semibold">
            <span className="text-gray-500 dark:text-slate-400">Refund Amount</span>
            <span className="text-orange-600 dark:text-orange-400">
              {formatPrice(ret.order?.total_amount ?? 0)}
            </span>
          </div>
        </div>

        {/* Admin notes */}
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-1 block">
            Admin Notes <span className="text-gray-400 font-normal">(optional — visible to customer)</span>
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder={
              isApprove
                ? 'e.g. Refund processed. Please ship the item back within 7 days.'
                : 'e.g. Item shows signs of use. Return policy does not cover this case.'
            }
            className="w-full border border-gray-300 dark:border-slate-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:border-orange-500 resize-none transition-colors"
          />
        </div>

        <div className="flex gap-3 pt-1">
          <Button type="button" variant="ghost" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button
            type="submit"
            loading={submitting}
            className={cn('flex-1', !isApprove && 'bg-red-500 hover:bg-red-600')}
          >
            {isApprove
              ? <><CheckCircle size={14} /> Approve & Refund</>
              : <><XCircle size={14} /> Reject Return</>
            }
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ── Return Card ───────────────────────────────────────────────
function ReturnCard({
  ret,
  onAction,
}: {
  ret: AdminReturnItem;
  onAction: (ret: AdminReturnItem, action: 'approve' | 'reject') => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isPending = ret.status === 'pending';

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm overflow-hidden">
      {/* Header row */}
      <div className="flex items-start gap-4 p-4">
        {/* Product thumbnails */}
        {(ret.order?.items ?? []).length > 0 && (
          <div className="flex -space-x-2 shrink-0">
            {ret.order!.items.slice(0, 3).map((item, idx) => (
              <div
                key={idx}
                style={{ zIndex: 3 - idx }}
                className="w-12 h-12 rounded-xl overflow-hidden border-2 border-white dark:border-slate-800 bg-gray-100 dark:bg-slate-700 shrink-0"
              >
                <img
                  src={getImageUrl(item.image)}
                  alt={item.product_name}
                  className="w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder-product.png'; }}
                />
              </div>
            ))}
          </div>
        )}

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-mono text-xs text-gray-400 dark:text-slate-500">
              #{ret.order?.uuid.slice(0, 8).toUpperCase()}
            </span>
            <Badge variant={returnStatusBadge(ret.status)}>
              {RETURN_STATUS_LABEL[ret.status] ?? ret.status}
            </Badge>
            {isPending && (
              <span className="inline-flex items-center gap-1 text-xs text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/30 px-2 py-0.5 rounded-full">
                <Clock size={10} /> Awaiting action
              </span>
            )}
          </div>

          <p className="text-sm font-medium text-gray-800 dark:text-slate-200 truncate">
            {ret.order?.items.map((i) => i.product_name).join(', ')}
          </p>

          <div className="flex items-center gap-3 mt-1 flex-wrap text-xs text-gray-400 dark:text-slate-500">
            <span>👤 {ret.customer?.username} · {ret.customer?.email}</span>
            <span>📅 {formatDate(ret.created_at ?? '')}</span>
            <span className="font-semibold text-orange-600 dark:text-orange-400">
              {formatPrice(ret.order?.total_amount ?? 0)}
            </span>
          </div>

          <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
            {REASON_LABEL[ret.reason] ?? ret.reason}
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 shrink-0">
          {isPending && (
            <>
              <Button
                size="sm"
                onClick={() => onAction(ret, 'approve')}
                className="bg-green-500 hover:bg-green-600 text-white"
              >
                <CheckCircle size={13} /> Approve
              </Button>
              <Button
                size="sm"
                variant="danger"
                onClick={() => onAction(ret, 'reject')}
              >
                <XCircle size={13} /> Reject
              </Button>
            </>
          )}
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1 text-xs text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 transition-colors self-end"
          >
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            {expanded ? 'Less' : 'Details'}
          </button>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-gray-50 dark:border-slate-700/50 px-4 py-3 space-y-3">
          {/* Customer comment */}
          {ret.customer_comments && (
            <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl p-3">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1 flex items-center gap-1">
                <AlertTriangle size={11} /> Customer's Comment
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-500 italic">"{ret.customer_comments}"</p>
            </div>
          )}

          {/* Order items table */}
          <div>
            <p className="text-xs font-semibold text-gray-600 dark:text-slate-400 mb-2">Order Items</p>
            <div className="space-y-1.5">
              {ret.order?.items.map((item, idx) => (
                <div key={idx} className="flex items-center gap-3 text-xs">
                  <div className="w-8 h-8 rounded-lg overflow-hidden bg-gray-100 dark:bg-slate-700 shrink-0">
                    <img
                      src={getImageUrl(item.image)}
                      alt={item.product_name}
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder-product.png'; }}
                    />
                  </div>
                  <span className="flex-1 text-gray-700 dark:text-slate-300 truncate">{item.product_name}</span>
                  <span className="text-gray-400 dark:text-slate-500">×{item.quantity}</span>
                  <span className="font-medium text-gray-700 dark:text-slate-300">
                    {formatPrice(item.price_at_purchase * item.quantity)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Refund / rejection info */}
          {ret.status === 'refunded' && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-500/30 rounded-xl p-3 text-xs">
              <p className="font-semibold text-green-700 dark:text-green-400 mb-1">Refund Issued</p>
              <p className="text-green-600 dark:text-green-500">
                ₹{ret.refund_amount?.toLocaleString('en-IN')} via{' '}
                {ret.refund_method === 'razorpay' ? 'Razorpay (original payment)' : 'Wallet'}
              </p>
              {ret.razorpay_refund_id && (
                <p className="font-mono text-green-500 dark:text-green-600 mt-0.5">
                  Refund ID: {ret.razorpay_refund_id}
                </p>
              )}
            </div>
          )}

          {ret.admin_notes && (
            <div className="bg-gray-50 dark:bg-slate-700/50 rounded-xl p-3 text-xs">
              <p className="font-semibold text-gray-600 dark:text-slate-400 mb-1">Admin Notes</p>
              <p className="text-gray-500 dark:text-slate-400 italic">"{ret.admin_notes}"</p>
            </div>
          )}

          {/* Payment method + delivery date */}
          <div className="flex gap-4 text-xs text-gray-400 dark:text-slate-500">
            <span>Payment: <strong className="text-gray-600 dark:text-slate-300 uppercase">
              {ret.order?.payment_method ?? '—'}
            </strong></span>
            {ret.order?.delivered_at && (
              <span>Delivered: <strong className="text-gray-600 dark:text-slate-300">
                {formatDate(ret.order.delivered_at)}
              </strong></span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────
export function AdminReturnsPage() {
  const [returns,    setReturns]    = useState<AdminReturnItem[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [tab,        setTab]        = useState<StatusTab>('pending');
  const [total,      setTotal]      = useState(0);
  const [search,     setSearch]     = useState('');
  const [actionTarget, setActionTarget] = useState<{
    ret: AdminReturnItem;
    action: 'approve' | 'reject';
  } | null>(null);

  const fetchReturns = useCallback(async (status: StatusTab) => {
    setLoading(true);
    try {
      const res = await adminApi.getReturns({ status, per_page: 50 });
      setReturns(res.data.data ?? []);
      setTotal(res.data.total ?? 0);
    } catch {
      toast.error('Failed to load returns');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchReturns(tab); }, [tab, fetchReturns]);

  const pendingCount = returns.filter((r) => r.status === 'pending').length;

  const filtered = search.trim()
    ? returns.filter((r) =>
        r.customer?.username.toLowerCase().includes(search.toLowerCase()) ||
        r.customer?.email.toLowerCase().includes(search.toLowerCase()) ||
        r.order?.uuid.toLowerCase().includes(search.toLowerCase())
      )
    : returns;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
            <RotateCcw size={22} className="text-orange-500" /> Return Requests
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
            {total} total · {pendingCount > 0
              ? <span className="text-yellow-600 dark:text-yellow-400 font-medium">{pendingCount} pending action</span>
              : 'all clear'}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchReturns(tab)}>
          <RefreshCw size={14} /> Refresh
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 pointer-events-none" />
        <input
          type="text"
          placeholder="Search by customer or order ID…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-8 py-2 border border-gray-300 dark:border-slate-600 rounded-xl text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:border-orange-500 dark:focus:border-orange-400 transition-colors"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300">
            <X size={13} />
          </button>
        )}
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 flex-wrap">
        {STATUS_TABS.map((s) => (
          <button
            key={s}
            onClick={() => setTab(s)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium border-2 transition-all capitalize',
              tab === s
                ? `${TAB_COLORS[s]} bg-white dark:bg-slate-800 shadow-sm`
                : 'border-transparent text-gray-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800',
            )}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <PageSpinner />
      ) : returns.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700">
          <div className="w-16 h-16 rounded-full bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center mx-auto mb-4">
            <Package size={28} className="text-orange-400" />
          </div>
          <p className="text-lg font-semibold text-gray-700 dark:text-slate-300">
            No {tab === 'all' ? '' : tab} returns
          </p>
          <p className="text-sm text-gray-400 dark:text-slate-500 mt-1">
            {tab === 'pending' ? 'All return requests have been processed.' : 'Nothing here yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((ret) => (
            <ReturnCard
              key={ret.uuid}
              ret={ret}
              onAction={(r, a) => setActionTarget({ ret: r, action: a })}
            />
          ))}
        </div>
      )}

      {/* Action confirmation modal */}
      {actionTarget && (
        <ActionModal
          ret={actionTarget.ret}
          action={actionTarget.action}
          onClose={() => setActionTarget(null)}
          onDone={() => fetchReturns(tab)}
        />
      )}
    </div>
  );
}

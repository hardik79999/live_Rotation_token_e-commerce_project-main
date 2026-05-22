import { useEffect, useState } from 'react';
import { PageSpinner } from '@/components/ui/Spinner';
import { useNavigate, Link } from 'react-router-dom';
import {
  Package, Clock, FileText, ChevronDown, ChevronUp,
  Download, Printer, CheckCircle, Truck, XCircle, Star, RotateCcw, Search, X,
} from 'lucide-react';
import { orderApi, reviewApi } from '@/api/user';
import type { Order, OrderDetail, Invoice } from '@/types';
import { formatPrice, formatDate, getImageUrl } from '@/utils/image';
import { Badge, orderStatusBadge, returnStatusBadge, RETURN_STATUS_LABEL } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { ReturnOrderModal } from '@/components/order/ReturnOrderModal';
import { MagicDropzone } from '@/components/ui/MagicDropzone';
import { cn } from '@/utils/cn';
import toast from 'react-hot-toast';

// ── Status icon map ───────────────────────────────────────────
const STATUS_ICON: Record<string, React.ReactNode> = {
  pending:    <Clock size={14} className="text-yellow-500" />,
  processing: <Package size={14} className="text-blue-500" />,
  shipped:    <Truck size={14} className="text-orange-500" />,
  delivered:  <CheckCircle size={14} className="text-green-500" />,
  cancelled:  <XCircle size={14} className="text-red-500" />,
};

// ── Inline Order Tracking Stepper ─────────────────────────────
const STEPS = ['pending', 'processing', 'shipped', 'delivered'] as const;
const STEP_LABELS: Record<string, string> = {
  pending:    'Ordered',
  processing: 'Processing',
  shipped:    'Shipped',
  delivered:  'Delivered',
};
const STEP_ICONS: Record<string, React.ReactNode> = {
  pending:    <Clock size={12} />,
  processing: <Package size={12} />,
  shipped:    <Truck size={12} />,
  delivered:  <CheckCircle size={12} />,
};

function OrderStepper({ status }: { status: string }) {
  if (status === 'cancelled') {
    return (
      <div className="flex items-center gap-2 py-2">
        <div className="w-6 h-6 rounded-full bg-red-100 dark:bg-red-500/20 flex items-center justify-center shrink-0">
          <XCircle size={13} className="text-red-500" />
        </div>
        <span className="text-xs font-semibold text-red-500 dark:text-red-400">Order Cancelled</span>
      </div>
    );
  }

  const currentIdx = STEPS.indexOf(status as typeof STEPS[number]);

  return (
    <div className="flex items-center w-full py-1">
      {STEPS.map((step, idx) => {
        const isDone    = idx < currentIdx;
        const isCurrent = idx === currentIdx;
        const isFuture  = idx > currentIdx;

        return (
          <div key={step} className="flex items-center flex-1 min-w-0">
            {/* Step node */}
            <div className="flex flex-col items-center shrink-0">
              <div className={cn(
                'flex items-center justify-center rounded-full transition-all',
                isCurrent
                  ? 'w-7 h-7 bg-orange-500 text-white ring-4 ring-orange-200 dark:ring-orange-500/30 shadow-sm'
                  : isDone
                  ? 'w-6 h-6 bg-orange-500 text-white'
                  : 'w-6 h-6 bg-gray-200 dark:bg-slate-600 text-gray-400 dark:text-slate-500',
              )}>
                {isDone
                  ? <CheckCircle size={12} />
                  : isCurrent
                  ? STEP_ICONS[step]
                  : <span className="text-xs font-bold">{idx + 1}</span>
                }
              </div>
              <span className={cn(
                'text-xs mt-1 text-center leading-tight hidden sm:block',
                isCurrent ? 'text-orange-600 dark:text-orange-400 font-bold' :
                isDone    ? 'text-orange-500 dark:text-orange-500 font-medium' :
                            'text-gray-400 dark:text-slate-500',
              )}>
                {STEP_LABELS[step]}
              </span>
            </div>

            {/* Connector line */}
            {idx < STEPS.length - 1 && (
              <div className={cn(
                'flex-1 h-0.5 mx-1 mb-4 sm:mb-5 transition-colors',
                idx < currentIdx ? 'bg-orange-500' : 'bg-gray-200 dark:bg-slate-600',
              )} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Write Review Modal ────────────────────────────────────────
function WriteReviewModal({
  productUuid,
  productName,
  onClose,
}: {
  productUuid: string;
  productName: string;
  onClose: () => void;
}) {
  const [rating,     setRating]     = useState(5);
  const [comment,    setComment]    = useState('');
  const [images,     setImages]     = useState<File[]>([]);
  const [previews,   setPreviews]   = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const handleFiles = (files: File[]) => {
    const newPreviews = files.map(f => URL.createObjectURL(f));
    setImages(prev => [...prev, ...files]);
    setPreviews(prev => [...prev, ...newPreviews]);
  };

  const removeImage = (idx: number) => {
    URL.revokeObjectURL(previews[idx]);
    setImages(prev => prev.filter((_, i) => i !== idx));
    setPreviews(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await reviewApi.addReview(productUuid, { rating, comment, images });
      toast.success('Review submitted! Thank you.');
      previews.forEach(URL.revokeObjectURL);
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Failed to submit review');
    } finally { setSubmitting(false); }
  };

  return (
    <Modal isOpen onClose={onClose} title={`Review: ${productName}`} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Star rating */}
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-2 block">
            Your Rating
          </label>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                className="transition-transform hover:scale-110 active:scale-95"
              >
                <Star
                  size={28}
                  className={cn(
                    'transition-colors',
                    star <= rating
                      ? 'text-yellow-400 fill-yellow-400'
                      : 'text-gray-300 dark:text-slate-600',
                  )}
                />
              </button>
            ))}
            <span className="ml-2 text-sm text-gray-500 dark:text-slate-400 self-center">
              {['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][rating]}
            </span>
          </div>
        </div>

        {/* Comment */}
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-1 block">
            Comment <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            placeholder="Share your experience with this product..."
            className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:border-orange-500 dark:focus:border-orange-400 resize-none transition-colors"
          />
        </div>

        {/* Photo upload — MagicDropzone */}
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-2 block">
            Add Photos <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <MagicDropzone
            onFiles={handleFiles}
            previews={previews}
            onRemove={removeImage}
            maxFiles={3}
            label="Drag & drop your photo or click to browse"
            sublabel="JPG, PNG, WebP · max 10 MB · or paste with Ctrl+V"
            thumbSize="w-20 h-20"
          />
        </div>

        <div className="flex gap-3">
          <Button type="button" variant="ghost" onClick={onClose} className="flex-1">Cancel</Button>
          <Button type="submit" loading={submitting} className="flex-1">
            <Star size={14} /> Submit Review
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function OrdersPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [trackingData, setTrackingData] = useState<OrderDetail | null>(null);
  const [trackingUuid, setTrackingUuid] = useState<string | null>(null);
  const [invoiceOrderUuid, setInvoiceOrderUuid] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery,  setSearchQuery]  = useState('');
  const [reviewTarget, setReviewTarget] = useState<{ uuid: string; name: string } | null>(null);
  const [returnTarget, setReturnTarget] = useState<{ uuid: string; amount: number; daysLeft: number } | null>(null);

  const loadOrders = () => {
    orderApi
      .getOrders()
      .then((r) => setOrders(r.data.data || []))
      .catch(() => toast.error('Failed to load orders'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadOrders(); }, []);

  const handleTrack = async (uuid: string) => {
    setTrackingUuid(uuid);
    try {
      const res = await orderApi.getOrderStatus(uuid);
      setTrackingData(res.data.data || null);
    } catch {
      toast.error('Failed to load tracking info');
    } finally {
      setTrackingUuid(null);
    }
  };

  const filtered = (() => {
    let result = statusFilter === 'all' ? orders : orders.filter((o) => o.status === statusFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (o) =>
          o.uuid.toLowerCase().includes(q) ||
          o.items.some((i) => i.product_name.toLowerCase().includes(q))
      );
    }
    return result;
  })();

  if (loading) return <PageSpinner />;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">My Orders</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">{orders.length} total orders</p>
        </div>
      </div>

      {/* Search + filter row */}
      {orders.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          {/* Search bar */}
          <div className="relative flex-1 max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by product or order ID…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 border border-gray-300 dark:border-slate-600 rounded-xl text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:border-orange-500 dark:focus:border-orange-400 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 transition-colors"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Status filter tabs */}
          <div className="flex gap-2 flex-wrap">
            {['all', 'pending', 'processing', 'shipped', 'delivered', 'cancelled'].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all capitalize ${
                  statusFilter === s
                    ? 'bg-orange-500 text-white border-orange-500'
                    : 'border-gray-300 dark:border-slate-600 text-gray-600 dark:text-slate-400 hover:border-orange-400 bg-white dark:bg-slate-800'
                }`}
              >
                {s === 'all' ? `All (${orders.length})` : `${s} (${orders.filter((o) => o.status === s).length})`}
              </button>
            ))}
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700">
          <div className="w-20 h-20 rounded-full bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center mx-auto mb-4">
            <Package size={36} className="text-orange-400" />
          </div>
          <p className="text-xl font-semibold text-gray-700 dark:text-slate-300 mb-2">
            {orders.length === 0 ? 'No orders yet' : 'No orders match this filter'}
          </p>
          <p className="text-gray-400 dark:text-slate-500 mb-6 text-sm max-w-xs mx-auto">
            {orders.length === 0
              ? 'Looks like you haven\'t placed any orders yet. Start exploring our products!'
              : 'Try a different status filter to find your orders.'}
          </p>
          {orders.length === 0 && (
            <Button onClick={() => navigate('/products')} size="lg">
              <Package size={16} /> Start Shopping
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((order) => (
            <div
              key={order.uuid}
              className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow overflow-hidden"
            >
              <div className="flex flex-col sm:flex-row sm:items-start gap-4 p-4">
                {/* Product thumbnails — stacked overlap */}
                {order.items.length > 0 && (
                  <div className="flex shrink-0">
                    <div className="flex -space-x-3">
                      {order.items.slice(0, 4).map((item, idx) => (
                        <Link
                          key={item.product_uuid}
                          to={`/product/${item.product_uuid}`}
                          title={item.product_name}
                          style={{ zIndex: order.items.length - idx }}
                          className="relative w-14 h-14 rounded-xl overflow-hidden border-2 border-white dark:border-slate-800 bg-gray-100 dark:bg-slate-700 shrink-0 hover:scale-105 transition-transform shadow-sm"
                        >
                          <img
                            src={getImageUrl(item.image)}
                            alt={item.product_name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = '/placeholder-product.png';
                            }}
                          />
                          {/* Quantity badge */}
                          {item.quantity > 1 && (
                            <span className="absolute bottom-0 right-0 bg-orange-500 text-white text-xs font-bold w-4 h-4 flex items-center justify-center rounded-tl-lg">
                              {item.quantity}
                            </span>
                          )}
                        </Link>
                      ))}
                      {/* +N more badge */}
                      {order.items.length > 4 && (
                        <div className="w-14 h-14 rounded-xl border-2 border-white dark:border-slate-800 bg-gray-100 dark:bg-slate-700 flex items-center justify-center text-xs font-bold text-gray-500 dark:text-slate-400 shrink-0 shadow-sm">
                          +{order.items.length - 4}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Order info */}
                <div className="flex-1 min-w-0">
                  {/* Product names */}
                  <p className="text-sm font-medium text-gray-800 dark:text-slate-200 truncate mb-1">
                    {order.items.map((i) => i.product_name).join(', ')}
                  </p>

                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs text-gray-400 dark:text-slate-500">
                      #{order.uuid.slice(0, 8).toUpperCase()}
                    </span>
                    <Badge variant={orderStatusBadge(order.status)}>
                      {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                    </Badge>
                    {/* Return status badge */}
                    {order.return && (
                      <Badge variant={returnStatusBadge(order.return.status)}>
                        {RETURN_STATUS_LABEL[order.return.status] ?? order.return.status}
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <p className="font-bold text-gray-900 dark:text-slate-100">{formatPrice(order.amount)}</p>
                    <p className="text-xs text-gray-400 dark:text-slate-500">
                      {formatDate(order.date)} · {order.payment_method.toUpperCase()}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-slate-500">
                      {order.items.reduce((s, i) => s + i.quantity, 0)} item{order.items.reduce((s, i) => s + i.quantity, 0) !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 shrink-0 flex-wrap sm:flex-col sm:items-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleTrack(order.uuid)}
                    loading={trackingUuid === order.uuid}
                  >
                    <Clock size={13} /> Track
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setInvoiceOrderUuid(order.uuid)}
                    className="text-gray-600 hover:text-orange-500"
                  >
                    <FileText size={13} /> Invoice
                  </Button>
                  {/* Return button — only for delivered orders within window, no active return */}
                  {order.status === 'delivered' && order.return_window_open && !order.return && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setReturnTarget({
                        uuid: order.uuid,
                        amount: order.amount,
                        daysLeft: order.return_days_left,
                      })}
                      className="text-orange-600 border-orange-400 hover:bg-orange-50 dark:hover:bg-orange-500/10 font-semibold relative"
                    >
                      <RotateCcw size={13} /> Return
                      {order.return_days_left <= 2 && order.return_days_left > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] font-bold px-1 rounded-full leading-4">
                          {order.return_days_left}d
                        </span>
                      )}
                    </Button>
                  )}
                  {/* Expired window — show greyed out hint */}
                  {order.status === 'delivered' && !order.return_window_open && !order.return && (
                    <span className="text-xs text-gray-400 dark:text-slate-500 italic self-center">
                      Return window closed
                    </span>
                  )}
                </div>
              </div>

              {/* ── Inline tracking stepper ── */}
              {order.status !== 'cancelled' && (
                <div className="px-4 pb-3 pt-1 border-t border-gray-50 dark:border-slate-700/50">
                  <OrderStepper status={order.status} />
                </div>
              )}

              {/* ── Review button for delivered orders ── */}
              {order.status === 'delivered' && order.items.length > 0 && (
                <div className="px-4 pb-3 flex flex-wrap gap-2">
                  {order.items.slice(0, 3).map((item) => (
                    <button
                      key={item.product_uuid}
                      onClick={() => setReviewTarget({ uuid: item.product_uuid, name: item.product_name })}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-500/10 hover:bg-yellow-100 dark:hover:bg-yellow-500/20 border border-yellow-200 dark:border-yellow-500/30 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <Star size={11} className="fill-yellow-400 text-yellow-400" />
                      Review {item.product_name.length > 20 ? item.product_name.slice(0, 20) + '…' : item.product_name}
                    </button>
                  ))}
                </div>
              )}

              {/* ── Return / Refund status strip ── */}
              {order.return && (
                <div className={`mx-4 mb-3 rounded-xl px-4 py-3 text-xs flex items-center justify-between gap-3 ${
                  order.return.status === 'refunded'
                    ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-500/30'
                    : order.return.status === 'rejected'
                    ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/30'
                    : 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-500/30'
                }`}>
                  <div>
                    <p className={`font-semibold ${
                      order.return.status === 'refunded' ? 'text-green-700 dark:text-green-400' :
                      order.return.status === 'rejected' ? 'text-red-700 dark:text-red-400' :
                      'text-amber-700 dark:text-amber-400'
                    }`}>
                      {RETURN_STATUS_LABEL[order.return.status]}
                    </p>
                    {order.return.status === 'refunded' && order.return.refund_amount && (
                      <p className="text-green-600 dark:text-green-500 mt-0.5">
                        ₹{order.return.refund_amount.toLocaleString('en-IN')} refunded via{' '}
                        {order.return.refund_method === 'razorpay' ? 'original payment method' : 'wallet'}
                      </p>
                    )}
                  </div>
                  <Badge variant={returnStatusBadge(order.return.status)}>
                    {order.return.status}
                  </Badge>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Tracking Modal ── */}
      <Modal
        isOpen={!!trackingData}
        onClose={() => setTrackingData(null)}
        title="Order Tracking"
        size="md"
      >
        {trackingData && (
          <div className="space-y-5">
            <div className="flex items-center justify-between bg-gray-50 dark:bg-slate-700/50 rounded-xl p-4">
              <div>
                <p className="text-xs text-gray-400 dark:text-slate-500 font-mono mb-1">
                  #{trackingData.order_uuid.slice(0, 8).toUpperCase()}
                </p>
                <p className="font-bold text-gray-900 dark:text-slate-100 text-lg">{formatPrice(trackingData.amount)}</p>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{trackingData.payment_method.toUpperCase()}</p>
              </div>
              <Badge variant={orderStatusBadge(trackingData.current_status)}>
                {trackingData.current_status}
              </Badge>
            </div>

            {/* Progress bar — current step has ring, completed have checkmark, future are gray */}
            {trackingData.current_status.toLowerCase() !== 'cancelled' && (
              <div className="flex items-center gap-1 px-2">
                {['Pending', 'Processing', 'Shipped', 'Delivered'].map((step, i, arr) => {
                  const steps = ['pending', 'processing', 'shipped', 'delivered'];
                  const currentIdx = steps.indexOf(trackingData.current_status.toLowerCase());
                  const isDone    = i < currentIdx;   // fully completed (before current)
                  const isCurrent = i === currentIdx; // the active step
                  const isFuture  = i > currentIdx;   // not yet reached

                  return (
                    <div key={step} className="flex items-center flex-1">
                      <div className="flex flex-col items-center flex-1">
                        {/* Step dot */}
                        <div className={`
                          flex items-center justify-center rounded-full text-xs font-bold transition-all
                          ${isCurrent
                            ? 'w-8 h-8 bg-orange-500 text-white ring-4 ring-orange-200 dark:ring-orange-500/30 shadow-md'
                            : isDone
                            ? 'w-6 h-6 bg-orange-500 text-white'
                            : 'w-6 h-6 bg-gray-200 dark:bg-slate-600 text-gray-400 dark:text-slate-400'
                          }
                        `}>
                          {isDone ? '✓' : isCurrent ? '●' : i + 1}
                        </div>
                        {/* Step label */}
                        <p className={`text-xs mt-1.5 text-center ${
                          isCurrent ? 'text-orange-600 dark:text-orange-400 font-bold' :
                          isDone    ? 'text-orange-500 font-medium' :
                                      'text-gray-400 dark:text-slate-500'
                        }`}>
                          {step}
                        </p>
                      </div>
                      {/* Connector line */}
                      {i < arr.length - 1 && (
                        <div className={`h-0.5 flex-1 mb-5 mx-1 ${
                          i < currentIdx ? 'bg-orange-500' : 'bg-gray-200 dark:bg-slate-600'
                        }`} />
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div>
              <p className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">Tracking History</p>
              {trackingData.tracking_history.length === 0 ? (
                <div className="text-center py-6 text-gray-400 dark:text-slate-500 bg-gray-50 dark:bg-slate-700/50 rounded-xl">
                  <Clock size={28} className="mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No updates yet.</p>
                  <p className="text-xs mt-1">Updates appear once the seller processes your order.</p>
                </div>
              ) : (
                <div>
                  {/* Reverse so newest entry is at top (idx=0 = most recent = orange) */}
                  {[...trackingData.tracking_history].reverse().map((entry, idx) => (
                    <div key={idx} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className={`w-3 h-3 rounded-full mt-1 shrink-0 ${
                          idx === 0 ? 'bg-orange-500 ring-4 ring-orange-100' : 'bg-gray-300'
                        }`} />
                        {idx < trackingData.tracking_history.length - 1 && (
                          <div className="w-0.5 flex-1 bg-gray-200 my-1" />
                        )}
                      </div>
                      <div className="pb-4">
                        <p className={`text-sm font-semibold ${idx === 0 ? 'text-orange-600 dark:text-orange-400' : 'text-gray-700 dark:text-slate-300'}`}>
                          {entry.status}
                        </p>
                        {entry.message && <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{entry.message}</p>}
                        <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{formatDate(entry.date)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* ── Invoice Modal ── */}
      {invoiceOrderUuid && (
        <InvoiceModal
          orderUuid={invoiceOrderUuid}
          onClose={() => setInvoiceOrderUuid(null)}
        />
      )}

      {/* ── Write Review Modal ── */}
      {reviewTarget && (
        <WriteReviewModal
          productUuid={reviewTarget.uuid}
          productName={reviewTarget.name}
          onClose={() => setReviewTarget(null)}
        />
      )}

      {/* ── Return Order Modal ── */}
      {returnTarget && (
        <ReturnOrderModal
          orderUuid={returnTarget.uuid}
          orderAmount={returnTarget.amount}
          daysLeft={returnTarget.daysLeft}
          onClose={() => setReturnTarget(null)}
          onSuccess={loadOrders}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Invoice Modal — with Download + Print buttons
// ─────────────────────────────────────────────────────────────
function InvoiceModal({ orderUuid, onClose }: { orderUuid: string; onClose: () => void }) {
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  useEffect(() => {
    orderApi
      .getInvoice(orderUuid)
      .then((r) => setInvoice(r.data.invoice || null))
      .catch(() => toast.error('Failed to load invoice'))
      .finally(() => setLoading(false));
  }, [orderUuid]);

  // ── Download as HTML file (browser-native, no library needed) ──
  const handleDownload = () => {
    if (!invoice) return;
    const html = buildInvoiceHTML(invoice);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Invoice-${invoice.invoice_id}.html`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Invoice downloaded!');
  };

  // ── Download as PDF from backend ──────────────────────────
  const handleDownloadPdf = async () => {
    if (!invoice) return;
    setDownloadingPdf(true);
    try {
      const res = await orderApi.downloadInvoicePdf(orderUuid);
      const blob = new Blob([res.data as BlobPart], { type: 'application/pdf' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `ShopHub-Invoice-${invoice.invoice_id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('PDF downloaded!');
    } catch {
      toast.error('Failed to download PDF');
    } finally {
      setDownloadingPdf(false);
    }
  };

  // ── Print using browser print dialog ──
  const handlePrint = () => {
    if (!invoice) return;
    const html = buildInvoiceHTML(invoice);
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  };

  return (
    <Modal isOpen onClose={onClose} title="Invoice" size="lg">
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !invoice ? (
        <div className="text-center py-10">
          <FileText size={40} className="text-gray-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-slate-400">Invoice not available yet.</p>
        </div>
      ) : (
        <div className="space-y-4 text-sm">
          {/* Download + Print buttons */}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer size={14} /> Print
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownload}>
              <Download size={14} /> HTML
            </Button>
            <Button size="sm" loading={downloadingPdf} onClick={handleDownloadPdf}>
              <Download size={14} /> PDF
            </Button>
          </div>

          {/* Invoice header */}
          <div className="flex items-start justify-between bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-500/10 dark:to-amber-500/10 border border-orange-100 dark:border-orange-500/20 rounded-xl p-4">
            <div>
              <p className="font-bold text-orange-600 text-base">{invoice.company_info.name}</p>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{invoice.company_info.support_email}</p>
              <p className="text-xs text-gray-500 dark:text-slate-400">GSTIN: {invoice.company_info.gstin}</p>
            </div>
            <div className="text-right">
              <p className="font-mono font-bold text-gray-800 dark:text-slate-200 text-sm">{invoice.invoice_id}</p>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{formatDate(invoice.date)}</p>
              <Badge variant={orderStatusBadge(invoice.status.toLowerCase())} className="mt-1">
                {invoice.status}
              </Badge>
            </div>
          </div>

          {/* Customer + Payment */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 dark:bg-slate-700/50 rounded-xl p-3">
              <p className="font-semibold text-gray-700 dark:text-slate-300 mb-2 text-xs uppercase tracking-wide">Bill To</p>
              <p className="font-medium text-gray-800 dark:text-slate-200">{invoice.customer_details.name}</p>
              <p className="text-gray-500 dark:text-slate-400 text-xs mt-0.5">{invoice.customer_details.email}</p>
              <p className="text-gray-500 dark:text-slate-400 text-xs">{invoice.customer_details.phone}</p>
              <p className="text-gray-400 dark:text-slate-500 text-xs mt-1 leading-relaxed">{invoice.customer_details.shipping_address}</p>
            </div>
            <div className="bg-gray-50 dark:bg-slate-700/50 rounded-xl p-3">
              <p className="font-semibold text-gray-700 dark:text-slate-300 mb-2 text-xs uppercase tracking-wide">Payment</p>
              <p className="text-gray-600 dark:text-slate-400 text-xs">Method: <span className="font-semibold text-gray-800 dark:text-slate-200">{invoice.payment_details.method}</span></p>
              <p className="text-gray-500 dark:text-slate-400 text-xs mt-1 break-all font-mono">
                {invoice.payment_details.transaction_id}
              </p>
              <Badge
                variant={invoice.payment_details.payment_status === 'COMPLETED' ? 'success' : 'warning'}
                className="mt-2"
              >
                {invoice.payment_details.payment_status}
              </Badge>
            </div>
          </div>

          {/* Order summary */}
          <div className="border border-gray-100 dark:border-slate-700 rounded-xl overflow-hidden">
            <button
              onClick={() => setExpanded((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-slate-700/50 text-sm font-semibold text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
            >
              Order Summary
              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {expanded && (
              <div className="px-4 py-3 space-y-2">
                <div className="flex justify-between text-gray-600 dark:text-slate-400">
                  <span>Base Amount</span>
                  <span>{formatPrice(invoice.order_summary.base_amount)}</span>
                </div>
                <div className="flex justify-between text-gray-600 dark:text-slate-400">
                  <span>GST (18%)</span>
                  <span>{formatPrice(invoice.order_summary.tax_gst_18)}</span>
                </div>
                <div className="flex justify-between text-gray-600 dark:text-slate-400">
                  <span>Shipping</span>
                  <span className="text-green-600 font-medium">
                    {invoice.order_summary.shipping_fee === 0 ? 'FREE' : formatPrice(invoice.order_summary.shipping_fee)}
                  </span>
                </div>
                <div className="flex justify-between font-bold text-gray-900 dark:text-slate-100 text-base border-t border-gray-100 dark:border-slate-700 pt-2 mt-2">
                  <span>Grand Total</span>
                  <span className="text-orange-600">{formatPrice(invoice.order_summary.grand_total)}</span>
                </div>
              </div>
            )}
          </div>

          <p className="text-center text-xs text-gray-400 dark:text-slate-500 pt-1">
            Thank you for shopping with {invoice.company_info.name} 🛍️
          </p>
        </div>
      )}
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────
// Build a standalone printable/downloadable HTML invoice
// ─────────────────────────────────────────────────────────────
function buildInvoiceHTML(inv: Invoice): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Invoice ${inv.invoice_id}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #f3f4f6; padding: 32px; color: #111827; }
    .card { background: #fff; max-width: 680px; margin: 0 auto; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,.08); }
    .header { background: linear-gradient(135deg,#1f2937,#111827); color: #fff; padding: 28px 36px; display: flex; justify-content: space-between; align-items: flex-start; }
    .brand { font-size: 24px; font-weight: 800; } .brand span { color: #f97316; }
    .inv-id { text-align: right; font-family: monospace; font-size: 13px; color: #9ca3af; }
    .inv-id strong { display: block; color: #fff; font-size: 16px; margin-bottom: 4px; }
    .body { padding: 28px 36px; }
    .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 20px 0; }
    .box { background: #f9fafb; border-radius: 10px; padding: 16px; }
    .box-title { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #6b7280; font-weight: 600; margin-bottom: 8px; }
    .box p { font-size: 13px; color: #374151; margin-bottom: 3px; }
    .box .name { font-weight: 700; color: #111827; font-size: 14px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th { background: #f3f4f6; padding: 10px 14px; text-align: left; font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: .5px; }
    td { padding: 12px 14px; border-bottom: 1px solid #f3f4f6; font-size: 13px; }
    .total-row td { font-weight: 700; font-size: 15px; color: #f97316; border-top: 2px solid #f3f4f6; border-bottom: none; }
    .badge { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; }
    .badge-green { background: #d1fae5; color: #065f46; }
    .badge-yellow { background: #fef3c7; color: #92400e; }
    .footer { background: #f9fafb; border-top: 1px solid #e5e7eb; padding: 16px 36px; text-align: center; font-size: 12px; color: #9ca3af; }
    @media print { body { background: #fff; padding: 0; } .card { box-shadow: none; border-radius: 0; } }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div>
        <div class="brand">Shop<span>Hub</span></div>
        <div style="color:#9ca3af;font-size:12px;margin-top:4px;">${inv.company_info.support_email}</div>
        <div style="color:#9ca3af;font-size:12px;">GSTIN: ${inv.company_info.gstin}</div>
      </div>
      <div class="inv-id">
        <strong>${inv.invoice_id}</strong>
        Date: ${new Date(inv.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
        <br/>
        <span class="badge ${inv.status === 'DELIVERED' ? 'badge-green' : 'badge-yellow'}" style="margin-top:6px;">${inv.status}</span>
      </div>
    </div>
    <div class="body">
      <div class="grid2">
        <div class="box">
          <div class="box-title">Bill To</div>
          <p class="name">${inv.customer_details.name}</p>
          <p>${inv.customer_details.email}</p>
          <p>${inv.customer_details.phone}</p>
          <p style="margin-top:6px;color:#6b7280;">${inv.customer_details.shipping_address}</p>
        </div>
        <div class="box">
          <div class="box-title">Payment Details</div>
          <p><strong>Method:</strong> ${inv.payment_details.method}</p>
          <p style="word-break:break-all;font-family:monospace;font-size:11px;margin-top:4px;">${inv.payment_details.transaction_id}</p>
          <span class="badge ${inv.payment_details.payment_status === 'COMPLETED' ? 'badge-green' : 'badge-yellow'}" style="margin-top:8px;">${inv.payment_details.payment_status}</span>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th style="text-align:right;">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>Base Amount (excl. GST)</td><td style="text-align:right;">₹${inv.order_summary.base_amount.toFixed(2)}</td></tr>
          <tr><td>GST @ 18%</td><td style="text-align:right;">₹${inv.order_summary.tax_gst_18.toFixed(2)}</td></tr>
          <tr><td>Shipping Fee</td><td style="text-align:right;">${inv.order_summary.shipping_fee === 0 ? 'FREE' : '₹' + inv.order_summary.shipping_fee.toFixed(2)}</td></tr>
        </tbody>
        <tfoot>
          <tr class="total-row"><td>Grand Total</td><td style="text-align:right;">₹${inv.order_summary.grand_total.toFixed(2)}</td></tr>
        </tfoot>
      </table>
    </div>
    <div class="footer">
      Thank you for shopping with ${inv.company_info.name} &nbsp;🛍️<br/>
      This is a computer-generated invoice and does not require a signature.
    </div>
  </div>
</body>
</html>`;
}

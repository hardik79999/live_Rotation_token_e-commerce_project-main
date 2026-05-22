/**
 * PromoCodeInput — promo code field + available coupon cards with drag-and-drop.
 *
 * Features:
 *  - Type a code manually and click Apply / press Enter
 *  - See all available coupons as cards below the input
 *  - Drag any coupon card and drop it onto the input zone to apply it
 *  - Click a coupon card to apply it instantly (no drag needed)
 *  - Applied state shows green badge with savings + remove button
 *  - Coupons that don't meet min_cart_value are shown as disabled
 */
import { useEffect, useRef, useState } from 'react';
import { Tag, X, Loader2, ChevronDown, ChevronUp, Clock, Ticket } from 'lucide-react';
import { cartApi } from '@/api/user';
import type { AvailableCoupon, PromoValidateResponse } from '@/types';
import { formatPrice } from '@/utils/image';
import toast from 'react-hot-toast';
import { cn } from '@/utils/cn';

interface Props {
  cartTotal:       number;
  onApplied:       (result: PromoValidateResponse) => void;
  onRemoved:       () => void;
  appliedCode?:    string | null;
  discountAmount?: number;
}

export function PromoCodeInput({
  cartTotal, onApplied, onRemoved, appliedCode, discountAmount,
}: Props) {
  const [code,          setCode]          = useState('');
  const [loading,       setLoading]       = useState(false);
  const [coupons,       setCoupons]       = useState<AvailableCoupon[]>([]);
  const [showCoupons,   setShowCoupons]   = useState(false);
  const [loadingList,   setLoadingList]   = useState(false);
  const [isDragOver,    setIsDragOver]    = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Load available coupons once ───────────────────────────
  useEffect(() => {
    setLoadingList(true);
    cartApi.getAvailablePromos()
      .then((r) => setCoupons(r.data.data ?? []))
      .catch(() => {})
      .finally(() => setLoadingList(false));
  }, []);

  // ── Apply a code (shared by manual input, click, and drag) ─
  const applyCode = async (codeToApply: string) => {
    const trimmed = codeToApply.trim().toUpperCase();
    if (!trimmed) { toast.error('Enter a promo code'); return; }
    setLoading(true);
    try {
      const res = await cartApi.validatePromo(trimmed);
      onApplied(res.data);
      setCode('');
      setShowCoupons(false);
      toast.success(res.data.message, { duration: 5000 });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message ?? 'Invalid promo code';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); applyCode(code); }
  };

  // ── Drag-and-drop handlers ────────────────────────────────
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setIsDragOver(true);
  };

  const handleDragLeave = () => setIsDragOver(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const droppedCode = e.dataTransfer.getData('text/plain');
    if (droppedCode) {
      setCode(droppedCode);
      applyCode(droppedCode);
    }
  };

  // ── Applied state ─────────────────────────────────────────
  if (appliedCode) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30 rounded-xl px-3 py-2.5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-green-100 dark:bg-green-500/20 flex items-center justify-center shrink-0">
              <Tag size={13} className="text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-xs font-bold text-green-700 dark:text-green-400 tracking-wide">
                {appliedCode} applied!
              </p>
              {discountAmount !== undefined && discountAmount > 0 && (
                <p className="text-xs text-green-600 dark:text-green-500">
                  You save {formatPrice(discountAmount)} 🎉
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onRemoved}
            className="p-1 rounded-lg text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-500/20 transition-colors"
            aria-label="Remove promo code"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    );
  }

  // ── Input + coupon list state ─────────────────────────────
  return (
    <div className="space-y-2">
      {/* ── Drop zone + input ── */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'rounded-xl border-2 border-dashed transition-all duration-200',
          isDragOver
            ? 'border-orange-400 bg-orange-50 dark:bg-orange-500/10 scale-[1.01]'
            : 'border-transparent',
        )}
      >
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Tag size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyDown={handleKeyDown}
              placeholder={isDragOver ? 'Drop coupon here…' : 'Promo code'}
              maxLength={30}
              className={cn(
                'w-full pl-8 pr-3 py-2 text-sm rounded-lg border transition-colors',
                'bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100',
                'placeholder-gray-400 dark:placeholder-slate-500',
                isDragOver
                  ? 'border-orange-400 dark:border-orange-400'
                  : 'border-gray-300 dark:border-slate-600',
                'focus:outline-none focus:border-orange-500 dark:focus:border-orange-400',
              )}
            />
          </div>
          <button
            onClick={() => applyCode(code)}
            disabled={loading || !code.trim()}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-semibold transition-all active:scale-95',
              'bg-orange-500 hover:bg-orange-600 text-white',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'flex items-center gap-1.5 shrink-0',
            )}
          >
            {loading ? <Loader2 size={13} className="animate-spin" /> : null}
            Apply
          </button>
        </div>

        {isDragOver && (
          <p className="text-center text-xs text-orange-500 font-medium py-1">
            Release to apply coupon
          </p>
        )}
      </div>

      {/* ── Available coupons toggle ── */}
      {coupons.length > 0 && (
        <button
          onClick={() => setShowCoupons((v) => !v)}
          className="flex items-center gap-1.5 text-xs text-orange-500 hover:text-orange-600 font-medium transition-colors w-full"
        >
          <Ticket size={12} />
          {showCoupons ? 'Hide' : 'View'} {coupons.length} available coupon{coupons.length !== 1 ? 's' : ''}
          {showCoupons ? <ChevronUp size={12} className="ml-auto" /> : <ChevronDown size={12} className="ml-auto" />}
        </button>
      )}

      {/* ── Coupon cards ── */}
      {showCoupons && (
        <div className="space-y-2 pt-1">
          {loadingList ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 size={16} className="animate-spin text-orange-400" />
            </div>
          ) : (
            coupons.map((coupon) => {
              const eligible = cartTotal >= coupon.min_cart_value;
              return (
                <CouponCard
                  key={coupon.code}
                  coupon={coupon}
                  eligible={eligible}
                  cartTotal={cartTotal}
                  onApply={() => eligible && applyCode(coupon.code)}
                />
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// ── Individual coupon card with drag support ──────────────────
function CouponCard({
  coupon, eligible, cartTotal, onApply,
}: {
  coupon: AvailableCoupon;
  eligible: boolean;
  cartTotal: number;
  onApply: () => void;
}) {
  const [dragging, setDragging] = useState(false);

  const handleDragStart = (e: React.DragEvent) => {
    if (!eligible) { e.preventDefault(); return; }
    e.dataTransfer.setData('text/plain', coupon.code);
    e.dataTransfer.effectAllowed = 'copy';
    setDragging(true);
  };

  const handleDragEnd = () => setDragging(false);

  const shortfall = coupon.min_cart_value - cartTotal;

  return (
    <div
      draggable={eligible}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={onApply}
      title={eligible ? `Drag or click to apply ${coupon.code}` : `Add ${formatPrice(shortfall)} more to use this code`}
      className={cn(
        'relative flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-all duration-200',
        eligible
          ? 'cursor-grab active:cursor-grabbing hover:border-orange-400 hover:shadow-md hover:shadow-orange-100 dark:hover:shadow-orange-900/20 hover:-translate-y-0.5 bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700'
          : 'cursor-not-allowed opacity-50 bg-gray-50 dark:bg-slate-800/50 border-gray-200 dark:border-slate-700',
        dragging && 'opacity-60 scale-95 rotate-1 shadow-xl',
      )}
    >
      {/* Ticket notch decoration */}
      <div className="absolute -left-px top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-gray-100 dark:bg-slate-900 border border-gray-200 dark:border-slate-700" />
      <div className="absolute -right-px top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-gray-100 dark:bg-slate-900 border border-gray-200 dark:border-slate-700" />

      {/* Left: discount badge */}
      <div className={cn(
        'shrink-0 w-14 h-14 rounded-lg flex flex-col items-center justify-center text-center',
        eligible
          ? 'bg-orange-50 dark:bg-orange-500/10'
          : 'bg-gray-100 dark:bg-slate-700',
      )}>
        <span className={cn(
          'text-base font-extrabold leading-none',
          eligible ? 'text-orange-500' : 'text-gray-400 dark:text-slate-500',
        )}>
          {coupon.discount_type === 'percentage'
            ? `${coupon.discount_value}%`
            : `₹${coupon.discount_value}`}
        </span>
        <span className={cn(
          'text-xs font-semibold mt-0.5',
          eligible ? 'text-orange-400' : 'text-gray-400 dark:text-slate-500',
        )}>
          OFF
        </span>
      </div>

      {/* Dashed divider */}
      <div className="w-px self-stretch border-l border-dashed border-gray-200 dark:border-slate-600 mx-1" />

      {/* Right: details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn(
            'font-mono font-bold text-sm tracking-wider',
            eligible ? 'text-gray-900 dark:text-slate-100' : 'text-gray-400 dark:text-slate-500',
          )}>
            {coupon.code}
          </span>
          {eligible && (
            <span className="text-xs bg-orange-100 dark:bg-orange-500/15 text-orange-600 dark:text-orange-400 px-1.5 py-0.5 rounded font-medium">
              {coupon.label}
            </span>
          )}
        </div>

        {coupon.min_cart_value > 0 && (
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
            {eligible
              ? `Min. cart: ${formatPrice(coupon.min_cart_value)} ✓`
              : `Add ${formatPrice(shortfall)} more to unlock`}
          </p>
        )}

        <div className="flex items-center gap-1 mt-1">
          <Clock size={10} className={cn(
            coupon.days_left <= 3 ? 'text-red-400' : 'text-gray-400 dark:text-slate-500',
          )} />
          <span className={cn(
            'text-xs',
            coupon.days_left <= 3
              ? 'text-red-500 dark:text-red-400 font-medium'
              : 'text-gray-400 dark:text-slate-500',
          )}>
            {coupon.days_left === 0
              ? 'Expires today!'
              : coupon.days_left <= 3
              ? `Expires in ${coupon.days_left}d`
              : `Valid till ${coupon.expiry_date}`}
          </span>
        </div>
      </div>

      {/* Apply hint */}
      {eligible && (
        <div className="shrink-0 text-right">
          <span className="text-xs text-orange-500 font-semibold">
            Tap / Drag
          </span>
        </div>
      )}
    </div>
  );
}

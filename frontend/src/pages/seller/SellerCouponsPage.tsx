/**
 * SellerCouponsPage — create, manage, and deactivate promo codes.
 * Coupons created here appear in the customer cart page coupon list.
 */
import { useEffect, useState } from 'react';
import { PageSpinner } from '@/components/ui/Spinner';
import {
  Plus, Ticket, Trash2, ToggleLeft, ToggleRight,
  Clock, Users, RefreshCw, Copy, CheckCircle,
} from 'lucide-react';
import { sellerApi } from '@/api/seller';
import type { SellerCoupon, SellerCouponForm } from '@/types';
import { formatPrice } from '@/utils/image';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/utils/cn';
import toast from 'react-hot-toast';

const EMPTY_FORM: SellerCouponForm = {
  code:                '',
  discount_type:       'percentage',
  discount_value:      '',
  min_cart_value:      '',
  max_discount_amount: '',
  expiry_date:         '',
  max_uses:            '',
};

// ── Coupon status badge ───────────────────────────────────────
function CouponStatusBadge({ coupon }: { coupon: SellerCoupon }) {
  if (!coupon.is_active)  return <Badge variant="danger">Inactive</Badge>;
  if (coupon.is_expired)  return <Badge variant="danger">Expired</Badge>;
  if (coupon.days_left <= 3) return <Badge variant="warning">Expires soon</Badge>;
  return <Badge variant="success">Active</Badge>;
}

export function SellerCouponsPage() {
  const [coupons,     setCoupons]     = useState<SellerCoupon[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [showModal,   setShowModal]   = useState(false);
  const [form,        setForm]        = useState<SellerCouponForm>(EMPTY_FORM);
  const [saving,      setSaving]      = useState(false);
  const [toggling,    setToggling]    = useState<string | null>(null);
  const [copiedCode,  setCopiedCode]  = useState<string | null>(null);

  const fetchCoupons = () => {
    setLoading(true);
    sellerApi.getCoupons()
      .then((r) => setCoupons(r.data.data ?? []))
      .catch(() => toast.error('Failed to load coupons'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchCoupons(); }, []);

  // ── Copy code to clipboard ────────────────────────────────
  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    });
  };

  // ── Create coupon ─────────────────────────────────────────
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await sellerApi.createCoupon(form);
      toast.success(`Coupon ${form.code} created! Customers can now use it.`);
      setShowModal(false);
      setForm(EMPTY_FORM);
      fetchCoupons();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message ?? 'Failed to create coupon';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  // ── Toggle active/inactive ────────────────────────────────
  const handleToggle = async (coupon: SellerCoupon) => {
    setToggling(coupon.uuid);
    try {
      await sellerApi.updateCoupon(coupon.uuid, { is_active: !coupon.is_active });
      const action = coupon.is_active ? 'deactivated' : 'activated';
      toast.success(`${coupon.code} ${action}`);
      fetchCoupons();
    } catch {
      toast.error('Failed to update coupon');
    } finally {
      setToggling(null);
    }
  };

  // ── Delete (soft) ─────────────────────────────────────────
  const handleDelete = async (coupon: SellerCoupon) => {
    if (!confirm(`Deactivate coupon "${coupon.code}"? Customers won't be able to use it.`)) return;
    try {
      await sellerApi.deleteCoupon(coupon.uuid);
      toast.success(`${coupon.code} deactivated`);
      fetchCoupons();
    } catch {
      toast.error('Failed to deactivate coupon');
    }
  };

  // ── Auto-generate code ────────────────────────────────────
  const generateCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const code = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    setForm((f) => ({ ...f, code }));
  };

  if (loading) return <PageSpinner />;

  const active   = coupons.filter((c) => c.is_active && !c.is_expired);
  const inactive = coupons.filter((c) => !c.is_active || c.is_expired);

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">My Coupons</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
            Create promo codes — they appear in the customer cart page automatically
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchCoupons}>
            <RefreshCw size={14} /> Refresh
          </Button>
          <Button size="sm" onClick={() => setShowModal(true)}>
            <Plus size={14} /> New Coupon
          </Button>
        </div>
      </div>

      {/* ── Stats row ── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total', value: coupons.length, color: 'text-gray-900 dark:text-slate-100' },
          { label: 'Active', value: active.length, color: 'text-green-600 dark:text-green-400' },
          { label: 'Inactive / Expired', value: inactive.length, color: 'text-gray-400 dark:text-slate-500' },
        ].map((s) => (
          <div key={s.label} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-4 text-center">
            <p className={cn('text-2xl font-bold', s.color)}>{s.value}</p>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── Coupon list ── */}
      {coupons.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700">
          <Ticket size={48} className="text-gray-300 dark:text-slate-600 mx-auto mb-4" />
          <p className="text-lg font-semibold text-gray-600 dark:text-slate-400">No coupons yet</p>
          <p className="text-sm text-gray-400 dark:text-slate-500 mt-1 mb-5">
            Create your first coupon to boost sales
          </p>
          <Button onClick={() => setShowModal(true)}>
            <Plus size={14} /> Create Coupon
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {coupons.map((coupon) => (
            <div
              key={coupon.uuid}
              className={cn(
                'bg-white dark:bg-slate-800 rounded-xl border p-4 transition-all',
                coupon.is_active && !coupon.is_expired
                  ? 'border-gray-100 dark:border-slate-700'
                  : 'border-gray-100 dark:border-slate-700 opacity-60',
              )}
            >
              <div className="flex items-start gap-4">
                {/* Discount badge */}
                <div className={cn(
                  'shrink-0 w-16 h-16 rounded-xl flex flex-col items-center justify-center',
                  coupon.is_active && !coupon.is_expired
                    ? 'bg-orange-50 dark:bg-orange-500/10'
                    : 'bg-gray-100 dark:bg-slate-700',
                )}>
                  <span className={cn(
                    'text-lg font-extrabold leading-none',
                    coupon.is_active && !coupon.is_expired ? 'text-orange-500' : 'text-gray-400',
                  )}>
                    {coupon.discount_type === 'percentage'
                      ? `${coupon.discount_value}%`
                      : `₹${coupon.discount_value}`}
                  </span>
                  <span className={cn(
                    'text-xs font-semibold',
                    coupon.is_active && !coupon.is_expired ? 'text-orange-400' : 'text-gray-400',
                  )}>OFF</span>
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    {/* Code with copy button */}
                    <button
                      onClick={() => handleCopy(coupon.code)}
                      className="flex items-center gap-1.5 font-mono font-bold text-base text-gray-900 dark:text-slate-100 hover:text-orange-500 transition-colors"
                      title="Click to copy"
                    >
                      {coupon.code}
                      {copiedCode === coupon.code
                        ? <CheckCircle size={13} className="text-green-500" />
                        : <Copy size={13} className="text-gray-400" />
                      }
                    </button>
                    <CouponStatusBadge coupon={coupon} />
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-slate-400">
                    {coupon.min_cart_value > 0 && (
                      <span>Min. cart: {formatPrice(coupon.min_cart_value)}</span>
                    )}
                    {coupon.max_discount_amount && (
                      <span>Max discount: {formatPrice(coupon.max_discount_amount)}</span>
                    )}
                    <span className="flex items-center gap-1">
                      <Users size={11} />
                      {coupon.current_uses}{coupon.max_uses ? `/${coupon.max_uses}` : ''} uses
                    </span>
                    <span className={cn(
                      'flex items-center gap-1',
                      coupon.days_left <= 3 && coupon.is_active ? 'text-red-500 dark:text-red-400 font-medium' : '',
                    )}>
                      <Clock size={11} />
                      {coupon.is_expired
                        ? 'Expired'
                        : coupon.days_left === 0
                        ? 'Expires today!'
                        : `Expires ${coupon.expiry_display}`}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleToggle(coupon)}
                    disabled={toggling === coupon.uuid || coupon.is_expired}
                    title={coupon.is_active ? 'Deactivate' : 'Activate'}
                    className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-40"
                  >
                    {coupon.is_active
                      ? <ToggleRight size={20} className="text-green-500" />
                      : <ToggleLeft size={20} className="text-gray-400" />
                    }
                  </button>
                  <button
                    onClick={() => handleDelete(coupon)}
                    title="Deactivate coupon"
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Create Modal ── */}
      <Modal isOpen={showModal} onClose={() => { setShowModal(false); setForm(EMPTY_FORM); }} title="Create New Coupon" size="md">
        <form onSubmit={handleCreate} className="space-y-4">
          {/* Code */}
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-1 block">
              Coupon Code
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '') })}
                placeholder="e.g. SAVE20"
                maxLength={20}
                required
                className="flex-1 border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 font-mono uppercase focus:outline-none focus:border-orange-500 dark:focus:border-orange-400 transition-colors"
              />
              <Button type="button" variant="outline" size="sm" onClick={generateCode}>
                Auto
              </Button>
            </div>
          </div>

          {/* Discount type */}
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-2 block">
              Discount Type
            </label>
            <div className="flex gap-2">
              {(['percentage', 'flat'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setForm({ ...form, discount_type: t })}
                  className={cn(
                    'flex-1 py-2 rounded-lg text-sm font-medium border transition-all',
                    form.discount_type === t
                      ? 'bg-orange-500 text-white border-orange-500'
                      : 'border-gray-300 dark:border-slate-600 text-gray-600 dark:text-slate-400 hover:border-orange-400',
                  )}
                >
                  {t === 'percentage' ? '% Percentage' : '₹ Flat Amount'}
                </button>
              ))}
            </div>
          </div>

          {/* Discount value */}
          <Input
            label={form.discount_type === 'percentage' ? 'Discount % (1–100)' : 'Flat Discount Amount (₹)'}
            type="number"
            min={1}
            max={form.discount_type === 'percentage' ? 100 : undefined}
            step="0.01"
            value={form.discount_value}
            onChange={(e) => setForm({ ...form, discount_value: e.target.value === '' ? '' : Number(e.target.value) })}
            placeholder={form.discount_type === 'percentage' ? '10' : '200'}
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Min. Cart Value (₹)"
              type="number"
              min={0}
              step="0.01"
              value={form.min_cart_value}
              onChange={(e) => setForm({ ...form, min_cart_value: e.target.value === '' ? '' : Number(e.target.value) })}
              placeholder="0 = no minimum"
            />
            {form.discount_type === 'percentage' && (
              <Input
                label="Max Discount Cap (₹)"
                type="number"
                min={0}
                step="0.01"
                value={form.max_discount_amount}
                onChange={(e) => setForm({ ...form, max_discount_amount: e.target.value === '' ? '' : Number(e.target.value) })}
                placeholder="Optional cap"
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Expiry Date"
              type="date"
              value={form.expiry_date}
              onChange={(e) => setForm({ ...form, expiry_date: e.target.value })}
              required
            />
            <Input
              label="Max Uses"
              type="number"
              min={1}
              value={form.max_uses}
              onChange={(e) => setForm({ ...form, max_uses: e.target.value === '' ? '' : Number(e.target.value) })}
              placeholder="Unlimited"
            />
          </div>

          {/* Preview */}
          {form.code && form.discount_value !== '' && (
            <div className="bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/30 rounded-xl p-3 text-sm">
              <p className="font-semibold text-orange-700 dark:text-orange-400 mb-1">Preview</p>
              <p className="text-orange-600 dark:text-orange-300">
                Code <span className="font-mono font-bold">{form.code}</span> gives{' '}
                {form.discount_type === 'percentage'
                  ? `${form.discount_value}% off`
                  : `₹${form.discount_value} off`}
                {form.min_cart_value ? ` on orders above ₹${form.min_cart_value}` : ''}
                {form.max_discount_amount && form.discount_type === 'percentage'
                  ? ` (max ₹${form.max_discount_amount})`
                  : ''}
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <Button type="button" variant="ghost" onClick={() => { setShowModal(false); setForm(EMPTY_FORM); }} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" loading={saving} className="flex-1">
              <Ticket size={14} /> Create Coupon
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

/**
 * QuickEditProductModal
 * ─────────────────────
 * Rapid in-place editor for the three fields sellers change most often:
 *   • Price
 *   • Stock Quantity
 *   • Listing Status (Active / Draft/Hidden)
 *
 * Hits the existing PUT /api/seller/product/<uuid> endpoint via FormData.
 * Full product edit (name, description, images, specs) remains on the
 * dedicated Edit Product page — this modal is intentionally minimal.
 *
 * Animations: CSS scale + opacity transition (no Framer Motion).
 */

import { useEffect, useState, useRef } from 'react';
import { X, Package, DollarSign, Layers, ToggleLeft, ToggleRight, Save } from 'lucide-react';
import { sellerApi } from '@/api/seller';
import type { Product } from '@/types';
import { formatPrice, getImageUrl } from '@/utils/image';
import { cn } from '@/utils/cn';
import toast from 'react-hot-toast';

interface QuickEditProductModalProps {
  product: Product | null;
  onClose: () => void;
  onSaved: () => void;   // called after a successful save so the table refreshes
}

export function QuickEditProductModal({
  product,
  onClose,
  onSaved,
}: QuickEditProductModalProps) {
  const isOpen = product !== null;

  const [price,    setPrice]    = useState('');
  const [stock,    setStock]    = useState('');
  const [isActive, setIsActive] = useState(true);
  const [saving,   setSaving]   = useState(false);

  // Animation
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync form when product changes
  useEffect(() => {
    if (product) {
      setPrice(String(product.price));
      setStock(String(product.stock));
      setIsActive(product.is_active);
    }
  }, [product]);

  // Mount/unmount animation
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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;

    const priceNum = parseFloat(price);
    const stockNum = parseInt(stock, 10);
    if (isNaN(priceNum) || priceNum < 0) { toast.error('Enter a valid price'); return; }
    if (isNaN(stockNum) || stockNum < 0) { toast.error('Enter a valid stock quantity'); return; }

    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('price',        String(priceNum));
      fd.append('stock',        String(stockNum));
      // Backend uses is_active field; send as string "true"/"false"
      // The update_product_action reads it from form payload
      fd.append('is_active',    String(isActive));
      // Keep existing name/description/category so they don't get blanked
      fd.append('name',         product.name);
      fd.append('description',  product.description);
      fd.append('category_uuid', product.category_uuid);

      await sellerApi.updateProduct(product.uuid, fd);
      toast.success('Product updated!');
      onSaved();
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  if (!mounted || !product) return null;

  const stockNum = parseInt(stock, 10);
  const isLowStock = !isNaN(stockNum) && stockNum > 0 && stockNum < 5;
  const isOutOfStock = !isNaN(stockNum) && stockNum === 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
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
          'relative w-full max-w-md',
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
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-slate-700/60">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-100 dark:bg-slate-700 shrink-0">
              {product.primary_image ? (
                <img
                  src={getImageUrl(product.primary_image)}
                  alt={product.name}
                  className="w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package size={16} className="text-gray-400 dark:text-slate-500" />
                </div>
              )}
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-gray-900 dark:text-slate-100 truncate text-sm">
                {product.name}
              </h2>
              <p className="text-xs text-gray-400 dark:text-slate-500 truncate">
                Quick Edit · {product.category}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:text-slate-500 dark:hover:text-slate-300 dark:hover:bg-slate-700/60 transition-colors shrink-0"
          >
            <X size={17} />
          </button>
        </div>

        {/* ── Form ── */}
        <form onSubmit={handleSave} className="p-5 space-y-4">
          {/* Price */}
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
              <DollarSign size={11} /> Price (₹)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 text-sm font-medium">₹</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={price}
                onChange={e => setPrice(e.target.value)}
                required
                className="w-full pl-7 pr-3 py-2.5 border border-gray-300 dark:border-slate-600 rounded-xl text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:outline-none focus:border-orange-500 dark:focus:border-orange-400 transition-colors font-semibold"
              />
            </div>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
              Current: {formatPrice(product.price)}
            </p>
          </div>

          {/* Stock */}
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
              <Layers size={11} /> Stock Quantity
            </label>
            <input
              type="number"
              min="0"
              value={stock}
              onChange={e => setStock(e.target.value)}
              required
              className={cn(
                'w-full px-3 py-2.5 border rounded-xl text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:outline-none transition-colors font-semibold',
                isOutOfStock
                  ? 'border-red-400 dark:border-red-500/60 focus:border-red-500'
                  : isLowStock
                  ? 'border-amber-400 dark:border-amber-500/60 focus:border-amber-500'
                  : 'border-gray-300 dark:border-slate-600 focus:border-orange-500 dark:focus:border-orange-400'
              )}
            />
            {/* Live stock status feedback */}
            {isOutOfStock && (
              <p className="text-xs text-red-500 dark:text-red-400 mt-1 font-medium">
                ⚠️ Product will be marked Out of Stock
              </p>
            )}
            {isLowStock && (
              <p className="text-xs text-amber-500 dark:text-amber-400 mt-1 font-medium">
                ⚠️ Low stock — consider restocking soon
              </p>
            )}
            {!isOutOfStock && !isLowStock && (
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
                Current: {product.stock} units
              </p>
            )}
          </div>

          {/* Listing status toggle */}
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-2 block">
              Listing Status
            </label>
            <button
              type="button"
              onClick={() => setIsActive(v => !v)}
              className={cn(
                'w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all',
                isActive
                  ? 'bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/30 text-green-700 dark:text-green-400'
                  : 'bg-gray-50 dark:bg-slate-800/60 border-gray-200 dark:border-slate-600 text-gray-500 dark:text-slate-400'
              )}
            >
              <div>
                <p className="text-sm font-semibold">
                  {isActive ? 'Active — Visible to customers' : 'Draft — Hidden from store'}
                </p>
                <p className="text-xs opacity-70 mt-0.5">
                  {isActive ? 'Customers can find and buy this product' : 'Product is saved but not listed'}
                </p>
              </div>
              {isActive
                ? <ToggleRight size={22} className="shrink-0" />
                : <ToggleLeft  size={22} className="shrink-0" />
              }
            </button>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 text-sm font-medium rounded-xl border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl bg-orange-500 hover:bg-orange-600 active:scale-95 text-white transition-all shadow-sm hover:shadow-orange-500/30 hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              ) : (
                <Save size={15} />
              )}
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

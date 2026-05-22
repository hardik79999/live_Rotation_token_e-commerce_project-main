/**
 * AdminProductQuickViewModal
 * ──────────────────────────
 * A polished, read-only Quick View modal for the Admin dashboard.
 *
 * Triggered by clicking any product row in:
 *   - ProductDirectoryPage  (AdminProduct shape)
 *   - SellerDetailPage      (SellerDetailTopProduct shape)
 *
 * Both callers pass a `productUuid`. The modal fetches the full
 * product detail from the public API (GET /api/user/product/:uuid)
 * so it always has images, description, and specifications.
 *
 * STRICT CONSTRAINT: Zero "Add to Cart", "Buy Now", or "Edit" buttons.
 */

import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X, Package, ExternalLink, Tag, User,
  AlertTriangle, CheckCircle, XCircle, ChevronLeft, ChevronRight,
  Layers, Info,
} from 'lucide-react';
import { browseApi } from '@/api/user';
import type { Product } from '@/types';
import { getImageUrl, formatPrice } from '@/utils/image';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/utils/cn';

// ── Stock status badge ────────────────────────────────────────────────────────
function StockBadge({ stock }: { stock: number }) {
  if (stock === 0) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-red-100 dark:bg-red-500/15 text-red-700 dark:text-red-400">
        <XCircle size={11} /> Out of Stock
      </span>
    );
  }
  if (stock < 5) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400">
        <AlertTriangle size={11} /> Low Stock — {stock} left
      </span>
    );
  }
  if (stock < 20) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-yellow-100 dark:bg-yellow-500/15 text-yellow-700 dark:text-yellow-400">
        <AlertTriangle size={11} /> Limited — {stock} units
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-green-100 dark:bg-green-500/15 text-green-700 dark:text-green-400">
      <CheckCircle size={11} /> In Stock — {stock} units
    </span>
  );
}

// ── Image gallery (thumbnail strip + main view) ───────────────────────────────
function ImageGallery({ product }: { product: Product }) {
  const images = product.images.length > 0
    ? product.images
    : [{ uuid: 'ph', url: product.primary_image ?? '/placeholder-product.png', is_primary: true }];

  const primaryIdx = images.findIndex(i => i.is_primary);
  const [active, setActive] = useState(primaryIdx >= 0 ? primaryIdx : 0);

  const prev = () => setActive(i => (i - 1 + images.length) % images.length);
  const next = () => setActive(i => (i + 1) % images.length);

  return (
    <div className="flex flex-col gap-3">
      {/* Main image */}
      <div className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 dark:bg-slate-700 group">
        <img
          key={active}
          src={getImageUrl(images[active]?.url)}
          alt={product.name}
          className="w-full h-full object-contain transition-opacity duration-200"
          onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder-product.png'; }}
        />
        {/* Nav arrows — only show when multiple images */}
        {images.length > 1 && (
          <>
            <button
              onClick={prev}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm flex items-center justify-center text-gray-700 dark:text-slate-200 shadow opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white dark:hover:bg-slate-700"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={next}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm flex items-center justify-center text-gray-700 dark:text-slate-200 shadow opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white dark:hover:bg-slate-700"
            >
              <ChevronRight size={14} />
            </button>
            {/* Dot indicator */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
              {images.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActive(i)}
                  className={cn(
                    'w-1.5 h-1.5 rounded-full transition-all',
                    i === active
                      ? 'bg-orange-500 w-3'
                      : 'bg-white/60 dark:bg-slate-400/60 hover:bg-white dark:hover:bg-slate-300'
                  )}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Thumbnail strip */}
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {images.map((img, idx) => (
            <button
              key={img.uuid}
              onClick={() => setActive(idx)}
              className={cn(
                'shrink-0 w-12 h-12 rounded-lg overflow-hidden border-2 transition-all',
                idx === active
                  ? 'border-orange-500 shadow-sm shadow-orange-200 dark:shadow-orange-900/30'
                  : 'border-gray-200 dark:border-slate-600 hover:border-gray-300 dark:hover:border-slate-500 opacity-70 hover:opacity-100'
              )}
            >
              <img
                src={getImageUrl(img.url)}
                alt=""
                className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder-product.png'; }}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Skeleton loader ───────────────────────────────────────────────────────────
function ModalSkeleton() {
  return (
    <div className="grid md:grid-cols-2 gap-6 animate-pulse">
      {/* Image placeholder */}
      <div className="aspect-square rounded-xl bg-gray-200 dark:bg-slate-700" />
      {/* Details placeholder */}
      <div className="space-y-4 py-1">
        <div className="h-3 w-20 bg-gray-200 dark:bg-slate-700 rounded-full" />
        <div className="h-6 w-3/4 bg-gray-200 dark:bg-slate-700 rounded-lg" />
        <div className="h-6 w-1/2 bg-gray-200 dark:bg-slate-700 rounded-lg" />
        <div className="h-8 w-28 bg-gray-200 dark:bg-slate-700 rounded-full" />
        <div className="space-y-2 pt-2">
          <div className="h-3 w-full bg-gray-200 dark:bg-slate-700 rounded" />
          <div className="h-3 w-5/6 bg-gray-200 dark:bg-slate-700 rounded" />
          <div className="h-3 w-4/6 bg-gray-200 dark:bg-slate-700 rounded" />
        </div>
        <div className="grid grid-cols-2 gap-2 pt-2">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-8 bg-gray-200 dark:bg-slate-700 rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────
interface AdminProductQuickViewModalProps {
  productUuid: string | null;
  /** Optional seller name to display when coming from SellerDetailPage */
  sellerName?: string;
  /** Optional seller uuid to link to seller detail */
  sellerUuid?: string;
  onClose: () => void;
}

export function AdminProductQuickViewModal({
  productUuid,
  sellerName,
  sellerUuid,
  onClose,
}: AdminProductQuickViewModalProps) {
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(false);

  const isOpen = productUuid !== null;

  // Fetch full product detail when uuid changes
  const fetchProduct = useCallback(async (uuid: string) => {
    setLoading(true);
    setError(false);
    setProduct(null);
    try {
      const res = await browseApi.getProduct(uuid);
      setProduct(res.data.data ?? null);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (productUuid) fetchProduct(productUuid);
  }, [productUuid, fetchProduct]);

  // Lock body scroll while open
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else        document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  // Escape key to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (isOpen) document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    /* ── Backdrop ── */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Product Quick View"
    >
      <div
        className="absolute inset-0 bg-black/55 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* ── Panel ── */}
      <div
        className={cn(
          'relative w-full max-w-3xl max-h-[90vh] flex flex-col',
          'bg-white dark:bg-slate-900',
          'rounded-2xl shadow-2xl dark:shadow-slate-950/70',
          'border border-gray-100 dark:border-slate-700/60',
          // Entry animation
          'animate-in fade-in zoom-in-95 duration-200',
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header bar ── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-slate-700/60 shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-orange-50 dark:bg-orange-500/10">
              <Package size={15} className="text-orange-500" />
            </div>
            <span className="text-sm font-semibold text-gray-700 dark:text-slate-300">
              Product Quick View
            </span>
            {/* Read-only pill */}
            <span className="hidden sm:inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30">
              <Info size={10} /> Read Only
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:text-slate-500 dark:hover:text-slate-300 dark:hover:bg-slate-700/60 transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading && <ModalSkeleton />}

          {error && !loading && (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-slate-500">
              <Package size={40} className="mb-3 opacity-30" />
              <p className="text-sm font-medium">Failed to load product details</p>
              <button
                onClick={() => productUuid && fetchProduct(productUuid)}
                className="mt-3 text-xs text-orange-500 hover:text-orange-600 font-medium"
              >
                Try again
              </button>
            </div>
          )}

          {product && !loading && (
            <div className="grid md:grid-cols-2 gap-6">

              {/* ── LEFT: Image gallery ── */}
              <ImageGallery product={product} />

              {/* ── RIGHT: Details ── */}
              <div className="flex flex-col gap-4 min-w-0">

                {/* Category pill */}
                <div>
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400">
                    <Tag size={10} /> {product.category}
                  </span>
                </div>

                {/* Name */}
                <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100 leading-snug">
                  {product.name}
                </h2>

                {/* Price + stock status */}
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-2xl font-extrabold text-gray-900 dark:text-slate-100">
                    {formatPrice(product.price)}
                  </span>
                  <StockBadge stock={product.stock} />
                </div>

                {/* Listing status */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 dark:text-slate-400 font-medium">Listing:</span>
                  {product.is_active ? (
                    <Badge variant="success">Active — Visible to customers</Badge>
                  ) : (
                    <Badge variant="danger">Hidden — Not visible in store</Badge>
                  )}
                </div>

                {/* Seller info */}
                {(sellerName || sellerUuid) && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-gray-50 dark:bg-slate-800/60 border border-gray-100 dark:border-slate-700/60">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                      {(sellerName ?? 'S')[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-400 dark:text-slate-500">Sold by</p>
                      {sellerUuid ? (
                        <button
                          onClick={() => { onClose(); navigate(`/admin/sellers/${sellerUuid}`); }}
                          className="text-sm font-semibold text-orange-500 hover:text-orange-600 dark:text-orange-400 dark:hover:text-orange-300 transition-colors truncate block"
                        >
                          {sellerName}
                        </button>
                      ) : (
                        <p className="text-sm font-semibold text-gray-800 dark:text-slate-200 truncate">
                          {sellerName}
                        </p>
                      )}
                    </div>
                    <User size={14} className="text-gray-300 dark:text-slate-600 shrink-0" />
                  </div>
                )}

                {/* Description */}
                {product.description && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                      Description
                    </p>
                    <p className="text-sm text-gray-600 dark:text-slate-400 leading-relaxed line-clamp-4">
                      {product.description}
                    </p>
                  </div>
                )}

                {/* Specifications */}
                {product.specifications.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                      <Layers size={11} /> Specifications
                    </p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {product.specifications.map((spec, idx) => (
                        <div
                          key={idx}
                          className="bg-gray-50 dark:bg-slate-800/60 rounded-lg px-3 py-2 border border-gray-100 dark:border-slate-700/50"
                        >
                          <p className="text-xs text-gray-400 dark:text-slate-500 truncate">{spec.key}</p>
                          <p className="text-xs font-semibold text-gray-800 dark:text-slate-200 truncate mt-0.5">
                            {spec.value}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Footer — "View in Store" only, no cart/edit actions ── */}
        {product && !loading && (
          <div className="px-5 py-4 border-t border-gray-100 dark:border-slate-700/60 shrink-0 flex items-center justify-between gap-3 bg-gray-50/50 dark:bg-slate-800/30 rounded-b-2xl">
            <p className="text-xs text-gray-400 dark:text-slate-500 hidden sm:block">
              UUID: <span className="font-mono">{product.uuid.slice(0, 16)}…</span>
            </p>
            <div className="flex items-center gap-2 ml-auto">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                Close
              </button>
              {/* View in Store — opens public product page in new tab */}
              <a
                href={`/product/${product.uuid}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-orange-500 hover:bg-orange-600 active:scale-95 text-white transition-all shadow-sm hover:shadow-orange-500/30 hover:shadow-md"
              >
                <ExternalLink size={14} /> View in Store
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

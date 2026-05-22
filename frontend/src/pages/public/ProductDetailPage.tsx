import { useEffect, useRef, useState, useCallback } from 'react';
import { PageSpinner } from '@/components/ui/Spinner';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ShoppingCart, Heart, Star, ChevronLeft, ChevronRight,
  Plus, Minus, ArrowRight, Camera, X, MessageCircle,
  ZoomIn,
} from 'lucide-react';
import { browseApi, cartApi, wishlistApi, reviewApi } from '@/api/user';
import type { Product, ProductVariant, Specification, ReviewItem } from '@/types';
import { getImageUrl, formatPrice } from '@/utils/image';
import { useTranslateField } from '@/utils/translate';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { StarRating } from '@/components/ui/StarRating';
import { ProductCard } from '@/components/product/ProductCard';
import { LiveChatModal } from '@/components/chat/LiveChatModal';
import { useAuthStore } from '@/store/authStore';
import { useCartStore } from '@/store/cartStore';
import { cn } from '@/utils/cn';
import toast from 'react-hot-toast';

// ─────────────────────────────────────────────────────────────
// SmartGallery — autoplay slideshow + thumbnail strip + zoom
// ─────────────────────────────────────────────────────────────
interface GalleryImage { uuid: string; url: string; is_primary: boolean }

function SmartGallery({ images }: { images: GalleryImage[] }) {
  const [activeIdx,  setActiveIdx]  = useState(0);
  const [playing,    setPlaying]    = useState(true);
  const [zoomed,     setZoomed]     = useState(false);
  const [zoomPos,    setZoomPos]    = useState({ x: 50, y: 50 });
  const intervalRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const thumbsRef    = useRef<HTMLDivElement>(null);

  // Reset to first image when image set changes (variant switch)
  useEffect(() => { setActiveIdx(0); setPlaying(true); }, [images]);

  // Autoplay
  useEffect(() => {
    if (playing && images.length > 1) {
      intervalRef.current = setInterval(() => {
        setActiveIdx(i => (i + 1) % images.length);
      }, 3000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [playing, images.length]);

  // Scroll active thumbnail into view
  useEffect(() => {
    const el = thumbsRef.current?.children[activeIdx] as HTMLElement | undefined;
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [activeIdx]);

  const prev = () => setActiveIdx(i => (i - 1 + images.length) % images.length);
  const next = () => setActiveIdx(i => (i + 1) % images.length);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!zoomed) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setZoomPos({
      x: ((e.clientX - rect.left) / rect.width)  * 100,
      y: ((e.clientY - rect.top)  / rect.height) * 100,
    });
  };

  if (images.length === 0) {
    return (
      <div className="aspect-square rounded-2xl bg-gray-100 dark:bg-slate-800 flex items-center justify-center">
        <ShoppingCart size={48} className="text-gray-300 dark:text-slate-600" />
      </div>
    );
  }

  const current = images[activeIdx];

  return (
    <div className="space-y-3">
      {/* ── Main image ── */}
      <div
        className="relative aspect-square rounded-2xl overflow-hidden bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 group cursor-zoom-in select-none"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setZoomed(false)}
        onClick={() => setZoomed(z => !z)}
      >
        <img
          key={current.uuid}
          src={getImageUrl(current.url)}
          alt="Product"
          className="w-full h-full object-contain transition-opacity duration-300"
          style={zoomed ? {
            transformOrigin: `${zoomPos.x}% ${zoomPos.y}%`,
            transform: 'scale(2.2)',
            cursor: 'zoom-out',
          } : { transform: 'scale(1)', cursor: 'zoom-in' }}
          draggable={false}
        />

        {/* Zoom hint */}
        {!zoomed && (
          <div className="absolute top-3 right-3 bg-black/40 text-white rounded-lg px-2 py-1 text-xs flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            <ZoomIn size={11} /> Click to zoom
          </div>
        )}

        {/* Prev / Next arrows */}
        {images.length > 1 && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); prev(); }}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 dark:bg-slate-800/80 shadow flex items-center justify-center text-gray-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 transition-colors opacity-0 group-hover:opacity-100"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); next(); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 dark:bg-slate-800/80 shadow flex items-center justify-center text-gray-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 transition-colors opacity-0 group-hover:opacity-100"
            >
              <ChevronRight size={16} />
            </button>
          </>
        )}



        {/* Dot indicators */}
        {images.length > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={(e) => { e.stopPropagation(); setActiveIdx(i); }}
                className={cn(
                  'rounded-full transition-all',
                  i === activeIdx
                    ? 'w-4 h-1.5 bg-orange-500'
                    : 'w-1.5 h-1.5 bg-white/60 hover:bg-white/90',
                )}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Thumbnail strip ── */}
      {images.length > 1 && (
        <div
          ref={thumbsRef}
          className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide"
        >
          {images.map((img, idx) => (
            <button
              key={img.uuid}
              onClick={() => { setActiveIdx(idx); setPlaying(false); }}
              className={cn(
                'shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 transition-all',
                idx === activeIdx
                  ? 'border-orange-500 shadow-sm shadow-orange-500/30'
                  : 'border-gray-200 dark:border-slate-600 hover:border-orange-300 dark:hover:border-orange-500/50 opacity-70 hover:opacity-100',
              )}
            >
              <img src={getImageUrl(img.url)} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// VariantSelector — Apple-style color swatches + size pills
// Uses product.colors / product.sizes for deduplication,
// and product.variants for the actual selection logic.
// ─────────────────────────────────────────────────────────────
function VariantSelector({
  product,
  selected,
  onSelect,
}: {
  product:  Product;
  selected: ProductVariant | null;
  onSelect: (v: ProductVariant) => void;
}) {
  const { variants, colors, sizes } = product;

  // When user clicks a color swatch, select the first variant with that color
  // that also matches the currently selected size (if any)
  const handleColorClick = (colorCode: string | null, colorName: string | null) => {
    const key = colorCode || colorName || '';
    const match = variants.find(v =>
      (v.color_code || v.color_name) === key &&
      (!selected?.size || v.size === selected.size) &&
      v.in_stock
    ) ?? variants.find(v => (v.color_code || v.color_name) === key);
    if (match) onSelect(match);
  };

  // When user clicks a size pill, select the first variant with that size
  // that also matches the currently selected color (if any)
  const handleSizeClick = (size: string) => {
    const selectedColorKey = selected?.color_code || selected?.color_name || '';
    const match = variants.find(v =>
      v.size === size &&
      (!selectedColorKey || (v.color_code || v.color_name) === selectedColorKey) &&
      v.in_stock
    ) ?? variants.find(v => v.size === size);
    if (match) onSelect(match);
  };

  const selectedColorKey = selected?.color_code || selected?.color_name || '';
  const selectedSize     = selected?.size || '';

  return (
    <div className="space-y-5">
      {/* ── Color swatches ── */}
      {colors.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">
            Colour
            {selected?.color_name && (
              <span className="font-normal text-gray-500 dark:text-slate-400 ml-2">
                — {selected.color_name}
              </span>
            )}
          </p>
          <div className="flex flex-wrap gap-3">
            {colors.map((c) => {
              const key        = c.color_code || c.color_name || '';
              const isSelected = selectedColorKey === key;
              const oos        = !c.in_stock;
              return (
                <button
                  key={key}
                  onClick={() => !oos && handleColorClick(c.color_code, c.color_name)}
                  title={`${c.color_name ?? ''}${oos ? ' — Out of Stock' : ''}`}
                  className={cn(
                    'relative w-10 h-10 rounded-full border-[3px] transition-all duration-200',
                    isSelected
                      ? 'border-orange-500 scale-110 shadow-lg shadow-orange-500/30'
                      : oos
                      ? 'border-gray-200 dark:border-slate-700 opacity-35 cursor-not-allowed'
                      : 'border-transparent hover:border-gray-400 dark:hover:border-slate-400 hover:scale-105 cursor-pointer',
                  )}
                  style={{ backgroundColor: c.color_code ?? '#e5e7eb' }}
                >
                  {/* OOS slash */}
                  {oos && (
                    <span className="absolute inset-0 flex items-center justify-center overflow-hidden rounded-full">
                      <span className="block w-[140%] h-[2px] bg-red-500/60 rotate-45" />
                    </span>
                  )}
                  {/* Selected ring inner dot */}
                  {isSelected && (
                    <span className="absolute inset-0 flex items-center justify-center">
                      <span className="w-2 h-2 rounded-full bg-white/80 shadow" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Size pills ── */}
      {sizes.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">
            Storage / Size
            {selectedSize && (
              <span className="font-normal text-gray-500 dark:text-slate-400 ml-2">
                — {selectedSize}
              </span>
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            {sizes.map((s) => {
              const isSelected = selectedSize === s.size;
              const oos        = !s.in_stock;
              return (
                <button
                  key={s.size}
                  onClick={() => !oos && handleSizeClick(s.size)}
                  className={cn(
                    'px-4 py-2 rounded-xl border text-sm font-medium transition-all duration-200',
                    isSelected
                      ? 'border-orange-500 bg-orange-500 text-white shadow-sm shadow-orange-500/30'
                      : oos
                      ? 'border-gray-200 dark:border-slate-700 text-gray-300 dark:text-slate-600 cursor-not-allowed line-through decoration-red-400'
                      : 'border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 hover:border-orange-400 hover:text-orange-500 dark:hover:border-orange-500 cursor-pointer',
                  )}
                >
                  {s.size}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Selected variant summary ── */}
      {selected && (
        <div className="flex items-center justify-between bg-gray-50 dark:bg-slate-800/60 rounded-xl px-4 py-3 border border-gray-100 dark:border-slate-700">
          <div>
            {selected.variant_name && (
              <p className="text-sm font-semibold text-gray-800 dark:text-slate-200">
                {selected.variant_name}
              </p>
            )}
            {selected.sku_code && (
              <p className="text-xs text-gray-400 dark:text-slate-500 font-mono mt-0.5">
                SKU: {selected.sku_code}
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-gray-900 dark:text-slate-100">
              {formatPrice(selected.final_price)}
            </p>
            {selected.in_stock ? (
              <p className="text-xs text-green-600 dark:text-green-400 font-medium flex items-center gap-1 justify-end">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" />
                {selected.stock_quantity <= 5 ? `Only ${selected.stock_quantity} left` : 'In Stock'}
              </p>
            ) : (
              <p className="text-xs text-red-500 dark:text-red-400 font-medium">Out of Stock</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SpecificationTable — Apple/Flipkart-style spec grid
// ─────────────────────────────────────────────────────────────
function SpecificationTable({ specifications }: { specifications: Specification[] }) {
  if (specifications.length === 0) return null;

  // Group specs into sections by detecting "header" keys (ALL CAPS or ending with ':')
  // Simple approach: just render as a clean two-column table
  return (
    <div className="mt-10">
      <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-4">
        Technical Specifications
      </h2>
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 overflow-hidden">
        {specifications.map((spec, idx) => (
          <div
            key={idx}
            className={cn(
              'grid grid-cols-5 gap-4 px-5 py-3.5 text-sm',
              idx % 2 === 0
                ? 'bg-gray-50/60 dark:bg-slate-800/60'
                : 'bg-white dark:bg-slate-800',
              idx !== specifications.length - 1 && 'border-b border-gray-100 dark:border-slate-700/50',
            )}
          >
            <span className="col-span-2 font-semibold text-gray-600 dark:text-slate-400 uppercase tracking-wide text-xs self-center">
              {spec.key}
            </span>
            <span className="col-span-3 text-gray-800 dark:text-slate-200 leading-relaxed">
              {spec.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// AccordionItem — H&M-style expandable row
// ─────────────────────────────────────────────────────────────
function AccordionItem({
  label,
  value,
  defaultOpen = false,
  isSpec = false,
}: {
  label: string;
  value: string;
  defaultOpen?: boolean;
  isSpec?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyRef = useRef<HTMLDivElement>(null);

  return (
    // ✅ FIX: border uses dark:border-slate-700 so it stays visible on dark bg
    <div className="border-b border-gray-200 dark:border-slate-700 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        // ✅ FIX: hover bg respects dark mode
        className="w-full flex items-center justify-between py-4 text-left group hover:bg-gray-50 dark:hover:bg-slate-800/50 rounded-lg px-1 -mx-1 transition-colors"
      >
        {/* ✅ FIX: label text visible in dark mode */}
        <span className="text-sm font-semibold uppercase tracking-wide transition-colors text-gray-800 dark:text-slate-200 group-hover:text-orange-500 dark:group-hover:text-orange-400">
          {label}
        </span>
        {/* ✅ FIX: icon color visible in dark mode */}
        <span className="shrink-0 ml-4 transition-colors text-gray-400 dark:text-slate-500 group-hover:text-orange-500 dark:group-hover:text-orange-400">
          {open ? <Minus size={16} /> : <Plus size={16} />}
        </span>
      </button>

      <div
        ref={bodyRef}
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{
          maxHeight: open ? (bodyRef.current?.scrollHeight ?? 800) + 'px' : '0px',
          opacity:   open ? 1 : 0,
        }}
      >
        {isSpec ? (
          // H&M style: bold label + values below
          <div className="pb-5 px-1 space-y-2">
            {/* ✅ FIX: spec key label */}
            <p className="text-sm font-bold text-gray-900 dark:text-slate-100">{label}:</p>
            {value.split('\n').map((line, i) => (
              // ✅ FIX: spec value text
              <p key={i} className="text-sm text-gray-600 dark:text-slate-400 leading-relaxed">
                {line}
              </p>
            ))}
          </div>
        ) : (
          // Plain text (description, delivery)
          // ✅ FIX: body text visible in dark mode
          <p className="pb-5 px-1 text-sm text-gray-600 dark:text-slate-400 leading-relaxed whitespace-pre-line">
            {value}
          </p>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SpecAccordion — groups duplicate spec keys
// ─────────────────────────────────────────────────────────────
function SpecAccordion({
  description,
  specifications,
}: {
  description: string;
  specifications: Specification[];
}) {
  const grouped = specifications.reduce<Record<string, string[]>>((acc, spec) => {
    if (!acc[spec.key]) acc[spec.key] = [];
    acc[spec.key].push(spec.value);
    return acc;
  }, {});

  return (
    // ✅ FIX: top border visible in dark mode
    <div className="border-t border-gray-200 dark:border-slate-700 mt-6">
      <AccordionItem
        label="Description & Fit"
        value={description}
        defaultOpen={true}
        isSpec={false}
      />

      {Object.entries(grouped).map(([key, values], idx) => (
        <AccordionItem
          key={`spec-${idx}-${key}`}
          label={key}
          value={values.join('\n')}
          defaultOpen={false}
          isSpec={true}
        />
      ))}

      <AccordionItem
        label="Delivery, Payment & Returns"
        value={
          'Free delivery on orders above ₹499.\n' +
          'Estimated delivery: 2–5 business days.\n' +
          '7-day hassle-free return policy.\n' +
          'Pay via UPI, Card, or Cash on Delivery.'
        }
        defaultOpen={false}
        isSpec={false}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// FrequentlyBoughtTogether — co-purchase recommendation engine
// ─────────────────────────────────────────────────────────────
function FrequentlyBoughtTogether({ productUuid }: { productUuid: string }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [source,   setSource]   = useState<string>('');
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    setLoading(true);
    browseApi
      .getRecommendations(productUuid)
      .then((r) => {
        setProducts(r.data.data || []);
        setSource(r.data.source || '');
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [productUuid]);

  // Label changes based on data source
  const label =
    source === 'co_purchase'      ? 'Customers Who Bought This Also Bought' :
    source === 'mixed'            ? 'Customers Who Bought This Also Bought' :
    source === 'category_fallback'? 'You Might Also Like'                   :
                                    'You Might Also Like';

  const sublabel =
    source === 'co_purchase' || source === 'mixed'
      ? 'Based on real purchase patterns'
      : 'Popular in this category';

  if (loading) {
    return (
      <div className="mt-14">
        <div className="h-5 w-72 bg-gray-200 dark:bg-slate-700 rounded animate-pulse mb-1" />
        <div className="h-3 w-40 bg-gray-100 dark:bg-slate-700/60 rounded animate-pulse mb-5" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-2xl overflow-hidden bg-gray-100 dark:bg-slate-800 animate-pulse">
              <div className="aspect-square bg-gray-200 dark:bg-slate-700" />
              <div className="p-3 space-y-2">
                <div className="h-3 bg-gray-200 dark:bg-slate-700 rounded w-3/4" />
                <div className="h-3 bg-gray-200 dark:bg-slate-700 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (products.length === 0) return null;

  return (
    <div className="mt-14">
      {/* Section header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            {(source === 'co_purchase' || source === 'mixed') && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold bg-orange-100 dark:bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-500/30 px-2 py-0.5 rounded-full">
                🤝 AI Picks
              </span>
            )}
            <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100">
              {label}
            </h2>
          </div>
          <p className="text-sm text-gray-500 dark:text-slate-400">{sublabel}</p>
        </div>
      </div>

      {/* Product grid — 4 cards, responsive */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {products.map((p) => (
          <RecommendationCard key={p.uuid} product={p} />
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// RecommendationCard — premium card with hover effects
// ─────────────────────────────────────────────────────────────
function RecommendationCard({ product }: { product: Product }) {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuthStore();
  const { setCart } = useCartStore();
  const tf = useTranslateField();
  const [adding, setAdding] = useState(false);

  const displayName = tf(product.name);

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAuthenticated || user?.role !== 'customer') {
      navigate('/login');
      return;
    }
    setAdding(true);
    try {
      await cartApi.addToCart(product.uuid, 1);
      toast.success(
        (t) => (
          <span className="flex items-center gap-3">
            <span>Added to cart!</span>
            <a
              href="/cart"
              onClick={() => toast.dismiss(t.id)}
              className="text-xs font-semibold underline underline-offset-2 hover:no-underline shrink-0"
            >
              View Cart →
            </a>
          </span>
        ),
        { duration: 4000 },
      );
      const cartRes = await cartApi.getCart();
      setCart(cartRes.data.data ?? [], cartRes.data.total_amount ?? 0);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Failed to add to cart');
    } finally {
      setAdding(false);
    }
  };

  const isOutOfStock = product.stock === 0;

  return (
    <div
      onClick={() => navigate(`/product/${product.uuid}`)}
      className="group relative bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 overflow-hidden cursor-pointer
                 hover:shadow-xl hover:-translate-y-1 hover:border-orange-200 dark:hover:border-orange-500/40
                 transition-all duration-300 ease-out active:scale-[0.98]"
    >
      {/* Image */}
      <div className="relative aspect-square overflow-hidden bg-gray-50 dark:bg-slate-700">
        <img
          src={getImageUrl(product.primary_image)}
          alt={displayName}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 ease-out"
          onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder-product.png'; }}
        />

        {/* Out of stock overlay */}
        {isOutOfStock && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="bg-white text-gray-800 text-xs font-semibold px-2.5 py-1 rounded-full">
              Out of Stock
            </span>
          </div>
        )}

        {/* Quick-add button — slides up on hover */}
        {!isOutOfStock && isAuthenticated && user?.role === 'customer' && (
          <div className="absolute bottom-0 left-0 right-0 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out">
            <button
              onClick={handleAddToCart}
              disabled={adding}
              className="w-full bg-orange-500/90 backdrop-blur-sm hover:bg-orange-600 text-white text-xs font-semibold py-2.5 flex items-center justify-center gap-1.5 transition-colors active:scale-95 disabled:opacity-60"
            >
              <ShoppingCart size={12} />
              {adding ? 'Adding…' : 'Add to Cart'}
            </button>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <p className="text-xs text-orange-500 font-medium truncate mb-0.5">{product.category}</p>
        <h3 className="text-sm font-semibold text-gray-800 dark:text-slate-200 line-clamp-2 leading-snug mb-2">
          {displayName}
        </h3>
        <div className="flex items-center justify-between gap-1">
          <span className="text-base font-bold text-gray-900 dark:text-slate-100">
            {formatPrice(product.price)}
          </span>
          {product.stock > 0 && product.stock <= 5 && (
            <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
              Only {product.stock} left
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MoreFromCategory — horizontal scroll row (category-based)
// ─────────────────────────────────────────────────────────────
function MoreFromCategory({
  currentUuid,
  categoryUuid,
  categoryName,
}: {
  currentUuid: string;
  categoryUuid: string;
  categoryName: string;
}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    if (!categoryUuid) return;
    browseApi
      .getProducts({ category: categoryUuid, limit: 9 })
      .then((r) => {
        const filtered = (r.data.data || []).filter((p) => p.uuid !== currentUuid);
        setProducts(filtered.slice(0, 8));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [categoryUuid, currentUuid]);

  if (loading) {
    return (
      <div className="mt-14">
        <div className="h-5 w-48 bg-gray-200 dark:bg-slate-700 rounded animate-pulse mb-5" />
        <div className="flex gap-4 overflow-x-auto pb-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="shrink-0 w-48 h-64 bg-gray-100 dark:bg-slate-800 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (products.length === 0) return null;

  return (
    <div className="mt-14">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100">More from {categoryName}</h2>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
            Browse the full <span className="text-orange-500 font-medium">{categoryName}</span> collection
          </p>
        </div>
        <Link
          to={`/products?category=${categoryUuid}`}
          className="flex items-center gap-1 text-sm text-orange-500 hover:text-orange-600 font-medium transition-colors"
        >
          See all <ArrowRight size={14} />
        </Link>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-3 -mx-1 px-1 scrollbar-hide snap-x snap-mandatory">
        {products.map((p) => (
          <div key={p.uuid} className="shrink-0 w-48 sm:w-56 snap-start">
            <ProductCard product={p} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main ProductDetailPage
// ─────────────────────────────────────────────────────────────
export function ProductDetailPage() {
  const { uuid } = useParams<{ uuid: string }>();
  const navigate  = useNavigate();
  const { isAuthenticated, user } = useAuthStore();
  const tf = useTranslateField();

  const [product,          setProduct]          = useState<Product | null>(null);
  const [loading,          setLoading]          = useState(true);
  const [activeImg,        setActiveImg]        = useState(0);
  const [qty,              setQty]              = useState(1);
  const [addingToCart,     setAddingToCart]     = useState(false);
  const [wishlisted,       setWishlisted]       = useState(false);
  const [rating,           setRating]           = useState(5);
  const [comment,          setComment]          = useState('');
  const [reviewImages,     setReviewImages]     = useState<File[]>([]);
  const [reviewPreviews,   setReviewPreviews]   = useState<string[]>([]);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [lightboxSrc,      setLightboxSrc]      = useState<string | null>(null);
  const [reviews,          setReviews]          = useState<ReviewItem[]>([]);
  const [avgRating,        setAvgRating]        = useState(0);
  const [reviewsLoading,   setReviewsLoading]   = useState(false);
  const [chatOpen,         setChatOpen]         = useState(false);
  const reviewFileRef = useRef<HTMLInputElement>(null);

  // ── Variant state ─────────────────────────────────────────
  const [selectedVariant, setSelectedVariant] = useState<import('@/types').ProductVariant | null>(null);

  const fetchReviews = (productUuid: string) => {
    setReviewsLoading(true);
    reviewApi.getReviews(productUuid)
      .then((r) => {
        setReviews(r.data.data || []);
        setAvgRating(r.data.avg_rating || 0);
      })
      .catch(() => {})
      .finally(() => setReviewsLoading(false));
  };

  useEffect(() => {
    if (!uuid) return;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setLoading(true);
    browseApi.getProduct(uuid)
      .then((r) => {
        const p = r.data.data || null;
        setProduct(p);
        const primaryIdx = p?.images.findIndex((i) => i.is_primary) ?? 0;
        setActiveImg(primaryIdx >= 0 ? primaryIdx : 0);
        if (p?.uuid) fetchReviews(p.uuid);

        // ── Auto-select: use backend-computed default (cheapest in-stock) ──
        if (p?.has_variants && p.variants.length > 0) {
          const defaultV = p.variants.find(v => v.uuid === p.default_variant_uuid)
            ?? p.variants.find(v => v.in_stock)
            ?? p.variants[0];
          setSelectedVariant(defaultV);
        } else {
          setSelectedVariant(null);
        }
      })
      .catch(() => toast.error('Product not found'))
      .finally(() => setLoading(false));
  }, [uuid]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const combined = [...reviewImages, ...files];
    if (combined.length > 6) {
      toast.error('Maximum 6 images allowed per review');
      e.target.value = '';
      return;
    }
    const newPreviews = files.map((f) => URL.createObjectURL(f));
    setReviewImages(combined);
    setReviewPreviews((prev) => [...prev, ...newPreviews]);
    e.target.value = '';
  };

  const removeReviewImage = (idx: number) => {
    URL.revokeObjectURL(reviewPreviews[idx]);
    setReviewImages((prev) => prev.filter((_, i) => i !== idx));
    setReviewPreviews((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleAddToCart = async () => {
    if (!isAuthenticated) { toast.error('Please login first'); return; }
    if (user?.role !== 'customer') { toast.error('Only customers can add to cart'); return; }
    setAddingToCart(true);
    try {
      await cartApi.addToCart(product!.uuid, qty);
      toast.success(
        (t) => (
          <span className="flex items-center gap-3">
            <span>Added to cart!</span>
            <a
              href="/cart"
              onClick={() => toast.dismiss(t.id)}
              className="text-xs font-semibold underline underline-offset-2 hover:no-underline shrink-0"
            >
              View Cart →
            </a>
          </span>
        ),
        { duration: 4000 },
      );
      const cartRes = await cartApi.getCart();
      useCartStore.getState().setCart(cartRes.data.data ?? [], cartRes.data.total_amount ?? 0);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Failed');
    } finally { setAddingToCart(false); }
  };

  const handleBuyNow = async () => {
    if (!isAuthenticated) { navigate('/login'); return; }
    await handleAddToCart();
    navigate('/cart');
  };

  const handleWishlist = async () => {
    if (!isAuthenticated) { toast.error('Please login first'); return; }
    try {
      const res = await wishlistApi.toggleWishlist(product!.uuid);
      const iw  = res.data?.data?.is_wishlisted;
      setWishlisted(!!iw);
      toast.success(iw ? 'Added to wishlist' : 'Removed from wishlist');
    } catch { toast.error('Failed'); }
  };

  const handleReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) { toast.error('Please login first'); return; }
    if (reviewImages.length > 6) { toast.error('Maximum 6 images allowed'); return; }
    setSubmittingReview(true);
    try {
      await reviewApi.addReview(product!.uuid, { rating, comment, images: reviewImages });
      toast.success('Review submitted!');
      setComment('');
      setRating(5);
      reviewPreviews.forEach((p) => URL.revokeObjectURL(p));
      setReviewImages([]);
      setReviewPreviews([]);
      fetchReviews(product!.uuid);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Failed to submit review');
    } finally { setSubmittingReview(false); }
  };

  if (loading) return <PageSpinner />;
  if (!product) return (
    <div className="text-center py-20">
      <p className="text-gray-500 dark:text-slate-400">Product not found.</p>
      <Button onClick={() => navigate('/products')} className="mt-4">Browse Products</Button>
    </div>
  );

  const displayName = tf(product.name);
  const displayDescription = tf(product.description);

  // ── Compute active gallery images ─────────────────────────
  // If a variant is selected and has its own images, show those.
  // Otherwise fall back to shared images (variant_id = null).
  const galleryImages = (() => {
    if (selectedVariant && selectedVariant.images.length > 0) {
      return selectedVariant.images;
    }
    return product.images.length > 0
      ? product.images
      : [{ uuid: 'placeholder', url: '/placeholder-product.png', is_primary: true, sort_order: 0 }];
  })();

  // Effective price = variant.final_price (already includes base + modifier)
  const effectivePrice = selectedVariant ? selectedVariant.final_price : product.price;

  // Effective stock
  const effectiveStock = selectedVariant ? selectedVariant.stock_quantity : product.stock;
  const isEffectivelyInStock = effectiveStock > 0;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">

      {/* ── Breadcrumb ── */}
      <nav className="text-sm text-gray-500 dark:text-slate-400 mb-6 flex items-center gap-2 flex-wrap">
        <button onClick={() => navigate('/products')} className="hover:text-orange-500 transition-colors">
          Products
        </button>
        <span className="text-gray-300 dark:text-slate-600">/</span>
        <Link to={`/products?category=${product.category_uuid}`} className="text-orange-500 hover:text-orange-600 transition-colors">
          {product.category}
        </Link>
        <span className="text-gray-300 dark:text-slate-600">/</span>
        <span className="text-gray-700 dark:text-slate-300 truncate max-w-xs">{displayName}</span>
      </nav>

      <div className="grid lg:grid-cols-2 gap-10">

        {/* ── Smart Gallery ── */}
        <SmartGallery images={galleryImages} />

        {/* ── Product details ── */}
        <div>
          <Badge variant="orange" className="mb-2">{product.category}</Badge>

          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-slate-100 leading-tight mb-3">
            {product.name}
          </h1>

          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl font-extrabold text-gray-900 dark:text-slate-100">
              {formatPrice(effectivePrice)}
            </span>
            {isEffectivelyInStock ? (
              <Badge variant="success">In Stock ({effectiveStock})</Badge>
            ) : (
              <Badge variant="danger">Out of Stock</Badge>
            )}
          </div>

          {/* ── Variant selector ── */}
          {product.has_variants && product.variants.length > 0 && (
            <div className="mb-5 p-4 bg-gray-50 dark:bg-slate-800/50 rounded-2xl border border-gray-100 dark:border-slate-700">
              <VariantSelector
                product={product}
                selected={selectedVariant}
                onSelect={setSelectedVariant}
              />
            </div>
          )}

          {isEffectivelyInStock && (
            <div className="space-y-3 mb-6">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-700 dark:text-slate-300">Quantity:</span>
                <div className="flex items-center border border-gray-300 dark:border-slate-600 rounded-lg overflow-hidden bg-white dark:bg-slate-800">
                  <button
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors text-gray-700 dark:text-slate-300"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="px-4 py-2 text-sm font-semibold min-w-[3rem] text-center text-gray-900 dark:text-slate-100 border-x border-gray-300 dark:border-slate-600">
                    {qty}
                  </span>
                  <button
                    onClick={() => setQty((q) => Math.min(effectiveStock, q + 1))}
                    className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors text-gray-700 dark:text-slate-300"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>

              <div className="flex gap-3">
                <Button onClick={handleAddToCart} loading={addingToCart} variant="outline" size="lg" className="flex-1">
                  <ShoppingCart size={18} /> Add to Cart
                </Button>
                <Button onClick={handleBuyNow} size="lg" className="flex-1">
                  Buy Now
                </Button>
                <Button onClick={handleWishlist} variant="ghost" size="lg" className="px-3">
                  <Heart size={18} className={wishlisted ? 'fill-red-500 text-red-500' : ''} />
                </Button>
              </div>

              {isAuthenticated && user?.role === 'customer' && (
                <button
                  onClick={() => setChatOpen(true)}
                  className="flex items-center gap-2 text-sm font-medium text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 transition-colors"
                >
                  <MessageCircle size={16} />
                  Chat with Seller
                </button>
              )}
            </div>
          )}

          <SpecAccordion
            description={product.description}
            specifications={product.specifications}
          />
        </div>
      </div>

      {/* ── Recommendations: Frequently Bought Together ── */}
      <FrequentlyBoughtTogether productUuid={product.uuid} />

      {/* ── More from this category (horizontal scroll) ── */}
      <MoreFromCategory
        currentUuid={product.uuid}
        categoryUuid={product.category_uuid}
        categoryName={product.category}
      />

      {/* ── Specification Table ── */}
      {product.specifications.length > 0 && (
        <SpecificationTable specifications={product.specifications} />
      )}

      {/* ── Live Chat Modal ── */}
      {chatOpen && isAuthenticated && user?.role === 'customer' && (
        <LiveChatModal
          sellerUuid={product.seller_uuid ?? ''}
          sellerName={product.seller_name ?? 'Seller'}
          sellerPhoto={product.seller_photo ?? null}
          productUuid={product.uuid}
          productName={product.name}
          onClose={() => setChatOpen(false)}
        />
      )}

      {/* ── Review section ── */}
      {isAuthenticated && user?.role === 'customer' && (
        <div className="mt-12 bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-1">Write a Review</h2>
          <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">
            Only customers who have received this product can submit a review.
          </p>
          <form onSubmit={handleReview} className="space-y-4">
            {/* Star rating */}
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-2 block">
                Your Rating
              </label>
              <StarRating value={rating} onChange={setRating} size={24} />
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
                maxLength={1000}
                placeholder="Share your experience with this product..."
                className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-slate-100 bg-white dark:bg-slate-900 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:border-orange-500 resize-none transition-colors"
              />
              <p className="text-xs text-gray-400 dark:text-slate-500 text-right mt-0.5">{comment.length}/1000</p>
            </div>

            {/* Multi-image upload */}
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-1 block">
                Photos <span className="text-gray-400 font-normal">(optional · max 6)</span>
              </label>
              <div className="flex flex-wrap gap-3 mt-2">
                {/* Previews */}
                {reviewPreviews.map((src, idx) => (
                  <div key={idx} className="relative w-20 h-20 rounded-xl overflow-hidden border-2 border-orange-300 dark:border-orange-500/50 group shadow-sm">
                    <img src={src} alt={`preview ${idx + 1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeReviewImage(idx)}
                      className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                    >
                      <X size={16} className="text-white" />
                    </button>
                    <span className="absolute bottom-0 right-0 bg-orange-500 text-white text-[9px] font-bold px-1 rounded-tl-lg leading-4">
                      {idx + 1}
                    </span>
                  </div>
                ))}
                {/* Add button */}
                {reviewImages.length < 6 && (
                  <button
                    type="button"
                    onClick={() => reviewFileRef.current?.click()}
                    className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-300 dark:border-slate-600 hover:border-orange-400 dark:hover:border-orange-500 hover:bg-orange-50 dark:hover:bg-orange-500/5 transition-colors flex flex-col items-center justify-center gap-1 text-gray-400 dark:text-slate-500 hover:text-orange-500"
                  >
                    <Camera size={18} />
                    <span className="text-[10px] font-medium">Add Photo</span>
                  </button>
                )}
              </div>
              <input
                ref={reviewFileRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleImageChange}
              />
              {reviewImages.length > 0 && (
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-1.5">
                  {reviewImages.length}/6 photo{reviewImages.length !== 1 ? 's' : ''} selected
                </p>
              )}
            </div>

            <Button type="submit" loading={submittingReview}>
              <Star size={16} /> Submit Review
            </Button>
          </form>
        </div>
      )}

      {/* ── Review list ── */}
      <div className="mt-10">
        <div className="flex items-center gap-3 mb-5">
          <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100">
            Customer Reviews
          </h2>
          {reviews.length > 0 && (
            <div className="flex items-center gap-1.5 bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/30 rounded-full px-3 py-1">
              <Star size={13} className="fill-yellow-400 text-yellow-400" />
              <span className="text-sm font-bold text-yellow-700 dark:text-yellow-400">{avgRating.toFixed(1)}</span>
              <span className="text-xs text-yellow-600 dark:text-yellow-500">({reviews.length})</span>
            </div>
          )}
        </div>

        {reviewsLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-4 animate-pulse">
                <div className="flex gap-3">
                  <div className="w-9 h-9 rounded-full bg-gray-200 dark:bg-slate-700 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-gray-200 dark:bg-slate-700 rounded w-1/4" />
                    <div className="h-3 bg-gray-200 dark:bg-slate-700 rounded w-3/4" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : reviews.length === 0 ? (
          <div className="text-center py-10 bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700">
            <Star size={36} className="text-gray-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-slate-400 font-medium">No reviews yet</p>
            <p className="text-sm text-gray-400 dark:text-slate-500 mt-1">Be the first to review this product!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {reviews.map((review) => (
              <div
                key={review.uuid}
                className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-4"
              >
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-full overflow-hidden bg-orange-100 dark:bg-orange-500/20 shrink-0 flex items-center justify-center">
                    {review.reviewer.profile_photo ? (
                      <img
                        src={getImageUrl(review.reviewer.profile_photo)}
                        alt={review.reviewer.username}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-sm font-bold text-orange-600 dark:text-orange-400">
                        {review.reviewer.username.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Header row */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-gray-800 dark:text-slate-200">
                        {review.reviewer.username}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30 px-2 py-0.5 rounded-full">
                        ✓ Verified Purchase
                      </span>
                      <span className="text-xs text-gray-400 dark:text-slate-500 ml-auto">
                        {review.created_at}
                      </span>
                    </div>

                    {/* Stars */}
                    <div className="flex gap-0.5 mt-1 mb-2">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          size={13}
                          className={s <= review.rating
                            ? 'fill-yellow-400 text-yellow-400'
                            : 'text-gray-300 dark:text-slate-600'
                          }
                        />
                      ))}
                    </div>

                    {/* Comment */}
                    {review.comment && (
                      <p className="text-sm text-gray-700 dark:text-slate-300 leading-relaxed">
                        {review.comment}
                      </p>
                    )}

                    {/* Image gallery — up to 6 */}
                    {(review.images ?? []).length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {review.images.map((url, imgIdx) => (
                          <button
                            key={imgIdx}
                            type="button"
                            onClick={() => setLightboxSrc(getImageUrl(url))}
                            className="w-20 h-20 rounded-xl overflow-hidden border border-gray-200 dark:border-slate-600 hover:border-orange-400 dark:hover:border-orange-500 hover:scale-105 transition-all shadow-sm"
                          >
                            <img
                              src={getImageUrl(url)}
                              alt={`Review photo ${imgIdx + 1}`}
                              className="w-full h-full object-cover"
                            />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Lightbox ── */}
      {lightboxSrc && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightboxSrc(null)}
        >
          <button
            className="absolute top-4 right-4 text-white/70 hover:text-white p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            onClick={() => setLightboxSrc(null)}
          >
            <X size={22} />
          </button>
          <img
            src={lightboxSrc}
            alt="Review photo"
            className="max-w-full max-h-[90vh] rounded-xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

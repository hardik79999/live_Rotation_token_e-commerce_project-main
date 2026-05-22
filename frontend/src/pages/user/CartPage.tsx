import { useEffect, useState, useCallback } from 'react';
import { PageSpinner } from '@/components/ui/Spinner';
import { Link, useNavigate } from 'react-router-dom';
import { Trash2, Plus, Minus, ShoppingBag, ArrowRight, RefreshCw, TrendingUp } from 'lucide-react';
import { cartApi, browseApi } from '@/api/user';
import type { CartItem, Product, PromoValidateResponse } from '@/types';
import { getImageUrl } from '@/utils/image';
import { Button } from '@/components/ui/Button';
import { ProductCard } from '@/components/product/ProductCard';
import { ProductGridSkeleton } from '@/components/ui/Skeleton';
import { PromoCodeInput } from '@/components/cart/PromoCodeInput';
import { useCartStore } from '@/store/cartStore';
import { useAuthStore } from '@/store/authStore';
import { useCurrency } from '@/hooks/useCurrency';
import toast from 'react-hot-toast';

// ── Smart empty state with "Trending Now" suggestions ────────
function EmptyCartState({ reason }: { reason: 'login' | 'empty' }) {
  const navigate = useNavigate();
  const [trending, setTrending] = useState<Product[]>([]);
  const [loadingT, setLoadingT] = useState(true);

  useEffect(() => {
    browseApi.getProducts({ limit: 4, sort_by: 'newest' })
      .then((r) => setTrending(r.data.data?.slice(0, 4) ?? []))
      .catch(() => {})
      .finally(() => setLoadingT(false));
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      {/* Empty state hero */}
      <div className="text-center py-10">
        <div className="w-20 h-20 rounded-full bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center mx-auto mb-4">
          <ShoppingBag size={36} className="text-orange-400" />
        </div>
        <h2 className="text-2xl font-bold text-gray-800 dark:text-slate-200 mb-2">
          {reason === 'login' ? 'Sign in to see your cart' : 'Your cart is empty'}
        </h2>
        <p className="text-gray-500 dark:text-slate-400 mb-6 max-w-xs mx-auto">
          {reason === 'login'
            ? 'Login to access your saved items and continue shopping'
            : 'Looks like you haven\'t added anything yet'}
        </p>
        <Button
          onClick={() => navigate(reason === 'login' ? '/login' : '/products')}
          size="lg"
        >
          <ShoppingBag size={18} />
          {reason === 'login' ? 'Login to Continue' : 'Browse Products'}
        </Button>
      </div>

      {/* Trending Now */}
      <div className="mt-8">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp size={18} className="text-orange-500" />
          <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100">Trending Now</h3>
          <span className="text-xs text-gray-400 dark:text-slate-500">— popular picks for you</span>
        </div>
        {loadingT ? (
          <ProductGridSkeleton count={4} />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            {trending.map((p) => (
              <ProductCard key={p.uuid} product={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function CartPage() {
  const { isAuthenticated } = useAuthStore();
  const { setCart, clearCart } = useCartStore();
  const { fmt } = useCurrency();
  const navigate = useNavigate();

  const [items, setItems] = useState<CartItem[]>([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  // ── Promo code state ──────────────────────────────────────
  const [appliedPromo,    setAppliedPromo]    = useState<PromoValidateResponse | null>(null);

  // ── Fetch cart from backend and sync Zustand store ──────────
  const fetchCart = useCallback(async () => {
    try {
      const res = await cartApi.getCart();
      const cartItems = res.data.data ?? [];
      const total = res.data.total_amount ?? 0;
      setItems(cartItems);
      setTotalAmount(total);
      setCart(cartItems, total);          // keep navbar badge in sync
    } catch {
      // 401 = not logged in, silently ignore
    } finally {
      setLoading(false);
    }
  }, [setCart]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchCart();
    } else {
      clearCart();
      setLoading(false);
    }
  }, [isAuthenticated, fetchCart, clearCart]);

  // ── Update quantity via PUT /api/user/cart ───────────────────
  // quantity = 0  →  backend soft-deletes the item (is_active = False)
  const handleUpdateQty = async (item: CartItem, newQty: number) => {
    setUpdating(item.product_uuid);
    try {
      await cartApi.updateCart(item.product_uuid, newQty);
      // Optimistic UI: update local state immediately, then sync from server
      if (newQty <= 0) {
        const updated = items.filter((i) => i.product_uuid !== item.product_uuid);
        const newTotal = updated.reduce((s, i) => s + i.subtotal, 0);
        setItems(updated);
        setTotalAmount(newTotal);
        setCart(updated, newTotal);
        toast.success('Item removed from cart');
      } else {
        const updated = items.map((i) =>
          i.product_uuid === item.product_uuid
            ? { ...i, quantity: newQty, subtotal: i.price * newQty }
            : i
        );
        const newTotal = updated.reduce((s, i) => s + i.subtotal, 0);
        setItems(updated);
        setTotalAmount(newTotal);
        setCart(updated, newTotal);
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message;
      toast.error(msg || 'Failed to update cart');
      // Re-fetch to restore correct state on error
      await fetchCart();
    } finally {
      setUpdating(null);
    }
  };

  // ── Add one more of the same item via POST /api/user/cart ────
  const handleAddOne = async (item: CartItem) => {
    setUpdating(item.product_uuid);
    try {
      await cartApi.addToCart(item.product_uuid, 1);
      const updated = items.map((i) =>
        i.product_uuid === item.product_uuid
          ? { ...i, quantity: i.quantity + 1, subtotal: i.price * (i.quantity + 1) }
          : i
      );
      const newTotal = updated.reduce((s, i) => s + i.subtotal, 0);
      setItems(updated);
      setTotalAmount(newTotal);
      setCart(updated, newTotal);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message;
      toast.error(msg || 'Failed to update cart');
      await fetchCart();
    } finally {
      setUpdating(null);
    }
  };

  // ── Not logged in ────────────────────────────────────────────
  if (!isAuthenticated && !loading) {
    return <EmptyCartState reason="login" />;
  }

  if (loading) return <PageSpinner />;

  // ── Empty cart ───────────────────────────────────────────────
  if (items.length === 0) {
    return <EmptyCartState reason="empty" />;
  }

  const totalItems = items.reduce((s, i) => s + i.quantity, 0);
  const deliveryFee = totalAmount >= 499 ? 0 : 49;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">
          Shopping Cart{' '}
          <span className="text-gray-400 dark:text-slate-500 font-normal text-lg">
            ({totalItems} {totalItems === 1 ? 'item' : 'items'})
          </span>
        </h1>
        <button
          onClick={fetchCart}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-orange-500 transition-colors"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* ── Cart items ── */}
        <div className="lg:col-span-2 space-y-3">
          {items.map((item) => {
            const isBusy = updating === item.product_uuid;
            return (
              <div
                key={item.cart_item_id}
                className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-4 flex gap-4 items-center"
              >
                {/* Product image */}
                <Link
                  to={`/product/${item.product_uuid}`}
                  className="w-20 h-20 rounded-lg overflow-hidden bg-gray-50 dark:bg-slate-700 shrink-0 hover:opacity-90 transition-opacity"
                >
                  <img
                    src={getImageUrl(item.image)}
                    alt={item.product_name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/placeholder-product.png';
                    }}
                  />
                </Link>

                {/* Name + price */}
                <div className="flex-1 min-w-0">
                  <Link
                    to={`/product/${item.product_uuid}`}
                    className="font-semibold text-gray-800 dark:text-slate-200 hover:text-orange-500 transition-colors line-clamp-2 text-sm leading-snug"
                  >
                    {item.product_name}
                  </Link>
                  <p className="text-orange-500 font-bold mt-1 text-sm">
                    {fmt(item.price)} <span className="text-gray-400 font-normal">each</span>
                  </p>
                </div>

                {/* Quantity controls — uses PUT /api/user/cart for decrease/set, POST for increase */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleUpdateQty(item, item.quantity - 1)}
                    disabled={isBusy}
                    title={item.quantity === 1 ? 'Remove item' : 'Decrease quantity'}
                    className="w-8 h-8 rounded-lg border border-gray-300 dark:border-slate-600 flex items-center justify-center hover:bg-gray-50 dark:hover:bg-slate-700 hover:border-red-300 hover:text-red-500 transition-colors disabled:opacity-40"
                  >
                    {item.quantity === 1 ? <Trash2 size={13} /> : <Minus size={13} />}
                  </button>

                  <span className="w-9 text-center font-semibold text-sm tabular-nums text-gray-900 dark:text-slate-100">
                    {isBusy ? (
                      <span className="inline-block w-4 h-4 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      item.quantity
                    )}
                  </span>

                  <button
                    onClick={() => handleAddOne(item)}
                    disabled={isBusy}
                    title="Increase quantity"
                    className="w-8 h-8 rounded-lg border border-gray-300 dark:border-slate-600 flex items-center justify-center hover:bg-orange-50 dark:hover:bg-orange-500/10 hover:border-orange-400 hover:text-orange-500 transition-colors disabled:opacity-40"
                  >
                    <Plus size={13} />
                  </button>
                </div>

                {/* Subtotal + remove */}
                <div className="text-right shrink-0 min-w-[70px]">
                  <p className="font-bold text-gray-900 dark:text-slate-100 text-sm">{fmt(item.subtotal)}</p>
                  <button
                    onClick={() => handleUpdateQty(item, 0)}
                    disabled={isBusy}
                    className="text-xs text-red-400 hover:text-red-600 mt-1 transition-colors disabled:opacity-40"
                  >
                    Remove
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Order summary ── */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-5 sticky top-24">
            <h2 className="font-bold text-gray-900 dark:text-slate-100 text-lg mb-4">Order Summary</h2>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-gray-600 dark:text-slate-400">
                <span>
                  Subtotal ({totalItems} {totalItems === 1 ? 'item' : 'items'})
                </span>
                <span>{fmt(totalAmount)}</span>
              </div>
              <div className="flex justify-between text-gray-600 dark:text-slate-400">
                <span>Delivery</span>
                <span className={deliveryFee === 0 ? 'text-green-600 font-medium' : ''}>
                  {deliveryFee === 0 ? 'FREE' : fmt(deliveryFee)}
                </span>
              </div>
              {deliveryFee > 0 && totalAmount < 499 && (
                <p className="text-xs text-gray-400 dark:text-slate-500">
                  Add {fmt(499 - totalAmount)} more for free delivery
                </p>
              )}

              {/* ── Promo code input ── */}
              <div className="pt-2 pb-1">
                <PromoCodeInput
                  cartTotal={totalAmount}
                  appliedCode={appliedPromo?.code}
                  discountAmount={appliedPromo?.discount_amount}
                  onApplied={(result) => setAppliedPromo(result)}
                  onRemoved={() => setAppliedPromo(null)}
                />
              </div>

              {/* Discount line */}
              {appliedPromo && appliedPromo.discount_amount > 0 && (
                <div className="flex justify-between text-green-600 dark:text-green-400 font-medium">
                  <span>Discount ({appliedPromo.code})</span>
                  <span>− {fmt(appliedPromo.discount_amount)}</span>
                </div>
              )}

              <div className="border-t border-gray-100 dark:border-slate-700 pt-2 flex justify-between font-bold text-gray-900 dark:text-slate-100 text-base">
                <span>Total</span>
                <div className="text-right">
                  {appliedPromo && appliedPromo.discount_amount > 0 ? (
                    <>
                      <span className="line-through text-gray-400 dark:text-slate-500 font-normal text-sm mr-2">
                        {fmt(totalAmount + deliveryFee)}
                      </span>
                      <span className="text-green-600 dark:text-green-400">
                        {fmt(appliedPromo.final_total + deliveryFee)}
                      </span>
                    </>
                  ) : (
                    <span>{fmt(totalAmount + deliveryFee)}</span>
                  )}
                </div>
              </div>
            </div>

            <Button
              onClick={() => navigate('/checkout', {
                state: appliedPromo ? { coupon_code: appliedPromo.code } : undefined,
              })}
              size="lg"
              className="w-full mt-5"
            >
              Proceed to Checkout <ArrowRight size={18} />
            </Button>

            <Link
              to="/products"
              className="block text-center text-sm text-orange-500 hover:text-orange-600 mt-3 transition-colors"
            >
              ← Continue Shopping
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

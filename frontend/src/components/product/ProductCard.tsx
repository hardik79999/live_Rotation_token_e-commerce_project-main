import { Link } from 'react-router-dom';
import { ShoppingCart, Heart } from 'lucide-react';
import type { Product } from '@/types';
import { getImageUrl } from '@/utils/image';
import { cartApi, wishlistApi } from '@/api/user';
import { useAuthStore } from '@/store/authStore';
import { useCartStore } from '@/store/cartStore';
import { useCurrency } from '@/hooks/useCurrency';
import { useTranslateField } from '@/utils/translate';
import toast from 'react-hot-toast';
import { useState } from 'react';
import { cn } from '@/utils/cn';

interface ProductCardProps {
  product: Product;
  onCartUpdate?: () => void;
  initialWishlisted?: boolean;   // true when rendered inside WishlistPage
}

export function ProductCard({ product, onCartUpdate, initialWishlisted = false }: ProductCardProps) {
  const { isAuthenticated, user } = useAuthStore();
  const { setCart } = useCartStore();
  const { fmt } = useCurrency();
  const tf = useTranslateField();
  const [addingToCart, setAddingToCart] = useState(false);
  const [wishlisted, setWishlisted] = useState(initialWishlisted);

  const displayName = tf(product.name);

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!isAuthenticated) {
      toast.error('Please login to add items to cart');
      return;
    }
    if (user?.role !== 'customer') {
      toast.error('Only customers can add to cart');
      return;
    }
    setAddingToCart(true);
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
      onCartUpdate?.();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message;
      toast.error(msg || 'Failed to add to cart');
    } finally {
      setAddingToCart(false);
    }
  };

  const handleWishlist = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!isAuthenticated) {
      toast.error('Please login to use wishlist');
      return;
    }
    try {
      const res = await wishlistApi.toggleWishlist(product.uuid);
      const isWishlisted = res.data?.data?.is_wishlisted;
      setWishlisted(!!isWishlisted);
      toast.success(isWishlisted ? 'Added to wishlist' : 'Removed from wishlist');
    } catch {
      toast.error('Failed to update wishlist');
    }
  };

  const isOutOfStock = product.stock === 0;

  return (
    <Link
      to={`/product/${product.uuid}`}
      className={cn(
        'group rounded-xl border shadow-sm overflow-hidden flex flex-col',
        // Light
        'bg-white border-gray-100',
        // Dark
        'dark:bg-slate-800 dark:border-slate-700',
        // ── Premium micro-interactions ──
        'hover:shadow-xl hover:-translate-y-1 hover:border-orange-200 dark:hover:border-orange-500/50',
        'transition-all duration-300 ease-out',
        'active:scale-[0.98]',
      )}
    >
      {/* Image */}
      <div className="relative aspect-square overflow-hidden bg-gray-50">
        <img
          src={getImageUrl(product.primary_image)}
          alt={displayName}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 ease-out"
          onError={(e) => {
            (e.target as HTMLImageElement).src = '/placeholder-product.png';
          }}
        />

        {/* Out of stock overlay */}
        {isOutOfStock && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="bg-white text-gray-800 text-xs font-semibold px-3 py-1 rounded-full">
              Out of Stock
            </span>
          </div>
        )}

        {/* Wishlist button */}
        {isAuthenticated && user?.role === 'customer' && (
          <button
            onClick={handleWishlist}
            className={cn(
              'absolute top-2 right-2 p-1.5 bg-white rounded-full shadow-md',
              'hover:scale-125 active:scale-95 transition-transform duration-200',
              'opacity-0 group-hover:opacity-100',
              // Always visible if wishlisted
              wishlisted && 'opacity-100',
            )}
            aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
          >
            <Heart
              size={16}
              className={cn(
                'transition-colors duration-200',
                wishlisted ? 'fill-red-500 text-red-500' : 'text-gray-400 hover:text-red-400',
              )}
            />
          </button>
        )}


      </div>

      {/* Info */}
      <div className="p-3 flex flex-col gap-1.5 flex-1">
        <p className="text-xs text-orange-500 font-medium truncate flex items-center gap-1">
          {product.category_icon && <span className="leading-none">{product.category_icon}</span>}
          {product.category}
        </p>
        <h3 className="text-sm font-semibold text-gray-800 dark:text-slate-200 line-clamp-2 leading-snug">
          {displayName}
        </h3>
        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <span className="text-base font-bold text-gray-900 dark:text-slate-100">{fmt(product.price)}</span>
          {/* Fallback add button for mobile / non-customer */}
          <button
            onClick={handleAddToCart}
            disabled={isOutOfStock || addingToCart}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium',
              'transition-all duration-200 active:scale-95',
              isOutOfStock
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-orange-500 text-white hover:bg-orange-600 shadow-sm hover:shadow-orange-200 hover:shadow-md',
            )}
          >
            <ShoppingCart size={13} />
            {addingToCart ? '...' : 'Add'}
          </button>
        </div>
      </div>
    </Link>
  );
}

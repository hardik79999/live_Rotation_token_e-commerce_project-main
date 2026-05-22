import { useEffect, useState } from 'react';
import { PageSpinner } from '@/components/ui/Spinner';
import { Heart, Search, X } from 'lucide-react';
import { wishlistApi } from '@/api/user';
import type { Product } from '@/types';
import { ProductCard } from '@/components/product/ProductCard';
import toast from 'react-hot-toast';

export function WishlistPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');

  const fetchWishlist = () => {
    wishlistApi.getWishlist()
      .then((r) => setProducts((r.data.data as Product[]) || []))
      .catch(() => toast.error('Failed to load wishlist'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchWishlist(); }, []);

  if (loading) return <PageSpinner />;

  const filtered = search.trim()
    ? products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    : products;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">My Wishlist</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">{products.length} saved item{products.length !== 1 ? 's' : ''}</p>
        </div>
        {products.length > 0 && (
          <div className="relative w-full sm:w-64">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Search wishlist…"
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
        )}
      </div>

      {products.length === 0 ? (
        <div className="text-center py-20">
          <Heart size={64} className="text-gray-300 dark:text-slate-600 mx-auto mb-4" />
          <p className="text-xl font-semibold text-gray-700 dark:text-slate-300 mb-2">Your wishlist is empty</p>
          <p className="text-gray-500 dark:text-slate-400">Save products you love to buy them later</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400 dark:text-slate-500">
          <Search size={36} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">No items match "{search}"</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((p) => (
            <ProductCard key={p.uuid} product={p} initialWishlisted={true} onCartUpdate={fetchWishlist} />
          ))}
        </div>
      )}
    </div>
  );
}

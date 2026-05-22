import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, ShoppingBag, Shield, Truck, RefreshCw } from 'lucide-react';
import { browseApi } from '@/api/user';
import type { Category, Product } from '@/types';
import { ProductCard } from '@/components/product/ProductCard';
import { ProductGridSkeleton } from '@/components/ui/Skeleton';
import { getImageUrl } from '@/utils/image';

export function HomePage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [featured, setFeatured] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      browseApi.getCategories(),
      browseApi.getProducts({ limit: 8, sort_by: 'newest' }),
    ])
      .then(([catRes, prodRes]) => {
        setCategories(catRes.data.data || []);
        setFeatured(prodRes.data.data || []);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="overflow-x-hidden">
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-4 py-12 lg:py-24 flex flex-col lg:flex-row items-center gap-10">
          <div className="flex-1 text-center lg:text-left">
            <span className="inline-block bg-orange-500/20 text-orange-400 text-sm font-medium px-3 py-1 rounded-full mb-4">
              🛒 India's Fastest Growing Marketplace
            </span>
            <h1 className="text-3xl sm:text-4xl lg:text-6xl font-extrabold leading-tight mb-4">
              Shop Smart,<br />
              <span className="text-orange-400">Save More</span>
            </h1>
            <p className="text-gray-300 text-base sm:text-lg mb-8 max-w-lg mx-auto lg:mx-0">
              Discover millions of products from verified sellers. Fast delivery, easy returns, and the best prices guaranteed.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
              <Link
                to="/products"
                className="inline-flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 active:scale-95 text-white px-6 py-3 rounded-xl font-semibold transition-all duration-200 shadow-lg shadow-orange-500/30"
              >
                <ShoppingBag size={18} /> Shop Now
              </Link>
              <Link
                to="/signup?role=seller"
                className="inline-flex items-center justify-center gap-2 border border-gray-500 hover:border-orange-400 hover:text-orange-400 active:scale-95 text-gray-300 px-6 py-3 rounded-xl font-semibold transition-all duration-200"
              >
                Start Selling <ArrowRight size={18} />
              </Link>
            </div>
          </div>

          {/* Hero product grid — skeleton while loading */}
          <div className="flex-1 grid grid-cols-2 gap-3 max-w-xs sm:max-w-sm lg:max-w-md w-full">
            {loading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="aspect-square rounded-xl bg-gray-700 animate-pulse" />
                ))
              : featured.slice(0, 4).map((p) => (
                  <Link
                    key={p.uuid}
                    to={`/product/${p.uuid}`}
                    className="aspect-square rounded-xl overflow-hidden bg-gray-700 hover:scale-105 active:scale-95 transition-transform duration-300"
                  >
                    <img
                      src={getImageUrl(p.primary_image)}
                      alt={p.name}
                      className="w-full h-full object-cover"
                    />
                  </Link>
                ))}
          </div>
        </div>
      </section>

      {/* ── Feature badges ───────────────────────────────────── */}
      <section className="bg-orange-50 dark:bg-slate-800/50 border-y border-orange-100 dark:border-slate-700">
        <div className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {[
            { icon: <Truck className="text-orange-500" size={22} />, title: 'Fast Delivery', desc: 'Get it in 2-5 days' },
            { icon: <Shield className="text-orange-500" size={22} />, title: 'Secure Payments', desc: 'Razorpay protected' },
            { icon: <RefreshCw className="text-orange-500" size={22} />, title: 'Easy Returns', desc: '7-day return policy' },
            { icon: <ShoppingBag className="text-orange-500" size={22} />, title: '10K+ Products', desc: 'Verified sellers only' },
          ].map((f) => (
            <div key={f.title} className="flex items-center gap-3">
              <div className="p-2 bg-white dark:bg-slate-800 rounded-xl shadow-sm shrink-0">{f.icon}</div>
              <div>
                <p className="font-semibold text-sm text-gray-800 dark:text-slate-200">{f.title}</p>
                <p className="text-xs text-gray-500 dark:text-slate-400">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Categories horizontal scroll ─────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 py-10">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-slate-100">Shop by Category</h2>
          <Link to="/products" className="text-orange-500 hover:text-orange-600 text-sm font-medium flex items-center gap-1 shrink-0">
            View all <ArrowRight size={14} />
          </Link>
        </div>

        {loading ? (
          /* Category pill skeletons */
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="shrink-0 h-10 w-24 rounded-xl bg-gray-200 dark:bg-slate-700 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {categories.map((cat) => (
              <button
                key={cat.uuid}
                onClick={() => navigate(`/products?category=${cat.uuid}`)}
                className="shrink-0 px-5 py-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm font-medium text-gray-700 dark:text-slate-300 hover:border-orange-400 hover:text-orange-500 hover:shadow-sm active:scale-95 transition-all duration-200 whitespace-nowrap"
              >
                {cat.name}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* ── Featured Products ─────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 pb-16">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-slate-100">New Arrivals</h2>
          <Link to="/products" className="text-orange-500 hover:text-orange-600 text-sm font-medium flex items-center gap-1 shrink-0">
            See all <ArrowRight size={14} />
          </Link>
        </div>

        {loading ? (
          <ProductGridSkeleton count={8} />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {featured.map((product) => (
              <ProductCard key={product.uuid} product={product} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

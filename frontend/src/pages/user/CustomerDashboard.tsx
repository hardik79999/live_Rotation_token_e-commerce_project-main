/**
 * CustomerDashboard — the landing page when a customer logs in.
 * Shows: recent orders summary, quick stats, featured products, wishlist preview.
 */
import { useEffect, useState } from 'react';
import { PageSpinner } from '@/components/ui/Spinner';
import { Link, useNavigate } from 'react-router-dom';
import {
  ShoppingBag, Heart, MapPin, Package,
  ArrowRight, TrendingUp, Clock, CheckCircle,
} from 'lucide-react';
import { orderApi, browseApi, wishlistApi } from '@/api/user';
import type { Order, Product } from '@/types';
import { formatPrice, formatDate } from '@/utils/image';
import { Badge, orderStatusBadge } from '@/components/ui/Badge';
import { ProductCard } from '@/components/product/ProductCard';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';

export function CustomerDashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [wishlistCount, setWishlistCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      orderApi.getOrders().catch(() => ({ data: { data: [] } })),
      browseApi.getProducts({ limit: 4, sort_by: 'newest' }).catch(() => ({ data: { data: [] } })),
      wishlistApi.getWishlist().catch(() => ({ data: { data: [] } })),
    ]).then(([ordersRes, productsRes, wishlistRes]) => {
      setOrders((ordersRes.data.data as Order[]) || []);
      setProducts((productsRes.data.data as Product[]) || []);
      setWishlistCount(((wishlistRes.data.data as Product[]) || []).length);
    }).catch(() => toast.error('Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageSpinner />;

  const totalSpent = orders
    .filter((o) => o.status !== 'cancelled')
    .reduce((s, o) => s + o.amount, 0);

  const recentOrders = orders.slice(0, 3);

  return (
    <div className="space-y-6">
      {/* ── Welcome banner ── */}
      <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-2xl p-6 text-white">
        <p className="text-gray-400 text-sm mb-1">Welcome back,</p>
        <h1 className="text-2xl font-bold">{user?.username} 👋</h1>
        <p className="text-gray-300 text-sm mt-1">{user?.email}</p>
        <div className="flex gap-3 mt-4">
          <Link
            to="/products"
            className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
          >
            <ShoppingBag size={15} /> Shop Now
          </Link>
          <Link
            to="/user/orders"
            className="inline-flex items-center gap-2 border border-gray-600 hover:border-orange-400 text-gray-300 hover:text-orange-400 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
          >
            My Orders <ArrowRight size={15} />
          </Link>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Total Orders',
            value: orders.length,
            icon: <Package size={20} className="text-blue-500" />,
            bg: 'bg-blue-50 dark:bg-blue-500/10',
            link: '/user/orders',
          },
          {
            label: 'Total Spent',
            value: formatPrice(totalSpent),
            icon: <TrendingUp size={20} className="text-green-500" />,
            bg: 'bg-green-50 dark:bg-green-500/10',
            link: '/user/orders',
          },
          {
            label: 'Wishlist',
            value: wishlistCount,
            icon: <Heart size={20} className="text-red-500" />,
            bg: 'bg-red-50 dark:bg-red-500/10',
            link: '/user/wishlist',
          },
          {
            label: 'Delivered',
            value: orders.filter((o) => o.status === 'delivered').length,
            icon: <CheckCircle size={20} className="text-orange-500" />,
            bg: 'bg-orange-50 dark:bg-orange-500/10',
            link: '/user/orders',
          },
        ].map((stat) => (
          <Link
            key={stat.label}
            to={stat.link}
            className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-4 hover:shadow-md transition-shadow flex items-center gap-3"
          >
            <div className={`p-2.5 rounded-xl ${stat.bg} shrink-0`}>{stat.icon}</div>
            <div className="min-w-0">
              <p className="text-xs text-gray-500 dark:text-slate-400 truncate">{stat.label}</p>
              <p className="text-lg font-bold text-gray-900 dark:text-slate-100 truncate">{stat.value}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* ── Recent orders ── */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-slate-700">
          <h2 className="font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
            <Clock size={16} className="text-orange-500" /> Recent Orders
          </h2>
          <Link
            to="/user/orders"
            className="text-sm text-orange-500 hover:text-orange-600 font-medium flex items-center gap-1"
          >
            View all <ArrowRight size={13} />
          </Link>
        </div>

      {recentOrders.length === 0 ? (
          <div className="text-center py-10">
            <div className="w-14 h-14 rounded-full bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center mx-auto mb-3">
              <ShoppingBag size={24} className="text-orange-400" />
            </div>
            <p className="text-gray-600 dark:text-slate-400 text-sm font-medium mb-1">No orders yet</p>
            <p className="text-gray-400 dark:text-slate-500 text-xs mb-3">Your order history will appear here</p>
            <Link
              to="/products"
              className="inline-flex items-center gap-1 text-orange-500 hover:text-orange-600 text-sm font-semibold"
            >
              Start shopping <ArrowRight size={13} />
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-50 dark:divide-slate-700/50">
            {recentOrders.map((order) => (
              <div
                key={order.uuid}
                className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer"
                onClick={() => navigate('/user/orders')}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center shrink-0">
                    <Package size={16} className="text-orange-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800 dark:text-slate-200 font-mono">
                      #{order.uuid.slice(0, 8).toUpperCase()}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-slate-500">{formatDate(order.date)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={orderStatusBadge(order.status)}>
                    {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                  </Badge>
                  <p className="font-bold text-gray-900 dark:text-slate-100 text-sm">{formatPrice(order.amount)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Quick links ── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { to: '/user/wishlist', icon: <Heart size={20} className="text-red-500" />, label: 'Wishlist', bg: 'bg-red-50 dark:bg-red-500/10' },
          { to: '/user/addresses', icon: <MapPin size={20} className="text-blue-500" />, label: 'Addresses', bg: 'bg-blue-50 dark:bg-blue-500/10' },
          { to: '/cart', icon: <ShoppingBag size={20} className="text-green-500" />, label: 'My Cart', bg: 'bg-green-50 dark:bg-green-500/10' },
        ].map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-4 flex flex-col items-center gap-2 hover:shadow-md hover:border-orange-200 dark:hover:border-orange-500/40 transition-all text-center"
          >
            <div className={`p-3 rounded-xl ${item.bg}`}>{item.icon}</div>
            <p className="text-sm font-medium text-gray-700 dark:text-slate-300">{item.label}</p>
          </Link>
        ))}
      </div>

      {/* ── New arrivals ── */}
      {products.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-900 dark:text-slate-100 text-lg">New Arrivals</h2>
            <Link
              to="/products"
              className="text-sm text-orange-500 hover:text-orange-600 font-medium flex items-center gap-1"
            >
              Browse all <ArrowRight size={13} />
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {products.map((p) => (
              <ProductCard key={p.uuid} product={p} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

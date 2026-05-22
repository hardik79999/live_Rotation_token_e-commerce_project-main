import { Outlet, NavLink, useNavigate, Link } from 'react-router-dom';
import {
  LayoutDashboard, Package, Tag, ShoppingBag, Heart,
  MapPin, LogOut, Menu, X, ChevronRight, Users,
  CheckSquare, ClipboardList, Home, User, Globe, MessageCircle, Ticket,
} from 'lucide-react';
import { useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { authApi } from '@/api/auth';
import { useCartStore } from '@/store/cartStore';
import { UserAvatar } from '@/components/ui/UserAvatar';
import toast from 'react-hot-toast';
import { cn } from '@/utils/cn';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import type { Role } from '@/types';

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  roles: Role[];
}

const navItems: NavItem[] = [
  // Customer
  { to: '/user/dashboard', label: 'Dashboard',  icon: <LayoutDashboard size={17} />, roles: ['customer'] },
  { to: '/user/profile',   label: 'My Profile',  icon: <User size={17} />,           roles: ['customer'] },
  { to: '/user/orders',    label: 'My Orders',   icon: <ShoppingBag size={17} />,    roles: ['customer'] },
  { to: '/user/wishlist',  label: 'Wishlist',    icon: <Heart size={17} />,          roles: ['customer'] },
  { to: '/user/addresses', label: 'Addresses',   icon: <MapPin size={17} />,         roles: ['customer'] },
  // Seller
  { to: '/seller/dashboard',  label: 'Dashboard',        icon: <LayoutDashboard size={17} />, roles: ['seller'] },
  { to: '/seller/products',   label: 'My Products',      icon: <Package size={17} />,     roles: ['seller'] },
  { to: '/seller/categories', label: 'Categories',        icon: <Tag size={17} />,         roles: ['seller'] },
  { to: '/seller/coupons',    label: 'My Coupons',        icon: <Ticket size={17} />,      roles: ['seller'] },
  { to: '/seller/orders',     label: 'Order Management',  icon: <ClipboardList size={17} />, roles: ['seller'] },
  { to: '/seller/messages',   label: 'Messages',          icon: <MessageCircle size={17} />, roles: ['seller'] },
  { to: '/seller/profile',    label: 'My Profile',        icon: <User size={17} />,        roles: ['seller'] },
  // Admin
  { to: '/admin/dashboard',          label: 'Dashboard',         icon: <LayoutDashboard size={17} />, roles: ['admin'] },
  { to: '/admin/sellers',            label: 'Seller Surveillance', icon: <Users size={17} />,          roles: ['admin'] },
  { to: '/admin/products',           label: 'Product Directory', icon: <Globe size={17} />,           roles: ['admin'] },
  { to: '/admin/categories',         label: 'Categories',        icon: <Tag size={17} />,             roles: ['admin'] },
  { to: '/admin/category-requests',  label: 'Category Requests', icon: <CheckSquare size={17} />,     roles: ['admin'] },
  { to: '/admin/profile',            label: 'My Profile',        icon: <User size={17} />,            roles: ['admin'] },
];

const ROLE_LABELS: Record<Role, string> = {
  customer: 'Customer Panel',
  seller:   'Seller Panel',
  admin:    'Admin Panel',
};

export function DashboardLayout() {
  const { user, clearUser } = useAuthStore();
  const { itemCount } = useCartStore();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const filteredNav = navItems.filter((item) =>
    user?.role ? item.roles.includes(user.role) : false
  );

  const handleLogout = async () => {
    try { await authApi.logout(); } catch { /* ignore */ }
    clearUser();
    toast.success('Logged out');
    navigate('/');
  };

  function SidebarContent() {
    return (
      <aside className="flex flex-col h-full w-64 bg-gray-900 text-white">
        {/* Brand */}
        <div className="px-5 py-3 border-b border-gray-800 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo.png" alt="ShopHub" className="h-10 w-auto object-contain"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            <span className="text-base font-bold text-white">
              Shop<span className="text-orange-400">Hub</span>
            </span>
          </Link>
          <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full capitalize font-medium">
            {user?.role}
          </span>
        </div>

        {/* User card — click to go to profile */}
        <Link
          to={`/${user?.role === 'admin' ? 'admin' : user?.role === 'seller' ? 'seller' : 'user'}/profile`}
          className="px-4 py-4 border-b border-gray-800 flex items-center gap-3 hover:bg-gray-800/50 transition-colors"
        >
          <UserAvatar
            src={user?.profile_photo}
            name={user?.username ?? '?'}
            size="md"
            className="ring-2 ring-orange-400 shadow-lg"
          />
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate text-white">{user?.username}</p>
            <p className="text-xs text-gray-400 truncate">{user?.email}</p>
          </div>
        </Link>

        {/* Nav */}
        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
          {filteredNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all group',
                  isActive
                    ? 'bg-orange-500 text-white font-semibold shadow-sm'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                )
              }
            >
              {item.icon}
              <span className="flex-1">{item.label}</span>
              <ChevronRight size={13} className="opacity-0 group-hover:opacity-50 transition-opacity" />
            </NavLink>
          ))}
        </nav>

        {/* Bottom actions */}
        <div className="px-3 py-3 border-t border-gray-800 space-y-1">
          {/* Back to store */}
          <Link
            to="/"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:bg-gray-800 hover:text-white transition-all"
          >
            <Home size={17} /> Back to Store
          </Link>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-red-400 hover:bg-red-900/30 hover:text-red-300 transition-all"
          >
            <LogOut size={17} /> Logout
          </button>
        </div>
      </aside>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-slate-900 overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex flex-col shrink-0 shadow-xl">
        <SidebarContent />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="relative z-10 flex flex-col shadow-2xl">
            <SidebarContent />
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="absolute top-4 right-4 z-20 p-2 bg-white rounded-full shadow-lg text-gray-600"
          >
            <X size={18} />
          </button>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 px-4 py-3 flex items-center gap-3 shadow-sm">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors text-gray-600 dark:text-slate-300"
          >
            <Menu size={20} />
          </button>

          <div className="flex-1 min-w-0">
            <Link to="/" className="flex items-center gap-2">
              <img src="/logo.png" alt="ShopHub" className="h-9 w-auto object-contain"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              <span className="font-bold text-gray-800 dark:text-slate-100 text-sm">
                Shop<span className="text-orange-500">Hub</span>
              </span>
            </Link>
          </div>

          <div className="flex items-center gap-2">
            {/* Theme toggle */}
            <ThemeToggle className="text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-gray-900 dark:hover:text-white" />

            {/* Cart badge for customers */}
            {user?.role === 'customer' && (
              <Link
                to="/cart"
                className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors text-gray-600 dark:text-slate-300"
              >
                <ShoppingBag size={18} />
                {itemCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-orange-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold leading-none">
                    {itemCount > 9 ? '9+' : itemCount}
                  </span>
                )}
              </Link>
            )}

            {/* Avatar — links to profile */}
            <Link
              to={`/${user?.role === 'admin' ? 'admin' : user?.role === 'seller' ? 'seller' : 'user'}/profile`}
              className="shrink-0"
            >
              <UserAvatar
                src={user?.profile_photo}
                name={user?.username ?? '?'}
                size="sm"
                className="ring-2 ring-orange-400 shadow"
              />
            </Link>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 bg-gray-50 dark:bg-slate-900">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

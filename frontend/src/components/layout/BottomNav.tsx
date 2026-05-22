/**
 * BottomNav — iOS/Android-style bottom navigation bar.
 * Visible only on mobile (hidden sm:hidden).
 * Respects iOS safe-area-inset-bottom via pb-safe class.
 * All touch targets are min 44px per Apple HIG.
 */
import { Link, useLocation } from 'react-router-dom';
import { Home, Search, ShoppingCart, User } from 'lucide-react';
import { useCartStore } from '@/store/cartStore';
import { useAuthStore } from '@/store/authStore';
import { cn } from '@/utils/cn';

const NAV_ITEMS = [
  { to: '/',         icon: Home,         label: 'Home'    },
  { to: '/products', icon: Search,       label: 'Search'  },
  { to: '/cart',     icon: ShoppingCart, label: 'Cart'    },
  { to: '/user/profile', icon: User,     label: 'Profile' },
] as const;

export function BottomNav() {
  const { pathname } = useLocation();
  const { itemCount } = useCartStore();
  const { isAuthenticated, user } = useAuthStore();

  // Only show for customers and guests — sellers/admins use the sidebar
  if (isAuthenticated && user?.role !== 'customer') return null;

  const profileTo = isAuthenticated ? '/user/profile' : '/login';

  return (
    <nav
      className={cn(
        // Only visible on mobile
        'sm:hidden',
        // Fixed to bottom, full width, above everything
        'fixed bottom-0 left-0 right-0 z-40',
        // Background + border
        'bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-slate-700',
        // Safe area inset for iPhone notch/home indicator
        'pb-safe',
        // Shadow
        'shadow-[0_-4px_20px_rgba(0,0,0,0.08)] dark:shadow-[0_-4px_20px_rgba(0,0,0,0.3)]',
      )}
    >
      <div className="flex items-stretch">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => {
          const href      = to === '/user/profile' ? profileTo : to;
          const isActive  = to === '/'
            ? pathname === '/'
            : pathname.startsWith(to === '/user/profile' ? '/user' : to);

          return (
            <Link
              key={to}
              to={href}
              className={cn(
                // Touch target: min 44px height, flex-1 width
                'flex-1 flex flex-col items-center justify-center gap-0.5',
                'min-h-[56px] py-2 px-1',
                'transition-colors duration-150 active:scale-95',
                isActive
                  ? 'text-orange-500'
                  : 'text-gray-500 dark:text-slate-400 hover:text-orange-400',
              )}
              aria-label={label}
            >
              <div className="relative">
                <Icon size={22} strokeWidth={isActive ? 2.5 : 1.8} />
                {/* Cart badge */}
                {to === '/cart' && itemCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-orange-500 text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-0.5 leading-none">
                    {itemCount > 99 ? '99+' : itemCount}
                  </span>
                )}
              </div>
              <span className={cn(
                'text-[10px] font-medium leading-none',
                isActive ? 'text-orange-500' : 'text-gray-400 dark:text-slate-500',
              )}>
                {label}
              </span>
              {/* Active indicator dot */}
              {isActive && (
                <span className="absolute bottom-1 w-1 h-1 rounded-full bg-orange-500" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

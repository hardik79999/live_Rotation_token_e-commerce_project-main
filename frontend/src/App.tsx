import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useThemeStore } from '@/store/themeStore';
import { authApi } from '@/api/auth';
import { PWAInstallBanner } from '@/components/ui/PWAInstallBanner';

// Layouts
import { PublicLayout } from '@/components/layout/PublicLayout';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

// Public pages
import { HomePage } from '@/pages/public/HomePage';
import { ProductsPage } from '@/pages/public/ProductsPage';
import { ProductDetailPage } from '@/pages/public/ProductDetailPage';

// Auth pages
import { LoginPage } from '@/pages/auth/LoginPage';
import { SignupPage } from '@/pages/auth/SignupPage';
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage';
import { GoogleAuthSuccess } from '@/pages/auth/GoogleAuthSuccess';

// User pages
import { CartPage } from '@/pages/user/CartPage';
import { CheckoutPage } from '@/pages/user/CheckoutPage';
import { OrdersPage } from '@/pages/user/OrdersPage';
import { WishlistPage } from '@/pages/user/WishlistPage';
import { AddressesPage } from '@/pages/user/AddressesPage';
import { CustomerDashboard } from '@/pages/user/CustomerDashboard';
import { UserProfilePage } from '@/pages/user/UserProfilePage';
import { ProfilePage } from '@/pages/shared/ProfilePage';
import { WalletHistoryPage } from '@/pages/user/WalletHistoryPage';

// Seller pages
import { SellerProductsPage } from '@/pages/seller/SellerProductsPage';
import { SellerCategoriesPage } from '@/pages/seller/SellerCategoriesPage';
import { SellerOrdersPage } from '@/pages/seller/SellerOrdersPage';
import { SellerOverviewPage } from '@/pages/seller/SellerOverviewPage';
import { SellerMessagesPage } from '@/pages/seller/SellerMessagesPage';
import { SellerCouponsPage } from '@/pages/seller/SellerCouponsPage';

// Admin pages
import { AdminDashboardPage } from '@/pages/admin/AdminDashboardPage';
import { CategoryRequestsPage } from '@/pages/admin/CategoryRequestsPage';
import { ManageSellersPage } from '@/pages/admin/ManageSellersPage';
import { AdminCategoriesPage } from '@/pages/admin/AdminCategoriesPage';
import { SellerSurveillancePage } from '@/pages/admin/SellerSurveillancePage';
import { SellerDetailPage } from '@/pages/admin/SellerDetailPage';
import { ProductDirectoryPage } from '@/pages/admin/ProductDirectoryPage';

export default function App() {
  const { setUser, clearUser } = useAuthStore();
  // Initialize theme on mount — reads from localStorage via Zustand persist
  // The store's onRehydrateStorage already applies the class, but calling
  // setMode here ensures the system-preference listener is active.
  const { mode, setMode } = useThemeStore();
  useEffect(() => { setMode(mode); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Global loading state while we verify the session on mount ──────────
  const [appReady, setAppReady] = useState(false);

  useEffect(() => {
    // Listen for auth:expired events dispatched by the Axios interceptor
    const handler = () => clearUser();
    window.addEventListener('auth:expired', handler);
    return () => window.removeEventListener('auth:expired', handler);
  }, [clearUser]);

  useEffect(() => {
    /**
     * Silent Login — runs exactly once on app mount.
     *
     * Calls GET /api/auth/profile using the existing Axios instance.
     * The Axios interceptor handles everything automatically:
     *   • If access token is valid   → profile returns 200 → user saved
     *   • If access token expired    → interceptor silently refreshes
     *                                  → retries profile → user saved
     *   • If refresh token expired   → interceptor dispatches auth:expired
     *                                  → clearUser() called above
     *   • If no cookies at all       → 401 → clearUser stays as-is (not logged in)
     */
    authApi.profile()
      .then((res) => {
        if (res.data.data) setUser(res.data.data);
      })
      .catch(() => {
        // 401 with no valid refresh = not logged in, clear any stale state
        clearUser();
      })
      .finally(() => {
        // App is ready to render regardless of outcome
        setAppReady(true);
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Block render until session check completes ─────────────────────────
  // This prevents a flash of the login page for users who ARE logged in.
  if (!appReady) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <img
            src="/logo.png"
            alt="ShopHub"
            className="h-16 w-auto object-contain animate-pulse"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-400">Loading ShopHub...</p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      {/* ── PWA Install Banner ── */}
      <PWAInstallBanner />
      {/*
        ── Premium Toast Configuration ──────────────────────────────────────
        Position: bottom-right — never overlaps the top-right Navbar/Profile.
        Dark mode: reads the 'dark' class on <html> via CSS variables.
        Styling: matches the app's slate/gray palette with colored left borders
                 for instant visual scanning (green=success, red=error, etc.)
      */}
      <Toaster
        position="bottom-right"
        gutter={10}
        containerStyle={{ bottom: 24, right: 24 }}
        toastOptions={{
          duration: 4000,
          // ── Base style — respects dark mode via CSS class on <html> ──
          style: {
            maxWidth: '380px',
            padding: '12px 16px',
            borderRadius: '12px',
            fontSize: '14px',
            fontWeight: '500',
            lineHeight: '1.4',
            boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08)',
            border: '1px solid',
            // Light mode defaults (overridden per-type below)
            background: '#ffffff',
            color: '#111827',
            borderColor: '#e5e7eb',
          },
          // ── Success — green left accent ───────────────────────────────
          success: {
            duration: 3500,
            style: {
              background: '#f0fdf4',
              color: '#14532d',
              borderColor: '#bbf7d0',
              borderLeft: '4px solid #22c55e',
            },
            iconTheme: { primary: '#22c55e', secondary: '#f0fdf4' },
          },
          // ── Error — red left accent ───────────────────────────────────
          error: {
            duration: 5000,
            style: {
              background: '#fef2f2',
              color: '#7f1d1d',
              borderColor: '#fecaca',
              borderLeft: '4px solid #ef4444',
            },
            iconTheme: { primary: '#ef4444', secondary: '#fef2f2' },
          },
          // ── Loading — neutral ─────────────────────────────────────────
          loading: {
            style: {
              background: '#f9fafb',
              color: '#374151',
              borderColor: '#e5e7eb',
              borderLeft: '4px solid #f97316',
            },
            iconTheme: { primary: '#f97316', secondary: '#f9fafb' },
          },
        }}
      />

      <Routes>
        {/* ── Auth (no layout) ── */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/auth/google/success" element={<GoogleAuthSuccess />} />

        {/* ── Public (Navbar + Footer) ── */}
        <Route element={<PublicLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/product/:uuid" element={<ProductDetailPage />} />
          <Route path="/cart" element={<CartPage />} />
        </Route>

        {/* ── Customer dashboard ── */}
        <Route
          element={
            <ProtectedRoute allowedRoles={['customer']}>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/user/dashboard" element={<CustomerDashboard />} />
          <Route path="/user/profile" element={<ProfilePage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/user/orders" element={<OrdersPage />} />
          <Route path="/user/wishlist" element={<WishlistPage />} />
          <Route path="/user/addresses" element={<AddressesPage />} />
          <Route path="/user/wallet" element={<WalletHistoryPage />} />
        </Route>

        {/* ── Seller dashboard ── */}
        <Route
          element={
            <ProtectedRoute allowedRoles={['seller']}>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/seller/dashboard" element={<SellerOverviewPage />} />
          <Route path="/seller/products" element={<SellerProductsPage />} />
          <Route path="/seller/categories" element={<SellerCategoriesPage />} />
          <Route path="/seller/coupons" element={<SellerCouponsPage />} />
          <Route path="/seller/orders" element={<SellerOrdersPage />} />
          <Route path="/seller/messages" element={<SellerMessagesPage />} />
          <Route path="/seller/profile" element={<ProfilePage />} />
        </Route>

        {/* ── Admin dashboard ── */}
        <Route
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
          <Route path="/admin/categories" element={<AdminCategoriesPage />} />
          <Route path="/admin/category-requests" element={<CategoryRequestsPage />} />
          <Route path="/admin/sellers" element={<SellerSurveillancePage />} />
          <Route path="/admin/sellers/:uuid" element={<SellerDetailPage />} />
          <Route path="/admin/products" element={<ProductDirectoryPage />} />
          <Route path="/admin/profile" element={<ProfilePage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

/**
 * routes.ts — Single source of truth for every backend API endpoint.
 *
 * Rules:
 *  - No raw URL strings anywhere else in the codebase.
 *  - All API files import from here.
 *  - Dynamic segments use functions that accept the UUID and return the full path.
 *  - Grouped by blueprint prefix to mirror the Flask backend structure.
 */

// ─────────────────────────────────────────────────────────────
// 🔐 AUTH  —  /api/auth/*
// ─────────────────────────────────────────────────────────────
export const AUTH = {
  SIGNUP:           '/api/auth/signup',
  LOGIN:            '/api/auth/login',
  LOGOUT:           '/api/auth/logout',
  PROFILE:          '/api/auth/profile',
  UPDATE_PROFILE:   '/api/auth/profile',
  PROFILE_PHOTO:    '/api/auth/profile/photo',
  REFRESH_TOKEN:    '/api/auth/refresh-token',
  FORGOT_PASSWORD:  '/api/auth/forgot-password',
  RESET_PASSWORD:   '/api/auth/reset-password',
  DELETE_ACCOUNT:   '/api/auth/delete-account',
  GOOGLE_EXCHANGE:  '/api/auth/google/exchange',
} as const;

// ─────────────────────────────────────────────────────────────
// 💱 CURRENCY  —  /api/currency/*  (no auth)
// ─────────────────────────────────────────────────────────────
export const CURRENCY = {
  RATES:   '/api/currency/rates',
  REFRESH: '/api/currency/refresh',
} as const;

// ─────────────────────────────────────────────────────────────
// 🔍 SEARCH  —  /api/search/*  (no auth)
// ─────────────────────────────────────────────────────────────
export const SEARCH = {
  PRODUCTS: '/api/search/products',
} as const;

// ─────────────────────────────────────────────────────────────
// 🌐 USER — PUBLIC BROWSING  —  /api/user/*  (no auth)
// ─────────────────────────────────────────────────────────────
export const BROWSE = {
  CATEGORIES:           '/api/user/categories',
  PRODUCTS:             '/api/user/products',
  PRODUCT:              (uuid: string) => `/api/user/product/${uuid}` as const,
  RECOMMENDATIONS:      (uuid: string) => `/api/user/product/${uuid}/recommendations` as const,
} as const;

// ─────────────────────────────────────────────────────────────
// 🛒 USER — CART  —  /api/user/cart  (auth required)
// ─────────────────────────────────────────────────────────────
export const CART = {
  BASE:              '/api/user/cart',
  PROMO_VALIDATE:    '/api/user/promo/validate',
  PROMO_AVAILABLE:   '/api/user/promo/available',
} as const;

// ─────────────────────────────────────────────────────────────
// ❤️  USER — WISHLIST  —  /api/user/wishlist  (auth required)
// ─────────────────────────────────────────────────────────────
export const WISHLIST = {
  BASE: '/api/user/wishlist',   // GET / POST (toggle) share this path
} as const;

// ─────────────────────────────────────────────────────────────
// 📍 USER — ADDRESS  —  /api/user/address(es)  (auth required)
// ─────────────────────────────────────────────────────────────
export const ADDRESS = {
  ADD:          '/api/user/address',
  LIST:         '/api/user/addresses',
  SET_DEFAULT:  (uuid: string) => `/api/user/address/${uuid}/set-default` as const,
  DELETE:       (uuid: string) => `/api/user/address/${uuid}` as const,
} as const;

// ─────────────────────────────────────────────────────────────
// 💸 USER — ORDERS & CHECKOUT  (auth required)
// ─────────────────────────────────────────────────────────────
export const ORDER = {
  CHECKOUT:         '/api/user/checkout',
  VERIFY_PAYMENT:   '/api/user/verify-payment',
  LIST:             '/api/user/orders',
  STATUS:      (uuid: string) => `/api/user/order/status/${uuid}` as const,
  INVOICE:     (uuid: string) => `/api/user/order/${uuid}/invoice` as const,
  INVOICE_PDF: (uuid: string) => `/api/user/order/${uuid}/invoice/download` as const,
  RETURN:      (uuid: string) => `/api/user/order/${uuid}/return` as const,
} as const;

// ─────────────────────────────────────────────────────────────
// 💰 USER — WALLET  (customer JWT required)
// ─────────────────────────────────────────────────────────────
export const WALLET = {
  BALANCE:      '/api/user/wallet',
  TRANSACTIONS: '/api/user/wallet/transactions',
} as const;

// ─────────────────────────────────────────────────────────────
// ⭐ USER — REVIEWS  (auth required, must have delivered order)
// ─────────────────────────────────────────────────────────────
export const REVIEW = {
  ADD:  (product_uuid: string) => `/api/user/product/${product_uuid}/review` as const,
  LIST: (product_uuid: string) => `/api/user/product/${product_uuid}/reviews` as const,
} as const;

// ─────────────────────────────────────────────────────────────
// 💬 CHAT  —  /api/chat/*  (auth required)
// ─────────────────────────────────────────────────────────────
export const CHAT = {
  ROOM:          '/api/chat/room',
  CONVERSATIONS: '/api/chat/conversations',
  HISTORY: (room_id: string) => `/api/chat/history/${encodeURIComponent(room_id)}` as const,
} as const;

// ─────────────────────────────────────────────────────────────
// 🏪 SELLER  —  /api/seller/*  (seller JWT required)
// ─────────────────────────────────────────────────────────────
export const SELLER = {
  // Products
  PRODUCTS:         '/api/seller/products',
  CREATE_PRODUCT:   '/api/seller/product',
  PRODUCT: (uuid: string) => `/api/seller/product/${uuid}` as const,

  // Categories
  MY_CATEGORIES:    '/api/seller/my-categories',
  CATEGORY_REQUEST: '/api/seller/category-request',

  // Orders
  MY_ORDERS:           '/api/seller/orders',
  UPDATE_ORDER_STATUS: (order_uuid: string) =>
    `/api/seller/order/${order_uuid}/status` as const,
  BUYER_DETAILS: (order_uuid: string) =>
    `/api/seller/order/${order_uuid}/buyer-details` as const,
  INVOICE_PDF: (order_uuid: string) =>
    `/api/seller/order/${order_uuid}/invoice/download` as const,
  APPROVE_RETURN: (order_uuid: string) =>
    `/api/seller/order/${order_uuid}/return/approve` as const,
  REJECT_RETURN: (order_uuid: string) =>
    `/api/seller/order/${order_uuid}/return/reject` as const,

  // Analytics
  ANALYTICS: '/api/seller/analytics',

  // Coupons
  COUPONS:        '/api/seller/coupons',
  COUPON: (uuid: string) => `/api/seller/coupon/${uuid}` as const,
} as const;

// ─────────────────────────────────────────────────────────────
// 🛡️  ADMIN  —  /api/admin/*  (admin JWT required)
// ─────────────────────────────────────────────────────────────
export const ADMIN = {
  DASHBOARD:           '/api/admin/dashboard',
  CATEGORIES:          '/api/admin/categories',
  CREATE_CATEGORY:     '/api/admin/category',
  UPDATE_CATEGORY:     (uuid: string) => `/api/admin/category/${uuid}` as const,
  DELETE_CATEGORY:     (uuid: string) => `/api/admin/category/${uuid}` as const,
  CATEGORY_REQUESTS:   '/api/admin/category-requests',
  APPROVE_CATEGORY:    (seller_category_uuid: string) =>
    `/api/admin/approve-category/${seller_category_uuid}` as const,
  LIST_SELLERS:        '/api/admin/sellers',
  TOGGLE_SELLER:       (seller_uuid: string) =>
    `/api/admin/seller/${seller_uuid}/toggle-status` as const,

  // ── God Mode additions ────────────────────────────────────
  SELLERS_OVERVIEW:    '/api/admin/sellers/overview',
  SELLER_DETAILS:      (uuid: string) => `/api/admin/seller/${uuid}/details` as const,
  SELLER_REVENUE_CHART:(uuid: string) => `/api/admin/seller/${uuid}/revenue-chart` as const,
  SELLER_ANALYTICS:    (uuid: string) => `/api/admin/seller/${uuid}/analytics` as const,
  PRODUCTS_DIRECTORY:  '/api/admin/products/directory',
  REVENUE_TREND:       '/api/admin/analytics/revenue-trend',
  TOP_SELLERS:         '/api/admin/analytics/top-sellers',
} as const;

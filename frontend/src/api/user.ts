import api from './axios';
import { BROWSE, CART, WISHLIST, ADDRESS, ORDER, REVIEW, WALLET, SEARCH } from './routes';
import type {
  ApiResponse,
  PaginatedResponse,
  Product,
  Category,
  CartResponse,
  Address,
  AddressForm,
  Order,
  OrderDetail,
  InvoiceResponse,
  CheckoutPayload,
  CheckoutResponse,
  WalletResponse,
  WalletHistoryResponse,
  ReturnReason,
} from '@/types';

// ── Public browsing ──────────────────────────────────────────
export const browseApi = {
  getCategories: () =>
    api.get<ApiResponse<Category[]>>(BROWSE.CATEGORIES),

  getProducts: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    category?: string;
    sort_by?: string;
  }) => api.get<PaginatedResponse<Product>>(BROWSE.PRODUCTS, { params }),

  getProduct: (uuid: string) =>
    api.get<ApiResponse<Product>>(BROWSE.PRODUCT(uuid)),

  getRecommendations: (uuid: string) =>
    api.get<{ success: boolean; source: string; data: Product[] }>(
      BROWSE.RECOMMENDATIONS(uuid),
    ),
};

// ── Fuzzy search (Meilisearch → SQL fallback) ─────────────────
export const searchApi = {
  search: (params: {
    q: string;
    limit?: number;
    page?: number;
    category_uuid?: string;
    min_price?: number;
    max_price?: number;
    in_stock?: boolean;
    sort_by?: string;
  }) => api.get<PaginatedResponse<Product>>(SEARCH.PRODUCTS, { params }),
};

// ── Cart ─────────────────────────────────────────────────────
export const cartApi = {
  getCart: () =>
    api.get<CartResponse>(CART.BASE),

  addToCart: (product_uuid: string, quantity = 1) =>
    api.post<ApiResponse>(CART.BASE, { product_uuid, quantity }),

  updateCart: (product_uuid: string, quantity: number) =>
    api.put<ApiResponse>(CART.BASE, { product_uuid, quantity }),

  validatePromo: (code: string) =>
    api.post<import('@/types').PromoValidateResponse>(CART.PROMO_VALIDATE, { code }),

  getAvailablePromos: () =>
    api.get<import('@/types').ApiResponse<import('@/types').AvailableCoupon[]>>(CART.PROMO_AVAILABLE),
};

// ── Wishlist ──────────────────────────────────────────────────
export const wishlistApi = {
  getWishlist: () =>
    api.get<ApiResponse<Product[]>>(WISHLIST.BASE),

  toggleWishlist: (product_uuid: string) =>
    api.post<ApiResponse<{ is_wishlisted: boolean }>>(WISHLIST.BASE, { product_uuid }),
};

// ── Address ───────────────────────────────────────────────────
export const addressApi = {
  getAddresses: () =>
    api.get<ApiResponse<Address[]>>(ADDRESS.LIST),

  addAddress: (data: AddressForm) =>
    api.post<ApiResponse>(ADDRESS.ADD, data),

  setDefault: (uuid: string) =>
    api.put<ApiResponse>(ADDRESS.SET_DEFAULT(uuid)),

  deleteAddress: (uuid: string) =>
    api.delete<ApiResponse>(ADDRESS.DELETE(uuid)),
};

// ── Orders & Checkout ─────────────────────────────────────────
export const orderApi = {
  checkout: (data: CheckoutPayload) =>
    api.post<CheckoutResponse>(ORDER.CHECKOUT, data),

  verifyPayment: (data: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => api.post<ApiResponse>(ORDER.VERIFY_PAYMENT, data),

  getOrders: () =>
    api.get<{ success: boolean; total: number; data: Order[] }>(ORDER.LIST),

  getOrderStatus: (uuid: string) =>
    api.get<ApiResponse<OrderDetail>>(ORDER.STATUS(uuid)),

  getInvoice: (uuid: string) =>
    api.get<InvoiceResponse>(ORDER.INVOICE(uuid)),

  /**
   * Download invoice as a PDF blob.
   * Usage:
   *   const blob = await orderApi.downloadInvoicePdf(uuid);
   *   triggerBlobDownload(blob, `Invoice-${uuid.slice(0,8)}.pdf`);
   */
  downloadInvoicePdf: (uuid: string) =>
    api.get(ORDER.INVOICE_PDF(uuid), { responseType: 'blob' }),

  requestReturn: (
    uuid: string,
    data: { reason: ReturnReason; comments?: string; images?: File[] },
  ) => {
    const fd = new FormData();
    fd.append('reason', data.reason);
    if (data.comments) fd.append('comments', data.comments);
    (data.images ?? []).forEach((img) => fd.append('images', img));
    return api.post<ApiResponse>(ORDER.RETURN(uuid), fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  getReturnStatus: (uuid: string) =>
    api.get<ApiResponse<{ window_open: boolean; days_left: number; return: import('@/types').OrderReturn | null }>>(ORDER.RETURN(uuid)),
};

// ── Wallet ────────────────────────────────────────────────────
export const walletApi = {
  getWallet: () =>
    api.get<WalletResponse>(WALLET.BALANCE),

  getTransactions: (page = 1, per_page = 20) =>
    api.get<WalletHistoryResponse>(WALLET.TRANSACTIONS, { params: { page, per_page } }),
};

// ── Reviews ───────────────────────────────────────────────────
export const reviewApi = {
  addReview: (
    product_uuid: string,
    data: { rating: number; comment?: string; images?: File[] },
  ) => {
    const fd = new FormData();
    fd.append('rating', String(data.rating));
    if (data.comment) fd.append('comment', data.comment);
    (data.images ?? []).forEach((img) => fd.append('images', img));
    return api.post<ApiResponse>(REVIEW.ADD(product_uuid), fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  getReviews: (product_uuid: string) =>
    api.get<import('@/types').ReviewsResponse>(REVIEW.LIST(product_uuid)),
};

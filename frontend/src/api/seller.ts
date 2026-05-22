import api from './axios';
import { SELLER } from './routes';
import type { ApiResponse, Product, AnalyticsPoint, AnalyticsRange, BuyerDetails, SellerCoupon, SellerCouponForm } from '@/types';

export interface SellerCategoryItem {
  uuid: string;
  name: string;
  description?: string | null;
  status: 'approved' | 'pending' | 'available';
  request_uuid?: string;
}

export const sellerApi = {
  // ── Products ──────────────────────────────────────────────
  getProducts: () =>
    api.get<ApiResponse<Product[]>>(SELLER.PRODUCTS),

  createProduct: (formData: FormData) =>
    api.post<ApiResponse>(SELLER.CREATE_PRODUCT, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  updateProduct: (uuid: string, formData: FormData) =>
    api.put<ApiResponse>(SELLER.PRODUCT(uuid), formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  deleteProduct: (uuid: string) =>
    api.delete<ApiResponse>(SELLER.PRODUCT(uuid)),

  // ── Categories ────────────────────────────────────────────
  getMyCategories: () =>
    api.get<ApiResponse<SellerCategoryItem[]>>(SELLER.MY_CATEGORIES),

  requestCategory: (category_uuid: string) =>
    api.post<ApiResponse>(SELLER.CATEGORY_REQUEST, { category_uuid }),

  // ── Orders ────────────────────────────────────────────────
  getOrders: () =>
    api.get<ApiResponse>(SELLER.MY_ORDERS),

  updateOrderStatus: (order_uuid: string, status: string) =>
    api.put<ApiResponse>(SELLER.UPDATE_ORDER_STATUS(order_uuid), { status }),

  approveReturn: (order_uuid: string, seller_note?: string) =>
    api.put<ApiResponse>(SELLER.APPROVE_RETURN(order_uuid), { seller_note }),

  rejectReturn: (order_uuid: string, seller_note?: string) =>
    api.put<ApiResponse>(SELLER.REJECT_RETURN(order_uuid), { seller_note }),

  // ── Analytics ─────────────────────────────────────────────
  getAnalytics: (range: AnalyticsRange) =>
    api.get<ApiResponse<AnalyticsPoint[]>>(SELLER.ANALYTICS, { params: { range } }),

  // ── Buyer details (privacy-scoped to this seller's orders) ──
  getBuyerDetails: (order_uuid: string) =>
    api.get<ApiResponse<BuyerDetails>>(SELLER.BUYER_DETAILS(order_uuid)),

  // ── Invoice PDF download ──────────────────────────────────
  downloadInvoicePdf: (order_uuid: string) =>
    api.get(SELLER.INVOICE_PDF(order_uuid), { responseType: 'blob' }),

  // ── Coupons ───────────────────────────────────────────────
  getCoupons: () =>
    api.get<ApiResponse<SellerCoupon[]>>(SELLER.COUPONS),

  createCoupon: (data: SellerCouponForm) =>
    api.post<ApiResponse<SellerCoupon>>(SELLER.COUPONS, data),

  updateCoupon: (uuid: string, data: Partial<SellerCouponForm> & { is_active?: boolean }) =>
    api.put<ApiResponse<SellerCoupon>>(SELLER.COUPON(uuid), data),

  deleteCoupon: (uuid: string) =>
    api.delete<ApiResponse>(SELLER.COUPON(uuid)),
};

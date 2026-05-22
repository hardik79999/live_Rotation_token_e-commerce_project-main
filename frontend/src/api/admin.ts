import api from './axios';
import { ADMIN } from './routes';
import type {
  ApiResponse, AdminDashboard, CategoryRequest, Category,
  SellerOverviewItem, SellerDetail, RevenueChartPoint, AnalyticsPoint, AnalyticsRange,
  ProductDirectoryResponse, RevenueTrendPoint, TopSellerItem,
} from '@/types';

export const adminApi = {
  getDashboard: () =>
    api.get<ApiResponse<AdminDashboard>>(ADMIN.DASHBOARD),

  // ── Categories ────────────────────────────────────────────
  listCategories: () =>
    api.get<ApiResponse<Category[]>>(ADMIN.CATEGORIES),

  createCategory: (data: { name: string; description?: string; icon?: string }) =>
    api.post<ApiResponse<Category>>(ADMIN.CREATE_CATEGORY, data),

  updateCategory: (uuid: string, data: { name?: string; description?: string; icon?: string }) =>
    api.put<ApiResponse<Category>>(ADMIN.UPDATE_CATEGORY(uuid), data),

  deleteCategory: (uuid: string) =>
    api.delete<ApiResponse>(ADMIN.DELETE_CATEGORY(uuid)),

  // ── Category requests ─────────────────────────────────────
  getCategoryRequests: () =>
    api.get<ApiResponse<CategoryRequest[]>>(ADMIN.CATEGORY_REQUESTS),

  approveCategory: (seller_category_uuid: string, action: 'approve' | 'reject' | 'revoke') =>
    api.put<ApiResponse>(ADMIN.APPROVE_CATEGORY(seller_category_uuid), { action }),

  // ── Sellers (legacy simple list) ─────────────────────────
  listSellers: () =>
    api.get<ApiResponse>(ADMIN.LIST_SELLERS),

  toggleSellerStatus: (seller_uuid: string) =>
    api.put<ApiResponse>(ADMIN.TOGGLE_SELLER(seller_uuid)),

  // ── God Mode: Seller Surveillance ────────────────────────
  getSellersOverview: () =>
    api.get<ApiResponse<SellerOverviewItem[]>>(ADMIN.SELLERS_OVERVIEW),

  getSellerDetails: (uuid: string) =>
    api.get<ApiResponse<SellerDetail>>(ADMIN.SELLER_DETAILS(uuid)),

  getSellerRevenueChart: (uuid: string) =>
    api.get<ApiResponse<RevenueChartPoint[]>>(ADMIN.SELLER_REVENUE_CHART(uuid)),

  getSellerAnalytics: (uuid: string, range: AnalyticsRange) =>
    api.get<ApiResponse<AnalyticsPoint[]>>(ADMIN.SELLER_ANALYTICS(uuid), { params: { range } }),

  // ── God Mode: Product Directory ───────────────────────────
  getProductsDirectory: (params?: {
    search?: string;
    category?: string;
    seller?: string;
    status?: 'active' | 'inactive' | 'all';
    page?: number;
    per_page?: number;
  }) =>
    api.get<ProductDirectoryResponse>(ADMIN.PRODUCTS_DIRECTORY, { params }),

  // ── God Mode: Analytics ───────────────────────────────────
  getRevenueTrend: () =>
    api.get<ApiResponse<RevenueTrendPoint[]>>(ADMIN.REVENUE_TREND),

  getTopSellers: () =>
    api.get<ApiResponse<TopSellerItem[]>>(ADMIN.TOP_SELLERS),
};

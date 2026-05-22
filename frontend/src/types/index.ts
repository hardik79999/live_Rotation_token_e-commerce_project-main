// ============================================================
// CORE TYPES — mirrors the Flask backend models exactly
// ============================================================

export type Role = 'customer' | 'seller' | 'admin';

export interface User {
  uuid: string;
  username: string;
  email: string;
  role: Role;
  phone?: string | null;
  profile_photo?: string | null;
  wallet_balance?: number;
}

export interface Category {
  uuid: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  is_active?: boolean;
  created_at?: string;
}

export interface ProductImage {
  uuid: string;
  url: string;
  is_primary: boolean;
  sort_order?: number;
}

export interface ProductVariant {
  uuid:             string;
  variant_name:     string | null;   // e.g. "128GB · Space Gray"
  sku_code:         string | null;   // e.g. "IPH17PM-128-SG"
  color_name:       string | null;
  color_code:       string | null;   // hex e.g. "#0071C5"
  size:             string | null;
  additional_price: number;
  final_price:      number;          // base + modifier — use this for display
  stock_quantity:   number;
  in_stock:         boolean;
  images:           ProductImage[];
}

export interface ProductColorSwatch {
  color_name: string | null;
  color_code: string | null;
  in_stock:   boolean;
}

export interface ProductSizeOption {
  size:     string;
  in_stock: boolean;
}

export interface Specification {
  key: string;
  value: string;
}

/**
 * A field that can be either a plain string OR a multilingual object.
 * Backend may return: "Shoes" OR { "en": "Shoes", "hi": "जूते" }
 */
export type I18nField = string | Record<string, string>;

export interface Product {
  uuid: string;
  name: I18nField;
  description: I18nField;
  price: number;
  stock: number;
  // Enterprise fields (optional — present when backend supports them)
  compare_at_price?: number | null;   // MRP / original price for discount display
  sku?: string | null;
  barcode?: string | null;
  weight_kg?: number | null;
  low_stock_threshold?: number | null;
  meta_title?: string | null;
  meta_description?: string | null;
  search_tags?: string[];
  is_draft?: boolean;
  category: string;
  category_uuid: string;
  category_icon?: string | null;
  primary_image: string | null;
  images: ProductImage[];
  variants: ProductVariant[];
  has_variants: boolean;
  default_variant_uuid: string | null;  // cheapest in-stock variant
  colors: ProductColorSwatch[];         // deduplicated palette
  sizes:  ProductSizeOption[];          // deduplicated sizes
  specifications: Specification[];
  is_active: boolean;
  seller_uuid?: string | null;
  seller_name?: string | null;
  seller_photo?: string | null;
}

// ── Cart ─────────────────────────────────────────────────────
export interface CartItem {
  cart_item_id: number;
  product_uuid: string;
  product_name: string;
  price: number;
  quantity: number;
  subtotal: number;
  image: string | null;
}

export interface CartResponse {
  success: boolean;
  total_amount: number;
  data: CartItem[];
}

// ── Address ───────────────────────────────────────────────────
export interface Address {
  uuid: string;
  full_name: string;
  address_line: string;
  phone: string;
  is_default: boolean;
}

export interface AddressForm {
  full_name: string;
  phone_number: string;
  street: string;
  city: string;
  state: string;
  pincode: string;
  is_default?: boolean;
}

// ── Orders ────────────────────────────────────────────────────
// Backend returns lowercase enum names
export type OrderStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
export type PaymentMethod = 'cod' | 'card' | 'upi' | 'netbanking';

export interface OrderItem {
  product_uuid: string;
  product_name: string;
  quantity: number;
  price_at_purchase: number;
  subtotal: number;
  image: string | null;
}

export interface Order {
  uuid: string;
  amount: number;
  status: OrderStatus;
  payment_method: PaymentMethod;
  date: string;
  delivered_at: string | null;
  items: OrderItem[];
  return: OrderReturn | null;
  return_window_open: boolean;
  return_days_left: number;
}

// ── Order Return ──────────────────────────────────────────────
export type ReturnStatus = 'pending' | 'approved' | 'rejected' | 'refunded';
export type ReturnReason =
  | 'defective' | 'wrong_item' | 'wrong_size'
  | 'not_as_described' | 'changed_mind' | 'damaged_shipping' | 'other';

export interface OrderReturn {
  uuid:           string;
  status:         ReturnStatus;
  reason:         ReturnReason;
  refund_method:  string | null;
  refund_amount:  number | null;
  created_at:     string | null;
}

export interface TrackingEntry {
  status: string;   // backend returns capitalized e.g. "Processing"
  message: string | null;
  date: string;
}

export interface OrderDetail {
  order_uuid: string;
  current_status: string;   // capitalized e.g. "Processing"
  amount: number;
  payment_method: string;
  tracking_history: TrackingEntry[];
}

// ── Invoice ───────────────────────────────────────────────────
// Backend returns { success, message, invoice: { ... } }
export interface InvoiceCustomer {
  name: string;
  email: string;
  phone: string;
  shipping_address: string;
}

export interface InvoicePayment {
  method: string;
  transaction_id: string;
  payment_status: string;
}

export interface InvoiceSummary {
  base_amount: number;
  tax_gst_18: number;
  shipping_fee: number;
  grand_total: number;
}

export interface InvoiceCompany {
  name: string;
  support_email: string;
  gstin: string;
}

export interface Invoice {
  invoice_id: string;
  date: string;
  status: string;
  customer_details: InvoiceCustomer;
  payment_details: InvoicePayment;
  order_summary: InvoiceSummary;
  company_info: InvoiceCompany;
}

export interface InvoiceResponse {
  success: boolean;
  message: string;
  invoice: Invoice;
}

// ── Seller orders ─────────────────────────────────────────────
export interface SellerOrderItem {
  product_uuid: string | null;
  product_name: string;
  quantity: number;
  price_at_purchase: number;
  subtotal: number;
  image: string | null;
}

export interface SellerOrderCustomer {
  name: string;
  email: string;
  phone: string;
}

export interface SellerOrderReturn {
  uuid:              string;
  status:            ReturnStatus;
  reason:            ReturnReason;
  customer_comments: string | null;
  image_urls:        string[];
  refund_method:     string | null;
  refund_amount:     number | null;
  created_at:        string | null;
}

export interface SellerOrder {
  order_uuid: string;
  order_date: string;
  status: OrderStatus;
  payment_method: PaymentMethod;
  seller_total: number;
  customer: SellerOrderCustomer;
  shipping_address: string;
  items: SellerOrderItem[];
  return: SellerOrderReturn | null;
}

// ── Review ────────────────────────────────────────────────────
export interface Review {
  rating: number;
  comment?: string;
}

export interface ReviewItem {
  uuid: string;
  rating: number;
  comment: string;
  images: string[];          // up to 6 URLs
  image_url: string | null;  // legacy fallback
  created_at: string | null;
  reviewer: {
    username: string;
    profile_photo: string | null;
  };
}

export interface ReviewsResponse {
  success: boolean;
  data: ReviewItem[];
  total: number;
  avg_rating: number;
}

// ── Admin ─────────────────────────────────────────────────────
export interface AdminDashboard {
  total_users: number;
  total_products: number;
  total_orders: number;
  total_revenue: number;
  order_status_breakdown?: Record<string, number>;
  recent_orders?: {
    uuid: string;
    amount: number;
    status: string;
    payment_method: string;
    date: string;
    items_preview?: {
      product_uuid: string;
      product_name: string;
      quantity: number;
      image: string | null;
    }[];
  }[];
  top_products?: {
    name: string;
    uuid: string;
    total_sold: number;
    total_revenue: number;
  }[];
}

// ── God Mode: Seller Surveillance ────────────────────────────
export interface SellerOverviewItem {
  uuid: string;
  username: string;
  email: string;
  phone: string | null;
  is_active: boolean;
  joined_at: string | null;
  total_products: number;
  total_orders: number;
  total_revenue: number;
  approved_categories: number;
}

export interface SellerDetailMetrics {
  total_products_active: number;
  total_orders: number;
  total_revenue: number;
  avg_order_value: number;
  approved_categories: number;
}

export interface SellerDetailTopProduct {
  uuid: string;
  name: string;
  price: number;
  units_sold: number;
  product_revenue: number;
  primary_image: string | null;
}

export interface SellerDetailRecentOrder {
  order_uuid: string;
  date: string;
  status: string;
  seller_total: number;
  item_count: number;
  payment_method: string;
}

export interface SellerDetail {
  profile: {
    uuid: string;
    username: string;
    email: string;
    phone: string | null;
    is_active: boolean;
    joined_at: string | null;
    profile_photo: string | null;
  };
  metrics: SellerDetailMetrics;
  monthly_revenue: { month: string; revenue: number }[];
  top_products: SellerDetailTopProduct[];
  recent_orders: SellerDetailRecentOrder[];
  approved_categories: string[];
}

// ── God Mode: Global Product Directory ───────────────────────
export interface AdminProduct {
  uuid: string;
  name: string;
  price: number;
  stock: number;
  is_active: boolean;
  category: string;
  category_uuid: string;
  seller_name: string;
  seller_uuid: string;
  seller_active: boolean;
  primary_image: string | null;
  created_at: string | null;
}

export interface ProductDirectoryResponse {
  success: boolean;
  message: string;
  data: AdminProduct[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

// ── God Mode: Analytics ───────────────────────────────────────
export interface RevenueTrendPoint {
  month: string;
  revenue: number;
  order_count: number;
}

// Per-seller revenue chart point (6-month, zero-filled, from dedicated endpoint)
export interface RevenueChartPoint {
  month: string;       // "Jan", "Feb", …
  full_month: string;  // "Jan 2025"
  revenue: number;
  orders: number;
}

// Flexible analytics point (7d / 30d / 6m / ytd)
export type AnalyticsRange = '7d' | '30d' | '6m' | 'ytd';
export type AnalyticsMetric = 'revenue' | 'orders';

export interface AnalyticsPoint {
  label: string;       // "5 Jan" or "Jan"
  full_label: string;  // "5 Jan 2025" or "Jan 2025"
  revenue: number;
  orders: number;
  date_key: string;    // "2025-01-05" or "2025-01"
}

export interface TopSellerItem {
  uuid: string;
  username: string;
  email: string;
  is_active: boolean;
  total_revenue: number;
  total_orders: number;
  total_products: number;
}

export interface CategoryRequest {
  request_uuid: string;
  seller_uuid: string;
  seller_name: string;
  seller_email: string;
  category_uuid: string;
  category_name: string;
  is_approved: boolean;
  requested_at: string;
}

// ── Seller: Buyer details (privacy-scoped) ───────────────────
export interface BuyerOrderHistoryItem {
  order_uuid: string;
  date: string | null;
  status: string;
  seller_total: number;
  item_count: number;
}

export interface BuyerDetails {
  name: string;
  email: string;
  phone: string;
  profile_photo: string | null;
  shipping_address: string;
  shipping_phone: string;
  total_orders_with_seller: number;
  total_spent_with_seller: number;
  value_label: string;   // "🆕 New Customer" | "🔄 Repeat Buyer" | "⭐ Loyal Buyer" | "⭐ VIP Customer"
  value_color: string;   // "gray" | "blue" | "green" | "gold"
  order_history: BuyerOrderHistoryItem[];
}
// ── Live Chat ─────────────────────────────────────────────────
export interface ChatMessage {
  uuid: string;
  room_id: string;
  sender_uuid: string | null;
  sender_name: string;
  sender_photo: string | null;
  receiver_uuid: string | null;
  text: string;
  is_read: boolean;
  created_at: string | null;
  product_uuid: string | null;
  product_name: string | null;
}

export interface ChatConversation {
  room_id: string;
  other_user: {
    uuid: string | null;
    username: string;
    profile_photo: string | null;
    role: string | null;
  };
  product: { uuid: string | null; name: string | null } | null;
  last_message: string;
  last_message_time: string | null;
  unread_count: number;
}

export interface ApiResponse<T = unknown> {  success: boolean;
  message: string;
  data?: T;
  [key: string]: unknown;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total_results: number;
  total_pages: number;
  current_page: number;
}

// ── Seller Coupon ─────────────────────────────────────────────
export interface SellerCoupon {
  uuid:                string;
  code:                string;
  discount_type:       'percentage' | 'flat';
  discount_value:      number;
  label:               string;
  min_cart_value:      number;
  max_discount_amount: number | null;
  expiry_date:         string;   // "YYYY-MM-DD" for form
  expiry_display:      string;   // "31 Dec 2025" for display
  max_uses:            number | null;
  current_uses:        number;
  is_active:           boolean;
  days_left:           number;
  is_expired:          boolean;
  created_at:          string | null;
}

export interface SellerCouponForm {
  code:                string;
  discount_type:       'percentage' | 'flat';
  discount_value:      number | '';
  min_cart_value:      number | '';
  max_discount_amount: number | '';
  expiry_date:         string;
  max_uses:            number | '';
}

// ── Promo Code ────────────────────────────────────────────────
export interface AvailableCoupon {
  code:            string;
  discount_type:   'percentage' | 'flat';
  discount_value:  number;
  label:           string;   // e.g. "10% OFF" or "₹200 OFF"
  min_cart_value:  number;
  expiry_date:     string;   // "31 Dec 2025"
  days_left:       number;
}

export interface PromoValidateResponse {
  success:         boolean;
  message:         string;
  code:            string;
  discount_type:   'percentage' | 'flat';
  discount_value:  number;
  discount_amount: number;
  original_total:  number;
  final_total:     number;
}

// ── Checkout ──────────────────────────────────────────────────
export interface CheckoutPayload {
  payment_method: PaymentMethod;
  address_uuid:   string;
  coupon_code?:   string;
  use_wallet?:    boolean;   // 💰 apply wallet balance as discount
}

// COD: { success: true, order_uuid: "..." }
// Online: { success: true, data: { razorpay_order_id: "...", amount: 999 } }
export interface CheckoutResponse {
  success: boolean;
  message?: string;
  order_uuid?: string;
  wallet_used?: number;
  wallet_balance?: number;
  data?: {
    razorpay_order_id: string;
    amount: number;
    order_uuid?: string;
  };
}

// ── Wallet ────────────────────────────────────────────────────
export type WalletTransactionType = 'CREDIT' | 'DEBIT';

export interface WalletTransaction {
  uuid:             string;
  amount:           number;
  transaction_type: WalletTransactionType;
  description:      string;
  created_at:       string | null;
}

export interface WalletResponse {
  success:         boolean;
  wallet_balance:  number;
  transactions:    WalletTransaction[];
}

export interface WalletHistoryResponse {
  success:         boolean;
  wallet_balance:  number;
  data:            WalletTransaction[];
  total:           number;
  page:            number;
  total_pages:     number;
}

// ── Razorpay ──────────────────────────────────────────────────
declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

export interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description?: string;
  order_id: string;
  handler: (response: RazorpayPaymentResponse) => void;
  prefill?: { name?: string; email?: string; contact?: string };
  theme?: { color?: string };
  modal?: { ondismiss?: () => void };
}

export interface RazorpayPaymentResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export interface RazorpayInstance {
  open(): void;
}

// ── Admin: Return Management ──────────────────────────────────
export interface AdminReturnOrderItem {
  product_name:      string;
  quantity:          number;
  price_at_purchase: number;
  image:             string | null;
}

export interface AdminReturnOrder {
  uuid:           string;
  total_amount:   number;
  payment_method: string | null;
  delivered_at:   string | null;
  items:          AdminReturnOrderItem[];
}

export interface AdminReturnCustomer {
  uuid:     string;
  username: string;
  email:    string;
}

export interface AdminReturnItem {
  uuid:               string;
  status:             ReturnStatus;
  reason:             ReturnReason;
  customer_comments:  string | null;
  admin_notes:        string | null;
  refund_method:      string | null;
  refund_amount:      number | null;
  razorpay_refund_id: string | null;
  created_at:         string | null;
  updated_at:         string | null;
  order:              AdminReturnOrder | null;
  customer:           AdminReturnCustomer | null;
}

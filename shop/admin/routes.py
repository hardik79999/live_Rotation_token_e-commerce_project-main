from shop.admin import admin_bp
from shop.admin.api.create_category import create_category_action
from shop.admin.api.approve_category import approve_category_action
from shop.admin.api.category_requests import list_category_requests_action
from shop.admin.api.manage_seller import toggle_seller_status_action, list_sellers_action
from shop.admin.api.manage_category import list_categories_action, update_category_action, delete_category_action
from shop.admin.api.dashboard import admin_dashboard_action
from shop.admin.api.seller_surveillance import (
    seller_overview_action,
    seller_detail_action,
    seller_revenue_chart_action,
    seller_analytics_action,
    global_products_action,
    revenue_trend_action,
    top_sellers_action,
)

@admin_bp.route('/category', methods=['POST'])
def create_category_route():
    """
    Create New Category
    ---
    tags:
      - 🛡️ Admin Panel
    security:
      - CSRF-Token: []
    parameters:
      - name: body
        in: body
        required: true
        schema:
          properties:
            name: {type: string}
            description: {type: string}
    responses:
      201:
        description: Category Created
    """
    return create_category_action()

@admin_bp.route('/categories', methods=['GET'])
def list_categories_route():
    """
    List All Categories (Admin)
    ---
    tags:
      - 🛡️ Admin Panel
    security:
      - CSRF-Token: []
    responses:
      200:
        description: All categories with active/inactive status
    """
    return list_categories_action()

@admin_bp.route('/category/<category_uuid>', methods=['PUT'])
def update_category_route(category_uuid):
    """
    Edit Category Name / Description
    ---
    tags:
      - 🛡️ Admin Panel
    security:
      - CSRF-Token: []
    parameters:
      - name: category_uuid
        in: path
        type: string
        required: true
      - name: body
        in: body
        required: true
        schema:
          properties:
            name: {type: string}
            description: {type: string}
    responses:
      200:
        description: Category updated
    """
    return update_category_action(category_uuid)

@admin_bp.route('/category/<category_uuid>', methods=['DELETE'])
def delete_category_route(category_uuid):
    """
    Delete Category (Soft Delete)
    ---
    tags:
      - 🛡️ Admin Panel
    security:
      - CSRF-Token: []
    parameters:
      - name: category_uuid
        in: path
        type: string
        required: true
    responses:
      200:
        description: Category deleted — all products hidden
    """
    return delete_category_action(category_uuid)

@admin_bp.route('/approve-category/<seller_category_uuid>', methods=['PUT'])
def approve_seller_category_route(seller_category_uuid):
    """
    Approve/Reject Seller Category Request
    ---
    tags:
      - 🛡️ Admin Panel
    security:
      - CSRF-Token: []
    parameters:
      - name: seller_category_uuid
        in: path
        type: string
        required: true
      - name: body
        in: body
        required: true
        schema:
          properties:
            action: {type: string, enum: ['approve', 'reject']}
    responses:
      200:
        description: Request processed
    """
    return approve_category_action(seller_category_uuid)

@admin_bp.route('/category-requests', methods=['GET'])
def list_category_requests_route():
    """
    Get Pending Seller Category Requests
    ---
    tags:
      - ðŸ›¡ï¸ Admin Panel
    security:
      - CSRF-Token: []
    responses:
      200:
        description: Pending requests fetched
    """
    return list_category_requests_action()

@admin_bp.route('/sellers', methods=['GET'])
def list_sellers_route():
    """
    List All Sellers
    ---
    tags:
      - 🛡️ Admin Panel
    security:
      - CSRF-Token: []
    responses:
      200:
        description: List of all seller accounts
    """
    return list_sellers_action()


@admin_bp.route('/seller/<seller_uuid>/toggle-status', methods=['PUT'])
def toggle_seller_route(seller_uuid):
    """
    Block/Unblock Seller (Toggle Status)
    ---
    tags:
      - 🛡️ Admin Panel
    security:
      - CSRF-Token: []
    parameters:
      - name: seller_uuid
        in: path
        type: string
        required: true
    responses:
      200:
        description: Seller status updated
    """
    return toggle_seller_status_action(seller_uuid)





@admin_bp.route('/dashboard', methods=['GET'])
def admin_dashboard_route():
    """
    Admin Analytics Dashboard 📊
    ---
    tags:
      - 🛡️ Admin Panel
    security:
      - CSRF-Token: []
    responses:
      200:
        description: Dashboard stats
    """
    return admin_dashboard_action()


# ─────────────────────────────────────────────────────────────────────────────
# 🔭  SELLER SURVEILLANCE
# ─────────────────────────────────────────────────────────────────────────────

@admin_bp.route('/sellers/overview', methods=['GET'])
def seller_overview_route():
    """
    Enriched Seller List (revenue, products, orders)
    ---
    tags:
      - 🛡️ Admin Panel
    security:
      - CSRF-Token: []
    responses:
      200:
        description: All sellers with performance metrics
    """
    return seller_overview_action()


@admin_bp.route('/seller/<seller_uuid>/details', methods=['GET'])
def seller_detail_route(seller_uuid):
    """
    Seller Deep-Dive Details
    ---
    tags:
      - 🛡️ Admin Panel
    security:
      - CSRF-Token: []
    parameters:
      - name: seller_uuid
        in: path
        type: string
        required: true
    responses:
      200:
        description: Full seller profile, metrics, top products, recent orders
    """
    return seller_detail_action(seller_uuid)


@admin_bp.route('/seller/<seller_uuid>/revenue-chart', methods=['GET'])
def seller_revenue_chart_route(seller_uuid):
    """
    Seller Revenue Chart — last 6 months, zero-filled
    ---
    tags:
      - 🛡️ Admin Panel
    security:
      - CSRF-Token: []
    parameters:
      - name: seller_uuid
        in: path
        type: string
        required: true
    responses:
      200:
        description: Array of { month, full_month, revenue, orders } — 6 items, oldest first
    """
    return seller_revenue_chart_action(seller_uuid)


@admin_bp.route('/seller/<seller_uuid>/analytics', methods=['GET'])
def seller_analytics_route(seller_uuid):
    """
    Seller Analytics — flexible time range for expanded chart modal
    ---
    tags:
      - 🛡️ Admin Panel
    security:
      - CSRF-Token: []
    parameters:
      - name: seller_uuid
        in: path
        type: string
        required: true
      - name: range
        in: query
        type: string
        enum: [7d, 30d, 6m, ytd]
    responses:
      200:
        description: Array of { label, full_label, revenue, orders, date_key }
    """
    return seller_analytics_action(seller_uuid)


@admin_bp.route('/products/directory', methods=['GET'])
def global_products_route():
    """
    Global Read-Only Product Directory
    ---
    tags:
      - 🛡️ Admin Panel
    security:
      - CSRF-Token: []
    parameters:
      - name: search
        in: query
        type: string
      - name: category
        in: query
        type: string
      - name: seller
        in: query
        type: string
      - name: status
        in: query
        type: string
        enum: [active, inactive, all]
      - name: page
        in: query
        type: integer
      - name: per_page
        in: query
        type: integer
    responses:
      200:
        description: Paginated product list (read-only, no edit/delete)
    """
    return global_products_action()


@admin_bp.route('/analytics/revenue-trend', methods=['GET'])
def revenue_trend_route():
    """
    Monthly Revenue Trend (last 12 months)
    ---
    tags:
      - 🛡️ Admin Panel
    security:
      - CSRF-Token: []
    responses:
      200:
        description: Array of { month, revenue, order_count }
    """
    return revenue_trend_action()


@admin_bp.route('/analytics/top-sellers', methods=['GET'])
def top_sellers_route():
    """
    Top 5 Sellers by Revenue
    ---
    tags:
      - 🛡️ Admin Panel
    security:
      - CSRF-Token: []
    responses:
      200:
        description: Top 5 sellers ranked by total revenue
    """
    return top_sellers_action()

# ==========================================
# 🔄 RETURN PROCESSING (Admin)
# ==========================================
from shop.user.api.return_order import process_return_action
from shop.admin.api.list_returns import list_returns_action

@admin_bp.route('/returns', methods=['GET'])
def list_returns_route():
    """
    List All Return Requests (paginated, filterable by status)
    ---
    tags:
      - 🛡️ Admin Panel
    security:
      - CSRF-Token: []
    parameters:
      - name: status
        in: query
        type: string
        enum: [all, pending, approved, rejected, refunded]
      - name: page
        in: query
        type: integer
      - name: per_page
        in: query
        type: integer
    responses:
      200:
        description: Paginated return requests
    """
    return list_returns_action()

@admin_bp.route('/return/<return_uuid>/action', methods=['POST'])
def process_return_route(return_uuid):
    """
    Approve or Reject a Return Request
    ---
    tags:
      - 🛡️ Admin Panel
    security:
      - CSRF-Token: []
    parameters:
      - name: return_uuid
        in: path
        type: string
        required: true
      - name: body
        in: body
        required: true
        schema:
          properties:
            action: {type: string, enum: ['approve', 'reject']}
            admin_notes: {type: string}
    responses:
      200:
        description: Return processed, refund issued
    """
    return process_return_action(return_uuid)

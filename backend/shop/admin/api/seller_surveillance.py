"""
Admin Seller Surveillance API
──────────────────────────────
GET  /api/admin/sellers/overview              — enriched seller list with revenue, product count, order count
GET  /api/admin/seller/<uuid>/details         — deep-dive: seller metrics + recent orders + top products
GET  /api/admin/seller/<uuid>/revenue-chart   — zero-filled 6-month revenue for Recharts AreaChart
GET  /api/admin/products/directory            — read-only global product directory (all sellers)
GET  /api/admin/analytics/revenue-trend       — monthly revenue for the last 12 months (chart data)
GET  /api/admin/analytics/top-sellers         — top 5 sellers by revenue
"""

from flask import jsonify, request, current_app
from flask_jwt_extended import verify_jwt_in_request, get_jwt
from sqlalchemy import func, extract, case
from datetime import datetime, timedelta
from calendar import month_abbr

from shop.extensions import db
from shop.models import (
    User, Role, Product, ProductImage, Category,
    Order, OrderItem, Payment, SellerCategory,
    OrderStatus, PaymentStatus,
)
from shop.utils.api_response import error_response, success_response


# ── Auth guard ────────────────────────────────────────────────────────────────
def _require_admin():
    """Returns (None, error_response) or (admin_user, None)."""
    try:
        verify_jwt_in_request()
    except Exception as e:
        e_name = e.__class__.__name__
        e_str = str(e).lower()
        if 'jwt' in e_name.lower() or 'token' in e_name.lower() or 'auth' in e_name.lower() or 'signature' in e_name.lower() or 'cookie' in e_str or 'token' in e_str:
            return jsonify({'error': str(e)}), 401
        return None, error_response(str(e), 401)
    claims = get_jwt()
    if claims.get("role") != "admin":
        return None, error_response("Admin access required", 403)
    admin = User.query.filter_by(uuid=claims.get("user_uuid")).first()
    if not admin:
        return None, error_response("Admin user not found", 404)
    return admin, None


# ── Helper: primary image URL for a product ───────────────────────────────────
def _primary_image(product_id: int) -> str | None:
    img = (
        ProductImage.query
        .filter_by(product_id=product_id, is_primary=True, is_active=True)
        .first()
    )
    if not img:
        img = (
            ProductImage.query
            .filter_by(product_id=product_id, is_active=True)
            .first()
        )
    return img.image_url if img else None


# ─────────────────────────────────────────────────────────────────────────────
# 1.  SELLER OVERVIEW  —  GET /api/admin/sellers/overview
# ─────────────────────────────────────────────────────────────────────────────
def seller_overview_action():
    """
    Returns every seller enriched with:
      - total_products  (active listings)
      - total_orders    (orders containing their products, excl. cancelled)
      - total_revenue   (sum of price_at_purchase × qty for non-cancelled orders)
      - approved_categories count
    Single optimised query using SQLAlchemy subqueries — no N+1.
    """
    _, err = _require_admin()
    if err:
        return err

    try:
        seller_role = Role.query.filter_by(role_name="seller").first()
        if not seller_role:
            return success_response(message="No sellers found", data=[], status_code=200)

        # ── Subquery: product count per seller ────────────────────────────
        product_sq = (
            db.session.query(
                Product.seller_id.label("seller_id"),
                func.count(Product.id).label("product_count"),
            )
            .filter(Product.is_active == True)
            .group_by(Product.seller_id)
            .subquery()
        )

        # ── Subquery: revenue + order count per seller ────────────────────
        revenue_sq = (
            db.session.query(
                Product.seller_id.label("seller_id"),
                func.count(func.distinct(Order.id)).label("order_count"),
                func.coalesce(
                    func.sum(OrderItem.price_at_purchase * OrderItem.quantity), 0
                ).label("revenue"),
            )
            .join(OrderItem, OrderItem.product_id == Product.id)
            .join(Order, Order.id == OrderItem.order_id)
            .filter(Order.status != OrderStatus.cancelled)
            .group_by(Product.seller_id)
            .subquery()
        )

        # ── Subquery: approved category count per seller ──────────────────
        cat_sq = (
            db.session.query(
                SellerCategory.seller_id.label("seller_id"),
                func.count(SellerCategory.id).label("cat_count"),
            )
            .filter(
                SellerCategory.is_approved == True,
                SellerCategory.is_active == True,
            )
            .group_by(SellerCategory.seller_id)
            .subquery()
        )

        # ── Main query ────────────────────────────────────────────────────
        rows = (
            db.session.query(
                User,
                func.coalesce(product_sq.c.product_count, 0).label("product_count"),
                func.coalesce(revenue_sq.c.order_count, 0).label("order_count"),
                func.coalesce(revenue_sq.c.revenue, 0).label("revenue"),
                func.coalesce(cat_sq.c.cat_count, 0).label("cat_count"),
            )
            .filter(User.role_id == seller_role.id)
            .outerjoin(product_sq, product_sq.c.seller_id == User.id)
            .outerjoin(revenue_sq, revenue_sq.c.seller_id == User.id)
            .outerjoin(cat_sq, cat_sq.c.seller_id == User.id)
            .order_by(func.coalesce(revenue_sq.c.revenue, 0).desc())
            .all()
        )

        result = [
            {
                "uuid":                 u.uuid,
                "username":             u.username,
                "email":                u.email,
                "phone":                u.phone,
                "is_active":            u.is_active,
                "joined_at":            u.created_at.isoformat() if u.created_at else None,
                "total_products":       int(product_count),
                "total_orders":         int(order_count),
                "total_revenue":        round(float(revenue), 2),
                "approved_categories":  int(cat_count),
            }
            for u, product_count, order_count, revenue, cat_count in rows
        ]

        return success_response(
            message="Seller overview fetched",
            data=result,
            status_code=200,
            total=len(result),
        )

    except Exception as e:
        e_name = e.__class__.__name__
        e_str = str(e).lower()
        if 'jwt' in e_name.lower() or 'token' in e_name.lower() or 'auth' in e_name.lower() or 'signature' in e_name.lower() or 'cookie' in e_str or 'token' in e_str:
            return jsonify({'error': str(e)}), 401
        current_app.logger.error(f"seller_overview error: {e}")
        return error_response(str(e), 500)


# ─────────────────────────────────────────────────────────────────────────────
# 2.  SELLER DETAIL  —  GET /api/admin/seller/<uuid>/details
# ─────────────────────────────────────────────────────────────────────────────
def seller_detail_action(seller_uuid: str):
    """
    Deep-dive view for a single seller:
      - Profile info + status
      - Aggregate metrics (revenue, orders, products, avg order value)
      - Monthly revenue for last 6 months (mini sparkline data)
      - Top 5 products by revenue
      - Last 10 orders containing their products
      - Approved categories
    """
    _, err = _require_admin()
    if err:
        return err

    try:
        seller = User.query.filter_by(uuid=seller_uuid).first()
        if not seller or seller.role.role_name != "seller":
            return error_response("Seller not found", 404)

        # ── Aggregate metrics ─────────────────────────────────────────────
        metrics = (
            db.session.query(
                func.count(func.distinct(Order.id)).label("total_orders"),
                func.coalesce(
                    func.sum(OrderItem.price_at_purchase * OrderItem.quantity), 0
                ).label("total_revenue"),
                func.count(func.distinct(Product.id)).label("total_products"),
            )
            .select_from(Product)
            .join(OrderItem, OrderItem.product_id == Product.id)
            .join(Order, Order.id == OrderItem.order_id)
            .filter(
                Product.seller_id == seller.id,
                Order.status != OrderStatus.cancelled,
            )
            .first()
        )

        total_products_active = Product.query.filter_by(
            seller_id=seller.id, is_active=True
        ).count()

        avg_order_value = (
            round(float(metrics.total_revenue) / int(metrics.total_orders), 2)
            if metrics and metrics.total_orders
            else 0.0
        )

        # ── Monthly revenue — last 6 months ───────────────────────────────
        six_months_ago = datetime.utcnow() - timedelta(days=180)
        monthly = (
            db.session.query(
                extract("year",  Order.created_at).label("yr"),
                extract("month", Order.created_at).label("mo"),
                func.coalesce(
                    func.sum(OrderItem.price_at_purchase * OrderItem.quantity), 0
                ).label("revenue"),
            )
            .select_from(Product)
            .join(OrderItem, OrderItem.product_id == Product.id)
            .join(Order, Order.id == OrderItem.order_id)
            .filter(
                Product.seller_id == seller.id,
                Order.status != OrderStatus.cancelled,
                Order.created_at >= six_months_ago,
            )
            .group_by("yr", "mo")
            .order_by("yr", "mo")
            .all()
        )
        monthly_revenue = [
            {
                "month": f"{int(row.yr)}-{int(row.mo):02d}",
                "revenue": round(float(row.revenue), 2),
            }
            for row in monthly
        ]

        # ── Top 5 products by revenue ─────────────────────────────────────
        top_products = (
            db.session.query(
                Product.uuid,
                Product.name,
                Product.price,
                func.sum(OrderItem.quantity).label("units_sold"),
                func.sum(
                    OrderItem.price_at_purchase * OrderItem.quantity
                ).label("product_revenue"),
            )
            .join(OrderItem, OrderItem.product_id == Product.id)
            .join(Order, Order.id == OrderItem.order_id)
            .filter(
                Product.seller_id == seller.id,
                Order.status != OrderStatus.cancelled,
            )
            .group_by(Product.id, Product.uuid, Product.name, Product.price)
            .order_by(func.sum(
                OrderItem.price_at_purchase * OrderItem.quantity
            ).desc())
            .limit(5)
            .all()
        )
        top_products_data = [
            {
                "uuid":            p.uuid,
                "name":            p.name,
                "price":           float(p.price),
                "units_sold":      int(p.units_sold or 0),
                "product_revenue": round(float(p.product_revenue or 0), 2),
                "primary_image":   _primary_image(
                    Product.query.filter_by(uuid=p.uuid).first().id
                ),
            }
            for p in top_products
        ]

        # ── Last 10 orders ────────────────────────────────────────────────
        recent_order_ids = (
            db.session.query(func.distinct(Order.id))
            .join(OrderItem, OrderItem.order_id == Order.id)
            .join(Product, Product.id == OrderItem.product_id)
            .filter(Product.seller_id == seller.id)
            .order_by(Order.created_at.desc())
            .limit(10)
            .subquery()
        )
        recent_orders_objs = (
            Order.query
            .filter(Order.id.in_(db.session.query(recent_order_ids)))
            .order_by(Order.created_at.desc())
            .all()
        )
        recent_orders_data = []
        for o in recent_orders_objs:
            seller_items = [
                item for item in o.items
                if item.product and item.product.seller_id == seller.id
            ]
            seller_subtotal = sum(
                i.price_at_purchase * i.quantity for i in seller_items
            )
            recent_orders_data.append({
                "order_uuid":    o.uuid,
                "date":          o.created_at.isoformat() if o.created_at else None,
                "status":        o.status.value,
                "seller_total":  round(seller_subtotal, 2),
                "item_count":    sum(i.quantity for i in seller_items),
                "payment_method": (
                    o.payment_method.value
                    if o.payment_method and hasattr(o.payment_method, "value")
                    else str(o.payment_method)
                ),
            })

        # ── Approved categories ───────────────────────────────────────────
        approved_cats = (
            db.session.query(Category.name)
            .join(SellerCategory, SellerCategory.category_id == Category.id)
            .filter(
                SellerCategory.seller_id == seller.id,
                SellerCategory.is_approved == True,
                SellerCategory.is_active == True,
            )
            .all()
        )

        return success_response(
            message="Seller details fetched",
            data={
                "profile": {
                    "uuid":       seller.uuid,
                    "username":   seller.username,
                    "email":      seller.email,
                    "phone":      seller.phone,
                    "is_active":  seller.is_active,
                    "joined_at":  seller.created_at.isoformat() if seller.created_at else None,
                    "profile_photo": seller.profile_photo,
                },
                "metrics": {
                    "total_products_active": total_products_active,
                    "total_orders":          int(metrics.total_orders or 0),
                    "total_revenue":         round(float(metrics.total_revenue or 0), 2),
                    "avg_order_value":       avg_order_value,
                    "approved_categories":   len(approved_cats),
                },
                "monthly_revenue":   monthly_revenue,
                "top_products":      top_products_data,
                "recent_orders":     recent_orders_data,
                "approved_categories": [c.name for c in approved_cats],
            },
            status_code=200,
        )

    except Exception as e:
        e_name = e.__class__.__name__
        e_str = str(e).lower()
        if 'jwt' in e_name.lower() or 'token' in e_name.lower() or 'auth' in e_name.lower() or 'signature' in e_name.lower() or 'cookie' in e_str or 'token' in e_str:
            return jsonify({'error': str(e)}), 401
        current_app.logger.error(f"seller_detail error: {e}")
        return error_response(str(e), 500)


# ─────────────────────────────────────────────────────────────────────────────
# 3.  GLOBAL PRODUCT DIRECTORY  —  GET /api/admin/products/directory
# ─────────────────────────────────────────────────────────────────────────────
def global_products_action():
    """
    Read-only view of every product on the platform.
    Supports:
      - ?search=<term>      — name / seller / category filter
      - ?category=<uuid>    — filter by category
      - ?seller=<uuid>      — filter by seller
      - ?status=active|inactive|all  (default: all)
      - ?page=1&per_page=20
    Returns: product name, image, price, stock, category, seller name.
    NO edit/delete data is returned — strictly read-only.
    """
    _, err = _require_admin()
    if err:
        return err

    try:
        search    = (request.args.get("search")   or "").strip()
        cat_uuid  = (request.args.get("category") or "").strip()
        sel_uuid  = (request.args.get("seller")   or "").strip()
        status    = (request.args.get("status")   or "all").strip().lower()
        page      = max(1, int(request.args.get("page",     1)))
        per_page  = min(100, max(1, int(request.args.get("per_page", 20))))

        query = (
            db.session.query(Product, User, Category)
            .join(User,     User.id     == Product.seller_id)
            .join(Category, Category.id == Product.category_id)
        )

        # Status filter
        if status == "active":
            query = query.filter(Product.is_active == True)
        elif status == "inactive":
            query = query.filter(Product.is_active == False)
        # "all" → no filter

        # Search
        if search:
            like = f"%{search}%"
            query = query.filter(
                db.or_(
                    Product.name.ilike(like),
                    User.username.ilike(like),
                    Category.name.ilike(like),
                )
            )

        # Category filter
        if cat_uuid:
            cat = Category.query.filter_by(uuid=cat_uuid).first()
            if cat:
                query = query.filter(Product.category_id == cat.id)

        # Seller filter
        if sel_uuid:
            sel = User.query.filter_by(uuid=sel_uuid).first()
            if sel:
                query = query.filter(Product.seller_id == sel.id)

        total = query.count()
        rows  = (
            query
            .order_by(Product.created_at.desc())
            .offset((page - 1) * per_page)
            .limit(per_page)
            .all()
        )

        result = [
            {
                "uuid":          p.uuid,
                "name":          p.name,
                "price":         float(p.price),
                "stock":         p.stock,
                "is_active":     p.is_active,
                "category":      c.name,
                "category_uuid": c.uuid,
                "seller_name":   u.username,
                "seller_uuid":   u.uuid,
                "seller_active": u.is_active,
                "primary_image": _primary_image(p.id),
                "created_at":    p.created_at.isoformat() if p.created_at else None,
            }
            for p, u, c in rows
        ]

        return jsonify({
            "success":      True,
            "message":      "Product directory fetched",
            "data":         result,
            "total":        total,
            "page":         page,
            "per_page":     per_page,
            "total_pages":  (total + per_page - 1) // per_page,
        }), 200

    except Exception as e:
        e_name = e.__class__.__name__
        e_str = str(e).lower()
        if 'jwt' in e_name.lower() or 'token' in e_name.lower() or 'auth' in e_name.lower() or 'signature' in e_name.lower() or 'cookie' in e_str or 'token' in e_str:
            return jsonify({'error': str(e)}), 401
        current_app.logger.error(f"global_products error: {e}")
        return error_response(str(e), 500)


# ─────────────────────────────────────────────────────────────────────────────
# 4.  REVENUE TREND  —  GET /api/admin/analytics/revenue-trend
# ─────────────────────────────────────────────────────────────────────────────
def revenue_trend_action():
    """
    Monthly platform revenue for the last 12 months.
    Returns array of { month: "YYYY-MM", revenue: float, order_count: int }
    sorted oldest → newest (ready for Recharts LineChart).
    """
    _, err = _require_admin()
    if err:
        return err

    try:
        twelve_months_ago = datetime.utcnow() - timedelta(days=365)

        rows = (
            db.session.query(
                extract("year",  Order.created_at).label("yr"),
                extract("month", Order.created_at).label("mo"),
                func.count(Order.id).label("order_count"),
                func.coalesce(func.sum(Order.total_amount), 0).label("revenue"),
            )
            .filter(
                Order.status != OrderStatus.cancelled,
                Order.created_at >= twelve_months_ago,
            )
            .group_by("yr", "mo")
            .order_by("yr", "mo")
            .all()
        )

        data = [
            {
                "month":       f"{int(r.yr)}-{int(r.mo):02d}",
                "revenue":     round(float(r.revenue), 2),
                "order_count": int(r.order_count),
            }
            for r in rows
        ]

        return success_response(
            message="Revenue trend fetched",
            data=data,
            status_code=200,
        )

    except Exception as e:
        e_name = e.__class__.__name__
        e_str = str(e).lower()
        if 'jwt' in e_name.lower() or 'token' in e_name.lower() or 'auth' in e_name.lower() or 'signature' in e_name.lower() or 'cookie' in e_str or 'token' in e_str:
            return jsonify({'error': str(e)}), 401
        current_app.logger.error(f"revenue_trend error: {e}")
        return error_response(str(e), 500)


# ─────────────────────────────────────────────────────────────────────────────
# 5.  TOP SELLERS  —  GET /api/admin/analytics/top-sellers
# ─────────────────────────────────────────────────────────────────────────────
def top_sellers_action():
    """
    Top 5 sellers by total revenue (non-cancelled orders).
    Returns: uuid, username, email, total_revenue, total_orders, total_products.
    """
    _, err = _require_admin()
    if err:
        return err

    try:
        seller_role = Role.query.filter_by(role_name="seller").first()
        if not seller_role:
            return success_response(message="No sellers", data=[], status_code=200)

        rows = (
            db.session.query(
                User.uuid,
                User.username,
                User.email,
                User.is_active,
                func.coalesce(
                    func.sum(OrderItem.price_at_purchase * OrderItem.quantity), 0
                ).label("total_revenue"),
                func.count(func.distinct(Order.id)).label("total_orders"),
                func.count(func.distinct(Product.id)).label("total_products"),
            )
            .select_from(User)
            .join(Product, Product.seller_id == User.id)
            .join(OrderItem, OrderItem.product_id == Product.id)
            .join(Order, Order.id == OrderItem.order_id)
            .filter(
                User.role_id == seller_role.id,
                Order.status != OrderStatus.cancelled,
            )
            .group_by(User.id, User.uuid, User.username, User.email, User.is_active)
            .order_by(func.sum(
                OrderItem.price_at_purchase * OrderItem.quantity
            ).desc())
            .limit(5)
            .all()
        )

        data = [
            {
                "uuid":           r.uuid,
                "username":       r.username,
                "email":          r.email,
                "is_active":      r.is_active,
                "total_revenue":  round(float(r.total_revenue), 2),
                "total_orders":   int(r.total_orders),
                "total_products": int(r.total_products),
            }
            for r in rows
        ]

        return success_response(
            message="Top sellers fetched",
            data=data,
            status_code=200,
        )

    except Exception as e:
        e_name = e.__class__.__name__
        e_str = str(e).lower()
        if 'jwt' in e_name.lower() or 'token' in e_name.lower() or 'auth' in e_name.lower() or 'signature' in e_name.lower() or 'cookie' in e_str or 'token' in e_str:
            return jsonify({'error': str(e)}), 401
        current_app.logger.error(f"top_sellers error: {e}")
        return error_response(str(e), 500)


# ─────────────────────────────────────────────────────────────────────────────
# 6.  SELLER REVENUE CHART  —  GET /api/admin/seller/<uuid>/revenue-chart
# ─────────────────────────────────────────────────────────────────────────────
def seller_revenue_chart_action(seller_uuid: str):
    """
    Returns exactly 6 data points for a Recharts AreaChart.

    Algorithm:
      1. Build a list of the last 6 calendar months (oldest → newest).
      2. Query actual revenue from OrderItems for this seller, grouped by
         (year, month), excluding cancelled orders.
      3. Left-join the query results into the 6-slot list so every month
         is present — months with no sales get revenue = 0 and orders = 0.

    Response shape (array, oldest first):
      [
        { "month": "Nov", "full_month": "Nov 2024", "revenue": 15000.0, "orders": 3 },
        { "month": "Dec", "full_month": "Dec 2024", "revenue": 22500.0, "orders": 5 },
        ...
      ]
    """
    _, err = _require_admin()
    if err:
        return err

    try:
        seller = User.query.filter_by(uuid=seller_uuid).first()
        if not seller or seller.role.role_name != "seller":
            return error_response("Seller not found", 404)

        # ── Build the 6-month window ──────────────────────────────────────
        # Use the 1st of the current month as the anchor so we always get
        # complete months (no partial current-month distortion).
        now = datetime.utcnow()
        # Start of the current month
        current_month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        # We want months: [now-5, now-4, now-3, now-2, now-1, now]
        # Build them as (year, month) tuples, oldest first.
        months = []
        for offset in range(5, -1, -1):
            # Subtract `offset` months from current_month_start
            # Safe subtraction: go back by replacing month/year
            year  = current_month_start.year
            month = current_month_start.month - offset
            while month <= 0:
                month += 12
                year  -= 1
            months.append((year, month))

        # ── Query actual revenue ──────────────────────────────────────────
        six_months_ago = datetime(months[0][0], months[0][1], 1)

        rows = (
            db.session.query(
                extract("year",  Order.created_at).label("yr"),
                extract("month", Order.created_at).label("mo"),
                func.coalesce(
                    func.sum(OrderItem.price_at_purchase * OrderItem.quantity), 0
                ).label("revenue"),
                func.count(func.distinct(Order.id)).label("order_count"),
            )
            .select_from(Product)
            .join(OrderItem, OrderItem.product_id == Product.id)
            .join(Order,     Order.id == OrderItem.order_id)
            .filter(
                Product.seller_id == seller.id,
                Order.status      != OrderStatus.cancelled,
                Order.created_at  >= six_months_ago,
            )
            .group_by("yr", "mo")
            .all()
        )

        # Index actual results by (year, month) for O(1) lookup
        actuals: dict[tuple[int, int], dict] = {
            (int(r.yr), int(r.mo)): {
                "revenue":     round(float(r.revenue), 2),
                "order_count": int(r.order_count),
            }
            for r in rows
        }

        # ── Zero-fill and format ──────────────────────────────────────────
        data = []
        for yr, mo in months:
            actual = actuals.get((yr, mo), {"revenue": 0.0, "order_count": 0})
            data.append({
                "month":      month_abbr[mo],          # "Jan", "Feb", …
                "full_month": f"{month_abbr[mo]} {yr}", # "Jan 2025"
                "revenue":    actual["revenue"],
                "orders":     actual["order_count"],
            })

        return success_response(
            message="Revenue chart data fetched",
            data=data,
            status_code=200,
        )

    except Exception as e:
        e_name = e.__class__.__name__
        e_str = str(e).lower()
        if 'jwt' in e_name.lower() or 'token' in e_name.lower() or 'auth' in e_name.lower() or 'signature' in e_name.lower() or 'cookie' in e_str or 'token' in e_str:
            return jsonify({'error': str(e)}), 401
        current_app.logger.error(f"seller_revenue_chart error: {e}")
        return error_response(str(e), 500)


# ─────────────────────────────────────────────────────────────────────────────
# 7.  SELLER ANALYTICS (FLEXIBLE RANGE)
#     GET /api/admin/seller/<uuid>/analytics?range=7d|30d|6m|ytd
# ─────────────────────────────────────────────────────────────────────────────
def seller_analytics_action(seller_uuid: str):
    """
    Flexible time-range analytics for the ExpandedAnalyticsModal.

    Query params:
      range  — "7d" | "30d" | "6m" | "ytd"  (default: "6m")

    Response shape — array of data points, oldest first:
      [
        {
          "label":      "15 Jan",   # short display label
          "full_label": "15 Jan 2025",
          "revenue":    15000.0,
          "orders":     3,
          "date_key":   "2025-01-15"  # for CSV export
        },
        ...
      ]

    Granularity:
      7d  → daily  (7 points)
      30d → daily  (30 points)
      6m  → monthly (6 points, zero-filled)
      ytd → monthly (months since Jan 1 of current year, zero-filled)
    """
    _, err = _require_admin()
    if err:
        return err

    try:
        seller = User.query.filter_by(uuid=seller_uuid).first()
        if not seller or seller.role.role_name != "seller":
            return error_response("Seller not found", 404)

        range_param = (request.args.get("range") or "6m").strip().lower()
        now = datetime.utcnow()

        # ── Determine window + granularity ────────────────────────────────
        if range_param == "7d":
            start_date = (now - timedelta(days=6)).replace(
                hour=0, minute=0, second=0, microsecond=0
            )
            granularity = "daily"
        elif range_param == "30d":
            start_date = (now - timedelta(days=29)).replace(
                hour=0, minute=0, second=0, microsecond=0
            )
            granularity = "daily"
        elif range_param == "ytd":
            start_date = now.replace(
                month=1, day=1, hour=0, minute=0, second=0, microsecond=0
            )
            granularity = "monthly"
        else:  # default: 6m
            current_month_start = now.replace(
                day=1, hour=0, minute=0, second=0, microsecond=0
            )
            yr, mo = current_month_start.year, current_month_start.month - 5
            while mo <= 0:
                mo += 12
                yr -= 1
            start_date = datetime(yr, mo, 1)
            granularity = "monthly"

        # ── Query ─────────────────────────────────────────────────────────
        if granularity == "daily":
            rows = (
                db.session.query(
                    func.date(Order.created_at).label("day"),
                    func.coalesce(
                        func.sum(OrderItem.price_at_purchase * OrderItem.quantity), 0
                    ).label("revenue"),
                    func.count(func.distinct(Order.id)).label("order_count"),
                )
                .select_from(Product)
                .join(OrderItem, OrderItem.product_id == Product.id)
                .join(Order, Order.id == OrderItem.order_id)
                .filter(
                    Product.seller_id == seller.id,
                    Order.status != OrderStatus.cancelled,
                    Order.created_at >= start_date,
                )
                .group_by(func.date(Order.created_at))
                .order_by(func.date(Order.created_at))
                .all()
            )

            # Build a day-keyed lookup
            actuals: dict[str, dict] = {}
            for r in rows:
                day_str = str(r.day)  # "YYYY-MM-DD"
                actuals[day_str] = {
                    "revenue":     round(float(r.revenue), 2),
                    "order_count": int(r.order_count),
                }

            # Zero-fill every day in the window
            data = []
            days = int((now.date() - start_date.date()).days) + 1
            for i in range(days):
                d = (start_date + timedelta(days=i)).date()
                key = d.strftime("%Y-%m-%d")
                actual = actuals.get(key, {"revenue": 0.0, "order_count": 0})
                data.append({
                    "label":      f"{d.day} {d.strftime('%b')}",    # "5 Jan" — cross-platform
                    "full_label": f"{d.day} {d.strftime('%b %Y')}",  # "5 Jan 2025"
                    "revenue":    actual["revenue"],
                    "orders":     actual["order_count"],
                    "date_key":   key,
                })

        else:  # monthly
            rows = (
                db.session.query(
                    extract("year",  Order.created_at).label("yr"),
                    extract("month", Order.created_at).label("mo"),
                    func.coalesce(
                        func.sum(OrderItem.price_at_purchase * OrderItem.quantity), 0
                    ).label("revenue"),
                    func.count(func.distinct(Order.id)).label("order_count"),
                )
                .select_from(Product)
                .join(OrderItem, OrderItem.product_id == Product.id)
                .join(Order, Order.id == OrderItem.order_id)
                .filter(
                    Product.seller_id == seller.id,
                    Order.status != OrderStatus.cancelled,
                    Order.created_at >= start_date,
                )
                .group_by("yr", "mo")
                .order_by("yr", "mo")
                .all()
            )

            actuals_m: dict[tuple[int, int], dict] = {
                (int(r.yr), int(r.mo)): {
                    "revenue":     round(float(r.revenue), 2),
                    "order_count": int(r.order_count),
                }
                for r in rows
            }

            # Build month list from start_date to now
            months = []
            yr, mo = start_date.year, start_date.month
            while (yr, mo) <= (now.year, now.month):
                months.append((yr, mo))
                mo += 1
                if mo > 12:
                    mo = 1
                    yr += 1

            data = []
            for yr, mo in months:
                actual = actuals_m.get((yr, mo), {"revenue": 0.0, "order_count": 0})
                data.append({
                    "label":      month_abbr[mo],
                    "full_label": f"{month_abbr[mo]} {yr}",
                    "revenue":    actual["revenue"],
                    "orders":     actual["order_count"],
                    "date_key":   f"{yr}-{mo:02d}",
                })

        return success_response(
            message="Analytics fetched",
            data=data,
            status_code=200,
        )

    except Exception as e:
        e_name = e.__class__.__name__
        e_str = str(e).lower()
        if 'jwt' in e_name.lower() or 'token' in e_name.lower() or 'auth' in e_name.lower() or 'signature' in e_name.lower() or 'cookie' in e_str or 'token' in e_str:
            return jsonify({'error': str(e)}), 401
        current_app.logger.error(f"seller_analytics error: {e}")
        return error_response(str(e), 500)

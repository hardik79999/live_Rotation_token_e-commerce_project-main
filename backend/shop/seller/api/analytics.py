"""
GET /api/seller/analytics?range=7d|30d|6m

Returns time-series revenue + order data for the authenticated seller.

Granularity:
  7d  → daily  (7 points, zero-filled)
  30d → daily  (30 points, zero-filled)
  6m  → monthly (6 points, zero-filled)   [default]

Response shape — array of data points, oldest first:
  [
    { "label": "5 Jan", "full_label": "5 Jan 2025",
      "revenue": 15000.0, "orders": 3, "date_key": "2025-01-05" },
    ...
  ]

Fix log
───────
v2 — cross-platform date formatting
  • Replaced d.strftime("%-d %b") with f"{d.day} {d.strftime('%b')}"
    %-d is a Linux/macOS-only strftime flag that strips the leading zero
    from the day number.  On Windows it raises ValueError: Invalid format
    string, which caused every 7d / 30d request to return HTTP 500.
  • The fix produces identical output ("5 Jan", "15 Jan") on all platforms.
  • Also added traceback logging so future errors are visible in the
    terminal immediately.
"""
import traceback
from flask import jsonify, request, current_app
from flask_jwt_extended import verify_jwt_in_request, get_jwt
from sqlalchemy import func, extract
from datetime import datetime, timedelta
from calendar import month_abbr

from shop.extensions import db
from shop.models import User, Product, Order, OrderItem, OrderStatus
from shop.utils.api_response import error_response, success_response


def seller_analytics_action():
    try:
        verify_jwt_in_request()
        claims = get_jwt()
        if claims.get("role") != "seller":
            return error_response("Seller access required", 403)

        seller = User.query.filter_by(
            uuid=claims.get("user_uuid"), is_active=True
        ).first()
        if not seller:
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

            # Build a day-keyed lookup: "YYYY-MM-DD" → {revenue, order_count}
            actuals: dict[str, dict] = {}
            for r in rows:
                day_str = str(r.day)  # SQLAlchemy returns a date or string
                actuals[day_str] = {
                    "revenue":     round(float(r.revenue), 2),
                    "order_count": int(r.order_count),
                }

            # Zero-fill every day in the window
            days = int((now.date() - start_date.date()).days) + 1
            data = []
            for i in range(days):
                d = (start_date + timedelta(days=i)).date()
                key = d.strftime("%Y-%m-%d")
                actual = actuals.get(key, {"revenue": 0.0, "order_count": 0})
                # ── Cross-platform day label ──────────────────────────────
                # %-d strips the leading zero on Linux/macOS but raises
                # ValueError on Windows.  Use f-string instead.
                day_label = f"{d.day} {d.strftime('%b')}"        # "5 Jan"
                day_full  = f"{d.day} {d.strftime('%b %Y')}"     # "5 Jan 2025"
                data.append({
                    "label":      day_label,
                    "full_label": day_full,
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

            # Build month list from start_date up to and including now
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
                    "label":      month_abbr[mo],               # "Jan"
                    "full_label": f"{month_abbr[mo]} {yr}",     # "Jan 2025"
                    "revenue":    actual["revenue"],
                    "orders":     actual["order_count"],
                    "date_key":   f"{yr}-{mo:02d}",
                })

        return success_response(
            message="Seller analytics fetched",
            data=data,
            status_code=200,
        )

    except Exception as e:
        e_name = e.__class__.__name__
        e_str = str(e).lower()
        if 'jwt' in e_name.lower() or 'token' in e_name.lower() or 'auth' in e_name.lower() or 'signature' in e_name.lower() or 'cookie' in e_str or 'token' in e_str:
            return jsonify({'error': str(e)}), 401
        current_app.logger.error(f'seller_analytics error: {e}', exc_info=True)
        return error_response('Analytics query failed. Please try again.', 500)

"""
GET /api/seller/order/<order_uuid>/buyer-details

Returns the buyer's contact details and order history with THIS seller.

Security model:
  1. Verify JWT — must be a seller.
  2. Look up the order by UUID.
  3. Confirm the order contains at least one product belonging to this seller.
     If not → 403 Forbidden.  A seller cannot probe orders that aren't theirs.
  4. Return ONLY:
       - name, email, phone, profile_photo  (no password hash, no role, no uuid)
       - shipping address used for this order
       - order history with THIS seller only (count + list of past orders)
  5. Never expose other sellers' data or platform-wide order counts.
"""
import traceback
from flask import jsonify
from flask_jwt_extended import verify_jwt_in_request, get_jwt
from sqlalchemy import func, distinct

from shop.extensions import db
from shop.models import User, Order, OrderItem, Product, Address
from shop.utils.api_response import error_response


def get_buyer_details_action(order_uuid: str):
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

        # ── Fetch the requested order ─────────────────────────────────────
        order = Order.query.filter_by(uuid=order_uuid).first()
        if not order:
            return error_response("Order not found", 404)

        # ── SECURITY CHECK: does this order contain any of this seller's products? ──
        seller_product_ids = [
            p.id for p in
            Product.query.filter_by(seller_id=seller.id).all()
        ]

        seller_items_in_order = [
            item for item in order.items
            if item.product_id in seller_product_ids
        ]

        if not seller_items_in_order:
            # This order exists but belongs to a different seller — 403, not 404,
            # so we don't leak whether the order UUID is valid.
            return error_response(
                "Access denied: this order does not contain your products", 403
            )

        # ── Fetch customer (safe fields only — no password, no role details) ──
        customer = User.query.get(order.user_id)
        if not customer:
            return error_response("Customer not found", 404)

        # ── Fetch shipping address used for this order ────────────────────
        address = Address.query.get(order.address_id)
        shipping_address = (
            f"{address.full_name}, {address.street}, {address.city}, "
            f"{address.state} - {address.pincode}"
            if address else "Address not available"
        )
        shipping_phone = address.phone_number if address else customer.phone or "N/A"

        # ── Order history: all orders from this customer with THIS seller ──
        # Find all order IDs that contain this seller's products AND belong
        # to this customer.
        customer_order_ids = (
            db.session.query(func.distinct(Order.id))
            .join(OrderItem, OrderItem.order_id == Order.id)
            .filter(
                Order.user_id == customer.id,
                OrderItem.product_id.in_(seller_product_ids),
            )
            .all()
        )
        customer_order_ids = [row[0] for row in customer_order_ids]

        past_orders_objs = (
            Order.query
            .filter(Order.id.in_(customer_order_ids))
            .order_by(Order.created_at.desc())
            .all()
        )

        past_orders = []
        total_spent_with_seller = 0.0

        for o in past_orders_objs:
            seller_items = [
                item for item in o.items
                if item.product_id in seller_product_ids
            ]
            seller_subtotal = sum(
                float(item.price_at_purchase) * item.quantity
                for item in seller_items
            )
            total_spent_with_seller += seller_subtotal
            past_orders.append({
                "order_uuid":  o.uuid,
                "date":        o.created_at.strftime('%Y-%m-%d') if o.created_at else None,
                "status":      o.status.value if hasattr(o.status, 'value') else str(o.status),
                "seller_total": round(seller_subtotal, 2),
                "item_count":  sum(i.quantity for i in seller_items),
            })

        total_orders_with_seller = len(past_orders)

        # ── Customer value label ──────────────────────────────────────────
        if total_orders_with_seller >= 5:
            value_label = "⭐ VIP Customer"
            value_color = "gold"
        elif total_orders_with_seller >= 3:
            value_label = "⭐ Loyal Buyer"
            value_color = "green"
        elif total_orders_with_seller == 2:
            value_label = "🔄 Repeat Buyer"
            value_color = "blue"
        else:
            value_label = "🆕 New Customer"
            value_color = "gray"

        return jsonify({
            "success": True,
            "message": "Buyer details fetched",
            "data": {
                # ── Identity (safe fields only) ───────────────────────────
                "name":          customer.username,
                "email":         customer.email,
                "phone":         customer.phone or "Not provided",
                "profile_photo": customer.profile_photo,

                # ── Order-specific address ────────────────────────────────
                "shipping_address": shipping_address,
                "shipping_phone":   shipping_phone,

                # ── Customer value with this seller ───────────────────────
                "total_orders_with_seller":  total_orders_with_seller,
                "total_spent_with_seller":   round(total_spent_with_seller, 2),
                "value_label":               value_label,
                "value_color":               value_color,

                # ── Order history (this seller only) ─────────────────────
                "order_history": past_orders,
            }
        }), 200

    except Exception as e:
        e_name = e.__class__.__name__
        e_str = str(e).lower()
        if 'jwt' in e_name.lower() or 'token' in e_name.lower() or 'auth' in e_name.lower() or 'signature' in e_name.lower() or 'cookie' in e_str or 'token' in e_str:
            return jsonify({'error': str(e)}), 401
        current_app.logger.error(f'get_buyer_details error: {e}', exc_info=True)
        return error_response('Failed to fetch buyer details. Please try again.', 500)

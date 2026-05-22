"""
GET /api/seller/orders

Returns all orders that contain at least one product belonging to this seller.
Each order shows only the items that belong to this seller (not other sellers' items).
"""
from flask import jsonify
from flask_jwt_extended import verify_jwt_in_request, get_jwt
from shop.models import User, Order, OrderItem, Product, Address, OrderReturn, ReturnStatus
from shop.utils.api_response import error_response
from sqlalchemy import distinct


def get_seller_orders_action():
    try:
        verify_jwt_in_request()
        claims = get_jwt()

        if claims.get("role") != "seller":
            return error_response("Seller access required", 403)

        seller = User.query.filter_by(uuid=claims.get("user_uuid"), is_active=True).first()
        if not seller:
            return error_response("Seller not found", 404)

        # Find all order IDs that contain at least one product from this seller
        seller_product_ids = [p.id for p in Product.query.filter_by(seller_id=seller.id, is_active=True).all()]

        if not seller_product_ids:
            return jsonify({"success": True, "total": 0, "data": []}), 200

        # Get distinct order IDs that have this seller's products
        order_ids = (
            OrderItem.query
            .filter(OrderItem.product_id.in_(seller_product_ids))
            .with_entities(distinct(OrderItem.order_id))
            .all()
        )
        order_ids = [row[0] for row in order_ids]

        if not order_ids:
            return jsonify({"success": True, "total": 0, "data": []}), 200

        orders = (
            Order.query
            .filter(Order.id.in_(order_ids))
            .order_by(Order.created_at.desc())
            .all()
        )

        result = []
        for order in orders:
            # Only include items that belong to this seller
            seller_items = [
                item for item in order.items
                if item.product_id in seller_product_ids
            ]

            # Customer info
            customer = User.query.get(order.user_id)
            address = Address.query.get(order.address_id)

            # Seller's revenue from this order (only their items)
            seller_total = sum(
                float(item.price_at_purchase) * item.quantity
                for item in seller_items
            )

            # ── Return info ───────────────────────────────────────────────
            import json as _json
            latest_return = (
                OrderReturn.query
                .filter_by(order_id=order.id)
                .order_by(OrderReturn.created_at.desc())
                .first()
            )
            return_data = None
            if latest_return:
                try:
                    image_urls = _json.loads(latest_return.image_urls) if latest_return.image_urls else []
                except Exception:
                    image_urls = []
                return_data = {
                    'uuid':              latest_return.uuid,
                    'status':            latest_return.status.value,
                    'reason':            latest_return.reason.value,
                    'customer_comments': latest_return.customer_comments,
                    'image_urls':        image_urls,
                    'refund_method':     latest_return.refund_method,
                    'refund_amount':     latest_return.refund_amount,
                    'created_at':        latest_return.created_at.isoformat() if latest_return.created_at else None,
                }

            result.append({
                "order_uuid": order.uuid,
                "order_date": order.created_at.strftime('%Y-%m-%d %H:%M:%S') if order.created_at else None,
                "status": order.status.name if hasattr(order.status, 'name') else str(order.status),
                "payment_method": order.payment_method.name if hasattr(order.payment_method, 'name') else str(order.payment_method),
                "seller_total": round(seller_total, 2),
                "customer": {
                    "name": customer.username if customer else "Unknown",
                    "email": customer.email if customer else "Unknown",
                    "phone": customer.phone or "N/A",
                },
                "shipping_address": (
                    f"{address.street}, {address.city}, {address.state} - {address.pincode}"
                    if address else "N/A"
                ),
                "return": return_data,
                "items": [
                    {
                        "product_uuid": item.product.uuid if item.product else None,
                        "product_name": item.product.name if item.product else "Deleted Product",
                        "quantity": item.quantity,
                        "price_at_purchase": float(item.price_at_purchase),
                        "subtotal": round(float(item.price_at_purchase) * item.quantity, 2),
                        "image": (
                            next(
                                (img.image_url for img in item.product.images if img.is_primary and img.is_active),
                                next((img.image_url for img in item.product.images if img.is_active), None)
                            )
                            if item.product and item.product.images else None
                        ),
                    }
                    for item in seller_items
                ],
            })

        return jsonify({"success": True, "total": len(result), "data": result}), 200

    except Exception as e:
        e_name = e.__class__.__name__
        e_str = str(e).lower()
        if 'jwt' in e_name.lower() or 'token' in e_name.lower() or 'auth' in e_name.lower() or 'signature' in e_name.lower() or 'cookie' in e_str or 'token' in e_str:
            return jsonify({'error': str(e)}), 401
        return error_response("An error occurred. Please try again.", 500)

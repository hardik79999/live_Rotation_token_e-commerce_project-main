from flask import jsonify
from flask_jwt_extended import verify_jwt_in_request, get_jwt
from shop.models import User, Order, OrderItem, Payment, PaymentMethod, PaymentStatus, OrderStatus, OrderReturn
from shop.utils.api_response import error_response
from datetime import datetime, timedelta

RETURN_WINDOW_DAYS = 7


def get_orders_action():
    try:
        verify_jwt_in_request()
        user = User.query.filter_by(uuid=get_jwt().get("user_uuid")).first()

        orders = (
            Order.query
            .filter_by(user_id=user.id)
            .order_by(Order.created_at.desc())
            .all()
        )

        result = []
        for o in orders:
            # ── Filter out failed/abandoned online payments ──────────────
            is_cod = (
                o.payment_method == PaymentMethod.cod
                if hasattr(o.payment_method, 'value')
                else str(o.payment_method).lower() == 'cod'
            )

            if not is_cod:
                payment = o.payment
                order_status_val = (
                    o.status.value
                    if hasattr(o.status, 'value')
                    else str(o.status).lower()
                )
                payment_done = (
                    payment is not None
                    and payment.status == PaymentStatus.completed
                )
                order_progressed = order_status_val not in ('pending',)
                if not payment_done and not order_progressed:
                    continue

            # ── Build items list with product image ───────────────────────
            items_data = []
            for item in o.items:
                product = item.product
                if not product:
                    continue
                # Get primary image, fallback to first active image
                primary = next(
                    (img.image_url for img in product.images if img.is_primary and img.is_active),
                    None
                )
                if not primary:
                    primary = next(
                        (img.image_url for img in product.images if img.is_active),
                        None
                    )
                items_data.append({
                    "product_uuid":       product.uuid,
                    "product_name":       product.name,
                    "quantity":           item.quantity,
                    "price_at_purchase":  float(item.price_at_purchase),
                    "subtotal":           round(float(item.price_at_purchase) * item.quantity, 2),
                    "image":              primary,
                })

            # ── Return info ───────────────────────────────────────────────
            latest_return = (
                OrderReturn.query
                .filter_by(order_id=o.id)
                .order_by(OrderReturn.created_at.desc())
                .first()
            )
            return_info = None
            if latest_return:
                return_info = {
                    'uuid':          latest_return.uuid,
                    'status':        latest_return.status.value,
                    'reason':        latest_return.reason.value,
                    'refund_method': latest_return.refund_method,
                    'refund_amount': latest_return.refund_amount,
                    'created_at':    latest_return.created_at.isoformat() if latest_return.created_at else None,
                }

            # ── Return window ─────────────────────────────────────────────
            window_open = False
            days_left   = 0
            if o.status == OrderStatus.delivered:
                # Use delivered_at if set, otherwise fall back to created_at
                # so orders marked delivered before the column was added still work
                reference_dt = o.delivered_at or o.created_at
                if reference_dt:
                    deadline    = reference_dt + timedelta(days=RETURN_WINDOW_DAYS)
                    remaining   = deadline - datetime.utcnow()
                    window_open = remaining.total_seconds() > 0
                    days_left   = max(0, -(-int(remaining.total_seconds()) // 86400)) if window_open else 0

            result.append({
                "uuid":           o.uuid,
                "amount":         o.total_amount,
                "status":         o.status.name if hasattr(o.status, 'name') else str(o.status),
                "payment_method": o.payment_method.name if hasattr(o.payment_method, 'name') else str(o.payment_method),
                "date":           o.created_at.strftime('%Y-%m-%d %H:%M:%S') if o.created_at else None,
                "delivered_at":   o.delivered_at.isoformat() if o.delivered_at else None,
                "items":          items_data,
                "return":         return_info,
                "return_window_open": window_open,
                "return_days_left":   days_left,
            })

        return jsonify({"success": True, "total": len(result), "data": result}), 200

    except Exception as e:
        e_name = e.__class__.__name__
        e_str = str(e).lower()
        if 'jwt' in e_name.lower() or 'token' in e_name.lower() or 'auth' in e_name.lower() or 'signature' in e_name.lower() or 'cookie' in e_str or 'token' in e_str:
            return jsonify({"error": str(e)}), 401
        return error_response(str(e), 500)


def get_order_status_action(order_uuid):
    try:
        verify_jwt_in_request()
        user = User.query.filter_by(uuid=get_jwt().get("user_uuid")).first()

        order = Order.query.filter_by(uuid=order_uuid, user_id=user.id).first()
        if not order:
            return error_response("Order not found", 404)

        tracking_history = []
        for track in order.tracking:
            tracking_history.append({
                "status":  track.status.name.capitalize() if hasattr(track.status, 'name') else str(track.status),
                "message": track.message,
                "date":    track.created_at.strftime('%Y-%m-%d %H:%M:%S') if track.created_at else None,
            })

        return jsonify({
            "success": True,
            "data": {
                "order_uuid":      order.uuid,
                "current_status":  order.status.name.capitalize() if hasattr(order.status, 'name') else str(order.status),
                "amount":          order.total_amount,
                "payment_method":  order.payment_method.name if hasattr(order.payment_method, 'name') else str(order.payment_method),
                "tracking_history": tracking_history,
            }
        }), 200

    except Exception as e:
        e_name = e.__class__.__name__
        e_str = str(e).lower()
        if 'jwt' in e_name.lower() or 'token' in e_name.lower() or 'auth' in e_name.lower() or 'signature' in e_name.lower() or 'cookie' in e_str or 'token' in e_str:
            return jsonify({"error": str(e)}), 401
        return error_response(str(e), 500)

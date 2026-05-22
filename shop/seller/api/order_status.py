"""
PUT /api/seller/order/<order_uuid>/status
"""
import logging
from flask import request, jsonify, current_app
from flask_jwt_extended import verify_jwt_in_request, get_jwt
from shop.extensions import db
from shop.models import Order, OrderStatus, OrderItem, Product, User, OrderTracking, WalletTransaction, WalletTransactionType
from shop.utils.api_response import error_response
from shop.utils.email_service import send_order_status_email
from shop.utils.wallet_service import credit_wallet, debit_wallet, compute_loyalty_credit


# ── Statuses that are terminal — no further transitions allowed ───────────────
TERMINAL_STATUSES = {OrderStatus.delivered, OrderStatus.cancelled}

# ── Valid forward transitions for sellers ────────────────────────────────────
# Sellers may only advance an order forward OR cancel it.
# They cannot revert a shipped order back to processing, etc.
SELLER_ALLOWED_TRANSITIONS: dict[OrderStatus, set[OrderStatus]] = {
    OrderStatus.pending:    {OrderStatus.processing, OrderStatus.cancelled},
    OrderStatus.processing: {OrderStatus.shipped,    OrderStatus.cancelled},
    OrderStatus.shipped:    {OrderStatus.delivered,  OrderStatus.cancelled},
    # delivered and cancelled are terminal — no outgoing transitions
}


def update_order_status_action(order_uuid: str):
    try:
        verify_jwt_in_request()
        claims = get_jwt()
        role = claims.get("role")

        if role not in ("admin", "seller"):
            return error_response("Unauthorized: only admins or sellers can update orders.", 403)

        # ── Parse & validate the requested new status ─────────────────────
        data = request.get_json(silent=True) or {}
        new_status_str = (data.get("status") or "").strip().lower()

        if not new_status_str:
            return error_response("'status' field is required.", 400)

        try:
            new_status = OrderStatus[new_status_str]
        except KeyError:
            valid = ", ".join(s.name for s in OrderStatus)
            return error_response(f"Invalid status '{new_status_str}'. Valid values: {valid}", 400)

        # ── Fetch the order ───────────────────────────────────────────────
        order = Order.query.filter_by(uuid=order_uuid).first()
        if not order:
            return error_response("Order not found.", 404)

        current_status: OrderStatus = order.status

        # ── Terminal-state guard ──────────────────────────────────────────
        if current_status in TERMINAL_STATUSES:
            state_name = current_status.value.capitalize()
            return error_response(
                f"This order is already '{state_name}' and cannot be updated further.",
                409,
            )

        # ── Ownership check (sellers only) ────────────────────────────────
        seller = None
        if role == "seller":
            seller = User.query.filter_by(
                uuid=claims.get("user_uuid"), is_active=True
            ).first()
            if not seller:
                return error_response("Seller account not found.", 404)

            # Collect this seller's product IDs
            seller_product_ids = {
                p.id for p in Product.query.filter_by(seller_id=seller.id).all()
            }

            # Verify the order contains at least one of this seller's products
            order_product_ids = {item.product_id for item in order.items}
            if not seller_product_ids.intersection(order_product_ids):
                return error_response(
                    "Access denied: this order does not contain your products.", 403
                )

            # ── Transition validation (sellers only) ──────────────────────
            allowed = SELLER_ALLOWED_TRANSITIONS.get(current_status, set())
            if new_status not in allowed:
                allowed_names = ", ".join(s.value for s in allowed) or "none"
                return error_response(
                    f"Cannot transition from '{current_status.value}' to '{new_status.value}'. "
                    f"Allowed next statuses: {allowed_names}.",
                    422,
                )

        # ── Inventory restoration on cancellation ─────────────────────────
        # When an order is cancelled, return each item's quantity back to
        # the product's stock. Only restore items belonging to this seller
        # (for seller-initiated cancellations); admins restore all items.
        restored_items: list[dict] = []

        if new_status == OrderStatus.cancelled:
            for item in order.items:
                product = item.product
                if product is None:
                    continue  # product was deleted — skip silently

                # Sellers only restore their own products
                if role == "seller" and seller and product.seller_id != seller.id:
                    continue

                old_stock = product.stock
                product.stock += item.quantity
                product.updated_by = seller.id if seller else None

                restored_items.append({
                    "product_name": product.name,
                    "qty_restored": item.quantity,
                    "new_stock":    product.stock,
                })
                current_app.logger.info(
                    f"Stock restored: '{product.name}' "
                    f"{old_stock} → {product.stock} (+{item.quantity})"
                )

        # ── Apply the status change ───────────────────────────────────────
        order.status = new_status
        if new_status == OrderStatus.delivered:
            from datetime import datetime as _dt
            order.delivered_at = _dt.utcnow()

        # ── Write tracking history entry ──────────────────────────────────
        if new_status == OrderStatus.cancelled:
            tracking_msg = "Your order has been cancelled. Any applicable refund will be processed shortly."
        else:
            tracking_msg = f"Your order has been updated to {new_status.value.capitalize()}."

        db.session.add(OrderTracking(
            order_id=order.id,
            status=new_status,
            message=tracking_msg,
        ))

        # ── RULE 1: DELIVERED → credit 5% loyalty points ─────────────────
        # ── RULE 2: CANCELLED → refund any wallet used + reverse loyalty ──
        customer = User.query.get(order.user_id)
        wallet_msg = None

        if customer and customer.role.role_name == 'customer':
            try:
                if new_status == OrderStatus.delivered:
                    loyalty_amount = compute_loyalty_credit(order.total_amount)
                    if loyalty_amount > 0:
                        credit_wallet(
                            user        = customer,
                            amount      = loyalty_amount,
                            description = f'Loyalty reward for Order #{order.uuid[:8].upper()}',
                            order       = order,
                        )
                        wallet_msg = f'₹{loyalty_amount:.2f} loyalty points credited to customer wallet.'
                        current_app.logger.info(
                            f'Wallet CREDIT ₹{loyalty_amount} → user {customer.uuid} for order {order.uuid}'
                        )

                elif new_status == OrderStatus.cancelled:
                    # Refund wallet amount that was used at checkout
                    if order.wallet_used and order.wallet_used > 0:
                        credit_wallet(
                            user        = customer,
                            amount      = order.wallet_used,
                            description = f'Refund for cancelled Order #{order.uuid[:8].upper()}',
                            order       = order,
                        )
                        wallet_msg = f'₹{order.wallet_used:.2f} refunded to customer wallet.'
                        current_app.logger.info(
                            f'Wallet REFUND ₹{order.wallet_used} → user {customer.uuid} for cancelled order {order.uuid}'
                        )

                    # Also reverse any loyalty points that were already credited
                    # (edge case: order was briefly delivered then cancelled by admin)
                    loyalty_credit = (
                        WalletTransaction.query
                        .filter_by(
                            user_id          = customer.id,
                            order_id         = order.id,
                            transaction_type = WalletTransactionType.CREDIT,
                        )
                        .filter(WalletTransaction.description.like('Loyalty reward%'))
                        .first()
                    )
                    if loyalty_credit and customer.wallet_balance >= loyalty_credit.amount:
                        debit_wallet(
                            user        = customer,
                            amount      = loyalty_credit.amount,
                            description = f'Loyalty reversal for cancelled Order #{order.uuid[:8].upper()}',
                            order       = order,
                        )

            except Exception as wallet_err:
                # Wallet failure must NOT block the status update
                current_app.logger.error(f'Wallet operation failed for order {order.uuid}: {wallet_err}')

        db.session.commit()

        # ── Send customer email notification ──────────────────────────────
        customer = User.query.get(order.user_id)
        if customer:
            try:
                send_order_status_email(
                    customer.email,
                    order.uuid,
                    new_status.name,
                    customer_name=customer.username,   # pass real name, not default
                )
                current_app.logger.info(
                    f"Order {order.uuid} → {new_status.name}. "
                    f"Email sent to {customer.email}"
                )
            except Exception as email_err:
                # Email failure must NOT roll back the status update
                current_app.logger.warning(
                    f"Email send failed for order {order.uuid}: {email_err}"
                )

        response_data: dict = {
            "success": True,
            "message": f"Order status updated to '{new_status.value}'.",
            "new_status": new_status.value,
        }
        if restored_items:
            response_data["inventory_restored"] = restored_items
            response_data["message"] += (
                f" {len(restored_items)} product(s) had their stock restored."
            )
        if wallet_msg:
            response_data["wallet_update"] = wallet_msg

        return jsonify(response_data), 200

    except Exception as e:
        e_name = e.__class__.__name__
        e_str = str(e).lower()
        if 'jwt' in e_name.lower() or 'token' in e_name.lower() or 'auth' in e_name.lower() or 'signature' in e_name.lower() or 'cookie' in e_str or 'token' in e_str:
            return jsonify({'error': str(e)}), 401
        db.session.rollback()
        current_app.logger.error(f'update_order_status error: {e}', exc_info=True)
        return error_response('Failed to update order status. Please try again.', 500)

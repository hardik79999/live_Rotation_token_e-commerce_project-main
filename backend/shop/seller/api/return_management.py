"""
PUT /api/seller/order/<order_uuid>/return/approve
PUT /api/seller/order/<order_uuid>/return/reject

Seller-scoped return processing.
Ownership check: the order must contain at least one product belonging to this seller.
Financial logic is identical to the admin path — ACID transaction.
"""
import traceback
from flask import request, jsonify, current_app
from flask_jwt_extended import verify_jwt_in_request, get_jwt
from shop.extensions import db
from shop.models import (
    User, Order, OrderReturn, OrderItem, Product,
    ReturnStatus, Payment, PaymentStatus, PaymentMethod,
    WalletTransaction, WalletTransactionType,
)
from shop.utils.api_response import error_response
from shop.utils.wallet_service import credit_wallet, debit_wallet


def _ownership_check(order: Order, seller: User) -> bool:
    """Return True if this seller owns at least one item in the order."""
    seller_product_ids = {p.id for p in Product.query.filter_by(seller_id=seller.id).all()}
    order_product_ids  = {item.product_id for item in order.items}
    return bool(seller_product_ids & order_product_ids)


def _get_seller_and_return(order_uuid: str):
    """
    Shared guard: authenticate seller, load order + active return.
    Returns (seller, order, ret) or raises an error response tuple.
    """
    verify_jwt_in_request()
    claims = get_jwt()
    if claims.get('role') != 'seller':
        return None, None, None, error_response('Seller access required', 403)

    seller = User.query.filter_by(uuid=claims.get('user_uuid'), is_active=True).first()
    if not seller:
        return None, None, None, error_response('Seller not found', 404)

    order = Order.query.filter_by(uuid=order_uuid).first()
    if not order:
        return None, None, None, error_response('Order not found', 404)

    if not _ownership_check(order, seller):
        return None, None, None, error_response(
            'Access denied: this order does not contain your products.', 403
        )

    ret = (
        OrderReturn.query
        .filter_by(order_id=order.id)
        .filter(OrderReturn.status == ReturnStatus.pending)
        .first()
    )
    if not ret:
        return None, None, None, error_response(
            'No pending return request found for this order.', 404
        )

    return seller, order, ret, None


# ─────────────────────────────────────────────────────────────────────────────
# PUT /api/seller/order/<order_uuid>/return/approve
# ─────────────────────────────────────────────────────────────────────────────
def seller_approve_return_action(order_uuid: str):
    try:
        seller, order, ret, err = _get_seller_and_return(order_uuid)
        if err:
            return err

        data        = request.get_json(silent=True) or {}
        seller_note = (data.get('seller_note') or '').strip() or None

        customer      = User.query.get(ret.user_id)
        refund_amount = round(order.total_amount, 2)
        refund_method = 'wallet'
        rp_refund_id  = None

        # ── Try Razorpay refund for online payments ───────────────────────
        payment   = order.payment
        is_online = (
            payment is not None
            and payment.payment_method != PaymentMethod.cod
            and payment.status == PaymentStatus.completed
            and payment.transaction_id
            and not payment.transaction_id.startswith('COD-')
        )

        if is_online:
            try:
                from shop.utils.razorpay_service import get_razorpay_client
                client   = get_razorpay_client()
                rp_resp  = client.payment.refund(
                    payment.transaction_id,
                    {'amount': int(refund_amount * 100), 'speed': 'normal'},
                )
                rp_refund_id  = rp_resp.get('id')
                refund_method = 'razorpay'
                current_app.logger.info(
                    f'[Seller] Razorpay refund {rp_refund_id} ₹{refund_amount} order {order.uuid}'
                )
            except Exception as rp_err:
                current_app.logger.warning(
                    f'[Seller] Razorpay refund failed ({rp_err}), falling back to wallet'
                )
                refund_method = 'wallet'

        # ── Wallet credit ─────────────────────────────────────────────────
        if refund_method == 'wallet' and customer:
            credit_wallet(
                user        = customer,
                amount      = refund_amount,
                description = f'Refund for returned Order #{order.uuid[:8].upper()}',
                order       = order,
            )

        # ── Reverse loyalty points ────────────────────────────────────────
        if customer:
            loyalty_txn = (
                WalletTransaction.query
                .filter_by(
                    user_id          = customer.id,
                    order_id         = order.id,
                    transaction_type = WalletTransactionType.CREDIT,
                )
                .filter(WalletTransaction.description.like('Loyalty reward%'))
                .first()
            )
            if loyalty_txn and customer.wallet_balance >= loyalty_txn.amount:
                try:
                    debit_wallet(
                        user        = customer,
                        amount      = loyalty_txn.amount,
                        description = f'Loyalty reversal for returned Order #{order.uuid[:8].upper()}',
                        order       = order,
                    )
                except Exception as lp_err:
                    current_app.logger.warning(f'[Seller] Loyalty reversal failed: {lp_err}')

        # ── Restore inventory (only this seller's items) ──────────────────
        seller_product_ids = {p.id for p in Product.query.filter_by(seller_id=seller.id).all()}
        for item in order.items:
            if item.product and item.product_id in seller_product_ids:
                item.product.stock += item.quantity
                current_app.logger.info(
                    f'[Seller] Stock restored: {item.product.name} +{item.quantity}'
                )

        # ── Update return record ──────────────────────────────────────────
        ret.status             = ReturnStatus.refunded
        ret.admin_notes        = seller_note
        ret.refund_method      = refund_method
        ret.refund_amount      = refund_amount
        ret.razorpay_refund_id = rp_refund_id

        db.session.commit()

        current_app.logger.info(
            f'[Seller {seller.uuid}] Approved return for order {order.uuid} '
            f'— ₹{refund_amount} via {refund_method}'
        )

        return jsonify({
            'success':       True,
            'message':       f'Return approved. ₹{refund_amount:.2f} refunded via {refund_method}.',
            'refund_method': refund_method,
            'refund_amount': refund_amount,
        }), 200

    except Exception as e:
        e_name = e.__class__.__name__
        e_str = str(e).lower()
        if 'jwt' in e_name.lower() or 'token' in e_name.lower() or 'auth' in e_name.lower() or 'signature' in e_name.lower() or 'cookie' in e_str or 'token' in e_str:
            return jsonify({'error': str(e)}), 401
        db.session.rollback()
        current_app.logger.error(f'seller_approve_return error: {e}', exc_info=True)
        return error_response('Failed to process return. Please try again.', 500)
def seller_reject_return_action(order_uuid: str):
    try:
        seller, order, ret, err = _get_seller_and_return(order_uuid)
        if err:
            return err

        data        = request.get_json(silent=True) or {}
        seller_note = (data.get('seller_note') or '').strip() or None

        ret.status      = ReturnStatus.rejected
        ret.admin_notes = seller_note
        db.session.commit()

        current_app.logger.info(
            f'[Seller {seller.uuid}] Rejected return for order {order.uuid}'
        )

        return jsonify({
            'success': True,
            'message': 'Return request rejected.',
        }), 200

    except Exception as e:
        e_name = e.__class__.__name__
        e_str = str(e).lower()
        if 'jwt' in e_name.lower() or 'token' in e_name.lower() or 'auth' in e_name.lower() or 'signature' in e_name.lower() or 'cookie' in e_str or 'token' in e_str:
            return jsonify({'error': str(e)}), 401
        db.session.rollback()
        current_app.logger.error(f'seller_reject_return error: {e}', exc_info=True)
        return error_response('Failed to process return. Please try again.', 500)
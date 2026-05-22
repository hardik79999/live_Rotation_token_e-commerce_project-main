"""
POST /api/user/verify-payment

Verifies Razorpay payment signature and atomically deducts stock.
Idempotent: safe to call multiple times for the same payment.
"""
from flask import request, jsonify, current_app
from flask_jwt_extended import verify_jwt_in_request, get_jwt
from shop.extensions import db
from shop.models import (
    User, Payment, Order, PaymentStatus, OrderStatus,
    CartItem, Product, OrderItem,
)
from shop.utils.api_response import error_response
from shop.utils.razorpay_service import get_razorpay_client


def verify_payment_action():
    try:
        verify_jwt_in_request()
        user_uuid = get_jwt().get('user_uuid')
        user = User.query.filter_by(uuid=user_uuid, is_active=True).first()
        if not user:
            return error_response('User not found', 404)

        data                = request.get_json(silent=True) or {}
        razorpay_order_id   = (data.get('razorpay_order_id')   or '').strip()
        razorpay_payment_id = (data.get('razorpay_payment_id') or '').strip()
        razorpay_signature  = (data.get('razorpay_signature')  or '').strip()

        if not all([razorpay_order_id, razorpay_payment_id, razorpay_signature]):
            return error_response('razorpay_order_id, razorpay_payment_id, and razorpay_signature are required', 400)

        payment_record = Payment.query.filter_by(
            transaction_id=razorpay_order_id
        ).first()

        if not payment_record or payment_record.user_id != user.id:
            return error_response('Payment record not found or unauthorized', 403)

        # Idempotency guard
        if payment_record.status == PaymentStatus.completed:
            return jsonify({'success': True, 'message': 'Payment already processed'}), 200

        # ── Verify Razorpay signature ─────────────────────────────────────
        try:
            client = get_razorpay_client()
            client.utility.verify_payment_signature({
                'razorpay_order_id':   razorpay_order_id,
                'razorpay_payment_id': razorpay_payment_id,
                'razorpay_signature':  razorpay_signature,
            })
        except Exception:
            current_app.logger.warning(
                f'Payment signature verification failed for order {razorpay_order_id}'
            )
            return error_response('Payment verification failed. Invalid signature.', 400)

        # ── Atomic stock deduction with row-level locks ───────────────────
        order = Order.query.get(payment_record.order_id)
        if not order:
            return error_response('Order not found', 404)

        for item in order.items:
            # Lock the product row before reading stock to prevent
            # concurrent webhook calls from double-deducting inventory.
            product = (
                Product.query
                .with_for_update()
                .filter_by(id=item.product_id)
                .first()
            )
            if not product or product.stock < item.quantity:
                db.session.rollback()
                current_app.logger.error(
                    f'Stock deduction failed for product {item.product_id} '
                    f'during payment {razorpay_order_id}'
                )
                return error_response(
                    'One or more items went out of stock during payment. '
                    'A refund will be initiated if charged.', 400
                )
            product.stock -= item.quantity

        payment_record.status         = PaymentStatus.completed
        payment_record.transaction_id = razorpay_payment_id
        order.status                  = OrderStatus.processing

        # Clear the customer's cart
        CartItem.query.filter_by(user_id=user.id, is_active=True).update({'is_active': False})

        db.session.commit()

        # Stock changed — invalidate product list cache
        from shop.utils.cache_utils import invalidate_product_catalog
        invalidate_product_catalog()

        current_app.logger.info(
            f'Payment verified: order={order.uuid} payment={razorpay_payment_id}'
        )

        return jsonify({
            'success':    True,
            'message':    'Payment verified. Order confirmed!',
            'order_uuid': order.uuid,
        }), 200

    except Exception as e:
        e_name = e.__class__.__name__
        e_str = str(e).lower()
        if 'jwt' in e_name.lower() or 'token' in e_name.lower() or 'auth' in e_name.lower() or 'signature' in e_name.lower() or 'cookie' in e_str or 'token' in e_str:
            return jsonify({'error': str(e)}), 401
        db.session.rollback()
        current_app.logger.error(f'Verify payment error: {e}')
        return error_response('Payment verification failed. Please contact support.', 500)

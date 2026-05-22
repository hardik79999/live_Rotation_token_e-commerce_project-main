"""
POST /api/user/webhook/razorpay

Razorpay sends this when a payment is captured server-side.
Signature is verified before any DB mutation.
Idempotent: safe to receive the same event multiple times.
"""
import hmac
import hashlib
import json
from flask import request, jsonify, current_app
from shop.extensions import db
from shop.models import Payment, Order, PaymentStatus, OrderStatus, Product, OrderItem


def razorpay_webhook_action():
    try:
        payload_bytes     = request.get_data()
        webhook_signature = request.headers.get('X-Razorpay-Signature', '')
        webhook_secret    = current_app.config.get('RAZORPAY_WEBHOOK_SECRET', '')

        if not webhook_secret:
            current_app.logger.error('RAZORPAY_WEBHOOK_SECRET not configured')
            return jsonify({'error': 'Webhook not configured'}), 500

        # ── Verify signature using HMAC-SHA256 ────────────────────────────
        expected = hmac.new(
            webhook_secret.encode('utf-8'),
            payload_bytes,
            hashlib.sha256,
        ).hexdigest()

        if not hmac.compare_digest(expected, webhook_signature):
            current_app.logger.warning('Razorpay webhook: invalid signature')
            return jsonify({'error': 'Invalid signature'}), 400

        data  = json.loads(payload_bytes)
        event = data.get('event')

        if event != 'payment.captured':
            # Acknowledge non-handled events without error
            return jsonify({'status': 'ignored', 'event': event}), 200

        payment_entity   = data['payload']['payment']['entity']
        razorpay_order_id = payment_entity.get('order_id')
        razorpay_payment_id = payment_entity.get('id')

        payment_record = Payment.query.filter_by(
            transaction_id=razorpay_order_id
        ).first()

        if not payment_record:
            current_app.logger.warning(
                f'Webhook: no payment record for order {razorpay_order_id}'
            )
            return jsonify({'status': 'not_found'}), 200

        # Idempotency guard
        if payment_record.status == PaymentStatus.completed:
            return jsonify({'status': 'already_processed'}), 200

        order = Order.query.get(payment_record.order_id)
        if not order:
            return jsonify({'status': 'order_not_found'}), 200

        # ── Atomic stock deduction ────────────────────────────────────────
        for item in order.items:
            affected = (
                Product.query
                .filter(
                    Product.id    == item.product_id,
                    Product.stock >= item.quantity,
                )
                .update({'stock': Product.stock - item.quantity})
            )
            if not affected:
                current_app.logger.error(
                    f'Webhook: stock deduction failed for product {item.product_id}'
                )
                db.session.rollback()
                return jsonify({'error': 'Stock deduction failed'}), 500

        payment_record.status             = PaymentStatus.completed
        payment_record.transaction_id     = razorpay_payment_id or razorpay_order_id
        order.status                      = OrderStatus.processing
        db.session.commit()

        current_app.logger.info(
            f'Webhook: payment captured for order {order.uuid}'
        )
        return jsonify({'status': 'success'}), 200

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f'Webhook error: {e}')
        return jsonify({'error': 'Internal error'}), 500

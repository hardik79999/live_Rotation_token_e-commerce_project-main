"""
POST /api/user/order/<order_uuid>/return   — customer initiates a return
GET  /api/user/order/<order_uuid>/return   — customer checks return status
"""
import traceback
from datetime import datetime, timedelta
from flask import request, jsonify, current_app
from flask_jwt_extended import verify_jwt_in_request, get_jwt
from shop.extensions import db
from shop.models import (
    User, Order, OrderReturn, OrderStatus, ReturnStatus, ReturnReason,
    Payment, PaymentStatus, PaymentMethod,
    WalletTransaction,
    WalletTransactionType,
)
from shop.utils.api_response import error_response
from shop.utils.wallet_service import credit_wallet, debit_wallet, compute_loyalty_credit

RETURN_WINDOW_DAYS = 7

VALID_REASONS = {r.value for r in ReturnReason}


# ─────────────────────────────────────────────────────────────────────────────
# POST — initiate return
# ─────────────────────────────────────────────────────────────────────────────
def request_return_action(order_uuid: str):
    try:
        verify_jwt_in_request()
        user_uuid = get_jwt().get('user_uuid')
        user = User.query.filter_by(uuid=user_uuid, is_active=True).first()
        if not user or user.role.role_name != 'customer':
            return error_response('Unauthorized', 403)

        order = Order.query.filter_by(uuid=order_uuid, user_id=user.id).first()
        if not order:
            return error_response('Order not found', 404)

        # ── Validation 1: must be DELIVERED ──────────────────────────────
        if order.status != OrderStatus.delivered:
            return error_response(
                f'Only delivered orders can be returned. Current status: {order.status.value}', 422
            )

        # ── Validation 2: 7-day return window ────────────────────────────
        # Use delivered_at if set, fall back to created_at for legacy orders
        reference_dt = order.delivered_at or order.created_at
        if not reference_dt:
            return error_response('Delivery date not recorded. Please contact support.', 422)

        deadline = reference_dt + timedelta(days=RETURN_WINDOW_DAYS)
        if datetime.utcnow() > deadline:
            days_ago = (datetime.utcnow() - reference_dt).days
            return error_response(
                f'Return window expired. Orders must be returned within {RETURN_WINDOW_DAYS} days of delivery. '
                f'This order was delivered {days_ago} days ago.',
                403,
            )

        # ── Validation 3: no duplicate active return ──────────────────────
        existing = OrderReturn.query.filter_by(
            order_id=order.id,
        ).filter(
            OrderReturn.status.in_([ReturnStatus.pending, ReturnStatus.approved])
        ).first()
        if existing:
            return error_response(
                f'A return request already exists for this order (status: {existing.status.value}).',
                409,
            )

        # ── Parse request body (multipart/form-data OR JSON) ─────────────
        if request.content_type and 'multipart/form-data' in request.content_type:
            reason_str = (request.form.get('reason') or '').strip().lower()
            comments   = (request.form.get('comments') or '').strip() or None
            image_files = request.files.getlist('images')  # up to 3
        else:
            data       = request.get_json(silent=True) or {}
            reason_str = (data.get('reason') or '').strip().lower()
            comments   = (data.get('comments') or '').strip() or None
            image_files = []

        if reason_str not in VALID_REASONS:
            return error_response(
                f"Invalid reason. Valid options: {', '.join(VALID_REASONS)}", 400
            )

        # ── Save evidence images (max 3) ──────────────────────────────────
        import json
        from shop.utils.file_handler import save_image as _save_image
        saved_urls = []
        for img_file in image_files[:3]:
            if img_file and img_file.filename:
                url = _save_image(img_file, folder_name='returns')
                if url:
                    saved_urls.append(url)

        # ── Create the return record ──────────────────────────────────────
        ret = OrderReturn(
            order_id          = order.id,
            user_id           = user.id,
            reason            = ReturnReason[reason_str],
            customer_comments = comments,
            image_urls        = json.dumps(saved_urls) if saved_urls else None,
            status            = ReturnStatus.pending,
            created_by        = user.id,
        )
        db.session.add(ret)
        db.session.commit()

        current_app.logger.info(
            f'Return requested: order={order.uuid} user={user.uuid} reason={reason_str}'
        )

        return jsonify({
            'success': True,
            'message': 'Return request submitted successfully. We will process it within 2-3 business days.',
            'return': _serialize_return(ret),
        }), 201

    except Exception as e:
        e_name = e.__class__.__name__
        e_str = str(e).lower()
        if 'jwt' in e_name.lower() or 'token' in e_name.lower() or 'auth' in e_name.lower() or 'signature' in e_name.lower() or 'cookie' in e_str or 'token' in e_str:
            return jsonify({'error': str(e)}), 401
        db.session.rollback()
        return error_response("An error occurred. Please try again.", 500)


# ─────────────────────────────────────────────────────────────────────────────
# GET — fetch return status for an order
# ─────────────────────────────────────────────────────────────────────────────
def get_return_status_action(order_uuid: str):
    try:
        verify_jwt_in_request()
        user_uuid = get_jwt().get('user_uuid')
        user = User.query.filter_by(uuid=user_uuid, is_active=True).first()
        if not user:
            return error_response('Unauthorized', 403)

        order = Order.query.filter_by(uuid=order_uuid, user_id=user.id).first()
        if not order:
            return error_response('Order not found', 404)

        ret = (
            OrderReturn.query
            .filter_by(order_id=order.id)
            .order_by(OrderReturn.created_at.desc())
            .first()
        )

        # Also compute whether the return window is still open
        window_open = False
        days_left   = 0
        if order.status == OrderStatus.delivered:
            reference_dt = order.delivered_at or order.created_at
            if reference_dt:
                deadline    = reference_dt + timedelta(days=RETURN_WINDOW_DAYS)
                remaining   = deadline - datetime.utcnow()
                window_open = remaining.total_seconds() > 0
                days_left   = max(0, -(-int(remaining.total_seconds()) // 86400)) if window_open else 0

        return jsonify({
            'success':     True,
            'window_open': window_open,
            'days_left':   days_left,
            'return':      _serialize_return(ret) if ret else None,
        }), 200

    except Exception as e:
        e_name = e.__class__.__name__
        e_str = str(e).lower()
        if 'jwt' in e_name.lower() or 'token' in e_name.lower() or 'auth' in e_name.lower() or 'signature' in e_name.lower() or 'cookie' in e_str or 'token' in e_str:
            return jsonify({'error': str(e)}), 401
        return error_response("An error occurred. Please try again.", 500)


# ─────────────────────────────────────────────────────────────────────────────
# Admin/Seller: approve or reject a return
# POST /api/admin/return/<return_uuid>/action
# ─────────────────────────────────────────────────────────────────────────────
def process_return_action(return_uuid: str):
    """
    Admin approves or rejects a return.
    On approval: refund to wallet (always safe) OR Razorpay if payment was online.
    Also restores inventory and reverses loyalty points.
    """
    try:
        verify_jwt_in_request()
        claims = get_jwt()
        if claims.get('role') not in ('admin', 'seller'):
            return error_response('Unauthorized', 403)

        ret = OrderReturn.query.filter_by(uuid=return_uuid).first()
        if not ret:
            return error_response('Return request not found', 404)

        if ret.status != ReturnStatus.pending:
            return error_response(
                f'Return is already {ret.status.value} and cannot be actioned again.', 409
            )

        data       = request.get_json(silent=True) or {}
        action_str = (data.get('action') or '').strip().lower()   # 'approve' | 'reject'
        admin_notes = (data.get('admin_notes') or '').strip() or None

        if action_str not in ('approve', 'reject'):
            return error_response("'action' must be 'approve' or 'reject'", 400)

        order    = ret.order
        customer = User.query.get(ret.user_id)

        if action_str == 'reject':
            ret.status      = ReturnStatus.rejected
            ret.admin_notes = admin_notes
            db.session.commit()
            return jsonify({
                'success': True,
                'message': 'Return request rejected.',
                'return':  _serialize_return(ret),
            }), 200

        # ── APPROVE: financial reconciliation ─────────────────────────────
        refund_amount  = round(order.total_amount, 2)
        refund_method  = 'wallet'
        rp_refund_id   = None

        payment = order.payment
        is_online = (
            payment is not None
            and payment.payment_method != PaymentMethod.cod
            and payment.status == PaymentStatus.completed
            and payment.transaction_id
            and not payment.transaction_id.startswith('COD-')
        )

        if is_online:
            # Try Razorpay refund first; fall back to wallet on failure
            try:
                from shop.utils.razorpay_service import get_razorpay_client
                client = get_razorpay_client()
                rp_resp = client.payment.refund(
                    payment.transaction_id,
                    {'amount': int(refund_amount * 100), 'speed': 'normal'},
                )
                rp_refund_id  = rp_resp.get('id')
                refund_method = 'razorpay'
                current_app.logger.info(
                    f'Razorpay refund {rp_refund_id} for ₹{refund_amount} on order {order.uuid}'
                )
            except Exception as rp_err:
                current_app.logger.warning(
                    f'Razorpay refund failed ({rp_err}), falling back to wallet for order {order.uuid}'
                )
                refund_method = 'wallet'

        # ── Wallet credit (COD or Razorpay fallback) ──────────────────────
        if refund_method == 'wallet' and customer:
            credit_wallet(
                user        = customer,
                amount      = refund_amount,
                description = f'Refund for returned Order #{order.uuid[:8].upper()}',
                order       = order,
            )

        # ── Reverse loyalty points earned from this order ─────────────────
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
                    current_app.logger.warning(f'Loyalty reversal failed: {lp_err}')

        # ── Restore inventory ─────────────────────────────────────────────
        for item in order.items:
            product = item.product
            if product:
                product.stock += item.quantity
                current_app.logger.info(
                    f'Stock restored: {product.name} +{item.quantity} (return of order {order.uuid})'
                )

        # ── Update return record ──────────────────────────────────────────
        ret.status            = ReturnStatus.refunded
        ret.admin_notes       = admin_notes
        ret.refund_method     = refund_method
        ret.refund_amount     = refund_amount
        ret.razorpay_refund_id = rp_refund_id

        db.session.commit()

        return jsonify({
            'success':       True,
            'message':       f'Return approved. ₹{refund_amount:.2f} refunded via {refund_method}.',
            'refund_method': refund_method,
            'refund_amount': refund_amount,
            'return':        _serialize_return(ret),
        }), 200

    except Exception as e:
        e_name = e.__class__.__name__
        e_str = str(e).lower()
        if 'jwt' in e_name.lower() or 'token' in e_name.lower() or 'auth' in e_name.lower() or 'signature' in e_name.lower() or 'cookie' in e_str or 'token' in e_str:
            return jsonify({'error': str(e)}), 401
        db.session.rollback()
        return error_response("An error occurred. Please try again.", 500)


def _serialize_return(ret: OrderReturn) -> dict:
    import json
    try:
        images = json.loads(ret.image_urls) if ret.image_urls else []
    except Exception:
        images = []
    return {
        'uuid':               ret.uuid,
        'reason':             ret.reason.value,
        'customer_comments':  ret.customer_comments,
        'image_urls':         images,
        'status':             ret.status.value,
        'admin_notes':        ret.admin_notes,
        'refund_method':      ret.refund_method,
        'refund_amount':      ret.refund_amount,
        'razorpay_refund_id': ret.razorpay_refund_id,
        'created_at':         ret.created_at.isoformat() if ret.created_at else None,
        'updated_at':         ret.updated_at.isoformat() if ret.updated_at else None,
    }

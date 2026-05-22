"""
POST /api/user/promo/validate   — validate a code against the user's cart
GET  /api/user/promo/available  — list all active, non-expired coupons
"""
from datetime import datetime
from flask import request, jsonify
from flask_jwt_extended import verify_jwt_in_request, get_jwt

from shop.extensions import db
from shop.models import Coupon, CartItem, Product, User
from shop.utils.api_response import error_response


def validate_promo_action():
    try:
        verify_jwt_in_request()
        user_uuid = get_jwt().get('user_uuid')
        user = User.query.filter_by(uuid=user_uuid, is_active=True).first()
        if not user:
            return error_response('User not found', 404)

        data = request.get_json(silent=True) or {}
        code = (data.get('code') or '').strip().upper()

        if not code:
            return error_response('Promo code is required', 400)

        # ── Look up coupon ────────────────────────────────────────────────
        coupon = Coupon.query.filter_by(code=code, is_active=True).first()
        if not coupon:
            return error_response('Invalid promo code', 404)

        # ── Expiry check ──────────────────────────────────────────────────
        if coupon.expiry_date < datetime.utcnow():
            return error_response('This promo code has expired', 400)

        # ── Max uses check ────────────────────────────────────────────────
        if coupon.max_uses is not None and coupon.current_uses >= coupon.max_uses:
            return error_response('This promo code has reached its usage limit', 400)

        # ── Calculate current cart total ──────────────────────────────────
        cart_items = CartItem.query.filter_by(user_id=user.id, is_active=True).all()
        if not cart_items:
            return error_response('Your cart is empty', 400)

        cart_total = sum(
            float(item.product.price) * item.quantity
            for item in cart_items
            if item.product and item.product.is_active
        )
        cart_total = round(cart_total, 2)

        # ── Minimum cart value check ──────────────────────────────────────
        min_val = float(coupon.min_cart_value or 0)
        if cart_total < min_val:
            return error_response(
                f'Minimum cart value of ₹{min_val:.0f} required for this code', 400
            )

        # ── Calculate discount ────────────────────────────────────────────
        discount_type  = coupon.discount_type or (
            'percentage' if coupon.discount_percentage else 'flat'
        )
        discount_value = float(
            coupon.discount_value
            if coupon.discount_value is not None
            else (coupon.discount_percentage or coupon.discount_flat or 0)
        )

        if discount_type == 'percentage':
            discount_amount = round(cart_total * discount_value / 100, 2)
            # Apply cap if set
            if coupon.max_discount_amount:
                discount_amount = min(discount_amount, float(coupon.max_discount_amount))
        else:
            # flat discount — cannot exceed cart total
            discount_amount = min(round(discount_value, 2), cart_total)

        final_total = round(cart_total - discount_amount, 2)

        return jsonify({
            'success':         True,
            'message':         f'🎉 {code} applied! You saved ₹{discount_amount:.2f}',
            'code':            coupon.code,
            'discount_type':   discount_type,
            'discount_value':  discount_value,
            'discount_amount': discount_amount,
            'original_total':  cart_total,
            'final_total':     final_total,
        }), 200

    except Exception as e:
        e_name = e.__class__.__name__
        e_str = str(e).lower()
        if 'jwt' in e_name.lower() or 'token' in e_name.lower() or 'auth' in e_name.lower() or 'signature' in e_name.lower() or 'cookie' in e_str or 'token' in e_str:
            return jsonify({'error': str(e)}), 401
        return error_response("An error occurred. Please try again.", 500)


def available_promos_action():
    """
    GET /api/user/promo/available
    Returns all active, non-expired coupons so the cart page can display them.
    Sensitive fields (max_uses, current_uses) are omitted.
    """
    try:
        verify_jwt_in_request()
        now = datetime.utcnow()
        coupons = (
            Coupon.query
            .filter(
                Coupon.is_active   == True,
                Coupon.expiry_date >  now,
            )
            .order_by(Coupon.created_at.desc())
            .all()
        )

        result = []
        for c in coupons:
            # Skip exhausted coupons
            if c.max_uses is not None and c.current_uses >= c.max_uses:
                continue

            discount_type  = c.discount_type or ('percentage' if c.discount_percentage else 'flat')
            discount_value = float(
                c.discount_value
                if c.discount_value is not None
                else (c.discount_percentage or c.discount_flat or 0)
            )

            # Human-readable label: "10% OFF" or "₹200 OFF"
            if discount_type == 'percentage':
                label = f'{int(discount_value)}% OFF'
                if c.max_discount_amount:
                    label += f' (up to ₹{int(c.max_discount_amount)})'
            else:
                label = f'₹{int(discount_value)} OFF'

            # Days remaining
            days_left = (c.expiry_date - now).days

            result.append({
                'code':           c.code,
                'discount_type':  discount_type,
                'discount_value': discount_value,
                'label':          label,
                'min_cart_value': float(c.min_cart_value or 0),
                'expiry_date':    c.expiry_date.strftime('%d %b %Y'),
                'days_left':      max(days_left, 0),
            })

        return jsonify({'success': True, 'data': result}), 200

    except Exception as e:
        e_name = e.__class__.__name__
        e_str = str(e).lower()
        if 'jwt' in e_name.lower() or 'token' in e_name.lower() or 'auth' in e_name.lower() or 'signature' in e_name.lower() or 'cookie' in e_str or 'token' in e_str:
            return jsonify({'error': str(e)}), 401
        return error_response("An error occurred. Please try again.", 500)

"""
Seller Coupon Management API

GET    /api/seller/coupons          — list my coupons
POST   /api/seller/coupons          — create a coupon
PUT    /api/seller/coupon/<uuid>    — update a coupon
DELETE /api/seller/coupon/<uuid>    — deactivate (soft-delete) a coupon

Rules:
  - Sellers can only see/edit their own coupons.
  - Code must be unique across ALL coupons (platform-wide).
  - discount_type must be 'percentage' or 'flat'.
  - percentage: 1–100, flat: > 0.
  - expiry_date must be in the future.
"""
from datetime import datetime
from flask import request, jsonify, current_app
from flask_jwt_extended import verify_jwt_in_request, get_jwt

from shop.extensions import db
from shop.models import Coupon, User
from shop.utils.api_response import error_response


def _require_seller():
    verify_jwt_in_request()
    claims = get_jwt()
    if claims.get('role') != 'seller':
        raise PermissionError('Seller access required')
    user = User.query.filter_by(uuid=claims.get('user_uuid'), is_active=True).first()
    if not user:
        raise PermissionError('Seller not found')
    return user


def _serialize(c: Coupon) -> dict:
    now = datetime.utcnow()
    days_left = max((c.expiry_date - now).days, 0) if c.expiry_date else 0
    discount_type  = c.discount_type or ('percentage' if c.discount_percentage else 'flat')
    discount_value = float(
        c.discount_value if c.discount_value is not None
        else (c.discount_percentage or c.discount_flat or 0)
    )
    if discount_type == 'percentage':
        label = f'{int(discount_value)}% OFF'
        if c.max_discount_amount:
            label += f' (up to ₹{int(c.max_discount_amount)})'
    else:
        label = f'₹{int(discount_value)} OFF'

    return {
        'uuid':               c.uuid,
        'code':               c.code,
        'discount_type':      discount_type,
        'discount_value':     discount_value,
        'label':              label,
        'min_cart_value':     float(c.min_cart_value or 0),
        'max_discount_amount':float(c.max_discount_amount) if c.max_discount_amount else None,
        'expiry_date':        c.expiry_date.strftime('%Y-%m-%d') if c.expiry_date else None,
        'expiry_display':     c.expiry_date.strftime(f'{c.expiry_date.day} %b %Y') if c.expiry_date else None,
        'max_uses':           c.max_uses,
        'current_uses':       c.current_uses,
        'is_active':          c.is_active,
        'days_left':          days_left,
        'is_expired':         c.expiry_date < now if c.expiry_date else False,
        'created_at':         c.created_at.strftime(f'{c.created_at.day} %b %Y') if c.created_at else None,
    }


# ── GET /api/seller/coupons ───────────────────────────────────

def list_seller_coupons_action():
    try:
        seller = _require_seller()
        coupons = (
            Coupon.query
            .filter_by(seller_id=seller.id)
            .order_by(Coupon.created_at.desc())
            .all()
        )
        return jsonify({'success': True, 'data': [_serialize(c) for c in coupons]}), 200
    except PermissionError as e:
        return error_response(str(e), 403)
    except Exception as e:
        e_name = e.__class__.__name__
        e_str = str(e).lower()
        if 'jwt' in e_name.lower() or 'token' in e_name.lower() or 'auth' in e_name.lower() or 'signature' in e_name.lower() or 'cookie' in e_str or 'token' in e_str:
            return jsonify({'error': str(e)}), 401
        return error_response("An error occurred. Please try again.", 500)


# ── POST /api/seller/coupons ──────────────────────────────────

def create_seller_coupon_action():
    try:
        seller = _require_seller()
        data = request.get_json(silent=True) or {}

        code           = (data.get('code') or '').strip().upper()
        discount_type  = (data.get('discount_type') or '').strip().lower()
        discount_value = data.get('discount_value')
        min_cart_value = data.get('min_cart_value', 0)
        max_discount   = data.get('max_discount_amount')
        expiry_str     = (data.get('expiry_date') or '').strip()
        max_uses       = data.get('max_uses')

        # ── Validation ────────────────────────────────────────
        if not code or len(code) < 3:
            return error_response('Code must be at least 3 characters', 400)
        if not code.replace('_', '').replace('-', '').isalnum():
            return error_response('Code can only contain letters, numbers, hyphens, underscores', 400)
        if discount_type not in ('percentage', 'flat'):
            return error_response("discount_type must be 'percentage' or 'flat'", 400)
        try:
            discount_value = float(discount_value)
            if discount_value <= 0:
                raise ValueError
            if discount_type == 'percentage' and discount_value > 100:
                return error_response('Percentage discount cannot exceed 100%', 400)
        except (TypeError, ValueError):
            return error_response('discount_value must be a positive number', 400)
        try:
            expiry = datetime.strptime(expiry_str, '%Y-%m-%d')
            if expiry <= datetime.utcnow():
                return error_response('Expiry date must be in the future', 400)
        except ValueError:
            return error_response('expiry_date must be YYYY-MM-DD', 400)

        # Unique code check
        if Coupon.query.filter_by(code=code).first():
            return error_response(f'Code "{code}" is already taken', 409)

        coupon = Coupon(
            code                = code,
            discount_type       = discount_type,
            discount_value      = discount_value,
            min_cart_value      = float(min_cart_value or 0),
            max_discount_amount = float(max_discount) if max_discount else None,
            expiry_date         = expiry,
            max_uses            = int(max_uses) if max_uses else None,
            current_uses        = 0,
            seller_id           = seller.id,
            created_by          = seller.id,
        )
        db.session.add(coupon)
        db.session.commit()

        current_app.logger.info(f'Seller {seller.username} created coupon {code}')
        return jsonify({'success': True, 'message': f'Coupon {code} created!', 'data': _serialize(coupon)}), 201

    except PermissionError as e:
        return error_response(str(e), 403)
    except Exception as e:
        e_name = e.__class__.__name__
        e_str = str(e).lower()
        if 'jwt' in e_name.lower() or 'token' in e_name.lower() or 'auth' in e_name.lower() or 'signature' in e_name.lower() or 'cookie' in e_str or 'token' in e_str:
            return jsonify({'error': str(e)}), 401
        db.session.rollback()
        return error_response("An error occurred. Please try again.", 500)


# ── PUT /api/seller/coupon/<uuid> ─────────────────────────────

def update_seller_coupon_action(coupon_uuid: str):
    try:
        seller = _require_seller()
        coupon = Coupon.query.filter_by(uuid=coupon_uuid, seller_id=seller.id).first()
        if not coupon:
            return error_response('Coupon not found', 404)

        data = request.get_json(silent=True) or {}

        # Only update fields that are provided
        if 'discount_value' in data:
            v = float(data['discount_value'])
            if v <= 0: return error_response('discount_value must be positive', 400)
            if coupon.discount_type == 'percentage' and v > 100:
                return error_response('Percentage cannot exceed 100%', 400)
            coupon.discount_value = v

        if 'min_cart_value' in data:
            coupon.min_cart_value = float(data['min_cart_value'] or 0)

        if 'max_discount_amount' in data:
            coupon.max_discount_amount = float(data['max_discount_amount']) if data['max_discount_amount'] else None

        if 'max_uses' in data:
            coupon.max_uses = int(data['max_uses']) if data['max_uses'] else None

        if 'expiry_date' in data:
            try:
                expiry = datetime.strptime(data['expiry_date'], '%Y-%m-%d')
                if expiry <= datetime.utcnow():
                    return error_response('Expiry date must be in the future', 400)
                coupon.expiry_date = expiry
            except ValueError:
                return error_response('expiry_date must be YYYY-MM-DD', 400)

        if 'is_active' in data:
            coupon.is_active = bool(data['is_active'])

        coupon.updated_by = seller.id
        db.session.commit()
        return jsonify({'success': True, 'message': 'Coupon updated', 'data': _serialize(coupon)}), 200

    except PermissionError as e:
        return error_response(str(e), 403)
    except Exception as e:
        e_name = e.__class__.__name__
        e_str = str(e).lower()
        if 'jwt' in e_name.lower() or 'token' in e_name.lower() or 'auth' in e_name.lower() or 'signature' in e_name.lower() or 'cookie' in e_str or 'token' in e_str:
            return jsonify({'error': str(e)}), 401
        db.session.rollback()
        return error_response("An error occurred. Please try again.", 500)


# ── DELETE /api/seller/coupon/<uuid> ─────────────────────────

def delete_seller_coupon_action(coupon_uuid: str):
    try:
        seller = _require_seller()
        coupon = Coupon.query.filter_by(uuid=coupon_uuid, seller_id=seller.id).first()
        if not coupon:
            return error_response('Coupon not found', 404)

        coupon.is_active  = False
        coupon.updated_by = seller.id
        db.session.commit()
        return jsonify({'success': True, 'message': f'Coupon {coupon.code} deactivated'}), 200

    except PermissionError as e:
        return error_response(str(e), 403)
    except Exception as e:
        e_name = e.__class__.__name__
        e_str = str(e).lower()
        if 'jwt' in e_name.lower() or 'token' in e_name.lower() or 'auth' in e_name.lower() or 'signature' in e_name.lower() or 'cookie' in e_str or 'token' in e_str:
            return jsonify({'error': str(e)}), 401
        db.session.rollback()
        return error_response("An error occurred. Please try again.", 500)

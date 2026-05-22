"""
Cart API — add, view, update (quantity or remove).

All mutations validate stock availability.
Soft-delete pattern: is_active=False means removed from cart.
"""
from flask import jsonify, current_app, request
from flask_jwt_extended import verify_jwt_in_request, get_jwt
from shop.extensions import db
from shop.models import User, Product, CartItem
from shop.utils.api_response import error_response
from shop.utils.validators import validate_uuid


def _get_current_user():
    verify_jwt_in_request()
    user = User.query.filter_by(uuid=get_jwt().get('user_uuid'), is_active=True).first()
    if not user:
        raise PermissionError('User not found')
    return user


def add_to_cart_action():
    try:
        user = _get_current_user()

        if user.role.role_name != 'customer':
            return error_response('Only customers can use the cart', 403)

        data         = request.get_json(silent=True) or {}
        product_uuid = (data.get('product_uuid') or '').strip()
        qty_raw      = data.get('quantity', 1)

        if not product_uuid or not validate_uuid(product_uuid):
            return error_response('Valid product_uuid is required', 400)

        try:
            qty = int(qty_raw)
            if qty < 1:
                raise ValueError
        except (TypeError, ValueError):
            return error_response('Quantity must be a positive integer', 400)

        product = Product.query.filter_by(uuid=product_uuid, is_active=True).first()
        if not product:
            return error_response('Product not found', 404)

        if product.stock < qty:
            return error_response(
                f'Only {product.stock} unit(s) available in stock', 400
            )

        existing = CartItem.query.filter_by(
            user_id=user.id, product_id=product.id, is_active=True
        ).first()

        if existing:
            new_qty = existing.quantity + qty
            if new_qty > product.stock:
                return error_response(
                    f'Cannot add more. Only {product.stock} unit(s) available.', 400
                )
            existing.quantity = new_qty
            # User is active again — reset the recovery flag so they can
            # receive a future abandoned-cart email if they abandon again.
            existing.recovery_email_sent = False
        else:
            db.session.add(CartItem(
                user_id    = user.id,
                product_id = product.id,
                quantity   = qty,
                created_by = user.id,
            ))

        db.session.commit()
        return jsonify({'success': True, 'message': 'Item added to cart'}), 200

    except PermissionError as e:
        return error_response(str(e), 401)
    except Exception as e:
        e_name = e.__class__.__name__
        e_str = str(e).lower()
        if 'jwt' in e_name.lower() or 'token' in e_name.lower() or 'auth' in e_name.lower() or 'signature' in e_name.lower() or 'cookie' in e_str or 'token' in e_str:
            return jsonify({'error': str(e)}), 401
        db.session.rollback()
        current_app.logger.error(f'Add to cart error: {e}')
        return error_response('Failed to add item to cart', 500)


def get_cart_action():
    try:
        user = _get_current_user()

        cart_items = CartItem.query.filter_by(user_id=user.id, is_active=True).all()

        total_bill = 0.0
        items_list = []

        for item in cart_items:
            product = item.product
            if not product or not product.is_active:
                # Product was deleted/deactivated — silently skip
                continue

            item_total  = float(product.price) * item.quantity
            total_bill += item_total

            primary_img = next(
                (img.image_url for img in product.images if img.is_primary and img.is_active),
                next((img.image_url for img in product.images if img.is_active), None),
            )

            items_list.append({
                'cart_item_id': item.id,
                'product_uuid': product.uuid,
                'product_name': product.name,
                'price':        float(product.price),
                'quantity':     item.quantity,
                'subtotal':     round(item_total, 2),
                'stock':        product.stock,
                'image':        primary_img,
            })

        return jsonify({
            'success':      True,
            'total_amount': round(total_bill, 2),
            'data':         items_list,
        }), 200

    except PermissionError as e:
        return error_response(str(e), 401)
    except Exception as e:
        e_name = e.__class__.__name__
        e_str = str(e).lower()
        if 'jwt' in e_name.lower() or 'token' in e_name.lower() or 'auth' in e_name.lower() or 'signature' in e_name.lower() or 'cookie' in e_str or 'token' in e_str:
            return jsonify({'error': str(e)}), 401
        current_app.logger.error(f'Get cart error: {e}')
        return error_response('Failed to fetch cart', 500)


def update_cart_item_action():
    try:
        user = _get_current_user()

        data         = request.get_json(silent=True) or {}
        product_uuid = (data.get('product_uuid') or '').strip()
        qty_raw      = data.get('quantity', 0)

        if not product_uuid or not validate_uuid(product_uuid):
            return error_response('Valid product_uuid is required', 400)

        try:
            new_qty = int(qty_raw)
            if new_qty < 0:
                # Treat any negative value as "remove" — no silent probing
                new_qty = 0
        except (TypeError, ValueError):
            return error_response('Quantity must be an integer', 400)

        product = Product.query.filter_by(uuid=product_uuid).first()
        if not product:
            return error_response('Product not found', 404)

        cart_item = CartItem.query.filter_by(
            user_id=user.id, product_id=product.id, is_active=True
        ).first()
        if not cart_item:
            return error_response('Item not in cart', 404)

        if new_qty <= 0:
            cart_item.is_active = False
            msg = 'Item removed from cart'
        else:
            if new_qty > product.stock:
                return error_response(
                    f'Only {product.stock} unit(s) available in stock', 400
                )
            cart_item.quantity = new_qty
            msg = 'Cart updated'

        db.session.commit()
        return jsonify({'success': True, 'message': msg}), 200

    except PermissionError as e:
        return error_response(str(e), 401)
    except Exception as e:
        e_name = e.__class__.__name__
        e_str = str(e).lower()
        if 'jwt' in e_name.lower() or 'token' in e_name.lower() or 'auth' in e_name.lower() or 'signature' in e_name.lower() or 'cookie' in e_str or 'token' in e_str:
            return jsonify({'error': str(e)}), 401
        db.session.rollback()
        current_app.logger.error(f'Update cart error: {e}')
        return error_response('Failed to update cart', 500)

"""
POST /api/user/checkout

Atomic checkout with row-level locking to prevent overselling.
COD: deducts stock immediately.
Online: creates Razorpay order, stock deducted only after payment verification.
Supports optional coupon_code for discounts.
"""
import uuid as uuid_lib
from datetime import datetime
from flask import request, jsonify, current_app
from flask_jwt_extended import verify_jwt_in_request, get_jwt
from shop.extensions import db
from shop.models import (
    User, Order, Payment, Address, PaymentMethod,
    OrderStatus, CartItem, OrderItem, PaymentStatus, Product, Coupon,
    Specification,
)
from shop.utils.api_response import error_response
from shop.utils.razorpay_service import get_razorpay_client
from shop.utils.validators import validate_uuid
from shop.utils.wallet_service import debit_wallet


def _apply_coupon(code: str, cart_total: float) -> tuple[float, str | None]:
    """
    Validate and apply a coupon code.
    Returns (discount_amount, error_message).
    error_message is None on success.
    Does NOT commit — caller commits after order creation.
    """
    coupon = Coupon.query.filter_by(code=code.upper(), is_active=True).first()
    if not coupon:
        return 0.0, 'Invalid promo code'
    if coupon.expiry_date < datetime.utcnow():
        return 0.0, 'Promo code has expired'
    if coupon.max_uses is not None and coupon.current_uses >= coupon.max_uses:
        return 0.0, 'Promo code has reached its usage limit'
    min_val = float(coupon.min_cart_value or 0)
    if cart_total < min_val:
        return 0.0, f'Minimum cart value of ₹{min_val:.0f} required'

    discount_type  = coupon.discount_type or ('percentage' if coupon.discount_percentage else 'flat')
    discount_value = float(
        coupon.discount_value
        if coupon.discount_value is not None
        else (coupon.discount_percentage or coupon.discount_flat or 0)
    )

    if discount_type == 'percentage':
        discount = round(cart_total * discount_value / 100, 2)
        if coupon.max_discount_amount:
            discount = min(discount, float(coupon.max_discount_amount))
    else:
        discount = min(round(discount_value, 2), cart_total)

    # Increment usage counter (caller must commit)
    coupon.current_uses += 1
    return discount, None


def checkout_action():
    try:
        verify_jwt_in_request()
        user_uuid = get_jwt().get('user_uuid')
        user = User.query.filter_by(uuid=user_uuid, is_active=True).first()
        if not user:
            return error_response('User not found or blocked', 403)

        if user.role.role_name != 'customer':
            return error_response('Only customers can place orders', 403)

        data         = request.get_json(silent=True) or {}
        method_str   = (data.get('payment_method') or 'cod').lower().strip()
        address_uuid = (data.get('address_uuid')   or '').strip()
        coupon_code  = (data.get('coupon_code')    or '').strip().upper() or None
        use_wallet   = bool(data.get('use_wallet', False))

        if not address_uuid or not validate_uuid(address_uuid):
            return error_response('Valid address_uuid is required', 400)

        try:
            selected_method = PaymentMethod[method_str]
        except KeyError:
            return error_response(
                f"Invalid payment method. Use: {', '.join(m.name for m in PaymentMethod)}", 400
            )

        delivery_address = Address.query.filter_by(
            uuid=address_uuid, user_id=user.id, is_active=True
        ).first()
        if not delivery_address:
            return error_response('Delivery address not found', 404)

        cart_items = CartItem.query.filter_by(user_id=user.id, is_active=True).all()
        if not cart_items:
            return error_response('Your cart is empty', 400)

        total_amount      = 0.0
        order_items_data  = []

        # ── Atomic stock validation with row-level locks ──────────────────
        for item in cart_items:
            product = (
                Product.query
                .with_for_update()
                .filter_by(id=item.product_id, is_active=True)
                .first()
            )
            if not product:
                return error_response('One or more products are no longer available', 400)
            if product.stock < item.quantity:
                return error_response(
                    f'"{product.name}" has only {product.stock} unit(s) left in stock', 400
                )
            total_amount += item.quantity * float(product.price)
            order_items_data.append({
                'product':  product,
                'quantity': item.quantity,
                'price':    float(product.price),
            })

        # ── Apply coupon discount ─────────────────────────────────────────
        discount_amount = 0.0
        if coupon_code:
            discount_amount, coupon_error = _apply_coupon(coupon_code, total_amount)
            if coupon_error:
                return error_response(coupon_error, 400)

        # ── RULE 3: Apply wallet balance ──────────────────────────────────
        wallet_deduction = 0.0
        after_coupon     = round(total_amount - discount_amount, 2)
        if use_wallet and user.wallet_balance > 0:
            wallet_deduction = min(round(user.wallet_balance, 2), after_coupon)

        final_amount = round(after_coupon - wallet_deduction, 2)

        # ── Create order ──────────────────────────────────────────────────
        new_order = Order(
            user_id         = user.id,
            address_id      = delivery_address.id,
            payment_method  = selected_method,
            total_amount    = final_amount,
            status          = OrderStatus.pending,
            uuid            = str(uuid_lib.uuid4()),
            created_by      = user.id,
            coupon_code     = coupon_code,
            discount_amount = round(discount_amount, 2),
            wallet_used     = round(wallet_deduction, 2),
        )
        db.session.add(new_order)
        db.session.flush()

        for od in order_items_data:
            db.session.add(OrderItem(
                order_id          = new_order.id,
                product_id        = od['product'].id,
                quantity          = od['quantity'],
                price_at_purchase = od['price'],
                created_by        = user.id,
            ))

        # ── Deduct wallet balance (ACID: same transaction as order) ───────
        if wallet_deduction > 0:
            debit_wallet(
                user        = user,
                amount      = wallet_deduction,
                description = f'Used in Order #{new_order.uuid[:8].upper()}',
                order       = new_order,
            )

        # ── COD: deduct stock now ─────────────────────────────────────────
        if selected_method == PaymentMethod.cod:
            for od in order_items_data:
                affected = (
                    Product.query
                    .filter(
                        Product.id    == od['product'].id,
                        Product.stock >= od['quantity'],
                    )
                    .update({'stock': Product.stock - od['quantity']})
                )
                if not affected:
                    db.session.rollback()
                    return error_response('Inventory sync error. Please try again.', 500)

            new_order.status = OrderStatus.processing
            db.session.add(Payment(
                order_id       = new_order.id,
                user_id        = user.id,
                payment_method = PaymentMethod.cod,
                amount         = final_amount,
                status         = PaymentStatus.pending,
                transaction_id = f'COD-{new_order.uuid[:8].upper()}',
                created_by     = user.id,
            ))
            CartItem.query.filter_by(user_id=user.id, is_active=True).update({'is_active': False})
            db.session.commit()

            # Stock changed — invalidate product list cache
            from shop.utils.cache_utils import invalidate_product_catalog
            invalidate_product_catalog()

            # ── Send order confirmation email to customer ─────────────────
            try:
                from shop.utils.email_service import (
                    send_order_confirmation_email,
                    send_new_order_seller_alert,
                )
                from datetime import datetime as _dt

                address_obj = Address.query.get(delivery_address.id)
                shipping_addr_str = (
                    f"{address_obj.full_name}, {address_obj.street}, "
                    f"{address_obj.city}, {address_obj.state} - {address_obj.pincode}"
                    if address_obj else "N/A"
                )

                # Build items list with images + specs for the email
                email_items = []
                for od in order_items_data:
                    prod = od['product']
                    primary_img = next(
                        (img.image_url for img in prod.images if img.is_primary and img.is_active),
                        next((img.image_url for img in prod.images if img.is_active), None)
                    )
                    specs = [
                        {'key': s.spec_key, 'value': s.spec_value}
                        for s in Specification.query.filter_by(product_id=prod.id, is_active=True).limit(3).all()
                    ]
                    email_items.append({
                        'name':      prod.name,
                        'qty':       od['quantity'],
                        'price':     od['price'],
                        'subtotal':  round(od['price'] * od['quantity'], 2),
                        'image_url': primary_img,
                        'specs':     specs,
                    })

                subtotal     = round(sum(i['subtotal'] for i in email_items), 2)
                tax          = round(subtotal * 0.18, 2)
                shipping_fee = 0.0 if subtotal >= 499 else 49.0
                order_date   = _dt.utcnow().strftime('%d %b %Y')

                send_order_confirmation_email(
                    user_email       = user.email,
                    customer_name    = user.username,
                    order_uuid       = new_order.uuid,
                    order_date       = order_date,
                    payment_method   = 'COD',
                    items            = email_items,
                    subtotal         = subtotal,
                    tax              = tax,
                    shipping_fee     = shipping_fee,
                    grand_total      = final_amount,
                    shipping_address = shipping_addr_str,
                )

                # ── Notify each unique seller ─────────────────────────────
                from collections import defaultdict
                seller_items_map: dict = defaultdict(list)
                for od in order_items_data:
                    prod   = od['product']
                    seller = User.query.get(prod.seller_id)
                    if seller:
                        seller_items_map[seller].append({
                            'name':    prod.name,
                            'qty':     od['quantity'],
                            'price':   od['price'],
                            'subtotal': round(od['price'] * od['quantity'], 2),
                        })

                for seller, s_items in seller_items_map.items():
                    seller_total = round(sum(i['subtotal'] for i in s_items), 2)
                    send_new_order_seller_alert(
                        seller_email     = seller.email,
                        seller_name      = seller.username,
                        order_uuid       = new_order.uuid,
                        order_date       = order_date,
                        customer_name    = user.username,
                        items            = s_items,
                        seller_total     = seller_total,
                        shipping_address = shipping_addr_str,
                    )
            except Exception as email_err:
                current_app.logger.warning(f'Order confirmation email failed: {email_err}')

            return jsonify({
                'success':        True,
                'message':        'Order placed successfully',
                'order_uuid':     new_order.uuid,
                'wallet_used':    round(wallet_deduction, 2),
                'wallet_balance': round(user.wallet_balance, 2),
            }), 201

        # ── Online payment: create Razorpay order ─────────────────────────
        try:
            client = get_razorpay_client()
            rp_order = client.order.create({
                'amount':   int(final_amount * 100),
                'currency': 'INR',
                'receipt':  new_order.uuid,
            })
        except Exception as rp_err:
            db.session.rollback()
            current_app.logger.error(f'Razorpay order creation failed: {rp_err}')
            return error_response('Payment gateway error. Please try again.', 502)

        db.session.add(Payment(
            order_id       = new_order.id,
            user_id        = user.id,
            payment_method = selected_method,
            amount         = final_amount,
            status         = PaymentStatus.pending,
            transaction_id = rp_order['id'],
            created_by     = user.id,
        ))
        db.session.commit()

        return jsonify({
            'success': True,
            'data': {
                'razorpay_order_id': rp_order['id'],
                'amount':            final_amount,
                'order_uuid':        new_order.uuid,
            },
            'wallet_used':    round(wallet_deduction, 2),
            'wallet_balance': round(user.wallet_balance, 2),
        }), 201

    except Exception as e:
        e_name = e.__class__.__name__
        e_str = str(e).lower()
        if 'jwt' in e_name.lower() or 'token' in e_name.lower() or 'auth' in e_name.lower() or 'signature' in e_name.lower() or 'cookie' in e_str or 'token' in e_str:
            return jsonify({'error': str(e)}), 401
        db.session.rollback()
        current_app.logger.error(f'Checkout error: {e}')
        return error_response('Checkout failed. Please try again.', 500)

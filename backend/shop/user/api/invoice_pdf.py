"""
GET /api/user/order/<uuid>/invoice/download

Generates a professional PDF invoice in-memory using xhtml2pdf and
returns it as a downloadable file attachment.

Security:
  - JWT required (customer must own the order)
  - Seller can also download via GET /api/seller/order/<uuid>/invoice/download
    (handled by a separate thin wrapper that calls the same core function)
"""
import io
from flask import jsonify, make_response, current_app, render_template
from flask_jwt_extended import verify_jwt_in_request, get_jwt
from xhtml2pdf import pisa

from shop.models import Order, Payment, User, Address, Invoice, OrderItem, Product
from shop.extensions import db
from shop.utils.api_response import error_response


# ─────────────────────────────────────────────────────────────────────────────
# Core PDF builder — shared by customer + seller endpoints
# ─────────────────────────────────────────────────────────────────────────────

def _build_invoice_context(order: Order, user: User) -> dict:
    """Assemble the template context dict from an Order ORM object."""
    payment = Payment.query.filter_by(order_id=order.id).first()
    address = Address.query.get(order.address_id)
    address_str = (
        f"{address.full_name}, {address.street}, {address.city}, "
        f"{address.state} - {address.pincode}  |  Ph: {address.phone_number}"
        if address else "N/A"
    )

    # Ensure invoice record exists (idempotent)
    db_invoice = Invoice.query.filter_by(order_id=order.id).first()
    if not db_invoice:
        inv_number = f"INV-{order.id}-{order.created_at.strftime('%Y%m%d')}"
        db_invoice = Invoice(
            order_id       = order.id,
            invoice_number = inv_number,
            created_by     = user.id,
        )
        db.session.add(db_invoice)
        db.session.commit()

    total_amount = float(order.total_amount)
    # Items subtotal = sum of (price_at_purchase × qty) — this is the true
    # pre-tax base. GST 18% is calculated on top of this, so:
    #   items_subtotal  = sum of line items
    #   tax_amount      = items_subtotal × 0.18
    #   grand_total     = items_subtotal + tax_amount + shipping_fee
    # We do NOT back-calculate from total_amount to avoid rounding drift.

    # Build items list first so we can derive the correct subtotal
    items = []
    for oi in order.items:
        p = oi.product
        items.append({
            'name':     p.name if p else 'Product',
            'qty':      oi.quantity,
            'price':    float(oi.price_at_purchase),
            'subtotal': round(float(oi.price_at_purchase) * oi.quantity, 2),
        })

    items_subtotal = round(sum(i['subtotal'] for i in items), 2)
    # GST is included in the price — extract it (price = base × 1.18)
    base_price   = round(items_subtotal / 1.18, 2)
    tax_amount   = round(items_subtotal - base_price, 2)
    shipping_fee = 0.0
    grand_total  = round(items_subtotal + shipping_fee, 2)

    return {
        'invoice_number':   db_invoice.invoice_number,
        'invoice_date':     order.created_at.strftime(f"{order.created_at.day} %b %Y"),
        'order_uuid':       order.uuid,
        'order_status':     order.status.name.upper() if hasattr(order.status, 'name') else str(order.status),
        'customer_name':    user.username,
        'customer_email':   user.email,
        'customer_phone':   user.phone or 'N/A',
        'shipping_address': address_str,
        'payment_method':   (
            payment.payment_method.name.upper()
            if payment and hasattr(payment.payment_method, 'name')
            else 'N/A'
        ),
        'payment_status':   (
            payment.status.name.upper()
            if payment and hasattr(payment.status, 'name')
            else 'PENDING'
        ),
        'transaction_id':   (payment.transaction_id if payment else 'N/A'),
        'items':            items,
        'base_amount':      base_price,
        'tax_amount':       tax_amount,
        'shipping_fee':     shipping_fee,
        'grand_total':      grand_total,
        'company_name':     current_app.config.get('COMPANY_NAME', 'ShopHub Pvt. Ltd.'),
        'support_email':    current_app.config.get('SUPPORT_EMAIL', 'support@shophub.in'),
        'gstin':            current_app.config.get('COMPANY_GSTIN', '22AAAAA0000A1Z5'),
    }


def _render_pdf(context: dict) -> bytes:
    """Render the invoice HTML template and convert to PDF bytes."""
    html_string = render_template('invoice/invoice_pdf.html', **context)
    pdf_buffer  = io.BytesIO()
    pisa_status = pisa.CreatePDF(
        src=html_string,
        dest=pdf_buffer,
        encoding='utf-8',
    )
    if pisa_status.err:
        raise RuntimeError(f'PDF generation failed: {pisa_status.err}')
    return pdf_buffer.getvalue()


# ─────────────────────────────────────────────────────────────────────────────
# Customer endpoint
# ─────────────────────────────────────────────────────────────────────────────

def download_invoice_action(order_uuid: str):
    """GET /api/user/order/<uuid>/invoice/download — customer only."""
    try:
        verify_jwt_in_request()
        claims    = get_jwt()
        user_uuid = claims.get('user_uuid')

        user = User.query.filter_by(uuid=user_uuid, is_active=True).first()
        if not user:
            return error_response('User not found', 404)

        order = Order.query.filter_by(uuid=order_uuid, user_id=user.id).first()
        if not order:
            return error_response('Order not found or unauthorized', 404)

        context  = _build_invoice_context(order, user)
        pdf_data = _render_pdf(context)

        filename = f"ShopHub-Invoice-{context['invoice_number']}.pdf"
        response = make_response(pdf_data)
        response.headers['Content-Type']        = 'application/pdf'
        response.headers['Content-Disposition'] = f'attachment; filename="{filename}"'
        response.headers['Content-Length']      = len(pdf_data)
        return response

    except Exception as e:
        e_name = e.__class__.__name__
        e_str = str(e).lower()
        if 'jwt' in e_name.lower() or 'token' in e_name.lower() or 'auth' in e_name.lower() or 'signature' in e_name.lower() or 'cookie' in e_str or 'token' in e_str:
            return jsonify({'error': str(e)}), 401
        current_app.logger.error(f'Invoice PDF error: {e}')
        return error_response('Failed to generate invoice PDF', 500)


# ─────────────────────────────────────────────────────────────────────────────
# Seller endpoint (thin wrapper — verifies seller owns the order)
# ─────────────────────────────────────────────────────────────────────────────

def seller_download_invoice_action(order_uuid: str):
    """GET /api/seller/order/<uuid>/invoice/download — seller only."""
    try:
        verify_jwt_in_request()
        claims    = get_jwt()
        user_uuid = claims.get('user_uuid')
        role      = claims.get('role')

        if role != 'seller':
            return error_response('Seller access required', 403)

        seller = User.query.filter_by(uuid=user_uuid, is_active=True).first()
        if not seller:
            return error_response('Seller not found', 404)

        # Verify the order contains at least one product from this seller
        order = Order.query.filter_by(uuid=order_uuid).first()
        if not order:
            return error_response('Order not found', 404)

        seller_item = (
            db.session.query(OrderItem)
            .join(Product, Product.id == OrderItem.product_id)
            .filter(
                OrderItem.order_id == order.id,
                Product.seller_id  == seller.id,
            )
            .first()
        )
        if not seller_item:
            return error_response('Order not found or unauthorized', 403)

        # Use the customer (order owner) for the invoice "Bill To" section
        customer = User.query.get(order.user_id)
        if not customer:
            return error_response('Customer not found', 404)

        context  = _build_invoice_context(order, customer)
        pdf_data = _render_pdf(context)

        filename = f"ShopHub-Invoice-{context['invoice_number']}.pdf"
        response = make_response(pdf_data)
        response.headers['Content-Type']        = 'application/pdf'
        response.headers['Content-Disposition'] = f'attachment; filename="{filename}"'
        response.headers['Content-Length']      = len(pdf_data)
        return response

    except Exception as e:
        e_name = e.__class__.__name__
        e_str = str(e).lower()
        if 'jwt' in e_name.lower() or 'token' in e_name.lower() or 'auth' in e_name.lower() or 'signature' in e_name.lower() or 'cookie' in e_str or 'token' in e_str:
            return jsonify({'error': str(e)}), 401
        current_app.logger.error(f'Seller invoice PDF error: {e}')
        return error_response('Failed to generate invoice PDF', 500)

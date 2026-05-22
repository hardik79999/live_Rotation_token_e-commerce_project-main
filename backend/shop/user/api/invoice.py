import uuid
from flask import jsonify, current_app
from flask_jwt_extended import verify_jwt_in_request, get_jwt
from shop.extensions import db
from shop.models import Order, Payment, User, Address, Invoice # 🔥 Invoice model add kiya
from shop.utils.api_response import error_response

def generate_invoice_action(order_uuid):
    try:
        verify_jwt_in_request()
        user_uuid = get_jwt().get("user_uuid")
        user = User.query.filter_by(uuid=user_uuid).first()

        order = Order.query.filter_by(uuid=order_uuid, user_id=user.id).first()
        if not order:
            return error_response("Order not found or unauthorized", 404)

        payment = Payment.query.filter_by(order_id=order.id).first()
        address = Address.query.get(order.address_id)
        address_str = f"{address.street}, {address.city}, {address.state} - {address.pincode}" if address else "N/A"

        # 1. 🔥 CHECK: Kya database me pehle se invoice bana hua hai?
        db_invoice = Invoice.query.filter_by(order_id=order.id).first()
        
        if not db_invoice:
            # Agar nahi hai, toh naya Invoice number generate karo aur DB me save karo
            inv_number = f"INV-{order.id}-{order.created_at.strftime('%Y%m%d')}"
            db_invoice = Invoice(
                order_id=order.id,
                invoice_number=inv_number,
                created_by=user.id
            )
            db.session.add(db_invoice)
            db.session.commit()
            current_app.logger.info(f'Invoice {inv_number} created for order {order_uuid}')
        else:
            inv_number = db_invoice.invoice_number

        # 2. Tax Calculations
        total_amount = float(order.total_amount)
        base_price = round(total_amount / 1.18, 2)
        tax_amount = round(total_amount - base_price, 2)

        # 3. Final JSON Response
        invoice_data = {
            "invoice_id": inv_number, # 🔥 Database wala number use kiya
            "date": order.created_at.strftime('%Y-%m-%d %H:%M:%S'),
            "status": order.status.name.upper() if hasattr(order.status, 'name') else str(order.status),
            "customer_details": {
                "name": user.username,
                "email": user.email,
                "phone": user.phone or "N/A",
                "shipping_address": address_str
            },
            "payment_details": {
                "method": payment.payment_method.name.upper() if payment and hasattr(payment.payment_method, 'name') else str(payment.payment_method) if payment else "N/A",
                "transaction_id": payment.transaction_id if payment else "Pending",
                "payment_status": payment.status.name.upper() if payment and hasattr(payment.status, 'name') else str(payment.status) if payment else "Pending"
            },
            "order_summary": {
                "base_amount": base_price,
                "tax_gst_18": tax_amount,
                "shipping_fee": 0.00,
                "grand_total": total_amount
            },
            "company_info": {
                "name": "Hardik E-Commerce Pvt. Ltd.",
                "support_email": "support@hardikstore.com",
                "gstin": "22AAAAA0000A1Z5"
            }
        }

        return jsonify({
            "success": True,
            "message": "Invoice fetched successfully",
            "invoice": invoice_data
        }), 200

    except Exception as e:
        e_name = e.__class__.__name__
        e_str = str(e).lower()
        if 'jwt' in e_name.lower() or 'token' in e_name.lower() or 'auth' in e_name.lower() or 'signature' in e_name.lower() or 'cookie' in e_str or 'token' in e_str:
            return jsonify({'error': str(e)}), 401
        db.session.rollback()
        current_app.logger.error(f'Invoice generation error: {e}', exc_info=True)
        return error_response('Failed to process invoice. Please try again.', 500)
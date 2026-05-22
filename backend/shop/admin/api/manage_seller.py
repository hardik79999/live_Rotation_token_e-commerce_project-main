from flask import jsonify, current_app
from flask_jwt_extended import verify_jwt_in_request, get_jwt
from shop.extensions import db
from shop.models import User, Role
from shop.utils.api_response import error_response, success_response
from shop.utils.email_service import send_seller_status_email


def list_sellers_action():
    """Return all seller accounts for the admin panel."""
    try:
        verify_jwt_in_request()
        if get_jwt().get("role") != "admin":
            return error_response("Admin access required", 403)

        seller_role = Role.query.filter_by(role_name="seller").first()
        if not seller_role:
            return success_response(message="No sellers found", data=[], status_code=200)

        sellers = User.query.filter_by(role_id=seller_role.id).order_by(User.created_at.desc()).all()
        result = [
            {
                "uuid": s.uuid,
                "username": s.username,
                "email": s.email,
                "phone": s.phone,
                "is_active": s.is_active,
                "created_at": s.created_at.isoformat() if s.created_at else None,
            }
            for s in sellers
        ]
        return success_response(message="Sellers fetched", data=result, status_code=200)

    except Exception as e:
        e_name = e.__class__.__name__
        e_str = str(e).lower()
        if 'jwt' in e_name.lower() or 'token' in e_name.lower() or 'auth' in e_name.lower() or 'signature' in e_name.lower() or 'cookie' in e_str or 'token' in e_str:
            return jsonify({'error': str(e)}), 401
        return error_response(str(e), 500)


def toggle_seller_status_action(seller_uuid):
    try:
        verify_jwt_in_request()
        if get_jwt().get("role") != "admin":
            return error_response("Admin access required", 403)

        seller = User.query.filter_by(uuid=seller_uuid).first()
        if not seller or seller.role.role_name != "seller":
            return error_response("Seller not found", 404)

        # Toggle Status
        seller.is_active = not seller.is_active
        db.session.commit()

        status_msg = "Activated" if seller.is_active else "Blocked"
        current_app.logger.info(f"Seller {seller.email} {status_msg} by Admin.")

        # ── Notify the seller ─────────────────────────────────────────────
        try:
            send_seller_status_email(
                seller_email = seller.email,
                seller_name  = seller.username,
                is_active    = seller.is_active,
            )
        except Exception as email_err:
            current_app.logger.warning(f"Seller status email failed: {email_err}")

        return jsonify({"success": True, "message": f"Seller account has been {status_msg}."}), 200

    except Exception as e:
        e_name = e.__class__.__name__
        e_str = str(e).lower()
        if 'jwt' in e_name.lower() or 'token' in e_name.lower() or 'auth' in e_name.lower() or 'signature' in e_name.lower() or 'cookie' in e_str or 'token' in e_str:
            return jsonify({'error': str(e)}), 401
        db.session.rollback()
        return error_response(str(e), 500)

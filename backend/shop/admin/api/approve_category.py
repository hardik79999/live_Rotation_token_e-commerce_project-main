from flask import jsonify, request, current_app
from flask_jwt_extended import verify_jwt_in_request, get_jwt
from shop.extensions import db
from shop.models import SellerCategory, User, Category
from shop.utils.api_response import error_response, success_response
from shop.utils.email_service import send_category_decision_email


def approve_category_action(seller_category_uuid):
    """
    Handle three admin actions on a seller-category request:
      approve — grant the seller permission to list in this category
      reject  — deny a pending request (sets is_active=False)
      revoke  — remove an already-approved permission (products hidden immediately)
    """
    try:
        verify_jwt_in_request()
        claims = get_jwt()

        if claims.get("role") != "admin":
            return error_response("Unauthorized!", 403)

        payload = request.get_json() or {}
        action  = (payload.get("action") or "").strip().lower()

        if action not in {"approve", "reject", "revoke"}:
            return error_response(
                "Action must be 'approve', 'reject', or 'revoke'", 400
            )

        # For revoke we need to find the record even if is_active=False
        request_obj = SellerCategory.query.filter_by(
            uuid=seller_category_uuid
        ).first()

        if not request_obj:
            return error_response("Seller Category request not found", 404)

        admin_uuid = claims.get("user_uuid")
        admin_user = User.query.filter_by(uuid=admin_uuid).first()
        if not admin_user:
            return error_response("Admin user not found", 404)

        if action == "approve":
            request_obj.is_approved = True
            request_obj.is_active   = True   # re-activate if it was rejected before
            message = "Seller category approved. Seller can now list products in this category."

        elif action == "reject":
            # Reject a pending (not yet approved) request
            if request_obj.is_approved:
                return error_response(
                    "This request is already approved. Use 'revoke' to remove permission.", 400
                )
            request_obj.is_active = False
            message = "Seller category request rejected."

        else:  # revoke
            # Remove an already-approved permission.
            # Products in this category become invisible immediately because
            # browse.py now JOINs on SellerCategory.is_approved=True.
            request_obj.is_approved = False
            request_obj.is_active   = False
            message = (
                "Seller category permission revoked. "
                "All products in this category are now hidden from the storefront."
            )

        request_obj.updated_by = admin_user.id
        db.session.commit()

        # ── Notify the seller by email ────────────────────────────────────
        seller = User.query.get(request_obj.seller_id)
        if seller:
            # Fetch category name for the email
            cat = Category.query.get(request_obj.category_id)
            cat_name = cat.name if cat else "Unknown Category"
            try:
                send_category_decision_email(
                    seller_email  = seller.email,
                    seller_name   = seller.username,
                    category_name = cat_name,
                    action        = action,
                )
            except Exception as email_err:
                current_app.logger.warning(f"Category decision email failed: {email_err}")

        return success_response(
            message=message,
            data={"request_uuid": request_obj.uuid, "action": action},
            status_code=200,
        )

    except Exception as e:
        e_name = e.__class__.__name__
        e_str = str(e).lower()
        if 'jwt' in e_name.lower() or 'token' in e_name.lower() or 'auth' in e_name.lower() or 'signature' in e_name.lower() or 'cookie' in e_str or 'token' in e_str:
            return jsonify({'error': str(e)}), 401
        db.session.rollback()
        current_app.logger.error(f"Approve category error: {e}")
        return error_response(str(e), 500)

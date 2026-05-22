from flask import jsonify
from flask_jwt_extended import verify_jwt_in_request, get_jwt
from shop.extensions import db
from shop.models import Product, User
from shop.utils.api_response import error_response, success_response

def delete_product_action(product_uuid):
    try:
        verify_jwt_in_request()
        seller = User.query.filter_by(uuid=get_jwt().get("user_uuid")).first()

        product = Product.query.filter_by(uuid=product_uuid, seller_id=seller.id, is_active=True).first()
        if not product: return error_response('Product not found', 404)

        product.is_active = False
        product.updated_by = seller.id
        for img in product.images: img.is_active, img.updated_by = False, seller.id
        for spec in product.specifications: spec.is_active, spec.updated_by = False, seller.id

        db.session.commit()

        # ── Invalidate cache ──────────────────────────────────────────────
        from shop.utils.cache_utils import invalidate_single_product
        invalidate_single_product(product.uuid)

        return success_response(f"Product '{product.name}' deleted successfully.")
    except Exception as e:
        e_name = e.__class__.__name__
        e_str = str(e).lower()
        if 'jwt' in e_name.lower() or 'token' in e_name.lower() or 'auth' in e_name.lower() or 'signature' in e_name.lower() or 'cookie' in e_str or 'token' in e_str:
            return jsonify({'error': str(e)}), 401
        db.session.rollback()
        return error_response('Failed to delete product', 500)
from flask import jsonify
from flask_jwt_extended import verify_jwt_in_request, get_jwt
from shop.models import Product, User
from shop.utils.api_response import error_response
from shop.seller.api.helpers import serialize_seller_product

def get_products_action():
    try:
        verify_jwt_in_request()
        claims = get_jwt()
        if claims.get("role") != "seller": return error_response("Unauthorized!", 403)

        seller = User.query.filter_by(uuid=claims.get("user_uuid")).first()
        products = Product.query.filter_by(seller_id=seller.id).order_by(Product.created_at.desc()).all()
        result = [serialize_seller_product(p) for p in products]
        
        return jsonify({"success": True, "message": "Products loaded.", "total_products": len(result), "data": result}), 200
    except Exception as e:
        e_name = e.__class__.__name__
        e_str = str(e).lower()
        if 'jwt' in e_name.lower() or 'token' in e_name.lower() or 'auth' in e_name.lower() or 'signature' in e_name.lower() or 'cookie' in e_str or 'token' in e_str:
            return jsonify({'error': str(e)}), 401
        return error_response(str(e), 500)
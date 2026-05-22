from flask import jsonify, current_app
from flask_jwt_extended import get_jwt, verify_jwt_in_request
from shop.models import SellerCategory, Category, User
from shop.utils.api_response import error_response, success_response


def list_category_requests_action():
    try:
        verify_jwt_in_request()
        claims = get_jwt()
        if claims.get('role') != 'admin':
            return error_response('Unauthorized! Admin access required.', 403)

        request_rows = SellerCategory.query.filter_by(is_active=True).order_by(SellerCategory.created_at.desc()).all()
        requests = []

        for row in request_rows:
            seller = User.query.get(row.seller_id)
            category = Category.query.get(row.category_id)

            requests.append({
                'request_uuid': row.uuid,
                'seller_uuid': row.seller_id,
                'seller_name': seller.username if seller else None,
                'category_uuid': row.category_id,
                'category_name': category.name if category else None,
                'is_approved': row.is_approved,
                'is_active': row.is_active,
                'created_at': row.created_at.isoformat() if getattr(row, 'created_at', None) else None,
                'updated_at': row.updated_at.isoformat() if getattr(row, 'updated_at', None) else None,
            })

        return success_response(
            message='Pending seller category requests fetched successfully.',
            data=requests,
            status_code=200,
        )

    except Exception as e:
        e_name = e.__class__.__name__
        e_str = str(e).lower()
        if 'jwt' in e_name.lower() or 'token' in e_name.lower() or 'auth' in e_name.lower() or 'signature' in e_name.lower() or 'cookie' in e_str or 'token' in e_str:
            return jsonify({'error': str(e)}), 401
        current_app.logger.error(f'list_category_requests error: {e}', exc_info=True)
        return error_response('Failed to fetch category requests.', 500)

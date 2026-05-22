from flask import jsonify, current_app
from flask_jwt_extended import verify_jwt_in_request, get_jwt
from shop.models import User, Product, Category, Order
from shop.utils.api_response import error_response, success_response


def admin_dashboard_action():
    try:
        verify_jwt_in_request()
        if get_jwt().get('role') != 'admin':
            return error_response('Unauthorized! Admin access required.', 403)

        total_users = User.query.count()
        total_products = Product.query.count()
        total_categories = Category.query.count()
        total_orders = Order.query.count()

        return success_response(
            message='Admin dashboard fetched successfully.',
            data={
                'total_users': total_users,
                'total_products': total_products,
                'total_categories': total_categories,
                'total_orders': total_orders,
            },
            status_code=200,
        )

    except Exception as e:
        e_name = e.__class__.__name__
        e_str = str(e).lower()
        if 'jwt' in e_name.lower() or 'token' in e_name.lower() or 'auth' in e_name.lower() or 'signature' in e_str or 'cookie' in e_str:
            return jsonify({'error': str(e)}), 401
        current_app.logger.error(f'admin_dashboard error: {e}', exc_info=True)
        return error_response('Failed to fetch admin dashboard.', 500)

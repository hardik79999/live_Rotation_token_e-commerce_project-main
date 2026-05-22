"""
GET /api/admin/returns   — paginated list of all return requests
"""
from flask import request, jsonify
from flask_jwt_extended import verify_jwt_in_request, get_jwt
from shop.extensions import db
from shop.models import OrderReturn, ReturnStatus, Order, User
from shop.utils.api_response import error_response


def list_returns_action():
    try:
        verify_jwt_in_request()
        if get_jwt().get('role') != 'admin':
            return error_response('Unauthorized', 403)

        status_filter = request.args.get('status', 'all').lower()
        page     = max(1, int(request.args.get('page', 1)))
        per_page = min(50, max(1, int(request.args.get('per_page', 20))))

        q = OrderReturn.query

        if status_filter != 'all':
            try:
                q = q.filter(OrderReturn.status == ReturnStatus[status_filter])
            except KeyError:
                return error_response(f"Invalid status filter '{status_filter}'", 400)

        q = q.order_by(OrderReturn.created_at.desc())
        pagination = q.paginate(page=page, per_page=per_page, error_out=False)

        items = []
        for ret in pagination.items:
            order    = ret.order
            customer = User.query.get(ret.user_id)
            items.append({
                'uuid':               ret.uuid,
                'status':             ret.status.value,
                'reason':             ret.reason.value,
                'customer_comments':  ret.customer_comments,
                'admin_notes':        ret.admin_notes,
                'refund_method':      ret.refund_method,
                'refund_amount':      ret.refund_amount,
                'razorpay_refund_id': ret.razorpay_refund_id,
                'created_at':         ret.created_at.isoformat() if ret.created_at else None,
                'updated_at':         ret.updated_at.isoformat() if ret.updated_at else None,
                'order': {
                    'uuid':           order.uuid,
                    'total_amount':   order.total_amount,
                    'payment_method': order.payment_method.value if order.payment_method else None,
                    'delivered_at':   order.delivered_at.isoformat() if order.delivered_at else None,
                    'items': [
                        {
                            'product_name':      item.product.name if item.product else 'Deleted',
                            'quantity':          item.quantity,
                            'price_at_purchase': item.price_at_purchase,
                            'image': next(
                                (img.image_url for img in item.product.images
                                 if img.is_primary and img.is_active),
                                next(
                                    (img.image_url for img in item.product.images if img.is_active),
                                    None
                                )
                            ) if item.product else None,
                        }
                        for item in order.items
                    ],
                } if order else None,
                'customer': {
                    'uuid':     customer.uuid,
                    'username': customer.username,
                    'email':    customer.email,
                } if customer else None,
            })

        return jsonify({
            'success':  True,
            'data':     items,
            'total':    pagination.total,
            'page':     page,
            'per_page': per_page,
            'pages':    pagination.pages,
        }), 200

    except Exception as e:
        e_name = e.__class__.__name__
        e_str = str(e).lower()
        if 'jwt' in e_name.lower() or 'token' in e_name.lower() or 'auth' in e_name.lower() or 'signature' in e_name.lower() or 'cookie' in e_str or 'token' in e_str:
            return jsonify({'error': str(e)}), 401
        return error_response(str(e), 500)

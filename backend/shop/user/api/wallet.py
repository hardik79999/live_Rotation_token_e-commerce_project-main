"""
GET  /api/user/wallet              — balance + last 20 transactions
GET  /api/user/wallet/transactions — full paginated history
"""
from flask import jsonify, request
from flask_jwt_extended import verify_jwt_in_request, get_jwt
from shop.models import User, WalletTransaction, WalletTransactionType
from shop.utils.api_response import error_response


def get_wallet_action():
    try:
        verify_jwt_in_request()
        user_uuid = get_jwt().get('user_uuid')
        user = User.query.filter_by(uuid=user_uuid, is_active=True).first()
        if not user:
            return error_response('User not found', 404)
        if user.role.role_name != 'customer':
            return error_response('Only customers have a wallet', 403)

        recent = (
            WalletTransaction.query
            .filter_by(user_id=user.id)
            .order_by(WalletTransaction.created_at.desc())
            .limit(20)
            .all()
        )

        return jsonify({
            'success': True,
            'wallet_balance': round(user.wallet_balance, 2),
            'transactions': [_serialize(t) for t in recent],
        }), 200

    except Exception as e:
        e_name = e.__class__.__name__
        e_str = str(e).lower()
        if 'jwt' in e_name.lower() or 'token' in e_name.lower() or 'auth' in e_name.lower() or 'signature' in e_name.lower() or 'cookie' in e_str or 'token' in e_str:
            return jsonify({'error': str(e)}), 401
        return error_response("An error occurred. Please try again.", 500)


def get_wallet_transactions_action():
    try:
        verify_jwt_in_request()
        user_uuid = get_jwt().get('user_uuid')
        user = User.query.filter_by(uuid=user_uuid, is_active=True).first()
        if not user:
            return error_response('User not found', 404)
        if user.role.role_name != 'customer':
            return error_response('Only customers have a wallet', 403)

        page     = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 20))

        pagination = (
            WalletTransaction.query
            .filter_by(user_id=user.id)
            .order_by(WalletTransaction.created_at.desc())
            .paginate(page=page, per_page=per_page, error_out=False)
        )

        return jsonify({
            'success':      True,
            'wallet_balance': round(user.wallet_balance, 2),
            'data':         [_serialize(t) for t in pagination.items],
            'total':        pagination.total,
            'page':         page,
            'total_pages':  pagination.pages,
        }), 200

    except Exception as e:
        e_name = e.__class__.__name__
        e_str = str(e).lower()
        if 'jwt' in e_name.lower() or 'token' in e_name.lower() or 'auth' in e_name.lower() or 'signature' in e_name.lower() or 'cookie' in e_str or 'token' in e_str:
            return jsonify({'error': str(e)}), 401
        return error_response("An error occurred. Please try again.", 500)


def _serialize(t: WalletTransaction) -> dict:
    return {
        'uuid':             t.uuid,
        'amount':           round(t.amount, 2),
        'transaction_type': t.transaction_type.value,
        'description':      t.description,
        'created_at':       t.created_at.isoformat() if t.created_at else None,
    }

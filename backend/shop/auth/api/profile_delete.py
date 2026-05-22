from flask import jsonify, current_app
from flask_jwt_extended import verify_jwt_in_request, get_jwt
from shop.extensions import db
from shop.models import User
from shop.utils.api_response import error_response

def profile_delete_action():
    try:
        verify_jwt_in_request()
        user_uuid = get_jwt().get("user_uuid")
        
        # User ko find karo
        user = User.query.filter_by(uuid=user_uuid, is_active=True).first()
        if not user:
            return error_response("User not found or already deleted", 404)

        # 🔥 Soft Delete (Industry Standard)
        user.is_active = False
        db.session.commit()

        return jsonify({
            "success": True,
            "message": "Your account has been deleted successfully."
        }), 200

    except Exception as e:
        e_name = e.__class__.__name__
        e_str = str(e).lower()
        if 'jwt' in e_name.lower() or 'token' in e_name.lower() or 'auth' in e_name.lower() or 'signature' in e_name.lower() or 'cookie' in e_str or 'token' in e_str:
            return jsonify({'error': str(e)}), 401
        db.session.rollback()
        current_app.logger.error(f'profile_delete error: {e}', exc_info=True)
        return error_response('Failed to delete account. Please try again.', 500)
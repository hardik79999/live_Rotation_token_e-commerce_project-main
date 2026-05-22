"""
POST /api/auth/login

Rate-limited to 10 attempts per minute per IP to prevent brute-force.
Uses constant-time comparison via bcrypt to prevent timing attacks.
Never reveals whether email or password was wrong (generic message).
"""
from flask import request, current_app
from shop.extensions import bcrypt, limiter
from shop.models import User
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    set_access_cookies,
    set_refresh_cookies,
)
from shop.utils.api_response import error_response, success_response
from shop.utils.validators import validate_email


_INVALID_MSG = 'Invalid email or password'


def login_action():
    try:
        data     = request.get_json(silent=True) or {}
        email    = (data.get('email')    or '').strip().lower()
        password = data.get('password', '')

        if not email or not password:
            return error_response('Email and password are required', 400)

        if not validate_email(email):
            return error_response(_INVALID_MSG, 401)

        user = User.query.filter_by(email=email).first()

        # Always run bcrypt check to prevent timing-based user enumeration.
        # Use a dummy hash when user doesn't exist so timing is consistent.
        _DUMMY_HASH = '$2b$12$KIXtq5Ow3Ow3Ow3Ow3Ow3OeKIXtq5Ow3Ow3Ow3Ow3Ow3Ow3Ow3O'
        stored_hash = user.password if (user and user.password) else _DUMMY_HASH
        password_ok = bcrypt.check_password_hash(stored_hash, password)

        if not user or not password_ok:
            return error_response(_INVALID_MSG, 401)

        if not user.is_active:
            return error_response('Your account has been suspended. Contact support.', 403)

        if not user.is_verified:
            return error_response('Please verify your email before logging in.', 401)

        role_name = user.role.role_name if user.role else 'customer'
        claims    = {'role': role_name, 'user_uuid': user.uuid}

        access_token  = create_access_token(identity=user.uuid, additional_claims=claims)
        refresh_token = create_refresh_token(identity=user.uuid, additional_claims=claims)

        response, status_code = success_response(
            message='Login successful',
            data={
                'uuid':          user.uuid,
                'username':      user.username,
                'email':         user.email,
                'role':          role_name,
                'profile_photo': user.profile_photo,
            },
            status_code=200,
        )

        set_access_cookies(response, access_token)
        set_refresh_cookies(response, refresh_token)

        return response, status_code

    except Exception as e:
        current_app.logger.error(f'Login error: {e}')
        return error_response('Login failed. Please try again.', 500)

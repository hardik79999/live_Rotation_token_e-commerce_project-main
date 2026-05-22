"""
POST /api/auth/signup

Rate-limited to 10 requests per hour per IP.
Validates all inputs before any DB write.
"""
import re
from flask import request, jsonify, current_app
from shop.extensions import db, bcrypt, limiter
from shop.models import User, Role
from shop.utils.email_service import send_verification_email, send_welcome_email
from shop.utils.validators import validate_email, validate_password_strength
from itsdangerous import URLSafeTimedSerializer
from shop.utils.api_response import error_response


def signup_action():
    try:
        data     = request.get_json(silent=True) or {}
        username = (data.get('username') or '').strip()
        email    = (data.get('email')    or '').strip().lower()
        password = data.get('password', '')
        phone    = (data.get('phone')    or '').strip() or None
        requested_role = (data.get('role') or 'customer').lower().strip()

        # ── Input validation ──────────────────────────────────────────────
        if not username or not email or not password:
            return error_response('Username, email, and password are required', 400)

        if len(username) < 2 or len(username) > 80:
            return error_response('Username must be 2–80 characters', 400)

        if not validate_email(email):
            return error_response('Invalid email address', 400)

        pwd_error = validate_password_strength(password)
        if pwd_error:
            return error_response(pwd_error, 400)

        if requested_role not in {'customer', 'seller'}:
            return error_response('Invalid role. Must be customer or seller', 400)

        if phone:
            if not re.fullmatch(r'\d{10,15}', phone):
                return error_response('Phone must be 10–15 digits', 400)
            if User.query.filter_by(phone=phone, is_active=True).first():
                return error_response('Phone number already registered', 409)

        # ── Duplicate check ───────────────────────────────────────────────
        existing = User.query.filter(
            (User.email == email) | (User.username == username)
        ).first()

        if existing:
            if not existing.is_active:
                # Reactivate soft-deleted account
                if phone and phone != existing.phone:
                    if User.query.filter(
                        User.phone == phone,
                        User.id != existing.id,
                        User.is_active == True,
                    ).first():
                        return error_response('Phone number already registered', 409)

                existing.is_active   = True
                existing.username    = username
                existing.phone       = phone
                existing.password    = bcrypt.generate_password_hash(password).decode('utf-8')
                existing.is_verified = False
                db.session.flush()

                _send_verification(existing.email, existing.username, requested_role)
                db.session.commit()

                return jsonify({
                    'success': True,
                    'message': 'Account reactivated. Please verify your email.',
                    'data': {
                        'uuid':     existing.uuid,
                        'username': existing.username,
                        'email':    existing.email,
                        'role':     requested_role,
                    },
                }), 200

            return error_response('Email or username already registered', 409)

        # ── Create new user ───────────────────────────────────────────────
        user_role = Role.query.filter_by(role_name=requested_role).first()
        if not user_role:
            return error_response('Role configuration error', 500)

        new_user = User(
            username    = username,
            email       = email,
            password    = bcrypt.generate_password_hash(password).decode('utf-8'),
            phone       = phone,
            role_id     = user_role.id,
            is_active   = True,
            is_verified = False,
        )
        db.session.add(new_user)
        db.session.flush()

        _send_verification(new_user.email, new_user.username, requested_role)
        db.session.commit()

        return jsonify({
            'success': True,
            'message': 'Registered successfully. Please check your email to verify.',
            'data': {
                'uuid':     new_user.uuid,
                'username': new_user.username,
                'email':    new_user.email,
                'role':     requested_role,
            },
        }), 201

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f'Signup error: {e}')
        return error_response('Registration failed. Please try again.', 500)


def _send_verification(email: str, username: str = '', role: str = 'customer') -> None:
    s     = URLSafeTimedSerializer(current_app.config['SECRET_KEY'])
    token = s.dumps(email, salt='email-confirm')
    if username:
        send_welcome_email(email, username, role, token)
    else:
        send_verification_email(email, token)

"""
POST /api/auth/forgot-password

Rate-limited to 5 requests per hour per IP.
Always returns the same response regardless of whether the email exists
(prevents user enumeration).
Uses secrets.randbelow for cryptographically secure OTP generation.
"""
import secrets
from datetime import datetime, timedelta
from flask import request, jsonify, current_app
from shop.extensions import db, limiter
from shop.models import User, Otp, OTPAction
from shop.utils.api_response import error_response
from shop.utils.email_service import send_otp_email
from shop.utils.validators import validate_email

_SUCCESS_MSG = 'If this email is registered, you will receive an OTP shortly.'


def forgot_password_action():
    try:
        data  = request.get_json(silent=True) or {}
        email = (data.get('email') or '').strip().lower()

        if not email:
            return error_response('Email is required', 400)

        if not validate_email(email):
            # Still return success to prevent enumeration
            return jsonify({'success': True, 'message': _SUCCESS_MSG}), 200

        user = User.query.filter_by(email=email, is_active=True).first()
        if not user:
            return jsonify({'success': True, 'message': _SUCCESS_MSG}), 200

        # Invalidate all previous unused OTPs for this action
        Otp.query.filter_by(
            user_id=user.id,
            action=OTPAction.password_reset,
            is_used=False,
        ).update({'is_used': True})

        # Cryptographically secure 6-digit OTP
        otp_code = str(secrets.randbelow(900000) + 100000)

        new_otp = Otp(
            user_id    = user.id,
            otp_code   = otp_code,
            action     = OTPAction.password_reset,
            is_used    = False,
            expires_at = datetime.utcnow() + timedelta(minutes=10),
            created_by = user.id,
        )
        db.session.add(new_otp)
        db.session.commit()

        email_sent = send_otp_email(user.email, otp_code)
        if not email_sent:
            current_app.logger.error(f'OTP email failed for {email}')
            # Don't reveal email failure to client
            return jsonify({'success': True, 'message': _SUCCESS_MSG}), 200

        return jsonify({'success': True, 'message': _SUCCESS_MSG}), 200

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f'Forgot password error: {e}')
        return error_response('An error occurred. Please try again.', 500)

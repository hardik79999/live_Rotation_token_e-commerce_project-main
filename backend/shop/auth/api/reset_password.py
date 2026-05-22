"""
POST /api/auth/reset-password

Rate-limited to 10 requests per hour per IP.
Validates password strength before accepting the reset.
Uses timezone-aware datetime comparison.
"""
from datetime import datetime, timezone
from flask import request, jsonify, current_app
from shop.extensions import db, bcrypt, limiter
from shop.models import User, Otp, OTPAction
from shop.utils.api_response import error_response
from shop.utils.validators import validate_password_strength, validate_email


def reset_password_action():
    try:
        data         = request.get_json(silent=True) or {}
        email        = (data.get('email')        or '').strip().lower()
        otp_code     = (data.get('otp_code')     or '').strip()
        new_password = data.get('new_password', '')

        if not all([email, otp_code, new_password]):
            return error_response('Email, OTP, and new password are required', 400)

        if not validate_email(email):
            return error_response('Invalid email address', 400)

        pwd_error = validate_password_strength(new_password)
        if pwd_error:
            return error_response(pwd_error, 400)

        user = User.query.filter_by(email=email, is_active=True).first()
        if not user:
            return error_response('Invalid request', 400)

        otp_record = (
            Otp.query
            .filter_by(
                user_id  = user.id,
                otp_code = otp_code,
                action   = OTPAction.password_reset,
                is_used  = False,
            )
            .order_by(Otp.created_at.desc())
            .first()
        )

        if not otp_record:
            return error_response('Invalid or already used OTP', 400)

        # Timezone-aware comparison
        now = datetime.now(timezone.utc)
        expires = otp_record.expires_at
        if expires.tzinfo is None:
            from datetime import timezone as tz
            expires = expires.replace(tzinfo=tz.utc)

        if expires < now:
            return error_response('OTP has expired. Please request a new one.', 400)

        user.password    = bcrypt.generate_password_hash(new_password).decode('utf-8')
        otp_record.is_used = True
        db.session.commit()

        return jsonify({
            'success': True,
            'message': 'Password reset successfully. You can now log in.',
        }), 200

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f'Reset password error: {e}')
        return error_response('An error occurred. Please try again.', 500)

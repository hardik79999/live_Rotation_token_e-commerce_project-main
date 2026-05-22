from flask import current_app, redirect
from shop.extensions import db
from shop.models import User
from itsdangerous import URLSafeTimedSerializer, SignatureExpired, BadSignature


def verify_email_action(token):
    frontend = current_app.config.get('FRONTEND_BASE_URL', 'http://127.0.0.1:5173')
    s = URLSafeTimedSerializer(current_app.config['SECRET_KEY'])

    try:
        email = s.loads(token, salt='email-confirm', max_age=600)
        user  = User.query.filter_by(email=email).first()

        if not user:
            # Redirect to login with error param
            return redirect(f"{frontend}/login?verified=notfound")

        if user.is_verified:
            # Already verified — just send them to login
            return redirect(f"{frontend}/login?verified=already")

        user.is_verified = True
        db.session.commit()

        # Redirect to login with success param so the page can show a toast
        return redirect(f"{frontend}/login?verified=success")

    except SignatureExpired:
        return redirect(f"{frontend}/login?verified=expired")

    except BadSignature:
        return redirect(f"{frontend}/login?verified=invalid")

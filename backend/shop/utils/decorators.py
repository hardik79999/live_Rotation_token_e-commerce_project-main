from functools import wraps
from flask import jsonify
from flask_jwt_extended import (
    verify_jwt_in_request,
    get_jwt,
    create_access_token,
    create_refresh_token,
    set_access_cookies,
    set_refresh_cookies,
    unset_jwt_cookies
)

# =================================================================================
# 🔐 GENERIC ROLE DECORATOR (NO HARDCODING)
# =================================================================================

def role_required(allowed_roles):
    def wrapper(fn):
        @wraps(fn)
        def decorator(*args, **kwargs):
            verify_jwt_in_request()  # access token required

            claims = get_jwt()
            user_role = claims.get("role")

            if user_role not in allowed_roles:
                return jsonify({"error": "Access Denied"}), 403

            return fn(*args, **kwargs)
        return decorator
    return wrapper


# =================================================================================
# 🎯 SHORTCUT DECORATORS (CLEAN)
# =================================================================================

def admin_required():
    return role_required(["admin"])

def seller_required():
    return role_required(["seller"])

def customer_required():
    return role_required(["customer"])


# =================================================================================
# 🔁 TOKEN GENERATION (ACCESS + REFRESH)
# =================================================================================

def generate_tokens(user):
    additional_claims = {
        "role": user.role.role_name,
        "user_uuid": user.uuid
    }

    access_token = create_access_token(
        identity=user.uuid,
        additional_claims=additional_claims
    )

    refresh_token = create_refresh_token(
        identity=user.uuid,
        additional_claims=additional_claims
    )

    return access_token, refresh_token


# =================================================================================
# 🍪 SET TOKENS IN COOKIES (SECURE)
# =================================================================================

def set_auth_cookies(response, access_token, refresh_token):
    set_access_cookies(response, access_token)
    set_refresh_cookies(response, refresh_token)
    return response


# =================================================================================
# 🔄 REFRESH TOKEN HANDLER
# =================================================================================

def refresh_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        verify_jwt_in_request(refresh=True)  # only refresh token allowed
        return fn(*args, **kwargs)
    return wrapper


# =================================================================================
# 🚪 LOGOUT (CLEAR COOKIES)
# =================================================================================

def logout_user(response):
    unset_jwt_cookies(response)
    return response

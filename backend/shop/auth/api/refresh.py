"""
refresh.py — Silent token refresh endpoint.

Called automatically by the Axios interceptor when the 15-min access token expires.
Must NEVER return 500 — every failure path returns a clean 401 with cookies cleared.
"""
from flask import jsonify
from flask_jwt_extended import (
    verify_jwt_in_request,
    get_jwt,
    create_access_token,
    create_refresh_token,
    set_access_cookies,
    set_refresh_cookies,
    unset_jwt_cookies,
)
from flask_jwt_extended.exceptions import (
    NoAuthorizationError,
    InvalidHeaderError,
    RevokedTokenError,
    WrongTokenError,
    CSRFError,
    JWTExtendedException,
)
from shop.utils.api_response import success_response
from datetime import datetime, timezone, timedelta
import logging

logger = logging.getLogger(__name__)


def _clear_and_401(message: str):
    """Return a clean 401 with all JWT cookies cleared."""
    response = jsonify({"success": False, "message": message})
    unset_jwt_cookies(response)
    return response, 401


def refresh_action():
    # ── Step 1: Validate the refresh token cookie ─────────────────────────
    try:
        verify_jwt_in_request(refresh=True)

    except NoAuthorizationError:
        # No refresh cookie at all — user is not logged in
        return _clear_and_401("No refresh token found. Please log in.")

    except CSRFError:
        # CSRF mismatch on the refresh call itself
        return _clear_and_401("CSRF token mismatch. Please log in again.")

    except WrongTokenError:
        # Access token was sent instead of refresh token
        return _clear_and_401("Wrong token type. Please log in again.")

    except RevokedTokenError:
        return _clear_and_401("Token has been revoked. Please log in again.")

    except InvalidHeaderError:
        return _clear_and_401("Invalid token header. Please log in again.")

    except JWTExtendedException as e:
        # Catches ExpiredSignatureError, DecodeError, and all other
        # Flask-JWT-Extended exceptions (including wrapped PyJWT errors).
        error_msg = str(e).lower()
        if any(kw in error_msg for kw in ("expired", "signature", "token has expired")):
            return _clear_and_401("Session expired. Please log in again.")
        logger.error(f"JWT validation error during refresh: {e}")
        return _clear_and_401("Authentication error. Please log in again.")

    except Exception as e:
        # Absolute last resort — PyJWT may raise directly in some versions
        error_msg = str(e).lower()
        if any(kw in error_msg for kw in ("expired", "signature", "invalid")):
            return _clear_and_401("Session expired. Please log in again.")
        logger.error(f"Unexpected refresh error: {e}")
        return _clear_and_401("Authentication error. Please log in again.")

    # ── Step 2: Token valid — issue new tokens ────────────────────────────
    try:
        claims = get_jwt()

        # Flask-JWT-Extended stores identity in "sub"
        user_uuid = claims.get("sub") or claims.get("identity")
        role_name = claims.get("role")

        if not user_uuid:
            return _clear_and_401("Malformed token claims. Please log in again.")

        exp_timestamp     = claims.get("exp", 0)
        now_timestamp     = datetime.now(timezone.utc).timestamp()
        remaining_seconds = exp_timestamp - now_timestamp

        if remaining_seconds <= 0:
            return _clear_and_401("Session expired after 7 days. Please log in again.")

        # Issue new access token (full 15-min lifetime)
        new_access_token = create_access_token(
            identity=user_uuid,
            additional_claims={"role": role_name, "user_uuid": user_uuid},
        )

        # Issue new refresh token preserving the remaining 7-day window
        new_refresh_token = create_refresh_token(
            identity=user_uuid,
            additional_claims={"role": role_name, "user_uuid": user_uuid},
            expires_delta=timedelta(seconds=max(remaining_seconds, 1)),
        )

        days_left = round(remaining_seconds / 86400, 2)

        response, status_code = success_response(
            message="Token refreshed successfully",
            data={"session_days_left": days_left},
            status_code=200,
        )

        set_access_cookies(response, new_access_token)
        set_refresh_cookies(response, new_refresh_token)

        return response, status_code

    except Exception as e:
        logger.error(f"Token generation error during refresh: {e}")
        return _clear_and_401("Failed to issue new tokens. Please log in again.")

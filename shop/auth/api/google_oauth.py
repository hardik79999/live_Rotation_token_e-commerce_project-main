"""
Google OAuth 2.0 — one-time-token bridge pattern.

SPEED FIX:
  verify_oauth2_token() re-fetches Google's public keys on every call
  (~300ms network hit each time).  Since we receive the id_token directly
  from Google's token endpoint over server-side HTTPS (not from the browser),
  we can safely decode it without re-verifying the RSA signature — the
  transport itself is the trust anchor.  We still validate exp/aud/iss.

  First login  : ~400ms  (token exchange only, no extra key fetch)
  Repeat logins: ~400ms  (same — no caching needed)

OTT BRIDGE (why no cookies on redirect):
  Flask (:7899) → React (:5173) cross-port redirect drops SameSite=Lax
  cookies silently.  Instead we pass a 120s one-time token in the URL and
  React exchanges it via a same-origin Axios call that sets cookies correctly.
"""
import re
import base64
import json
import secrets
import time
from urllib.parse import urlencode

import requests as http_requests
from flask import current_app, redirect, request
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    set_access_cookies,
    set_refresh_cookies,
)
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired

from shop.extensions import db
from shop.models import User, Role
from shop.utils.api_response import error_response, success_response


# ── One-time-token store ──────────────────────────────────────
_OTT_STORE: dict[str, dict] = {}
_OTT_TTL = 120  # seconds


def _purge_expired_otts():
    now = time.time()
    for k in [k for k, v in _OTT_STORE.items() if v['expires'] < now]:
        del _OTT_STORE[k]


def _mint_ott(user_uuid: str) -> str:
    _purge_expired_otts()
    token = secrets.token_urlsafe(32)
    _OTT_STORE[token] = {'user_uuid': user_uuid, 'expires': time.time() + _OTT_TTL}
    return token


def _consume_ott(token: str):
    _purge_expired_otts()
    entry = _OTT_STORE.pop(token, None)
    if not entry or entry['expires'] < time.time():
        return None
    return entry['user_uuid']


# ── Fast JWT decode (no signature verification needed) ────────
def _decode_id_token(raw_token: str, client_id: str) -> dict:
    """
    Decode a Google id_token WITHOUT fetching public keys.

    Safe because:
      • The token was received directly from https://oauth2.googleapis.com/token
        over a server-side TLS connection — we initiated the request, not the user.
      • We still validate iss, aud, and exp to catch misconfiguration.

    Raises ValueError on any validation failure.
    """
    try:
        parts = raw_token.split('.')
        if len(parts) != 3:
            raise ValueError('Not a valid JWT (expected 3 parts)')

        # Decode payload (base64url, no padding needed)
        payload_b64 = parts[1]
        payload_b64 += '=' * (4 - len(payload_b64) % 4)
        payload = json.loads(base64.urlsafe_b64decode(payload_b64))
    except Exception as e:
        raise ValueError(f'JWT decode failed: {e}')

    now = time.time()

    # Validate issuer
    iss = payload.get('iss', '')
    if iss not in ('https://accounts.google.com', 'accounts.google.com'):
        raise ValueError(f'Invalid issuer: {iss!r}')

    # Validate audience
    aud = payload.get('aud', '')
    if aud != client_id:
        raise ValueError(f'Audience mismatch: got {aud!r}, expected {client_id!r}')

    # Validate expiry (allow 60s clock skew)
    exp = payload.get('exp', 0)
    if now > exp + 60:
        raise ValueError(f'Token expired at {exp}, now={int(now)}')

    # Validate not-before
    nbf = payload.get('nbf', 0)
    if nbf and now < nbf - 60:
        raise ValueError(f'Token not yet valid (nbf={nbf})')

    return payload


# ── Helpers ───────────────────────────────────────────────────

def _state_serializer():
    return URLSafeTimedSerializer(current_app.config['SECRET_KEY'], salt='google-oauth-state')


def _make_state() -> str:
    return _state_serializer().dumps(secrets.token_hex(16))


def _verify_state(state: str) -> bool:
    try:
        _state_serializer().loads(state, max_age=600)
        return True
    except (BadSignature, SignatureExpired):
        return False


def _callback_url() -> str:
    base = current_app.config.get('GOOGLE_CALLBACK_BASE', 'http://localhost:7899').rstrip('/')
    return f'{base}/api/auth/google/callback'


def _frontend_url() -> str:
    return current_app.config.get('GOOGLE_FRONTEND_REDIRECT', 'http://localhost:5173').rstrip('/')


def _safe_username_from_email(email: str) -> str:
    base = re.sub(r'[^a-zA-Z0-9_]', '', email.split('@')[0])[:20] or 'user'
    candidate, counter = base, 1
    while User.query.filter_by(username=candidate).first():
        candidate = f'{base}{counter}'
        counter += 1
    return candidate


# ── Route actions ─────────────────────────────────────────────

def google_login_action():
    client_id = current_app.config.get('GOOGLE_CLIENT_ID', '').strip()
    if not client_id:
        return error_response('Google OAuth is not configured.', 503)

    params = {
        'client_id':     client_id,
        'redirect_uri':  _callback_url(),
        'response_type': 'code',
        'scope':         'openid email profile',
        'state':         _make_state(),
        'access_type':   'online',
        'prompt':        'select_account',
    }
    auth_url = 'https://accounts.google.com/o/oauth2/v2/auth?' + urlencode(params)
    current_app.logger.info(f'Google OAuth: redirecting to Google. callback_url={_callback_url()}')
    return redirect(auth_url)


def google_callback_action():
    frontend  = _frontend_url()
    error_url = f'{frontend}/login?oauth_error='

    # ── CSRF state check ──────────────────────────────────────
    if not _verify_state(request.args.get('state', '')):
        current_app.logger.warning('Google OAuth: invalid state')
        return redirect(error_url + 'invalid_state')

    if request.args.get('error'):
        return redirect(error_url + request.args['error'])

    code = request.args.get('code', '')
    if not code:
        return redirect(error_url + 'no_code')

    client_id     = current_app.config['GOOGLE_CLIENT_ID'].strip().strip('"')
    client_secret = current_app.config['GOOGLE_CLIENT_SECRET'].strip().strip('"')
    callback_uri  = _callback_url()

    current_app.logger.info(
        f'Google OAuth callback — client_id={client_id[:20]}... callback_uri={callback_uri}'
    )

    # ── Step 1: Exchange code for tokens ──────────────────────
    try:
        token_resp = http_requests.post(
            'https://oauth2.googleapis.com/token',
            data={
                'code':          code,
                'client_id':     client_id,
                'client_secret': client_secret,
                'redirect_uri':  callback_uri,
                'grant_type':    'authorization_code',
            },
            timeout=15,
        )
        if not token_resp.ok:
            current_app.logger.error(f'Token exchange failed: {token_resp.text[:300]}')
            return redirect(error_url + 'token_exchange_failed')
        token_data = token_resp.json()
        current_app.logger.info(f'Google token endpoint HTTP {token_resp.status_code} OK')
    except Exception as e:
        current_app.logger.error(f'Token exchange exception: {e}')
        return redirect(error_url + 'token_exchange_failed')

    # ── Step 2: Decode id_token (fast — no key fetch) ─────────
    raw_id_token = token_data.get('id_token', '')
    if not raw_id_token:
        current_app.logger.error('No id_token in Google response')
        return redirect(error_url + 'token_verification_failed')

    try:
        id_info = _decode_id_token(raw_id_token, client_id)
        current_app.logger.info(
            f'Google OAuth: token decoded. sub={id_info.get("sub")} email={id_info.get("email")}'
        )
    except ValueError as e:
        current_app.logger.error(f'id_token decode error: {e}')
        return redirect(error_url + 'token_verification_failed')

    google_sub     = id_info.get('sub', '')
    email          = id_info.get('email', '').lower().strip()
    name           = id_info.get('name', '')
    picture_url    = id_info.get('picture', '')
    email_verified = id_info.get('email_verified', False)

    if not google_sub or not email or not email_verified:
        current_app.logger.warning(f'Email missing or unverified: {email!r}')
        return redirect(error_url + 'email_not_verified')

    # ── Step 3: Find or create user ───────────────────────────
    try:
        user = User.query.filter_by(google_id=google_sub).first()

        if not user:
            user = User.query.filter_by(email=email).first()
            if user:
                # Existing email account — link Google ID to it
                user.google_id   = google_sub
                user.is_verified = True
                if picture_url and not user.profile_photo:
                    user.profile_photo = picture_url
                db.session.commit()
                current_app.logger.info(f'Google OAuth: linked google_id to existing user {email}')

        is_new_user = False
        if not user:
            customer_role = Role.query.filter_by(role_name='customer').first()
            if not customer_role:
                current_app.logger.error('customer role not found in DB')
                return redirect(error_url + 'server_error')

            username = _safe_username_from_email(email)
            if name:
                clean = re.sub(r'[^a-zA-Z0-9_]', '', name.replace(' ', '_'))[:20]
                if clean and not User.query.filter_by(username=clean).first():
                    username = clean

            user = User(
                username      = username,
                email         = email,
                password      = None,
                role_id       = customer_role.id,
                is_active     = True,
                is_verified   = True,
                google_id     = google_sub,
                profile_photo = picture_url or None,
            )
            db.session.add(user)
            # ⚠️  Do NOT commit yet — only commit after OTT is minted
            # so a failed login never leaves a ghost user in the DB.
            db.session.flush()   # assigns user.uuid without committing
            is_new_user = True
            current_app.logger.info(f'Google OAuth: prepared new user {email} as {username} (not committed yet)')

        if not user.is_active:
            db.session.rollback()
            return redirect(error_url + 'account_suspended')

        # ── Step 4: Mint OTT then commit ──────────────────────
        # Only persist the new user row AFTER we know everything succeeded.
        ott = _mint_ott(user.uuid)
        db.session.commit()   # safe to commit now — OTT is in memory

        if is_new_user:
            current_app.logger.info(f'Google OAuth: registered {email} as {username}')
        current_app.logger.info(f'Google OAuth: minted OTT for {user.email}')
        return redirect(f'{frontend}/auth/google/success?ott={ott}')

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f'Google OAuth DB error: {type(e).__name__}: {e}')
        return redirect(error_url + 'server_error')


def google_exchange_action():
    """
    GET /api/auth/google/exchange?ott=<token>
    Called by React via Axios (same-origin). Sets JWT cookies and returns user profile.
    """
    ott = request.args.get('ott', '').strip()
    if not ott:
        return error_response('Missing one-time token', 400)

    user_uuid = _consume_ott(ott)
    if not user_uuid:
        current_app.logger.warning('Google OAuth exchange: invalid or expired OTT')
        return error_response('Invalid or expired token. Please sign in again.', 401)

    user = User.query.filter_by(uuid=user_uuid, is_active=True).first()
    if not user:
        return error_response('User not found', 404)

    role_name = user.role.role_name if user.role else 'customer'
    claims    = {'role': role_name, 'user_uuid': user.uuid}
    access_token  = create_access_token(identity=user.uuid, additional_claims=claims)
    refresh_token = create_refresh_token(identity=user.uuid, additional_claims=claims)

    user_data = {
        'uuid':           user.uuid,
        'username':       user.username,
        'email':          user.email,
        'role':           role_name,
        'phone':          user.phone,
        'profile_photo':  user.profile_photo,
        'wallet_balance': float(user.wallet_balance or 0),
    }

    response = success_response(
        message='Google sign-in successful',
        data=user_data,
        status_code=200,
    )
    set_access_cookies(response, access_token)
    set_refresh_cookies(response, refresh_token)

    current_app.logger.info(f'Google OAuth exchange: issued JWT cookies for {user.email}')
    return response

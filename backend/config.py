"""
config.py — Centralized, production-grade configuration.

All secrets MUST come from environment variables.
Startup will abort if critical values are missing.
"""
import os
import sys
from datetime import timedelta
from dotenv import load_dotenv
from urllib.parse import urlparse

load_dotenv()


def _require(key: str) -> str:
    """Abort startup if a required env var is missing or still set to the insecure default."""
    val = os.getenv(key, '').strip()
    insecure_defaults = {
        '1234567890qwertyuiopasdfghjklzxcvbnm',
        'default-secret-key',
        'default-jwt-secret',
        '',
    }
    if not val or val in insecure_defaults:
        print(
            f"\n[FATAL] Environment variable '{key}' is missing or set to an insecure default.\n"
            f"        Set a strong random value in your .env file and restart.\n",
            file=sys.stderr,
        )
        sys.exit(1)
    return val



class Config:
    # ── Security keys (required — startup aborts if missing/weak) ─────────
    SECRET_KEY     = _require('SECRET_KEY')
    JWT_SECRET_KEY = _require('JWT_SECRET_KEY')

    # ── Database ──────────────────────────────────────────────────────────
    SQLALCHEMY_DATABASE_URI        = os.getenv('DATABASE_URL')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS      = {
        'pool_pre_ping': True,       # detect stale connections
        'pool_recycle':  3600,       # recycle connections every hour
        'pool_size':     10,
        'max_overflow':  20,
    }

    # ── CORS origins ──────────────────────────────────────────────────────
    FRONTEND_ORIGINS: list[str] = [
        o.strip()
        for o in os.getenv(
            'FRONTEND_ORIGINS',
            'http://127.0.0.1:5173,http://localhost:5173,https://*.ngrok.io,https://*.ngrok-free.app,https://*.ngrok-free.dev,http://127.0.0.1:7899,http://localhost:7899',
        ).split(',')
        if o.strip()
    ]

    # ── Mail ──────────────────────────────────────────────────────────────
    MAIL_SERVER   = os.getenv('MAIL_SERVER',   'smtp.gmail.com')
    MAIL_PORT     = int(os.getenv('MAIL_PORT', '587'))
    MAIL_USE_TLS  = os.getenv('MAIL_USE_TLS',  'True').lower() == 'true'
    MAIL_USERNAME = os.getenv('MAIL_USERNAME')
    MAIL_PASSWORD = os.getenv('MAIL_PASSWORD')
    MAIL_DEFAULT_SENDER = os.getenv('MAIL_DEFAULT_SENDER', MAIL_USERNAME)

    # ── JWT Cookie settings ───────────────────────────────────────────────
    JWT_TOKEN_LOCATION           = ['cookies']
    JWT_COOKIE_SECURE            = os.getenv('JWT_COOKIE_SECURE', 'False').lower() == 'true'
    JWT_COOKIE_HTTPONLY          = True
    JWT_COOKIE_SAMESITE          = os.getenv('JWT_COOKIE_SAMESITE', 'Lax')
    JWT_COOKIE_CSRF_PROTECT      = True
    JWT_ACCESS_CSRF_HEADER_NAME  = 'X-CSRF-TOKEN'
    JWT_REFRESH_CSRF_HEADER_NAME = 'X-CSRF-TOKEN'
    JWT_ACCESS_TOKEN_EXPIRES     = timedelta(minutes=15)
    JWT_REFRESH_TOKEN_EXPIRES    = timedelta(days=7)

    # ── Razorpay ──────────────────────────────────────────────────────────
    RAZORPAY_KEY_ID        = os.getenv('RAZORPAY_KEY_ID')
    RAZORPAY_KEY_SECRET    = os.getenv('RAZORPAY_KEY_SECRET')
    RAZORPAY_WEBHOOK_SECRET = os.getenv('RAZORPAY_WEBHOOK_SECRET')

    # ── App URLs (used in emails) ─────────────────────────────────────────
    APP_BASE_URL      = os.getenv('APP_BASE_URL',      'http://127.0.0.1:7899')
    FRONTEND_BASE_URL = os.getenv('FRONTEND_BASE_URL', 'http://127.0.0.1:5173')
    SUPPORT_EMAIL     = os.getenv('SUPPORT_EMAIL',     'support@shophub.in')

    # ── Rate limiting ─────────────────────────────────────────────────────
    RATELIMIT_STORAGE_URI    = os.getenv('RATELIMIT_STORAGE_URI', 'memory://')
    RATELIMIT_DEFAULT        = '200 per minute'
    RATELIMIT_HEADERS_ENABLED = True

    # ── Upload limits ─────────────────────────────────────────────────────
    MAX_CONTENT_LENGTH = 15 * 1024 * 1024   # 15 MB hard limit on request body

    # ── Meilisearch ───────────────────────────────────────────────────────
    MEILISEARCH_URL     = os.getenv('MEILISEARCH_URL',    'http://localhost:7700')
    MEILISEARCH_API_KEY = os.getenv('MEILISEARCH_API_KEY', '')

    # ── Google OAuth ──────────────────────────────────────────────────────
    GOOGLE_CLIENT_ID     = os.getenv('GOOGLE_CLIENT_ID',     '')
    GOOGLE_CLIENT_SECRET = os.getenv('GOOGLE_CLIENT_SECRET', '')
    # The exact base URL registered in Google Console as Authorized Redirect URI.
    # Defaults to localhost so it works out-of-the-box without extra config.
    GOOGLE_CALLBACK_BASE     = os.getenv('GOOGLE_CALLBACK_BASE',     'http://localhost:7899')
    # Where to redirect the browser after OAuth completes (the React app).
    GOOGLE_FRONTEND_REDIRECT = os.getenv('GOOGLE_FRONTEND_REDIRECT', 'http://localhost:5173')

    # ── Redis Cache ───────────────────────────────────────────────────────
    # REDIS_URL not set → falls back to SimpleCache (in-process, no Redis needed)
    _redis_url = os.getenv('REDIS_URL', '').strip()
    if _redis_url:
        CACHE_TYPE            = 'RedisCache'
        CACHE_REDIS_URL       = _redis_url
    else:
        # Graceful degradation: no Redis → use SimpleCache (single-process memory)
        CACHE_TYPE            = 'SimpleCache'
    CACHE_DEFAULT_TIMEOUT = 300   # 5 minutes
    CACHE_KEY_PREFIX      = 'shophub:'

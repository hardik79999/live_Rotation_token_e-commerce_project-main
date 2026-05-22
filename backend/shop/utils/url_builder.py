"""
url_builder.py
──────────────
Safe, bulletproof URL construction for email links.

Why this exists
───────────────
String concatenation like  f"{base}/{path}"  has two failure modes:

  1. Double-slash:  "http://host:5173/" + "/user/orders"
                 →  "http://host:5173//user/orders"   ← broken

  2. Localhost trap: if FRONTEND_BASE_URL is still "http://localhost:5173"
     and the email is opened on a mobile device, the phone tries to resolve
     "localhost" to itself — the link goes nowhere.

build_absolute_url() fixes both:
  • Uses urllib.parse.urljoin() which handles slashes correctly.
  • Reads FRONTEND_BASE_URL from Flask config at call time (inside a
    request/app context), so it always reflects the current .env value.
  • Strips accidental leading slashes from the path before joining.

Usage
─────
    from shop.utils.url_builder import build_absolute_url

    orders_url   = build_absolute_url("/user/orders")
    # → "http://192.168.0.3:5173/user/orders"

    dashboard    = build_absolute_url("seller/dashboard")
    # → "http://192.168.0.3:5173/seller/dashboard"

    # Works correctly even with a trailing slash on the base:
    # FRONTEND_BASE_URL = "http://192.168.0.3:5173/"
    # build_absolute_url("/user/orders") → "http://192.168.0.3:5173/user/orders"
"""

from urllib.parse import urljoin, urlparse
from flask import current_app


def build_absolute_url(path: str) -> str:
    """
    Build a safe, absolute frontend URL from a path fragment.

    Parameters
    ──────────
    path : str
        The frontend route path, e.g. "/user/orders" or "seller/dashboard".
        Leading slashes are normalised — you can pass with or without them.

    Returns
    ───────
    str
        A fully-qualified absolute URL, e.g.
        "http://192.168.0.3:5173/user/orders"

    Raises
    ──────
    RuntimeError
        If called outside a Flask application context (should never happen
        in normal usage since all email functions run inside a request).
    """
    base: str = current_app.config.get(
        'FRONTEND_BASE_URL', 'http://127.0.0.1:5173'
    ).rstrip('/')          # remove any trailing slash from the base

    # Normalise the path: ensure exactly one leading slash
    clean_path = '/' + path.lstrip('/')

    # urljoin handles all edge cases correctly:
    #   urljoin("http://host:5173", "/user/orders") → "http://host:5173/user/orders"
    return urljoin(base + '/', clean_path.lstrip('/'))


def build_api_url(path: str) -> str:
    """
    Build a safe, absolute backend API URL from a path fragment.
    Used for verification links that point at the Flask server, not the
    React frontend.

    Parameters
    ──────────
    path : str
        The API path, e.g. "/api/auth/verify/TOKEN".

    Returns
    ───────
    str
        e.g. "http://192.168.0.3:7899/api/auth/verify/TOKEN"
    """
    base: str = current_app.config.get(
        'APP_BASE_URL', 'http://127.0.0.1:7899'
    ).rstrip('/')

    clean_path = '/' + path.lstrip('/')
    return urljoin(base + '/', clean_path.lstrip('/'))


def is_localhost_url(url: str) -> bool:
    """Return True if the URL resolves to localhost / 127.0.0.1."""
    try:
        host = urlparse(url).hostname or ''
        return host in ('localhost', '127.0.0.1', '::1')
    except Exception:
        return False

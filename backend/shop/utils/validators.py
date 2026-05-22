"""
validators.py — Shared input validation helpers.

Used across auth, seller, and user APIs to enforce consistent rules.
"""
import re


# ── Email ─────────────────────────────────────────────────────
_EMAIL_RE = re.compile(
    r'^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$'
)


def validate_email(email: str) -> bool:
    """Return True if email looks valid."""
    return bool(email and _EMAIL_RE.match(email.strip()))


# ── Password strength ─────────────────────────────────────────
def validate_password_strength(password: str) -> str | None:
    """
    Return an error message string if the password is too weak,
    or None if it passes.

    Rules:
      - At least 8 characters
      - At least one uppercase letter
      - At least one lowercase letter
      - At least one digit
    """
    if not password:
        return 'Password is required'
    if len(password) < 8:
        return 'Password must be at least 8 characters'
    if not re.search(r'[A-Z]', password):
        return 'Password must contain at least one uppercase letter'
    if not re.search(r'[a-z]', password):
        return 'Password must contain at least one lowercase letter'
    if not re.search(r'\d', password):
        return 'Password must contain at least one number'
    return None


# ── Phone ─────────────────────────────────────────────────────
def validate_phone(phone: str) -> bool:
    """Return True if phone is 10–15 digits."""
    return bool(phone and re.fullmatch(r'\d{10,15}', phone.strip()))


# ── UUID ──────────────────────────────────────────────────────
_UUID_RE = re.compile(
    r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
    re.IGNORECASE,
)


def validate_uuid(value: str) -> bool:
    """Return True if value is a valid UUID v4 string."""
    return bool(value and _UUID_RE.match(value.strip()))


# ── Price / Stock ─────────────────────────────────────────────
def validate_positive_number(value, allow_zero: bool = False) -> bool:
    """Return True if value can be cast to a positive (or zero) float."""
    try:
        n = float(value)
        return n >= 0 if allow_zero else n > 0
    except (TypeError, ValueError):
        return False

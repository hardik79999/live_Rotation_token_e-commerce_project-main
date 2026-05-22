"""
shop/currency/rates.py — Fetch live exchange rates and cache them in Redis.

Source: open.er-api.com (free tier, no API key required, updates every 24h)
Base currency: INR (all rates are "1 INR = X foreign")

Cache key : shophub:currency:rates
Cache TTL : 86400 seconds (24 hours) — matches the free-tier update frequency

Fallback  : If the HTTP request fails, we return hardcoded approximate rates
            so the app never crashes due to a network hiccup.
"""
import logging
import json
import requests
from datetime import datetime

logger = logging.getLogger(__name__)

# ── Hardcoded fallback rates (1 INR = X) ─────────────────────────────────────
# Updated periodically — only used when the live fetch fails.
FALLBACK_RATES: dict[str, float] = {
    'INR': 1.0,
    'USD': 0.012,
    'EUR': 0.011,
    'GBP': 0.0095,
}

CACHE_KEY = 'currency:rates'
CACHE_TTL = 86_400   # 24 hours in seconds

SUPPORTED = ['INR', 'USD', 'EUR', 'GBP']


def _fetch_live_rates() -> dict[str, float]:
    """
    Hit open.er-api.com with INR as base and extract only the currencies we need.
    Returns a dict of { 'USD': 0.012, 'EUR': 0.011, ... } where 1 INR = value.
    """
    url = 'https://open.er-api.com/v6/latest/INR'
    resp = requests.get(url, timeout=8)
    resp.raise_for_status()
    data = resp.json()

    if data.get('result') != 'success':
        raise ValueError(f"API returned non-success: {data.get('result')}")

    all_rates: dict[str, float] = data['rates']
    return {code: all_rates[code] for code in SUPPORTED if code in all_rates}


def fetch_and_cache_exchange_rates(app) -> dict[str, float]:
    """
    Main entry point. Tries to:
      1. Return cached rates from Redis (if fresh)
      2. Fetch live rates and store in Redis
      3. Fall back to hardcoded rates on any failure

    Always returns a dict: { 'INR': 1.0, 'USD': 0.012, ... }
    """
    from shop.extensions import cache

    # ── 1. Try cache first ────────────────────────────────────────────────
    with app.app_context():
        cached = cache.get(CACHE_KEY)
        if cached:
            logger.debug('Currency rates: served from cache')
            return cached if isinstance(cached, dict) else json.loads(cached)

        # ── 2. Fetch live ─────────────────────────────────────────────────
        try:
            rates = _fetch_live_rates()
            cache.set(CACHE_KEY, rates, timeout=CACHE_TTL)
            logger.info(
                'Currency rates: fetched live at %s — %s',
                datetime.utcnow().isoformat(),
                rates,
            )
            return rates
        except Exception as exc:
            logger.warning('Currency rates: live fetch failed (%s) — using fallback', exc)
            # Cache the fallback for 1 hour so we don't hammer the API on every request
            cache.set(CACHE_KEY, FALLBACK_RATES, timeout=3_600)
            return FALLBACK_RATES


def get_cached_rates(app) -> dict[str, float]:
    """
    Return rates from cache only (no live fetch).
    Used by the API route — if cache is cold, triggers a fresh fetch.
    """
    return fetch_and_cache_exchange_rates(app)

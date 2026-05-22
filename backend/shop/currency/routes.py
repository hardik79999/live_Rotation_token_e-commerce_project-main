"""
shop/currency/routes.py — /api/currency/* blueprint.

GET /api/currency/rates
  Returns cached exchange rates (base: INR).
  Response:
    {
      "success": true,
      "data": {
        "base": "INR",
        "rates": { "INR": 1.0, "USD": 0.012, "EUR": 0.011, "GBP": 0.0095 },
        "cached_at": "<ISO timestamp or null>"
      }
    }

POST /api/currency/refresh  (admin-only convenience endpoint)
  Forces a fresh fetch from the live API and updates the cache.
"""
import logging
from flask import Blueprint, current_app, jsonify
from shop.currency.rates import get_cached_rates, fetch_and_cache_exchange_rates, CACHE_KEY
from shop.utils.api_response import success_response, error_response

logger = logging.getLogger(__name__)

currency_bp = Blueprint('currency', __name__)


@currency_bp.get('/rates')
def get_rates():
    try:
        app   = current_app._get_current_object()
        rates = get_cached_rates(app)

        # Try to surface the cache timestamp if Redis is available
        cached_at = None
        try:
            from shop.extensions import cache
            raw = cache.get(CACHE_KEY + ':ts')
            if raw:
                cached_at = raw
        except Exception:
            pass

        return success_response(
            message='Exchange rates fetched successfully',
            data={
                'base':      'INR',
                'rates':     rates,
                'cached_at': cached_at,
            },
            status_code=200,
        )
    except Exception as exc:
        logger.error('Currency rates endpoint error: %s', exc)
        return error_response('Failed to fetch exchange rates', 500)


@currency_bp.post('/refresh')
def refresh_rates():
    """Force-refresh the exchange rate cache. Useful after deployment."""
    try:
        app   = current_app._get_current_object()
        # Invalidate existing cache entry
        from shop.extensions import cache
        cache.delete(CACHE_KEY)
        # Fetch fresh
        rates = fetch_and_cache_exchange_rates(app)
        return success_response(
            message='Exchange rates refreshed',
            data={'base': 'INR', 'rates': rates},
            status_code=200,
        )
    except Exception as exc:
        logger.error('Currency refresh error: %s', exc)
        return error_response('Failed to refresh exchange rates', 500)

"""
shop/utils/cache_utils.py — Smart cache invalidation helpers.

Call these after any write that changes the public product catalog:
  • Seller creates / updates / deletes a product
  • Admin blocks a seller or revokes a category permission
  • A COD order is placed (stock deducted immediately)
  • Payment is verified for an online order (stock deducted)

Strategy
────────
We use targeted key deletion where possible (single product) and
prefix-based deletion for the product list (all paginated/filtered
variants share the 'catalog:products' prefix).

Flask-Caching with RedisCache supports cache.delete_many() and
direct Redis SCAN+DEL for prefix patterns.  With SimpleCache (fallback)
we call cache.clear() which is safe because SimpleCache is per-process.
"""
import logging
from flask import current_app

logger = logging.getLogger(__name__)


def _safe_invalidate(fn_name: str, *args, **kwargs):
    """
    Run a cache operation and swallow any Redis errors so the API
    never crashes because of a cache failure.
    """
    from shop.extensions import cache
    try:
        getattr(cache, fn_name)(*args, **kwargs)
    except Exception as e:
        logger.warning(f'Cache invalidation failed ({fn_name}): {e}')


def invalidate_product_catalog():
    """
    Wipe all cached product list pages and the categories list.
    Called when any product or category changes.
    """
    from shop.extensions import cache

    try:
        cache_type = current_app.config.get('CACHE_TYPE', 'SimpleCache')

        if cache_type == 'RedisCache':
            # Use the raw Redis client to SCAN+DEL all keys matching our prefixes
            redis_client = cache.cache._write_client   # underlying redis.Redis instance
            prefix       = current_app.config.get('CACHE_KEY_PREFIX', 'shophub:')

            deleted = 0
            for pattern in (
                f'{prefix}catalog:products*',
                f'{prefix}catalog:categories*',
                f'{prefix}catalog:product:*',
            ):
                cursor = 0
                while True:
                    cursor, keys = redis_client.scan(cursor, match=pattern, count=200)
                    if keys:
                        redis_client.delete(*keys)
                        deleted += len(keys)
                    if cursor == 0:
                        break

            logger.info(f'Cache: invalidated {deleted} catalog key(s) in Redis.')

        else:
            # SimpleCache has no prefix scan — clear everything (safe for single-process)
            cache.clear()
            logger.info('Cache: cleared SimpleCache (catalog invalidation).')

    except Exception as e:
        logger.warning(f'Cache: catalog invalidation failed — {e}')


def invalidate_single_product(product_uuid: str):
    """
    Delete the cached response for one specific product detail page.
    Also invalidates the product list because stock/price may have changed.
    """
    from shop.extensions import cache

    try:
        cache_type = current_app.config.get('CACHE_TYPE', 'SimpleCache')
        prefix     = current_app.config.get('CACHE_KEY_PREFIX', 'shophub:')

        if cache_type == 'RedisCache':
            redis_client = cache.cache._write_client
            # Delete the single-product key
            single_key = f'{prefix}catalog:product:{product_uuid}'
            redis_client.delete(single_key)
            # Also wipe product list pages (stock/price changed)
            cursor = 0
            while True:
                cursor, keys = redis_client.scan(
                    cursor, match=f'{prefix}catalog:products*', count=200
                )
                if keys:
                    redis_client.delete(*keys)
                if cursor == 0:
                    break
            logger.info(f'Cache: invalidated product {product_uuid} and product list.')
        else:
            cache.clear()

    except Exception as e:
        logger.warning(f'Cache: single-product invalidation failed — {e}')

from flask import current_app as _app
"""
shop/search/client.py — Meilisearch client singleton + index helpers.

The client is intentionally lazy: if Meilisearch is unreachable the app
still starts and falls back to the SQL LIKE search in browse.py.
"""
import logging
from typing import Optional

logger = logging.getLogger(__name__)

INDEX_NAME = 'products'

_client = None  # meilisearch.Client | None


def get_client(app=None):
    """Return the Meilisearch client, initialising it from app config if needed."""
    global _client
    if _client is not None:
        return _client

    # Lazy import — app still boots if meilisearch isn't installed yet
    try:
        import meilisearch
    except ImportError:
        logger.warning('Meilisearch: package not installed — run: pip install meilisearch')
        return None

    if app is None:
        app = _app

    url = app.config.get('MEILISEARCH_URL', 'http://localhost:7700')
    key = app.config.get('MEILISEARCH_API_KEY', '') or None

    try:
        _client = meilisearch.Client(url, key)
        _client.health()
        logger.info('Meilisearch: connected at %s ✅', url)
    except Exception as exc:
        logger.warning('Meilisearch: unavailable (%s) — falling back to SQL search', exc)
        _client = None

    return _client


def get_index(app=None):
    """Return the products index, or None if Meilisearch is unavailable."""
    client = get_client(app)
    if client is None:
        return None
    try:
        return client.index(INDEX_NAME)
    except Exception as exc:
        logger.warning('Meilisearch: could not get index — %s', exc)
        return None


def configure_index(app=None) -> None:
    """
    Idempotently configure the products index settings:
      - searchable attributes (ranked by importance)
      - filterable attributes (for category / price / stock filters)
      - sortable attributes
      - typo tolerance (enabled by default in Meilisearch, we just tune it)
      - ranking rules
    """
    client = get_client(app)
    if client is None:
        return

    try:
        idx = client.index(INDEX_NAME)

        idx.update_searchable_attributes([
            'name',           # highest weight
            'category',
            'seller_name',
            'description',    # lower weight — long text
            'spec_text',      # flattened key:value specs
        ])

        idx.update_filterable_attributes([
            'category_uuid',
            'is_active',
            'price',
            'in_stock',
            'seller_uuid',
        ])

        idx.update_sortable_attributes(['price', 'created_at'])

        idx.update_ranking_rules([
            'words',
            'typo',
            'proximity',
            'attribute',
            'sort',
            'exactness',
        ])

        # Typo tolerance: allow 1 typo for words ≥5 chars, 2 typos for ≥9
        idx.update_typo_tolerance({
            'enabled': True,
            'minWordSizeForTypos': {
                'oneTypo':  5,
                'twoTypos': 9,
            },
        })

        logger.info('Meilisearch: index "%s" configured ✅', INDEX_NAME)
    except Exception as exc:
        logger.warning('Meilisearch: configure_index failed — %s', exc)


def upsert_product(product_doc: dict) -> None:
    """Add or update a single product document in the index."""
    idx = get_index()
    if idx is None:
        return
    try:
        idx.add_documents([product_doc], primary_key='uuid')
    except Exception as exc:
        logger.warning('Meilisearch: upsert_product failed — %s', exc)


def delete_product(uuid: str) -> None:
    """Remove a product from the index by its UUID."""
    idx = get_index()
    if idx is None:
        return
    try:
        idx.delete_document(uuid)
    except Exception as exc:
        logger.warning('Meilisearch: delete_product failed — %s', exc)

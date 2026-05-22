#!/usr/bin/env python3
"""
sync_search.py — Full re-index of all active products into Meilisearch.

Usage:
    python sync_search.py              # index everything
    python sync_search.py --clear      # wipe index first, then re-index
    python sync_search.py --configure  # only (re)apply index settings

Run this:
  • Once after first setup
  • After bulk DB imports / migrations
  • Whenever you change the index settings in client.py

The Flask app context is required so SQLAlchemy can connect to the DB.
"""
import argparse
import logging
import sys
import time

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s  %(levelname)-8s  %(message)s',
    datefmt='%H:%M:%S',
)
logger = logging.getLogger('sync_search')


def build_product_doc(product, serialize_fn) -> dict:
    """
    Convert a Product ORM row into a flat Meilisearch document.

    We flatten specifications into a single `spec_text` string so Meilisearch
    can search across all spec keys/values without needing nested field support.
    """
    data = serialize_fn(product)

    # Flatten specs: "Processor: A18 Pro | Display: 6.9 inch Super Retina XDR"
    spec_text = ' | '.join(
        f"{s['key']}: {s['value']}"
        for s in (data.get('specifications') or [])
    )

    # Determine overall in_stock flag
    if data.get('has_variants'):
        in_stock = any(v['in_stock'] for v in data.get('variants', []))
    else:
        in_stock = (data.get('stock', 0) or 0) > 0

    return {
        'uuid':          data['uuid'],
        'name':          data['name'],
        'description':   data['description'],
        'price':         data['price'],
        'category':      data['category'],
        'category_uuid': data['category_uuid'],
        'primary_image': data['primary_image'],
        'seller_uuid':   data['seller_uuid'],
        'seller_name':   data['seller_name'],
        'is_active':     data['is_active'],
        'in_stock':      in_stock,
        'spec_text':     spec_text,
        # Keep created_at for "newest" sort — stored as ISO string
        'created_at':    product.created_at.isoformat() if product.created_at else None,
    }


def main():
    parser = argparse.ArgumentParser(description='Sync products → Meilisearch')
    parser.add_argument('--clear',     action='store_true', help='Delete all documents before indexing')
    parser.add_argument('--configure', action='store_true', help='Only apply index settings, skip indexing')
    parser.add_argument('--batch',     type=int, default=500, help='Documents per batch (default: 500)')
    args = parser.parse_args()

    # ── Bootstrap Flask app ───────────────────────────────────────────────
    from app import app  # noqa: E402 — app.py at project root
    from shop.models import Product, User, SellerCategory
    from shop.seller.api.helpers import serialize_seller_product
    from shop.search.client import get_client, get_index, configure_index, INDEX_NAME

    with app.app_context():
        # ── Connect + configure ───────────────────────────────────────────
        client = get_client(app)
        if client is None:
            logger.error('Cannot connect to Meilisearch. Is it running?')
            logger.error('Start it with:  docker run -d -p 7700:7700 getmeili/meilisearch:latest')
            sys.exit(1)

        configure_index(app)

        if args.configure:
            logger.info('--configure flag set. Index settings applied. Exiting.')
            return

        # ── Optionally wipe ───────────────────────────────────────────────
        if args.clear:
            logger.warning('--clear flag set. Deleting all documents in "%s"…', INDEX_NAME)
            idx = get_index(app)
            if idx:
                task = idx.delete_all_documents()
                logger.info('Delete task enqueued (taskUid=%s). Waiting…', task.task_uid)
                client.wait_for_task(task.task_uid, timeout_in_ms=30_000)
                logger.info('Index cleared ✅')

        # ── Fetch active products ─────────────────────────────────────────
        logger.info('Fetching active products from database…')
        products = (
            Product.query
            .join(User,           User.id           == Product.seller_id)
            .join(SellerCategory, (SellerCategory.seller_id   == Product.seller_id) &
                                  (SellerCategory.category_id == Product.category_id))
            .filter(
                Product.is_active          == True,
                User.is_active             == True,
                SellerCategory.is_approved == True,
                SellerCategory.is_active   == True,
            )
            .all()
        )
        logger.info('Found %d products to index.', len(products))

        if not products:
            logger.warning('No active products found. Nothing to index.')
            return

        # ── Build documents ───────────────────────────────────────────────
        docs = []
        errors = 0
        for p in products:
            try:
                docs.append(build_product_doc(p, serialize_seller_product))
            except Exception as exc:
                logger.warning('Skipping product %s — %s', p.uuid, exc)
                errors += 1

        logger.info('Built %d documents (%d skipped due to errors).', len(docs), errors)

        # ── Batch upload ──────────────────────────────────────────────────
        idx        = get_index(app)
        batch_size = args.batch
        total      = len(docs)
        batches    = [docs[i:i + batch_size] for i in range(0, total, batch_size)]

        logger.info('Uploading %d documents in %d batch(es) of %d…', total, len(batches), batch_size)
        t0 = time.time()

        for i, batch in enumerate(batches, 1):
            task = idx.add_documents(batch, primary_key='uuid')
            logger.info('  Batch %d/%d — taskUid=%s', i, len(batches), task.task_uid)

        # Wait for the last task to confirm everything landed
        logger.info('Waiting for last indexing task to complete…')
        client.wait_for_task(task.task_uid, timeout_in_ms=120_000)

        elapsed = time.time() - t0
        logger.info('✅ Done! %d products indexed in %.1fs.', total, elapsed)
        logger.info('Open http://localhost:7700 to browse the index.')


if __name__ == '__main__':
    main()

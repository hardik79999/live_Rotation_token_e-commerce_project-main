"""
GET /api/user/product/<uuid>/recommendations

Returns up to 4 product recommendations using a two-tier strategy:

Tier 1 — Co-purchase frequency (collaborative filtering lite):
  Find all orders that contain the requested product.
  Count how often every *other* product appears in those same orders.
  Return the top-4 by co-purchase count, excluding the current product.
  Only products that pass the three-rule visibility check are returned
  (active product + active seller + approved seller-category).

Tier 2 — Category fallback:
  If Tier 1 yields fewer than 4 results (not enough order history yet),
  pad the list with random products from the same category, again
  respecting the three visibility rules and excluding already-included UUIDs.

Response shape:
  {
    "success": true,
    "source": "co_purchase" | "category_fallback" | "mixed",
    "data": [ <serialized Product>, ... ]   // 0–4 items
  }
"""
import random
from flask import jsonify, current_app
from sqlalchemy import func

from shop.extensions import db
from shop.models import (
    Order, OrderItem, Product, User, SellerCategory,
)
from shop.seller.api.helpers import serialize_seller_product
from shop.utils.api_response import error_response

# How many recommendations to return
_LIMIT = 4


def get_recommendations_action(product_uuid: str):
    try:
        # ── Resolve the product ───────────────────────────────────────────
        product = (
            Product.query
            .join(User,           User.id           == Product.seller_id)
            .join(SellerCategory, (SellerCategory.seller_id   == Product.seller_id) &
                                  (SellerCategory.category_id == Product.category_id))
            .filter(
                Product.uuid              == product_uuid,
                Product.is_active         == True,
                User.is_active            == True,
                SellerCategory.is_approved == True,
                SellerCategory.is_active   == True,
            )
            .first()
        )
        if not product:
            return error_response('Product not found', 404)

        # ── Tier 1: co-purchase frequency ─────────────────────────────────
        #
        # SQL equivalent:
        #   SELECT oi2.product_id, COUNT(*) AS freq
        #   FROM order_items oi1
        #   JOIN order_items oi2 ON oi1.order_id = oi2.order_id
        #                       AND oi2.product_id != oi1.product_id
        #   WHERE oi1.product_id = :pid
        #   GROUP BY oi2.product_id
        #   ORDER BY freq DESC
        #   LIMIT :limit
        #
        # We alias OrderItem twice to do the self-join cleanly.
        from sqlalchemy.orm import aliased

        oi1 = aliased(OrderItem, name='oi1')
        oi2 = aliased(OrderItem, name='oi2')

        co_purchase_rows = (
            db.session.query(oi2.product_id, func.count().label('freq'))
            .join(oi1, (oi1.order_id == oi2.order_id) & (oi2.product_id != oi1.product_id))
            .filter(oi1.product_id == product.id)
            .group_by(oi2.product_id)
            .order_by(func.count().desc())
            .limit(_LIMIT * 3)   # fetch extra so we can filter by visibility
            .all()
        )

        # Map product_id → frequency
        freq_map: dict[int, int] = {row.product_id: row.freq for row in co_purchase_rows}

        # ── Apply visibility rules to co-purchase candidates ──────────────
        co_purchase_products: list[Product] = []
        if freq_map:
            candidates = (
                Product.query
                .join(User,           User.id           == Product.seller_id)
                .join(SellerCategory, (SellerCategory.seller_id   == Product.seller_id) &
                                      (SellerCategory.category_id == Product.category_id))
                .filter(
                    Product.id.in_(freq_map.keys()),
                    Product.is_active         == True,
                    User.is_active            == True,
                    SellerCategory.is_approved == True,
                    SellerCategory.is_active   == True,
                )
                .all()
            )
            # Sort by frequency descending, take top _LIMIT
            candidates.sort(key=lambda p: freq_map.get(p.id, 0), reverse=True)
            co_purchase_products = candidates[:_LIMIT]

        # ── Tier 2: category fallback ─────────────────────────────────────
        excluded_ids = {product.id} | {p.id for p in co_purchase_products}
        source = 'co_purchase'

        if len(co_purchase_products) < _LIMIT:
            needed = _LIMIT - len(co_purchase_products)

            fallback_pool = (
                Product.query
                .join(User,           User.id           == Product.seller_id)
                .join(SellerCategory, (SellerCategory.seller_id   == Product.seller_id) &
                                      (SellerCategory.category_id == Product.category_id))
                .filter(
                    Product.category_id       == product.category_id,
                    Product.id.notin_(excluded_ids),
                    Product.is_active         == True,
                    User.is_active            == True,
                    SellerCategory.is_approved == True,
                    SellerCategory.is_active   == True,
                )
                .all()
            )

            # Randomise so different visitors see different fallbacks
            random.shuffle(fallback_pool)
            fallback_products = fallback_pool[:needed]

            if co_purchase_products:
                source = 'mixed'
            elif fallback_products:
                source = 'category_fallback'
            else:
                source = 'none'

            co_purchase_products.extend(fallback_products)

        # ── Serialise ─────────────────────────────────────────────────────
        result = [serialize_seller_product(p) for p in co_purchase_products]

        return jsonify({
            'success': True,
            'source':  source,
            'data':    result,
        }), 200

    except Exception as e:
        current_app.logger.error(f'Recommendations error: {e}')
        return error_response('Failed to fetch recommendations', 500)

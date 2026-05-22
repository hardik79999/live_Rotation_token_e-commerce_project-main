"""
shop/search/routes.py — /api/search/* blueprint.

GET /api/search/products?q=<query>&limit=<n>&category_uuid=<uuid>&min_price=<f>&max_price=<f>&in_stock=<0|1>

Response shape (mirrors the existing browse API so the frontend needs zero changes):
  {
    "success": true,
    "message": "...",
    "data": [ <Product>, ... ],
    "total_results": 42,
    "total_pages": 5,
    "current_page": 1,
    "source": "meilisearch" | "sql_fallback"
  }
"""
import logging
from flask import Blueprint, request, current_app
from shop.search.client import get_index
from shop.models import Product, User, SellerCategory, Category
from shop.seller.api.helpers import serialize_seller_product
from shop.utils.api_response import error_response, success_response

logger = logging.getLogger(__name__)

search_bp = Blueprint('search', __name__)


@search_bp.get('/products')
def search_products():
    q             = request.args.get('q', '').strip()
    limit         = min(request.args.get('limit',    10,  type=int), 50)
    page          = max(request.args.get('page',      1,  type=int), 1)
    category_uuid = request.args.get('category_uuid', '').strip()
    min_price     = request.args.get('min_price', None, type=float)
    max_price     = request.args.get('max_price', None, type=float)
    in_stock      = request.args.get('in_stock',  '').lower() in ('1', 'true', 'yes')
    sort_by       = request.args.get('sort_by', 'newest')

    # ── Try Meilisearch first ─────────────────────────────────────────────
    idx = get_index(current_app._get_current_object())
    if idx is not None and q:
        try:
            return _meili_search(idx, q, limit, page, category_uuid, min_price, max_price, in_stock, sort_by)
        except Exception as exc:
            logger.warning('Meilisearch search failed (%s) — falling back to SQL', exc)

    # ── SQL fallback (same logic as browse.py) ────────────────────────────
    return _sql_search(q, limit, page, category_uuid, min_price, max_price, in_stock, sort_by)


# ── Meilisearch path ──────────────────────────────────────────────────────

def _meili_search(idx, q, limit, page, category_uuid, min_price, max_price, in_stock, sort_by):
    # Build filter string
    filters = ['is_active = true']
    if category_uuid:
        filters.append(f'category_uuid = "{category_uuid}"')
    if min_price is not None:
        filters.append(f'price >= {min_price}')
    if max_price is not None:
        filters.append(f'price <= {max_price}')
    if in_stock:
        filters.append('in_stock = true')

    # Sort
    sort = []
    if sort_by == 'price_low_to_high':
        sort = ['price:asc']
    elif sort_by == 'price_high_to_low':
        sort = ['price:desc']
    # 'newest' → Meilisearch relevance (no explicit sort)

    params = {
        'limit':              limit,
        'offset':             (page - 1) * limit,
        'filter':             ' AND '.join(filters),
        'attributesToHighlight': ['name', 'category'],
        'highlightPreTag':    '<mark>',
        'highlightPostTag':   '</mark>',
    }
    if sort:
        params['sort'] = sort

    result      = idx.search(q, params)
    hits        = result.get('hits', [])
    total       = result.get('estimatedTotalHits', len(hits))
    total_pages = max(1, -(-total // limit))   # ceiling division

    return success_response(
        message='Search results',
        data=hits,
        status_code=200,
        total_results=total,
        total_pages=total_pages,
        current_page=page,
        source='meilisearch',
    )


# ── SQL fallback path ─────────────────────────────────────────────────────

def _sql_search(q, limit, page, category_uuid, min_price, max_price, in_stock, sort_by):

    try:
        query = (
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
        )

        if q:
            query = query.filter(
                Product.name.ilike(f'%{q}%') |
                Product.description.ilike(f'%{q}%')
            )
        if category_uuid:
            cat = Category.query.filter_by(uuid=category_uuid, is_active=True).first()
            if cat:
                query = query.filter(Product.category_id == cat.id)
        if min_price is not None:
            query = query.filter(Product.price >= min_price)
        if max_price is not None:
            query = query.filter(Product.price <= max_price)
        if in_stock:
            query = query.filter(Product.stock > 0)

        if sort_by == 'price_low_to_high':
            query = query.order_by(Product.price.asc())
        elif sort_by == 'price_high_to_low':
            query = query.order_by(Product.price.desc())
        else:
            query = query.order_by(Product.created_at.desc())

        paginated = query.paginate(page=page, per_page=limit, error_out=False)
        data      = [serialize_seller_product(p) for p in paginated.items]

        return success_response(
            message='Search results (SQL fallback)',
            data=data,
            status_code=200,
            total_results=paginated.total,
            total_pages=paginated.pages,
            current_page=paginated.page,
            source='sql_fallback',
        )
    except Exception as exc:
        return error_response(str(exc), 500)

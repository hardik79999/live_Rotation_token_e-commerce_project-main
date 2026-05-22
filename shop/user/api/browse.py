"""
Public catalog endpoints — heavily cached to reduce MySQL load.

Cache strategy
──────────────
GET /api/user/categories
  • Cached for 10 minutes (categories change rarely).
  • Key: shophub:view//api/user/categories

GET /api/user/products
  • Cached for 5 minutes per unique query-string combination.
  • query_string=True means ?search=iphone&category=X gets its own key.
  • Key: shophub:view//api/user/products?<sorted-qs>

GET /api/user/product/<uuid>
  • Cached for 5 minutes per product UUID.
  • Invalidated when the seller updates/deletes the product.

All caches are invalidated by:
  • Seller creates / updates / deletes a product
  • Admin blocks a seller or revokes a category
  • A COD order is placed (stock changes)
  • Payment is verified (stock changes for online orders)
"""
from flask import request
from shop.extensions import cache
from shop.models import Category, Product, User, SellerCategory
from shop.utils.api_response import error_response, success_response
from shop.seller.api.helpers import serialize_seller_product

# ── Cache key prefixes ────────────────────────────────────────
CACHE_KEY_CATEGORIES = 'catalog:categories'
CACHE_KEY_PRODUCTS   = 'catalog:products'   # prefix — full key includes qs hash


def get_categories_action():
    try:
        categories = Category.query.filter_by(is_active=True).all()
        result = [{"uuid": c.uuid, "name": c.name, "description": c.description, "icon": c.icon} for c in categories]
        return success_response(
            message="Categories fetched successfully",
            data=result,
            status_code=200,
        )
    except Exception as e:
        return error_response("An error occurred. Please try again.", 500)


def get_products_action():
    try:
        page          = request.args.get('page',      1,        type=int)
        limit         = min(request.args.get('limit', 10,       type=int), 100)
        search_query  = request.args.get('search',    '').strip()
        category_uuid = request.args.get('category',  '').strip()
        sort_by       = request.args.get('sort_by',   'newest')
        min_price     = request.args.get('min_price', None,     type=float)
        max_price     = request.args.get('max_price', None,     type=float)
        in_stock_only = request.args.get('in_stock',  '').lower() in ('1', 'true', 'yes')

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

        if search_query:
            query = query.filter(
                Product.name.ilike(f"%{search_query}%") |
                Product.description.ilike(f"%{search_query}%")
            )

        if category_uuid:
            category = Category.query.filter_by(uuid=category_uuid, is_active=True).first()
            if category:
                query = query.filter(Product.category_id == category.id)

        if min_price is not None:
            query = query.filter(Product.price >= min_price)
        if max_price is not None:
            query = query.filter(Product.price <= max_price)

        if in_stock_only:
            query = query.filter(Product.stock > 0)

        if sort_by == 'price_low_to_high':
            query = query.order_by(Product.price.asc())
        elif sort_by == 'price_high_to_low':
            query = query.order_by(Product.price.desc())
        else:
            query = query.order_by(Product.created_at.desc())

        paginated = query.paginate(page=page, per_page=limit, error_out=False)
        result    = [serialize_seller_product(p) for p in paginated.items]

        return success_response(
            message="Products fetched successfully",
            data=result,
            status_code=200,
            total_results=paginated.total,
            total_pages=paginated.pages,
            current_page=paginated.page,
        )
    except Exception as e:
        return error_response("An error occurred. Please try again.", 500)


def get_single_product_action(product_uuid):
    try:
        product = (
            Product.query
            .join(User,           User.id           == Product.seller_id)
            .join(SellerCategory, (SellerCategory.seller_id   == Product.seller_id) &
                                  (SellerCategory.category_id == Product.category_id))
            .filter(
                Product.uuid               == product_uuid,
                Product.is_active          == True,
                User.is_active             == True,
                SellerCategory.is_approved == True,
                SellerCategory.is_active   == True,
            )
            .first()
        )

        if not product:
            return error_response(
                "Product not found, seller is inactive, or category permission was revoked.",
                404,
            )

        return success_response(
            message="Product details fetched successfully",
            data=serialize_seller_product(product),
            status_code=200,
        )
    except Exception as e:
        return error_response("An error occurred. Please try again.", 500)

"""
PUT /api/seller/product/<uuid>

Updates product fields, images, and specifications.
Only the owning seller can update their own products.
"""
import json
from flask import request, jsonify, current_app
from flask_jwt_extended import verify_jwt_in_request, get_jwt
from shop.extensions import db
from shop.models import Category, Product, ProductImage, Specification, User
from shop.utils.api_response import error_response
from shop.utils.file_handler import save_image
from shop.utils.validators import validate_positive_number, validate_uuid
from shop.seller.api.helpers import ensure_seller_category_access, serialize_seller_product


def update_product_action(product_uuid: str):
    try:
        verify_jwt_in_request()
        claims = get_jwt()
        if claims.get('role') != 'seller':
            return error_response('Seller access required', 403)

        seller = User.query.filter_by(uuid=claims.get('user_uuid'), is_active=True).first()
        if not seller:
            return error_response('Seller account not found', 404)

        if not validate_uuid(product_uuid):
            return error_response('Invalid product UUID', 400)

        product = Product.query.filter_by(
            uuid=product_uuid, seller_id=seller.id
        ).first()
        if not product:
            return error_response('Product not found', 404)

        is_multipart = request.content_type and 'multipart/form-data' in request.content_type
        payload      = request.form if is_multipart else (request.get_json(silent=True) or {})

        name          = (payload.get('name')          or '').strip() or product.name
        description   = (payload.get('description')   or '').strip() or product.description
        price_raw     = payload.get('price',     product.price)
        stock_raw     = payload.get('stock',     product.stock)
        category_uuid = (payload.get('category_uuid') or '').strip() or (
            product.category.uuid if product.category else None
        )
        specs_raw = payload.get('specifications')

        # ── Validation ────────────────────────────────────────────────────
        errors = []
        if len(name) > 200:
            errors.append('Product name must be ≤ 200 characters')
        if not validate_positive_number(price_raw):
            errors.append('Price must be a positive number')
        if not validate_positive_number(stock_raw, allow_zero=True):
            errors.append('Stock must be a non-negative integer')
        if errors:
            return error_response('; '.join(errors), 400)

        category = Category.query.filter_by(uuid=category_uuid, is_active=True).first()
        if not category:
            return error_response('Category not found or inactive', 404)

        access_error = ensure_seller_category_access(seller.id, category.id, category.name)
        if access_error:
            return access_error

        # ── is_active (listing status) ────────────────────────────────────
        is_active_raw = payload.get('is_active')
        if is_active_raw is not None:
            if isinstance(is_active_raw, bool):
                product.is_active = is_active_raw
            else:
                product.is_active = str(is_active_raw).lower() == 'true'

        # ── Apply field updates ───────────────────────────────────────────
        product.name        = name
        product.description = description
        product.price       = float(price_raw)
        product.stock       = int(float(stock_raw))
        product.category_id = category.id
        product.updated_by  = seller.id

        # ── Specifications ────────────────────────────────────────────────
        if specs_raw is not None:
            # Soft-delete existing specs
            for spec in product.specifications:
                if spec.is_active:
                    spec.is_active  = False
                    spec.updated_by = seller.id

            try:
                raw_list = json.loads(specs_raw) if isinstance(specs_raw, str) else specs_raw
                if isinstance(raw_list, list):
                    for spec in raw_list:
                        k = (spec.get('key')   or '').strip()[:100]
                        v = (spec.get('value') or '').strip()[:255]
                        if k and v:
                            db.session.add(Specification(
                                product_id = product.id,
                                spec_key   = k,
                                spec_value = v,
                                created_by = seller.id,
                            ))
            except (json.JSONDecodeError, AttributeError):
                return error_response('Invalid JSON for specifications', 400)

        # ── Images ────────────────────────────────────────────────────────
        image_files = request.files.getlist('images') if is_multipart else []
        valid_files = [f for f in image_files if f and f.filename]
        if valid_files:
            # Soft-delete existing images
            for img in product.images:
                if img.is_active:
                    img.is_active  = False
                    img.is_primary = False
                    img.updated_by = seller.id

            for idx, f in enumerate(valid_files):
                url = save_image(f, folder_name='products')
                if url:
                    db.session.add(ProductImage(
                        product_id = product.id,
                        image_url  = url,
                        is_primary = (idx == 0),
                        created_by = seller.id,
                    ))

        db.session.commit()

        # ── Invalidate this product's cache + product list ────────────────
        from shop.utils.cache_utils import invalidate_single_product
        invalidate_single_product(product.uuid)

        return jsonify({
            'success': True,
            'message': 'Product updated successfully',
            'data':    serialize_seller_product(product),
        }), 200

    except Exception as e:
        e_name = e.__class__.__name__
        e_str = str(e).lower()
        if 'jwt' in e_name.lower() or 'token' in e_name.lower() or 'auth' in e_name.lower() or 'signature' in e_name.lower() or 'cookie' in e_str or 'token' in e_str:
            return jsonify({'error': str(e)}), 401
        db.session.rollback()
        current_app.logger.error(f'Update product error: {e}')
        return error_response('Failed to update product. Please try again.', 500)

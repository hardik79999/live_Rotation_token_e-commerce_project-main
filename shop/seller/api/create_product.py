"""
POST /api/seller/product

Creates a new product with images and specifications.
Validates all inputs before any DB write.
"""
import json
from flask import request, jsonify, current_app
from flask_jwt_extended import verify_jwt_in_request, get_jwt
from shop.extensions import db
from shop.models import Category, Product, ProductImage, ProductVariant, Specification, User
from shop.utils.api_response import error_response
from shop.utils.file_handler import save_image
from shop.utils.validators import validate_positive_number, validate_uuid
from shop.seller.api.helpers import ensure_seller_category_access


def create_product_action():
    try:
        verify_jwt_in_request()
        claims = get_jwt()
        if claims.get('role') != 'seller':
            return error_response('Seller access required', 403)

        seller = User.query.filter_by(uuid=claims.get('user_uuid'), is_active=True).first()
        if not seller:
            return error_response('Seller account not found', 404)

        name          = (request.form.get('name')          or '').strip()
        description   = (request.form.get('description')   or '').strip()
        price_raw     = request.form.get('price')
        stock_raw     = request.form.get('stock', '0')
        category_uuid = (request.form.get('category_uuid') or '').strip()
        specs_raw     = request.form.get('specifications')
        variants_raw  = request.form.get('variants')   # JSON array of variant objects

        # ── Validation ────────────────────────────────────────────────────
        errors = []
        if not name:
            errors.append('Product name is required')
        elif len(name) > 200:
            errors.append('Product name must be ≤ 200 characters')

        if not description:
            errors.append('Description is required')

        if not validate_positive_number(price_raw):
            errors.append('Price must be a positive number')

        if not validate_positive_number(stock_raw, allow_zero=True):
            errors.append('Stock must be a non-negative integer')

        if not category_uuid or not validate_uuid(category_uuid):
            errors.append('Valid category_uuid is required')

        if errors:
            return error_response('; '.join(errors), 400)

        category = Category.query.filter_by(uuid=category_uuid, is_active=True).first()
        if not category:
            return error_response('Category not found or inactive', 404)

        access_error = ensure_seller_category_access(seller.id, category.id, category.name)
        if access_error:
            return access_error

        # ── Parse specifications ──────────────────────────────────────────
        parsed_specs = []
        if specs_raw:
            try:
                raw_list = json.loads(specs_raw) if isinstance(specs_raw, str) else specs_raw
                if not isinstance(raw_list, list):
                    return error_response('specifications must be a JSON array', 400)
                for spec in raw_list:
                    k = (spec.get('key')   or '').strip()[:100]
                    v = (spec.get('value') or '').strip()[:255]
                    if k and v:
                        parsed_specs.append((k, v))
            except (json.JSONDecodeError, AttributeError):
                return error_response('Invalid JSON for specifications', 400)

        # ── Save images ───────────────────────────────────────────────────
        # Each file can optionally carry a variant_uuid in the field name:
        # images[]  → shared image (no variant)
        # images[<variant_uuid>]  → variant-specific image
        image_files = request.files.getlist('images')
        saved_urls: list[tuple[str, str | None]] = []   # (url, variant_uuid_or_None)
        for f in image_files:
            if f and f.filename:
                url = save_image(f, folder_name='products')
                if url:
                    saved_urls.append((url, None))

        # Also handle variant-keyed image fields: images[<variant_uuid>]
        variant_image_map: dict[str, list[str]] = {}
        for key in request.files:
            if key.startswith('images[') and key.endswith(']'):
                v_uuid = key[7:-1]
                for f in request.files.getlist(key):
                    if f and f.filename:
                        url = save_image(f, folder_name='products')
                        if url:
                            variant_image_map.setdefault(v_uuid, []).append(url)

        # ── Parse variants ────────────────────────────────────────────────
        parsed_variants: list[dict] = []
        if variants_raw:
            try:
                raw_list = json.loads(variants_raw) if isinstance(variants_raw, str) else variants_raw
                if isinstance(raw_list, list):
                    for v in raw_list:
                        parsed_variants.append({
                            'color_name':       (v.get('color_name') or '').strip()[:80] or None,
                            'color_code':       (v.get('color_code') or '').strip()[:10] or None,
                            'size':             (v.get('size')        or '').strip()[:40] or None,
                            'additional_price': float(v.get('additional_price', 0) or 0),
                            'stock_quantity':   max(0, int(v.get('stock_quantity', 0) or 0)),
                            'temp_uuid':        (v.get('uuid') or '').strip(),  # client-side temp ID
                        })
            except (json.JSONDecodeError, ValueError, TypeError):
                return error_response('Invalid JSON for variants', 400)

        # ── Persist ───────────────────────────────────────────────────────
        product = Product(
            name        = name,
            description = description,
            price       = float(price_raw),
            stock       = int(float(stock_raw)),
            category_id = category.id,
            seller_id   = seller.id,
            created_by  = seller.id,
        )
        db.session.add(product)
        db.session.flush()

        # Create variants first so we can map temp_uuid → real DB id
        temp_uuid_to_variant: dict[str, ProductVariant] = {}
        for vd in parsed_variants:
            variant = ProductVariant(
                product_id       = product.id,
                color_name       = vd['color_name'],
                color_code       = vd['color_code'],
                size             = vd['size'],
                additional_price = vd['additional_price'],
                stock_quantity   = vd['stock_quantity'],
                created_by       = seller.id,
            )
            db.session.add(variant)
            db.session.flush()
            if vd['temp_uuid']:
                temp_uuid_to_variant[vd['temp_uuid']] = variant

        # Shared images (no variant)
        for idx, (url, _) in enumerate(saved_urls):
            db.session.add(ProductImage(
                product_id = product.id,
                variant_id = None,
                image_url  = url,
                is_primary = (idx == 0 and not parsed_variants),
                sort_order = idx,
                created_by = seller.id,
            ))

        # Variant-specific images
        for temp_uuid, urls in variant_image_map.items():
            variant = temp_uuid_to_variant.get(temp_uuid)
            for idx, url in enumerate(urls):
                db.session.add(ProductImage(
                    product_id = product.id,
                    variant_id = variant.id if variant else None,
                    image_url  = url,
                    is_primary = (idx == 0),
                    sort_order = idx,
                    created_by = seller.id,
                ))

        for k, v in parsed_specs:
            db.session.add(Specification(
                product_id = product.id,
                spec_key   = k,
                spec_value = v,
                created_by = seller.id,
            ))

        db.session.commit()

        # ── Invalidate product catalog cache ──────────────────────────────
        from shop.utils.cache_utils import invalidate_product_catalog
        invalidate_product_catalog()

        return jsonify({
            'success': True,
            'message': 'Product created successfully',
            'data':    {'uuid': product.uuid, 'name': product.name},
        }), 201

    except Exception as e:
        e_name = e.__class__.__name__
        e_str = str(e).lower()
        if 'jwt' in e_name.lower() or 'token' in e_name.lower() or 'auth' in e_name.lower() or 'signature' in e_name.lower() or 'cookie' in e_str or 'token' in e_str:
            return jsonify({'error': str(e)}), 401
        db.session.rollback()
        current_app.logger.error(f'Create product error: {e}')
        return error_response('Failed to create product. Please try again.', 500)

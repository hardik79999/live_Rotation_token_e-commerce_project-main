from shop.models import ProductImage, ProductVariant, Specification, SellerCategory
from shop.utils.api_response import error_response

def serialize_seller_product(product):
    # ── Images (all active, sorted) ───────────────────────────────────────
    images = (
        ProductImage.query
        .filter_by(product_id=product.id, is_active=True)
        .order_by(ProductImage.sort_order.asc(), ProductImage.created_at.asc())
        .all()
    )

    primary_image = next((img for img in images if img.is_primary), images[0] if images else None)

    # ── Variants ──────────────────────────────────────────────────────────
    variants = (
        ProductVariant.query
        .filter_by(product_id=product.id, is_active=True)
        .order_by(ProductVariant.id.asc())
        .all()
    )

    base_price = float(product.price)

    def _serialize_variant(v: ProductVariant) -> dict:
        variant_images = [
            {
                'uuid':       img.uuid,
                'url':        img.image_url,
                'is_primary': img.is_primary,
                'sort_order': img.sort_order,
            }
            for img in images if img.variant_id == v.id
        ]
        final_price = round(base_price + float(v.additional_price), 2)
        return {
            'uuid':             v.uuid,
            'variant_name':     v.variant_name,
            'sku_code':         v.sku_code,
            'color_name':       v.color_name,
            'color_code':       v.color_code,
            'size':             v.size,
            'additional_price': float(v.additional_price),
            'final_price':      final_price,          # ← base + modifier
            'stock_quantity':   v.stock_quantity,
            'in_stock':         v.stock_quantity > 0,
            'images':           variant_images,
        }

    serialized_variants = [_serialize_variant(v) for v in variants]

    # ── Default variant: cheapest in-stock, else first ────────────────────
    in_stock_variants = [v for v in serialized_variants if v['in_stock']]
    if in_stock_variants:
        default_variant = min(in_stock_variants, key=lambda v: v['final_price'])
    elif serialized_variants:
        default_variant = serialized_variants[0]
    else:
        default_variant = None

    # ── Grouped colour palette (deduplicated by color_code) ───────────────
    seen_colors: set[str] = set()
    colors = []
    for v in serialized_variants:
        key = v['color_code'] or v['color_name'] or ''
        if key and key not in seen_colors:
            seen_colors.add(key)
            colors.append({
                'color_name': v['color_name'],
                'color_code': v['color_code'],
                'in_stock':   any(
                    sv['in_stock'] for sv in serialized_variants
                    if (sv['color_code'] or sv['color_name']) == key
                ),
            })

    # ── Grouped size list (deduplicated) ──────────────────────────────────
    seen_sizes: set[str] = set()
    sizes = []
    for v in serialized_variants:
        s = v['size'] or ''
        if s and s not in seen_sizes:
            seen_sizes.add(s)
            sizes.append({
                'size':     s,
                'in_stock': any(sv['in_stock'] for sv in serialized_variants if sv['size'] == s),
            })

    # ── Shared images (variant_id IS NULL) ────────────────────────────────
    shared_images = [
        {
            'uuid':       img.uuid,
            'url':        img.image_url,
            'is_primary': img.is_primary,
            'sort_order': img.sort_order,
        }
        for img in images if img.variant_id is None
    ]

    specifications = (
        Specification.query
        .filter_by(product_id=product.id, is_active=True)
        .order_by(Specification.created_at.asc())
        .all()
    )

    seller = product.seller_user

    return {
        'uuid':                 product.uuid,
        'name':                 product.name,
        'description':          product.description,
        'price':                base_price,
        'stock':                product.stock,
        'category':             product.category.name if product.category else 'Unknown',
        'category_uuid':        product.category.uuid if product.category else None,
        'category_icon':        product.category.icon if product.category else None,
        'primary_image':        primary_image.image_url if primary_image else None,
        'images':               shared_images,
        'variants':             serialized_variants,
        'has_variants':         len(serialized_variants) > 0,
        'default_variant_uuid': default_variant['uuid'] if default_variant else None,
        'colors':               colors,    # deduplicated palette for swatches
        'sizes':                sizes,     # deduplicated size list
        'specifications':       [{'key': s.spec_key, 'value': s.spec_value} for s in specifications],
        'is_active':            product.is_active,
        'seller_uuid':          seller.uuid          if seller else None,
        'seller_name':          seller.username      if seller else None,
        'seller_photo':         seller.profile_photo if seller else None,
    }

def ensure_seller_category_access(seller_id, category_id, category_name):
    is_approved_seller = SellerCategory.query.filter_by(
        seller_id=seller_id, category_id=category_id, is_approved=True, is_active=True
    ).first()
    if not is_approved_seller:
        return error_response(
            f"Category approval required for '{category_name}'. Please request admin approval first.", 403
        )
    return None
"""
POST /api/user/product/<uuid>/review   — submit a review (multipart/form-data)
GET  /api/user/product/<uuid>/reviews  — fetch all reviews (public)

POST rules:
  • JWT required, role must be 'customer'
  • Verified-buyer check: must have a DELIVERED order containing this product
  • One review per customer per product (409 on duplicate)
  • Up to 6 images (field name: 'images', getlist) — saved via file_handler.save_image
"""
from flask import request, jsonify, current_app
from flask_jwt_extended import verify_jwt_in_request, get_jwt
from shop.extensions import db
from shop.models import Order, OrderStatus, Review, ReviewImage, User, OrderItem, Product
from shop.utils.api_response import error_response
from shop.utils.file_handler import save_image
from sqlalchemy import func

MAX_REVIEW_IMAGES = 6


def add_product_review_action(product_uuid: str):
    try:
        verify_jwt_in_request()
        claims    = get_jwt()
        user_uuid = claims.get('user_uuid')

        if claims.get('role') != 'customer':
            return error_response('Only customers can submit reviews', 403)

        user = User.query.filter_by(uuid=user_uuid, is_active=True).first()
        if not user:
            return error_response('User not found', 404)

        # ── Parse multipart or JSON ───────────────────────────────────────
        if request.content_type and 'multipart/form-data' in request.content_type:
            rating      = request.form.get('rating')
            comment     = (request.form.get('comment') or '').strip()
            image_files = request.files.getlist('images')
        else:
            data        = request.get_json(silent=True) or {}
            rating      = data.get('rating')
            comment     = (data.get('comment') or '').strip()
            image_files = []

        # ── Validate rating ───────────────────────────────────────────────
        try:
            rating = int(rating)
            if not (1 <= rating <= 5):
                raise ValueError
        except (TypeError, ValueError):
            return error_response('Rating must be an integer between 1 and 5', 400)

        if len(comment) > 1000:
            return error_response('Comment must be ≤ 1000 characters', 400)

        # ── Strict image count check ──────────────────────────────────────
        valid_files = [f for f in image_files if f and f.filename]
        if len(valid_files) > MAX_REVIEW_IMAGES:
            return error_response(
                f'Maximum {MAX_REVIEW_IMAGES} images allowed per review. You sent {len(valid_files)}.', 400
            )

        product = Product.query.filter_by(uuid=product_uuid, is_active=True).first()
        if not product:
            return error_response('Product not found', 404)

        # ── Verified buyer check ──────────────────────────────────────────
        has_delivered_order = (
            db.session.query(Order)
            .join(OrderItem, OrderItem.order_id == Order.id)
            .filter(
                Order.user_id        == user.id,
                Order.status         == OrderStatus.delivered,
                OrderItem.product_id == product.id,
            )
            .first()
        )
        if not has_delivered_order:
            return error_response('You can only review products from delivered orders.', 403)

        # ── Duplicate review check ────────────────────────────────────────
        if Review.query.filter_by(user_id=user.id, product_id=product.id).first():
            return error_response('You have already reviewed this product.', 409)

        # ── Save images ───────────────────────────────────────────────────
        saved_urls: list[str] = []
        for idx, img_file in enumerate(valid_files):
            url = save_image(img_file, folder_name='reviews')
            if url is None:
                return error_response(
                    f'Image {idx + 1} is invalid. Use JPG, PNG, or WebP under 10 MB.', 400
                )
            saved_urls.append(url)

        # ── Create review + images atomically ────────────────────────────
        new_review = Review(
            user_id    = user.id,
            product_id = product.id,
            rating     = rating,
            comment    = comment,
            # keep legacy image_url for backward compat (first image)
            image_url  = saved_urls[0] if saved_urls else None,
            created_by = user.id,
        )
        db.session.add(new_review)
        db.session.flush()  # get new_review.id before adding children

        for order_idx, url in enumerate(saved_urls):
            db.session.add(ReviewImage(
                review_id  = new_review.id,
                image_url  = url,
                sort_order = order_idx,
                created_by = user.id,
            ))

        db.session.commit()

        avg = (
            db.session.query(func.avg(Review.rating))
            .filter(Review.product_id == product.id)
            .scalar()
        )

        return jsonify({
            'success':            True,
            'message':            'Review submitted successfully',
            'new_average_rating': round(float(avg or 0), 1),
            'image_count':        len(saved_urls),
        }), 201

    except Exception as e:
        e_name = e.__class__.__name__
        e_str = str(e).lower()
        if 'jwt' in e_name.lower() or 'token' in e_name.lower() or 'auth' in e_name.lower() or 'signature' in e_name.lower() or 'cookie' in e_str or 'token' in e_str:
            return jsonify({'error': str(e)}), 401
        db.session.rollback()
        current_app.logger.error(f'Review error: {e}')
        return error_response('Failed to submit review. Please try again.', 500)


def get_product_reviews_action(product_uuid: str):
    try:
        product = Product.query.filter_by(uuid=product_uuid, is_active=True).first()
        if not product:
            return error_response('Product not found', 404)

        reviews = (
            Review.query
            .filter_by(product_id=product.id, is_active=True)
            .order_by(Review.created_at.desc())
            .all()
        )

        result = []
        for r in reviews:
            reviewer = User.query.get(r.user_id)

            # Collect images: prefer ReviewImage rows, fall back to legacy image_url
            review_images = sorted(r.images, key=lambda i: i.sort_order)
            if review_images:
                image_urls = [img.image_url for img in review_images]
            elif r.image_url:
                image_urls = [r.image_url]
            else:
                image_urls = []

            result.append({
                'uuid':       r.uuid,
                'rating':     r.rating,
                'comment':    r.comment or '',
                'images':     image_urls,
                # legacy field kept so old clients don't break
                'image_url':  image_urls[0] if image_urls else None,
                'created_at': r.created_at.strftime(f"{r.created_at.day} %b %Y") if r.created_at else None,
                'reviewer': {
                    'username':      reviewer.username if reviewer else 'Anonymous',
                    'profile_photo': reviewer.profile_photo if reviewer else None,
                },
            })

        avg = (
            db.session.query(func.avg(Review.rating))
            .filter(Review.product_id == product.id, Review.is_active == True)
            .scalar()
        )

        return jsonify({
            'success':    True,
            'data':       result,
            'total':      len(result),
            'avg_rating': round(float(avg or 0), 1),
        }), 200

    except Exception as e:
        e_name = e.__class__.__name__
        e_str = str(e).lower()
        if 'jwt' in e_name.lower() or 'token' in e_name.lower() or 'auth' in e_name.lower() or 'signature' in e_name.lower() or 'cookie' in e_str or 'token' in e_str:
            return jsonify({'error': str(e)}), 401
        current_app.logger.error(f'Get reviews error: {e}')
        return error_response('Failed to fetch reviews.', 500)

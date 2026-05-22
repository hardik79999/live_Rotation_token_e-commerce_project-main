from flask import jsonify, request, current_app
from flask_jwt_extended import verify_jwt_in_request, get_jwt
from shop.extensions import db
from shop.models import Category, User
from shop.utils.api_response import error_response, success_response

def create_category_action():
    try:
        verify_jwt_in_request()
        claims = get_jwt()

        if claims.get("role") != "admin":
            return error_response("Unauthorized! Only admins can create categories.", 403)

        data = request.get_json() or {}
        name = (data.get('name') or '').strip()
        description = (data.get('description') or '').strip()
        icon = (data.get('icon') or '').strip() or None

        if not name:
            return error_response("Category name is required", 400)

        existing_category = Category.query.filter(db.func.lower(Category.name) == name.lower()).first()
        if existing_category:
            if existing_category.is_active:
                return error_response("Category with this name already exists.", 409)

            existing_category.is_active = True
            existing_category.description = description
            existing_category.icon = icon
            admin_uuid = claims.get("user_uuid")
            admin_user = User.query.filter_by(uuid=admin_uuid).first()

            if not admin_user:
                return error_response("Admin user not found", 404)

            existing_category.updated_by = admin_user.id
            db.session.commit()

            return success_response(
                message="Category reactivated successfully",
                data={
                    "uuid":        existing_category.uuid,
                    "name":        existing_category.name,
                    "description": existing_category.description,
                    "icon":        existing_category.icon,
                },
                status_code=200,
            )

        admin_uuid = claims.get("user_uuid")
        admin_user = User.query.filter_by(uuid=admin_uuid).first()

        if not admin_user:
            return error_response("Admin user not found", 404)

        new_category = Category(
            name=name,
            description=description,
            icon=icon,
            created_by=admin_user.id
        )

        db.session.add(new_category)
        db.session.commit()

        return success_response(
            message="Category created successfully!",
            data={
                "uuid":        new_category.uuid,
                "name":        new_category.name,
                "description": new_category.description,
                "icon":        new_category.icon,
            },
            status_code=201,
        )

    except Exception as e:
        e_name = e.__class__.__name__
        e_str = str(e).lower()
        if 'jwt' in e_name.lower() or 'token' in e_name.lower() or 'auth' in e_name.lower() or 'signature' in e_name.lower() or 'cookie' in e_str or 'token' in e_str:
            return jsonify({'error': str(e)}), 401
        db.session.rollback()
        current_app.logger.error(f'create_category error: {e}', exc_info=True)
        return error_response('Failed to create category. Please try again.', 500)

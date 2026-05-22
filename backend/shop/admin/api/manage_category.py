"""
Admin category management:
  GET    /api/admin/categories              — list all categories
  PUT    /api/admin/category/<uuid>         — edit name/description
  DELETE /api/admin/category/<uuid>         — soft-delete
"""
from flask import jsonify, request
from flask_jwt_extended import verify_jwt_in_request, get_jwt
from shop.extensions import db
from shop.models import Category, User
from shop.utils.api_response import error_response, success_response


def _admin_check():
    verify_jwt_in_request()
    claims = get_jwt()
    if claims.get("role") != "admin":
        return None, error_response("Admin access required", 403)
    admin = User.query.filter_by(uuid=claims.get("user_uuid")).first()
    if not admin:
        return None, error_response("Admin user not found", 404)
    return admin, None


def list_categories_action():
    try:
        _, err = _admin_check()
        if err:
            return err

        categories = (
            Category.query
            .order_by(Category.is_active.desc(), Category.name.asc())
            .all()
        )

        result = [
            {
                "uuid":        c.uuid,
                "name":        c.name,
                "description": c.description,
                "icon":        c.icon,
                "is_active":   c.is_active,
                "created_at":  c.created_at.isoformat() if c.created_at else None,
            }
            for c in categories
        ]

        return success_response(
            message="Categories fetched",
            data=result,
            status_code=200,
            total=len(result),
        )
    except Exception as e:
        e_name = e.__class__.__name__
        e_str = str(e).lower()
        if 'jwt' in e_name.lower() or 'token' in e_name.lower() or 'auth' in e_name.lower() or 'signature' in e_name.lower() or 'cookie' in e_str or 'token' in e_str:
            return jsonify({'error': str(e)}), 401
        return error_response(str(e), 500)


def update_category_action(category_uuid: str):
    try:
        admin, err = _admin_check()
        if err:
            return err

        category = Category.query.filter_by(uuid=category_uuid).first()
        if not category:
            return error_response("Category not found", 404)

        data        = request.get_json() or {}
        new_name    = (data.get("name")        or "").strip()
        new_desc    = (data.get("description") or "").strip()
        new_icon    = data.get("icon")   # None means "don't change"; "" means "clear"

        if new_name and new_name.lower() != category.name.lower():
            conflict = Category.query.filter(
                db.func.lower(Category.name) == new_name.lower(),
                Category.uuid != category_uuid,
            ).first()
            if conflict and conflict.is_active:
                return error_response("A category with this name already exists.", 409)
            category.name = new_name

        if new_desc is not None:
            category.description = new_desc or None

        if new_icon is not None:
            category.icon = new_icon.strip() or None

        category.updated_by = admin.id
        db.session.commit()

        return success_response(
            message="Category updated",
            data={
                "uuid":        category.uuid,
                "name":        category.name,
                "description": category.description,
                "icon":        category.icon,
                "is_active":   category.is_active,
            },
            status_code=200,
        )
    except Exception as e:
        e_name = e.__class__.__name__
        e_str = str(e).lower()
        if 'jwt' in e_name.lower() or 'token' in e_name.lower() or 'auth' in e_name.lower() or 'signature' in e_name.lower() or 'cookie' in e_str or 'token' in e_str:
            return jsonify({'error': str(e)}), 401
        db.session.rollback()
        return error_response(str(e), 500)


def delete_category_action(category_uuid: str):
    try:
        admin, err = _admin_check()
        if err:
            return err

        category = Category.query.filter_by(uuid=category_uuid, is_active=True).first()
        if not category:
            return error_response("Category not found or already deleted", 404)

        category.is_active  = False
        category.updated_by = admin.id
        db.session.commit()

        return success_response(
            message=f"Category '{category.name}' deleted. All products in this category are now hidden.",
            data={"uuid": category.uuid},
            status_code=200,
        )
    except Exception as e:
        e_name = e.__class__.__name__
        e_str = str(e).lower()
        if 'jwt' in e_name.lower() or 'token' in e_name.lower() or 'auth' in e_name.lower() or 'signature' in e_name.lower() or 'cookie' in e_str or 'token' in e_str:
            return jsonify({'error': str(e)}), 401
        db.session.rollback()
        return error_response(str(e), 500)

import uuid
from flask import request, jsonify
from flask_jwt_extended import verify_jwt_in_request, get_jwt
from shop.extensions import db
from shop.models import User, Address
from shop.utils.api_response import error_response, success_response


def add_address_action():
    try:
        verify_jwt_in_request()
        user_uuid = get_jwt().get("user_uuid")
        user = User.query.filter_by(uuid=user_uuid).first()

        data = request.get_json() or {}

        required = ['full_name', 'phone_number', 'street', 'city', 'state', 'pincode']
        if not all(k in data for k in required):
            return error_response("All address fields are required", 400)

        # If this is marked as default, clear existing defaults first
        is_default = bool(data.get('is_default', False))
        if is_default:
            Address.query.filter_by(user_id=user.id, is_active=True).update({"is_default": False})

        new_address = Address(
            uuid=str(uuid.uuid4()),
            user_id=user.id,
            full_name=data['full_name'],
            phone_number=data['phone_number'],
            street=data['street'],
            city=data['city'],
            state=data['state'],
            pincode=data['pincode'],
            is_default=is_default,
            created_by=user.id
        )

        db.session.add(new_address)
        db.session.commit()

        return jsonify({
            "success": True,
            "message": "Address saved successfully!",
            "data": {
                "uuid":       new_address.uuid,
                "full_name":  new_address.full_name,
                "address_line": f"{new_address.street}, {new_address.city}, {new_address.state} - {new_address.pincode}",
                "phone":      new_address.phone_number,
                "is_default": new_address.is_default,
            }
        }), 201
    except Exception as e:
        e_name = e.__class__.__name__
        e_str = str(e).lower()
        if 'jwt' in e_name.lower() or 'token' in e_name.lower() or 'auth' in e_name.lower() or 'signature' in e_name.lower() or 'cookie' in e_str or 'token' in e_str:
            return jsonify({'error': str(e)}), 401
        db.session.rollback()
        return error_response("An error occurred. Please try again.", 500)


def get_addresses_action():
    try:
        verify_jwt_in_request()
        user = User.query.filter_by(uuid=get_jwt().get("user_uuid")).first()

        addresses = (
            Address.query
            .filter_by(user_id=user.id, is_active=True)
            .order_by(Address.is_default.desc(), Address.created_at.asc())
            .all()
        )

        result = [
            {
                "uuid":         a.uuid,
                "full_name":    a.full_name,
                "address_line": f"{a.street}, {a.city}, {a.state} - {a.pincode}",
                "phone":        a.phone_number,
                "is_default":   a.is_default,
            }
            for a in addresses
        ]

        return jsonify({"success": True, "data": result}), 200
    except Exception as e:
        e_name = e.__class__.__name__
        e_str = str(e).lower()
        if 'jwt' in e_name.lower() or 'token' in e_name.lower() or 'auth' in e_name.lower() or 'signature' in e_name.lower() or 'cookie' in e_str or 'token' in e_str:
            return jsonify({'error': str(e)}), 401
        return error_response("An error occurred. Please try again.", 500)


def set_default_address_action(address_uuid: str):
    """PUT /api/user/address/<uuid>/set-default"""
    try:
        verify_jwt_in_request()
        user = User.query.filter_by(uuid=get_jwt().get("user_uuid")).first()

        # Clear all existing defaults for this user
        Address.query.filter_by(user_id=user.id, is_active=True).update({"is_default": False})

        # Set the requested address as default
        address = Address.query.filter_by(uuid=address_uuid, user_id=user.id, is_active=True).first()
        if not address:
            return error_response("Address not found", 404)

        address.is_default = True
        db.session.commit()

        return success_response(
            message="Default address updated",
            data={"uuid": address.uuid, "is_default": True},
            status_code=200,
        )
    except Exception as e:
        e_name = e.__class__.__name__
        e_str = str(e).lower()
        if 'jwt' in e_name.lower() or 'token' in e_name.lower() or 'auth' in e_name.lower() or 'signature' in e_name.lower() or 'cookie' in e_str or 'token' in e_str:
            return jsonify({'error': str(e)}), 401
        db.session.rollback()
        return error_response("An error occurred. Please try again.", 500)


def delete_address_action(address_uuid: str):
    """DELETE /api/user/address/<uuid>"""
    try:
        verify_jwt_in_request()
        user = User.query.filter_by(uuid=get_jwt().get("user_uuid")).first()

        address = Address.query.filter_by(uuid=address_uuid, user_id=user.id, is_active=True).first()
        if not address:
            return error_response("Address not found", 404)

        address.is_active = False
        db.session.commit()

        return success_response(message="Address deleted", status_code=200)
    except Exception as e:
        e_name = e.__class__.__name__
        e_str = str(e).lower()
        if 'jwt' in e_name.lower() or 'token' in e_name.lower() or 'auth' in e_name.lower() or 'signature' in e_name.lower() or 'cookie' in e_str or 'token' in e_str:
            return jsonify({'error': str(e)}), 401
        db.session.rollback()
        return error_response("An error occurred. Please try again.", 500)

"""
POST /api/auth/profile/photo
Accepts: multipart/form-data  { photo: <file> }
Saves to: shop/static/uploads/profiles/<uuid>.ext
Updates: User.profile_photo in DB

Supported formats: jpg, jpeg, png, webp, gif, bmp, tiff, avif, heic, heif, svg
Max size: 10 MB
"""
import os
from flask import jsonify, request, current_app
from flask_jwt_extended import verify_jwt_in_request, get_jwt
from shop.extensions import db
from shop.models import User
from shop.utils.api_response import error_response, success_response
from shop.utils.file_handler import save_image, ALLOWED_EXTENSIONS, MAX_SIZE_BYTES


def upload_profile_photo_action():
    try:
        verify_jwt_in_request()
        user_uuid = get_jwt().get("user_uuid")

        user = User.query.filter_by(uuid=user_uuid, is_active=True).first()
        if not user:
            return error_response("User not found", 404)

        if 'photo' not in request.files:
            return error_response("No file uploaded. Field name must be 'photo'.", 400)

        file = request.files['photo']

        if not file or file.filename == '':
            return error_response("Empty file", 400)

        # Delegate all validation + saving to the shared utility
        photo_url = save_image(file, folder_name="profiles")

        if not photo_url:
            allowed_list = ', '.join(sorted(ALLOWED_EXTENSIONS))
            max_mb       = MAX_SIZE_BYTES // (1024 * 1024)
            return error_response(
                f"Invalid file. Allowed formats: {allowed_list}. Max size: {max_mb} MB.",
                400,
            )

        # Delete old photo file if it exists
        if user.profile_photo:
            old_path = os.path.join(
                current_app.root_path,
                user.profile_photo.lstrip('/')
            )
            if os.path.isfile(old_path):
                try:
                    os.remove(old_path)
                except OSError:
                    pass   # non-fatal — don't block the upload

        # Persist
        user.profile_photo = photo_url
        user.updated_by    = user.id
        db.session.commit()

        return success_response(
            message="Profile photo updated successfully",
            data={"profile_photo": photo_url},
            status_code=200,
        )

    except Exception as e:
        e_name = e.__class__.__name__
        e_str = str(e).lower()
        if 'jwt' in e_name.lower() or 'token' in e_name.lower() or 'auth' in e_name.lower() or 'signature' in e_name.lower() or 'cookie' in e_str or 'token' in e_str:
            return jsonify({'error': str(e)}), 401
        db.session.rollback()
        current_app.logger.error(f'profile_photo upload error: {e}', exc_info=True)
        return error_response('Failed to upload photo. Please try again.', 500)

from shop.auth import auth_bp
from shop.extensions import limiter

from shop.auth.api.signup         import signup_action
from shop.auth.api.login          import login_action
from shop.auth.api.logout         import logout_action
from shop.auth.api.profile        import profile_action, update_profile_action
from shop.auth.api.profile_photo  import upload_profile_photo_action
from shop.auth.api.profile_delete import profile_delete_action
from shop.auth.api.refresh        import refresh_action
from shop.auth.api.forgot_password import forgot_password_action
from shop.auth.api.reset_password  import reset_password_action
from shop.auth.api.verify_email    import verify_email_action
from shop.auth.api.google_oauth    import google_login_action, google_callback_action, google_exchange_action


@auth_bp.route('/signup', methods=['POST'])
@limiter.limit('10 per hour')
def signup_route():
    """
    User Registration (Signup)
    ---
    tags:
      - 🔐 Authentication
    parameters:
      - name: body
        in: body
        required: true
        schema:
          properties:
            username: {type: string}
            email: {type: string}
            password: {type: string}
            phone: {type: string}
            role: {type: string, enum: ['customer', 'seller']}
    responses:
      201:
        description: User created successfully
    """
    return signup_action()


@auth_bp.route('/login', methods=['POST'])
@limiter.limit('10 per minute')
def login_route():
    """
    User Login
    ---
    tags:
      - 🔐 Authentication
    parameters:
      - name: body
        in: body
        required: true
        schema:
          properties:
            email: {type: string}
            password: {type: string}
    responses:
      200:
        description: Returns Access & Refresh Tokens in Cookies
    """
    return login_action()


@auth_bp.route('/refresh-token', methods=['POST'])
@limiter.limit('30 per minute')
def refresh_route():
    """
    Refresh Access Token
    ---
    tags:
      - 🔐 Authentication
    security:
      - CSRF-Token: []
    responses:
      200:
        description: New Access Token generated
    """
    return refresh_action()


@auth_bp.route('/profile', methods=['GET'])
def profile_route():
    """
    Get User Profile
    ---
    tags:
      - 👤 User Profile
    security:
      - CSRF-Token: []
    responses:
      200:
        description: User details fetched
    """
    return profile_action()


@auth_bp.route('/profile', methods=['PUT'])
def update_profile_route():
    """
    Update Profile (username / phone)
    ---
    tags:
      - 👤 User Profile
    security:
      - CSRF-Token: []
    parameters:
      - name: body
        in: body
        required: true
        schema:
          properties:
            username: {type: string}
            phone: {type: string}
    responses:
      200:
        description: Profile updated
    """
    return update_profile_action()


@auth_bp.route('/profile/photo', methods=['POST'])
@limiter.limit('20 per hour')
def upload_profile_photo_route():
    """
    Upload Profile Photo
    ---
    tags:
      - 👤 User Profile
    security:
      - CSRF-Token: []
    consumes:
      - multipart/form-data
    parameters:
      - name: photo
        in: formData
        type: file
        required: true
    responses:
      200:
        description: Photo uploaded
    """
    return upload_profile_photo_action()


@auth_bp.route('/logout', methods=['POST'])
def logout_route():
    """
    Logout User
    ---
    tags:
      - 🔐 Authentication
    security:
      - CSRF-Token: []
    responses:
      200:
        description: Successfully logged out
    """
    return logout_action()


@auth_bp.route('/forgot-password', methods=['POST'])
@limiter.limit('5 per hour')
def forgot_password_route():
    """
    Forgot Password (Send OTP)
    ---
    tags:
      - 🔐 Authentication
    parameters:
      - name: body
        in: body
        required: true
        schema:
          properties:
            email: {type: string}
    responses:
      200:
        description: OTP sent to email (if registered)
    """
    return forgot_password_action()


@auth_bp.route('/reset-password', methods=['POST'])
@limiter.limit('10 per hour')
def reset_password_route():
    """
    Reset Password using OTP
    ---
    tags:
      - 🔐 Authentication
    parameters:
      - name: body
        in: body
        required: true
        schema:
          properties:
            email: {type: string}
            otp_code: {type: string}
            new_password: {type: string}
    responses:
      200:
        description: Password reset successful
    """
    return reset_password_action()


@auth_bp.route('/delete-account', methods=['DELETE'])
def delete_account_route():
    """
    Delete User Account (Soft Delete)
    ---
    tags:
      - 👤 User Profile
    security:
      - CSRF-Token: []
    responses:
      200:
        description: Account deleted
    """
    return profile_delete_action()


@auth_bp.route('/verify/<token>', methods=['GET'])
def verify_email_route(token):
    """
    Verify Email Address
    ---
    tags:
      - 🔐 Authentication
    parameters:
      - name: token
        in: path
        type: string
        required: true
    responses:
      302:
        description: Redirects to frontend login page with result param
    """
    return verify_email_action(token)


@auth_bp.route('/google/login', methods=['GET'])
@limiter.limit('20 per minute')
def google_login_route():
    """
    Initiate Google OAuth Login
    ---
    tags:
      - 🔐 Authentication
    responses:
      302:
        description: Redirects to Google consent screen
    """
    return google_login_action()


@auth_bp.route('/google/callback', methods=['GET'])
def google_callback_route():
    """
    Google OAuth Callback
    ---
    tags:
      - 🔐 Authentication
    responses:
      302:
        description: Redirects to React with one-time token in URL
    """
    return google_callback_action()


@auth_bp.route('/google/exchange', methods=['GET'])
def google_exchange_route():
    """
    Exchange Google OTT for JWT cookies
    ---
    tags:
      - 🔐 Authentication
    parameters:
      - name: ott
        in: query
        type: string
        required: true
    responses:
      200:
        description: JWT cookies set, user profile returned
    """
    return google_exchange_action()

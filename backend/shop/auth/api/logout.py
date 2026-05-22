import logging
from flask_jwt_extended import unset_jwt_cookies
from shop.utils.api_response import error_response, success_response

logger = logging.getLogger(__name__)


def logout_action():
    try:
        response, status_code = success_response(
            message='Logout successful',
            data=None,
            status_code=200,
        )
        unset_jwt_cookies(response)
        return response, status_code

    except Exception as e:
        logger.error(f'Logout error: {e}', exc_info=True)
        return error_response('Logout failed. Please try again.', 500)

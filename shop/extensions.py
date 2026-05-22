from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_bcrypt import Bcrypt
from flask_jwt_extended import JWTManager
from flask_mail import Mail
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_socketio import SocketIO
from flask_caching import Cache

db = SQLAlchemy()
migrate = Migrate()
bcrypt = Bcrypt()
jwt = JWTManager()
mail = Mail()
cors = CORS()
limiter = Limiter(
    key_func=get_remote_address,
    storage_uri="memory://"
)
socketio = SocketIO()

# Cache is initialised lazily via cache.init_app(app) in create_app().
# Config (CACHE_TYPE, CACHE_REDIS_URL) is set there from app.config.
cache = Cache()
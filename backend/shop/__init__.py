from flask import Flask, jsonify, send_from_directory, request
from config import Config
from shop.extensions import db, migrate, jwt, bcrypt, mail, limiter, cors, socketio, cache
from flasgger import Swagger
from werkzeug.middleware.proxy_fix import ProxyFix
import os
import re


def create_app(config_class=Config):
    # ── Resolve the React dist folder ────────────────────────────────────
    BACKEND_DIR = os.path.abspath(os.path.dirname(os.path.dirname(__file__)))
    PROJECT_ROOT = os.path.dirname(BACKEND_DIR)
    DIST_DIR = os.path.join(PROJECT_ROOT, 'frontend', 'dist')

    app = Flask(
        __name__,
        static_folder=DIST_DIR,
        static_url_path='',
    )
    app.config.from_object(config_class)

    # ── Logging ──────────────────────────────────────────────────────────
    import logging
    from logging.handlers import RotatingFileHandler

    logs_dir = os.path.join(BACKEND_DIR, 'logs')
    os.makedirs(logs_dir, exist_ok=True)

    file_handler = RotatingFileHandler(
        os.path.join(logs_dir, 'ecom_app.log'),
        maxBytes=5_000_000,   # 5 MB per file
        backupCount=10,
        encoding='utf-8',
    )
    file_handler.setFormatter(logging.Formatter(
        '%(asctime)s %(levelname)s [%(name)s]: %(message)s [%(pathname)s:%(lineno)d]'
    ))
    file_handler.setLevel(logging.INFO)
    app.logger.addHandler(file_handler)
    app.logger.setLevel(logging.INFO)
    app.logger.info('E-Commerce API Startup 🚀')

    # ── Extensions ───────────────────────────────────────────────────────
    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    bcrypt.init_app(app)
    mail.init_app(app)
    limiter.init_app(app)

    # ── Cache (Redis → SimpleCache fallback) ──────────────────────────────
    # If Redis is configured but unreachable, we catch the connection error
    # at init time and fall back to SimpleCache so the app never crashes.
    try:
        cache.init_app(app)
        # Probe the connection only when Redis is configured
        if app.config.get('CACHE_TYPE') == 'RedisCache':
            with app.app_context():
                cache.get('__probe__')   # raises if Redis is down
            app.logger.info('Cache: Redis connected ✅')
    except Exception as cache_err:
        app.logger.warning(
            f'Cache: Redis unavailable ({cache_err}). '
            'Falling back to SimpleCache — performance will be reduced.'
        )
        app.config['CACHE_TYPE'] = 'SimpleCache'
        cache.init_app(app)   # re-init with SimpleCache

    # ── CORS ─────────────────────────────────────────────────────────────
    def _normalize_origins(origins):
        normalized = []
        for origin in origins:
            if '*' in origin:
                normalized.append(re.compile('^' + re.escape(origin).replace('\\*', '.*') + '$'))
            else:
                normalized.append(origin)
        return normalized

    cors_allowed_origins = _normalize_origins(app.config['FRONTEND_ORIGINS'])

    cors.init_app(
        app,
        resources={
            r'/api/*': {
                'origins':              cors_allowed_origins,
                'supports_credentials': True,
                'allow_headers':        ['Content-Type', 'Authorization', 'X-CSRF-TOKEN'],
                'methods':              ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
                'max_age':              600,
            }
        },
    )

    # ── ProxyFix BEFORE socketio.init_app ────────────────────────────────
    # socketio.init_app() captures app.wsgi_app at call time to build its
    # _SocketIOMiddleware chain.  If ProxyFix is applied afterwards it
    # replaces app.wsgi_app with a new object, leaving the middleware
    # pointing at a stale reference (a bound method instead of a WSGI app).
    # Applying ProxyFix first means socketio wraps the already-fixed app.
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)

    # SocketIO init — eventlet async_mode replaces Werkzeug's WSGI server.
    socketio.init_app(
        app,
        cors_allowed_origins=cors_allowed_origins,
        async_mode='eventlet',
        logger=False,
        engineio_logger=False,
    )

    # ── JWT error handlers ────────────────────────────────────────────────
    @jwt.expired_token_loader
    def expired_token_callback(jwt_header, jwt_payload):
        return jsonify({'success': False, 'message': 'Token has expired'}), 401

    @jwt.invalid_token_loader
    def invalid_token_callback(error):
        return jsonify({'success': False, 'message': 'Invalid token'}), 401

    @jwt.unauthorized_loader
    def missing_token_callback(error):
        return jsonify({'success': False, 'message': 'Authentication required'}), 401

    @jwt.revoked_token_loader
    def revoked_token_callback(jwt_header, jwt_payload):
        return jsonify({'success': False, 'message': 'Token has been revoked'}), 401

    # ── Swagger ──────────────────────────────────────────────────────────
    swagger_template = {
        'securityDefinitions': {
            'CSRF-Token': {
                'type':        'apiKey',
                'name':        'X-CSRF-TOKEN',
                'in':          'header',
                'description': 'Paste the csrf_access_token cookie value here.',
            }
        }
    }
    Swagger(app, template=swagger_template)

    # ── Models ───────────────────────────────────────────────────────────
    from shop import models  # noqa: F401

    # ── API Blueprints ────────────────────────────────────────────────────
    from shop.auth     import auth_bp
    from shop.admin    import admin_bp
    from shop.seller   import seller_bp
    from shop.user     import user_bp
    from shop.chat.api import chat_bp
    from shop.search   import search_bp
    from shop.currency import currency_bp

    app.register_blueprint(auth_bp,     url_prefix='/api/auth')
    app.register_blueprint(admin_bp,    url_prefix='/api/admin')
    app.register_blueprint(seller_bp,   url_prefix='/api/seller')
    app.register_blueprint(user_bp,     url_prefix='/api/user')
    app.register_blueprint(chat_bp,     url_prefix='/api/chat')
    app.register_blueprint(search_bp,   url_prefix='/api/search')
    app.register_blueprint(currency_bp, url_prefix='/api/currency')

    # ── Socket.IO event handlers ──────────────────────────────────────────
    from shop.chat import events  # noqa: F401  registers @socketio.on handlers

    # ── Background scheduler (abandoned cart recovery, etc.) ─────────────
    # Guard: only start in the main process, not the Werkzeug reloader child.
    # WERKZEUG_RUN_MAIN is set to 'true' only in the reloader child process.
    import os as _os
    if not app.debug or _os.environ.get('WERKZEUG_RUN_MAIN') == 'true':
        from shop.utils.scheduler import init_scheduler
        init_scheduler(app)

    # ── Meilisearch: connect + configure index ────────────────────────────
    with app.app_context():
        from shop.search.client import get_client, configure_index
        get_client(app)        # probe connection, logs success/warning
        configure_index(app)   # idempotent — safe to call on every startup

    # ── Currency: warm the exchange-rate cache ────────────────────────────
    with app.app_context():
        try:
            from shop.currency.rates import fetch_and_cache_exchange_rates
            fetch_and_cache_exchange_rates(app)
        except Exception as _ce:
            app.logger.warning('Currency rate warm-up failed: %s', _ce)

    # ── Global error handlers ─────────────────────────────────────────────
    @app.errorhandler(400)
    def bad_request(e):
        return jsonify({'success': False, 'message': 'Bad request'}), 400

    @app.errorhandler(404)
    def not_found(e):
        # Only intercept API 404s — let React Router handle the rest
        if request.path.startswith('/api/'):
            return jsonify({'success': False, 'message': 'Endpoint not found'}), 404
        # Fall through to React catch-all
        return serve_react_catchall(request.path.lstrip('/'))

    @app.errorhandler(405)
    def method_not_allowed(e):
        return jsonify({'success': False, 'message': 'Method not allowed'}), 405

    @app.errorhandler(413)
    def request_too_large(e):
        return jsonify({'success': False, 'message': 'File too large. Max 15 MB.'}), 413

    @app.errorhandler(429)
    def ratelimit_handler(e):
        return jsonify({'success': False, 'message': f'Too many requests. {e.description}'}), 429

    @app.errorhandler(500)
    def internal_error(e):
        app.logger.error(f'Internal server error: {e}')
        return jsonify({'success': False, 'message': 'Internal server error'}), 500

    # ── Health check ─────────────────────────────────────────────────────
    @app.route('/api/health')
    def health_check():
        return jsonify({
            'success': True,
            'status':  'healthy',
            'version': '1.0.0',
        })

    # ── Legacy test endpoint ──────────────────────────────────────────────
    @app.route('/api/test')
    def api_test():
        proto = request.headers.get('X-Forwarded-Proto', 'http')
        return jsonify({
            'success':                True,
            'message':                'Flask API is running ✅',
            'protocol_seen_by_flask': proto,
            'cookie_secure':          app.config.get('JWT_COOKIE_SECURE'),
        })

    # ── Serve logo.png at root level ──────────────────────────────────────
    @app.route('/logo.png')
    def serve_logo():
        return send_from_directory(DIST_DIR, 'logo.png')

    # ── Serve uploaded static files (product images, profile photos) ──────
    SHOP_STATIC_DIR = os.path.join(BACKEND_DIR, 'shop', 'static')

    @app.route('/static/<path:filename>')
    def serve_shop_static(filename):
        try:
            return send_from_directory(SHOP_STATIC_DIR, filename)
        except Exception:
            return jsonify({'error': 'File not found'}), 404

    # ── Serve React root ─────────────────────────────────────────────────
    @app.route('/')
    def serve_react_root():
        index = os.path.join(DIST_DIR, 'index.html')
        if not os.path.isfile(index):
            return jsonify({
                'error': 'Frontend not built. Run: cd frontend && npm run build'
            }), 503
        return send_from_directory(DIST_DIR, 'index.html')

    # ── Catch-all for React Router ────────────────────────────────────────
    @app.route('/<path:path>')
    def serve_react_catchall(path):
        if path.startswith('api/'):
            return jsonify({'error': 'Not found'}), 404

        target = os.path.join(DIST_DIR, path)
        if os.path.isfile(target):
            return send_from_directory(DIST_DIR, path)

        index = os.path.join(DIST_DIR, 'index.html')
        if os.path.isfile(index):
            return send_from_directory(DIST_DIR, 'index.html')

        return jsonify({
            'error': 'Frontend not built. Run: cd frontend && npm run build'
        }), 503

    return app

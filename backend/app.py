import sys
import os
import warnings

# Suppress Eventlet deprecation warnings
warnings.filterwarnings("ignore", category=DeprecationWarning, module="eventlet")

# eventlet.monkey_patch() MUST be the very first thing that runs —
# before any other import — so it can replace the standard library's
# socket, threading, and ssl modules with async-friendly versions.
# We skip it when running Flask CLI commands (like db upgrade) to avoid errors.
is_flask_cli = os.path.basename(sys.argv[0]) == 'flask' or 'flask' in sys.argv[0]

if not is_flask_cli:
    # Redirect stdout and stderr briefly to hide "RLock not greened" warnings
    old_stdout = sys.stdout
    old_stderr = sys.stderr
    with open(os.devnull, 'w') as devnull:
        sys.stdout = devnull
        sys.stderr = devnull
        try:
            import eventlet
            eventlet.monkey_patch()
        except Exception:
            pass
        finally:
            sys.stdout = old_stdout
            sys.stderr = old_stderr
else:
    import eventlet

from shop import create_app          # noqa: E402  (import after monkey-patch is intentional)
from shop.extensions import socketio  # noqa: E402


app = create_app()

if __name__ == '__main__':
    host = os.environ.get('FLASK_HOST', '0.0.0.0')
    port = os.environ.get('FLASK_PORT')

    if port is None:
        from urllib.parse import urlparse
        app_base_url = os.environ.get('APP_BASE_URL', 'http://127.0.0.1:7899')
        parsed = urlparse(app_base_url)
        port = parsed.port or 7899
    else:
        port = int(port)

    debug = os.environ.get('FLASK_DEBUG', 'True').lower() == 'true'

    if os.environ.get('WERKZEUG_RUN_MAIN') == 'true' or not debug:
        display_host = 'localhost' if host == '0.0.0.0' else host
        print("\n" + "═"*60)
        print(" 🚀  ShopHub Backend API Server is Ready!")
        print(f" 🔗  API Endpoint:  http://{display_host}:{port}/api/test")
        print(f" 📖  Swagger Docs:  http://{display_host}:{port}/apidocs/")
        print("═"*60 + "\n")

    socketio.run(app, host=host, port=port, debug=debug)

#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
BACKEND_DIR="$(pwd)"
PROJECT_ROOT="$(dirname "$BACKEND_DIR")"

# Prefer the project virtual environment Python when available.
PYTHON=python3
if [ -x "$PROJECT_ROOT/.venv/bin/python" ]; then
  PYTHON="$PROJECT_ROOT/.venv/bin/python"
fi

export FLASK_HOST="${FLASK_HOST:-0.0.0.0}"

if [ -z "${FLASK_PORT:-}" ]; then
  FLASK_PORT="$($PYTHON - <<'PY'
import os
from urllib.parse import urlparse
root = os.getcwd()

def get_port_from_url(url):
    try:
        parsed = urlparse(url)
        return parsed.port
    except Exception:
        return None

app_base = os.getenv('APP_BASE_URL', '')
if app_base:
    port = get_port_from_url(app_base)
    if port:
        print(port)
        raise SystemExit

env_port = os.getenv('FLASK_PORT', '')
if env_port:
    print(env_port)
    raise SystemExit

try:
    with open(os.path.join(root, '.env'), 'r') as f:
        for line in f:
            if line.startswith('APP_BASE_URL='):
                value = line.split('=', 1)[1].strip()
                port = get_port_from_url(value)
                if port:
                    print(port)
                    raise SystemExit
except FileNotFoundError:
    pass

print(7899)
PY
)"
fi
export FLASK_PORT

echo "[INFO] Starting Flask backend on http://${FLASK_HOST}:${FLASK_PORT}"
exec "$PYTHON" app.py

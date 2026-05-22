#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
PROJECT_ROOT="$(pwd)"

if ! command -v ngrok >/dev/null 2>&1; then
  echo "[ERROR] ngrok is not installed or not found in PATH."
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "[ERROR] python3 is required to run this script."
  exit 1
fi

npm_available=false
if command -v npm >/dev/null 2>&1; then
  npm_available=true
fi

read_authtoken() {
  if [ -n "${NGROK_AUTHTOKEN:-}" ]; then
    echo "$NGROK_AUTHTOKEN"
    return
  fi

  for cfg in "$HOME/.config/ngrok/ngrok.yml" "$HOME/.ngrok2/ngrok.yml"; do
    if [ -f "$cfg" ]; then
      token=$(grep -E '^\s*authtoken:' "$cfg" | head -n 1 | cut -d ':' -f 2- | tr -d ' "')
      if [ -n "$token" ]; then
        echo "$token"
        return
      fi
    fi
  done
}

auth_token=$(read_authtoken)
if [ -n "${NGROK_AUTHTOKEN:-}" ]; then
  ngrok config add-authtoken "$NGROK_AUTHTOKEN" >/dev/null 2>&1 || true
  auth_token=$NGROK_AUTHTOKEN
fi

if [ -z "$auth_token" ]; then
  echo "[ERROR] ngrok auth token is missing."
  echo "Set NGROK_AUTHTOKEN=<token> or run: ngrok config add-authtoken <token>"
  exit 1
fi

read_ports() {
  python3 - <<'PY'
import json
import os
import re
import subprocess

root = os.getcwd()

lsof_text = ''
try:
    lsof_text = subprocess.check_output(['lsof', '-nP', '-iTCP', '-sTCP:LISTEN'], text=True)
except Exception:
    pass

backend_port = None
for line in lsof_text.splitlines():
    if 'python' in line.lower() or 'flask' in line.lower():
        m = re.search(r':(\d+)->|:(\d+)\s', line)
        if m:
            port = m.group(1) or m.group(2)
            if port and port.isdigit():
                backend_port = port
                break

if not backend_port:
    env_port = os.getenv('FLASK_PORT', '')
    if env_port:
        backend_port = env_port

if not backend_port:
    app_base = os.getenv('APP_BASE_URL', '')
    if app_base:
        from urllib.parse import urlparse
        parsed = urlparse(app_base)
        if parsed.port:
            backend_port = str(parsed.port)

if not backend_port:
    env_path = os.path.join(root, '.env')
    if os.path.isfile(env_path):
        with open(env_path, 'r') as f:
            for line in f:
                if line.startswith('APP_BASE_URL='):
                    value = line.split('=', 1)[1].strip()
                    from urllib.parse import urlparse
                    parsed = urlparse(value)
                    if parsed.port:
                        backend_port = str(parsed.port)
                        break

if not backend_port:
    backend_port = '7899'

frontend_port = None
for line in lsof_text.splitlines():
    if 'vite' in line.lower() or 'node' in line.lower():
        m = re.search(r':(\d+)->|:(\d+)\s', line)
        if m:
            port = m.group(1) or m.group(2)
            if port and port.isdigit():
                frontend_port = port
                break

if not frontend_port:
    vite_file = os.path.join(root, 'frontend', 'vite.config.ts')
    if os.path.isfile(vite_file):
        with open(vite_file, 'r') as f:
            text = f.read()
            match = re.search(r'port\s*:\s*(\d+)', text)
            if match:
                frontend_port = match.group(1)

if not frontend_port:
    pkg_file = os.path.join(root, 'frontend', 'package.json')
    if os.path.isfile(pkg_file):
        with open(pkg_file, 'r') as f:
            text = f.read()
            match = re.search(r'vite\s+--host(?:\s+--port\s+(\d+))?', text)
            if match and match.group(1):
                frontend_port = match.group(1)

if not frontend_port:
    frontend_port = '5173'

print(json.dumps({'backend_port': backend_port, 'frontend_port': frontend_port}))
PY
}

ports_json=$(read_ports)
backend_port=$(printf '%s' "$ports_json" | python3 -c 'import json,sys; print(json.load(sys.stdin)["backend_port"])')
frontend_port=$(printf '%s' "$ports_json" | python3 -c 'import json,sys; print(json.load(sys.stdin)["frontend_port"])')

config_file="$PROJECT_ROOT/ngrok.yml"
runtime_config=""
if [ "$backend_port" != "7899" ]; then
  runtime_config="$PROJECT_ROOT/ngrok.runtime.yml"
  awk -v port="$backend_port" '
    $1 == "addr:" && prev == "backend:" { $2 = port }
    { print }
    { prev = $1 }
  ' "$config_file" > "$runtime_config"
  config_file="$runtime_config"
fi

parse_tunnel_url() {
  printf '%s' "$1" | python3 -c '
import json, sys
kind = sys.argv[1]
expected_port = sys.argv[2]
try:
    data = json.load(sys.stdin)
except Exception:
    sys.exit(0)
for t in data.get("tunnels", []):
    name = t.get("name", "").lower()
    url = t.get("public_url", "")
    addr = str(t.get("config", {}).get("addr", ""))
    if kind == "backend" and (name.startswith("backend") or addr.endswith(":" + expected_port)):
        print(url)
        sys.exit(0)
    if kind == "frontend" and (name.startswith("frontend") or addr.endswith(":" + expected_port)):
        print(url)
        sys.exit(0)
for t in data.get("tunnels", []):
    if kind == "backend" and t.get("proto") == "https":
        print(t.get("public_url", ""))
        sys.exit(0)
    if kind == "frontend" and t.get("proto") == "https":
        print(t.get("public_url", ""))
        sys.exit(0)
' "$2" "$3"
}

fetch_tunnels() {
  curl -s --max-time 2 http://127.0.0.1:4040/api/tunnels || true
}

existing=$(fetch_tunnels)
backend_url=$(parse_tunnel_url "$existing" backend "$backend_port")
frontend_url=$(parse_tunnel_url "$existing" frontend "$frontend_port")

if [ -n "$backend_url" ] && [ -n "$frontend_url" ]; then
  echo "[INFO] Existing ngrok session detected. Reusing tunnels."
else
  nohup ngrok start --config "$config_file" --all >/tmp/ngrok.out 2>/tmp/ngrok.err &
  NGROK_PID=$!
  echo "[INFO] Started ngrok (PID $NGROK_PID). Waiting for inspector API..."
  for i in $(seq 1 15); do
    if curl -s --max-time 2 http://127.0.0.1:4040/api/tunnels >/dev/null 2>&1; then
      break
    fi
    sleep 1
done
  existing=$(fetch_tunnels)
  backend_url=$(parse_tunnel_url "$existing" backend "$backend_port")
  frontend_url=$(parse_tunnel_url "$existing" frontend "$frontend_port")
fi

if [ -z "$backend_url" ] || [ -z "$frontend_url" ]; then
  echo "[ERROR] Could not detect ngrok public URLs."
  echo "$existing"
  exit 1
fi

cat > frontend/.env.local <<EOF
VITE_API_URL=$backend_url
VITE_API_BASE_URL=$backend_url
EOF

echo "[INFO] Wrote frontend/.env.local with ngrok backend URL."

# ── Update root .env for backend ─────────────────────────────────────────────
if [ -f "$PROJECT_ROOT/.env" ]; then
  # Use a temporary file to avoid partial writes
  sed -e "s|^APP_BASE_URL=.*|APP_BASE_URL=$backend_url|" \
      -e "s|^FRONTEND_BASE_URL=.*|FRONTEND_BASE_URL=$frontend_url|" \
      -e "s|^GOOGLE_CALLBACK_BASE=.*|GOOGLE_CALLBACK_BASE=$backend_url|" \
      -e "s|^GOOGLE_FRONTEND_REDIRECT=.*|GOOGLE_FRONTEND_REDIRECT=$frontend_url|" \
      "$PROJECT_ROOT/.env" > "$PROJECT_ROOT/.env.tmp" && mv "$PROJECT_ROOT/.env.tmp" "$PROJECT_ROOT/.env"
  echo "[SUCCESS] Updated root .env with ngrok URLs."
fi

echo "[SUCCESS] ngrok frontend: $frontend_url"
echo "[SUCCESS] ngrok backend:  $backend_url"

echo "[INFO] Verifying frontend restart..."
if [ "$npm_available" = true ]; then
  frontend_pids=$(lsof -nP -iTCP:"$frontend_port" -sTCP:LISTEN -t 2>/dev/null || true)
  if [ -n "$frontend_pids" ]; then
    echo "[INFO] Stopping existing frontend on port $frontend_port."
    kill $frontend_pids 2>/dev/null || true
    sleep 2
  fi

  cd frontend
  nohup npm run dev -- --host 0.0.0.0 --port "$frontend_port" > ../frontend.ngrok.log 2>&1 &
  new_pid=$!
  sleep 5
  if kill -0 "$new_pid" >/dev/null 2>&1; then
    echo "[SUCCESS] Frontend restarted with new ngrok backend env (PID $new_pid)."
    echo "[INFO] Frontend logs: $(pwd)/../frontend.ngrok.log"
  else
    echo "[WARNING] Frontend restart failed. Please run ./start_frontend.sh manually."
  fi
else
  echo "[WARNING] npm is not installed. Frontend restart skipped."
  echo "If the frontend is not running, use ./start_frontend.sh manually."
fi

echo "[INFO] Inspect traffic at: http://127.0.0.1:4040"

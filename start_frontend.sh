#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/frontend"

PORT="${VITE_PORT:-5173}"

echo "[INFO] Starting Vite frontend on http://0.0.0.0:${PORT}"
exec npm run dev -- --host 0.0.0.0 --port "$PORT"

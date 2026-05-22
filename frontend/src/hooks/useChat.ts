/**
 * useChat — Socket.IO hook for the live chat feature.
 *
 * Authentication:
 *   The server no longer reads JWT from HttpOnly cookies inside socket
 *   handlers (that triggers the Werkzeug 3.x session-setter bug).
 *   Instead we read the access_token_cookie (NOT HttpOnly — readable by JS)
 *   and pass it in the Socket.IO `auth` dict so the server can decode it
 *   with PyJWT without touching the Flask request context at all.
 *
 * Namespace:
 *   The namespace ('/chat') must be part of the URL string passed to io(),
 *   NOT a separate config key.
 *
 * Singleton:
 *   One socket per browser tab, created lazily and reused across components.
 *   The token is re-read on every reconnect so a refreshed access token is
 *   always used.
 */
import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

// ── Resolve Flask origin ──────────────────────────────────────
// Socket.IO does NOT go through the Vite dev proxy, so we must
// point it directly at the Flask backend origin.
const FLASK_ORIGIN = (() => {
  const env = import.meta.env.VITE_API_URL ?? import.meta.env.VITE_API_BASE_URL;
  if (env) return String(env);
  const url = new URL(window.location.href);
  url.port = '7899';
  return url.origin;
})();

// ── Read a cookie by name (works for non-HttpOnly cookies) ────
function getCookie(name: string): string {
  const match = document.cookie.match(
    new RegExp('(?:^|;\\s*)' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=([^;]*)')
  );
  return match ? decodeURIComponent(match[1]).trim() : '';
}

// ── Module-level singleton ────────────────────────────────────
let _socket: Socket | null = null;

function getSocket(): Socket {
  if (!_socket) {
    _socket = io(`${FLASK_ORIGIN}/chat`, {
      path:             '/socket.io',
      withCredentials:  true,
      transports:       ['websocket', 'polling'],
      autoConnect:      false,
      reconnection:     true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      // Send the CSRF token in the auth dict.
      // access_token_cookie is HttpOnly (JS can't read it) — the backend
      // reads it directly from flask_request.cookies instead.
      // We send csrf_access_token here so the server knows the client
      // has an active session; the actual JWT comes from the cookie.
      auth: (cb: (data: object) => void) => {
        cb({ csrf_token: getCookie('csrf_access_token') });
      },
    });
  }
  return _socket;
}

export function useChat() {
  const socket = getSocket();
  const [connected, setConnected] = useState(socket.connected);

  useEffect(() => {
    const onConnect    = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    socket.on('connect',    onConnect);
    socket.on('disconnect', onDisconnect);

    if (!socket.connected) socket.connect();

    return () => {
      socket.off('connect',    onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, [socket]);

  return { socket, connected };
}

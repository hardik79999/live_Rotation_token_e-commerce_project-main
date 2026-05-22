import axios, {
  type InternalAxiosRequestConfig,
  type AxiosResponse,
  type AxiosError,
} from "axios";
import toast from "react-hot-toast";
import { AUTH } from "./routes";

const BASE_URL = import.meta.env.VITE_API_URL ?? import.meta.env.VITE_API_BASE_URL ?? "";
const MUTATING_METHODS = new Set(["POST", "PUT", "DELETE", "PATCH"]);

// Auth endpoints that never need a refresh attempt
const AUTH_BYPASS_URLS: string[] = [
  AUTH.LOGIN,
  AUTH.SIGNUP,
  AUTH.LOGOUT,
  AUTH.FORGOT_PASSWORD,
  AUTH.RESET_PASSWORD,
  AUTH.REFRESH_TOKEN,
  // NOTE: AUTH.PROFILE is intentionally NOT in this list so that
  // the silent-login call on app mount can trigger a refresh if needed.
];

function isBypassUrl(url: string | undefined): boolean {
  if (!url) return false;
  return AUTH_BYPASS_URLS.some((b) => url.includes(b));
}

function isRefreshUrl(url: string | undefined): boolean {
  if (!url) return false;
  return url.includes(AUTH.REFRESH_TOKEN);
}

// ── Cookie helpers ────────────────────────────────────────────
function getCookie(name: string): string {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = document.cookie.match(
    new RegExp("(?:^|;\\s*)" + escaped + "=([^;]*)")
  );
  if (!match) return "";
  return decodeURIComponent(match[1]).trim();
}

const getCsrfAccess  = () => getCookie("csrf_access_token");
const getCsrfRefresh = () => getCookie("csrf_refresh_token");

/**
 * Proactive refresh: access token is gone but refresh token still exists.
 * Fires before sending a mutating request so Flask never sees a stale CSRF.
 * Does NOT fire on the login page (both cookies absent = not logged in).
 */
function shouldProactivelyRefresh(): boolean {
  return getCsrfAccess() === "" && getCsrfRefresh() !== "";
}

// ── Refresh queue — one refresh at a time ─────────────────────
type QueueEntry = {
  resolve: (value: AxiosResponse | Promise<AxiosResponse>) => void;
  reject:  (reason: unknown) => void;
  config:  InternalAxiosRequestConfig;
};

let isRefreshing = false;
const failedQueue: QueueEntry[] = [];

function drainQueue(error: unknown): void {
  failedQueue.forEach(({ resolve, reject, config }) => {
    if (error) {
      reject(error);
    } else {
      const fresh = getCsrfAccess();
      if (fresh) config.headers["X-CSRF-TOKEN"] = fresh;
      resolve(api(config));
    }
  });
  failedQueue.length = 0;
}

// ── Core refresh (raw axios — bypasses our interceptor) ───────
async function doRefresh(): Promise<void> {
  const refreshCsrf = getCsrfRefresh();
  const refreshUrl  = BASE_URL
    ? `${BASE_URL}${AUTH.REFRESH_TOKEN}`
    : `${window.location.origin}${AUTH.REFRESH_TOKEN}`;

  await axios.post(refreshUrl, {}, {
    withCredentials: true,
    headers: {
      "Content-Type": "application/json",
      ...(refreshCsrf ? { "X-CSRF-TOKEN": refreshCsrf } : {}),
    },
  });
}

function signalLogout(): void {
  window.dispatchEvent(new CustomEvent("auth:expired"));
}

// ── Axios instance ────────────────────────────────────────────
const api = axios.create({
  baseURL:         BASE_URL,
  withCredentials: true,
  headers:         { "Content-Type": "application/json" },
  timeout:         15_000,
});

// ── REQUEST INTERCEPTOR ───────────────────────────────────────
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const method = config.method?.toUpperCase() ?? "";
    if (!MUTATING_METHODS.has(method)) return config;   // GET/HEAD — no CSRF
    if (isBypassUrl(config.url))       return config;   // login/signup — no cookies yet

    // Refresh endpoint gets csrf_refresh_token
    if (isRefreshUrl(config.url)) {
      const rc = getCsrfRefresh();
      if (rc) config.headers["X-CSRF-TOKEN"] = rc;
      return config;
    }

    // Proactive refresh when access token already expired
    if (shouldProactivelyRefresh()) {
      if (!isRefreshing) {
        isRefreshing = true;
        try {
          await doRefresh();
          drainQueue(null);
        } catch (err) {
          drainQueue(err);
          signalLogout();
          isRefreshing = false;
          return Promise.reject(new Error("Session expired. Please log in again."));
        } finally {
          isRefreshing = false;
        }
      } else {
        // Another request already triggered a refresh — wait for it
        await new Promise<void>((resolve, reject) => {
          failedQueue.push({ resolve: () => resolve(), reject, config });
        });
      }
    }

    const ac = getCsrfAccess();
    if (ac) config.headers["X-CSRF-TOKEN"] = ac;
    return config;
  },
  (error) => Promise.reject(error)
);

// ── RESPONSE INTERCEPTOR ──────────────────────────────────────
api.interceptors.response.use(
  (response: AxiosResponse) => response,

  async (error: AxiosError) => {
    const status       = error.response?.status;
    const data         = error.response?.data as Record<string, unknown> | undefined;
    const originalReq  = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (!originalReq) return Promise.reject(error);

    // Never intercept auth bypass endpoints (login failure = wrong password, not expired token)
    if (isBypassUrl(originalReq.url)) return Promise.reject(error);

    // ── Classify recoverable errors ───────────────────────────
    const is401 = status === 401;

    // Flask-JWT-Extended returns 422 for CSRF mismatch
    const is422Csrf =
      status === 422 &&
      typeof data?.msg === "string" &&
      data.msg.toLowerCase().includes("csrf");

    // Some Flask versions return 400 for CSRF
    const is400Csrf =
      status === 400 &&
      typeof data?.msg === "string" &&
      data.msg.toLowerCase().includes("csrf");

    // "Signature verification failed" / "Token has expired" come as 401
    // with a message in the body — already covered by is401 above.
    // We also check the message explicitly for extra safety.
    const isSignatureError =
      status === 401 &&
      typeof data?.msg === "string" &&
      (data.msg.toLowerCase().includes("signature") ||
       data.msg.toLowerCase().includes("expired") ||
       data.msg.toLowerCase().includes("token"));

    const isRecoverable =
      (is401 || is422Csrf || is400Csrf || isSignatureError) &&
      !originalReq._retry;

    if (!isRecoverable) {
      // ── Network / server error toasts ─────────────────────
      // Suppress toasts for:
      //   • Auth/profile endpoints — 401 = not logged in, not a real error
      //   • Refresh token endpoint — failure = session expired, handled by signalLogout
      //   • Errors flagged as refresh failures (re-rejected after doRefresh fails)
      const isAuthRelated =
        originalReq.url?.includes(AUTH.PROFILE) ||
        originalReq.url?.includes(AUTH.REFRESH_TOKEN);

      const isRefreshFailure =
        !!(error as unknown as Record<string, unknown>)._isRefreshFailure;

      if (!isAuthRelated && !isRefreshFailure) {
        const isNetworkError = !error.response;
        const isServerError  = status !== undefined && status >= 500;

        if (isNetworkError) {
          toast.error('Network error — please check your connection and try again.', {
            id: 'network-error',
            duration: 6000,
          });
        } else if (isServerError) {
          toast.error('Something went wrong on our end. Please try again shortly.', {
            id: 'server-error',
            duration: 6000,
          });
        }
      }

      return Promise.reject(error);
    }

    // ── Queue if already refreshing ───────────────────────────
    if (isRefreshing) {
      return new Promise<AxiosResponse>((resolve, reject) => {
        failedQueue.push({ resolve, reject, config: originalReq });
      });
    }

    // ── Start refresh ─────────────────────────────────────────
    originalReq._retry = true;
    isRefreshing = true;

    try {
      await doRefresh();
      const fresh = getCsrfAccess();
      if (fresh) originalReq.headers["X-CSRF-TOKEN"] = fresh;
      drainQueue(null);
      return api(originalReq);
    } catch (refreshError) {
      drainQueue(refreshError);
      signalLogout();
      // Mark the error so the outer interceptor pass doesn't show a toast
      // (this is a session-expiry, not a server crash)
      if (refreshError && typeof refreshError === 'object') {
        (refreshError as Record<string, unknown>)._isRefreshFailure = true;
      }
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export default api;

// Bypass all interceptors for truly public calls
export const rawAxios = axios.create({
  baseURL:         BASE_URL,
  withCredentials: true,
  headers:         { "Content-Type": "application/json" },
});

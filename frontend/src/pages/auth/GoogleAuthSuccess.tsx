/**
 * GoogleAuthSuccess — landing page after Google OAuth callback.
 *
 * WHY THIS EXISTS:
 *   Flask (:7899) sets JWT cookies on the 302 redirect response, but the
 *   browser drops them because the redirect destination is React (:5173) —
 *   a different port = different origin = SameSite=Lax blocks the cookies.
 *
 * THE FIX — one-time-token (OTT) bridge:
 *   1. Flask redirects here with ?ott=<short-lived-token> (no cookies).
 *   2. This page POSTs the OTT to GET /api/auth/google/exchange via Axios
 *      (same-origin call thanks to Vite proxy → :7899).
 *   3. Flask validates the OTT, sets JWT cookies on THAT response, and
 *      returns the user profile JSON.
 *   4. We save the user to Zustand and navigate to the dashboard.
 *
 * ERROR PATH:
 *   If the URL contains ?oauth_error=... we show a toast and go to /login.
 */
import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '@/api/axios';
import { AUTH } from '@/api/routes';
import { useAuthStore } from '@/store/authStore';
import type { User } from '@/types';
import toast from 'react-hot-toast';

const ERROR_MESSAGES: Record<string, string> = {
  invalid_state:             'Security check failed. Please try again.',
  token_exchange_failed:     'Could not connect to Google. Please try again.',
  token_verification_failed: 'Google sign-in verification failed.',
  email_not_verified:        'Your Google account email is not verified.',
  account_suspended:         'Your account has been suspended. Contact support.',
  server_error:              'A server error occurred. Please try again.',
  access_denied:             'Google sign-in was cancelled.',
};

export function GoogleAuthSuccess() {
  const navigate       = useNavigate();
  const [searchParams] = useSearchParams();
  const { setUser }    = useAuthStore();
  const called         = useRef(false);   // prevent double-fire in React StrictMode

  useEffect(() => {
    if (called.current) return;
    called.current = true;

    // ── Error path ────────────────────────────────────────────
    const oauthError = searchParams.get('oauth_error');
    if (oauthError) {
      toast.error(ERROR_MESSAGES[oauthError] ?? 'Google sign-in failed. Please try again.');
      navigate('/login', { replace: true });
      return;
    }

    // ── OTT exchange path ─────────────────────────────────────
    const ott = searchParams.get('ott');
    if (!ott) {
      toast.error('Missing sign-in token. Please try again.');
      navigate('/login', { replace: true });
      return;
    }

    api
      .get<{ success: boolean; data: User }>(AUTH.GOOGLE_EXCHANGE, { params: { ott } })
      .then((res) => {
        const user = res.data.data;
        if (!user) throw new Error('No user data in response');

        setUser(user);
        toast.success(`Welcome, ${user.username}! 🎉`);

        if (user.role === 'admin') {
          navigate('/admin/dashboard', { replace: true });
        } else if (user.role === 'seller') {
          navigate('/seller/dashboard', { replace: true });
        } else {
          navigate('/user/dashboard', { replace: true });
        }
      })
      .catch((err) => {
        const msg =
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
        toast.error(msg || 'Sign-in failed. Please try again.');
        navigate('/login', { replace: true });
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <img
          src="/logo.png"
          alt="ShopHub"
          className="h-16 w-auto object-contain animate-pulse"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-400">Signing you in with Google…</p>
      </div>
    </div>
  );
}

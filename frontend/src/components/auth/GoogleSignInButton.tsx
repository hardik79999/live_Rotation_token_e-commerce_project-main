/**
 * GoogleSignInButton — "Continue with Google" button.
 *
 * Clicking it navigates the browser to GET /api/auth/google/login
 * which redirects to Google's consent screen.  The entire OAuth flow
 * is server-side — no client-side Google SDK needed.
 */
import { cn } from '@/utils/cn';

interface Props {
  className?: string;
  label?: string;
}

// Flask backend URL — same logic as useChat.ts
const FLASK_ORIGIN = (() => {
  const env = import.meta.env.VITE_API_URL ?? import.meta.env.VITE_API_BASE_URL;
  if (env) return String(env);
  // In dev, Vite proxies /api/* to Flask, so we can use relative URL
  return '';
})();

export function GoogleSignInButton({ className, label = 'Continue with Google' }: Props) {
  const handleClick = () => {
    // Full page navigation — the backend will redirect to Google
    window.location.href = `${FLASK_ORIGIN}/api/auth/google/login`;
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        'w-full flex items-center justify-center gap-3',
        'px-4 py-2.5 rounded-xl border border-gray-300',
        'bg-white hover:bg-gray-50 active:bg-gray-100',
        'text-sm font-medium text-gray-700',
        'transition-all duration-150 active:scale-[0.98]',
        'shadow-sm hover:shadow-md',
        className,
      )}
    >
      {/* Google "G" logo SVG — no external dependency */}
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
        <path
          fill="#4285F4"
          d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
        />
        <path
          fill="#34A853"
          d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
        />
        <path
          fill="#FBBC05"
          d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"
        />
        <path
          fill="#EA4335"
          d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z"
        />
      </svg>
      {label}
    </button>
  );
}

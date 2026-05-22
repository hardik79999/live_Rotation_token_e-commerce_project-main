/**
 * PWAInstallBanner — slides up from the bottom on mobile when the browser
 * fires beforeinstallprompt.  Clicking "Install" triggers the native dialog.
 * Clicking "×" dismisses for the session.
 */
import { Download, X, Smartphone } from 'lucide-react';
import { usePWAInstall } from '@/hooks/usePWAInstall';

export function PWAInstallBanner() {
  const { canInstall, install, dismiss } = usePWAInstall();

  if (!canInstall) return null;

  return (
    <>
      {/* ── Backdrop (mobile only) ── */}
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 md:hidden"
        onClick={dismiss}
        aria-hidden="true"
      />

      {/* ── Banner ── */}
      <div
        role="dialog"
        aria-label="Install ShopHub app"
        className="
          fixed bottom-0 left-0 right-0 z-50
          md:bottom-6 md:left-auto md:right-6 md:max-w-sm
          animate-in slide-in-from-bottom duration-300
        "
      >
        <div className="
          bg-gray-900 dark:bg-slate-800
          border border-gray-700 dark:border-slate-600
          rounded-t-2xl md:rounded-2xl
          shadow-2xl shadow-black/40
          p-5
        ">
          {/* Close button */}
          <button
            onClick={dismiss}
            aria-label="Dismiss install banner"
            className="absolute top-3 right-3 p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={16} />
          </button>

          {/* Content */}
          <div className="flex items-start gap-4 pr-6">
            {/* App icon */}
            <div className="shrink-0 w-14 h-14 rounded-2xl overflow-hidden bg-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/30">
              <img
                src="/logo.png"
                alt="ShopHub"
                className="w-10 h-10 object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>

            <div className="flex-1 min-w-0">
              <p className="font-bold text-white text-base leading-tight">
                Install ShopHub App
              </p>
              <p className="text-sm text-gray-400 mt-0.5 leading-snug">
                Faster experience, offline access &amp; home screen shortcut
              </p>

              {/* Feature pills */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {['⚡ Instant load', '📦 Track orders', '🔔 Notifications'].map((f) => (
                  <span
                    key={f}
                    className="text-xs bg-white/10 text-gray-300 px-2 py-0.5 rounded-full"
                  >
                    {f}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-2 mt-4">
            <button
              onClick={dismiss}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 transition-colors"
            >
              Not now
            </button>
            <button
              onClick={install}
              className="
                flex-1 py-2.5 rounded-xl text-sm font-bold
                bg-orange-500 hover:bg-orange-600 text-white
                flex items-center justify-center gap-2
                transition-all active:scale-95 shadow-lg shadow-orange-500/30
              "
            >
              <Download size={15} />
              Install App
            </button>
          </div>

          {/* iOS hint (Safari doesn't fire beforeinstallprompt) */}
          <p className="text-center text-xs text-gray-600 mt-3 flex items-center justify-center gap-1">
            <Smartphone size={11} />
            On iPhone: tap Share → Add to Home Screen
          </p>
        </div>
      </div>
    </>
  );
}

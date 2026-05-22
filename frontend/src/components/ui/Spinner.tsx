import { cn } from '@/utils/cn';

export function Spinner({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center justify-center', className)}>
      <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

/**
 * PageSpinner — branded full-page loading screen.
 * Shows the ShopHub logo + orange spinner + "Loading ShopHub..."
 * Used on every page while data is being fetched.
 */
export function PageSpinner() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <img
          src="/logo.png"
          alt="ShopHub"
          className="h-16 w-auto object-contain animate-pulse"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-400 dark:text-slate-500">Loading ShopHub...</p>
      </div>
    </div>
  );
}

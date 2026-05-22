import { cn } from '@/utils/cn';
import type { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  const base =
    'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed dark:focus:ring-offset-slate-900';

  const variants = {
    primary:
      'bg-orange-500 text-white hover:bg-orange-600 focus:ring-orange-500 active:scale-95 shadow-sm hover:shadow-orange-500/30 hover:shadow-md',
    secondary:
      'bg-gray-800 text-white hover:bg-gray-900 focus:ring-gray-700 active:scale-95 dark:bg-slate-700 dark:hover:bg-slate-600',
    outline:
      'border-2 border-orange-500 text-orange-500 hover:bg-orange-50 focus:ring-orange-500 dark:hover:bg-orange-500/10',
    ghost:
      'text-gray-700 hover:bg-gray-100 focus:ring-gray-300 dark:text-slate-300 dark:hover:bg-slate-800 dark:focus:ring-slate-600',
    danger:
      'bg-red-500 text-white hover:bg-red-600 focus:ring-red-500 active:scale-95',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-sm gap-1.5',
    md: 'px-4 py-2 text-sm gap-2',
    lg: 'px-6 py-3 text-base gap-2',
  };

  return (
    <button
      className={cn(base, variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      )}
      {children}
    </button>
  );
}

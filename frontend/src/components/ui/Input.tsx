import { cn } from '@/utils/cn';
import { AlertCircle } from 'lucide-react';
import type { InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
  hint?: string;
}

export function Input({ label, error, icon, hint, className, id, ...props }: InputProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="text-sm font-medium text-gray-700 dark:text-slate-300"
        >
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <span className={cn(
            'absolute left-3 top-1/2 -translate-y-1/2 transition-colors pointer-events-none',
            error ? 'text-red-400' : 'text-gray-400 dark:text-slate-500',
          )}>
            {icon}
          </span>
        )}
        <input
          id={inputId}
          className={cn(
            'w-full rounded-xl border px-3 py-2.5 text-sm transition-all duration-200',
            // Light
            'border-gray-200 bg-white text-gray-900 placeholder-gray-400',
            // Dark
            'dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500',
            // Focus — normal
            !error && 'focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-400/20',
            !error && 'dark:focus:border-orange-400 dark:focus:ring-orange-400/20',
            // Focus — error state
            error && 'border-red-400 focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-400/20',
            error && 'dark:border-red-500 dark:focus:border-red-500 dark:focus:ring-red-500/20',
            // Disabled
            'disabled:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60',
            'dark:disabled:bg-slate-900 dark:disabled:text-slate-500',
            // Icon padding
            icon && 'pl-10',
            // Error icon padding
            error && 'pr-10',
            className
          )}
          {...props}
        />
        {/* Error icon on the right */}
        {error && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-red-400 pointer-events-none">
            <AlertCircle size={16} />
          </span>
        )}
      </div>
      {/* Error message */}
      {error && (
        <p className="flex items-center gap-1 text-xs text-red-500 dark:text-red-400 animate-in fade-in slide-in-from-top-1 duration-200">
          {error}
        </p>
      )}
      {/* Hint (shown when no error) */}
      {hint && !error && (
        <p className="text-xs text-gray-400 dark:text-slate-500">{hint}</p>
      )}
    </div>
  );
}

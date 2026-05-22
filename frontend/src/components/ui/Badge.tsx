import { cn } from '@/utils/cn';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'orange';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const variants: Record<BadgeVariant, string> = {
  default: 'bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-slate-300',
  success: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
  warning: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400',
  danger:  'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
  info:    'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
  orange:  'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400',
};

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

export function orderStatusBadge(status: string): BadgeVariant {
  const map: Record<string, BadgeVariant> = {
    pending:    'warning',
    processing: 'info',
    shipped:    'orange',
    delivered:  'success',
    cancelled:  'danger',
  };
  return map[status.toLowerCase()] ?? 'default';
}

export function returnStatusBadge(status: string): BadgeVariant {
  const map: Record<string, BadgeVariant> = {
    pending:  'warning',
    approved: 'info',
    rejected: 'danger',
    refunded: 'success',
  };
  return map[status.toLowerCase()] ?? 'default';
}

export const RETURN_STATUS_LABEL: Record<string, string> = {
  pending:  '↩ Return Pending',
  approved: '✓ Return Approved',
  rejected: '✗ Return Rejected',
  refunded: '💰 Refunded',
};

import { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/utils/cn';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizes = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
};

export function Modal({ isOpen, onClose, title, children, size = 'md' }: ModalProps) {
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Panel */}
      <div
        className={cn(
          'relative w-full rounded-2xl shadow-2xl',
          'animate-in fade-in zoom-in-95 duration-200',
          'bg-white dark:bg-slate-800 dark:shadow-slate-900/50',
          'flex flex-col',
          'max-h-[90vh]',   // never taller than viewport
          sizes[size]
        )}
      >
        {/* Sticky header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 shrink-0 border-b border-gray-100 dark:border-slate-700">
          {title && (
            <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
              {title}
            </h2>
          )}
          <button
            onClick={onClose}
            className={cn(
              'ml-auto p-1.5 rounded-lg transition-colors',
              'text-gray-400 hover:text-gray-600 hover:bg-gray-100',
              'dark:text-slate-500 dark:hover:text-slate-300 dark:hover:bg-slate-700',
            )}
          >
            <X size={18} />
          </button>
        </div>
        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-6 py-5">
          {children}
        </div>
      </div>
    </div>
  );
}

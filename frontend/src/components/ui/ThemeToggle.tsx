/**
 * ThemeToggle.tsx
 *
 * A three-state toggle: Light → Dark → System
 * Clicking cycles through the three modes.
 *
 * Icons animate with a smooth rotate+fade on switch.
 */

import { Sun, Moon, Monitor } from 'lucide-react';
import { useThemeStore, type ThemeMode } from '@/store/themeStore';
import { cn } from '@/utils/cn';

const CYCLE: ThemeMode[] = ['light', 'dark', 'system'];

const ICONS: Record<ThemeMode, React.ReactNode> = {
  light:  <Sun  size={16} />,
  dark:   <Moon size={16} />,
  system: <Monitor size={16} />,
};

const LABELS: Record<ThemeMode, string> = {
  light:  'Light',
  dark:   'Dark',
  system: 'System',
};

interface ThemeToggleProps {
  /** 'icon' = compact icon-only button (for Navbar)
   *  'full' = icon + label (for settings / profile pages) */
  variant?: 'icon' | 'full';
  className?: string;
}

export function ThemeToggle({ variant = 'icon', className }: ThemeToggleProps) {
  const { mode, setMode } = useThemeStore();

  const handleClick = () => {
    const next = CYCLE[(CYCLE.indexOf(mode) + 1) % CYCLE.length];
    setMode(next);
  };

  if (variant === 'full') {
    return (
      <button
        onClick={handleClick}
        aria-label={`Switch theme (current: ${LABELS[mode]})`}
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium',
          'text-gray-600 dark:text-gray-300',
          'hover:bg-gray-100 dark:hover:bg-gray-800',
          'transition-all duration-200 active:scale-95',
          className
        )}
      >
        <span
          key={mode}
          className="animate-in fade-in spin-in-90 duration-300"
        >
          {ICONS[mode]}
        </span>
        <span>{LABELS[mode]}</span>
      </button>
    );
  }

  // ── Icon-only (Navbar) ────────────────────────────────────
  return (
    <button
      onClick={handleClick}
      aria-label={`Switch theme (current: ${LABELS[mode]})`}
      title={`Theme: ${LABELS[mode]} — click to cycle`}
      className={cn(
        'relative p-2 rounded-lg transition-all duration-200 active:scale-95',
        // Navbar sits on dark bg, so always use light icon colors there
        'text-gray-300 hover:text-white hover:bg-gray-700',
        className
      )}
    >
      {/* Animated icon swap */}
      <span
        key={mode}
        className="block animate-in fade-in zoom-in-75 spin-in-45 duration-300"
      >
        {ICONS[mode]}
      </span>

      {/* Tiny mode indicator dot */}
      <span
        className={cn(
          'absolute bottom-1 right-1 w-1.5 h-1.5 rounded-full',
          mode === 'light'  && 'bg-yellow-400',
          mode === 'dark'   && 'bg-blue-400',
          mode === 'system' && 'bg-green-400',
        )}
      />
    </button>
  );
}

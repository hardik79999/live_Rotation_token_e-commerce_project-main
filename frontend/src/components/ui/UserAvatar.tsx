/**
 * UserAvatar — single source of truth for all user/seller avatars.
 *
 * Priority:
 *   1. Real photo (src prop) — shown with <img>
 *   2. If img fails to load → falls back to initial-letter gradient
 *   3. If no src at all → initial-letter gradient immediately
 *
 * The gradient colour is deterministic from the name so the same user
 * always gets the same colour (no flicker on re-render).
 */
import { useState } from 'react';
import { getImageUrl } from '@/utils/image';
import { cn } from '@/utils/cn';

// ── Deterministic colour from name ────────────────────────────
const GRADIENTS = [
  'from-orange-400 to-orange-600',
  'from-violet-400 to-violet-600',
  'from-blue-400   to-blue-600',
  'from-emerald-400 to-emerald-600',
  'from-rose-400   to-rose-600',
  'from-amber-400  to-amber-600',
  'from-cyan-400   to-cyan-600',
  'from-pink-400   to-pink-600',
];

function gradientFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length];
}

// ── Size map ──────────────────────────────────────────────────
const SIZE: Record<string, { wrapper: string; text: string }> = {
  xs:  { wrapper: 'w-6  h-6',  text: 'text-xs' },
  sm:  { wrapper: 'w-8  h-8',  text: 'text-xs' },
  md:  { wrapper: 'w-10 h-10', text: 'text-sm' },
  lg:  { wrapper: 'w-16 h-16', text: 'text-2xl' },
  xl:  { wrapper: 'w-20 h-20', text: 'text-3xl' },
};

interface Props {
  /** URL or path to the profile photo. Null/undefined → show initial. */
  src?:       string | null;
  /** Used for alt text and to derive the initial letter + gradient colour. */
  name:       string;
  size?:      'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  /** Extra classes applied to the <img> element only. */
  imgClassName?: string;
}

export function UserAvatar({ src, name, size = 'md', className, imgClassName }: Props) {
  const [imgError, setImgError] = useState(false);

  const { wrapper, text } = SIZE[size] ?? SIZE.md;
  const initial  = (name || '?').charAt(0).toUpperCase();
  const gradient = gradientFor(name || '?');
  const showImg  = !!src && !imgError;

  return (
    <div
      className={cn(
        wrapper,
        'rounded-full shrink-0 overflow-hidden',
        !showImg && `bg-gradient-to-br ${gradient} flex items-center justify-center`,
        className,
      )}
    >
      {showImg ? (
        <img
          src={getImageUrl(src!)}
          alt={name}
          className={cn('w-full h-full object-cover', imgClassName)}
          onError={() => setImgError(true)}
        />
      ) : (
        <span className={cn('font-bold text-white select-none', text)}>
          {initial}
        </span>
      )}
    </div>
  );
}

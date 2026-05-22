/**
 * SellerKYCModal
 * ──────────────
 * A polished identity & registration details modal for the Admin dashboard.
 * Opens when the admin clicks the seller's name or avatar in SellerDetailPage.
 *
 * Shows:
 *  - Real profile photo (with initial-letter fallback)
 *  - Personal details: username, email, phone, join date
 *  - Account status with visual indicator
 *  - Approved categories
 *  - Performance snapshot (metrics passed as props)
 *  - UUID for internal reference
 *
 * Strictly read-only — no edit controls.
 */

import { useEffect, useRef } from 'react';
import {
  X, Mail, Phone, Calendar, Tag, Shield,
  ShieldOff, Hash, TrendingUp, Package, ShoppingBag,
} from 'lucide-react';
import type { SellerDetail } from '@/types';
import { formatPrice, formatDate, getImageUrl } from '@/utils/image';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/utils/cn';

// ── Info row ──────────────────────────────────────────────────────────────────
function InfoRow({ icon, label, value }: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-gray-50 dark:border-slate-700/50 last:border-0">
      <div className="mt-0.5 text-gray-400 dark:text-slate-500 shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-400 dark:text-slate-500 font-medium">{label}</p>
        <div className="text-sm font-semibold text-gray-800 dark:text-slate-200 mt-0.5 break-all">{value}</div>
      </div>
    </div>
  );
}

// ── Metric pill ───────────────────────────────────────────────────────────────
function MetricPill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className={cn('rounded-xl px-3 py-2.5 text-center', color)}>
      <p className="text-lg font-bold">{value}</p>
      <p className="text-xs opacity-70 mt-0.5">{label}</p>
    </div>
  );
}

// ── Avatar with real photo + fallback ─────────────────────────────────────────
function SellerAvatar({ photo, name, size = 'lg' }: {
  photo: string | null;
  name: string;
  size?: 'sm' | 'lg';
}) {
  const dim = size === 'lg' ? 'w-20 h-20 text-3xl' : 'w-10 h-10 text-base';

  if (photo) {
    return (
      <img
        src={getImageUrl(photo)}
        alt={name}
        className={cn(
          dim,
          'rounded-full object-cover ring-4 ring-white dark:ring-slate-800 shadow-lg shrink-0'
        )}
        onError={(e) => {
          // On error, hide the img and let the parent render the fallback
          (e.target as HTMLImageElement).style.display = 'none';
        }}
      />
    );
  }

  return (
    <div className={cn(
      dim,
      'rounded-full bg-gradient-to-br from-orange-400 to-orange-600',
      'flex items-center justify-center text-white font-bold',
      'ring-4 ring-white dark:ring-slate-800 shadow-lg shrink-0'
    )}>
      {name[0]?.toUpperCase() ?? '?'}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
interface SellerKYCModalProps {
  isOpen: boolean;
  onClose: () => void;
  detail: SellerDetail;
}

export function SellerKYCModal({ isOpen, onClose, detail }: SellerKYCModalProps) {
  const { profile, metrics, approved_categories } = detail;

  // Animation state
  const [visible, setVisible] = [isOpen, () => {}]; // simplified — use CSS transition
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [mounted, setMounted] = [isOpen, () => {}];

  // We use a simpler pattern here: mount/unmount driven by isOpen directly,
  // with CSS transition on the panel itself.
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else        document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (isOpen) document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Seller Identity"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/55 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={cn(
          'relative w-full max-w-md max-h-[90vh] flex flex-col',
          'bg-white dark:bg-slate-900',
          'rounded-2xl shadow-2xl dark:shadow-slate-950/70',
          'border border-gray-100 dark:border-slate-700/60',
          'animate-in fade-in zoom-in-95 duration-200',
        )}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Cover + avatar ── */}
        <div className="relative shrink-0">
          {/* Cover gradient */}
          <div className={cn(
            'h-24 rounded-t-2xl',
            profile.is_active
              ? 'bg-gradient-to-r from-orange-500 via-orange-400 to-amber-400'
              : 'bg-gradient-to-r from-gray-500 to-gray-600'
          )} />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-1.5 rounded-lg bg-black/20 hover:bg-black/30 text-white transition-colors"
            aria-label="Close"
          >
            <X size={16} />
          </button>

          {/* Avatar — overlaps cover */}
          <div className="absolute -bottom-10 left-5">
            <SellerAvatar photo={profile.profile_photo} name={profile.username} size="lg" />
          </div>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto pt-14 px-5 pb-5 space-y-5">
          {/* Name + status */}
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100">
                {profile.username}
              </h2>
              <Badge variant={profile.is_active ? 'success' : 'danger'}>
                {profile.is_active ? (
                  <><Shield size={10} className="mr-1" /> Active</>
                ) : (
                  <><ShieldOff size={10} className="mr-1" /> Blocked</>
                )}
              </Badge>
            </div>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">Seller Account</p>
          </div>

          {/* Performance snapshot */}
          <div className="grid grid-cols-3 gap-2">
            <MetricPill
              label="Products"
              value={String(metrics.total_products_active)}
              color="bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400"
            />
            <MetricPill
              label="Orders"
              value={String(metrics.total_orders)}
              color="bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400"
            />
            <MetricPill
              label="Revenue"
              value={formatPrice(metrics.total_revenue).replace('₹', '₹')}
              color="bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400"
            />
          </div>

          {/* Contact & registration details */}
          <div className="bg-gray-50 dark:bg-slate-800/50 rounded-xl px-4 py-1 border border-gray-100 dark:border-slate-700/50">
            <InfoRow
              icon={<Mail size={14} />}
              label="Email Address"
              value={profile.email}
            />
            <InfoRow
              icon={<Phone size={14} />}
              label="Phone Number"
              value={profile.phone ?? <span className="text-gray-400 dark:text-slate-500 font-normal">Not provided</span>}
            />
            <InfoRow
              icon={<Calendar size={14} />}
              label="Registered On"
              value={profile.joined_at ? formatDate(profile.joined_at) : '—'}
            />
            <InfoRow
              icon={<Hash size={14} />}
              label="Seller UUID"
              value={
                <span className="font-mono text-xs text-gray-500 dark:text-slate-400 break-all">
                  {profile.uuid}
                </span>
              }
            />
          </div>

          {/* Approved categories */}
          {approved_categories.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Tag size={11} /> Approved Categories ({approved_categories.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {approved_categories.map(cat => (
                  <span
                    key={cat}
                    className="text-xs bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 px-2.5 py-1 rounded-full font-medium border border-orange-100 dark:border-orange-500/20"
                  >
                    {cat}
                  </span>
                ))}
              </div>
            </div>
          )}

          {approved_categories.length === 0 && (
            <div className="text-center py-4 text-gray-400 dark:text-slate-500 text-sm">
              <Tag size={20} className="mx-auto mb-1.5 opacity-30" />
              No approved categories yet
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="px-5 py-3.5 border-t border-gray-100 dark:border-slate-700/60 shrink-0 bg-gray-50/50 dark:bg-slate-800/30 rounded-b-2xl">
          <p className="text-xs text-center text-gray-400 dark:text-slate-500">
            Admin view only · All data is read-only
          </p>
        </div>
      </div>
    </div>
  );
}

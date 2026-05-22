// In production (.env.production), VITE_API_URL or VITE_API_BASE_URL may be '' (empty string).
// ?? falls back only on null/undefined — NOT on empty string.
// This means production uses relative paths, dev uses the Flask backend origin.
const BASE = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || '';

/**
 * Convert a relative image path from the backend (/static/uploads/...)
 * into a full URL pointing at the Flask server.
 */
export function getImageUrl(path: string | null | undefined): string {
  if (!path) return '/placeholder-product.png';
  if (path.startsWith('http')) return path;
  return `${BASE}${path}`;
}

export function formatPrice(amount: number | null | undefined): string {
  const safe = (typeof amount === 'number' && isFinite(amount)) ? amount : 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(safe);
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

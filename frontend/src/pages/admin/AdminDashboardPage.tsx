import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, Package, ShoppingBag, TrendingUp, Plus,
  CheckCircle, Clock, Truck, XCircle, RefreshCw,
  ArrowRight, BarChart3, DollarSign, Activity,
  Star, AlertTriangle, Eye, Search, Smile, Image, Type,
  Laptop, Shirt, Dumbbell, BookOpen, Home, Car, Baby,
  Utensils, Gamepad2, Music, Camera, Headphones, Watch,
  Gem, Flower2, Leaf, Zap, Globe, Heart, Gift, Coffee,
  Bike, Plane, Palette, Scissors, Wrench, Pill,
} from 'lucide-react';
import { adminApi } from '@/api/admin';
import { formatPrice, formatDate, getImageUrl } from '@/utils/image';
import { Badge, orderStatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { cn } from '@/utils/cn';
import toast from 'react-hot-toast';

// ── Types ─────────────────────────────────────────────────────
interface ItemPreview {
  product_uuid: string;
  product_name: string;
  quantity: number;
  image: string | null;
}

interface DashboardData {
  total_users: number;
  total_products: number;
  total_orders: number;
  total_revenue: number;
  order_status_breakdown: Record<string, number>;
  recent_orders: {
    uuid: string;
    amount: number;
    status: string;
    payment_method: string;
    date: string;
    items_preview: ItemPreview[];
  }[];
  top_products: {
    name: string;
    uuid: string;
    total_sold: number;
    total_revenue: number;
  }[];
}

// ── Skeleton ──────────────────────────────────────────────────
function Sk({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-xl bg-gray-100 dark:bg-slate-700', className)} />;
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2"><Sk className="h-7 w-48" /><Sk className="h-4 w-64" /></div>
        <div className="flex gap-2"><Sk className="h-9 w-24" /><Sk className="h-9 w-32" /></div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1,2,3,4].map(i => <Sk key={i} className="h-28" />)}
      </div>
      <div className="grid lg:grid-cols-3 gap-4">
        <Sk className="lg:col-span-2 h-52" /><Sk className="h-52" />
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <Sk className="h-64" /><Sk className="h-64" />
      </div>
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────
function StatCard({
  title, value, icon, accent, sub,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  /** Tailwind color name: 'blue' | 'violet' | 'orange' | 'emerald' */
  accent: 'blue' | 'violet' | 'orange' | 'emerald';
  sub?: string;
}) {
  const styles = {
    blue:    { wrap: 'bg-blue-50    dark:bg-blue-500/10   border-blue-100    dark:border-blue-500/20',   icon: 'bg-blue-100    dark:bg-blue-500/20   text-blue-600    dark:text-blue-400',   val: 'text-blue-700    dark:text-blue-300'   },
    violet:  { wrap: 'bg-violet-50  dark:bg-violet-500/10 border-violet-100  dark:border-violet-500/20', icon: 'bg-violet-100  dark:bg-violet-500/20 text-violet-600  dark:text-violet-400', val: 'text-violet-700  dark:text-violet-300' },
    orange:  { wrap: 'bg-orange-50  dark:bg-orange-500/10 border-orange-100  dark:border-orange-500/20', icon: 'bg-orange-100  dark:bg-orange-500/20 text-orange-600  dark:text-orange-400', val: 'text-orange-700  dark:text-orange-300' },
    emerald: { wrap: 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20', icon: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400', val: 'text-emerald-700 dark:text-emerald-300' },
  }[accent];

  return (
    <div className={cn('rounded-2xl p-5 border', styles.wrap)}>
      <div className="flex items-start justify-between mb-3">
        <p className="text-sm font-medium text-gray-500 dark:text-slate-400">{title}</p>
        <div className={cn('p-2 rounded-xl', styles.icon)}>{icon}</div>
      </div>
      <p className={cn('text-3xl font-bold tracking-tight', styles.val)}>{value}</p>
      {sub && <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}

// ── Mini bar chart (pure CSS) ─────────────────────────────────
function MiniBarChart({ data }: { data: Record<string, number> }) {
  const entries = Object.entries(data);
  const max = Math.max(...entries.map(([, v]) => v), 1);

  const COLORS: Record<string, string> = {
    pending:    'bg-yellow-400',
    processing: 'bg-blue-400',
    shipped:    'bg-orange-400',
    delivered:  'bg-green-400',
    cancelled:  'bg-red-400',
  };

  return (
    <div className="flex items-end gap-2 h-20">
      {entries.map(([status, count]) => (
        <div key={status} className="flex-1 flex flex-col items-center gap-1">
          <span className="text-xs font-bold text-gray-700 dark:text-slate-300">{count}</span>
          <div
            className={cn('w-full rounded-t-md transition-all duration-500', COLORS[status] ?? 'bg-gray-400')}
            style={{ height: `${Math.max(4, (count / max) * 56)}px` }}
          />
          <span className="text-[10px] text-gray-400 dark:text-slate-500 capitalize truncate w-full text-center">
            {status.slice(0, 4)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Donut ring (SVG) ──────────────────────────────────────────
function DonutRing({ data }: { data: Record<string, number> }) {
  const total = Object.values(data).reduce((a, b) => a + b, 0) || 1;
  const COLORS: Record<string, string> = {
    delivered:  '#22c55e',
    shipped:    '#f97316',
    processing: '#3b82f6',
    pending:    '#eab308',
    cancelled:  '#ef4444',
  };

  const r = 40;
  const circ = 2 * Math.PI * r;
  let offset = 0;

  const slices = Object.entries(data).map(([status, count]) => {
    const pct   = count / total;
    const dash  = pct * circ;
    const slice = { status, count, pct, dash, offset };
    offset += dash;
    return slice;
  });

  return (
    <div className="flex items-center gap-4">
      <svg width="100" height="100" viewBox="0 0 100 100" className="shrink-0">
        <circle cx="50" cy="50" r={r} fill="none" stroke="#e5e7eb" strokeWidth="14" className="dark:stroke-slate-700" />
        {slices.map((s) => (
          <circle
            key={s.status}
            cx="50" cy="50" r={r}
            fill="none"
            stroke={COLORS[s.status] ?? '#94a3b8'}
            strokeWidth="14"
            strokeDasharray={`${s.dash} ${circ - s.dash}`}
            strokeDashoffset={-s.offset + circ / 4}
            strokeLinecap="butt"
          />
        ))}
        <text x="50" y="54" textAnchor="middle" className="fill-gray-800 dark:fill-slate-100" fontSize="14" fontWeight="bold">
          {total}
        </text>
      </svg>
      <div className="space-y-1.5 min-w-0">
        {slices.map((s) => (
          <div key={s.status} className="flex items-center gap-2 text-xs">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ background: COLORS[s.status] ?? '#94a3b8' }}
            />
            <span className="text-gray-600 dark:text-slate-400 capitalize">{s.status}</span>
            <span className="font-semibold text-gray-800 dark:text-slate-200 ml-auto">{s.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Icon Picker ───────────────────────────────────────────────
type IconTab = 'emoji' | 'lucide' | 'url';

const EMOJI_GROUPS = [
  { label: 'Popular', icons: ['📱','💻','🖥️','⌨️','🖱️','🎮','📷','🎧','⌚','📺','🔌','💡'] },
  { label: 'Shopping', icons: ['🛍️','🛒','💳','🏷️','🎁','💰','💎','👜','👟','👗','🧴','🧸'] },
  { label: 'Food', icons: ['🍕','🍔','🍜','🍣','☕','🍰','🥗','🍷','🧃','🍫','🥩','🌮'] },
  { label: 'Sports', icons: ['⚽','🏀','🎾','🏋️','🚴','🏊','🎯','🏆','🥊','⛷️','🏄','🎿'] },
  { label: 'Home', icons: ['🏠','🛋️','🪴','🛏️','🚿','🪑','🧹','🔑','🪟','🏡','🛁','🪞'] },
  { label: 'Health', icons: ['💊','🩺','🏥','🧬','💉','🩹','🧘','🥦','🫀','🦷','👁️','🧠'] },
  { label: 'Travel', icons: ['✈️','🚗','🚢','🏖️','🗺️','🧳','🏔️','🚂','🛵','🚁','⛵','🏕️'] },
  { label: 'Art', icons: ['🎨','🎭','🎬','🎵','📚','✏️','🖌️','📸','🎤','🎻','🎹','🎲'] },
];

const LUCIDE_ICONS: { name: string; icon: React.ReactNode; label: string }[] = [
  { name: 'Laptop',     icon: <Laptop size={20} />,     label: 'Electronics'  },
  { name: 'Shirt',      icon: <Shirt size={20} />,      label: 'Fashion'      },
  { name: 'Dumbbell',   icon: <Dumbbell size={20} />,   label: 'Sports'       },
  { name: 'BookOpen',   icon: <BookOpen size={20} />,   label: 'Books'        },
  { name: 'Home',       icon: <Home size={20} />,       label: 'Home'         },
  { name: 'Car',        icon: <Car size={20} />,        label: 'Automotive'   },
  { name: 'Baby',       icon: <Baby size={20} />,       label: 'Kids'         },
  { name: 'Utensils',   icon: <Utensils size={20} />,   label: 'Food'         },
  { name: 'Gamepad2',   icon: <Gamepad2 size={20} />,   label: 'Gaming'       },
  { name: 'Music',      icon: <Music size={20} />,      label: 'Music'        },
  { name: 'Camera',     icon: <Camera size={20} />,     label: 'Photography'  },
  { name: 'Headphones', icon: <Headphones size={20} />, label: 'Audio'        },
  { name: 'Watch',      icon: <Watch size={20} />,      label: 'Watches'      },
  { name: 'Gem',        icon: <Gem size={20} />,        label: 'Jewellery'    },
  { name: 'Flower2',    icon: <Flower2 size={20} />,    label: 'Beauty'       },
  { name: 'Leaf',       icon: <Leaf size={20} />,       label: 'Organic'      },
  { name: 'Zap',        icon: <Zap size={20} />,        label: 'Deals'        },
  { name: 'Globe',      icon: <Globe size={20} />,      label: 'Global'       },
  { name: 'Heart',      icon: <Heart size={20} />,      label: 'Health'       },
  { name: 'Gift',       icon: <Gift size={20} />,       label: 'Gifts'        },
  { name: 'Coffee',     icon: <Coffee size={20} />,     label: 'Beverages'    },
  { name: 'Bike',       icon: <Bike size={20} />,       label: 'Cycling'      },
  { name: 'Plane',      icon: <Plane size={20} />,      label: 'Travel'       },
  { name: 'Palette',    icon: <Palette size={20} />,    label: 'Art'          },
  { name: 'Scissors',   icon: <Scissors size={20} />,   label: 'Salon'        },
  { name: 'Wrench',     icon: <Wrench size={20} />,     label: 'Tools'        },
  { name: 'Pill',       icon: <Pill size={20} />,       label: 'Pharmacy'     },
  { name: 'Package',    icon: <Package size={20} />,    label: 'General'      },
];

function IconPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [tab, setTab]         = useState<IconTab>('emoji');
  const [search, setSearch]   = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [urlError, setUrlError] = useState('');
  const urlRef = useRef<HTMLInputElement>(null);

  const filteredEmojis = search.trim()
    ? EMOJI_GROUPS.flatMap(g => g.icons).filter((_, i) =>
        // simple index-based filter — emoji search by group label
        EMOJI_GROUPS.some(g =>
          g.label.toLowerCase().includes(search.toLowerCase()) && g.icons.includes(EMOJI_GROUPS.flatMap(x => x.icons)[i])
        )
      )
    : null;

  const filteredLucide = LUCIDE_ICONS.filter(l =>
    !search.trim() || l.label.toLowerCase().includes(search.toLowerCase()) || l.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleUrlApply = () => {
    const v = urlInput.trim();
    if (!v) { setUrlError('Enter an image URL'); return; }
    if (!/^https?:\/\/.+\.(png|jpg|jpeg|gif|svg|webp|ico)(\?.*)?$/i.test(v)) {
      setUrlError('Must be a direct image URL (.png, .jpg, .svg, .gif, .webp)');
      return;
    }
    setUrlError('');
    onChange(v);
  };

  // Detect if current value is a URL
  const isUrl = value.startsWith('http');

  return (
    <div className="space-y-3">
      {/* Preview */}
      <div className="flex items-center gap-3">
        <div className="w-14 h-14 rounded-2xl border-2 border-orange-300 dark:border-orange-500/50 bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center shrink-0 overflow-hidden">
          {!value ? (
            <Smile size={22} className="text-orange-300 dark:text-orange-500/50" />
          ) : isUrl ? (
            <img src={value} alt="icon" className="w-10 h-10 object-contain" onError={() => onChange('')} />
          ) : value.length <= 4 ? (
            <span className="text-3xl leading-none">{value}</span>
          ) : (
            <span className="text-orange-500 dark:text-orange-400"><Package size={22} /></span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">Selected Icon</p>
          <p className="text-xs text-gray-400 dark:text-slate-500 truncate">
            {!value ? 'None selected' : isUrl ? 'Custom image URL' : `Emoji: ${value}`}
          </p>
          {value && (
            <button
              type="button"
              onClick={() => { onChange(''); setUrlInput(''); }}
              className="text-xs text-red-400 hover:text-red-600 mt-1 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 dark:bg-slate-700/50 rounded-xl">
        {([
          { id: 'emoji',  label: 'Emoji',  Icon: Smile },
          { id: 'lucide', label: 'Icons',  Icon: Type  },
          { id: 'url',    label: 'Image',  Icon: Image },
        ] as { id: IconTab; label: string; Icon: React.ElementType }[]).map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => { setTab(id); setSearch(''); }}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all',
              tab === id
                ? 'bg-white dark:bg-slate-800 text-orange-600 dark:text-orange-400 shadow-sm'
                : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300',
            )}
          >
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>

      {/* Search — shown for emoji + lucide tabs */}
      {tab !== 'url' && (
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" />
          <input
            type="text"
            placeholder={tab === 'emoji' ? 'Search category (food, sports…)' : 'Search icon name…'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-xs border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-800 dark:text-slate-200 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:border-orange-400 dark:focus:border-orange-500 transition-colors"
          />
        </div>
      )}

      {/* ── Emoji tab ── */}
      {tab === 'emoji' && (
        <div className="max-h-52 overflow-y-auto space-y-3 pr-1">
          {(search.trim()
            ? EMOJI_GROUPS.filter(g => g.label.toLowerCase().includes(search.toLowerCase()))
            : EMOJI_GROUPS
          ).map((group) => (
            <div key={group.label}>
              <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wide mb-1.5">
                {group.label}
              </p>
              <div className="grid grid-cols-8 gap-1">
                {group.icons.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => onChange(emoji)}
                    className={cn(
                      'w-8 h-8 rounded-lg text-lg flex items-center justify-center transition-all hover:scale-110 active:scale-95',
                      value === emoji
                        ? 'bg-orange-100 dark:bg-orange-500/20 ring-2 ring-orange-400 dark:ring-orange-500'
                        : 'hover:bg-gray-100 dark:hover:bg-slate-700',
                    )}
                    title={emoji}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {search.trim() && EMOJI_GROUPS.filter(g => g.label.toLowerCase().includes(search.toLowerCase())).length === 0 && (
            <p className="text-xs text-gray-400 dark:text-slate-500 text-center py-4">No groups match "{search}"</p>
          )}
        </div>
      )}

      {/* ── Lucide tab ── */}
      {tab === 'lucide' && (
        <div className="max-h-52 overflow-y-auto pr-1">
          <div className="grid grid-cols-4 gap-1.5">
            {filteredLucide.map((item) => (
              <button
                key={item.name}
                type="button"
                onClick={() => onChange(item.name)}
                className={cn(
                  'flex flex-col items-center gap-1 p-2 rounded-xl border transition-all hover:scale-105 active:scale-95',
                  value === item.name
                    ? 'border-orange-400 dark:border-orange-500 bg-orange-50 dark:bg-orange-500/15 text-orange-600 dark:text-orange-400'
                    : 'border-gray-100 dark:border-slate-700 hover:border-orange-300 dark:hover:border-orange-500/40 text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700/50',
                )}
                title={item.label}
              >
                {item.icon}
                <span className="text-[9px] font-medium truncate w-full text-center leading-tight">{item.label}</span>
              </button>
            ))}
          </div>
          {filteredLucide.length === 0 && (
            <p className="text-xs text-gray-400 dark:text-slate-500 text-center py-4">No icons match "{search}"</p>
          )}
        </div>
      )}

      {/* ── URL tab ── */}
      {tab === 'url' && (
        <div className="space-y-3">
          <p className="text-xs text-gray-500 dark:text-slate-400">
            Paste a direct image URL — supports PNG, JPG, SVG, GIF, WebP from any source.
          </p>
          <div className="flex gap-2">
            <input
              ref={urlRef}
              type="url"
              placeholder="https://example.com/icon.png"
              value={urlInput}
              onChange={(e) => { setUrlInput(e.target.value); setUrlError(''); }}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleUrlApply())}
              className="flex-1 border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 text-xs bg-white dark:bg-slate-800 text-gray-800 dark:text-slate-200 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:border-orange-400 dark:focus:border-orange-500 transition-colors"
            />
            <button
              type="button"
              onClick={handleUrlApply}
              className="px-3 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold transition-colors shrink-0"
            >
              Apply
            </button>
          </div>
          {urlError && <p className="text-xs text-red-500">{urlError}</p>}
          {/* Quick suggestions */}
          <div>
            <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wide mb-2">
              Quick — paste from these sources
            </p>
            <div className="flex flex-wrap gap-1.5">
              {[
                { label: 'Flaticon',   url: 'https://www.flaticon.com' },
                { label: 'Icons8',     url: 'https://icons8.com' },
                { label: 'SVGRepo',    url: 'https://www.svgrepo.com' },
                { label: 'Iconfinder', url: 'https://www.iconfinder.com' },
              ].map((s) => (
                <a
                  key={s.label}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] px-2 py-1 rounded-md bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-400 hover:bg-orange-50 dark:hover:bg-orange-500/10 hover:text-orange-600 dark:hover:text-orange-400 transition-colors"
                >
                  {s.label} ↗
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────
const STATUS_ICONS: Record<string, React.ReactNode> = {
  pending:    <Clock size={14} className="text-yellow-500" />,
  processing: <Package size={14} className="text-blue-500" />,
  shipped:    <Truck size={14} className="text-orange-500" />,
  delivered:  <CheckCircle size={14} className="text-green-500" />,
  cancelled:  <XCircle size={14} className="text-red-500" />,
};

export function AdminDashboardPage() {
  const [data,    setData]    = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCatModal, setShowCatModal] = useState(false);
  const [catForm, setCatForm] = useState({ name: '', description: '', icon: '' });
  const [savingCat, setSavingCat] = useState(false);

  const fetchDashboard = () => {
    setLoading(true);
    adminApi.getDashboard()
      .then((r) => setData((r.data.data as DashboardData) || null))
      .catch(() => toast.error('Failed to load dashboard'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchDashboard(); }, []);

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catForm.name.trim()) { toast.error('Category name required'); return; }
    setSavingCat(true);
    try {
      await adminApi.createCategory(catForm);
      toast.success('Category created!');
      setShowCatModal(false);
      setCatForm({ name: '', description: '', icon: '' });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Failed to create category');
    } finally {
      setSavingCat(false);
    }
  };

  if (loading) return <DashboardSkeleton />;

  const breakdown = data?.order_status_breakdown ?? {};
  const delivered = breakdown['delivered'] ?? 0;
  const total_orders = data?.total_orders ?? 0;
  const fulfillmentRate = total_orders > 0 ? Math.round((delivered / total_orders) * 100) : 0;

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Admin Dashboard</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
            Platform overview · {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchDashboard}>
            <RefreshCw size={14} /> Refresh
          </Button>
          <Button size="sm" onClick={() => setShowCatModal(true)}>
            <Plus size={14} /> New Category
          </Button>
        </div>
      </div>

      {/* ── KPI stat cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Users"
          value={data?.total_users ?? 0}
          icon={<Users size={18} />}
          accent="blue"
          sub="Active accounts"
        />
        <StatCard
          title="Total Products"
          value={data?.total_products ?? 0}
          icon={<Package size={18} />}
          accent="violet"
          sub="Live listings"
        />
        <StatCard
          title="Total Orders"
          value={data?.total_orders ?? 0}
          icon={<ShoppingBag size={18} />}
          accent="orange"
          sub={`${fulfillmentRate}% fulfilled`}
        />
        <StatCard
          title="Total Revenue"
          value={formatPrice(data?.total_revenue ?? 0)}
          icon={<DollarSign size={18} />}
          accent="emerald"
          sub="Completed payments"
        />
      </div>

      {/* ── Analytics row ── */}
      <div className="grid lg:grid-cols-3 gap-4">

        {/* Order status donut */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-5">
          <h2 className="font-bold text-gray-900 dark:text-slate-100 mb-4 flex items-center gap-2 text-sm">
            <Activity size={16} className="text-orange-500" /> Order Status
          </h2>
          {Object.keys(breakdown).length > 0
            ? <DonutRing data={breakdown} />
            : <p className="text-sm text-gray-400 dark:text-slate-500 text-center py-6">No orders yet</p>
          }
        </div>

        {/* Bar chart */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-5">
          <h2 className="font-bold text-gray-900 dark:text-slate-100 mb-4 flex items-center gap-2 text-sm">
            <BarChart3 size={16} className="text-blue-500" /> Volume by Status
          </h2>
          {Object.keys(breakdown).length > 0
            ? <MiniBarChart data={breakdown} />
            : <p className="text-sm text-gray-400 dark:text-slate-500 text-center py-6">No data</p>
          }
        </div>

        {/* Fulfillment rate ring */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-5 flex flex-col items-center justify-center gap-3">
          <h2 className="font-bold text-gray-900 dark:text-slate-100 text-sm flex items-center gap-2 self-start">
            <TrendingUp size={16} className="text-green-500" /> Fulfillment Rate
          </h2>
          {/* SVG progress ring */}
          <svg width="110" height="110" viewBox="0 0 110 110">
            <circle cx="55" cy="55" r="46" fill="none" stroke="#e5e7eb" strokeWidth="10" className="dark:stroke-slate-700" />
            <circle
              cx="55" cy="55" r="46"
              fill="none"
              stroke={fulfillmentRate >= 70 ? '#22c55e' : fulfillmentRate >= 40 ? '#f97316' : '#ef4444'}
              strokeWidth="10"
              strokeDasharray={`${(fulfillmentRate / 100) * 289} 289`}
              strokeDashoffset="72"
              strokeLinecap="round"
              className="transition-all duration-700"
            />
            <text x="55" y="52" textAnchor="middle" fontSize="20" fontWeight="bold" className="fill-gray-800 dark:fill-slate-100">
              {fulfillmentRate}%
            </text>
            <text x="55" y="68" textAnchor="middle" fontSize="9" className="fill-gray-400 dark:fill-slate-500">
              delivered
            </text>
          </svg>
          <p className="text-xs text-gray-500 dark:text-slate-400 text-center">
            {delivered} of {total_orders} orders delivered
          </p>
        </div>
      </div>

      {/* ── Recent orders + Top products ── */}
      <div className="grid lg:grid-cols-2 gap-6">

        {/* Recent orders */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-slate-700">
            <h2 className="font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
              <ShoppingBag size={16} className="text-orange-500" /> Recent Orders
            </h2>
            <Link to="/admin/category-requests" className="text-xs text-orange-500 hover:text-orange-600 flex items-center gap-1">
              View all <ArrowRight size={12} />
            </Link>
          </div>
          {(data?.recent_orders ?? []).length === 0 ? (
            <div className="text-center py-10 text-gray-400 dark:text-slate-500">
              <ShoppingBag size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No orders yet</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-slate-700/50">
              {(data?.recent_orders ?? []).map((order) => (
                <div key={order.uuid} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                  {(order.items_preview ?? []).length > 0 ? (
                    <div className="flex -space-x-2 shrink-0">
                      {(order.items_preview ?? []).slice(0, 3).map((item, idx) => (
                        <div
                          key={idx}
                          style={{ zIndex: 3 - idx }}
                          className="relative w-9 h-9 rounded-lg overflow-hidden border-2 border-white dark:border-slate-800 bg-gray-100 dark:bg-slate-700 shrink-0"
                        >
                          <img
                            src={getImageUrl(item.image)}
                            alt={item.product_name}
                            className="w-full h-full object-cover"
                            onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder-product.png'; }}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="w-9 h-9 rounded-lg bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center shrink-0">
                      {STATUS_ICONS[order.status] ?? <Package size={14} />}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    {(order.items_preview ?? []).length > 0 && (
                      <p className="text-xs text-gray-600 dark:text-slate-400 truncate mb-0.5">
                        {(order.items_preview ?? []).map((i) => i.product_name).join(', ')}
                      </p>
                    )}
                    <p className="text-xs font-mono text-gray-500 dark:text-slate-400">#{order.uuid.slice(0, 8).toUpperCase()}</p>
                    <p className="text-xs text-gray-400 dark:text-slate-500">{formatDate(order.date)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <Badge variant={orderStatusBadge(order.status)}>
                      {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                    </Badge>
                    <p className="font-bold text-gray-900 dark:text-slate-100 text-sm">{formatPrice(order.amount)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top products */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-slate-700">
            <h2 className="font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
              <Star size={16} className="text-yellow-500" /> Top Selling Products
            </h2>
          </div>
          {(data?.top_products ?? []).length === 0 ? (
            <div className="text-center py-10 text-gray-400 dark:text-slate-500">
              <Package size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No sales data yet</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-slate-700/50">
              {(data?.top_products ?? []).map((p, idx) => {
                const medals = ['🥇', '🥈', '🥉'];
                return (
                  <div key={p.uuid} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                    <span className="text-lg shrink-0 w-7 text-center">
                      {medals[idx] ?? (
                        <span className="w-6 h-6 rounded-full bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 text-xs font-bold flex items-center justify-center">
                          {idx + 1}
                        </span>
                      )}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 dark:text-slate-200 truncate">{p.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-400 dark:text-slate-500">{p.total_sold} units</span>
                        <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-slate-600" />
                        <span className="text-xs text-green-600 dark:text-green-400 font-medium">{formatPrice(p.total_revenue)}</span>
                      </div>
                    </div>
                    {/* Mini progress bar */}
                    <div className="w-16 shrink-0">
                      <div className="h-1.5 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-orange-400 rounded-full"
                          style={{
                            width: `${Math.min(100, (p.total_sold / ((data?.top_products?.[0]?.total_sold ?? 1) || 1)) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Quick action cards ── */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            title: 'Category Requests',
            desc:  'Review seller category approvals',
            to:    '/admin/category-requests',
            icon:  <AlertTriangle size={20} />,
            accent: 'orange' as const,
          },
          {
            title: 'Seller Surveillance',
            desc:  'Monitor revenue and activity',
            to:    '/admin/sellers',
            icon:  <Eye size={20} />,
            accent: 'blue' as const,
          },
          {
            title: 'Product Directory',
            desc:  'Browse all platform products',
            to:    '/admin/products',
            icon:  <Package size={20} />,
            accent: 'violet' as const,
          },
          {
            title: 'Manage Categories',
            desc:  'Edit icons, names and status',
            to:    '/admin/categories',
            icon:  <BarChart3 size={20} />,
            accent: 'emerald' as const,
          },
        ].map((card) => {
          const styles = {
            orange:  { wrap: 'bg-orange-50  dark:bg-orange-500/10  border-orange-100  dark:border-orange-500/20',  icon: 'bg-orange-100  dark:bg-orange-500/20  text-orange-600  dark:text-orange-400',  link: 'text-orange-600  dark:text-orange-400  hover:bg-orange-100  dark:hover:bg-orange-500/20'  },
            blue:    { wrap: 'bg-blue-50    dark:bg-blue-500/10    border-blue-100    dark:border-blue-500/20',    icon: 'bg-blue-100    dark:bg-blue-500/20    text-blue-600    dark:text-blue-400',    link: 'text-blue-600    dark:text-blue-400    hover:bg-blue-100    dark:hover:bg-blue-500/20'    },
            violet:  { wrap: 'bg-violet-50  dark:bg-violet-500/10  border-violet-100  dark:border-violet-500/20',  icon: 'bg-violet-100  dark:bg-violet-500/20  text-violet-600  dark:text-violet-400',  link: 'text-violet-600  dark:text-violet-400  hover:bg-violet-100  dark:hover:bg-violet-500/20'  },
            emerald: { wrap: 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20', icon: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400', link: 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20' },
          }[card.accent];
          return (
            <div key={card.title} className={cn('rounded-2xl p-5 border', styles.wrap)}>
              <div className={cn('p-2 rounded-xl w-fit mb-3', styles.icon)}>{card.icon}</div>
              <h3 className="font-bold text-base mb-1 text-gray-900 dark:text-slate-100">{card.title}</h3>
              <p className="text-gray-500 dark:text-slate-400 text-xs mb-4">{card.desc}</p>
              <Link
                to={card.to}
                className={cn('inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors', styles.link)}
              >
                Open <ArrowRight size={12} />
              </Link>
            </div>
          );
        })}
      </div>

      {/* ── Create Category Modal ── */}
      <Modal isOpen={showCatModal} onClose={() => { setShowCatModal(false); setCatForm({ name: '', description: '', icon: '' }); }} title="Create New Category" size="lg">
        <form onSubmit={handleCreateCategory} className="space-y-5">

          {/* Icon picker */}
          <div>
            <label className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3 block">
              Category Icon
            </label>
            <IconPicker
              value={catForm.icon}
              onChange={(v) => setCatForm({ ...catForm, icon: v })}
            />
          </div>

          {/* Name */}
          <Input
            label="Category Name"
            placeholder="e.g. Electronics"
            value={catForm.name}
            onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
            required
          />

          {/* Description */}
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-1 block">
              Description <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={catForm.description}
              onChange={(e) => setCatForm({ ...catForm, description: e.target.value })}
              rows={2}
              placeholder="Brief description of this category..."
              className="w-full border border-gray-300 dark:border-slate-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:border-orange-500 dark:focus:border-orange-400 resize-none transition-colors"
            />
          </div>

          {/* Live preview */}
          {(catForm.icon || catForm.name) && (
            <div className="flex items-center gap-3 px-4 py-3 bg-orange-50 dark:bg-orange-500/10 rounded-xl border border-orange-200 dark:border-orange-500/30">
              <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 border border-orange-200 dark:border-orange-500/30 flex items-center justify-center shrink-0 overflow-hidden shadow-sm">
                {catForm.icon.startsWith('http') ? (
                  <img src={catForm.icon} alt="icon" className="w-7 h-7 object-contain" />
                ) : catForm.icon ? (
                  <span className="text-2xl leading-none">{catForm.icon}</span>
                ) : (
                  <Package size={18} className="text-orange-400" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xs text-orange-500 dark:text-orange-400 font-semibold uppercase tracking-wide">Preview</p>
                <p className="text-sm font-bold text-orange-700 dark:text-orange-300 truncate">
                  {catForm.name || 'Category name'}
                </p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <Button type="button" variant="ghost" onClick={() => { setShowCatModal(false); setCatForm({ name: '', description: '', icon: '' }); }} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" loading={savingCat} className="flex-1">
              Create Category
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

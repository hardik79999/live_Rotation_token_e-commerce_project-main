/**
 * AddProductModal — tabbed variant-aware product creation form.
 * Tabs: Basic Info → Variants & Stock → Images & Specs
 */
import { useState } from 'react';
import {
  Plus, Trash2, ChevronDown, ChevronUp, Palette,
  Info, Layers, ImageIcon, CheckCircle,
} from 'lucide-react';
import { sellerApi, type SellerCategoryItem } from '@/api/seller';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { MagicDropzone } from '@/components/ui/MagicDropzone';
import { cn } from '@/utils/cn';
import toast from 'react-hot-toast';

// ── Types ─────────────────────────────────────────────────────
interface VariantDraft {
  tempId:           string;
  variant_name:     string;
  sku_code:         string;
  color_name:       string;
  color_code:       string;
  size:             string;
  additional_price: string;
  stock_quantity:   string;
  images:           File[];
  previews:         string[];
  collapsed:        boolean;
}

interface BaseForm {
  name:           string;
  description:    string;
  price:          string;
  stock:          string;
  category_uuid:  string;
  specifications: { key: string; value: string }[];
  sharedImages:   File[];
}

interface Props {
  isOpen:             boolean;
  approvedCategories: SellerCategoryItem[];
  onClose:            () => void;
  onSaved:            () => void;
}

type Tab = 'basic' | 'variants' | 'images';

// ── Helpers ───────────────────────────────────────────────────
let _idCounter = 0;
const newTempId = () => `v_${++_idCounter}_${Date.now()}`;

const emptyVariant = (): VariantDraft => ({
  tempId:           newTempId(),
  variant_name:     '',
  sku_code:         '',
  color_name:       '',
  color_code:       '#6366f1',
  size:             '',
  additional_price: '0',
  stock_quantity:   '0',
  images:           [],
  previews:         [],
  collapsed:        false,
});

const emptyBase: BaseForm = {
  name: '', description: '', price: '', stock: '0',
  category_uuid: '', specifications: [], sharedImages: [],
};

// ── Shared input class ────────────────────────────────────────
const iCls = [
  'w-full rounded-xl border px-3 py-2.5 text-sm transition-colors',
  'border-gray-200 dark:border-slate-600',
  'bg-white dark:bg-slate-800/80',
  'text-gray-900 dark:text-slate-100',
  'placeholder-gray-400 dark:placeholder-slate-500',
  'focus:outline-none focus:border-orange-500 dark:focus:border-orange-400',
  'focus:ring-2 focus:ring-orange-500/10 dark:focus:ring-orange-400/10',
].join(' ');

// ── Field label ───────────────────────────────────────────────
function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide">
      {children}
      {required && <span className="text-orange-500 ml-0.5">*</span>}
    </label>
  );
}

// ── Tab definitions ───────────────────────────────────────────
const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'basic',    label: 'Basic Info',       icon: <Info size={14} /> },
  { id: 'variants', label: 'Variants & Stock', icon: <Layers size={14} /> },
  { id: 'images',   label: 'Images & Specs',   icon: <ImageIcon size={14} /> },
];

function TabNav({
  active, onChange, completedTabs,
}: {
  active: Tab;
  onChange: (t: Tab) => void;
  completedTabs: Set<Tab>;
}) {
  return (
    <div className="flex gap-1 p-1 bg-gray-100 dark:bg-slate-800 rounded-2xl mb-6">
      {TABS.map((tab, idx) => {
        const isActive    = active === tab.id;
        const isCompleted = completedTabs.has(tab.id) && !isActive;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
              isActive
                ? 'bg-white dark:bg-slate-700 text-orange-600 dark:text-orange-400 shadow-sm'
                : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200',
            )}
          >
            <span className={cn(
              'flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold shrink-0 transition-colors',
              isActive    ? 'bg-orange-500 text-white' :
              isCompleted ? 'bg-green-500 text-white'  :
                            'bg-gray-200 dark:bg-slate-600 text-gray-500 dark:text-slate-400',
            )}>
              {isCompleted ? <CheckCircle size={11} /> : idx + 1}
            </span>
            <span className="hidden sm:block">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── Variant card ──────────────────────────────────────────────
function VariantCard({
  variant, index, total, onChange, onRemove,
}: {
  variant:  VariantDraft;
  index:    number;
  total:    number;
  onChange: (v: VariantDraft) => void;
  onRemove: () => void;
}) {
  const set = (patch: Partial<VariantDraft>) => onChange({ ...variant, ...patch });
  const label = variant.variant_name || variant.color_name || variant.size || `Variant ${index + 1}`;
  const stock = parseInt(variant.stock_quantity) || 0;

  const handleFiles = (files: File[]) => {
    const previews = files.map(f => URL.createObjectURL(f));
    set({ images: [...variant.images, ...files], previews: [...variant.previews, ...previews] });
  };
  const removeImg = (i: number) => {
    URL.revokeObjectURL(variant.previews[i]);
    set({
      images:   variant.images.filter((_, j) => j !== i),
      previews: variant.previews.filter((_, j) => j !== i),
    });
  };

  return (
    <div className={cn(
      'rounded-2xl border overflow-hidden transition-all',
      variant.collapsed
        ? 'border-gray-200 dark:border-slate-700'
        : 'border-orange-200 dark:border-orange-500/30 shadow-sm',
    )}>
      {/* Header — click to collapse */}
      <div
        className={cn(
          'flex items-center gap-3 px-4 py-3 cursor-pointer select-none',
          variant.collapsed
            ? 'bg-gray-50 dark:bg-slate-800'
            : 'bg-orange-50/60 dark:bg-orange-500/5',
        )}
        onClick={() => set({ collapsed: !variant.collapsed })}
      >
        <span
          className="w-5 h-5 rounded-full border-2 border-white dark:border-slate-700 shadow-sm shrink-0"
          style={{ backgroundColor: variant.color_code || '#6366f1' }}
        />
        <span className="flex-1 text-sm font-semibold text-gray-800 dark:text-slate-200 truncate">
          {label}
        </span>
        <span className={cn(
          'text-xs font-semibold px-2.5 py-0.5 rounded-full shrink-0',
          stock > 0
            ? 'bg-green-100 dark:bg-green-500/15 text-green-700 dark:text-green-400'
            : 'bg-red-100 dark:bg-red-500/15 text-red-600 dark:text-red-400',
        )}>
          {stock} units
        </span>
        <span className="text-gray-400 dark:text-slate-500 shrink-0">
          {variant.collapsed ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
        </span>
        {total > 1 && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="p-1 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors shrink-0"
            title="Remove variant"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {/* Body */}
      {!variant.collapsed && (
        <div className="px-4 py-4 space-y-4 bg-white dark:bg-slate-800/60">
          {/* Row 1: Name + SKU */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Variant Name</Label>
              <input className={iCls} placeholder="e.g. 128GB · Space Gray"
                value={variant.variant_name} onChange={e => set({ variant_name: e.target.value })} />
            </div>
            <div>
              <Label>SKU Code</Label>
              <input className={iCls} placeholder="e.g. IPH17-128-SG"
                value={variant.sku_code} onChange={e => set({ sku_code: e.target.value })} />
            </div>
          </div>

          {/* Row 2: Color */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Colour Name</Label>
              <input className={iCls} placeholder="e.g. Pacific Blue"
                value={variant.color_name} onChange={e => set({ color_name: e.target.value })} />
            </div>
            <div>
              <Label><span className="flex items-center gap-1"><Palette size={11} /> Colour Hex</span></Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={variant.color_code}
                  onChange={e => set({ color_code: e.target.value })}
                  className="w-10 h-10 rounded-lg border border-gray-200 dark:border-slate-600 cursor-pointer bg-transparent p-0.5 shrink-0"
                />
                <input className={cn(iCls, 'font-mono text-xs')} placeholder="#6366f1"
                  value={variant.color_code} onChange={e => set({ color_code: e.target.value })} maxLength={7} />
              </div>
            </div>
          </div>

          {/* Row 3: Size + Stock + Price modifier */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Size / Storage</Label>
              <input className={iCls} placeholder="e.g. 256GB or XL"
                value={variant.size} onChange={e => set({ size: e.target.value })} />
            </div>
            <div>
              <Label required>Stock (units)</Label>
              <input className={iCls} type="number" min="0"
                value={variant.stock_quantity} onChange={e => set({ stock_quantity: e.target.value })} />
            </div>
            <div>
              <Label>Price Modifier (₹)</Label>
              <input className={iCls} type="number" step="0.01" placeholder="0"
                value={variant.additional_price} onChange={e => set({ additional_price: e.target.value })} />
              <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-1">Added to base price</p>
            </div>
          </div>

          {/* Row 4: Variant images */}
          <div>
            <Label>Images for this variant</Label>
            <MagicDropzone
              onFiles={handleFiles}
              previews={variant.previews}
              onRemove={removeImg}
              label="Drop variant images or click to browse"
              sublabel="JPG, PNG, WebP · or paste with Ctrl+V"
              thumbSize="w-16 h-16"
              globalPaste={false}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────
export function AddProductModal({ isOpen, approvedCategories, onClose, onSaved }: Props) {
  const [activeTab,      setActiveTab]      = useState<Tab>('basic');
  const [base,           setBase]           = useState<BaseForm>(emptyBase);
  const [variants,       setVariants]       = useState<VariantDraft[]>([]);
  const [saving,         setSaving]         = useState(false);
  const [sharedPreviews, setSharedPreviews] = useState<string[]>([]);
  const [visited,        setVisited]        = useState<Set<Tab>>(new Set(['basic']));

  const goTo = (tab: Tab) => {
    setActiveTab(tab);
    setVisited(v => new Set([...v, tab]));
  };

  const reset = () => {
    sharedPreviews.forEach(URL.revokeObjectURL);
    variants.forEach(v => v.previews.forEach(URL.revokeObjectURL));
    setBase(emptyBase);
    setVariants([]);
    setSharedPreviews([]);
    setActiveTab('basic');
    setVisited(new Set(['basic']));
  };

  const handleClose = () => { reset(); onClose(); };

  // ── Shared image handlers ─────────────────────────────────
  const handleSharedFiles = (files: File[]) => {
    const previews = files.map(f => URL.createObjectURL(f));
    setBase(b => ({ ...b, sharedImages: [...b.sharedImages, ...files] }));
    setSharedPreviews(p => [...p, ...previews]);
  };
  const removeSharedImage = (idx: number) => {
    URL.revokeObjectURL(sharedPreviews[idx]);
    setBase(b => ({ ...b, sharedImages: b.sharedImages.filter((_, i) => i !== idx) }));
    setSharedPreviews(p => p.filter((_, i) => i !== idx));
  };

  // ── Variant handlers ──────────────────────────────────────
  const addVariant    = () => setVariants(v => [...v, emptyVariant()]);
  const updateVariant = (idx: number, updated: VariantDraft) =>
    setVariants(v => v.map((x, i) => i === idx ? updated : x));
  const removeVariant = (idx: number) => {
    variants[idx].previews.forEach(URL.revokeObjectURL);
    setVariants(v => v.filter((_, i) => i !== idx));
  };

  // ── Spec handlers ─────────────────────────────────────────
  const addSpec = () =>
    setBase(b => ({ ...b, specifications: [...b.specifications, { key: '', value: '' }] }));
  const updateSpec = (idx: number, field: 'key' | 'value', val: string) =>
    setBase(b => {
      const specs = [...b.specifications];
      specs[idx][field] = val;
      return { ...b, specifications: specs };
    });
  const removeSpec = (idx: number) =>
    setBase(b => ({ ...b, specifications: b.specifications.filter((_, i) => i !== idx) }));

  // ── Submit ────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!base.name.trim())                          { toast.error('Product name is required'); goTo('basic'); return; }
    if (!base.category_uuid)                        { toast.error('Please select a category'); goTo('basic'); return; }
    if (!base.price || parseFloat(base.price) <= 0) { toast.error('Base price must be > 0');  goTo('basic'); return; }

    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('name',          base.name.trim());
      fd.append('description',   base.description.trim());
      fd.append('price',         base.price);
      fd.append('stock',         variants.length > 0 ? '0' : base.stock);
      fd.append('category_uuid', base.category_uuid);

      if (base.specifications.length > 0) {
        fd.append('specifications', JSON.stringify(
          base.specifications.filter(s => s.key.trim() && s.value.trim())
        ));
      }

      base.sharedImages.forEach(img => fd.append('images', img));

      if (variants.length > 0) {
        const meta = variants.map(v => ({
          uuid:             v.tempId,
          variant_name:     v.variant_name.trim()        || null,
          sku_code:         v.sku_code.trim()             || null,
          color_name:       v.color_name.trim()           || null,
          color_code:       v.color_code                  || null,
          size:             v.size.trim()                 || null,
          additional_price: parseFloat(v.additional_price) || 0,
          stock_quantity:   parseInt(v.stock_quantity)     || 0,
        }));
        fd.append('variants', JSON.stringify(meta));
        variants.forEach(v => {
          v.images.forEach(img => fd.append(`images[${v.tempId}]`, img));
        });
      }

      await sellerApi.createProduct(fd);
      toast.success('Product created successfully!');
      reset();
      onSaved();
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Failed to create product');
    } finally {
      setSaving(false);
    }
  };

  // ── Completed tabs (green checkmark) ─────────────────────
  const completedTabs = new Set<Tab>();
  if (base.name && base.category_uuid && base.price) completedTabs.add('basic');
  if (variants.length > 0)                           completedTabs.add('variants');
  if (base.sharedImages.length > 0)                  completedTabs.add('images');

  const hasVariants = variants.length > 0;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Add New Product" size="xl">
      <form onSubmit={handleSubmit}>

        {/* ── Tab navigation ── */}
        <TabNav active={activeTab} onChange={goTo} completedTabs={completedTabs} />

        {/* ── Tab panels ── */}
        <div className="min-h-[360px]">

          {/* ══ TAB 1: BASIC INFO ══════════════════════════ */}
          {activeTab === 'basic' && (
            <div className="space-y-4">
              <div>
                <Label required>Product Name</Label>
                <input
                  className={iCls}
                  placeholder="e.g. iPhone 17 Pro Max"
                  value={base.name}
                  onChange={e => setBase(b => ({ ...b, name: e.target.value }))}
                  required
                />
              </div>

              <div>
                <Label required>Description</Label>
                <textarea
                  className={cn(iCls, 'resize-none')}
                  rows={4}
                  placeholder="Describe the product — features, materials, use cases…"
                  value={base.description}
                  onChange={e => setBase(b => ({ ...b, description: e.target.value }))}
                  required
                />
              </div>

              <div className={cn('grid gap-3', hasVariants ? 'grid-cols-1' : 'grid-cols-2')}>
                <div>
                  <Label required>Base Price (₹)</Label>
                  <input
                    className={iCls}
                    type="number" step="0.01" min="0.01"
                    placeholder="e.g. 79999"
                    value={base.price}
                    onChange={e => setBase(b => ({ ...b, price: e.target.value }))}
                    required
                  />
                  {hasVariants && (
                    <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
                      Final price = Base + variant modifier
                    </p>
                  )}
                </div>
                {!hasVariants && (
                  <div>
                    <Label>Stock (units)</Label>
                    <input
                      className={iCls}
                      type="number" min="0"
                      value={base.stock}
                      onChange={e => setBase(b => ({ ...b, stock: e.target.value }))}
                    />
                  </div>
                )}
              </div>

              <div>
                <Label required>Category</Label>
                {approvedCategories.length === 0 ? (
                  <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
                    ⚠️ No approved categories. Request approval from the Categories page first.
                  </div>
                ) : (
                  <select
                    className={iCls}
                    value={base.category_uuid}
                    onChange={e => setBase(b => ({ ...b, category_uuid: e.target.value }))}
                    required
                  >
                    <option value="">Select category…</option>
                    {approvedCategories.map(c => (
                      <option key={c.uuid} value={c.uuid}>{c.name}</option>
                    ))}
                  </select>
                )}
              </div>

              <div className="flex justify-end pt-1">
                <Button type="button" onClick={() => goTo('variants')}>
                  Next: Variants & Stock →
                </Button>
              </div>
            </div>
          )}

          {/* ══ TAB 2: VARIANTS & STOCK ════════════════════ */}
          {activeTab === 'variants' && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-xl px-4 py-3 text-sm text-blue-700 dark:text-blue-400">
                <Info size={15} className="shrink-0 mt-0.5" />
                <p>
                  Add variants for different <strong>colours, sizes, or storage options</strong>.
                  Skip this tab for simple products with no variations.
                </p>
              </div>

              {variants.length === 0 ? (
                <div className="rounded-2xl border-2 border-dashed border-gray-200 dark:border-slate-700 py-12 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center mx-auto mb-4">
                    <Layers size={24} className="text-orange-400" />
                  </div>
                  <p className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">No variants yet</p>
                  <p className="text-xs text-gray-400 dark:text-slate-500 mb-5">
                    Add variants for different colours, sizes, or storage options
                  </p>
                  <button
                    type="button"
                    onClick={addVariant}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 active:scale-95 text-white text-sm font-semibold transition-all shadow-sm shadow-orange-500/30"
                  >
                    <Plus size={15} /> Add First Variant
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {variants.map((v, idx) => (
                    <VariantCard
                      key={v.tempId}
                      variant={v}
                      index={idx}
                      total={variants.length}
                      onChange={updated => updateVariant(idx, updated)}
                      onRemove={() => removeVariant(idx)}
                    />
                  ))}
                  <button
                    type="button"
                    onClick={addVariant}
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 border-dashed border-gray-200 dark:border-slate-700 hover:border-orange-400 dark:hover:border-orange-500 hover:bg-orange-50 dark:hover:bg-orange-500/5 text-gray-400 dark:text-slate-500 hover:text-orange-500 dark:hover:text-orange-400 text-sm font-semibold transition-all"
                  >
                    <Plus size={15} /> Add Another Variant
                  </button>
                </div>
              )}

              <div className="flex justify-between pt-1">
                <Button type="button" variant="ghost" onClick={() => goTo('basic')}>← Back</Button>
                <Button type="button" onClick={() => goTo('images')}>Next: Images & Specs →</Button>
              </div>
            </div>
          )}

          {/* ══ TAB 3: IMAGES & SPECS ══════════════════════ */}
          {activeTab === 'images' && (
            <div className="space-y-5">
              <div>
                <Label>Product Images</Label>
                <p className="text-xs text-gray-400 dark:text-slate-500 mb-2">
                  These appear for all variants. Add variant-specific images inside each variant card.
                </p>
                <MagicDropzone
                  onFiles={handleSharedFiles}
                  previews={sharedPreviews}
                  onRemove={removeSharedImage}
                  label="Drag & drop product images or click to browse"
                  sublabel="JPG, PNG, WebP · max 10 MB · or paste with Ctrl+V"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Technical Specifications</Label>
                  <button
                    type="button"
                    onClick={addSpec}
                    className="text-xs text-orange-500 hover:text-orange-600 font-semibold transition-colors flex items-center gap-1"
                  >
                    <Plus size={12} /> Add Spec
                  </button>
                </div>
                {base.specifications.length === 0 ? (
                  <p className="text-xs text-gray-400 dark:text-slate-500 italic py-2">
                    No specs yet — click "+ Add Spec" to add processor, display, battery, etc.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {base.specifications.map((spec, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <input
                          className={cn(iCls, 'flex-1')}
                          placeholder="Key (e.g. Processor)"
                          value={spec.key}
                          onChange={e => updateSpec(idx, 'key', e.target.value)}
                        />
                        <input
                          className={cn(iCls, 'flex-1')}
                          placeholder="Value (e.g. A18 Pro)"
                          value={spec.value}
                          onChange={e => updateSpec(idx, 'value', e.target.value)}
                        />
                        <button
                          type="button"
                          onClick={() => removeSpec(idx)}
                          className="w-8 h-9 flex items-center justify-center text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors shrink-0"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-start pt-1">
                <Button type="button" variant="ghost" onClick={() => goTo('variants')}>← Back</Button>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="flex gap-3 pt-4 mt-2 border-t border-gray-100 dark:border-slate-700">
          <Button type="button" variant="ghost" onClick={handleClose} className="flex-1">
            Cancel
          </Button>
          <Button
            type="submit"
            loading={saving}
            className="flex-1"
            disabled={approvedCategories.length === 0}
          >
            <Plus size={14} /> Create Product
          </Button>
        </div>

      </form>
    </Modal>
  );
}

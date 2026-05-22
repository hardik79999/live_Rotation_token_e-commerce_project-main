import { useEffect, useState, useCallback } from 'react';
import { PageSpinner } from '@/components/ui/Spinner';
import {
  Plus, Pencil, Trash2, Package, AlertTriangle,
  AlertCircle, CheckCircle, Bell,
} from 'lucide-react';
import { sellerApi } from '@/api/seller';
import type { Product } from '@/types';
import type { SellerCategoryItem } from '@/api/seller';
import { getImageUrl, formatPrice } from '@/utils/image';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { QuickEditProductModal } from '@/components/seller/QuickEditProductModal';
import { AddProductModal } from '@/components/seller/AddProductModal';
import { cn } from '@/utils/cn';
import toast from 'react-hot-toast';

// ── Low-stock threshold ───────────────────────────────────────────────────────
const LOW_STOCK_THRESHOLD = 5;

// ── Alerts widget ─────────────────────────────────────────────────────────────
interface AlertItem {
  id: string;
  type: 'error' | 'warning' | 'success' | 'info';
  message: string;
}

function AlertsWidget({ products, categories }: {
  products: Product[];
  categories: SellerCategoryItem[];
}) {
  const alerts: AlertItem[] = [];

  const outOfStock = products.filter(p => p.stock === 0 && p.is_active);
  if (outOfStock.length > 0) {
    alerts.push({
      id: 'oos',
      type: 'error',
      message: `${outOfStock.length} product${outOfStock.length > 1 ? 's are' : ' is'} out of stock — customers can't buy them`,
    });
  }

  const lowStock = products.filter(p => p.stock > 0 && p.stock < LOW_STOCK_THRESHOLD && p.is_active);
  if (lowStock.length > 0) {
    alerts.push({
      id: 'low',
      type: 'warning',
      message: `${lowStock.length} product${lowStock.length > 1 ? 's have' : ' has'} low stock (< ${LOW_STOCK_THRESHOLD} units)`,
    });
  }

  const newlyApproved = categories.filter(c => c.status === 'approved');
  if (newlyApproved.length > 0 && products.length === 0) {
    alerts.push({
      id: 'cat',
      type: 'success',
      message: `${newlyApproved.length} categor${newlyApproved.length > 1 ? 'ies are' : 'y is'} approved — you can now add products`,
    });
  }

  const pendingCats = categories.filter(c => c.status === 'pending');
  if (pendingCats.length > 0) {
    alerts.push({
      id: 'pending',
      type: 'info',
      message: `${pendingCats.length} category request${pendingCats.length > 1 ? 's are' : ' is'} awaiting admin approval`,
    });
  }

  if (alerts.length === 0) return null;

  const iconMap = {
    error:   <AlertCircle size={14} className="text-red-500 shrink-0 mt-0.5" />,
    warning: <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />,
    success: <CheckCircle size={14} className="text-green-500 shrink-0 mt-0.5" />,
    info:    <Bell size={14} className="text-blue-500 shrink-0 mt-0.5" />,
  };

  const bgMap = {
    error:   'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30',
    warning: 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30',
    success: 'bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/30',
    info:    'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30',
  };

  const textMap = {
    error:   'text-red-700 dark:text-red-400',
    warning: 'text-amber-700 dark:text-amber-400',
    success: 'text-green-700 dark:text-green-400',
    info:    'text-blue-700 dark:text-blue-400',
  };

  return (
    <div className="space-y-2 mb-6">
      {alerts.map(a => (
        <div
          key={a.id}
          className={cn(
            'flex items-start gap-2.5 px-4 py-3 rounded-xl border text-sm',
            bgMap[a.type],
          )}
        >
          {iconMap[a.type]}
          <p className={cn('font-medium', textMap[a.type])}>{a.message}</p>
        </div>
      ))}
    </div>
  );
}

// ── Low-stock badge (pulsating) ───────────────────────────────────────────────
function LowStockBadge({ stock }: { stock: number }) {
  if (stock === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 ml-2">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
        Out of Stock
      </span>
    );
  }
  if (stock < LOW_STOCK_THRESHOLD) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 ml-2">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
        Low Stock
      </span>
    );
  }
  return null;
}

// ── Product form interface ────────────────────────────────────────────────────
interface ProductForm {
  name: string;
  description: string;
  price: string;
  stock: string;
  category_uuid: string;
  specifications: { key: string; value: string }[];
  images: File[];
}

const emptyForm: ProductForm = {
  name: '', description: '', price: '', stock: '0',
  category_uuid: '', specifications: [], images: [],
};

// ── Main page ─────────────────────────────────────────────────────────────────
export function SellerProductsPage() {
  const [products,           setProducts]           = useState<Product[]>([]);
  const [approvedCategories, setApprovedCategories] = useState<SellerCategoryItem[]>([]);
  const [allCategories,      setAllCategories]      = useState<SellerCategoryItem[]>([]);
  const [loading,            setLoading]            = useState(true);
  const [showModal,          setShowModal]          = useState(false);
  const [showAddModal,       setShowAddModal]       = useState(false);
  const [editingUuid,        setEditingUuid]        = useState<string | null>(null);
  const [form,               setForm]               = useState<ProductForm>(emptyForm);
  const [saving,             setSaving]             = useState(false);
  const [deleteTarget,       setDeleteTarget]       = useState<Product | null>(null);
  const [deleting,           setDeleting]           = useState(false);
  const [quickEditProduct,   setQuickEditProduct]   = useState<Product | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const [prodRes, catRes] = await Promise.all([
        sellerApi.getProducts(),
        sellerApi.getMyCategories(),
      ]);
      setProducts((prodRes.data.data as Product[]) || []);
      const all = (catRes.data.data as SellerCategoryItem[]) || [];
      setAllCategories(all);
      setApprovedCategories(all.filter((c) => c.status === 'approved'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const openCreate = () => setShowAddModal(true);

  const openEdit = (p: Product, e: React.MouseEvent) => {
    e.stopPropagation(); // don't also open quick-edit
    setEditingUuid(p.uuid);
    setForm({
      name: p.name, description: p.description,
      price: String(p.price), stock: String(p.stock),
      category_uuid: p.category_uuid,
      specifications: p.specifications.map((s) => ({ key: s.key, value: s.value })),
      images: [],
    });
    setShowModal(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await sellerApi.deleteProduct(deleteTarget.uuid);
      toast.success(`"${deleteTarget.name}" deleted`);
      setDeleteTarget(null);
      fetchAll();
    } catch {
      toast.error('Failed to delete product');
    } finally {
      setDeleting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.category_uuid) {
      toast.error('Please select a category.');
      return;
    }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('name', form.name);
      fd.append('description', form.description);
      fd.append('price', form.price);
      fd.append('stock', form.stock);
      fd.append('category_uuid', form.category_uuid);
      if (form.specifications.length > 0) fd.append('specifications', JSON.stringify(form.specifications));
      form.images.forEach((img) => fd.append('images', img));

      if (editingUuid) {
        await sellerApi.updateProduct(editingUuid, fd);
        toast.success('Product updated!');
      } else {
        await sellerApi.createProduct(fd);
        toast.success('Product created!');
      }
      setShowModal(false);
      fetchAll();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Failed to save product');
    } finally { setSaving(false); }
  };

  const addSpec    = () => setForm({ ...form, specifications: [...form.specifications, { key: '', value: '' }] });
  const updateSpec = (idx: number, field: 'key' | 'value', val: string) => {
    const specs = [...form.specifications]; specs[idx][field] = val; setForm({ ...form, specifications: specs });
  };
  const removeSpec = (idx: number) =>
    setForm({ ...form, specifications: form.specifications.filter((_, i) => i !== idx) });

  if (loading) return <PageSpinner />;

  return (
    <div>
      {/* ── Action Alerts widget ── */}
      <AlertsWidget products={products} categories={allCategories} />

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">My Products</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">{products.length} products listed</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={openCreate}
            disabled={approvedCategories.length === 0}
            title={approvedCategories.length === 0 ? 'Request category approval first' : ''}
          >
            <Plus size={16} /> Add Product
          </Button>
        </div>
      </div>

      {/* No-category warning */}
      {approvedCategories.length === 0 && (
        <div className="mb-6 bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/30 rounded-xl p-4 text-sm text-yellow-800 dark:text-yellow-400">
          ⚠️ You don't have any approved categories yet. Go to{' '}
          <a href="/seller/categories" className="font-semibold underline">Categories</a>{' '}
          and request admin approval before adding products.
        </div>
      )}

      {products.length === 0 ? (
        <div className="text-center py-20">
          <Package size={64} className="text-gray-300 dark:text-slate-600 mx-auto mb-4" />
          <p className="text-xl font-semibold text-gray-700 dark:text-slate-300 mb-2">No products yet</p>
          <p className="text-gray-500 dark:text-slate-400 mb-6">Start by adding your first product</p>
          {approvedCategories.length > 0 && (
            <Button onClick={openCreate}><Plus size={16} /> Add Product</Button>
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-slate-700/50 border-b border-gray-100 dark:border-slate-700">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-slate-300">Product</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-slate-300 hidden sm:table-cell">Category</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-slate-300">Price</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-slate-300 hidden md:table-cell">Stock</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-slate-300">Status</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600 dark:text-slate-300">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
              {products.map((p) => (
                <tr
                  key={p.uuid}
                  className="hover:bg-orange-50/40 dark:hover:bg-orange-500/5 transition-colors cursor-pointer group"
                  onClick={() => setQuickEditProduct(p)}
                  title="Click to quick-edit price, stock & status"
                >
                  {/* Product name + low-stock badge */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-100 dark:bg-slate-700 shrink-0">
                        <img
                          src={getImageUrl(p.primary_image)}
                          alt={p.name}
                          className="w-full h-full object-cover"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center flex-wrap gap-0">
                          <span className="font-medium text-gray-800 dark:text-slate-200 truncate max-w-[130px] group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                            {p.name}
                          </span>
                          <LowStockBadge stock={p.stock} />
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-slate-400 hidden sm:table-cell">{p.category}</td>
                  <td className="px-4 py-3 font-semibold text-gray-900 dark:text-slate-100">{formatPrice(p.price)}</td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className={cn(
                      'font-semibold',
                      p.stock === 0 ? 'text-red-500' :
                      p.stock < LOW_STOCK_THRESHOLD ? 'text-amber-500' :
                      'text-gray-500 dark:text-slate-400'
                    )}>
                      {p.stock}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={p.is_active ? (p.stock > 0 ? 'success' : 'danger') : 'default'}>
                      {!p.is_active ? 'Draft' : p.stock > 0 ? 'In Stock' : 'Out of Stock'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div
                      className="flex items-center justify-end gap-2"
                      onClick={e => e.stopPropagation()}
                    >
                      <button
                        onClick={(e) => openEdit(p, e)}
                        className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors"
                        title="Full edit"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(p)}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                        title="Delete product"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-2.5 border-t border-gray-50 dark:border-slate-700/50 bg-gray-50/50 dark:bg-slate-700/20">
            <p className="text-xs text-gray-400 dark:text-slate-500">
              Click any row to quick-edit price, stock & status · Use the pencil icon for full edit
            </p>
          </div>
        </div>
      )}

      {/* ── Quick Edit Modal ── */}
      <QuickEditProductModal
        product={quickEditProduct}
        onClose={() => setQuickEditProduct(null)}
        onSaved={fetchAll}
      />

      {/* ── Add Product Modal (variant-aware) ── */}
      <AddProductModal
        isOpen={showAddModal}
        approvedCategories={approvedCategories}
        onClose={() => setShowAddModal(false)}
        onSaved={fetchAll}
      />

      {/* ── Full Edit Modal (existing flat form — for editing) ── */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Edit Product"
        size="xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Product Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              className="col-span-2"
            />
            <Input
              label="Price (₹)"
              type="number" step="0.01" min="0"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              required
            />
            <Input
              label="Stock"
              type="number" min="0"
              value={form.stock}
              onChange={(e) => setForm({ ...form, stock: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-1 block">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              required
              className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:border-orange-500 dark:focus:border-orange-400 resize-none transition-colors"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-1 block">
              Category <span className="text-gray-400 dark:text-slate-500 font-normal">(only your approved categories)</span>
            </label>
            {approvedCategories.length === 0 ? (
              <p className="text-sm text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-500/10 rounded-lg px-3 py-2">
                No approved categories. Request approval from the Categories page first.
              </p>
            ) : (
              <select
                value={form.category_uuid}
                onChange={(e) => setForm({ ...form, category_uuid: e.target.value })}
                required
                className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:outline-none focus:border-orange-500 dark:focus:border-orange-400 transition-colors"
              >
                <option value="">Select category...</option>
                {approvedCategories.map((c) => (
                  <option key={c.uuid} value={c.uuid}>{c.name}</option>
                ))}
              </select>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700 dark:text-slate-300">Specifications</label>
              <button type="button" onClick={addSpec} className="text-xs text-orange-500 hover:text-orange-600 font-medium">
                + Add Spec
              </button>
            </div>
            {form.specifications.map((spec, idx) => (
              <div key={idx} className="flex gap-2 mb-2">
                <input
                  placeholder="Key (e.g. Color)"
                  value={spec.key}
                  onChange={(e) => updateSpec(idx, 'key', e.target.value)}
                  className="flex-1 border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:border-orange-500 dark:focus:border-orange-400 transition-colors"
                />
                <input
                  placeholder="Value (e.g. Red)"
                  value={spec.value}
                  onChange={(e) => updateSpec(idx, 'value', e.target.value)}
                  className="flex-1 border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:border-orange-500 dark:focus:border-orange-400 transition-colors"
                />
                <button type="button" onClick={() => removeSpec(idx)} className="text-red-400 hover:text-red-600 px-2 text-lg">×</button>
              </div>
            ))}
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-1 block">
              Product Images{' '}
              {editingUuid && <span className="text-gray-400 dark:text-slate-500 font-normal">(leave empty to keep existing)</span>}
            </label>
            <input
              type="file" multiple accept="image/*"
              onChange={(e) => setForm({ ...form, images: Array.from(e.target.files || []) })}
              className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:outline-none focus:border-orange-500 dark:focus:border-orange-400 transition-colors"
            />
            {form.images.length > 0 && (
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">{form.images.length} file(s) selected</p>
            )}
          </div>

          <div className="flex gap-3 pt-2 sticky bottom-0 bg-white dark:bg-slate-800 border-t border-gray-100 dark:border-slate-700">
            <Button type="button" variant="ghost" onClick={() => setShowModal(false)} className="flex-1">Cancel</Button>
            <Button type="submit" loading={saving} className="flex-1">
              {editingUuid ? 'Update Product' : 'Create Product'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Delete Confirmation Modal ── */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Product"
        size="sm"
      >
        <div className="space-y-4">
          <div className="bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-xl p-4 text-sm">
            <p className="font-semibold text-red-700 dark:text-red-400 flex items-center gap-2 mb-1">
              <AlertTriangle size={15} /> Are you sure?
            </p>
            <p className="text-red-600 dark:text-red-400/80">
              You're about to delete{' '}
              <span className="font-semibold">"{deleteTarget?.name}"</span>.
              This action cannot be undone.
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setDeleteTarget(null)} className="flex-1">Cancel</Button>
            <Button variant="danger" loading={deleting} onClick={handleDelete} className="flex-1">
              <Trash2 size={14} /> Yes, Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

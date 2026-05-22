import { useEffect, useState } from 'react';
import { PageSpinner } from '@/components/ui/Spinner';
import {
  Tag, Plus, Pencil, Trash2, RefreshCw,
  Search, CheckCircle, XCircle, AlertTriangle,
} from 'lucide-react';
import { adminApi } from '@/api/admin';
import type { Category } from '@/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { formatDate } from '@/utils/image';
import toast from 'react-hot-toast';

export function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [filtered,   setFiltered]   = useState<Category[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState('');

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', description: '', icon: '' });
  const [creating,   setCreating]   = useState(false);

  // Edit modal
  const [editTarget, setEditTarget] = useState<Category | null>(null);
  const [editForm,   setEditForm]   = useState({ name: '', description: '', icon: '' });
  const [saving,     setSaving]     = useState(false);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [deleting,     setDeleting]     = useState(false);

  const fetchCategories = () => {
    setLoading(true);
    adminApi.listCategories()
      .then((r) => {
        const cats = r.data.data || [];
        setCategories(cats);
        setFiltered(cats);
      })
      .catch(() => toast.error('Failed to load categories'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchCategories(); }, []);

  // Live search filter
  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(
      q ? categories.filter((c) => c.name.toLowerCase().includes(q) || (c.description ?? '').toLowerCase().includes(q))
        : categories
    );
  }, [search, categories]);

  // ── Create ────────────────────────────────────────────────
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.name.trim()) { toast.error('Name required'); return; }
    setCreating(true);
    try {
      await adminApi.createCategory(createForm);
      toast.success('Category created!');
      setShowCreate(false);
      setCreateForm({ name: '', description: '', icon: '' });
      fetchCategories();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Failed');
    } finally { setCreating(false); }
  };

  // ── Edit ──────────────────────────────────────────────────
  const openEdit = (cat: Category) => {
    setEditTarget(cat);
    setEditForm({ name: cat.name, description: cat.description ?? '', icon: cat.icon ?? '' });
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    setSaving(true);
    try {
      await adminApi.updateCategory(editTarget.uuid, editForm);
      toast.success('Category updated!');
      setEditTarget(null);
      fetchCategories();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Failed');
    } finally { setSaving(false); }
  };

  // ── Delete ────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await adminApi.deleteCategory(deleteTarget.uuid);
      toast.success(`"${deleteTarget.name}" deleted. Products hidden.`);
      setDeleteTarget(null);
      fetchCategories();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Failed');
    } finally { setDeleting(false); }
  };

  const activeCount   = categories.filter((c) => c.is_active !== false).length;
  const inactiveCount = categories.length - activeCount;

  if (loading) return <PageSpinner />;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Categories</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
            {activeCount} active · {inactiveCount} deleted
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchCategories}>
            <RefreshCw size={14} /> Refresh
          </Button>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus size={14} /> New Category
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" />
        <input
          type="text"
          placeholder="Search categories..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:border-orange-500 dark:focus:border-orange-400 transition-colors"
        />
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700">
          <Tag size={48} className="text-gray-200 dark:text-slate-600 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-slate-400">
            {search ? 'No categories match your search' : 'No categories yet'}
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-slate-700/50 border-b border-gray-100 dark:border-slate-700">
              <tr>
                <th className="text-left px-5 py-3 font-semibold text-gray-600 dark:text-slate-300">Category</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-600 dark:text-slate-300 hidden md:table-cell">Description</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-600 dark:text-slate-300">Status</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-600 dark:text-slate-300 hidden lg:table-cell">Created</th>
                <th className="text-right px-5 py-3 font-semibold text-gray-600 dark:text-slate-300">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
              {filtered.map((cat) => {
                const isActive = cat.is_active !== false;
                return (
                  <tr key={cat.uuid} className={`hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors ${!isActive ? 'opacity-50' : ''}`}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-lg shrink-0 ${isActive ? 'bg-orange-50 dark:bg-orange-500/10' : 'bg-gray-100 dark:bg-slate-700'}`}>
                          {cat.icon
                            ? <span>{cat.icon}</span>
                            : <Tag size={14} className={isActive ? 'text-orange-500' : 'text-gray-400 dark:text-slate-500'} />
                          }
                        </div>
                        <span className="font-semibold text-gray-800 dark:text-slate-200">{cat.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-gray-500 dark:text-slate-400 hidden md:table-cell max-w-xs">
                      <p className="truncate">{cat.description || '—'}</p>
                    </td>
                    <td className="px-5 py-3">
                      {isActive ? (
                        <Badge variant="success">
                          <CheckCircle size={11} className="mr-1" /> Active
                        </Badge>
                      ) : (
                        <Badge variant="danger">
                          <XCircle size={11} className="mr-1" /> Deleted
                        </Badge>
                      )}
                    </td>
                    <td className="px-5 py-3 text-gray-400 dark:text-slate-500 text-xs hidden lg:table-cell">
                      {cat.created_at ? formatDate(cat.created_at) : '—'}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(cat)}
                          disabled={!isActive}
                          className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Edit"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(cat)}
                          disabled={!isActive}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Delete"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Create Modal ── */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create New Category">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="flex gap-3">
            <div className="w-20 shrink-0">
              <label className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-1 block">Icon</label>
              <input
                type="text" maxLength={4} placeholder="📱"
                value={createForm.icon}
                onChange={(e) => setCreateForm({ ...createForm, icon: e.target.value })}
                className="w-full border border-gray-300 dark:border-slate-600 rounded-xl px-3 py-2.5 text-2xl text-center bg-white dark:bg-slate-800 focus:outline-none focus:border-orange-500 dark:focus:border-orange-400 transition-colors"
              />
            </div>
            <div className="flex-1">
              <Input
                label="Category Name"
                placeholder="e.g. Electronics"
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                required
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-1 block">Description (optional)</label>
            <textarea
              value={createForm.description}
              onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
              rows={3}
              placeholder="Brief description..."
              className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:border-orange-500 dark:focus:border-orange-400 resize-none transition-colors"
            />
          </div>
          {(createForm.icon || createForm.name) && (
            <div className="flex items-center gap-2 px-3 py-2 bg-orange-50 dark:bg-orange-500/10 rounded-xl border border-orange-200 dark:border-orange-500/30">
              {createForm.icon && <span className="text-xl">{createForm.icon}</span>}
              <span className="text-sm font-medium text-orange-700 dark:text-orange-400">{createForm.name || 'Category name'}</span>
            </div>
          )}
          <div className="flex gap-3">
            <Button type="button" variant="ghost" onClick={() => setShowCreate(false)} className="flex-1">Cancel</Button>
            <Button type="submit" loading={creating} className="flex-1">Create</Button>
          </div>
        </form>
      </Modal>

      {/* ── Edit Modal ── */}
      <Modal isOpen={!!editTarget} onClose={() => setEditTarget(null)} title="Edit Category">
        <form onSubmit={handleEdit} className="space-y-4">
          <div className="flex gap-3">
            <div className="w-20 shrink-0">
              <label className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-1 block">Icon</label>
              <input
                type="text" maxLength={4} placeholder="📱"
                value={editForm.icon}
                onChange={(e) => setEditForm({ ...editForm, icon: e.target.value })}
                className="w-full border border-gray-300 dark:border-slate-600 rounded-xl px-3 py-2.5 text-2xl text-center bg-white dark:bg-slate-800 focus:outline-none focus:border-orange-500 dark:focus:border-orange-400 transition-colors"
              />
            </div>
            <div className="flex-1">
              <Input
                label="Category Name"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                required
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-1 block">Description</label>
            <textarea
              value={editForm.description}
              onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              rows={3}
              className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:border-orange-500 dark:focus:border-orange-400 resize-none transition-colors"
            />
          </div>
          {(editForm.icon || editForm.name) && (
            <div className="flex items-center gap-2 px-3 py-2 bg-orange-50 dark:bg-orange-500/10 rounded-xl border border-orange-200 dark:border-orange-500/30">
              {editForm.icon && <span className="text-xl">{editForm.icon}</span>}
              <span className="text-sm font-medium text-orange-700 dark:text-orange-400">{editForm.name}</span>
            </div>
          )}
          <div className="flex gap-3">
            <Button type="button" variant="ghost" onClick={() => setEditTarget(null)} className="flex-1">Cancel</Button>
            <Button type="submit" loading={saving} className="flex-1">Save Changes</Button>
          </div>
        </form>
      </Modal>

      {/* ── Delete Confirm Modal ── */}
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Category" size="sm">
        <div className="space-y-4">
          <div className="bg-red-50 dark:bg-red-500/10 rounded-xl p-4 text-sm text-red-700 dark:text-red-400">
            <p className="font-semibold flex items-center gap-2 mb-1">
              <AlertTriangle size={15} /> This will hide all products
            </p>
            <p>
              Deleting <strong>"{deleteTarget?.name}"</strong> will immediately hide all products
              in this category from the storefront.
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setDeleteTarget(null)} className="flex-1">Cancel</Button>
            <Button variant="danger" loading={deleting} onClick={handleDelete} className="flex-1">
              <Trash2 size={14} /> Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { PageSpinner } from '@/components/ui/Spinner';
import { Tag, Send, CheckCircle, Clock, Search, X } from 'lucide-react';
import { sellerApi } from '@/api/seller';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import toast from 'react-hot-toast';

interface SellerCategory {
  uuid: string;
  name: string;
  description?: string | null;
  status: 'approved' | 'pending' | 'available';
  request_uuid?: string;
}

export function SellerCategoriesPage() {
  const [categories, setCategories] = useState<SellerCategory[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [requesting, setRequesting] = useState<string | null>(null);
  const [search,     setSearch]     = useState('');

  const fetchCategories = () => {
    setLoading(true);
    sellerApi.getMyCategories()
      .then((res) => setCategories((res.data.data as SellerCategory[]) || []))
      .catch(() => toast.error('Failed to load categories'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchCategories(); }, []);

  const handleRequest = async (uuid: string) => {
    setRequesting(uuid);
    try {
      await sellerApi.requestCategory(uuid);
      toast.success('Category request sent to admin!');
      fetchCategories();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Failed to send request');
    } finally {
      setRequesting(null);
    }
  };

  if (loading) return <PageSpinner />;

  const approved  = categories.filter((c) => c.status === 'approved');
  const pending   = categories.filter((c) => c.status === 'pending');
  const available = categories.filter((c) => c.status === 'available');
  const filteredAvailable = search.trim()
    ? available.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    : available;

  return (
    <div>
      {/* ── Header ── */}
      <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-2">Category Management</h1>
      <p className="text-gray-500 dark:text-slate-400 text-sm mb-6">
        Request access to categories to list products in them. Admin approval required.
      </p>

      {/* ── Approved ── */}
      {approved.length > 0 && (
        <div className="mb-8">
          <h2 className="font-semibold text-gray-800 dark:text-slate-200 mb-3 flex items-center gap-2">
            <CheckCircle size={18} className="text-green-500" /> Approved Categories
          </h2>
          <div className="flex flex-wrap gap-2">
            {approved.map((cat) => (
              <Badge key={cat.uuid} variant="success" className="text-sm px-3 py-1">
                {cat.name}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* ── Pending ── */}
      {pending.length > 0 && (
        <div className="mb-8">
          <h2 className="font-semibold text-gray-800 dark:text-slate-200 mb-3 flex items-center gap-2">
            <Clock size={18} className="text-yellow-500" /> Pending Approval
          </h2>
          <div className="flex flex-wrap gap-2">
            {pending.map((cat) => (
              <Badge key={cat.uuid} variant="warning" className="text-sm px-3 py-1">
                {cat.name} — waiting for admin
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* ── Available to request ── */}
      {available.length > 0 && (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
            <h2 className="font-semibold text-gray-800 dark:text-slate-200 flex items-center gap-2">
              <Tag size={18} className="text-orange-500" /> Available to Request
              <span className="text-xs font-normal text-gray-400 dark:text-slate-500">({available.length})</span>
            </h2>
            {/* Search */}
            <div className="relative w-full sm:w-56">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 pointer-events-none" />
              <input
                type="text"
                placeholder="Search categories…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-7 py-1.5 border border-gray-300 dark:border-slate-600 rounded-xl text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:border-orange-500 dark:focus:border-orange-400 transition-colors"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300">
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          {filteredAvailable.length === 0 ? (
            <div className="text-center py-10 text-gray-400 dark:text-slate-500 text-sm">
              No categories match "{search}"
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredAvailable.map((cat) => (
              <div
                key={cat.uuid}
                className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-4 flex items-center justify-between hover:border-orange-200 dark:hover:border-orange-500/40 hover:shadow-sm transition-all"
              >
                <div className="min-w-0 mr-3">
                  <p className="font-semibold text-gray-800 dark:text-slate-200">{cat.name}</p>
                  {cat.description && (
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                      {cat.description}
                    </p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  loading={requesting === cat.uuid}
                  onClick={() => handleRequest(cat.uuid)}
                  className="shrink-0"
                >
                  <Send size={13} /> Request
                </Button>
              </div>
            ))}
            </div>
          )}
        </>
      )}

      {categories.length === 0 && (
        <div className="text-center py-20 text-gray-400 dark:text-slate-500">
          <Tag size={48} className="mx-auto mb-3 opacity-30" />
          <p>No categories available yet. Ask your admin to create some.</p>
        </div>
      )}
    </div>
  );
}

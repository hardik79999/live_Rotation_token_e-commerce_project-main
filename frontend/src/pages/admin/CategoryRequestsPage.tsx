import { useEffect, useState } from 'react';
import { PageSpinner } from '@/components/ui/Spinner';
import { CheckCircle, XCircle, Clock, ShieldOff, RefreshCw } from 'lucide-react';
import { adminApi } from '@/api/admin';
import type { CategoryRequest } from '@/types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatDate } from '@/utils/image';
import toast from 'react-hot-toast';

type TabFilter = 'all' | 'pending' | 'approved';

export function CategoryRequestsPage() {
  const [requests, setRequests] = useState<CategoryRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [tab, setTab] = useState<TabFilter>('all');

  const fetchRequests = () => {
    setLoading(true);
    adminApi.getCategoryRequests()
      .then((r) => setRequests(r.data.data || []))
      .catch((err: unknown) => {
        const msg = (err as { response?: { data?: { message?: string }; status?: number } })
          ?.response?.data?.message;
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 401) {
          toast.error('Session expired. Please log in again.');
        } else if (status === 403) {
          toast.error('Admin access required.');
        } else {
          toast.error(msg || 'Failed to load requests');
        }
      })
      .finally(() => setLoading(false));
  };

  // Use a ref to prevent double-fire in React StrictMode (dev only)
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    adminApi.getCategoryRequests()
      .then((r) => { if (!cancelled) setRequests(r.data.data || []); })
      .catch((err: unknown) => {
        if (cancelled) return;
        const msg = (err as { response?: { data?: { message?: string }; status?: number } })
          ?.response?.data?.message;
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 401) toast.error('Session expired. Please log in again.');
        else if (status === 403) toast.error('Admin access required.');
        else toast.error(msg || 'Failed to load requests');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const handleAction = async (uuid: string, action: 'approve' | 'reject' | 'revoke') => {
    setProcessing(uuid);
    try {
      const res = await adminApi.approveCategory(uuid, action);
      const msg = (res.data as { message?: string })?.message;
      toast.success(msg || `${action} successful`);
      fetchRequests();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Action failed');
    } finally {
      setProcessing(null);
    }
  };

  const filtered = requests.filter((r) => {
    if (tab === 'pending')  return !r.is_approved;
    if (tab === 'approved') return r.is_approved;
    return true;
  });

  const pendingCount  = requests.filter((r) => !r.is_approved).length;
  const approvedCount = requests.filter((r) => r.is_approved).length;

  if (loading) return <PageSpinner />;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Category Permissions</h1>
        <Button variant="outline" size="sm" onClick={fetchRequests}>
          <RefreshCw size={14} /> Refresh
        </Button>
      </div>
      <p className="text-gray-500 dark:text-slate-400 text-sm mb-5">
        Approve or reject pending requests. Revoke approved permissions to immediately
        hide all products in that category from the storefront.
      </p>

      {/* Tabs */}
      <div className="flex gap-2 mb-5">
        {([
          { key: 'all',      label: `All (${requests.length})` },
          { key: 'pending',  label: `Pending (${pendingCount})` },
          { key: 'approved', label: `Approved (${approvedCount})` },
        ] as { key: TabFilter; label: string }[]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium border transition-all ${
              tab === t.key
                ? 'bg-orange-500 text-white border-orange-500'
                : 'border-gray-300 dark:border-slate-600 text-gray-600 dark:text-slate-400 hover:border-orange-400 bg-white dark:bg-slate-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700">
          <Clock size={48} className="text-gray-200 dark:text-slate-600 mx-auto mb-4" />
          <p className="text-lg font-semibold text-gray-600 dark:text-slate-400">
            {tab === 'pending' ? 'No pending requests' : 'No records found'}
          </p>
          <p className="text-gray-400 dark:text-slate-500 text-sm mt-1">
            {tab === 'pending' ? 'All requests have been processed.' : 'Try a different tab.'}
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-slate-700/50 border-b border-gray-100 dark:border-slate-700">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-slate-300">Seller</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-slate-300">Category</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-slate-300">Status</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-slate-300 hidden md:table-cell">Date</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600 dark:text-slate-300">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
              {filtered.map((req) => (
                <tr key={req.request_uuid} className="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-800 dark:text-slate-200">{req.seller_name}</p>
                    <p className="text-xs text-gray-400 dark:text-slate-500">{req.seller_email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 px-2 py-0.5 rounded-full text-xs font-medium">
                      {req.category_name}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {req.is_approved ? (
                      <Badge variant="success">Approved</Badge>
                    ) : (
                      <Badge variant="warning">Pending</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-slate-400 hidden md:table-cell text-xs">
                    {req.requested_at ? formatDate(req.requested_at) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {!req.is_approved ? (
                        // Pending → show Approve + Reject
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            loading={processing === req.request_uuid}
                            onClick={() => handleAction(req.request_uuid, 'approve')}
                            className="text-green-600 hover:bg-green-50"
                          >
                            <CheckCircle size={14} /> Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            loading={processing === req.request_uuid}
                            onClick={() => handleAction(req.request_uuid, 'reject')}
                            className="text-red-500 hover:bg-red-50"
                          >
                            <XCircle size={14} /> Reject
                          </Button>
                        </>
                      ) : (
                        // Approved → show Revoke (hides all products immediately)
                        <Button
                          size="sm"
                          variant="danger"
                          loading={processing === req.request_uuid}
                          onClick={() => {
                            if (confirm(
                              `Revoke "${req.category_name}" permission for ${req.seller_name}?\n\n` +
                              `All their products in this category will be hidden from the storefront immediately.`
                            )) {
                              handleAction(req.request_uuid, 'revoke');
                            }
                          }}
                        >
                          <ShieldOff size={14} /> Revoke
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

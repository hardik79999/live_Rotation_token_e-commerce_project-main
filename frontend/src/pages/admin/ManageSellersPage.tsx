import { useEffect, useState } from 'react';
import { PageSpinner } from '@/components/ui/Spinner';
import { Users, ShieldOff, ShieldCheck } from 'lucide-react';
import { adminApi } from '@/api/admin';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import toast from 'react-hot-toast';

interface Seller {
  uuid: string;
  username: string;
  email: string;
  phone: string | null;
  is_active: boolean;
  created_at: string;
}

export function ManageSellersPage() {
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [filtered, setFiltered] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const fetchSellers = async () => {
    try {
      // GET /api/admin/sellers
      const res = await adminApi.listSellers();
      const data = (res.data.data as Seller[]) || [];
      setSellers(data);
      setFiltered(data);
    } catch {
      setSellers([]);
      setFiltered([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSellers(); }, []);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(
      sellers.filter(
        (s) =>
          s.username.toLowerCase().includes(q) ||
          s.email.toLowerCase().includes(q)
      )
    );
  }, [search, sellers]);

  const handleToggle = async (uuid: string) => {
    const seller = sellers.find((s) => s.uuid === uuid);
    setToggling(uuid);
    try {
      await adminApi.toggleSellerStatus(uuid);
      const name = seller?.username ?? 'Seller';
      if (seller?.is_active) {
        toast.error(`${name} has been blocked.`, { duration: 4000 });
      } else {
        toast.success(`${name} has been unblocked.`, { duration: 4000 });
      }
      fetchSellers();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message;
      toast.error(msg || 'Failed to update status');
    } finally {
      setToggling(null);
    }
  };

  if (loading) return <PageSpinner />;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-2">Manage Sellers</h1>
      <p className="text-gray-500 dark:text-slate-400 text-sm mb-6">
        Block or unblock seller accounts on the platform.
      </p>

      <div className="mb-4 max-w-sm">
        <Input
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-20">
          <Users size={64} className="text-gray-300 dark:text-slate-600 mx-auto mb-4" />
          <p className="text-xl font-semibold text-gray-700 dark:text-slate-300">
            {sellers.length === 0 ? 'No sellers found' : 'No results match your search'}
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-slate-700/50 border-b border-gray-100 dark:border-slate-700">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-slate-300">Seller</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-slate-300 hidden md:table-cell">
                  Phone
                </th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-slate-300">Status</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600 dark:text-slate-300">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
              {filtered.map((seller) => (
                <tr key={seller.uuid} className="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-800 dark:text-slate-200">{seller.username}</p>
                    <p className="text-xs text-gray-400 dark:text-slate-500">{seller.email}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-slate-400 hidden md:table-cell">
                    {seller.phone || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={seller.is_active ? 'success' : 'danger'}>
                      {seller.is_active ? 'Active' : 'Blocked'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        variant={seller.is_active ? 'danger' : 'secondary'}
                        loading={toggling === seller.uuid}
                        onClick={() => handleToggle(seller.uuid)}
                      >
                        {seller.is_active ? (
                          <><ShieldOff size={14} /> Block</>
                        ) : (
                          <><ShieldCheck size={14} /> Unblock</>
                        )}
                      </Button>
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

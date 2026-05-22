import { useEffect, useState } from 'react';
import { PageSpinner } from '@/components/ui/Spinner';
import { Wallet, ArrowDownCircle, ArrowUpCircle, RefreshCw } from 'lucide-react';
import { walletApi } from '@/api/user';
import type { WalletTransaction } from '@/types';
import { Button } from '@/components/ui/Button';
import { formatPrice } from '@/utils/image';
import { cn } from '@/utils/cn';

export function WalletHistoryPage() {
  const [balance, setBalance]       = useState(0);
  const [txns, setTxns]             = useState<WalletTransaction[]>([]);
  const [loading, setLoading]       = useState(true);
  const [page, setPage]             = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [fetching, setFetching]     = useState(false);

  const load = async (p = 1) => {
    setFetching(true);
    try {
      const res = await walletApi.getTransactions(p, 15);
      setBalance(res.data.wallet_balance);
      setTxns(res.data.data);
      setPage(p);
      setTotalPages(res.data.total_pages);
    } finally {
      setFetching(false);
      setLoading(false);
    }
  };

  useEffect(() => { load(1); }, []);

  if (loading) return <PageSpinner />;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* Balance card */}
      <div className="rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 p-6 text-white shadow-lg shadow-orange-200 dark:shadow-orange-900/30">
        <div className="flex items-center gap-3 mb-1">
          <Wallet size={22} />
          <span className="text-sm font-medium opacity-90">Wallet Balance</span>
        </div>
        <p className="text-4xl font-bold tracking-tight">{formatPrice(balance)}</p>
        <p className="text-xs opacity-75 mt-1">Earn 5% back on every delivered order</p>
      </div>

      {/* Transaction list */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-slate-700">
          <h2 className="font-bold text-gray-900 dark:text-slate-100">Transaction History</h2>
          <button
            onClick={() => load(page)}
            disabled={fetching}
            className="text-gray-400 hover:text-orange-500 transition-colors"
            aria-label="Refresh"
          >
            <RefreshCw size={16} className={cn(fetching && 'animate-spin')} />
          </button>
        </div>

        {txns.length === 0 ? (
          <div className="py-16 text-center text-gray-400 dark:text-slate-500">
            <Wallet size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No transactions yet. Start shopping to earn rewards!</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-50 dark:divide-slate-700">
            {txns.map((t) => (
              <li key={t.uuid} className="flex items-center gap-4 px-5 py-4">
                <div className={cn(
                  'w-9 h-9 rounded-full flex items-center justify-center shrink-0',
                  t.transaction_type === 'CREDIT'
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-600'
                    : 'bg-red-100 dark:bg-red-900/30 text-red-500',
                )}>
                  {t.transaction_type === 'CREDIT'
                    ? <ArrowDownCircle size={18} />
                    : <ArrowUpCircle size={18} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 dark:text-slate-200 truncate">
                    {t.description}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                    {t.created_at
                      ? new Date(t.created_at).toLocaleDateString('en-IN', {
                          day: 'numeric', month: 'short', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })
                      : '—'}
                  </p>
                </div>
                <span className={cn(
                  'text-sm font-bold shrink-0',
                  t.transaction_type === 'CREDIT' ? 'text-green-600' : 'text-red-500',
                )}>
                  {t.transaction_type === 'CREDIT' ? '+' : '−'}{formatPrice(t.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 dark:border-slate-700">
            <Button
              variant="outline" size="sm"
              disabled={page <= 1 || fetching}
              onClick={() => load(page - 1)}
            >
              Previous
            </Button>
            <span className="text-xs text-gray-500 dark:text-slate-400">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline" size="sm"
              disabled={page >= totalPages || fetching}
              onClick={() => load(page + 1)}
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * useSellerOrders — DRY data-fetching hook for the seller orders page.
 *
 * Encapsulates: fetch, loading state, error handling, optimistic status update,
 * return approve/reject, and derived analytics — so the page component stays
 * purely presentational.
 */
import { useState, useCallback, useEffect } from 'react';
import { sellerApi } from '@/api/seller';
import type { SellerOrder, OrderStatus } from '@/types';
import toast from 'react-hot-toast';

export interface SellerOrdersAnalytics {
  totalOrders:    number;
  totalRevenue:   number;
  pendingReturns: number;
  returnedValue:  number;
  returnCount:    number;
  pendingCount:   number;
  processingCount:number;
  shippedCount:   number;
  deliveredCount: number;
  cancelledCount: number;
}

function computeAnalytics(orders: SellerOrder[]): SellerOrdersAnalytics {
  let totalRevenue    = 0;
  let returnedValue   = 0;
  let returnCount     = 0;
  let pendingReturns  = 0;

  for (const o of orders) {
    if (o.status !== 'cancelled') totalRevenue += o.seller_total;
    if (o.return) {
      returnCount++;
      if (o.return.status === 'pending')  pendingReturns++;
      if (o.return.status === 'refunded') returnedValue += o.return.refund_amount ?? 0;
    }
  }

  return {
    totalOrders:     orders.length,
    totalRevenue:    Math.round(totalRevenue * 100) / 100,
    pendingReturns,
    returnedValue:   Math.round(returnedValue * 100) / 100,
    returnCount,
    pendingCount:    orders.filter(o => o.status === 'pending').length,
    processingCount: orders.filter(o => o.status === 'processing').length,
    shippedCount:    orders.filter(o => o.status === 'shipped').length,
    deliveredCount:  orders.filter(o => o.status === 'delivered').length,
    cancelledCount:  orders.filter(o => o.status === 'cancelled').length,
  };
}

export function useSellerOrders() {
  const [orders,    setOrders]    = useState<SellerOrder[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [analytics, setAnalytics] = useState<SellerOrdersAnalytics>(computeAnalytics([]));

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await sellerApi.getOrders();
      const data = (res.data.data as SellerOrder[]) || [];
      setOrders(data);
      setAnalytics(computeAnalytics(data));
    } catch {
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const updateStatus = useCallback(async (orderUuid: string, newStatus: OrderStatus) => {
    await sellerApi.updateOrderStatus(orderUuid, newStatus);
    toast.success(`Order marked as ${newStatus}. Customer notified.`);
    setOrders(prev =>
      prev.map(o => o.order_uuid === orderUuid ? { ...o, status: newStatus } : o)
    );
  }, []);

  const approveReturn = useCallback(async (orderUuid: string, note: string) => {
    await sellerApi.approveReturn(orderUuid, note || undefined);
    toast.success('Return approved. Refund issued to customer.');
    await fetchOrders();
  }, [fetchOrders]);

  const rejectReturn = useCallback(async (orderUuid: string) => {
    await sellerApi.rejectReturn(orderUuid);
    toast.success('Return request rejected.');
    await fetchOrders();
  }, [fetchOrders]);

  return { orders, loading, analytics, fetchOrders, updateStatus, approveReturn, rejectReturn };
}

import { useEffect, useState } from 'react';
import { PageSpinner } from '@/components/ui/Spinner';
import { useNavigate, useLocation } from 'react-router-dom';
import { MapPin, Plus, CreditCard, Truck, Smartphone, Tag, Wallet } from 'lucide-react';
import { addressApi, orderApi, cartApi, walletApi } from '@/api/user';
import type { Address, PaymentMethod, PromoValidateResponse } from '@/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { PromoCodeInput } from '@/components/cart/PromoCodeInput';
import { useCartStore } from '@/store/cartStore';
import { useCurrency } from '@/hooks/useCurrency';
import toast from 'react-hot-toast';

const RAZORPAY_KEY = import.meta.env.VITE_RAZORPAY_KEY_ID || '';

const PAYMENT_METHODS: { value: PaymentMethod; label: string; icon: React.ReactNode }[] = [
  { value: 'cod', label: 'Cash on Delivery', icon: <Truck size={18} /> },
  { value: 'upi', label: 'UPI', icon: <Smartphone size={18} /> },
  { value: 'card', label: 'Card', icon: <CreditCard size={18} /> },
];

export function CheckoutPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { items, totalAmount, clearCart, setCart } = useCartStore();
  const { fmt } = useCurrency();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddress, setSelectedAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cod');
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [showAddressModal, setShowAddressModal] = useState(false);
  // ── Promo code state — pre-filled from CartPage navigation state ──
  const [appliedPromo, setAppliedPromo] = useState<PromoValidateResponse | null>(() => {
    const state = location.state as { coupon_code?: string } | null;
    return state?.coupon_code ? null : null;   // will be validated below
  });
  const [promoLoading, setPromoLoading] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const [useWallet, setUseWallet]         = useState(false);

  // Address form
  const [addrForm, setAddrForm] = useState({
    full_name: '', phone_number: '', street: '', city: '', state: '', pincode: '',
  });
  const [savingAddr, setSavingAddr] = useState(false);

  useEffect(() => {
    Promise.all([
      addressApi.getAddresses(),
      cartApi.getCart(),
      walletApi.getWallet(),
    ]).then(([addrRes, cartRes, walletRes]) => {
      const addrs = addrRes.data.data || [];
      setAddresses(addrs);
      const defaultAddr = addrs.find((a) => a.is_default) ?? addrs[0];
      if (defaultAddr) setSelectedAddress(defaultAddr.uuid);
      const cartItems = cartRes.data.data ?? [];
      const total = cartRes.data.total_amount ?? 0;
      setCart(cartItems, total);
      setWalletBalance(walletRes.data.wallet_balance ?? 0);

      // Auto-apply coupon passed from CartPage
      const state = location.state as { coupon_code?: string } | null;
      if (state?.coupon_code) {
        setPromoLoading(true);
        cartApi.validatePromo(state.coupon_code)
          .then((r) => setAppliedPromo(r.data))
          .catch(() => {})
          .finally(() => setPromoLoading(false));
      }
    }).finally(() => setLoading(false));
  }, [setCart, location.state]);

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingAddr(true);
    try {
      await addressApi.addAddress(addrForm);
      const res = await addressApi.getAddresses();
      const addrs = res.data.data || [];
      setAddresses(addrs);
      if (addrs.length > 0) setSelectedAddress(addrs[addrs.length - 1].uuid);
      setShowAddressModal(false);
      toast.success('Address saved!');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Failed to save address');
    } finally {
      setSavingAddr(false);
    }
  };

  const handlePlaceOrder = async () => {
    if (!selectedAddress) { toast.error('Please select a delivery address'); return; }
    if (items.length === 0) { toast.error('Your cart is empty'); return; }
    setPlacing(true);

    try {
      const res = await orderApi.checkout({
        payment_method: paymentMethod,
        address_uuid: selectedAddress,
        coupon_code: appliedPromo?.code,
        use_wallet: useWallet,
      });

      // COD: backend returns { success: true, order_uuid: "..." }
      if (paymentMethod === 'cod') {
        if (res.data.success) {
          clearCart();
          toast.success('Order placed successfully!');
          navigate('/user/orders');
        } else {
          toast.error(res.data.message || 'Failed to place order');
          setPlacing(false);
        }
        return;
      }

      // Online payment: backend returns { success: true, data: { razorpay_order_id, amount } }
      const rzpData = res.data.data;
      if (!rzpData) {
        toast.error('Payment initiation failed');
        setPlacing(false);
        return;
      }

      // Load Razorpay script dynamically
      const loadRazorpay = () =>
        new Promise<void>((resolve, reject) => {
          if (window.Razorpay) { resolve(); return; }
          const script = document.createElement('script');
          script.src = 'https://checkout.razorpay.com/v1/checkout.js';
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Razorpay SDK failed to load'));
          document.body.appendChild(script);
        });

      await loadRazorpay();

      const rzp = new window.Razorpay({
        key: RAZORPAY_KEY,
        amount: rzpData.amount * 100,
        currency: 'INR',
        name: 'ShopHub',
        description: 'Order Payment',
        order_id: rzpData.razorpay_order_id,
        handler: async (response) => {
          try {
            // POST /api/user/verify-payment
            await orderApi.verifyPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            clearCart();
            toast.success('Payment successful! Order confirmed.');
            navigate('/user/orders');
          } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })
              ?.response?.data?.message;
            toast.error(msg || 'Payment verification failed. Contact support.');
            setPlacing(false);
          }
        },
        modal: {
          ondismiss: () => {
            toast('Payment cancelled', { icon: 'ℹ️' });
            setPlacing(false);
          },
        },
        theme: { color: '#f97316' },
      });
      rzp.open();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message;
      toast.error(msg || 'Failed to place order');
      setPlacing(false);
    }
  };

  if (loading) return <PageSpinner />;

  // ── Derived totals ────────────────────────────────────────────────────────
  const safeTotal      = isFinite(totalAmount) ? totalAmount : 0;
  const deliveryFee    = safeTotal >= 499 ? 0 : 49;
  const afterCoupon    = appliedPromo ? (appliedPromo.final_total ?? safeTotal) : safeTotal;
  const safeWallet     = isFinite(walletBalance) ? walletBalance : 0;
  const walletDeduct   = useWallet ? Math.min(safeWallet, Math.max(0, afterCoupon)) : 0;
  const grandTotal     = Math.max(0, afterCoupon + deliveryFee - walletDeduct);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Checkout</h1>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Delivery Address */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-900 flex items-center gap-2">
                <MapPin size={18} className="text-orange-500" /> Delivery Address
              </h2>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAddressModal(true)}
              >
                <Plus size={14} /> Add New
              </Button>
            </div>

            {addresses.length === 0 ? (
              <p className="text-gray-500 text-sm">No addresses saved. Add one to continue.</p>
            ) : (
              <div className="space-y-2">
                {addresses.map((addr) => (
                  <label
                    key={addr.uuid}
                    className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                      selectedAddress === addr.uuid
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="address"
                      value={addr.uuid}
                      checked={selectedAddress === addr.uuid}
                      onChange={() => setSelectedAddress(addr.uuid)}
                      className="mt-0.5 accent-orange-500"
                    />
                    <div>
                      <p className="font-medium text-sm text-gray-800">{addr.full_name}</p>
                      <p className="text-sm text-gray-500">{addr.address_line}</p>
                      <p className="text-sm text-gray-500">{addr.phone}</p>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Payment Method */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <CreditCard size={18} className="text-orange-500" /> Payment Method
            </h2>
            <div className="space-y-2">
              {PAYMENT_METHODS.map((pm) => (
                <label
                  key={pm.value}
                  className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                    paymentMethod === pm.value
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="payment"
                    value={pm.value}
                    checked={paymentMethod === pm.value}
                    onChange={() => setPaymentMethod(pm.value)}
                    className="accent-orange-500"
                  />
                  <span className="text-orange-500">{pm.icon}</span>
                  <span className="font-medium text-sm text-gray-800">{pm.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Order Summary */}
        <div>
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-5 sticky top-24">
            <h2 className="font-bold text-gray-900 dark:text-slate-100 mb-4">Order Summary</h2>
            <div className="space-y-2 text-sm max-h-48 overflow-y-auto mb-4">
              {items.map((item) => (
                <div key={item.cart_item_id} className="flex justify-between text-gray-600 dark:text-slate-400">
                  <span className="truncate max-w-[160px]">{item.product_name} × {item.quantity}</span>
                  <span className="shrink-0">{fmt(item.subtotal)}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-gray-100 dark:border-slate-700 pt-3 space-y-2 text-sm">
              <div className="flex justify-between text-gray-600 dark:text-slate-400">
                <span>Subtotal</span>
                <span>{fmt(totalAmount)}</span>
              </div>
              <div className="flex justify-between text-gray-600 dark:text-slate-400">
                <span>Delivery</span>
                <span className="text-green-600">{deliveryFee === 0 ? 'FREE' : fmt(deliveryFee)}</span>
              </div>

              {/* ── Promo code input ── */}
              <div className="pt-1">
                {promoLoading ? (
                  <div className="flex items-center gap-2 text-xs text-gray-400 py-2">
                    <div className="w-3 h-3 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
                    Applying promo…
                  </div>
                ) : (
                  <PromoCodeInput
                    cartTotal={totalAmount}
                    appliedCode={appliedPromo?.code}
                    discountAmount={appliedPromo?.discount_amount}
                    onApplied={(result) => setAppliedPromo(result)}
                    onRemoved={() => setAppliedPromo(null)}
                  />
                )}
              </div>

              {/* Coupon discount line */}
              {appliedPromo && appliedPromo.discount_amount > 0 && (
                <div className="flex justify-between text-green-600 font-medium">
                  <span className="flex items-center gap-1">
                    <Tag size={12} /> {appliedPromo.code}
                  </span>
                  <span>− {fmt(appliedPromo.discount_amount)}</span>
                </div>
              )}

              {/* ── Wallet toggle ── */}
              {walletBalance > 0 && (
                <div className={`rounded-xl border-2 p-3 transition-colors ${
                  useWallet
                    ? 'border-orange-400 bg-orange-50 dark:bg-orange-900/20'
                    : 'border-gray-200 dark:border-slate-600'
                }`}>
                  <label className="flex items-center justify-between cursor-pointer gap-3">
                    <div className="flex items-center gap-2">
                      <Wallet size={15} className="text-orange-500 shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-gray-800 dark:text-slate-200">
                          Use Wallet Balance
                        </p>
                        <p className="text-xs text-gray-500 dark:text-slate-400">
                          Available: {fmt(walletBalance)}
                        </p>
                      </div>
                    </div>
                    {/* Toggle switch */}
                    <button
                      type="button"
                      role="switch"
                      aria-checked={useWallet}
                      onClick={() => setUseWallet((v) => !v)}
                      className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${
                        useWallet ? 'bg-orange-500' : 'bg-gray-300 dark:bg-slate-600'
                      }`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                        useWallet ? 'translate-x-5' : 'translate-x-0'
                      }`} />
                    </button>
                  </label>
                  {useWallet && walletDeduct > 0 && (
                    <p className="text-xs text-orange-600 font-medium mt-2">
                      − {fmt(walletDeduct)} will be deducted
                    </p>
                  )}
                </div>
              )}

              {/* Wallet deduction line */}
              {useWallet && walletDeduct > 0 && (
                <div className="flex justify-between text-orange-600 font-medium">
                  <span className="flex items-center gap-1">
                    <Wallet size={12} /> Wallet
                  </span>
                  <span>− {fmt(walletDeduct)}</span>
                </div>
              )}

              <div className="flex justify-between font-bold text-gray-900 dark:text-slate-100 text-base pt-1 border-t border-gray-100 dark:border-slate-700">
                <span>Total</span>
                <span className={useWallet && walletDeduct > 0 ? 'text-green-600' : ''}>
                  {fmt(grandTotal)}
                </span>
              </div>
            </div>
            <Button
              onClick={handlePlaceOrder}
              loading={placing}
              size="lg"
              className="w-full mt-5"
              disabled={!selectedAddress || items.length === 0}
            >
              {paymentMethod === 'cod' ? 'Place Order' : 'Pay Now'}
            </Button>
          </div>
        </div>
      </div>

      {/* Add Address Modal */}
      <Modal
        isOpen={showAddressModal}
        onClose={() => setShowAddressModal(false)}
        title="Add New Address"
        size="lg"
      >
        <form onSubmit={handleSaveAddress} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Full Name" value={addrForm.full_name} onChange={(e) => setAddrForm({ ...addrForm, full_name: e.target.value })} required />
            <Input label="Phone Number" value={addrForm.phone_number} onChange={(e) => setAddrForm({ ...addrForm, phone_number: e.target.value })} required />
          </div>
          <Input label="Street Address" value={addrForm.street} onChange={(e) => setAddrForm({ ...addrForm, street: e.target.value })} required />
          <div className="grid grid-cols-3 gap-3">
            <Input label="City" value={addrForm.city} onChange={(e) => setAddrForm({ ...addrForm, city: e.target.value })} required />
            <Input label="State" value={addrForm.state} onChange={(e) => setAddrForm({ ...addrForm, state: e.target.value })} required />
            <Input label="Pincode" value={addrForm.pincode} onChange={(e) => setAddrForm({ ...addrForm, pincode: e.target.value })} required />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => setShowAddressModal(false)} className="flex-1">Cancel</Button>
            <Button type="submit" loading={savingAddr} className="flex-1">Save Address</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

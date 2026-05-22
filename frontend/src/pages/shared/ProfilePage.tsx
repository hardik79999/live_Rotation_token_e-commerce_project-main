import { useEffect, useRef, useState } from 'react';
import { PageSpinner } from '@/components/ui/Spinner';
import { useNavigate, Link } from 'react-router-dom';
import {
  Mail, Phone, Shield, Camera, Pencil, Save, X,
  Trash2, AlertTriangle, Lock, Package, ShoppingBag,
  TrendingUp, Users, CheckCircle, User, KeyRound,
  Eye, EyeOff, Wallet,
} from 'lucide-react';
import { authApi } from '@/api/auth';
import { orderApi } from '@/api/user';
import { sellerApi } from '@/api/seller';
import { adminApi } from '@/api/admin';
import { useAuthStore } from '@/store/authStore';
import { getImageUrl, formatPrice, formatDate } from '@/utils/image';
import { Badge, orderStatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { ImageCropper } from '@/components/ui/ImageCropper';
import type { Order, AdminDashboard, Product, SellerOrder } from '@/types';
import toast from 'react-hot-toast';
import { cn } from '@/utils/cn';

// -- Cover gradients per role ----------------------------------
const COVER: Record<string, string> = {
  customer: 'from-slate-900 via-slate-800 to-slate-900',
  seller:   'from-blue-950 via-indigo-900 to-blue-950',
  admin:    'from-orange-900 via-orange-800 to-amber-900',
};

const ROLE_ACCENT: Record<string, string> = {
  customer: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400',
  seller:   'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400',
  admin:    'bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400',
};

// -- Avatar ----------------------------------------------------
function Avatar({ src, name, size = 'lg' }: { src?: string | null; name: string; size?: 'lg' | 'xl' }) {
  const dim = size === 'xl' ? 'w-28 h-28 text-4xl' : 'w-24 h-24 text-3xl';
  if (src) {
    return (
      <img
        src={getImageUrl(src)}
        alt={name}
        className={cn(dim, 'rounded-full object-cover ring-4 ring-white dark:ring-slate-900 shadow-xl')}
      />
    );
  }
  return (
    <div className={cn(dim, 'rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center font-bold text-white ring-4 ring-white dark:ring-slate-900 shadow-xl')}>
      {name?.[0]?.toUpperCase() ?? '?'}
    </div>
  );
}

// -- Stat pill (inside cover) ----------------------------------
function StatPill({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="text-center px-4 py-2 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20">
      <p className="text-lg font-bold text-white">{value}</p>
      <p className="text-xs text-white/70 mt-0.5">{label}</p>
    </div>
  );
}

// -- Info row --------------------------------------------------
function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-gray-100 dark:border-slate-700/60 last:border-0">
      <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-slate-700 flex items-center justify-center shrink-0 text-gray-500 dark:text-slate-400">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-400 dark:text-slate-500">{label}</p>
        <p className="text-sm font-medium text-gray-800 dark:text-slate-200 truncate">{value}</p>
      </div>
    </div>
  );
}

// -- Section card ----------------------------------------------
function SectionCard({ title, icon, children, className }: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 overflow-hidden shadow-sm', className)}>
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-gray-100 dark:border-slate-700">
        <span className="text-orange-500">{icon}</span>
        <h2 className="font-bold text-gray-900 dark:text-slate-100 text-sm">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// -- Change Password Modal -------------------------------------
function ChangePasswordModal({ email, onClose }: { email: string; onClose: () => void }) {
  const [step,        setStep]        = useState<'request' | 'verify'>('request');
  const [sending,     setSending]     = useState(false);
  const [verifying,   setVerifying]   = useState(false);
  const [otp,         setOtp]         = useState('');
  const [newPass,     setNewPass]     = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [showPass,    setShowPass]    = useState(false);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      await authApi.forgotPassword(email);
      toast.success('OTP sent to your email!');
      setStep('verify');
    } catch {
      toast.error('Failed to send OTP. Try again.');
    } finally { setSending(false); }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPass.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    if (newPass !== confirmPass) { toast.error('Passwords do not match'); return; }
    setVerifying(true);
    try {
      await authApi.resetPassword({ email, otp_code: otp.trim(), new_password: newPass });
      toast.success('Password changed successfully!');
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Invalid or expired OTP');
    } finally { setVerifying(false); }
  };

  return (
    <Modal isOpen onClose={onClose} title="Change Password" size="sm">
      {step === 'request' ? (
        <form onSubmit={handleSendOtp} className="space-y-4">
          <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 rounded-xl p-4 text-sm text-blue-700 dark:text-blue-400">
            <p className="font-semibold mb-1">How it works</p>
            <p className="text-blue-600 dark:text-blue-400/80 text-xs">
              We will send a 6-digit OTP to <strong>{email}</strong>. Enter it along with your new password.
            </p>
          </div>
          <div className="flex gap-3">
            <Button type="button" variant="ghost" onClick={onClose} className="flex-1">Cancel</Button>
            <Button type="submit" loading={sending} className="flex-1">
              Send OTP
            </Button>
          </div>
        </form>
      ) : (
        <form onSubmit={handleReset} className="space-y-4">
          <div className="bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30 rounded-xl p-3 text-xs text-green-700 dark:text-green-400">
            OTP sent to <strong>{email}</strong> - valid for 10 minutes.
          </div>
          <Input
            label="6-digit OTP"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            placeholder="Enter OTP from email"
            maxLength={6}
            required
          />
          <div className="relative">
            <Input
              label="New Password"
              type={showPass ? 'text' : 'password'}
              value={newPass}
              onChange={(e) => setNewPass(e.target.value)}
              placeholder="Min 6 characters"
              required
            />
            <button
              type="button"
              onClick={() => setShowPass(v => !v)}
              className="absolute right-3 top-8 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300"
            >
              {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          <Input
            label="Confirm New Password"
            type="password"
            value={confirmPass}
            onChange={(e) => setConfirmPass(e.target.value)}
            placeholder="Repeat new password"
            required
          />
          <div className="flex gap-3">
            <Button type="button" variant="ghost" onClick={() => setStep('request')} className="flex-1">Back</Button>
            <Button type="submit" loading={verifying} className="flex-1">
              <KeyRound size={14} /> Change Password
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

// -- Main ProfilePage ------------------------------------------
export function ProfilePage() {
  const { user, setUser, updateUser, clearUser } = useAuthStore();
  const navigate = useNavigate();
  const role = user?.role ?? 'customer';

  const [customerOrders, setCustomerOrders] = useState<Order[]>([]);
  const [sellerOrders,   setSellerOrders]   = useState<SellerOrder[]>([]);
  const [sellerProducts, setSellerProducts] = useState<Product[]>([]);
  const [adminStats,     setAdminStats]     = useState<AdminDashboard | null>(null);
  const [loadingData,    setLoadingData]    = useState(true);

  const [showEdit,     setShowEdit]     = useState(false);
  const [editForm,     setEditForm]     = useState({ username: '', phone: '' });
  const [saving,       setSaving]       = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showDelete,   setShowDelete]   = useState(false);
  const [deleting,     setDeleting]     = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const [cropSrc,        setCropSrc]        = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoPreview,   setPhotoPreview]   = useState<string | null>(null);

  useEffect(() => {
    authApi.profile().then((r) => { if (r.data.data) setUser(r.data.data); }).catch(() => {});
    const load = async () => {
      try {
        if (role === 'customer') {
          const r = await orderApi.getOrders();
          setCustomerOrders(r.data.data || []);
        } else if (role === 'seller') {
          const [p, o] = await Promise.all([sellerApi.getProducts(), sellerApi.getOrders()]);
          setSellerProducts((p.data.data as Product[]) || []);
          setSellerOrders((o.data.data as SellerOrder[]) || []);
        } else {
          const r = await adminApi.getDashboard();
          setAdminStats((r.data.data as AdminDashboard) || null);
        }
      } catch { /* non-fatal */ }
      finally { setLoadingData(false); }
    };
    load();
  }, [role]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error('Max 10 MB'); return; }
    e.target.value = '';
    setCropSrc(URL.createObjectURL(file));
  };

  const handleCropDone = async (blob: Blob) => {
    setCropSrc(null);
    setPhotoPreview(URL.createObjectURL(blob));
    setUploadingPhoto(true);
    try {
      const file = new File([blob], 'profile.jpg', { type: 'image/jpeg' });
      const res  = await authApi.uploadProfilePhoto(file);
      const path = res.data.data?.profile_photo;
      if (path) { updateUser({ profile_photo: path }); toast.success('Photo updated!'); }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Upload failed');
      setPhotoPreview(null);
    } finally { setUploadingPhoto(false); }
  };

  const openEdit = () => {
    setEditForm({ username: user?.username ?? '', phone: user?.phone ?? '' });
    setShowEdit(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await authApi.updateProfile({
        username: editForm.username.trim() || undefined,
        phone:    editForm.phone.trim()    || undefined,
      });
      if (res.data.data) { setUser(res.data.data); toast.success('Profile updated!'); setShowEdit(false); }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Update failed');
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await authApi.deleteAccount();
      clearUser();
      toast.success('Account deleted.');
      navigate('/');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Failed');
    } finally { setDeleting(false); setShowDelete(false); }
  };

  if (!user) return <PageSpinner />;

  const displayPhoto = photoPreview ?? user.profile_photo;

  // -- Computed stats ----------------------------------------
  const customerSpent = customerOrders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + o.amount, 0);
  const sellerRev     = sellerOrders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + o.seller_total, 0);

  const coverStats = role === 'customer'
    ? [
        { label: 'Orders',    value: customerOrders.length },
        { label: 'Spent',     value: formatPrice(customerSpent) },
        { label: 'Delivered', value: customerOrders.filter(o => o.status === 'delivered').length },
      ]
    : role === 'seller'
    ? [
        { label: 'Products', value: sellerProducts.length },
        { label: 'Orders',   value: sellerOrders.length },
        { label: 'Revenue',  value: formatPrice(sellerRev) },
      ]
    : [
        { label: 'Users',    value: adminStats?.total_users    ?? 0 },
        { label: 'Products', value: adminStats?.total_products ?? 0 },
        { label: 'Revenue',  value: formatPrice(adminStats?.total_revenue ?? 0) },
      ];

  return (
    <div className="space-y-5 max-w-3xl mx-auto">

      {/* -- HERO CARD ------------------------------------------ */}
      <div className="rounded-3xl overflow-hidden shadow-xl border border-gray-100 dark:border-slate-700">
        {/* Cover */}
        <div className={cn('relative h-36 bg-gradient-to-br', COVER[role])}>
          {/* Decorative circles */}
          <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/5" />
          <div className="absolute -bottom-4 -left-4 w-24 h-24 rounded-full bg-white/5" />
          {/* Stats row inside cover */}
          {!loadingData && (
            <div className="absolute bottom-4 right-4 flex gap-2">
              {coverStats.map(s => <StatPill key={s.label} {...s} />)}
            </div>
          )}
        </div>

        {/* Body */}
        <div className="bg-white dark:bg-slate-800 px-6 pb-6">
          {/* Avatar + actions row */}
          <div className="flex items-end justify-between -mt-14 mb-5">
            {/* Avatar with camera button */}
            <div className="relative group">
              <Avatar src={displayPhoto} name={user.username} size="xl" />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploadingPhoto}
                className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center disabled:cursor-not-allowed"
                title="Change photo - or drag & drop"
              >
                {uploadingPhoto
                  ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <Camera size={20} className="text-white" />
                }
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 mb-1">
              <Button variant="outline" size="sm" onClick={openEdit}>
                <Pencil size={13} /> Edit
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowPassword(true)}>
                <KeyRound size={13} /> Password
              </Button>
            </div>
          </div>

          {/* Name + role + meta */}
          <div className="space-y-2">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">{user.username}</h1>
              <span className={cn('text-xs px-2.5 py-1 rounded-full font-semibold capitalize', ROLE_ACCENT[role])}>
                {role}
              </span>
            </div>

            <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-gray-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5">
                <Mail size={13} className="text-gray-400 dark:text-slate-500 shrink-0" />
                {user.email}
              </span>
              {user.phone && (
                <span className="flex items-center gap-1.5">
                  <Phone size={13} className="text-gray-400 dark:text-slate-500 shrink-0" />
                  {user.phone}
                </span>
              )}
              <span className="flex items-center gap-1.5 text-green-600 dark:text-green-400 font-medium">
                <Shield size={13} className="text-green-500 shrink-0" />
                Verified
              </span>
              {role === 'customer' && (user.wallet_balance ?? 0) > 0 && (
                <span className="flex items-center gap-1.5 text-orange-600 dark:text-orange-400 font-medium">
                  <Wallet size={13} className="shrink-0" />
                  {formatPrice(user.wallet_balance ?? 0)} wallet
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* -- ACCOUNT DETAILS ------------------------------------ */}
      <SectionCard title="Account Details" icon={<User size={16} />}>
        <InfoRow icon={<Mail size={14} />}   label="Email Address" value={user.email} />
        <InfoRow icon={<Phone size={14} />}  label="Phone Number"  value={user.phone || 'Not set'} />
        <InfoRow icon={<Shield size={14} />} label="Account Role"  value={role.charAt(0).toUpperCase() + role.slice(1)} />
        <InfoRow icon={<CheckCircle size={14} />} label="Status"   value="Active & Verified" />
      </SectionCard>

      {/* -- SECURITY ------------------------------------------- */}
      <SectionCard title="Security" icon={<Lock size={16} />}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-800 dark:text-slate-200">Password</p>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
              Change your password using a one-time code sent to your email
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowPassword(true)}>
            <KeyRound size={13} /> Change
          </Button>
        </div>
      </SectionCard>

      {/* -- ACTIVITY (role-specific) ---------------------------- */}
      {!loadingData && role === 'customer' && customerOrders.length > 0 && (
        <SectionCard title="Recent Orders" icon={<ShoppingBag size={16} />}>
          <div className="-mx-5 -mb-5">
            {customerOrders.slice(0, 5).map((o) => (
              <div
                key={o.uuid}
                className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors border-b border-gray-50 dark:border-slate-700/50 last:border-0 cursor-pointer"
                onClick={() => navigate('/user/orders')}
              >
                <div>
                  <p className="text-xs font-mono text-gray-400 dark:text-slate-500">#{o.uuid.slice(0, 8).toUpperCase()}</p>
                  <p className="font-semibold text-gray-900 dark:text-slate-100 text-sm mt-0.5">{formatPrice(o.amount)}</p>
                  <p className="text-xs text-gray-400 dark:text-slate-500">{formatDate(o.date)}</p>
                </div>
                <Badge variant={orderStatusBadge(o.status)}>
                  {o.status.charAt(0).toUpperCase() + o.status.slice(1)}
                </Badge>
              </div>
            ))}
            <div className="px-5 py-3">
              <button onClick={() => navigate('/user/orders')} className="text-xs text-orange-500 hover:text-orange-600 font-medium flex items-center gap-1">
                View all orders
              </button>
            </div>
          </div>
        </SectionCard>
      )}

      {!loadingData && role === 'seller' && (
        <div className="grid sm:grid-cols-2 gap-4">
          {[
            { label: 'Listed Products', value: sellerProducts.length,  icon: <Package size={18} />,     bg: 'bg-blue-50 dark:bg-blue-500/10',   color: 'text-blue-600 dark:text-blue-400' },
            { label: 'Total Orders',    value: sellerOrders.length,    icon: <ShoppingBag size={18} />, bg: 'bg-orange-50 dark:bg-orange-500/10', color: 'text-orange-600 dark:text-orange-400' },
            { label: 'Revenue',         value: formatPrice(sellerRev), icon: <TrendingUp size={18} />,  bg: 'bg-green-50 dark:bg-green-500/10',  color: 'text-green-600 dark:text-green-400' },
            { label: 'Wallet Balance',  value: formatPrice(user.wallet_balance ?? 0), icon: <Wallet size={18} />, bg: 'bg-purple-50 dark:bg-purple-500/10', color: 'text-purple-600 dark:text-purple-400' },
          ].map(s => (
            <div key={s.label} className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-4 flex items-center gap-3 shadow-sm">
              <div className={cn('p-2.5 rounded-xl shrink-0', s.bg)}>
                <span className={s.color}>{s.icon}</span>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-slate-400">{s.label}</p>
                <p className="text-lg font-bold text-gray-900 dark:text-slate-100">{s.value}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loadingData && role === 'admin' && (
        <div className="grid sm:grid-cols-2 gap-4">
          {[
            { label: 'Total Users',    value: adminStats?.total_users    ?? 0, icon: <Users size={18} />,       bg: 'bg-blue-50 dark:bg-blue-500/10',   color: 'text-blue-600 dark:text-blue-400' },
            { label: 'Total Products', value: adminStats?.total_products ?? 0, icon: <Package size={18} />,     bg: 'bg-purple-50 dark:bg-purple-500/10', color: 'text-purple-600 dark:text-purple-400' },
            { label: 'Total Orders',   value: adminStats?.total_orders   ?? 0, icon: <ShoppingBag size={18} />, bg: 'bg-orange-50 dark:bg-orange-500/10', color: 'text-orange-600 dark:text-orange-400' },
            { label: 'Revenue',        value: formatPrice(adminStats?.total_revenue ?? 0), icon: <TrendingUp size={18} />, bg: 'bg-green-50 dark:bg-green-500/10', color: 'text-green-600 dark:text-green-400' },
          ].map(s => (
            <div key={s.label} className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-4 flex items-center gap-3 shadow-sm">
              <div className={cn('p-2.5 rounded-xl shrink-0', s.bg)}>
                <span className={s.color}>{s.icon}</span>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-slate-400">{s.label}</p>
                <p className="text-lg font-bold text-gray-900 dark:text-slate-100">{s.value}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* -- DANGER ZONE ---------------------------------------- */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-red-200 dark:border-red-500/30 overflow-hidden shadow-sm">
        <div className="flex items-center gap-2.5 px-5 py-4 border-b border-red-100 dark:border-red-500/20 bg-red-50 dark:bg-red-500/10">
          <AlertTriangle size={16} className="text-red-500 shrink-0" />
          <h2 className="font-bold text-red-700 dark:text-red-400 text-sm">Danger Zone</h2>
        </div>
        <div className="p-5 flex items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-gray-800 dark:text-slate-200 text-sm">Delete Account</p>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
              Permanently deactivate your account. This cannot be undone.
            </p>
          </div>
          <Button variant="danger" size="sm" onClick={() => setShowDelete(true)} className="shrink-0">
            <Trash2 size={13} /> Delete
          </Button>
        </div>
      </div>

      {/* -- MODALS --------------------------------------------- */}

      {/* Crop */}
      <Modal isOpen={!!cropSrc} onClose={() => setCropSrc(null)} title="Crop Profile Photo" size="md">
        {cropSrc && (
          <ImageCropper src={cropSrc} size={300} onCrop={handleCropDone} onCancel={() => setCropSrc(null)} />
        )}
      </Modal>

      {/* Edit Profile */}
      <Modal isOpen={showEdit} onClose={() => setShowEdit(false)} title="Edit Profile" size="md">
        <form onSubmit={handleSave} className="space-y-4">
          <Input
            label="Username"
            value={editForm.username}
            onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
            icon={<User size={15} />}
            placeholder="Your display name"
          />
          <Input
            label="Phone Number"
            value={editForm.phone}
            onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
            icon={<Phone size={15} />}
            placeholder="+91 98765 43210"
            type="tel"
          />
          <div className="bg-gray-50 dark:bg-slate-700/50 rounded-xl p-3 text-xs text-gray-500 dark:text-slate-400 flex items-start gap-2">
            <Lock size={13} className="mt-0.5 shrink-0" />
            Email cannot be changed. Contact support if needed.
          </div>
          <div className="flex gap-3">
            <Button type="button" variant="ghost" onClick={() => setShowEdit(false)} className="flex-1">
              <X size={14} /> Cancel
            </Button>
            <Button type="submit" loading={saving} className="flex-1">
              <Save size={14} /> Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* Change Password */}
      {showPassword && (
        <ChangePasswordModal email={user.email} onClose={() => setShowPassword(false)} />
      )}

      {/* Delete Account */}
      <Modal isOpen={showDelete} onClose={() => setShowDelete(false)} title="Delete Account" size="sm">
        <div className="space-y-4">
          <div className="bg-red-50 dark:bg-red-500/10 rounded-xl p-4 text-sm border border-red-100 dark:border-red-500/20">
            <p className="font-semibold text-red-700 dark:text-red-400 mb-1 flex items-center gap-2">
              <AlertTriangle size={14} /> This cannot be undone
            </p>
            <p className="text-red-600 dark:text-red-400/80 text-xs">
              Your account will be permanently deactivated. All data will become inaccessible.
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setShowDelete(false)} className="flex-1">Cancel</Button>
            <Button variant="danger" loading={deleting} onClick={handleDelete} className="flex-1">
              <Trash2 size={13} /> Yes, Delete
            </Button>
          </div>
        </div>
      </Modal>

    </div>
  );
}

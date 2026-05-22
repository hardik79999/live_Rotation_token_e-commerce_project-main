import { useEffect, useRef, useState } from 'react';
import { PageSpinner } from '@/components/ui/Spinner';
import {
  User, Mail, Phone, Shield, Camera, Pencil,
  Save, X, Trash2, AlertTriangle, CheckCircle, Lock,
} from 'lucide-react';
import { authApi } from '@/api/auth';
import { orderApi } from '@/api/user';
import { useAuthStore } from '@/store/authStore';
import { getImageUrl, formatPrice, formatDate } from '@/utils/image';
import { Badge, orderStatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import type { Order } from '@/types';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

// ── Avatar component ──────────────────────────────────────────
function Avatar({
  src, name, size = 'lg',
}: { src?: string | null; name: string; size?: 'sm' | 'lg' }) {
  const dim = size === 'lg' ? 'w-24 h-24 text-3xl' : 'w-10 h-10 text-sm';
  if (src) {
    return (
      <img
        src={getImageUrl(src)}
        alt={name}
        className={`${dim} rounded-full object-cover ring-4 ring-white shadow-lg`}
      />
    );
  }
  return (
    <div className={`${dim} rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center font-bold text-white ring-4 ring-white shadow-lg`}>
      {name?.[0]?.toUpperCase() ?? '?'}
    </div>
  );
}

export function UserProfilePage() {
  const { user, setUser, updateUser, clearUser } = useAuthStore();
  const navigate = useNavigate();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);

  // Edit profile modal
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState({ username: '', phone: '' });
  const [saving, setSaving] = useState(false);

  // Photo upload
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  // Delete account modal
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Fetch fresh profile + orders on mount
  useEffect(() => {
    authApi.profile()
      .then((r) => { if (r.data.data) setUser(r.data.data); })
      .catch(() => {});

    orderApi.getOrders()
      .then((r) => setOrders(r.data.data || []))
      .catch(() => {})
      .finally(() => setLoadingOrders(false));
  }, []);

  // ── Photo selection preview ───────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File too large. Max 5 MB.');
      return;
    }
    setPhotoPreview(URL.createObjectURL(file));
    handlePhotoUpload(file);
  };

  // ── Photo upload ──────────────────────────────────────────
  const handlePhotoUpload = async (file: File) => {
    setUploadingPhoto(true);
    try {
      const res = await authApi.uploadProfilePhoto(file);
      const newPath = res.data.data?.profile_photo;
      if (newPath) {
        updateUser({ profile_photo: newPath });
        toast.success('Profile photo updated!');
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Upload failed');
      setPhotoPreview(null);
    } finally {
      setUploadingPhoto(false);
    }
  };

  // ── Edit profile ──────────────────────────────────────────
  const openEdit = () => {
    setEditForm({ username: user?.username ?? '', phone: user?.phone ?? '' });
    setShowEdit(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await authApi.updateProfile({
        username: editForm.username.trim() || undefined,
        phone:    editForm.phone.trim()    || undefined,
      });
      if (res.data.data) {
        setUser(res.data.data);
        toast.success('Profile updated!');
        setShowEdit(false);
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  // ── Delete account ────────────────────────────────────────
  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      await authApi.deleteAccount();
      clearUser();
      toast.success('Account deleted. Goodbye!');
      navigate('/');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Failed to delete account');
    } finally {
      setDeleting(false);
      setShowDelete(false);
    }
  };

  if (!user) return <PageSpinner />;

  const recentOrders = orders.slice(0, 5);
  const totalSpent   = orders
    .filter((o) => o.status !== 'cancelled')
    .reduce((s, o) => s + o.amount, 0);

  return (
    <div className="space-y-6">
      {/* ── Profile card ── */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
        {/* Cover gradient */}
        <div className="h-28 bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900" />

        <div className="px-6 pb-6">
          {/* Avatar row */}
          <div className="flex items-end justify-between -mt-12 mb-4">
            <div className="relative">
              <Avatar src={photoPreview ?? user.profile_photo} name={user.username} size="lg" />
              {/* Camera overlay */}
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploadingPhoto}
                className="absolute bottom-0 right-0 w-8 h-8 bg-orange-500 hover:bg-orange-600 text-white rounded-full flex items-center justify-center shadow-lg transition-colors disabled:opacity-60"
                title="Change photo"
              >
                {uploadingPhoto
                  ? <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <Camera size={14} />
                }
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            <Button variant="outline" size="sm" onClick={openEdit}>
              <Pencil size={14} /> Edit Profile
            </Button>
          </div>

          {/* User info */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900">{user.username}</h1>
              {user.role && (
                <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-medium capitalize">
                  {user.role}
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-4 text-sm text-gray-500 mt-2">
              <span className="flex items-center gap-1.5">
                <Mail size={14} className="text-gray-400" /> {user.email}
              </span>
              {user.phone && (
                <span className="flex items-center gap-1.5">
                  <Phone size={14} className="text-gray-400" /> {user.phone}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Shield size={14} className="text-green-500" />
                <span className="text-green-600 font-medium">Verified</span>
              </span>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mt-5 pt-5 border-t border-gray-100">
            {[
              { label: 'Total Orders',  value: orders.length },
              { label: 'Total Spent',   value: formatPrice(totalSpent) },
              { label: 'Delivered',     value: orders.filter((o) => o.status === 'delivered').length },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <p className="text-xl font-bold text-gray-900">{s.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Recent orders ── */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">Recent Orders</h2>
          <button
            onClick={() => navigate('/user/orders')}
            className="text-xs text-orange-500 hover:text-orange-600 font-medium"
          >
            View all →
          </button>
        </div>

        {loadingOrders ? (
          <div className="flex justify-center py-10">
            <span className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : recentOrders.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <CheckCircle size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">No orders yet</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {recentOrders.map((order) => (
              <div key={order.uuid} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors">
                <div>
                  <p className="text-xs font-mono text-gray-500">#{order.uuid.slice(0, 8).toUpperCase()}</p>
                  <p className="font-semibold text-gray-900 mt-0.5">{formatPrice(order.amount)}</p>
                  <p className="text-xs text-gray-400">{formatDate(order.date)}</p>
                </div>
                <Badge variant={orderStatusBadge(order.status)}>
                  {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Danger zone ── */}
      <div className="bg-white rounded-2xl border border-red-100 overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-red-100 bg-red-50">
          <h2 className="font-bold text-red-700 flex items-center gap-2">
            <AlertTriangle size={16} /> Danger Zone
          </h2>
        </div>
        <div className="px-5 py-4 flex items-center justify-between">
          <div>
            <p className="font-medium text-gray-800">Delete Account</p>
            <p className="text-sm text-gray-500 mt-0.5">
              Permanently deactivate your account. This action cannot be undone.
            </p>
          </div>
          <Button variant="danger" size="sm" onClick={() => setShowDelete(true)}>
            <Trash2 size={14} /> Delete
          </Button>
        </div>
      </div>

      {/* ── Edit Profile Modal ── */}
      <Modal isOpen={showEdit} onClose={() => setShowEdit(false)} title="Edit Profile" size="md">
        <form onSubmit={handleSaveProfile} className="space-y-4">
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
          <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-500 flex items-start gap-2">
            <Lock size={13} className="mt-0.5 shrink-0 text-gray-400" />
            Email cannot be changed. Contact support if needed.
          </div>
          <div className="flex gap-3 pt-1">
            <Button type="button" variant="ghost" onClick={() => setShowEdit(false)} className="flex-1">
              <X size={15} /> Cancel
            </Button>
            <Button type="submit" loading={saving} className="flex-1">
              <Save size={15} /> Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Delete Account Modal ── */}
      <Modal isOpen={showDelete} onClose={() => setShowDelete(false)} title="Delete Account" size="sm">
        <div className="space-y-4">
          <div className="bg-red-50 rounded-xl p-4 text-sm text-red-700">
            <p className="font-semibold mb-1">⚠️ This cannot be undone</p>
            <p>Your account will be deactivated. All your data, orders, and addresses will be inaccessible.</p>
          </div>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setShowDelete(false)} className="flex-1">
              Cancel
            </Button>
            <Button variant="danger" loading={deleting} onClick={handleDeleteAccount} className="flex-1">
              <Trash2 size={14} /> Yes, Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

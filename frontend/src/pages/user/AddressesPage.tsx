import { useEffect, useState } from 'react';
import { PageSpinner } from '@/components/ui/Spinner';
import { MapPin, Plus, Star, Trash2, CheckCircle, AlertCircle } from 'lucide-react';
import { addressApi } from '@/api/user';
import type { Address } from '@/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { cn } from '@/utils/cn';
import toast from 'react-hot-toast';

// ── Validation helpers ────────────────────────────────────────────────────────
interface AddressFormState {
  full_name: string;
  phone_number: string;
  street: string;
  city: string;
  state: string;
  pincode: string;
  is_default: boolean;
}

interface FormErrors {
  full_name?: string;
  phone_number?: string;
  street?: string;
  city?: string;
  state?: string;
  pincode?: string;
}

const emptyForm: AddressFormState = {
  full_name: '', phone_number: '', street: '',
  city: '', state: '', pincode: '', is_default: false,
};

function validateForm(form: AddressFormState): FormErrors {
  const errors: FormErrors = {};

  if (!form.full_name.trim()) {
    errors.full_name = 'Full name is required';
  } else if (form.full_name.trim().length < 2) {
    errors.full_name = 'Name must be at least 2 characters';
  }

  // Phone: exactly 10 digits, no letters or special chars
  const phoneDigits = form.phone_number.replace(/\D/g, '');
  if (!form.phone_number.trim()) {
    errors.phone_number = 'Phone number is required';
  } else if (!/^\d+$/.test(form.phone_number.trim())) {
    errors.phone_number = 'Phone number must contain digits only';
  } else if (phoneDigits.length !== 10) {
    errors.phone_number = `Phone must be exactly 10 digits (${phoneDigits.length} entered)`;
  }

  if (!form.street.trim()) {
    errors.street = 'Street address is required';
  } else if (form.street.trim().length < 5) {
    errors.street = 'Please enter a complete street address';
  }

  if (!form.city.trim()) {
    errors.city = 'City is required';
  }

  if (!form.state.trim()) {
    errors.state = 'State is required';
  }

  // Pincode: exactly 6 digits
  const pincodeDigits = form.pincode.replace(/\D/g, '');
  if (!form.pincode.trim()) {
    errors.pincode = 'Pincode is required';
  } else if (!/^\d+$/.test(form.pincode.trim())) {
    errors.pincode = 'Pincode must contain digits only';
  } else if (pincodeDigits.length !== 6) {
    errors.pincode = `Pincode must be exactly 6 digits (${pincodeDigits.length} entered)`;
  }

  return errors;
}

// ── Validated Input wrapper ───────────────────────────────────────────────────
function ValidatedInput({
  label, value, onChange, error, type = 'text', placeholder, maxLength, onBlur,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  type?: string;
  placeholder?: string;
  maxLength?: number;
  onBlur?: () => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-gray-700 dark:text-slate-300">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        maxLength={maxLength}
        className={cn(
          'w-full rounded-lg border px-3 py-2.5 text-sm transition-colors',
          'bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100',
          'placeholder-gray-400 dark:placeholder-slate-500',
          'focus:outline-none focus:ring-2',
          error
            ? 'border-red-400 dark:border-red-500 focus:border-red-400 focus:ring-red-400/20'
            : 'border-gray-300 dark:border-slate-600 focus:border-orange-500 focus:ring-orange-500/20 dark:focus:border-orange-400 dark:focus:ring-orange-400/20',
        )}
      />
      {error && (
        <p className="flex items-center gap-1 text-xs text-red-500 dark:text-red-400">
          <AlertCircle size={11} className="shrink-0" /> {error}
        </p>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function AddressesPage() {
  const [addresses,      setAddresses]      = useState<Address[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [showModal,      setShowModal]      = useState(false);
  const [saving,         setSaving]         = useState(false);
  const [settingDefault, setSettingDefault] = useState<string | null>(null);
  const [deletingUuid,   setDeletingUuid]   = useState<string | null>(null);
  const [touched,        setTouched]        = useState<Partial<Record<keyof AddressFormState, boolean>>>({});

  const [form,   setForm]   = useState<AddressFormState>(emptyForm);
  const [errors, setErrors] = useState<FormErrors>({});

  const fetchAddresses = () => {
    addressApi.getAddresses()
      .then((r) => setAddresses(r.data.data || []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchAddresses(); }, []);

  // Re-validate on every form change (only show errors for touched fields)
  useEffect(() => {
    setErrors(validateForm(form));
  }, [form]);

  const openModal = () => {
    setForm(emptyForm);
    setErrors({});
    setTouched({});
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setForm(emptyForm);
    setErrors({});
    setTouched({});
  };

  const touch = (field: keyof AddressFormState) =>
    setTouched((prev) => ({ ...prev, [field]: true }));

  const touchAll = () => {
    const all: Partial<Record<keyof AddressFormState, boolean>> = {};
    (Object.keys(emptyForm) as (keyof AddressFormState)[]).forEach((k) => { all[k] = true; });
    setTouched(all);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    touchAll();
    const validationErrors = validateForm(form);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      toast.error('Please fix the errors before saving');
      return;
    }

    setSaving(true);
    try {
      await addressApi.addAddress(form);
      toast.success('Address saved!');
      closeModal();
      fetchAddresses();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Failed to save address');
    } finally { setSaving(false); }
  };

  const handleSetDefault = async (uuid: string) => {
    setSettingDefault(uuid);
    try {
      await addressApi.setDefault(uuid);
      toast.success('Default address updated');
      fetchAddresses();
    } catch {
      toast.error('Failed to set default');
    } finally { setSettingDefault(null); }
  };

  const handleDelete = async (uuid: string) => {
    if (!confirm('Delete this address?')) return;
    setDeletingUuid(uuid);
    try {
      await addressApi.deleteAddress(uuid);
      toast.success('Address deleted');
      fetchAddresses();
    } catch {
      toast.error('Failed to delete');
    } finally { setDeletingUuid(null); }
  };

  // Helper: only show error if field has been touched
  const fieldError = (field: keyof FormErrors) =>
    touched[field] ? errors[field] : undefined;

  const isFormValid = Object.keys(validateForm(form)).length === 0;

  if (loading) return <PageSpinner />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Saved Addresses</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
            {addresses.length} address{addresses.length !== 1 ? 'es' : ''} saved
          </p>
        </div>
        <Button onClick={openModal}>
          <Plus size={16} /> Add Address
        </Button>
      </div>

      {/* ── Empty state ── */}
      {addresses.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700">
          <div className="w-20 h-20 rounded-full bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center mx-auto mb-4">
            <MapPin size={36} className="text-blue-400 dark:text-blue-500" />
          </div>
          <p className="text-xl font-semibold text-gray-700 dark:text-slate-300 mb-2">No addresses saved</p>
          <p className="text-gray-500 dark:text-slate-400 mb-6 max-w-xs mx-auto">
            Add a delivery address to speed up checkout and track your orders easily.
          </p>
          <Button onClick={openModal}>
            <Plus size={16} /> Add Your First Address
          </Button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {addresses.map((addr) => (
            <div
              key={addr.uuid}
              className={cn(
                'bg-white dark:bg-slate-800 rounded-2xl border p-4 transition-all shadow-sm',
                addr.is_default
                  ? 'border-orange-300 dark:border-orange-500/50 ring-2 ring-orange-200 dark:ring-orange-500/20'
                  : 'border-gray-100 dark:border-slate-700 hover:border-gray-200 dark:hover:border-slate-600'
              )}
            >
              {/* Header row */}
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <div className={cn(
                    'p-2 rounded-lg',
                    addr.is_default ? 'bg-orange-50 dark:bg-orange-500/10' : 'bg-gray-50 dark:bg-slate-700'
                  )}>
                    <MapPin size={16} className={addr.is_default ? 'text-orange-500' : 'text-gray-400 dark:text-slate-500'} />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800 dark:text-slate-200 text-sm">{addr.full_name}</p>
                    <p className="text-xs text-gray-400 dark:text-slate-500">{addr.phone}</p>
                  </div>
                </div>
                {addr.is_default && (
                  <span className="flex items-center gap-1 text-xs bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 px-2 py-0.5 rounded-full font-medium shrink-0">
                    <CheckCircle size={11} /> Default
                  </span>
                )}
              </div>

              <p className="text-sm text-gray-600 dark:text-slate-400 leading-relaxed mb-4 pl-10">
                {addr.address_line}
              </p>

              <div className="flex gap-2 pl-10">
                {!addr.is_default && (
                  <button
                    onClick={() => handleSetDefault(addr.uuid)}
                    disabled={settingDefault === addr.uuid}
                    className="flex items-center gap-1.5 text-xs text-orange-500 hover:text-orange-600 font-medium border border-orange-200 dark:border-orange-500/30 hover:border-orange-400 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {settingDefault === addr.uuid
                      ? <span className="w-3 h-3 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
                      : <Star size={12} />
                    }
                    Set as Default
                  </button>
                )}
                <button
                  onClick={() => handleDelete(addr.uuid)}
                  disabled={deletingUuid === addr.uuid}
                  className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-600 font-medium border border-red-100 dark:border-red-500/20 hover:border-red-300 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 ml-auto"
                >
                  {deletingUuid === addr.uuid
                    ? <span className="w-3 h-3 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                    : <Trash2 size={12} />
                  }
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Add Address Modal with strict validation ── */}
      <Modal isOpen={showModal} onClose={closeModal} title="Add New Address" size="lg">
        <form onSubmit={handleSave} noValidate className="space-y-4">

          <div className="grid grid-cols-2 gap-3">
            {/* Full Name */}
            <ValidatedInput
              label="Full Name"
              value={form.full_name}
              onChange={(v) => setForm({ ...form, full_name: v })}
              error={fieldError('full_name')}
              placeholder="Ravi Sharma"
              onBlur={() => touch('full_name')}
            />
            {/* Phone — 10 digits only */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700 dark:text-slate-300">
                Phone Number
                <span className="ml-1 text-xs text-gray-400 dark:text-slate-500 font-normal">(10 digits)</span>
              </label>
              <input
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={10}
                value={form.phone_number}
                onChange={(e) => {
                  // Strip non-digits as user types
                  const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                  setForm({ ...form, phone_number: digits });
                }}
                onBlur={() => touch('phone_number')}
                placeholder="9876543210"
                className={cn(
                  'w-full rounded-lg border px-3 py-2.5 text-sm transition-colors',
                  'bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100',
                  'placeholder-gray-400 dark:placeholder-slate-500',
                  'focus:outline-none focus:ring-2',
                  fieldError('phone_number')
                    ? 'border-red-400 dark:border-red-500 focus:border-red-400 focus:ring-red-400/20'
                    : 'border-gray-300 dark:border-slate-600 focus:border-orange-500 focus:ring-orange-500/20 dark:focus:border-orange-400',
                )}
              />
              {/* Live digit counter */}
              <div className="flex items-center justify-between">
                {fieldError('phone_number') ? (
                  <p className="flex items-center gap-1 text-xs text-red-500 dark:text-red-400">
                    <AlertCircle size={11} /> {fieldError('phone_number')}
                  </p>
                ) : (
                  <span />
                )}
                <span className={cn(
                  'text-xs tabular-nums ml-auto',
                  form.phone_number.length === 10
                    ? 'text-green-500 dark:text-green-400 font-semibold'
                    : 'text-gray-400 dark:text-slate-500'
                )}>
                  {form.phone_number.length}/10
                </span>
              </div>
            </div>
          </div>

          {/* Street */}
          <ValidatedInput
            label="Street Address"
            value={form.street}
            onChange={(v) => setForm({ ...form, street: v })}
            error={fieldError('street')}
            placeholder="123, MG Road, Near City Mall"
            onBlur={() => touch('street')}
          />

          <div className="grid grid-cols-3 gap-3">
            {/* City */}
            <ValidatedInput
              label="City"
              value={form.city}
              onChange={(v) => setForm({ ...form, city: v })}
              error={fieldError('city')}
              placeholder="Mumbai"
              onBlur={() => touch('city')}
            />
            {/* State */}
            <ValidatedInput
              label="State"
              value={form.state}
              onChange={(v) => setForm({ ...form, state: v })}
              error={fieldError('state')}
              placeholder="Maharashtra"
              onBlur={() => touch('state')}
            />
            {/* Pincode — 6 digits only */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700 dark:text-slate-300">
                Pincode
                <span className="ml-1 text-xs text-gray-400 dark:text-slate-500 font-normal">(6 digits)</span>
              </label>
              <input
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={form.pincode}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setForm({ ...form, pincode: digits });
                }}
                onBlur={() => touch('pincode')}
                placeholder="400001"
                className={cn(
                  'w-full rounded-lg border px-3 py-2.5 text-sm transition-colors',
                  'bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100',
                  'placeholder-gray-400 dark:placeholder-slate-500',
                  'focus:outline-none focus:ring-2',
                  fieldError('pincode')
                    ? 'border-red-400 dark:border-red-500 focus:border-red-400 focus:ring-red-400/20'
                    : 'border-gray-300 dark:border-slate-600 focus:border-orange-500 focus:ring-orange-500/20 dark:focus:border-orange-400',
                )}
              />
              <div className="flex items-center justify-between">
                {fieldError('pincode') ? (
                  <p className="flex items-center gap-1 text-xs text-red-500 dark:text-red-400">
                    <AlertCircle size={11} /> {fieldError('pincode')}
                  </p>
                ) : (
                  <span />
                )}
                <span className={cn(
                  'text-xs tabular-nums ml-auto',
                  form.pincode.length === 6
                    ? 'text-green-500 dark:text-green-400 font-semibold'
                    : 'text-gray-400 dark:text-slate-500'
                )}>
                  {form.pincode.length}/6
                </span>
              </div>
            </div>
          </div>

          {/* Set as default toggle */}
          <label className="flex items-center gap-3 p-3 bg-orange-50 dark:bg-orange-500/10 rounded-xl cursor-pointer hover:bg-orange-100 dark:hover:bg-orange-500/20 transition-colors">
            <input
              type="checkbox"
              checked={form.is_default}
              onChange={(e) => setForm({ ...form, is_default: e.target.checked })}
              className="w-4 h-4 accent-orange-500 rounded"
            />
            <div>
              <p className="text-sm font-medium text-gray-800 dark:text-slate-200">Set as default address</p>
              <p className="text-xs text-gray-500 dark:text-slate-400">This address will be pre-selected at checkout</p>
            </div>
          </label>

          {/* Validation summary — shown only after first submit attempt */}
          {Object.keys(touched).length > 0 && !isFormValid && (
            <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl p-3">
              <p className="text-xs font-semibold text-red-600 dark:text-red-400 flex items-center gap-1.5 mb-1">
                <AlertCircle size={12} /> Please fix the following:
              </p>
              <ul className="space-y-0.5">
                {Object.values(errors).map((err, i) => (
                  <li key={i} className="text-xs text-red-500 dark:text-red-400 pl-4">• {err}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={closeModal} className="flex-1">
              Cancel
            </Button>
            <Button
              type="submit"
              loading={saving}
              className="flex-1"
              disabled={saving}
            >
              Save Address
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}



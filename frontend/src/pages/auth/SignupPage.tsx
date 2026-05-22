import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Mail, Lock, User, Phone } from 'lucide-react';
import { authApi } from '@/api/auth';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton';
import { LanguageSelector } from '@/components/ui/LanguageSelector';
import { useTranslation } from '@/hooks/useTranslation';
import toast from 'react-hot-toast';

export function SignupPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();
  const defaultRole = searchParams.get('role') === 'seller' ? 'seller' : 'customer';

  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    role: defaultRole as 'customer' | 'seller',
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const clearError = (field: string) => {
    if (errors[field]) setErrors((prev) => { const next = { ...prev }; delete next[field]; return next; });
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.username.trim()) e.username = t('auth.errors.username_required');
    if (!form.email.trim()) e.email = t('auth.errors.email_required');
    if (!form.password) e.password = t('auth.errors.password_required');
    if (form.password.length < 6) e.password = t('auth.errors.password_min');
    if (form.password !== form.confirmPassword) e.confirmPassword = t('auth.errors.passwords_no_match');
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      await authApi.signup({
        username: form.username,
        email: form.email,
        password: form.password,
        phone: form.phone || undefined,
        role: form.role,
      });
      toast.success(t('auth.success.account_created'));
      navigate('/login');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || t('auth.errors.signup_failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-4">
      {/* Language selector — top right */}
      <div className="fixed top-4 right-4 z-50">
        <LanguageSelector />
      </div>

      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex flex-col items-center gap-2">
            <img src="/logo.png" alt="ShopHub" className="h-20 w-auto object-contain"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            <span className="text-2xl font-bold text-white">
              Shop<span className="text-orange-400">Hub</span>
            </span>
          </Link>
          <p className="text-gray-400 mt-2 text-sm">{t('auth.create_account')}</p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-2">{t('auth.get_started')}</h1>

          {/* Role toggle */}
          <div className="flex bg-gray-100 dark:bg-slate-700 rounded-xl p-1 mb-6">
            {(['customer', 'seller'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setForm({ ...form, role: r })}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all capitalize ${
                  form.role === r
                    ? 'bg-white dark:bg-slate-600 text-orange-600 dark:text-orange-400 shadow-sm'
                    : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
                }`}
              >
                {r === 'customer' ? `🛒 ${t('auth.customer')}` : `🏪 ${t('auth.seller')}`}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label={t('auth.username')}
              placeholder={t('auth.username_placeholder')}
              value={form.username}
              onChange={(e) => { setForm({ ...form, username: e.target.value }); clearError('username'); }}
              error={errors.username}
              icon={<User size={16} />}
              autoComplete="username"
            />
            <Input
              label={t('auth.email')}
              type="email"
              placeholder={t('auth.email_placeholder')}
              value={form.email}
              onChange={(e) => { setForm({ ...form, email: e.target.value }); clearError('email'); }}
              error={errors.email}
              icon={<Mail size={16} />}
              autoComplete="email"
            />
            <Input
              label={t('auth.phone')}
              type="tel"
              placeholder={t('auth.phone_placeholder')}
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              icon={<Phone size={16} />}
            />
            <Input
              label={t('auth.password')}
              type="password"
              placeholder={t('auth.password_min')}
              value={form.password}
              onChange={(e) => { setForm({ ...form, password: e.target.value }); clearError('password'); }}
              error={errors.password}
              icon={<Lock size={16} />}
              autoComplete="new-password"
            />
            <Input
              label={t('auth.confirm_password')}
              type="password"
              placeholder={t('auth.confirm_password_placeholder')}
              value={form.confirmPassword}
              onChange={(e) => { setForm({ ...form, confirmPassword: e.target.value }); clearError('confirmPassword'); }}
              error={errors.confirmPassword}
              icon={<Lock size={16} />}
              autoComplete="new-password"
            />

            <Button type="submit" loading={loading} size="lg" className="w-full">
              {t('auth.create_account_btn')}
            </Button>
          </form>

          {/* ── Divider ── */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-gray-200 dark:bg-slate-600" />
            <span className="text-xs text-gray-400 dark:text-slate-400 font-medium">{t('auth.or')}</span>
            <div className="flex-1 h-px bg-gray-200 dark:bg-slate-600" />
          </div>

          {/* ── Google Sign-In ── */}
          <GoogleSignInButton label={t('auth.google_sign_up')} />

          <p className="text-center text-sm text-gray-500 dark:text-slate-400 mt-6">
            {t('auth.already_account')}{' '}
            <Link to="/login" className="text-orange-500 hover:text-orange-600 font-medium transition-colors">
              {t('auth.sign_in_link')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

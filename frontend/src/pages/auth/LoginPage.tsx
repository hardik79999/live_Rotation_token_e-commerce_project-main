import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { Mail, Lock } from 'lucide-react';
import { authApi } from '@/api/auth';
import { useAuthStore } from '@/store/authStore';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton';
import { LanguageSelector } from '@/components/ui/LanguageSelector';
import { useTranslation } from '@/hooks/useTranslation';
import toast from 'react-hot-toast';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { setUser } = useAuthStore();
  const { t } = useTranslation();
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/';

  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Show toast based on email verification result
  useEffect(() => {
    const v = searchParams.get('verified');
    if (!v) return;
    if (v === 'success')  toast.success(t('auth.success.email_verified'));
    if (v === 'already')  toast(t('auth.success.email_already'), { icon: 'ℹ️' });
    if (v === 'expired')  toast.error(t('auth.success.link_expired'));
    if (v === 'invalid')  toast.error(t('auth.success.link_invalid'));
    if (v === 'notfound') toast.error(t('auth.success.not_found'));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.email) e.email = t('auth.errors.email_required');
    if (!form.password) e.password = t('auth.errors.password_required');
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const res = await authApi.login(form);
      const user = res.data.data;
      if (user) {
        setUser(user);
        toast.success(`${t('auth.success.welcome_back')}, ${user.username}!`);

        if (from && from !== '/') {
          navigate(from, { replace: true });
        } else if (user.role === 'admin') {
          navigate('/admin/dashboard', { replace: true });
        } else if (user.role === 'seller') {
          navigate('/seller/dashboard', { replace: true });
        } else {
          navigate('/user/dashboard', { replace: true });
        }
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || t('auth.errors.login_failed'));
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
          <p className="text-gray-400 mt-2 text-sm">{t('auth.sign_in_account')}</p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-6">{t('auth.welcome_back')}</h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label={t('auth.email')}
              type="email"
              placeholder={t('auth.email_placeholder')}
              value={form.email}
              onChange={(e) => { setForm({ ...form, email: e.target.value }); if (errors.email) setErrors({ ...errors, email: '' }); }}
              error={errors.email}
              icon={<Mail size={16} />}
              autoComplete="email"
            />
            <Input
              label={t('auth.password')}
              type="password"
              placeholder={t('auth.password_placeholder')}
              value={form.password}
              onChange={(e) => { setForm({ ...form, password: e.target.value }); if (errors.password) setErrors({ ...errors, password: '' }); }}
              error={errors.password}
              icon={<Lock size={16} />}
              autoComplete="current-password"
            />

            <div className="flex justify-end">
              <Link to="/forgot-password" className="text-sm text-orange-500 hover:text-orange-600 transition-colors">
                {t('auth.forgot_password')}
              </Link>
            </div>

            <Button type="submit" loading={loading} size="lg" className="w-full">
              {t('auth.sign_in')}
            </Button>
          </form>

          {/* ── Divider ── */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-gray-200 dark:bg-slate-600" />
            <span className="text-xs text-gray-400 dark:text-slate-400 font-medium">{t('auth.or')}</span>
            <div className="flex-1 h-px bg-gray-200 dark:bg-slate-600" />
          </div>

          {/* ── Google Sign-In ── */}
          <GoogleSignInButton />

          <p className="text-center text-sm text-gray-500 dark:text-slate-400 mt-6">
            {t('auth.no_account')}{' '}
            <Link to="/signup" className="text-orange-500 hover:text-orange-600 font-medium transition-colors">
              {t('auth.sign_up')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

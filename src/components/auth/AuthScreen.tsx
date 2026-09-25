import React, { useState } from 'react';
import { Eye, EyeOff, KeyRound, Loader2, LogIn, ShieldCheck, WifiOff } from 'lucide-react';
import { RetailSolutionsLogo } from '../brand/RetailSolutionsLogo';
import { AuthService, AuthUser } from '../../services/authService';

const isDarkTheme = () =>
  typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark';

/** Shared frame: brand, title and a single card, centred on any screen size. */
export const AuthFrame: React.FC<{
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  /** Inside the app shell rather than full-screen. */
  embedded?: boolean;
}> = ({ title, subtitle, children, embedded }) => (
  <div className={`auth-screen${embedded ? ' is-embedded' : ''}`}>
    <div className="auth-card card-rs">
      <div className="auth-brand">
        <RetailSolutionsLogo
          variant={isDarkTheme() ? 'dark' : 'light'}
          colorScheme={isDarkTheme() ? 'dark' : 'light'}
          size="md"
          showSubbrand
        />
      </div>
      <h1 className="auth-title">{title}</h1>
      {subtitle && <p className="auth-subtitle">{subtitle}</p>}
      {children}
    </div>
    {!embedded && <p className="auth-footnote">Retail Solutions — سامانه ارزیابی تجربه مشتری</p>}
  </div>
);

export const Field: React.FC<{
  label: string;
  hint?: string;
  children: React.ReactNode;
}> = ({ label, hint, children }) => (
  <label className="auth-field">
    <span className="auth-label">{label}</span>
    {children}
    {hint && <span className="auth-hint">{hint}</span>}
  </label>
);

export const PasswordInput: React.FC<{
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  autoFocus?: boolean;
}> = ({ value, onChange, autoComplete, autoFocus }) => {
  const [visible, setVisible] = useState(false);
  return (
    <span className="auth-password">
      <input
        className="input-rs auth-input"
        type={visible ? 'text' : 'password'}
        dir="ltr"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        required
      />
      <button
        type="button"
        className="auth-eye"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'پنهان کردن رمز' : 'نمایش رمز'}
      >
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </span>
  );
};

export const ErrorNote: React.FC<{ message: string | null }> = ({ message }) =>
  message ? (
    <div className="auth-error" role="alert">
      {message}
    </div>
  ) : null;

export const LoginScreen: React.FC<{ onSignedIn: (u: AuthUser) => void; expired?: boolean }> = ({
  onSignedIn,
  expired,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onSignedIn(await AuthService.login(email.trim(), password));
    } catch (err: any) {
      setError(err.message);
      setPassword('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthFrame title="ورود به سامانه" subtitle="با ایمیل و رمز عبوری که مدیر سامانه به شما داده وارد شوید.">
      {expired && (
        <div className="auth-info" role="status">
          نشست شما به پایان رسیده است. دوباره وارد شوید؛ پاسخ‌های ذخیره‌شده روی این دستگاه از بین نمی‌روند.
        </div>
      )}
      <form onSubmit={submit} className="auth-form" noValidate>
        <Field label="ایمیل">
          <input
            className="input-rs auth-input"
            type="email"
            dir="ltr"
            inputMode="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
            required
          />
        </Field>
        <Field label="رمز عبور">
          <PasswordInput value={password} onChange={setPassword} autoComplete="current-password" />
        </Field>
        <ErrorNote message={error} />
        <button type="submit" className="btn-primary auth-submit" disabled={busy || !email || !password}>
          {busy ? <Loader2 size={18} className="spinning" /> : <LogIn size={18} />}
          <span>ورود</span>
        </button>
      </form>
      <p className="auth-help">رمز عبور را فراموش کرده‌اید؟ از مدیر سامانه بخواهید آن را بازنشانی کند.</p>
    </AuthFrame>
  );
};

export const SetupScreen: React.FC<{ onSignedIn: (u: AuthUser) => void; tokenRequired: boolean }> = ({
  onSignedIn,
  tokenRequired,
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [setupToken, setSetupToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError('تکرار رمز عبور با رمز عبور یکسان نیست.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      onSignedIn(
        await AuthService.setup({ name: name.trim(), email: email.trim(), password, setupToken: setupToken || undefined })
      );
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthFrame
      title="راه‌اندازی اولیه"
      subtitle="هنوز هیچ حسابی ساخته نشده است. حساب مدیر سامانه را بسازید؛ بقیهٔ کاربران را از بخش «مدیریت کاربران» اضافه می‌کنید."
    >
      <div className="auth-info">
        <ShieldCheck size={16} /> این صفحه فقط یک‌بار و تا پیش از ساخت اولین حساب در دسترس است.
      </div>
      <form onSubmit={submit} className="auth-form" noValidate>
        {tokenRequired && (
          <Field label="کد راه‌اندازی" hint="مقدار SETUP_TOKEN که روی سرور تنظیم شده است.">
            <input
              className="input-rs auth-input"
              dir="ltr"
              value={setupToken}
              onChange={(e) => setSetupToken(e.target.value)}
              autoComplete="off"
              required
            />
          </Field>
        )}
        <Field label="نام و نام خانوادگی">
          <input
            className="input-rs auth-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            autoFocus
            required
          />
        </Field>
        <Field label="ایمیل">
          <input
            className="input-rs auth-input"
            type="email"
            dir="ltr"
            inputMode="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </Field>
        <Field label="رمز عبور" hint="دست‌کم ۸ کاراکتر، شامل حرف و عدد.">
          <PasswordInput value={password} onChange={setPassword} autoComplete="new-password" />
        </Field>
        <Field label="تکرار رمز عبور">
          <PasswordInput value={confirm} onChange={setConfirm} autoComplete="new-password" />
        </Field>
        <ErrorNote message={error} />
        <button type="submit" className="btn-primary auth-submit" disabled={busy || !name || !email || !password}>
          {busy ? <Loader2 size={18} className="spinning" /> : <ShieldCheck size={18} />}
          <span>ساخت حساب مدیر و ورود</span>
        </button>
      </form>
    </AuthFrame>
  );
};

/** Forced after an admin-issued temporary password, and reachable from the menu. */
export const ChangePasswordScreen: React.FC<{
  forced: boolean;
  onDone: (u: AuthUser) => void;
  onCancel?: () => void;
  embedded?: boolean;
}> = ({ forced, onDone, onCancel, embedded }) => {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next !== confirm) {
      setError('تکرار رمز عبور جدید یکسان نیست.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      onDone(await AuthService.changePassword(current, next));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthFrame
      embedded={embedded}
      title={forced ? 'تعیین رمز عبور شخصی' : 'تغییر رمز عبور'}
      subtitle={
        forced
          ? 'با رمز موقت وارد شده‌اید. برای ادامه، یک رمز عبور شخصی تعیین کنید.'
          : 'پس از تغییر رمز، دستگاه‌های دیگر از حساب شما خارج می‌شوند.'
      }
    >
      <form onSubmit={submit} className="auth-form" noValidate>
        <Field label={forced ? 'رمز موقت' : 'رمز عبور فعلی'}>
          <PasswordInput value={current} onChange={setCurrent} autoComplete="current-password" autoFocus />
        </Field>
        <Field label="رمز عبور جدید" hint="دست‌کم ۸ کاراکتر، شامل حرف و عدد.">
          <PasswordInput value={next} onChange={setNext} autoComplete="new-password" />
        </Field>
        <Field label="تکرار رمز عبور جدید">
          <PasswordInput value={confirm} onChange={setConfirm} autoComplete="new-password" />
        </Field>
        <ErrorNote message={error} />
        <button type="submit" className="btn-primary auth-submit" disabled={busy || !current || !next}>
          {busy ? <Loader2 size={18} className="spinning" /> : <KeyRound size={18} />}
          <span>ذخیرهٔ رمز جدید</span>
        </button>
        {!forced && onCancel && (
          <button type="button" className="btn-secondary auth-submit" onClick={onCancel}>
            انصراف
          </button>
        )}
      </form>
    </AuthFrame>
  );
};

export const OfflineScreen: React.FC<{ onRetry: () => void }> = ({ onRetry }) => (
  <AuthFrame title="اتصال برقرار نیست" subtitle="برای اولین ورود به اینترنت نیاز است. پس از اتصال دوباره تلاش کنید.">
    <div className="auth-offline">
      <WifiOff size={36} />
    </div>
    <button type="button" className="btn-primary auth-submit" onClick={onRetry}>
      تلاش دوباره
    </button>
  </AuthFrame>
);

export const LoadingScreen: React.FC = () => (
  <main className="auth-screen" aria-busy="true">
    <Loader2 size={28} className="spinning" color="var(--rs-color-action-primary)" />
  </main>
);

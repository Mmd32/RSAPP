import React, { useEffect, useState } from 'react';
import { Check, Copy, KeyRound, Loader2, UserPlus, Users } from 'lucide-react';
import { AuthService, AuthUser } from '../services/authService';
import { ROLES, ROLE_DESCRIPTION, ROLE_LABEL, Role } from '../auth/roles';
import { faDateTime } from '../utils/format';

interface Props {
  currentUserId: string;
}

/** One-time password handed to a new or reset user. Shown once, never stored. */
const TemporaryPasswordNotice: React.FC<{ user: AuthUser; password: string; onClose: () => void }> = ({
  user,
  password,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`ایمیل: ${user.email}\nرمز موقت: ${password}`);
      setCopied(true);
    } catch {
      /* clipboard blocked; the password is still on screen */
    }
  };
  return (
    <div className="users-notice" role="status">
      <strong>رمز موقت برای {user.name}</strong>
      <p>
        این رمز فقط همین یک‌بار نمایش داده می‌شود. آن را به کاربر بدهید؛ در اولین ورود باید رمز شخصی تعیین کند.
      </p>
      <div className="users-notice__secret">
        <code dir="ltr">{user.email}</code>
        <code dir="ltr" className="users-notice__password">
          {password}
        </code>
      </div>
      <div className="users-notice__actions">
        <button type="button" className="btn-secondary" onClick={copy}>
          {copied ? <Check size={16} /> : <Copy size={16} />}
          <span>{copied ? 'کپی شد' : 'کپی ایمیل و رمز'}</span>
        </button>
        <button type="button" className="btn-primary" onClick={onClose}>
          متوجه شدم
        </button>
      </div>
    </div>
  );
};

export const UserManagement: React.FC<Props> = ({ currentUserId }) => {
  const [users, setUsers] = useState<AuthUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ user: AuthUser; password: string } | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('Evaluator');
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = () =>
    AuthService.listUsers()
      .then((list) => {
        setUsers(list);
        setError(null);
      })
      .catch((e) => setError(e.message));

  useEffect(() => {
    load();
  }, []);

  const replace = (u: AuthUser) => setUsers((prev) => prev?.map((x) => (x.id === u.id ? u : x)) ?? prev);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setFormError(null);
    try {
      const { user, temporaryPassword } = await AuthService.createUser({ name: name.trim(), email: email.trim(), role });
      setUsers((prev) => [...(prev || []), user]);
      setNotice({ user, password: temporaryPassword });
      setName('');
      setEmail('');
      setRole('Evaluator');
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const act = async (id: string, fn: () => Promise<void>) => {
    setBusyId(id);
    setError(null);
    try {
      await fn();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="page users-page">
      <header className="users-header">
        <h2 className="section-title">
          <Users size={22} /> مدیریت کاربران
        </h2>
        <p className="users-sub">
          حساب هر نفر را جدا بسازید تا پرسشنامه‌ها، تأییدها و اقدامات به نام خودش ثبت شود.
        </p>
      </header>

      {notice && (
        <TemporaryPasswordNotice user={notice.user} password={notice.password} onClose={() => setNotice(null)} />
      )}

      <form className="card-rs users-form" onSubmit={create}>
        <h3 className="users-form__title">
          <UserPlus size={18} /> افزودن کاربر
        </h3>
        <div className="users-form__grid">
          <label className="auth-field">
            <span className="auth-label">نام و نام خانوادگی</span>
            <input className="input-rs" value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label className="auth-field">
            <span className="auth-label">ایمیل</span>
            <input
              className="input-rs"
              type="email"
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label className="auth-field">
            <span className="auth-label">نقش</span>
            <select className="select-rs" value={role} onChange={(e) => setRole(e.target.value as Role)}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
            <span className="auth-hint">{ROLE_DESCRIPTION[role]}</span>
          </label>
        </div>
        {formError && <div className="auth-error">{formError}</div>}
        <button type="submit" className="btn-primary users-form__submit" disabled={creating || !name || !email}>
          {creating ? <Loader2 size={16} className="spinning" /> : <UserPlus size={16} />}
          <span>ساخت حساب و دریافت رمز موقت</span>
        </button>
      </form>

      {error && <div className="auth-error">{error}</div>}

      <section className="card-rs users-list" aria-label="فهرست کاربران">
        {!users ? (
          <div className="users-empty">
            <Loader2 size={20} className="spinning" />
          </div>
        ) : (
          <ul>
            {users.map((u) => {
              const isMe = u.id === currentUserId;
              const busy = busyId === u.id;
              return (
                <li key={u.id} className={`users-row${u.isActive ? '' : ' is-inactive'}`}>
                  <div className="users-row__who">
                    <strong>
                      {u.name} {isMe && <span className="users-me">(شما)</span>}
                    </strong>
                    <span dir="ltr" className="users-row__email">
                      {u.email}
                    </span>
                    <span className="users-row__meta">
                      {!u.isActive
                        ? 'غیرفعال'
                        : u.mustChangePassword
                        ? 'در انتظار اولین ورود'
                        : u.lastLoginAt
                        ? `آخرین ورود: ${faDateTime(u.lastLoginAt)}`
                        : 'هنوز وارد نشده'}
                    </span>
                  </div>
                  <div className="users-row__controls">
                    <select
                      className="select-rs"
                      aria-label={`نقش ${u.name}`}
                      value={u.role}
                      disabled={busy}
                      onChange={(e) =>
                        act(u.id, async () => replace(await AuthService.updateUser(u.id, { role: e.target.value as Role })))
                      }
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABEL[r]}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={busy}
                      onClick={() =>
                        act(u.id, async () => {
                          const r = await AuthService.resetPassword(u.id);
                          replace(r.user);
                          setNotice({ user: r.user, password: r.temporaryPassword });
                        })
                      }
                    >
                      <KeyRound size={15} />
                      <span>رمز جدید</span>
                    </button>
                    {!isMe && (
                      <button
                        type="button"
                        className="btn-secondary"
                        disabled={busy}
                        onClick={() =>
                          act(u.id, async () => replace(await AuthService.updateUser(u.id, { isActive: !u.isActive })))
                        }
                      >
                        {u.isActive ? 'غیرفعال‌سازی' : 'فعال‌سازی'}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
};

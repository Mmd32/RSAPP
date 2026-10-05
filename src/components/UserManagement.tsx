import React, { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronUp, Copy, KeyRound, Loader2, ShieldCheck, UserPlus, Users } from 'lucide-react';
import { AuthService, AuthUser } from '../services/authService';
import { ROLES, ROLE_DESCRIPTION, ROLE_LABEL, Role } from '../auth/roles';
import { PERMISSIONS, PERMISSION_INFO, Permission, ROLE_DEFAULT_PERMISSIONS } from '../auth/permissions';
import { faDateTime, faDigits } from '../utils/format';

interface Props {
  currentUserId: string;
  /** Called when the signed-in person edits their own account, so menus refresh. */
  onSelfUpdated?: (u: AuthUser) => void;
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
      <p>این رمز فقط همین یک‌بار نمایش داده می‌شود. آن را به کاربر بدهید؛ در اولین ورود باید رمز شخصی تعیین کند.</p>
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

/** Permission checkboxes, grouped by area. */
const PermissionEditor: React.FC<{
  value: Permission[];
  onChange: (next: Permission[]) => void;
  disabled?: boolean;
  /** Permissions that cannot be turned off here (e.g. your own user management). */
  locked?: Permission[];
}> = ({ value, onChange, disabled, locked = [] }) => {
  const groups = useMemo(() => {
    const map = new Map<string, Permission[]>();
    for (const p of PERMISSIONS) {
      const g = PERMISSION_INFO[p].group;
      map.set(g, [...(map.get(g) || []), p]);
    }
    return Array.from(map.entries());
  }, []);
  const toggle = (p: Permission) =>
    onChange(value.includes(p) ? value.filter((x) => x !== p) : [...value, p]);
  return (
    <div className="perm-editor">
      {groups.map(([group, perms]) => (
        <fieldset key={group} className="perm-group">
          <legend>{group}</legend>
          {perms.map((p) => {
            const isLocked = locked.includes(p);
            return (
              <label key={p} className={`perm-item${value.includes(p) ? ' is-on' : ''}`}>
                <input
                  type="checkbox"
                  checked={value.includes(p)}
                  disabled={disabled || isLocked}
                  onChange={() => toggle(p)}
                />
                <span className="perm-item__text">
                  <span className="perm-item__label">{PERMISSION_INFO[p].label}</span>
                  <span className="perm-item__hint">
                    {isLocked ? 'برای حساب خودتان قابل برداشتن نیست' : PERMISSION_INFO[p].hint}
                  </span>
                </span>
              </label>
            );
          })}
        </fieldset>
      ))}
    </div>
  );
};

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));

/** Expandable panel to edit one person's name, template and permissions. */
const AccessPanel: React.FC<{
  user: AuthUser;
  isMe: boolean;
  onSaved: (u: AuthUser) => void;
}> = ({ user, isMe, onSaved }) => {
  const [name, setName] = useState(user.name);
  const [role, setRole] = useState<Role>(user.role);
  const [perms, setPerms] = useState<Permission[]>(user.permissions);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const roleDefaults = ROLE_DEFAULT_PERMISSIONS[role] || [];
  const dirty = name.trim() !== user.name || role !== user.role || !sameSet(perms, user.permissions);

  const pickRole = (r: Role) => {
    setRole(r);
    setPerms([...(ROLE_DEFAULT_PERMISSIONS[r] || [])]);
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await AuthService.updateUser(user.id, {
        ...(name.trim() !== user.name ? { name: name.trim() } : {}),
        ...(role !== user.role ? { role } : {}),
        permissions: sameSet(perms, roleDefaults) ? null : perms,
      });
      onSaved(updated);
      setSaved(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="access-panel">
      <div className="access-panel__top">
        <label className="auth-field">
          <span className="auth-label">نام</span>
          <input className="input-rs" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="auth-field">
          <span className="auth-label">قالب دسترسی (نقش)</span>
          <select className="select-rs" value={role} onChange={(e) => pickRole(e.target.value as Role)}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
          <span className="auth-hint">با انتخاب نقش، تیک‌ها به حالت پیش‌فرض آن نقش برمی‌گردند؛ بعد هر کدام را می‌توانید تغییر دهید.</span>
        </label>
      </div>

      <PermissionEditor value={perms} onChange={setPerms} locked={isMe ? ['users.manage'] : []} />

      {error && <div className="auth-error">{error}</div>}
      <div className="access-panel__actions">
        {!sameSet(perms, roleDefaults) && (
          <button type="button" className="btn-secondary" onClick={() => setPerms([...roleDefaults])}>
            بازگشت به پیش‌فرض «{ROLE_LABEL[role]}»
          </button>
        )}
        <button type="button" className="btn-primary" onClick={save} disabled={busy || !dirty || name.trim().length < 2}>
          {busy ? <Loader2 size={16} className="spinning" /> : saved && !dirty ? <Check size={16} /> : <ShieldCheck size={16} />}
          <span>{saved && !dirty ? 'ذخیره شد' : 'ذخیرهٔ تغییرات'}</span>
        </button>
      </div>
    </div>
  );
};

export const UserManagement: React.FC<Props> = ({ currentUserId, onSelfUpdated }) => {
  const [users, setUsers] = useState<AuthUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ user: AuthUser; password: string } | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('Evaluator');
  const [perms, setPerms] = useState<Permission[]>([...ROLE_DEFAULT_PERMISSIONS.Evaluator]);
  const [showNewPerms, setShowNewPerms] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    AuthService.listUsers()
      .then((list) => {
        setUsers(list);
        setError(null);
      })
      .catch((e) => setError(e.message));
  }, []);

  const replace = (u: AuthUser) => {
    setUsers((prev) => prev?.map((x) => (x.id === u.id ? u : x)) ?? prev);
    if (u.id === currentUserId) onSelfUpdated?.(u);
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setFormError(null);
    try {
      const { user, temporaryPassword } = await AuthService.createUser({
        name: name.trim(),
        email: email.trim(),
        role,
        permissions: perms,
      });
      setUsers((prev) => [...(prev || []), user]);
      setNotice({ user, password: temporaryPassword });
      setName('');
      setEmail('');
      setRole('Evaluator');
      setPerms([...ROLE_DEFAULT_PERMISSIONS.Evaluator]);
      setShowNewPerms(false);
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
          <Users size={22} /> کاربران و دسترسی‌ها
        </h2>
        <p className="users-sub">
          هر نفر را جدا تعریف کنید و دقیقاً مشخص کنید به چه بخش‌هایی دسترسی دارد. نقش فقط یک قالب آماده است؛ تیک هر
          دسترسی را می‌توانید جداگانه بزنید یا بردارید.
        </p>
      </header>

      {notice && (
        <TemporaryPasswordNotice user={notice.user} password={notice.password} onClose={() => setNotice(null)} />
      )}

      <form className="card-rs users-form" onSubmit={create}>
        <h3 className="users-form__title">
          <UserPlus size={18} /> تعریف نفر جدید
        </h3>
        <div className="users-form__grid">
          <label className="auth-field">
            <span className="auth-label">نام و نام خانوادگی</span>
            <input className="input-rs" value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label className="auth-field">
            <span className="auth-label">ایمیل (نام کاربری)</span>
            <input className="input-rs" type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label className="auth-field">
            <span className="auth-label">قالب دسترسی (نقش)</span>
            <select
              className="select-rs"
              value={role}
              onChange={(e) => {
                const r = e.target.value as Role;
                setRole(r);
                setPerms([...(ROLE_DEFAULT_PERMISSIONS[r] || [])]);
              }}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
            <span className="auth-hint">{ROLE_DESCRIPTION[role]}</span>
          </label>
        </div>

        <button
          type="button"
          className="users-perm-toggle"
          aria-expanded={showNewPerms}
          onClick={() => setShowNewPerms((v) => !v)}
        >
          {showNewPerms ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          <span>
            دسترسی‌ها: {faDigits(perms.length)} از {faDigits(PERMISSIONS.length)}
            {!sameSet(perms, ROLE_DEFAULT_PERMISSIONS[role] || []) && ' (سفارشی)'}
          </span>
        </button>
        {showNewPerms && <PermissionEditor value={perms} onChange={setPerms} />}

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
              const open = openId === u.id;
              return (
                <li key={u.id} className={`users-row${u.isActive ? '' : ' is-inactive'}${open ? ' is-open' : ''}`}>
                  <div className="users-row__main">
                    <div className="users-row__who">
                      <strong>
                        {u.name} {isMe && <span className="users-me">(شما)</span>}
                      </strong>
                      <span dir="ltr" className="users-row__email">
                        {u.email}
                      </span>
                      <span className="users-row__meta">
                        <span className="users-role">{ROLE_LABEL[u.role]}</span>
                        {u.customPermissions && <span className="users-custom">دسترسی سفارشی</span>}
                        <span>
                          {!u.isActive
                            ? 'غیرفعال'
                            : u.mustChangePassword
                            ? 'در انتظار اولین ورود'
                            : u.lastLoginAt
                            ? `آخرین ورود: ${faDateTime(u.lastLoginAt)}`
                            : 'هنوز وارد نشده'}
                        </span>
                      </span>
                    </div>
                    <div className="users-row__controls">
                      <button
                        type="button"
                        className={open ? 'btn-primary' : 'btn-secondary'}
                        aria-expanded={open}
                        onClick={() => setOpenId(open ? null : u.id)}
                      >
                        <ShieldCheck size={15} />
                        <span>دسترسی‌ها ({faDigits(u.permissions.length)})</span>
                      </button>
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
                  </div>
                  {open && <AccessPanel key={u.id} user={u} isMe={isMe} onSaved={replace} />}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
};

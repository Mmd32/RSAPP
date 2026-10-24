import React, { useMemo, useState } from 'react';
import { Briefcase, ChevronDown, ChevronLeft, GitMerge, Pencil, Plus, Power, Trash2, X } from 'lucide-react';
import type { SavedStoreDirectoryItem, VisitSession } from '../types';
import { BrandService, type Brand } from '../services/brandService';
import { StoreService } from '../services/storeService';
import { nameKey } from '../engine/frModel';
import { faDigits, profileLabel } from '../utils/format';

const SECTORS = [
  'Fashion', 'Shoe_Bag', 'Watch_Jewelry', 'FMCG', 'F_B', 'Hardware', 'Homeware',
  'Beauty_Cosmetics', 'Electronics', 'Entertainment', 'Sports', 'Specialty', 'Services',
];

interface Props {
  brands: Brand[];
  stores: SavedStoreDirectoryItem[];
  /** Visits already mapped to today's brand and branch names. */
  visits: VisitSession[];
  canManage: boolean;
  /** Reload brands and the branch directory after any change. */
  onChanged: () => Promise<void>;
}

type Dialog =
  | { kind: 'brand'; brand?: Brand }
  | { kind: 'branch'; brand: Brand; store?: SavedStoreDirectoryItem }
  | { kind: 'merge'; brand: Brand }
  | null;

/**
 * Brands and their branches: define, rename, switch off, merge, delete.
 * Reports group visits by these names, so a renamed or merged brand stays one business.
 */
export const BrandManager: React.FC<Props> = ({ brands, stores, visits, canManage, onChanged }) => {
  const [dialog, setDialog] = useState<Dialog>(null);
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const rows = useMemo(() => {
    const q = nameKey(query);
    return brands
      .map((brand) => {
        const keys = new Set([brand.name, ...brand.aliases].map(nameKey));
        const branches = stores.filter((s) => keys.has(nameKey(s.brandName)));
        const brandVisits = visits.filter((v) => keys.has(nameKey(v.brandName)));
        return { brand, branches, visitCount: brandVisits.length, visits: brandVisits };
      })
      .filter((r) => !q || nameKey(r.brand.name).includes(q) || r.branches.some((b) => nameKey(b.branchName).includes(q)))
      .sort((a, b) => b.visitCount - a.visitCount || a.brand.name.localeCompare(b.brand.name, 'fa'));
  }, [brands, stores, visits, query]);

  const run = async (job: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await job();
      await onChanged();
      setDialog(null);
    } catch (e: any) {
      setError(e?.message || 'انجام نشد.');
    } finally {
      setBusy(false);
    }
  };
  const close = () => {
    setDialog(null);
    setError(null);
  };
  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="page brand-page">
      <header className="business-header">
        <div>
          <h2 className="section-title"><Briefcase size={22} /> مدیریت برندها و شعب</h2>
          <p className="business-sub">
            هر برند یک کسب‌وکار است و شعبه‌هایش زیر آن می‌آیند. گزارش کل کسب‌وکار همهٔ شعبه‌های یک برند را با هم مقایسه می‌کند. نام برند یا شعبه را عوض کنید یا دو برند را ادغام کنید؛
            بازدیدهای قبلی خودکار به برند و شعبهٔ درست می‌پیوندند.
          </p>
        </div>
        <div className="ie-actions">
          <input className="ie-input" style={{ minWidth: 200 }} placeholder="جستجوی برند یا شعبه…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="جستجو" />
          {canManage && (
            <button type="button" className="btn-primary" onClick={() => setDialog({ kind: 'brand' })}>
              <Plus size={15} /><span>برند جدید</span>
            </button>
          )}
        </div>
      </header>

      {!rows.length ? (
        <div className="fr-card"><p className="fr-card__empty">هنوز برندی تعریف نشده است. برند را اینجا یا هنگام «بازدید جدید» تعریف کنید.</p></div>
      ) : (
        rows.map(({ brand, branches, visitCount }) => {
          const isOpen = open.has(brand.id);
          return (
            <section key={brand.id} className="fr-card brand-card" data-brand={brand.name}>
              <header className="brand-card__head">
                <button type="button" className="brand-card__toggle" onClick={() => toggle(brand.id)} aria-expanded={isOpen}>
                  {isOpen ? <ChevronDown size={18} /> : <ChevronLeft size={18} />}
                  <span className="brand-card__name">{brand.name}</span>
                </button>
                {!brand.isActive && <span className="ie-chip ie-chip--off">غیرفعال</span>}
                {brand.businessType && <span className="ie-chip">{profileLabel(brand.businessType)}</span>}
                <span className="brand-card__meta">{faDigits(branches.length)} شعبه · {faDigits(visitCount)} بازدید</span>
                {canManage && (
                  <div className="brand-card__actions">
                    <button type="button" className="btn-secondary" onClick={() => setDialog({ kind: 'brand', brand })} title="ویرایش برند" aria-label="ویرایش برند"><Pencil size={14} /></button>
                    <button type="button" className="btn-secondary" onClick={() => run(async () => { await BrandService.update(brand.id, { isActive: !brand.isActive }); })} title={brand.isActive ? 'غیرفعال کردن' : 'فعال کردن'} aria-label="فعال یا غیرفعال"><Power size={14} /></button>
                    <button type="button" className="btn-secondary" onClick={() => setDialog({ kind: 'merge', brand })} disabled={brands.length < 2} title="ادغام در برند دیگر" aria-label="ادغام"><GitMerge size={14} /></button>
                    <button
                      type="button"
                      className="btn-secondary"
                      title="حذف برند"
                      aria-label="حذف برند"
                      onClick={() => {
                        if (window.confirm(`برند «${brand.name}» و ${faDigits(branches.length)} شعبهٔ آن از فهرست حذف شود؟ بازدیدها و گزارش‌های ثبت‌شده دست‌نخورده می‌مانند.`)) {
                          run(async () => { await BrandService.remove(brand.id); });
                        }
                      }}
                    ><Trash2 size={14} /></button>
                  </div>
                )}
              </header>
              {brand.aliases.length > 0 && <p className="ie-hint">نام‌های دیگر (بازدیدهای این نام‌ها هم در همین برند حساب می‌شوند): {brand.aliases.join('، ')}</p>}
              {brand.notes && <p className="ie-hint">{brand.notes}</p>}

              {isOpen && (
                <div className="fr-table-wrap">
                  <table className="fr-table">
                    <thead>
                      <tr><th scope="col">شعبه</th><th scope="col">شهر</th><th scope="col">نشانی</th><th scope="col">مدیر شعبه</th><th scope="col">بازدید</th><th scope="col">آخرین بازدید</th><th scope="col">وضعیت</th>{canManage && <th scope="col" />}</tr>
                    </thead>
                    <tbody>
                      {branches.map((s) => {
                        const count = visits.filter((v) => nameKey(v.brandName) === nameKey(brand.name) && nameKey(v.branchName) === nameKey(s.branchName)).length;
                        return (
                          <tr key={s.id} className={s.isActive === false ? 'xl-off' : ''}>
                            <th scope="row">{s.branchName}</th>
                            <td>{s.city || '—'}</td>
                            <td>{s.address || '—'}</td>
                            <td>{s.supervisorName || '—'}</td>
                            <td className="ltr-num">{faDigits(count)}</td>
                            <td>{s.lastVisitedAt ? new Date(s.lastVisitedAt).toLocaleDateString('fa-IR') : '—'}</td>
                            <td>{s.isActive === false ? 'غیرفعال' : 'فعال'}</td>
                            {canManage && (
                              <td className="xl-actions">
                                <button type="button" className="btn-secondary" onClick={() => setDialog({ kind: 'branch', brand, store: s })} aria-label="ویرایش شعبه" title="ویرایش شعبه"><Pencil size={14} /></button>
                                <button
                                  type="button"
                                  className="btn-secondary"
                                  aria-label="حذف شعبه"
                                  title="حذف شعبه"
                                  onClick={() => {
                                    if (window.confirm(`شعبهٔ «${s.branchName}» از فهرست حذف شود؟ بازدیدهای ثبت‌شده دست‌نخورده می‌مانند.`)) run(async () => { await StoreService.deleteStore(s.id); });
                                  }}
                                ><Trash2 size={14} /></button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                      {!branches.length && <tr><td colSpan={8} className="ie-hint">هنوز شعبه‌ای ندارد.</td></tr>}
                    </tbody>
                  </table>
                  {canManage && (
                    <div style={{ padding: 'var(--sp-3)' }}>
                      <button type="button" className="btn-secondary" onClick={() => setDialog({ kind: 'branch', brand })}><Plus size={14} /><span>شعبهٔ جدید</span></button>
                    </div>
                  )}
                </div>
              )}
            </section>
          );
        })
      )}

      {dialog?.kind === 'brand' && <BrandDialog brand={dialog.brand} busy={busy} error={error} onClose={close} onSave={(input) => run(async () => { if (dialog.brand) await BrandService.update(dialog.brand.id, input); else await BrandService.create(input); })} />}
      {dialog?.kind === 'merge' && (
        <MergeDialog
          brand={dialog.brand}
          others={brands.filter((b) => b.id !== dialog.brand.id)}
          busy={busy}
          error={error}
          onClose={close}
          onMerge={(intoId) => run(async () => { await BrandService.merge(dialog.brand.id, intoId); })}
        />
      )}
      {dialog?.kind === 'branch' && (
        <BranchDialog
          brand={dialog.brand}
          store={dialog.store}
          brands={brands}
          busy={busy}
          error={error}
          onClose={close}
          onSave={(v) =>
            run(async () => {
              if (dialog.store) {
                await StoreService.updateStore(dialog.store.id, v);
              } else {
                await StoreService.saveStore({
                  brandName: dialog.brand.name,
                  branchName: String(v.branchName),
                  city: v.city as string | undefined,
                  address: v.address as string | undefined,
                  supervisorName: v.supervisorName as string | undefined,
                  businessType: (dialog.brand.businessType as any) || 'Fashion',
                  assessmentType: 'STORE',
                  locationContext: 'STREET_STORE',
                  attributes: undefined as any,
                });
              }
            })
          }
        />
      )}
    </div>
  );
};

const Shell: React.FC<{ title: string; onClose: () => void; children: React.ReactNode; footer: React.ReactNode }> = ({ title, onClose, children, footer }) => (
  <div className="ie-backdrop" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
    <div className="ie-dialog">
      <header className="ie-head">
        <h3 className="ie-title">{title}</h3>
        <button type="button" className="ie-close" onClick={onClose} aria-label="بستن"><X size={18} /></button>
      </header>
      {children}
      <footer className="ie-foot"><span />{footer}</footer>
    </div>
  </div>
);

const BrandDialog: React.FC<{ brand?: Brand; busy: boolean; error: string | null; onClose: () => void; onSave: (v: { name: string; businessType: string; notes: string }) => void }> = ({ brand, busy, error, onClose, onSave }) => {
  const [name, setName] = useState(brand?.name || '');
  const [sector, setSector] = useState(brand?.businessType || '');
  const [notes, setNotes] = useState(brand?.notes || '');
  return (
    <Shell
      title={brand ? 'ویرایش برند' : 'برند جدید'}
      onClose={onClose}
      footer={
        <div className="ie-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>انصراف</button>
          <button type="button" className="btn-primary" disabled={busy || name.trim().length < 2} onClick={() => onSave({ name, businessType: sector, notes })}>{brand ? 'ذخیره' : 'تعریف برند'}</button>
        </div>
      }
    >
      <label className="ie-field"><span className="ie-label">نام برند</span><input className="ie-input" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} autoFocus /></label>
      {brand && <p className="ie-hint">با تغییر نام، نام قبلی بین «نام‌های دیگر» می‌ماند و بازدیدهای قبلی در همین برند حساب می‌شوند.</p>}
      <label className="ie-field">
        <span className="ie-label">سکتور (اختیاری)</span>
        <select className="ie-input" value={sector} onChange={(e) => setSector(e.target.value)}>
          <option value="">مشخص نشده</option>
          {SECTORS.map((s) => <option key={s} value={s}>{profileLabel(s)}</option>)}
        </select>
      </label>
      <label className="ie-field"><span className="ie-label">یادداشت (اختیاری)</span><textarea className="ie-input" rows={2} maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
      {error && <div className="auth-error" role="alert">{error}</div>}
    </Shell>
  );
};

const MergeDialog: React.FC<{ brand: Brand; others: Brand[]; busy: boolean; error: string | null; onClose: () => void; onMerge: (intoId: string) => void }> = ({ brand, others, busy, error, onClose, onMerge }) => {
  const [target, setTarget] = useState(others[0]?.id || '');
  const into = others.find((b) => b.id === target);
  return (
    <Shell
      title={`ادغام «${brand.name}» در برند دیگر`}
      onClose={onClose}
      footer={
        <div className="ie-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>انصراف</button>
          <button type="button" className="btn-primary" disabled={busy || !into} onClick={() => onMerge(target)}>ادغام</button>
        </div>
      }
    >
      <p className="ie-info">شعبه‌ها و بازدیدهای «{brand.name}» به برند انتخاب‌شده می‌پیوندند و «{brand.name}» به‌عنوان نام دیگر آن می‌ماند. این کار برگشت‌پذیر نیست.</p>
      <label className="ie-field">
        <span className="ie-label">ادغام در</span>
        <select className="ie-input" value={target} onChange={(e) => setTarget(e.target.value)}>
          {others.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </label>
      {error && <div className="auth-error" role="alert">{error}</div>}
    </Shell>
  );
};

const BranchDialog: React.FC<{
  brand: Brand;
  store?: SavedStoreDirectoryItem;
  brands: Brand[];
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (v: Record<string, unknown>) => void;
}> = ({ brand, store, brands, busy, error, onClose, onSave }) => {
  const [name, setName] = useState(store?.branchName || '');
  const [city, setCity] = useState(store?.city || '');
  const [address, setAddress] = useState(store?.address || '');
  const [manager, setManager] = useState(store?.supervisorName || '');
  const [active, setActive] = useState(store?.isActive !== false);
  const [brandId, setBrandId] = useState(brand.id);
  return (
    <Shell
      title={store ? `ویرایش شعبه — ${brand.name}` : `شعبهٔ جدید — ${brand.name}`}
      onClose={onClose}
      footer={
        <div className="ie-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>انصراف</button>
          <button
            type="button"
            className="btn-primary"
            disabled={busy || !name.trim()}
            onClick={() => onSave({ branchName: name, city, address, supervisorName: manager, ...(store ? { isActive: active, ...(brandId !== brand.id ? { brandId } : {}) } : {}) })}
          >{store ? 'ذخیره' : 'افزودن شعبه'}</button>
        </div>
      }
    >
      <label className="ie-field"><span className="ie-label">نام شعبه</span><input className="ie-input" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} autoFocus /></label>
      <div className="ie-grid">
        <label className="ie-field"><span className="ie-label">شهر</span><input className="ie-input" value={city} maxLength={60} onChange={(e) => setCity(e.target.value)} /></label>
        <label className="ie-field"><span className="ie-label">نام مدیر شعبه</span><input className="ie-input" value={manager} maxLength={80} onChange={(e) => setManager(e.target.value)} /></label>
      </div>
      <label className="ie-field"><span className="ie-label">نشانی</span><input className="ie-input" value={address} maxLength={200} onChange={(e) => setAddress(e.target.value)} /></label>
      {store && (
        <>
          <label className="ie-field">
            <span className="ie-label">متعلق به برند</span>
            <select className="ie-input" value={brandId} onChange={(e) => setBrandId(e.target.value)}>
              {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>
          <label className="ie-check"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /><span>فعال (برای بازدید جدید پیشنهاد شود)</span></label>
        </>
      )}
      {error && <div className="auth-error" role="alert">{error}</div>}
    </Shell>
  );
};

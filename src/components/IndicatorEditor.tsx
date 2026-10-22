import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, RotateCcw, X } from 'lucide-react';
import type { Indicator } from '../types';
import type { IndicatorEdit, CustomIndicatorInput } from '../services/indicatorService';
import { faDigits, groupLabel, profileLabel } from '../utils/format';

const MAX_STATEMENT = 600;
const MAX_NOTE = 1200;

interface Props {
  indicator: Indicator;
  /** The row as the checklist file has it, for reference and for "back to the file's text". */
  original: Indicator;
  position: number;
  total: number;
  canEdit: boolean;
  onSave: (id: string, edit: IndicatorEdit) => Promise<void>;
  onReset: (id: string) => Promise<void>;
  onMove: (step: -1 | 1) => void;
  onClose: () => void;
}

/**
 * Edit one indicator: the wording the auditor reads and the note shown under it.
 * Previous / next walk the list the question bank is currently showing, so a
 * long list can be reviewed one row after another.
 */
export const IndicatorEditor: React.FC<Props> = ({
  indicator, original, position, total, canEdit, onSave, onReset, onMove, onClose,
}) => {
  const [statement, setStatement] = useState(indicator.statement);
  const [note, setNote] = useState(indicator.auditorNote || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const first = useRef<HTMLTextAreaElement>(null);

  // The fields follow what is stored (after a save or a reset); the status messages only reset on another row.
  useEffect(() => {
    setStatement(indicator.statement);
    setNote(indicator.auditorNote || '');
  }, [indicator.statement, indicator.auditorNote]);
  useEffect(() => {
    setError(null);
    setSaved(false);
    first.current?.focus();
  }, [indicator.id]);

  const dirty = statement.trim() !== indicator.statement || note.trim() !== (indicator.auditorNote || '');
  const differsFromFile = !!indicator.edited;

  const run = async (job: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await job();
      setSaved(true);
    } catch (e: any) {
      setError(e?.message || 'ذخیره انجام نشد.');
    } finally {
      setBusy(false);
    }
  };

  const save = () =>
    run(() =>
      onSave(indicator.id, {
        ...(statement.trim() !== indicator.statement ? { statement: statement.trim() } : {}),
        ...(note.trim() !== (indicator.auditorNote || '') ? { auditorNote: note.trim() } : {}),
      })
    );

  const move = (step: -1 | 1) => {
    if (dirty && !window.confirm('تغییرات ذخیره‌نشده از بین می‌رود. ادامه می‌دهید؟')) return;
    onMove(step);
  };

  return (
    <div className="ie-backdrop" role="dialog" aria-modal="true" aria-labelledby="ie-title" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ie-dialog">
        <header className="ie-head">
          <div>
            <h3 id="ie-title" className="ie-title">
              <span className="indicator-code-badge">{indicator.code}</span>
              {canEdit ? 'ویرایش شاخص' : 'شاخص'}
              {differsFromFile && <span className="ie-chip">ویرایش‌شده</span>}
            </h3>
            <p className="ie-sub">
              {groupLabel(indicator.group)} · {indicator.subject}
            </p>
          </div>
          <button type="button" className="ie-close" onClick={onClose} aria-label="بستن">
            <X size={18} />
          </button>
        </header>

        <label className="ie-field">
          <span className="ie-label">متن شاخص</span>
          <textarea
            ref={first}
            className="ie-input"
            rows={3}
            value={statement}
            maxLength={MAX_STATEMENT}
            readOnly={!canEdit}
            onChange={(e) => setStatement(e.target.value)}
          />
          <span className="ie-hint">همین متن در پرسشنامه به ارزیاب نشان داده می‌شود.</span>
        </label>

        <label className="ie-field">
          <span className="ie-label">نکته برای ارزیاب (اختیاری)</span>
          <textarea
            className="ie-input"
            rows={3}
            value={note}
            maxLength={MAX_NOTE}
            readOnly={!canEdit}
            placeholder="مثلاً: مواردی که ارزیاب باید هنگام بررسی این شاخص در نظر بگیرد"
            onChange={(e) => setNote(e.target.value)}
          />
          <span className="ie-hint">زیر همین شاخص، در کادر «نکته برای ارزیاب» دیده می‌شود. خالی بگذارید تا نمایش داده نشود.</span>
        </label>

        {differsFromFile && (
          <div className="ie-original">
            <span className="ie-label">متن فایل چک‌لیست</span>
            <p>{original.statement}</p>
            {original.auditorNote ? <p className="ie-original__note">نکته: {original.auditorNote}</p> : null}
          </div>
        )}

        {canEdit && (
          <label className="ie-switch">
            <input
              type="checkbox"
              checked={!indicator.disabled}
              disabled={busy}
              onChange={(e) => run(() => onSave(indicator.id, { disabled: !e.target.checked }))}
            />
            <span>
              {indicator.disabled ? 'غیرفعال است؛ در پرسشنامهٔ تازه پرسیده نمی‌شود' : 'فعال است؛ در پرسشنامه پرسیده می‌شود'}
            </span>
          </label>
        )}

        <p className="ie-info">
          پرسشنامه‌هایی که قبلاً شروع شده‌اند همان متن قبلی را نگه می‌دارند؛ پرسشنامه‌های تازه متن جدید را می‌بینند.
        </p>

        {error && <div className="auth-error" role="alert">{error}</div>}

        <footer className="ie-foot">
          <div className="ie-nav">
            <button type="button" className="btn-secondary" onClick={() => move(1)} disabled={position >= total} aria-label="شاخص بعدی">
              <ChevronRight size={16} />
              <span>بعدی</span>
            </button>
            <span className="ie-pos ltr-num">
              {faDigits(position)} از {faDigits(total)}
            </span>
            <button type="button" className="btn-secondary" onClick={() => move(-1)} disabled={position <= 1} aria-label="شاخص قبلی">
              <span>قبلی</span>
              <ChevronLeft size={16} />
            </button>
          </div>
          {canEdit && (
            <div className="ie-actions">
              {differsFromFile && (
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={busy}
                  onClick={() => run(() => onReset(indicator.id))}
                  title="بازگشت به متن و نکتهٔ فایل چک‌لیست"
                >
                  <RotateCcw size={15} />
                  <span>بازگشت به متن فایل</span>
                </button>
              )}
              <button type="button" className="btn-primary" disabled={busy || !dirty || statement.trim().length < 3} onClick={save}>
                {saved && !dirty ? 'ذخیره شد' : 'ذخیره'}
              </button>
            </div>
          )}
        </footer>
      </div>
    </div>
  );
};

const ZONES = ['FLOOR', 'SERVICES', 'TEAM', 'PRODUCT', 'CASH'];
const SECTORS = [
  'Fashion', 'Shoe_Bag', 'Watch_Jewelry', 'FMCG', 'F_B', 'Hardware', 'Homeware',
  'Beauty_Cosmetics', 'Electronics', 'Entertainment', 'Sports', 'Specialty', 'Services',
];
const MALL_TYPES = ['SM', 'Neighborhood', 'Community', 'Regional', 'Super_Regional'];

interface FormProps {
  /** Absent when creating. */
  indicator?: Indicator;
  /** Every indicator, for topic and mall-group suggestions. */
  all: Indicator[];
  onCreate: (input: CustomIndicatorInput) => Promise<void>;
  onUpdate: (id: string, input: CustomIndicatorInput) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onClose: () => void;
}

/** Add an indicator by hand, or edit one that was added by hand: every field a checklist row has. */
export const IndicatorForm: React.FC<FormProps> = ({ indicator, all, onCreate, onUpdate, onDelete, onClose }) => {
  const editing = !!indicator;
  const [template, setTemplate] = useState<'STORE' | 'MALL'>(indicator?.template ?? 'STORE');
  const [group, setGroup] = useState(indicator?.group ?? 'FLOOR');
  const [subject, setSubject] = useState(indicator?.subject ?? '');
  const [code, setCode] = useState(indicator?.code ?? '');
  const [statement, setStatement] = useState(indicator?.statement ?? '');
  const [note, setNote] = useState(indicator?.auditorNote ?? '');
  const [sectors, setSectors] = useState<string[]>(indicator?.applicableBusinessTypes ?? SECTORS);
  const [mallTypes, setMallTypes] = useState<string[]>(indicator?.applicableMallTypes ?? MALL_TYPES);
  const [photo, setPhoto] = useState(!!indicator?.requiresPhoto);
  const [comment, setComment] = useState(!!indicator?.requiresComment);
  const [weight, setWeight] = useState(String(indicator?.weight ?? 1));
  const [active, setActive] = useState(indicator ? indicator.status === 'ACTIVE' : true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mallGroups = [...new Set(all.filter((i) => i.template === 'MALL').map((i) => i.group))];
  const topics = [...new Set(all.filter((i) => i.template === template && i.group === group).map((i) => i.subject))];
  const toggle = (list: string[], set: (v: string[]) => void, v: string) =>
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const changeTemplate = (t: 'STORE' | 'MALL') => {
    setTemplate(t);
    setGroup(t === 'STORE' ? 'FLOOR' : mallGroups[0] || '');
    setSubject('');
  };

  const weightNum = Number(weight);
  const problem =
    statement.trim().length < 3 ? 'متن شاخص را بنویسید.'
    : !group.trim() ? 'منطقه یا گروه را مشخص کنید.'
    : !subject.trim() ? 'موضوع را بنویسید.'
    : template === 'STORE' && !sectors.length ? 'دست‌کم یک سکتور را انتخاب کنید.'
    : template === 'MALL' && !mallTypes.length ? 'دست‌کم یک نوع مرکز خرید را انتخاب کنید.'
    : !(weightNum >= 0.5 && weightNum <= 5) ? 'وزن باید بین ۰٫۵ و ۵ باشد.'
    : null;

  const submit = async () => {
    setBusy(true);
    setError(null);
    const input: CustomIndicatorInput = {
      template,
      group: group.trim(),
      subject: subject.trim(),
      ...(code.trim() ? { code: code.trim() } : {}),
      statement: statement.trim(),
      auditorNote: note.trim() || null,
      applicableBusinessTypes: template === 'STORE' ? sectors : [],
      applicableMallTypes: template === 'MALL' ? mallTypes : [],
      requiresPhoto: photo,
      requiresComment: comment,
      weight: weightNum,
      status: active ? 'ACTIVE' : 'ARCHIVED',
    };
    try {
      if (indicator) await onUpdate(indicator.id, input);
      else await onCreate(input);
      onClose();
    } catch (e: any) {
      setError(e?.message || 'ذخیره انجام نشد.');
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!indicator || !window.confirm('این شاخص برای همیشه حذف شود؟ پرسشنامه‌های شروع‌شده همچنان آن را نگه می‌دارند.')) return;
    setBusy(true);
    try {
      await onDelete(indicator.id);
      onClose();
    } catch (e: any) {
      setError(e?.message || 'حذف انجام نشد.');
      setBusy(false);
    }
  };

  return (
    <div className="ie-backdrop" role="dialog" aria-modal="true" aria-labelledby="ie-title" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ie-dialog ie-dialog--wide">
        <header className="ie-head">
          <div>
            <h3 id="ie-title" className="ie-title">
              {editing && <span className="indicator-code-badge">{indicator!.code}</span>}
              {editing ? 'ویرایش شاخص افزوده‌شده' : 'افزودن شاخص جدید'}
            </h3>
            <p className="ie-sub">شاخص تازه کنار موضوع خودش قرار می‌گیرد و در پرسشنامه‌های بعدی پرسیده می‌شود.</p>
          </div>
          <button type="button" className="ie-close" onClick={onClose} aria-label="بستن">
            <X size={18} />
          </button>
        </header>

        <div className="ie-grid">
          <label className="ie-field">
            <span className="ie-label">نوع ارزیابی</span>
            <select className="ie-input" value={template} onChange={(e) => changeTemplate(e.target.value as 'STORE' | 'MALL')} disabled={editing}>
              <option value="STORE">فروشگاه</option>
              <option value="MALL">مرکز خرید</option>
            </select>
          </label>
          <label className="ie-field">
            <span className="ie-label">{template === 'STORE' ? 'منطقه' : 'گروه'}</span>
            {template === 'STORE' ? (
              <select className="ie-input" value={group} onChange={(e) => setGroup(e.target.value)}>
                {ZONES.map((z) => <option key={z} value={z}>{groupLabel(z)}</option>)}
              </select>
            ) : (
              <>
                <input className="ie-input" list="ie-mall-groups" value={group} onChange={(e) => setGroup(e.target.value)} />
                <datalist id="ie-mall-groups">{mallGroups.map((g) => <option key={g} value={g} />)}</datalist>
              </>
            )}
          </label>
          <label className="ie-field">
            <span className="ie-label">موضوع</span>
            <input className="ie-input" list="ie-topics" value={subject} maxLength={120} onChange={(e) => setSubject(e.target.value)} placeholder="یکی از موضوع‌ها یا موضوع تازه" />
            <datalist id="ie-topics">{topics.map((t) => <option key={t} value={t} />)}</datalist>
          </label>
          <label className="ie-field">
            <span className="ie-label">کد شاخص (اختیاری)</span>
            <input className="ie-input ltr-num" dir="ltr" value={code} maxLength={20} onChange={(e) => setCode(e.target.value)} placeholder="خالی = خودکار (U001، U002 …)" />
          </label>
        </div>

        <label className="ie-field">
          <span className="ie-label">متن شاخص</span>
          <textarea className="ie-input" rows={3} value={statement} maxLength={MAX_STATEMENT} onChange={(e) => setStatement(e.target.value)} />
        </label>
        <label className="ie-field">
          <span className="ie-label">نکته برای ارزیاب (اختیاری)</span>
          <textarea className="ie-input" rows={2} value={note} maxLength={MAX_NOTE} onChange={(e) => setNote(e.target.value)} />
        </label>

        <fieldset className="ie-set">
          <legend className="ie-label">
            {template === 'STORE' ? 'سکتورهای مشمول' : 'انواع مرکز خرید مشمول'}
            <button
              type="button"
              className="ie-link"
              onClick={() =>
                template === 'STORE'
                  ? setSectors(sectors.length === SECTORS.length ? [] : SECTORS)
                  : setMallTypes(mallTypes.length === MALL_TYPES.length ? [] : MALL_TYPES)
              }
            >
              {(template === 'STORE' ? sectors.length === SECTORS.length : mallTypes.length === MALL_TYPES.length) ? 'برداشتن همه' : 'انتخاب همه'}
            </button>
          </legend>
          <div className="ie-checks">
            {(template === 'STORE' ? SECTORS : MALL_TYPES).map((v) => {
              const list = template === 'STORE' ? sectors : mallTypes;
              return (
                <label key={v} className="ie-check">
                  <input
                    type="checkbox"
                    checked={list.includes(v)}
                    onChange={() => toggle(list, template === 'STORE' ? setSectors : setMallTypes, v)}
                  />
                  <span>{profileLabel(v)}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="ie-grid">
          <label className="ie-check">
            <input type="checkbox" checked={photo} onChange={(e) => setPhoto(e.target.checked)} />
            <span>ثبت عکس الزامی باشد</span>
          </label>
          <label className="ie-check">
            <input type="checkbox" checked={comment} onChange={(e) => setComment(e.target.checked)} />
            <span>توضیح الزامی باشد</span>
          </label>
          <label className="ie-field">
            <span className="ie-label">وزن (۰٫۵ تا ۵)</span>
            <input className="ie-input ltr-num" dir="ltr" type="number" step="0.5" min="0.5" max="5" value={weight} onChange={(e) => setWeight(e.target.value)} />
          </label>
          <label className="ie-check">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            <span>فعال (در پرسشنامه پرسیده شود)</span>
          </label>
        </div>

        {(error || (problem && statement.length + subject.length > 0)) && (
          <div className="auth-error" role="alert">{error || problem}</div>
        )}

        <footer className="ie-foot">
          {editing ? (
            <button type="button" className="btn-secondary" disabled={busy} onClick={remove}>حذف شاخص</button>
          ) : <span />}
          <div className="ie-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>انصراف</button>
            <button type="button" className="btn-primary" disabled={busy || !!problem} onClick={submit}>
              {editing ? 'ذخیره' : 'افزودن شاخص'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};

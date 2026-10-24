import React, { useMemo, useRef, useState } from 'react';
import { Download, FileSpreadsheet, Pencil, Trash2, Upload, X } from 'lucide-react';
import type { Indicator } from '../types';
import { IndicatorService, type CustomIndicatorInput } from '../services/indicatorService';
import { downloadWorkbook, evaluateDrafts, inspectWorkbook, parseWorkbook, type Draft, type ImportOptions, type PlanAction, type PlanRow, type WorkbookInfo } from '../services/indicatorExcel';
import { faDigits, groupLabel, profileLabel } from '../utils/format';
import { IndicatorForm } from './IndicatorEditor';

const LABEL: Record<PlanAction, string> = {
  create: 'جدید',
  update: 'ویرایش',
  'update-file': 'ویرایش شاخص فایل',
  same: 'بدون تغییر',
  error: 'خطا',
};

interface Props {
  indicators: Indicator[];
  canEdit: boolean;
  /** Called after changes were saved so the bank reloads from the server. */
  onChanged: () => Promise<void>;
  onClose: () => void;
}

const noop = async () => {};

const SECTORS = [
  'Fashion', 'Shoe_Bag', 'Watch_Jewelry', 'FMCG', 'F_B', 'Hardware', 'Homeware',
  'Beauty_Cosmetics', 'Electronics', 'Entertainment', 'Sports', 'Specialty', 'Services',
];
const MALL_TYPES = ['SM', 'Neighborhood', 'Community', 'Regional', 'Super_Regional'];

/** The row as an indicator, so the same form that adds an indicator by hand can edit it. */
function draftAsIndicator(d: Draft): Indicator {
  return {
    id: d.key, code: d.code, template: d.template, group: d.group, subject: d.subject, journeyStage: '', reportingDimension: '',
    originalText: d.statement, statement: d.statement, status: d.active ? 'ACTIVE' : 'ARCHIVED', version: 1, weight: 1,
    requiresPhoto: d.photo, requiresComment: d.comment, displayOrder: 0,
    applicableBusinessTypes: d.template === 'STORE' ? d.scope : [], applicableMallTypes: d.template === 'MALL' ? d.scope : [],
    auditorNote: d.note || undefined,
  } as Indicator;
}

/**
 * Download the indicators or an empty template as Excel, and upload a sheet.
 * An uploaded sheet is first shown as a list: every row can be ticked or
 * unticked, edited like an indicator added by hand (topic, group, sectors,
 * wording, note, …) or removed, and only then saved.
 */
export const IndicatorExcel: React.FC<Props> = ({ indicators, canEdit, onChanged, onClose }) => {
  const input = useRef<HTMLInputElement>(null);
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [showSame, setShowSame] = useState(false);
  // The file waits here until the person says which sector it is for.
  const [pending, setPending] = useState<{ file: File; info: WorkbookInfo } | null>(null);
  const [mode, setMode] = useState<'chosen' | 'columns'>('chosen');
  const [sectors, setSectors] = useState<string[]>([]);
  const [mallTypes, setMallTypes] = useState<string[]>([]);

  const guard = async (job: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await job();
    } catch (e: any) {
      setError(e?.message || 'انجام نشد.');
    } finally {
      setBusy(false);
    }
  };

  const plan: PlanRow[] = useMemo(() => (drafts ? evaluateDrafts(drafts, indicators) : []), [drafts, indicators]);
  const planByKey = useMemo(() => new Map(plan.map((p) => [p.key, p])), [plan]);
  const included = (d: Draft) => d.include && planByKey.get(d.key)?.action !== 'same';
  const saveable = drafts ? drafts.filter((d) => d.include && ['create', 'update', 'update-file'].includes(planByKey.get(d.key)?.action || '')) : [];
  const count = (a: PlanAction) => plan.filter((p) => p.action === a).length;

  const patch = (key: string, change: Partial<Draft>) => setDrafts((prev) => prev && prev.map((d) => (d.key === key ? { ...d, ...change } : d)));

  const onFile = (file: File | undefined) => {
    if (!file) return;
    setResult(null);
    setDrafts(null);
    setNotes([]);
    setFileName(file.name);
    setPending(null);
    guard(async () => {
      const info = await inspectWorkbook(file);
      // One sector column in the file is the sector it is for; several columns are decided by their X marks.
      setMode(info.sectors.length > 1 || info.mallTypes.length > 1 ? 'columns' : 'chosen');
      setSectors(info.sectors.length === 1 ? info.sectors : []);
      setMallTypes(info.mallTypes.length === 1 ? info.mallTypes : []);
      setPending({ file, info });
    });
  };

  const readFile = () =>
    guard(async () => {
      if (!pending) return;
      const options: ImportOptions = { mode, sectors, mallTypes };
      const parsed = await parseWorkbook(pending.file, indicators, options);
      setDrafts(parsed.drafts);
      setNotes(parsed.notes);
      setPending(null);
    });

  const toggleIn = (list: string[], set: (v: string[]) => void, v: string) => set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const canRead =
    !!pending && (mode === 'columns' || ((!pending.info.hasStore || sectors.length > 0) && (!pending.info.hasMall || mallTypes.length > 0)));

  const apply = () =>
    guard(async () => {
      let done = 0;
      const failed: string[] = [];
      for (const d of saveable) {
        const row = planByKey.get(d.key)!;
        try {
          if (row.action === 'create' && row.input) await IndicatorService.createCustom(row.input);
          else if (row.action === 'update' && row.target && row.input) await IndicatorService.updateCustom(row.target.id, row.input);
          else if (row.action === 'update-file' && row.target && row.fileEdit) await IndicatorService.save(row.target.id, row.fileEdit);
          else continue;
          done += 1;
        } catch (e: any) {
          failed.push(`ردیف ${faDigits(row.line)}: ${e?.message || 'ذخیره نشد'}`);
        }
      }
      await onChanged();
      setDrafts(null);
      setResult(`${faDigits(done)} ردیف ذخیره شد.${failed.length ? ` ${faDigits(failed.length)} ردیف ذخیره نشد: ${failed.join(' | ')}` : ''}`);
    });

  const editingDraft = drafts?.find((d) => d.key === editing);
  const editingTarget = editingDraft ? planByKey.get(editingDraft.key)?.target : undefined;
  const visible = drafts ? drafts.filter((d) => showSame || planByKey.get(d.key)?.action !== 'same') : [];
  const allTicked = visible.length > 0 && visible.every((d) => d.include);

  return (
    <div className="ie-backdrop" role="dialog" aria-modal="true" aria-labelledby="xl-title" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ie-dialog ie-dialog--wide ie-dialog--xl">
        <header className="ie-head">
          <div>
            <h3 id="xl-title" className="ie-title"><FileSpreadsheet size={20} />مدیریت شاخص‌ها با اکسل</h3>
            <p className="ie-sub">شاخص‌ها را دانلود کنید، در اکسل ویرایش یا اضافه کنید و بارگذاری کنید. پیش از ذخیره می‌توانید هر ردیف را انتخاب، ویرایش یا حذف کنید.</p>
          </div>
          <button type="button" className="ie-close" onClick={onClose} aria-label="بستن"><X size={18} /></button>
        </header>

        <div className="xl-drop">
          <strong>۱. دانلود</strong>
          <div className="ie-actions" style={{ flexWrap: 'wrap' }}>
            <button type="button" className="btn-secondary" disabled={busy} onClick={() => guard(() => downloadWorkbook(indicators, 'all'))}>
              <Download size={15} /><span>همهٔ شاخص‌ها ({faDigits(indicators.filter((i) => !i.disabled).length)} فعال)</span>
            </button>
            <button type="button" className="btn-secondary" disabled={busy} onClick={() => guard(() => downloadWorkbook(indicators, 'template'))}>
              <Download size={15} /><span>قالب خالی برای شاخص جدید</span>
            </button>
          </div>
          <p className="ie-hint">
            قالب همان قالب نیماست: گروه، کد، موضوع، KPI و یک ستون X برای هر سکتور (برگهٔ «فروشگاه») یا نوع مرکز خرید (برگهٔ «مرکز خرید»). ردیف بدون کد یا با کد تازه شاخص جدید می‌شود. برای شاخص‌های فایل چک‌لیست فقط KPI، نکته و فعال/غیرفعال تغییر می‌کند.
          </p>
        </div>

        {canEdit && (
          <div className="xl-drop">
            <strong>۲. بارگذاری</strong>
            <input ref={input} type="file" accept=".xlsx" hidden onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
            <div className="ie-actions">
              <button type="button" className="btn-secondary" disabled={busy} onClick={() => input.current?.click()}>
                <Upload size={15} /><span>انتخاب فایل اکسل (.xlsx)</span>
              </button>
              {fileName && <span className="ie-hint">{fileName}</span>}
            </div>
            <p className="ie-hint">پیش از ذخیره، فهرست ردیف‌ها را می‌بینید؛ چیزی تا تأیید شما ذخیره نمی‌شود.</p>
          </div>
        )}

        {pending && (
          <div className="xl-drop" role="group" aria-label="سکتور فایل">
            <strong>۳. این فایل برای کدام سکتور است؟</strong>
            <p className="ie-hint">
              شاخص‌های این فایل فقط برای سکتور انتخاب‌شده پرسیده می‌شوند. {pending.info.notes > 0 && `${faDigits(pending.info.notes)} شاخص نکته (Note) اکسل دارند و نکته‌شان به‌عنوان «نکته برای ارزیاب» وارد می‌شود.`}
            </p>
            {pending.info.sectors.length > 0 && (
              <>
                <label className="ie-check"><input type="radio" name="xl-mode" checked={mode === 'chosen'} onChange={() => setMode('chosen')} /><span>همهٔ ردیف‌ها برای سکتورهای انتخاب‌شده</span></label>
                <label className="ie-check"><input type="radio" name="xl-mode" checked={mode === 'columns'} onChange={() => setMode('columns')} /><span>طبق علامت X در ستون‌های سکتور فایل ({pending.info.sectors.map(profileLabel).join('، ')})</span></label>
              </>
            )}
            {mode === 'chosen' && pending.info.hasStore && (
              <fieldset className="ie-set">
                <legend className="ie-label">سکتور فروشگاه</legend>
                <div className="ie-checks">
                  {SECTORS.map((v) => (
                    <label key={v} className="ie-check"><input type="checkbox" checked={sectors.includes(v)} onChange={() => toggleIn(sectors, setSectors, v)} /><span>{profileLabel(v)}</span></label>
                  ))}
                </div>
              </fieldset>
            )}
            {mode === 'chosen' && pending.info.hasMall && (
              <fieldset className="ie-set">
                <legend className="ie-label">نوع مرکز خرید</legend>
                <div className="ie-checks">
                  {MALL_TYPES.map((v) => (
                    <label key={v} className="ie-check"><input type="checkbox" checked={mallTypes.includes(v)} onChange={() => toggleIn(mallTypes, setMallTypes, v)} /><span>{profileLabel(v)}</span></label>
                  ))}
                </div>
              </fieldset>
            )}
            <div className="ie-actions">
              <button type="button" className="btn-primary" disabled={busy || !canRead} onClick={readFile}>ادامه و نمایش ردیف‌ها</button>
            </div>
          </div>
        )}

        {drafts && (
          <>
            {notes.map((n) => <div key={n} className="auth-error" role="note">{n}</div>)}
            <div className="xl-summary">
              {(['create', 'update', 'update-file', 'same', 'error'] as PlanAction[]).map((a) => (
                <span key={a} className={`ie-chip${a === 'error' && count('error') ? ' xl-err' : ''}`}>{LABEL[a]}: {faDigits(count(a))}</span>
              ))}
              <label className="ie-check" style={{ marginInlineStart: 'auto' }}>
                <input type="checkbox" checked={showSame} onChange={(e) => setShowSame(e.target.checked)} />
                <span>نمایش ردیف‌های بدون تغییر</span>
              </label>
            </div>
            <div className="xl-list xl-list--tall">
              <table>
                <thead>
                  <tr>
                    <th>
                      <input
                        type="checkbox"
                        aria-label="انتخاب همه"
                        checked={allTicked}
                        onChange={(e) => setDrafts((prev) => prev && prev.map((d) => (visible.some((v) => v.key === d.key) ? { ...d, include: e.target.checked } : d)))}
                      />
                    </th>
                    <th>ردیف</th><th>کد</th><th>وضعیت</th><th>گروه / موضوع</th><th>متن شاخص</th><th />
                  </tr>
                </thead>
                <tbody>
                  {visible.map((d) => {
                    const row = planByKey.get(d.key)!;
                    return (
                      <tr key={d.key} className={d.include ? '' : 'xl-off'}>
                        <td><input type="checkbox" aria-label="ذخیره این ردیف" checked={d.include} onChange={(e) => patch(d.key, { include: e.target.checked })} /></td>
                        <td>{row.sheet ? `${row.sheet} · ` : ''}{faDigits(row.line)}</td>
                        <td dir="ltr">{row.target?.code || d.code || '—'}</td>
                        <td className={row.action === 'error' ? 'xl-err' : ''}>
                          {LABEL[row.action]}
                          {row.action === 'error' && <div className="ie-hint xl-err">{row.error}</div>}
                          {row.changes.length > 0 && row.action !== 'create' && row.action !== 'error' && <div className="ie-hint">{row.changes.join('، ')}</div>}
                        </td>
                        <td>
                          {d.template === 'STORE' ? groupLabel(row.target?.group || d.group) : row.target?.group || d.group}
                          <div className="ie-hint">{row.target?.subject || d.subject}</div>
                        </td>
                        <td>{(row.fileEdit?.statement ?? row.input?.statement ?? d.statement).slice(0, 110)}</td>
                        <td className="xl-actions">
                          <button type="button" className="btn-secondary" title="ویرایش ردیف" aria-label="ویرایش ردیف" onClick={() => setEditing(d.key)}><Pencil size={14} /></button>
                          <button type="button" className="btn-secondary" title="حذف ردیف از فهرست" aria-label="حذف ردیف از فهرست" onClick={() => setDrafts((prev) => prev && prev.filter((x) => x.key !== d.key))}><Trash2 size={14} /></button>
                        </td>
                      </tr>
                    );
                  })}
                  {!visible.length && <tr><td colSpan={7} className="ie-hint">ردیفی برای نمایش نیست.</td></tr>}
                </tbody>
              </table>
            </div>
            {count('error') > 0 && <p className="ie-hint">ردیف‌های دارای خطا ذخیره نمی‌شوند؛ با دکمهٔ ویرایش اصلاحشان کنید یا حذفشان کنید.</p>}
          </>
        )}

        {error && <div className="auth-error" role="alert">{error}</div>}
        {result && <div className="ie-info" role="status">{result}</div>}

        <footer className="ie-foot">
          <span />
          <div className="ie-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>بستن</button>
            {drafts && (
              <button type="button" className="btn-primary" disabled={busy || !saveable.length} onClick={apply}>
                ذخیرهٔ {faDigits(saveable.length)} ردیف
              </button>
            )}
          </div>
        </footer>
      </div>

      {editingDraft && (
        <IndicatorForm
          key={editingDraft.key}
          indicator={draftAsIndicator(editingDraft)}
          all={indicators}
          fileRow={!!editingTarget && !editingTarget.custom}
          onCreate={noop}
          onUpdate={noop}
          onDelete={noop}
          onClose={() => setEditing(null)}
          onDraft={(v: CustomIndicatorInput) => {
            patch(editingDraft.key, {
              ...(editingTarget ? {} : { template: v.template ?? editingDraft.template }),
              group: v.group ?? editingDraft.group,
              subject: v.subject ?? editingDraft.subject,
              code: v.code ?? '',
              targetId: v.code && v.code !== editingDraft.code ? undefined : editingDraft.targetId,
              statement: v.statement ?? '',
              note: v.auditorNote ?? '',
              scope: (v.template === 'MALL' ? v.applicableMallTypes : v.applicableBusinessTypes) ?? editingDraft.scope,
              photo: !!v.requiresPhoto,
              comment: !!v.requiresComment,
              active: v.status !== 'ARCHIVED',
              readError: undefined,
              include: true,
            });
            setEditing(null);
          }}
        />
      )}
    </div>
  );
};

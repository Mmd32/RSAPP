import React, { useRef, useState } from 'react';
import { Download, FileSpreadsheet, Upload, X } from 'lucide-react';
import type { Indicator } from '../types';
import { IndicatorService } from '../services/indicatorService';
import { downloadWorkbook, planImport, type Plan, type PlanAction } from '../services/indicatorExcel';
import { faDigits } from '../utils/format';

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

/** Download the indicators or an empty template as Excel, and upload an edited sheet to add and change many at once. */
export const IndicatorExcel: React.FC<Props> = ({ indicators, canEdit, onChanged, onClose }) => {
  const input = useRef<HTMLInputElement>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

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

  const onFile = (file: File | undefined) => {
    if (!file) return;
    setResult(null);
    setPlan(null);
    setFileName(file.name);
    guard(async () => setPlan(await planImport(file, indicators)));
  };

  const apply = () =>
    guard(async () => {
      if (!plan) return;
      let done = 0;
      const failed: string[] = [];
      for (const row of plan.rows) {
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
      setPlan(null);
      setResult(`${faDigits(done)} ردیف ذخیره شد.${failed.length ? ` ${faDigits(failed.length)} ردیف ذخیره نشد: ${failed.join(' | ')}` : ''}`);
    });

  const writable = plan ? plan.count.create + plan.count.update + plan.count['update-file'] : 0;

  return (
    <div className="ie-backdrop" role="dialog" aria-modal="true" aria-labelledby="xl-title" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ie-dialog ie-dialog--wide">
        <header className="ie-head">
          <div>
            <h3 id="xl-title" className="ie-title"><FileSpreadsheet size={20} />مدیریت شاخص‌ها با اکسل</h3>
            <p className="ie-sub">شاخص‌ها را دانلود کنید، در اکسل ویرایش یا اضافه کنید و دوباره بارگذاری کنید.</p>
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
            <p className="ie-hint">پیش از ذخیره، فهرست تغییرات را می‌بینید و چیزی تا تأیید شما ذخیره نمی‌شود.</p>
          </div>
        )}

        {plan && (
          <>
            <div className="xl-summary">
              {(['create', 'update', 'update-file', 'same', 'error'] as PlanAction[]).map((a) => (
                <span key={a} className={`ie-chip${a === 'error' && plan.count.error ? ' xl-err' : ''}`}>{LABEL[a]}: {faDigits(plan.count[a])}</span>
              ))}
            </div>
            <div className="xl-list">
              <table>
                <thead><tr><th>ردیف</th><th>کد</th><th>وضعیت</th><th>متن / توضیح</th></tr></thead>
                <tbody>
                  {plan.rows.filter((r) => r.action !== 'same').map((r) => (
                    <tr key={r.line}>
                      <td>{r.sheet ? `${r.sheet} · ` : ''}{faDigits(r.line)}</td>
                      <td dir="ltr">{r.code || '—'}</td>
                      <td className={r.action === 'error' ? 'xl-err' : ''}>{LABEL[r.action]}</td>
                      <td>{r.action === 'error' ? r.error : <>{r.statement.slice(0, 80)} <span className="ie-hint">{r.changes.join('، ')}</span></>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {plan.count.error > 0 && <p className="ie-hint">ردیف‌های دارای خطا ذخیره نمی‌شوند؛ می‌توانید فایل را اصلاح و دوباره بارگذاری کنید.</p>}
          </>
        )}

        {error && <div className="auth-error" role="alert">{error}</div>}
        {result && <div className="ie-info" role="status">{result}</div>}

        <footer className="ie-foot">
          <span />
          <div className="ie-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>بستن</button>
            {plan && (
              <button type="button" className="btn-primary" disabled={busy || !writable} onClick={apply}>
                ذخیرهٔ {faDigits(writable)} تغییر
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
};

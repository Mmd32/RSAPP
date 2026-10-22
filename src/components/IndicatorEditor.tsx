import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, RotateCcw, X } from 'lucide-react';
import type { Indicator } from '../types';
import type { IndicatorEdit } from '../services/indicatorService';
import { faDigits, groupLabel } from '../utils/format';

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

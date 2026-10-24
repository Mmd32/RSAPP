import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import type { VisitSession } from '../types';
import { computeStoreFrictionRate } from '../engine/frModel';
import { faDigits } from '../utils/format';
import { faRate } from './FrictionRateReport';

interface Props {
  visit: VisitSession;
  /** The person can see reports / review questionnaires. */
  canReport: boolean;
  canReview: boolean;
  canStart: boolean;
  onReport: () => void;
  onReview: () => void;
  onNewVisit: () => void;
  onArchive: () => void;
}

/** What the evaluator sees right after sending: it arrived, who gets it, what is next. */
export const SubmitDone: React.FC<Props> = ({ visit, canReport, canReview, canStart, onReport, onReview, onNewVisit, onArchive }) => {
  const rate = computeStoreFrictionRate(visit.indicators, visit.responses);
  const answered = Object.values(visit.responses || {}).filter((r) => r.answerState && r.answerState !== 'UNANSWERED').length;
  return (
    <div className="page" style={{ maxWidth: 640, margin: '32px auto' }}>
      <section className="fr-card submit-done" aria-live="polite">
        <div className="submit-done__icon"><CheckCircle2 size={44} /></div>
        <h2 className="fr-card__title" style={{ textAlign: 'center' }}>پرسشنامه برای مدیر ارسال شد</h2>
        <p className="fr-card__subtitle" style={{ textAlign: 'center' }}>
          {visit.brandName} — {visit.branchName}
        </p>
        <dl className="submit-done__stats">
          <div><dt>شاخص پاسخ‌داده‌شده</dt><dd>{faDigits(answered)} از {faDigits(visit.indicators.length)}</dd></div>
          <div><dt>اصطکاک ثبت‌شده</dt><dd>{faDigits(rate.total.frictions)}</dd></div>
          <div><dt>نرخ اصطکاک فروشگاه</dt><dd>{faRate(rate.total.rate)}</dd></div>
        </dl>
        <p className="ie-info">
          مدیر و سرپرست گزارش این بازدید را از همین حالا در بخش گزارش‌ها می‌بینند و سرپرست آن را بررسی و تأیید می‌کند. اگر نکته‌ای داشته باشد، پرسشنامه برای اصلاح به شما برمی‌گردد و در بایگانی می‌بینید.
        </p>
        <div className="ie-actions" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
          {canReview && <button type="button" className="btn-primary" onClick={onReview}>بررسی و تأیید</button>}
          {canReport && <button type="button" className={canReview ? 'btn-secondary' : 'btn-primary'} onClick={onReport}>مشاهدهٔ گزارش</button>}
          {canStart && <button type="button" className="btn-secondary" onClick={onNewVisit}>بازدید جدید</button>}
          <button type="button" className="btn-secondary" onClick={onArchive}>بایگانی بازدیدها</button>
        </div>
      </section>
    </div>
  );
};

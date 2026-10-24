import React from 'react';
import { Inbox } from 'lucide-react';
import type { VisitSession } from '../types';
import { faDate, faDigits } from '../utils/format';

/** The supervisor's inbox: questionnaires sent for review, oldest first. */
export const ReviewQueue: React.FC<{
  visits: VisitSession[];
  isLoading?: boolean;
  onOpen: (visit: VisitSession) => void;
  /** Opens the report of a questionnaire without reviewing it. */
  onReport?: (visit: VisitSession) => void;
}> = ({ visits, isLoading, onOpen, onReport }) => {
  const queue = visits
    .filter((v) => v.status === 'SUBMITTED')
    .sort((a, b) => (a.completedAt || a.startedAt || '').localeCompare(b.completedAt || b.startedAt || ''));

  return (
    <div className="home">
      <header className="home-head">
        <div>
          <p className="home-eyebrow">کارتابل سرپرست</p>
          <h1 className="home-title">
            {queue.length ? `${faDigits(queue.length)} پرسشنامه در انتظار بررسی` : 'پرسشنامه‌ای در انتظار بررسی نیست'}
          </h1>
        </div>
      </header>
      <section className="home-panel" aria-label="پرسشنامه‌های در انتظار بررسی">
        {queue.length ? (
          <ul className="recent">
            {queue.map((v) => {
              const frictions = Object.values(v.responses || {}).filter((r) => r.answerState === 'FRICTION').length;
              return (
                <li key={v.id}>
                  <div className="recent__row" style={{ cursor: 'default' }}>
                    <span className="recent__main">
                      <span className="recent__name">
                        {v.brandName} — {v.branchName}
                      </span>
                      <span className="recent__meta">
                        ارسال {faDate(v.completedAt || v.startedAt)}
                        {v.auditorName ? ` · ${v.auditorName}` : ''}
                        {v.evaluatorCode ? ` (${v.evaluatorCode})` : ''} · {faDigits(frictions)} اصطکاک ثبت‌شده
                      </span>
                    </span>
                    <span className="ie-actions">
                      {onReport && <button type="button" className="btn-secondary" style={{ minHeight: 32 }} onClick={() => onReport(v)}>گزارش</button>}
                      <button type="button" className="btn-primary" style={{ minHeight: 32 }} onClick={() => onOpen(v)}>بررسی و تأیید</button>
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="home-empty" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Inbox size={18} />
            {isLoading ? 'در حال بارگذاری…' : 'همه‌ی پرسشنامه‌های ارسال‌شده بررسی شده‌اند. پرسشنامه‌های تازه بعد از ارسال ارزیاب اینجا می‌آیند.'}
          </p>
        )}
      </section>
    </div>
  );
};

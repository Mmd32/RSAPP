import React from 'react';
import { BarChart3 } from 'lucide-react';

/** Shown instead of a report while no questionnaire has been sent yet. */
export const ReportEmpty: React.FC<{ canStart: boolean; onStart: () => void }> = ({ canStart, onStart }) => (
  <div className="home">
    <header className="home-head">
      <div>
        <p className="home-eyebrow">گزارش فروشگاه</p>
        <h1 className="home-title">هنوز گزارشی وجود ندارد</h1>
      </div>
    </header>
    <section className="home-panel">
      <p className="home-empty" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: canStart ? 16 : 0 }}>
        <BarChart3 size={18} />
        گزارش بعد از ارسال اولین پرسشنامه همین‌جا ساخته می‌شود.
      </p>
      {canStart && (
        <button type="button" className="btn-primary" onClick={onStart} style={{ minHeight: 42, padding: '0 18px' }}>
          شروع ارزیابی
        </button>
      )}
    </section>
  </div>
);

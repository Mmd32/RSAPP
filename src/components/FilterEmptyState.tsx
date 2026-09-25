import React from 'react';
import { CheckCircle2, SearchX } from 'lucide-react';

interface FilterEmptyStateProps {
  filter: 'ALL' | 'MISSING' | 'FRICTION' | 'FLAGGED';
  onShowAll: () => void;
  onReview: () => void;
}

/**
 * Shown in place of the question card when the current filter or search
 * matches nothing. Falling back to question 1 instead invited taps that
 * silently overwrote an answer the evaluator had already given.
 */
export const FilterEmptyState: React.FC<FilterEmptyStateProps> = ({ filter, onShowAll, onReview }) => {
  const allAnswered = filter === 'MISSING';
  return (
    <div className="card-rs" style={{ padding: 28, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      {allAnswered ? (
        <CheckCircle2 size={40} color="var(--friction-clean)" />
      ) : (
        <SearchX size={40} color="var(--theme-text-muted)" />
      )}
      <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--theme-text-primary)' }}>
        {allAnswered ? 'همهٔ سؤال‌ها پاسخ داده شده‌اند' : 'موردی با این فیلتر پیدا نشد'}
      </h3>
      <p style={{ fontSize: 13, color: 'var(--theme-text-secondary)', maxWidth: 360 }}>
        {allAnswered
          ? 'می‌توانید پاسخ‌ها را در «کنترل کیفیت» مرور کنید و برای سرپرست بفرستید.'
          : 'فیلتر یا عبارت جستجو را تغییر دهید تا سؤال‌ها دوباره نمایش داده شوند.'}
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
        {allAnswered && (
          <button type="button" className="btn-primary" onClick={onReview}>
            مرور و کنترل کیفیت
          </button>
        )}
        <button type="button" className="btn-secondary" onClick={onShowAll}>
          نمایش همهٔ سؤال‌ها
        </button>
      </div>
    </div>
  );
};

import React from 'react';
import { Indicator, QuestionResponse } from '../types';
import { calculateVisitSummary } from '../engine/scoringEngine';
import { AlertCircle, CheckCircle2, AlertTriangle, ArrowRight, Send, Camera, FileText } from 'lucide-react';

interface ReviewScreenProps {
  indicators: Indicator[];
  responses: Record<string, QuestionResponse>;
  onJumpToQuestion: (index: number) => void;
  onBackToAudit: () => void;
  onSubmitVisit: () => void;
  assessmentType: 'STORE' | 'MALL';
}

export const ReviewScreen: React.FC<ReviewScreenProps> = ({
  indicators,
  responses,
  onJumpToQuestion,
  onBackToAudit,
  onSubmitVisit,
  assessmentType,
}) => {
  const [showConfirmModal, setShowConfirmModal] = React.useState(false);
  const summary = calculateVisitSummary(indicators, responses, assessmentType);

  // Calculate detailed counts
  const totalQuestions = indicators.length;
  const answeredCount = Object.values(responses).filter((r) => r.answerState !== 'UNANSWERED').length;
  const missingCount = totalQuestions - answeredCount;
  const naCount = Object.values(responses).filter((r) => r.answerState === 'NOT_APPLICABLE').length;
  const frictionCount = Object.values(responses).filter((r) => r.answerState === 'FRICTION').length;
  const highCount = Object.values(responses).filter((r) => r.answerState === 'FRICTION' && r.severity === 'HIGH').length;
  const criticalCount = Object.values(responses).filter((r) => r.answerState === 'FRICTION' && r.severity === 'CRITICAL').length;
  const totalPhotos = Object.values(responses).reduce((sum, r) => sum + (r.photos?.length || 0), 0);
  const flagCount = Object.values(responses).filter((r) => r.isFlagged).length;
  const completionPercent = totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0;

  // Validation Problems detection (نیازمند تکمیل)
  const validationProblems: { indicator: Indicator; index: number; code: string; problemText: string }[] = [];

  indicators.forEach((ind, idx) => {
    const resp = responses[ind.id];
    if (!resp || resp.answerState === 'UNANSWERED') {
      validationProblems.push({
        indicator: ind,
        index: idx,
        code: ind.code,
        problemText: `${ind.code} — بدون پاسخ`,
      });
    } else if (resp.answerState === 'FRICTION') {
      if (ind.requiresPhoto && (!resp.photos || resp.photos.length === 0)) {
        validationProblems.push({
          indicator: ind,
          index: idx,
          code: ind.code,
          problemText: `${ind.code} — عکس ندارد`,
        });
      }
      if (ind.requiresComment && (!resp.comment || resp.comment.trim() === '')) {
        validationProblems.push({
          indicator: ind,
          index: idx,
          code: ind.code,
          problemText: `${ind.code} — توضیح الزامی`,
        });
      }
    }
  });

  const canSubmit = validationProblems.length === 0;

  const handleConfirmSubmit = () => {
    setShowConfirmModal(false);
    onSubmitVisit();
  };

  return (
    <div style={{ maxWidth: 680, margin: '20px auto', padding: '0 16px 40px' }}>
      <div className="glass-panel" style={{ padding: 24 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700 }}>مرور و کنترل کیفیت چک‌لیست</h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              بررسی پوشش ارزیابی، اصطکاک‌ها و اعتبارسنجی الزامات قبل از ارسال به سرپرست
            </p>
          </div>
          <button type="button" className="btn-secondary" onClick={onBackToAudit} style={{ padding: '6px 12px' }}>
            <ArrowRight size={16} />
            <span>ادامه ارزیابی</span>
          </button>
        </div>

        {/* Overall Completion Progress */}
        <div style={{ background: 'var(--bg-input)', padding: 16, borderRadius: 'var(--rs-radius-card)', marginBottom: 20, border: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-main)' }}>درصد تکمیل کل (Overall Completion):</span>
            <span className="ltr-num" style={{ fontSize: 18, fontWeight: 800, color: completionPercent === 100 ? 'var(--rs-color-success)' : 'var(--rs-color-brand-cyan)' }}>
              {completionPercent}%
            </span>
          </div>
          <div className="progress-bar-bg" style={{ height: 10 }}>
            <div
              className="progress-bar-fill"
              style={{
                width: `${completionPercent}%`,
                background: completionPercent === 100 ? 'var(--rs-color-success)' : 'var(--rs-color-brand-cyan)',
              }}
            />
          </div>
        </div>

        {/* 9 Metrics Grid (Section 23 Requirements) */}
        <div className="metric-card-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
          <div className="metric-card">
            <span className="metric-label">پاسخ‌داده‌شده (Answered)</span>
            <div className="metric-value" style={{ color: 'var(--rs-color-success)' }}>{answeredCount}</div>
          </div>
          <div className="metric-card">
            <span className="metric-label">بی‌پاسخ (Missing)</span>
            <div className="metric-value" style={{ color: missingCount > 0 ? 'var(--rs-color-error)' : 'var(--text-dim)' }}>
              {missingCount}
            </div>
          </div>
          <div className="metric-card">
            <span className="metric-label">غیرقابل بررسی (N/A)</span>
            <div className="metric-value" style={{ color: 'var(--text-muted)' }}>{naCount}</div>
          </div>
          <div className="metric-card">
            <span className="metric-label">اصطکاک‌ها (Friction)</span>
            <div className="metric-value" style={{ color: 'var(--rs-color-error)' }}>{frictionCount}</div>
          </div>
          <div className="metric-card">
            <span className="metric-label">موارد شدید (High)</span>
            <div className="metric-value" style={{ color: '#EA580C' }}>{highCount}</div>
          </div>
          <div className="metric-card">
            <span className="metric-label">موارد بحرانی (Critical)</span>
            <div className="metric-value" style={{ color: 'var(--rs-color-error)' }}>{criticalCount}</div>
          </div>
          <div className="metric-card">
            <span className="metric-label">مدارک تصویری (Evidence)</span>
            <div className="metric-value" style={{ color: 'var(--rs-color-brand-cyan)' }}>{totalPhotos}</div>
          </div>
          <div className="metric-card">
            <span className="metric-label">نشانه‌دارها (Flags)</span>
            <div className="metric-value" style={{ color: 'var(--rs-color-warning)' }}>{flagCount}</div>
          </div>
        </div>

        {/* Validation Problems Section (Section 24: نیازمند تکمیل) */}
        {validationProblems.length > 0 ? (
          <div
            style={{
              background: 'rgba(217, 74, 86, 0.08)',
              border: '1px solid rgba(217, 74, 86, 0.3)',
              borderRadius: 'var(--rs-radius-card)',
              padding: 18,
              margin: '24px 0',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <AlertCircle color="var(--rs-color-error)" size={20} />
              <h4 style={{ fontSize: 15, fontWeight: 700, color: '#FCA5A5' }}>
                نیازمند تکمیل ({validationProblems.length} مورد قبل از ارسال نهایی):
              </h4>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
              جهت ورود مستقیم به هر سوال، روی ردیف مربوطه کلیک کنید:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {validationProblems.map((prob) => (
                <div
                  key={`${prob.indicator.id}-${prob.problemText}`}
                  onClick={() => onJumpToQuestion(prob.index)}
                  style={{
                    background: 'var(--rs-color-navy-800)',
                    padding: '10px 14px',
                    borderRadius: 'var(--rs-radius-control)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    fontSize: 13,
                    border: '1px solid var(--border-subtle)',
                    transition: 'all var(--rs-duration-micro) var(--rs-ease-standard)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--rs-color-navy-700)';
                    e.currentTarget.style.borderColor = 'var(--rs-color-error)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--rs-color-navy-800)';
                    e.currentTarget.style.borderColor = 'var(--border-subtle)';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className="indicator-code-badge" style={{ background: 'var(--rs-color-brand-cyan)', color: 'var(--rs-color-brand-navy)', fontWeight: 800 }}>
                      {prob.code}
                    </span>
                    <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>{prob.indicator.subject}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 12, color: 'var(--rs-color-error)', fontWeight: 700 }}>{prob.problemText}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>←</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div
            style={{
              background: 'rgba(45, 157, 120, 0.08)',
              border: '1px solid rgba(45, 157, 120, 0.3)',
              borderRadius: 'var(--rs-radius-card)',
              padding: 16,
              margin: '24px 0',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <CheckCircle2 color="var(--rs-color-success)" size={26} />
            <div>
              <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--rs-color-success)' }}>
                تمامی الزامات ارزیابی تکمیل شده است
              </h4>
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                هیچ سوال بی‌پاسخ یا اصطکاک بدون عکس و توضیح الزامی باقی نمانده است. آماده ارسال به کارتابل سرپرست ممیزی.
              </p>
            </div>
          </div>
        )}

        {/* Submit Actions */}
        <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
          <button type="button" className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={onBackToAudit}>
            ویرایش پاسخ‌ها
          </button>

          <button
            type="button"
            className="btn-primary"
            style={{
              flex: 1.5,
              justifyContent: 'center',
              background: canSubmit ? 'var(--rs-color-action-primary)' : 'var(--rs-color-navy-700)',
              cursor: canSubmit ? 'pointer' : 'not-allowed',
              boxShadow: canSubmit ? '0 4px 16px rgba(0, 125, 170, 0.35)' : 'none',
            }}
            disabled={!canSubmit}
            onClick={() => setShowConfirmModal(true)}
          >
            <Send size={18} />
            <span>ارسال رسمی برای سرپرست</span>
          </button>
        </div>
      </div>

      {/* Confirmation Modal (Section 25) */}
      {showConfirmModal && (
        <div className="friction-sheet-backdrop" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="glass-panel" style={{ maxWidth: 440, width: '100%', padding: 24, textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(0, 176, 240, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Send size={28} color="var(--rs-color-brand-cyan)" />
            </div>
            <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 8, color: 'var(--theme-text-primary)' }}>
              تأیید نهایی و ارسال به سرپرست
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 20 }}>
              آیا از ارسال رسمی چک‌لیست اطمینان دارید؟
              <br />
              <strong style={{ color: 'var(--rs-color-warning)' }}>
                پس از ارسال، فرم در وضعیت فقط‌خواندنی (Read-Only) قرار می‌گیرد
              </strong>{' '}
              و ویرایش مجدد آن تنها در صورت بازگرداندن توسط سرپرست امکان‌پذیر خواهد بود.
            </p>

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                type="button"
                className="btn-secondary"
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => setShowConfirmModal(false)}
              >
                انصراف و بازگشت
              </button>
              <button
                type="button"
                className="btn-primary"
                style={{ flex: 1.2, justifyContent: 'center', background: 'var(--rs-color-action-primary)', boxShadow: '0 4px 16px rgba(0, 125, 170, 0.35)' }}
                onClick={handleConfirmSubmit}
              >
                تأیید و ارسال به سرپرست
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

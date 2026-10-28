import React from 'react';
import { Indicator, QuestionResponse, AnswerState } from '../types';
import {
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Bookmark,
  ChevronRight,
  ChevronLeft,
  Camera,
  Image,
  Sparkles,
  Info,
  Edit3,
  AlertCircle,
  Zap,
} from 'lucide-react';
import { groupLabel } from '../utils/format';
import { PHOTOS_REQUIRED } from '../config/policy';

interface QuestionCardProps {
  indicator: Indicator;
  response?: QuestionResponse;
  currentIndex: number;
  totalCount: number;
  sectionName?: string;
  onAnswer: (state: AnswerState) => void;
  onOpenFrictionSheet: () => void;
  onToggleFlag: () => void;
  onPrev: () => void;
  onNext: () => void;
  /** The next question stays closed until this one is answered. */
  nextLocked?: boolean;
  supervisorNote?: string;
}

export const QuestionCard: React.FC<QuestionCardProps> = ({
  indicator,
  response,
  currentIndex,
  totalCount,
  sectionName,
  onAnswer,
  onOpenFrictionSheet,
  onToggleFlag,
  onPrev,
  onNext,
  nextLocked = false,
  supervisorNote,
}) => {
  const currentState = response?.answerState || 'UNANSWERED';
  const isFlagged = response?.isFlagged || false;
  const hasPhotos = response?.photos && response.photos.length > 0;

  // Swipe detection state
  const touchStartRef = React.useRef<{ x: number; y: number } | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const deltaX = e.changedTouches[0].clientX - touchStartRef.current.x;
    const deltaY = e.changedTouches[0].clientY - touchStartRef.current.y;
    touchStartRef.current = null;

    // Only trigger if horizontal swipe is decisive and vertical movement is minimal
    if (Math.abs(deltaX) > 75 && Math.abs(deltaY) < 55) {
      if (deltaX < 0) {
        // Swiped Left in RTL -> Next Question
        if (currentIndex < totalCount - 1 && !nextLocked) onNext();
      } else {
        // Swiped Right in RTL -> Previous Question
        if (currentIndex > 0) onPrev();
      }
    }
  };

  const handleCleanClick = () => {
    onAnswer('NO_FRICTION');
  };

  // A friction is a yes/no answer: record it at once. Notes and photos are
  // optional and reached from the summary below.
  const handleFrictionClick = () => {
    onAnswer('FRICTION');
  };

  const handleNaClick = () => {
    onAnswer('NOT_APPLICABLE');
  };

  return (
    <div
      style={{ maxWidth: 540, margin: '0 auto', padding: '0 8px 30px', touchAction: 'pan-y' }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Top Meta Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--rs-color-brand-cyan)', background: 'rgba(0, 176, 240, 0.12)', padding: '3px 8px', borderRadius: 'var(--rs-radius-control)' }}>
            {groupLabel(indicator.group)} · {indicator.subject}
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            پرسش <span className="ltr-num" style={{ fontWeight: 800, color: 'var(--theme-text-primary)' }}>{currentIndex + 1}</span> از <span className="ltr-num">{totalCount}</span>
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            className={`flag-btn ${isFlagged ? 'flagged' : ''}`}
            onClick={onToggleFlag}
            title={isFlagged ? 'حذف نشانه‌گذاری' : 'نشانه‌گذاری برای بررسی بعد'}
            aria-label={isFlagged ? 'حذف نشانه‌گذاری' : 'نشانه‌گذاری برای بررسی بعد'}
            style={{
              background: isFlagged ? 'rgba(242, 181, 68, 0.2)' : 'var(--bg-input)',
              color: isFlagged ? 'var(--rs-color-warning)' : 'var(--text-dim)',
              border: `1px solid ${isFlagged ? 'var(--rs-color-warning)' : 'var(--border-subtle)'}`,
              padding: 6,
              borderRadius: 'var(--rs-radius-control)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all var(--rs-duration-micro) var(--rs-ease-standard)',
            }}
          >
            <Bookmark size={18} fill={isFlagged ? 'currentColor' : 'none'} />
          </button>
        </div>
      </div>

      {/* Supervisor Returned Notice (if applicable) */}
      {supervisorNote && (
        <div style={{ background: 'rgba(242, 181, 68, 0.15)', border: '1px solid var(--rs-color-warning)', borderRadius: 'var(--rs-radius-card)', padding: '10px 14px', marginBottom: 12, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <AlertCircle size={20} color="var(--rs-color-warning)" style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <strong style={{ fontSize: 13, color: 'var(--rs-color-warning)', display: 'block' }}>یادداشت سرپرست بازرسی:</strong>
            <span style={{ fontSize: 12, color: 'var(--text-main)', lineHeight: 1.5 }}>{supervisorNote}</span>
          </div>
        </div>
      )}

      {/* Main Focus Question Card */}
      <div
        className="glass-panel"
        style={{
          padding: 20,
          border: currentState === 'NO_FRICTION'
            ? '2px solid rgba(45, 157, 120, 0.5)'
            : currentState === 'FRICTION'
            ? '2px solid rgba(217, 74, 86, 0.5)'
            : '1px solid var(--border-subtle)',
          boxShadow: currentState === 'FRICTION' ? '0 0 20px rgba(217, 74, 86, 0.2)' : 'var(--rs-shadow-card)',
        }}
      >
        {/* Instrument Badge Header */}
        <div className="instrument-header">
          <div className="instrument-badge">
            <span className="indicator-code-badge">{indicator.code}</span>
            <span className="instrument-dot">•</span>
            <span className="instrument-subject">{indicator.subject}</span>
          </div>

          {indicator.requiresPhoto && (
            <div className="instrument-photo-req">
              <Camera size={13} />
              <span>{PHOTOS_REQUIRED ? 'الزام ثبت تصویر' : 'عکس توصیه می‌شود'}</span>
            </div>
          )}
        </div>

        {/* KPI Statement (Question text) */}
        <div>
          <h2 className="kpi-statement">
            {indicator.statement}
          </h2>
        </div>

        {/* A note the checklist's authors left for whoever audits this KPI. */}
        {indicator.auditorNote && (
          <aside className="kpi-note" aria-label="نکته برای ارزیاب">
            <span className="kpi-note__label">نکته برای ارزیاب</span>
            <span className="kpi-note__text">{indicator.auditorNote}</span>
          </aside>
        )}

        {/* Guidance: useful on question one, noise by question fifty. */}
        <p className="question-guidance">
          <Info size={14} color="var(--rs-color-action-primary)" style={{ flexShrink: 0, marginTop: 2 }} />
          <span>
            در صورت انطباق فضا با استاندارد <strong>«وضعیت مناسب»</strong>، و در صورت هرگونه نقص{' '}
            <strong>«اصطکاک»</strong> را ثبت کنید.
          </span>
        </p>

        {/* Answer Buttons (3 Distinct Options) */}
        <div className="answer-grid">
          {/* 1. NO FRICTION (Clean) */}
          <button
            type="button"
            onClick={handleCleanClick}
            className={`answer-btn ${currentState === 'NO_FRICTION' ? 'selected-clean' : ''}`}
          >
            <span className="answer-btn__icon answer-btn__icon--clean">
              <CheckCircle2 size={20} />
            </span>
            <div>
              <span className="answer-btn-title">
                وضعیت مناسب است
              </span>
              <span className="answer-btn-sub">
                استاندارد رعایت شده و مشکلی مشاهده نشد
              </span>
              {currentState === 'NO_FRICTION' && <span className="answer-btn__saved" aria-hidden="true">ثبت شد ✓</span>}
            </div>
          </button>

          {/* 2. FRICTION (Problem detected) */}
          <button
            type="button"
            onClick={handleFrictionClick}
            className={`answer-btn ${currentState === 'FRICTION' ? 'selected-friction' : ''}`}
          >
            <span className="answer-btn__icon answer-btn__icon--friction">
              <AlertTriangle size={20} />
            </span>
            <div>
              <span className="answer-btn-title">
                اصطکاک مشاهده شد
              </span>
              <span className="answer-btn-sub">
                نقص، عدم انطباق یا مانع تجربه مشتری وجود دارد
              </span>
              {currentState === 'FRICTION' && <span className="answer-btn__saved" aria-hidden="true">ثبت شد ✓</span>}
            </div>
          </button>

          {/* 3. NOT APPLICABLE (N/A) */}
          <button
            type="button"
            onClick={handleNaClick}
            className={`answer-btn ${currentState === 'NOT_APPLICABLE' ? 'selected-na' : ''}`}
          >
            <span className="answer-btn__icon answer-btn__icon--na">
              <HelpCircle size={20} />
            </span>
            <div>
              <span className="answer-btn-title">
                قابل ارزیابی نیست
              </span>
              <span className="answer-btn-sub">
                این مورد در این شعبه وجود ندارد یا قابل بررسی نیست (N/A)
              </span>
              {currentState === 'NOT_APPLICABLE' && <span className="answer-btn__saved" aria-hidden="true">ثبت شد ✓</span>}
            </div>
          </button>
        </div>

        {/* The answer is recorded the moment it is tapped; say so for the two answers that have no details panel. */}
        {(currentState === 'NO_FRICTION' || currentState === 'NOT_APPLICABLE') && (
          <div className={`answer-saved answer-saved--${currentState === 'NO_FRICTION' ? 'clean' : 'na'}`} role="status">
            <CheckCircle2 size={16} />
            <span>{currentState === 'NO_FRICTION' ? 'ثبت شد: وضعیت مناسب است' : 'ثبت شد: قابل ارزیابی نیست'}</span>
          </div>
        )}

        {/* Friction Details Capsule (if answer is FRICTION) */}
        {currentState === 'FRICTION' && (
          <div className="friction-summary">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span className="sev-chip sev-high">اصطکاک ثبت شد</span>
              {response?.comment?.trim() && (
                <span style={{ fontSize: 11, color: 'var(--theme-text-secondary)' }}>توضیح دارد</span>
              )}
              {hasPhotos && (
                <span style={{ fontSize: 11, color: 'var(--rs-color-brand-cyan)', display: 'flex', alignItems: 'center', gap: 3 }}>
                  <Image size={13} />
                  {response?.photos?.length} عکس
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={onOpenFrictionSheet}
              className="btn-secondary"
              style={{ padding: '6px 12px', fontSize: 12, minHeight: 34 }}
            >
              <Edit3 size={14} />
              {response?.comment?.trim() || hasPhotos ? 'ویرایش توضیح و عکس' : 'افزودن توضیح یا عکس (اختیاری)'}
            </button>
          </div>
        )}
      </div>

      {/* Swipe Affordance & Progress Dots */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          marginTop: 14,
          padding: '6px 12px',
          color: 'var(--theme-text-muted)',
          fontSize: 12,
          userSelect: 'none',
        }}
        aria-hidden="true"
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, opacity: 0.75, fontSize: 12 }}>
          <ChevronRight size={14} />
          <span>سوایپ به قبلی</span>
        </span>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {Array.from({ length: Math.min(5, totalCount) }).map((_, i) => {
            const activeIdx = Math.floor((currentIndex / Math.max(1, totalCount - 1)) * 4);
            return (
              <span
                key={i}
                style={{
                  width: i === activeIdx ? 16 : 6,
                  height: 6,
                  borderRadius: 3,
                  background: i === activeIdx ? 'var(--rs-color-brand-cyan)' : 'var(--theme-card-border)',
                  transition: 'all 200ms ease',
                }}
              />
            );
          })}
        </div>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, opacity: 0.75, fontSize: 12 }}>
          <span>سوایپ به بعدی</span>
          <ChevronLeft size={14} />
        </span>
      </div>

      {/* Navigation Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
        <button
          type="button"
          onClick={onPrev}
          disabled={currentIndex === 0}
          className="btn-secondary"
          style={{ minHeight: 46 }}
          aria-label="پرسش قبلی"
        >
          <ChevronRight size={18} />
          پرسش قبلی
        </button>

        <button
          type="button"
          onClick={onNext}
          disabled={currentIndex === totalCount - 1 || nextLocked}
          title={nextLocked ? 'ابتدا به این پرسش پاسخ دهید' : undefined}
          className="btn-secondary"
          style={{ minHeight: 46 }}
          aria-label="پرسش بعدی"
        >
          پرسش بعدی
          <ChevronLeft size={18} />
        </button>
      </div>
      {nextLocked && (
        <p role="status" style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', marginTop: 10 }}>
          برای رفتن به پرسش بعدی، یکی از سه گزینهٔ بالا را انتخاب کنید.
        </p>
      )}
    </div>
  );
};

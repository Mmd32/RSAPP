import React from 'react';
import { Indicator, QuestionResponse } from '../types';
import { STORE_JOURNEY_ORDER, MALL_JOURNEY_ORDER } from '../engine/ruleEngine';
import {
  Search,
  CheckCircle,
  AlertTriangle,
  Clock,
  Bookmark,
  Wifi,
  WifiOff,
  CheckCircle2,
  ChevronLeft,
  X,
  Sliders,
} from 'lucide-react';

interface FormOverviewProps {
  indicators: Indicator[];
  responses: Record<string, QuestionResponse>;
  currentStage: string;
  onSelectStage: (stage: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  brandName: string;
  branchName: string;
  startTime?: string;
  autosaveState: 'SAVED' | 'SAVING' | 'OFFLINE' | 'ERROR';
  onOpenReview: () => void;
  assessmentType: 'STORE' | 'MALL';
}

export const FormOverview: React.FC<FormOverviewProps> = ({
  indicators,
  responses,
  currentStage,
  onSelectStage,
  searchQuery,
  onSearchChange,
  brandName,
  branchName,
  startTime,
  autosaveState,
  onOpenReview,
  assessmentType,
}) => {
  const total = indicators.length;
  const answered = Object.values(responses).filter(
    (r) => r.answerState !== 'UNANSWERED'
  ).length;
  const percent = total > 0 ? Math.round((answered / total) * 100) : 0;

  const totalFrictions = Object.values(responses).filter(
    (r) => r.answerState === 'FRICTION'
  ).length;

  const totalFlags = Object.values(responses).filter((r) => r.isFlagged).length;

  const orderMap = assessmentType === 'STORE' ? STORE_JOURNEY_ORDER : MALL_JOURNEY_ORDER;

  // Group indicators by stage with statistics
  const stageStats = React.useMemo(() => {
    const stats: Record<
      string,
      {
        key: string;
        label: string;
        order: number;
        total: number;
        answered: number;
        frictions: number;
        criticals: number;
      }
    > = {};

    indicators.forEach((ind) => {
      const s = ind.journeyStage;
      if (!stats[s]) {
        stats[s] = {
          key: s,
          label: orderMap[s]?.labelFa || ind.group,
          order: orderMap[s]?.order || 99,
          total: 0,
          answered: 0,
          frictions: 0,
          criticals: 0,
        };
      }
      stats[s].total += 1;
      const resp = responses[ind.id];
      if (resp && resp.answerState !== 'UNANSWERED') {
        stats[s].answered += 1;
        if (resp.answerState === 'FRICTION') {
          stats[s].frictions += 1;
          if (resp.severity === 'CRITICAL') {
            stats[s].criticals += 1;
          }
        }
      }
    });

    return Object.values(stats).sort((a, b) => a.order - b.order);
  }, [indicators, responses, orderMap]);

  return (
    <div style={{ maxWidth: 540, margin: '0 auto', padding: '10px 8px 16px' }}>
      {/* Visit Home Bar */}
      <div
        className="glass-panel"
        style={{
          padding: '12px 16px',
          marginBottom: 10,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <strong style={{ fontSize: 14, color: 'var(--theme-text-primary)', display: 'block' }}>
            {brandName}
          </strong>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {branchName}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Autosave Status Pill */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 11,
              padding: '3px 8px',
              borderRadius: 'var(--rs-radius-full)',
              background:
                autosaveState === 'SAVING'
                  ? 'rgba(242, 181, 68, 0.15)'
                  : autosaveState === 'OFFLINE'
                  ? 'rgba(217, 74, 86, 0.15)'
                  : 'rgba(45, 157, 120, 0.15)',
              color:
                autosaveState === 'SAVING'
                  ? 'var(--rs-color-warning)'
                  : autosaveState === 'OFFLINE'
                  ? 'var(--rs-color-error)'
                  : 'var(--rs-color-success)',
              fontWeight: 600,
            }}
          >
            {autosaveState === 'OFFLINE' ? (
              <>
                <WifiOff size={13} />
                <span>آفلاین</span>
              </>
            ) : autosaveState === 'SAVING' ? (
              <>
                <Clock size={13} className="spin" />
                <span>در حال ذخیره...</span>
              </>
            ) : (
              <>
                <CheckCircle2 size={13} />
                <span>ذخیره شد</span>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={onOpenReview}
            className="btn-primary"
            style={{ padding: '6px 12px', fontSize: 12, minHeight: 34 }}
          >
            مرور نهایی ({answered}/{total})
          </button>
        </div>
      </div>

      {/* Progress & Quick Stats */}
      <div className="glass-panel" style={{ padding: '12px 16px', marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            پیشرفت کلی ارزیابی:
          </span>
          <span className="ltr-num" style={{ fontSize: 13, fontWeight: 800, color: 'var(--rs-color-brand-cyan)' }}>
            {answered} / {total} ({percent}%)
          </span>
        </div>

        <div className="progress-bar-bg" style={{ height: 8, marginBottom: 12 }}>
          <div className="progress-bar-fill" style={{ width: `${percent}%` }} />
        </div>

        {/* Metric Badges */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--rs-color-success)' }}>
            <CheckCircle size={14} />
            <span>{answered} پاسخ داده شده</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: totalFrictions > 0 ? 'var(--rs-color-error)' : 'var(--text-muted)' }}>
            <AlertTriangle size={14} />
            <span>{totalFrictions} اصطکاک</span>
          </div>

          {totalFlags > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--rs-color-warning)' }}>
              <Bookmark size={14} />
              <span>{totalFlags} نشانه‌دار</span>
            </div>
          )}
        </div>
      </div>

      {/* Search Input */}
      <div style={{ position: 'relative', marginBottom: 10 }}>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="جستجوی سریع در کد (FS02)، موضوع (اتاق پرو)، متن..."
          className="friction-textarea"
          style={{
            minHeight: 40,
            padding: '8px 36px 8px 12px',
            fontSize: 13,
            borderRadius: 'var(--rs-radius-control)',
            margin: 0,
          }}
        />
        <Search
          size={16}
          color="var(--text-dim)"
          style={{ position: 'absolute', right: 12, top: 12 }}
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            style={{
              position: 'absolute',
              left: 10,
              top: 10,
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
            }}
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Journey Stages Horizontal / Accordion Chips */}
      <div
        style={{
          display: 'flex',
          gap: 6,
          overflowX: 'auto',
          paddingBottom: 6,
          scrollbarWidth: 'none',
        }}
      >
        {stageStats.map((st) => {
          const isCurrent = currentStage === st.key;
          const isComplete = st.answered === st.total;
          return (
            <button
              key={st.key}
              type="button"
              onClick={() => onSelectStage(st.key)}
              style={{
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                borderRadius: 'var(--rs-radius-full)',
                border: `1.5px solid ${isCurrent ? 'var(--rs-color-brand-cyan)' : 'var(--border-subtle)'}`,
                background: isCurrent
                  ? 'rgba(0, 176, 240, 0.15)'
                  : isComplete
                  ? 'rgba(45, 157, 120, 0.12)'
                  : 'var(--bg-input)',
                color: isCurrent ? 'var(--rs-color-brand-cyan)' : isComplete ? 'var(--rs-color-success)' : 'var(--text-main)',
                fontSize: 11,
                fontWeight: isCurrent ? 700 : 500,
                cursor: 'pointer',
                transition: 'all var(--rs-duration-micro) var(--rs-ease-standard)',
              }}
            >
              <span>{st.label}</span>
              <span className="ltr-num" style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                {st.answered}/{st.total}
              </span>
              {st.frictions > 0 && (
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--rs-color-error)' }} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

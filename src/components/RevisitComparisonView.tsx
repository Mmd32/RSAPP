import React, { useState, useMemo } from 'react';
import {
  VisitSession,
  IndicatorComparisonItem,
  ComparisonChangeClass,
  BranchHistoricalSummary,
  CorrectiveAction,
} from '../types';
import { ComparisonEngine } from '../engine/comparisonEngine';
import { computeStoreFrictionRate } from '../engine/frModel';
import { faDateShort, faPercent } from '../utils/format';

/** Friction rate of a visit, 0–1: friction ÷ (indicators − N/A). */
const frOf = (v: VisitSession) => computeStoreFrictionRate(v.indicators, v.responses).total.rate;

const ANSWER_LABEL: Record<string, string> = {
  UNANSWERED: 'پاسخ داده نشده',
  NOT_APPLICABLE: 'غیرقابل اجرا',
};
import {
  ArrowUpDown,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  AlertTriangle,
  History,
  RotateCcw,
  Sparkles,
  Layers,
  Building,
  Check,
  X,
  Filter,
  Search,
} from 'lucide-react';

interface RevisitComparisonViewProps {
  visits: VisitSession[];
  actions: CorrectiveAction[];
  onSelectVisitForAudit?: (visitId: string) => void;
  onNavigateToActions?: () => void;
}

export const RevisitComparisonView: React.FC<RevisitComparisonViewProps> = ({
  visits,
  actions,
  onSelectVisitForAudit,
  onNavigateToActions,
}) => {
  // Collect all unique branches
  const branches = useMemo(() => {
    const map = new Map<string, { branchName: string; brandName: string; visits: VisitSession[] }>();
    for (const v of visits) {
      const key = v.branchName || 'شعبه پیش‌فرض';
      if (!map.has(key)) {
        map.set(key, { branchName: key, brandName: v.brandName || '', visits: [] });
      }
      map.get(key)!.visits.push(v);
    }
    return Array.from(map.values());
  }, [visits]);

  // Selected Branch
  const [selectedBranchName, setSelectedBranchName] = useState<string>(
    branches.length > 0 ? branches[0].branchName : ''
  );

  const selectedBranchData = useMemo(() => {
    return branches.find((b) => b.branchName === selectedBranchName);
  }, [branches, selectedBranchName]);

  const branchVisits = useMemo(() => {
    if (!selectedBranchData) return [];
    return [...selectedBranchData.visits].sort(
      (a, b) =>
        new Date(a.completedAt || a.startedAt).getTime() -
        new Date(b.completedAt || b.startedAt).getTime()
    );
  }, [selectedBranchData]);

  // Select two visits for comparison
  const [prevVisitId, setPrevVisitId] = useState<string>('');
  const [currVisitId, setCurrVisitId] = useState<string>('');

  // Auto-select visits when branch changes
  React.useEffect(() => {
    if (branchVisits.length >= 2) {
      setPrevVisitId(branchVisits[branchVisits.length - 2].id);
      setCurrVisitId(branchVisits[branchVisits.length - 1].id);
    } else if (branchVisits.length === 1) {
      setPrevVisitId(branchVisits[0].id);
      setCurrVisitId(branchVisits[0].id);
    }
  }, [selectedBranchName, branchVisits]);

  const prevVisit = useMemo(
    () => branchVisits.find((v) => v.id === prevVisitId),
    [branchVisits, prevVisitId]
  );
  const currVisit = useMemo(
    () => branchVisits.find((v) => v.id === currVisitId),
    [branchVisits, currVisitId]
  );

  // Comparison Results
  const comparison = useMemo(() => {
    if (!prevVisit || !currVisit || prevVisit.id === currVisit.id) {
      return null;
    }
    return ComparisonEngine.compareVisits(prevVisit, currVisit);
  }, [prevVisit, currVisit]);

  // Branch Summary Card
  const branchSummary = useMemo(() => {
    if (!selectedBranchData) return null;
    return ComparisonEngine.generateBranchSummary(
      selectedBranchData.branchName,
      selectedBranchData.branchName,
      selectedBranchData.brandName,
      branchVisits,
      actions
    );
  }, [selectedBranchData, branchVisits, actions]);

  // Friction-rate trend of the branch: first visit to latest.
  const frTrend = useMemo(() => {
    if (!branchVisits.length) return null;
    const initial = frOf(branchVisits[0]);
    const current = frOf(branchVisits[branchVisits.length - 1]);
    return { initial, current, delta: current - initial };
  }, [branchVisits]);

  // Filter Table
  const [classFilter, setClassFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredItems = useMemo(() => {
    if (!comparison) return [];
    return comparison.items.filter((item) => {
      if (classFilter !== 'ALL' && item.changeClass !== classFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          item.indicatorCode.toLowerCase().includes(q) ||
          item.indicatorSubject.toLowerCase().includes(q) ||
          item.indicatorStatement.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [comparison, classFilter, searchQuery]);

  const getChangeBadge = (c: ComparisonChangeClass) => {
    switch (c) {
      case 'RESOLVED_FRICTION':
        return { label: 'اصلاح کامل اصطکاک ✓', bg: 'var(--friction-clean-bg)', color: 'var(--friction-clean)' };
      case 'IMPROVED':
        return { label: 'بهبود یافته ↑', bg: 'rgba(45, 157, 120, 0.15)', color: '#2D9D78' };
      case 'WORSENED':
        return { label: 'پسرفت / افت ↓', bg: 'var(--friction-low-bg)', color: 'var(--friction-medium)' };
      case 'NEW_FRICTION':
        return { label: 'اصطکاک جدید !', bg: 'var(--friction-high-bg)', color: 'var(--rs-color-error)' };
      case 'UNCHANGED':
        return { label: 'بدون تغییر', bg: 'var(--surface-chip)', color: '#646E8C' };
      case 'NOT_COMPARABLE':
        return { label: 'غیرقابل مقایسه (نسخه متفاوت)', bg: 'var(--surface-chip)', color: 'var(--theme-text-muted)' };
    }
  };

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '16px 12px 64px 12px' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--theme-text-primary)' }}>
          مقایسه تاریخی و بهبود مستمر شعب
        </h1>
        <p style={{ fontSize: 13, color: 'var(--theme-text-secondary)', marginTop: 4 }}>
          راستی‌آزمایی حل اصطکاک‌ها در بازدیدهای مجدد، کشف مشکلات پرتکرار و سیر تحول نرخ اصطکاک شعبه
        </p>
      </div>

      {/* Branch & Visit Selector Bar */}
      <div
        className="card-rs"
        style={{
          padding: 16,
          marginBottom: 20,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 16,
          alignItems: 'center',
          background: 'var(--theme-card-bg)',
        }}
      >
        <div style={{ flex: '1 1 200px' }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--theme-text-secondary)', display: 'block', marginBottom: 4 }}>
            انتخاب شعبه / فروشگاه
          </label>
          <select
            className="select-rs"
            value={selectedBranchName}
            onChange={(e) => setSelectedBranchName(e.target.value)}
          >
            {branches.map((b) => (
              <option key={b.branchName} value={b.branchName}>
                {b.branchName} ({b.brandName}) — {b.visits.length} بازدید ثبت‌شده
              </option>
            ))}
          </select>
        </div>

        <div style={{ flex: '1 1 200px' }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--theme-text-secondary)', display: 'block', marginBottom: 4 }}>
            بازدید مبنا
          </label>
          <select
            className="select-rs"
            value={prevVisitId}
            onChange={(e) => setPrevVisitId(e.target.value)}
          >
            {branchVisits.map((v) => (
              <option key={v.id} value={v.id}>
                {v.visitCode || v.id.slice(0, 8)} ({faDateShort(v.startedAt)}) — نرخ اصطکاک: {faPercent(frOf(v) * 100)}
              </option>
            ))}
          </select>
        </div>

        <div style={{ flex: '1 1 200px' }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--theme-text-secondary)', display: 'block', marginBottom: 4 }}>
            بازدید مجدد / مقایسه‌ای
          </label>
          <select
            className="select-rs"
            value={currVisitId}
            onChange={(e) => setCurrVisitId(e.target.value)}
          >
            {branchVisits.map((v) => (
              <option key={v.id} value={v.id}>
                {v.visitCode || v.id.slice(0, 8)} ({faDateShort(v.startedAt)}) — نرخ اصطکاک: {faPercent(frOf(v) * 100)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Branch Improvement KPI Strip (Requirement 17) */}
      {branchSummary && frTrend && (
        <div
          className="compare-stats"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 12,
            marginBottom: 24,
          }}
        >
          <div className="card-rs" style={{ padding: '14px 16px' }}>
            <span style={{ fontSize: 12, color: 'var(--theme-text-secondary)', fontWeight: 600 }}>
              نرخ اصطکاک اولیه
            </span>
            <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--theme-text-primary)', marginTop: 4 }}>
              {faPercent(frTrend.initial * 100)}
            </div>
            <div style={{ fontSize: 11, color: 'var(--theme-text-muted)', marginTop: 2 }}>
              در اولین ارزیابی شعبه
            </div>
          </div>

          <div className="card-rs" style={{ padding: '14px 16px' }}>
            <span style={{ fontSize: 12, color: 'var(--theme-text-secondary)', fontWeight: 600 }}>
              نرخ اصطکاک جاری
            </span>
            <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--rs-color-brand-cyan)', marginTop: 4 }}>
              {faPercent(frTrend.current * 100)}
            </div>
            <div style={{ fontSize: 11, color: 'var(--theme-text-muted)', marginTop: 2 }}>
              آخرین ارزیابی میدانی
            </div>
          </div>

          <div
            className="card-rs"
            style={{
              padding: '14px 16px',
              background:
                frTrend.delta <= 0 ? 'var(--friction-clean-bg)' : 'var(--friction-high-bg)',
            }}
          >
            <span style={{ fontSize: 12, color: 'var(--theme-text-secondary)', fontWeight: 600 }}>
              تغییر نرخ اصطکاک
            </span>
            <div
              style={{
                fontSize: 28,
                fontWeight: 800,
                color: frTrend.delta <= 0 ? 'var(--rs-color-success)' : 'var(--rs-color-error)',
                marginTop: 4,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              {frTrend.delta > 0 ? '+' : frTrend.delta < 0 ? '−' : ''}
              {faPercent(Math.abs(frTrend.delta) * 100)}
              {frTrend.delta > 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
            </div>
            <div style={{ fontSize: 11, color: 'var(--theme-text-secondary)', marginTop: 2 }}>
              کاهش نرخ اصطکاک یعنی بهبود
            </div>
          </div>

          <div className="card-rs" style={{ padding: '14px 16px' }}>
            <span style={{ fontSize: 12, color: 'var(--theme-text-secondary)', fontWeight: 600 }}>
              اصطکاک‌های حل‌شده
            </span>
            <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--rs-color-success)', marginTop: 4 }}>
              {branchSummary.resolvedFrictionsCount}
            </div>
            <div style={{ fontSize: 11, color: 'var(--theme-text-muted)', marginTop: 2 }}>
              تایید در بازدید مجدد
            </div>
          </div>

          <div className="card-rs" style={{ padding: '14px 16px' }}>
            <span style={{ fontSize: 12, color: 'var(--theme-text-secondary)', fontWeight: 600 }}>
              مشکلات پرتکرار
            </span>
            <div
              style={{
                fontSize: 28,
                fontWeight: 800,
                color: branchSummary.recurringFrictionsCount > 0 ? '#EA580C' : 'var(--theme-text-primary)',
                marginTop: 4,
              }}
            >
              {branchSummary.recurringFrictionsCount}
            </div>
            <div style={{ fontSize: 11, color: 'var(--theme-text-muted)', marginTop: 2 }}>
              اصطکاک مداوم در هر دو بازدید
            </div>
          </div>
        </div>
      )}

      {/* Recurring Friction Banner Alert (Requirement 19) */}
      {comparison && comparison.recurringCount > 0 && (
        <div
          style={{
            background: 'var(--friction-low-bg)',
            border: '1px solid var(--rs-color-warning)',
            borderRadius: 'var(--rs-radius-card)',
            padding: '14px 18px',
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <AlertTriangle size={24} color="#B45309" />
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--friction-medium)' }}>
                هشدار: {comparison.recurringCount} مشکل پرتکرار شناسایی شد!
              </div>
              <div style={{ fontSize: 12, color: 'var(--friction-medium)', marginTop: 2 }}>
                این شاخص‌ها در بازدید قبلی دارای اصطکاک بوده و در بازدید فعلی نیز رفع نشده‌اند. نیازمند بررسی ریشه‌ای.
              </div>
            </div>
          </div>

          {onNavigateToActions && (
            <button
              onClick={onNavigateToActions}
              className="btn-secondary"
              style={{ fontSize: 12 }}
            >
              مشاهده اقدامات اصلاحی این شعبه
            </button>
          )}
        </div>
      )}

      {/* 2. Filter Bar for Indicator Comparison Grid */}
      {comparison && (
        <div
          className="card-rs"
          style={{
            padding: 12,
            marginBottom: 16,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 10,
            alignItems: 'center',
            background: 'var(--theme-card-bg)',
          }}
        >
          <div style={{ flex: '1 1 200px', position: 'relative' }}>
            <Search
              size={16}
              style={{
                position: 'absolute',
                right: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--theme-text-muted)',
              }}
            />
            <input
              type="text"
              className="input-rs"
              placeholder="جستجو در کد یا شرح شاخص..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingRight: 32, fontSize: 13, width: '100%' }}
            />
          </div>

          <select
            className="select-rs"
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            style={{ width: 'auto', minWidth: 160, fontSize: 13 }}
          >
            <option value="ALL">همه دسته‌ها ({comparison.items.length})</option>
            <option value="RESOLVED_FRICTION">اصلاح کامل اصطکاک ({comparison.resolvedCount})</option>
            <option value="WORSENED">پسرفت / افت ({comparison.worsenedCount})</option>
            <option value="NEW_FRICTION">اصطکاک جدید ({comparison.newFrictionCount})</option>
            <option value="UNCHANGED">بدون تغییر</option>
            <option value="NOT_COMPARABLE">غیرقابل مقایسه</option>
          </select>
        </div>
      )}

      {/* 3. Comparison Grid Table (Requirements 14-16) */}
      {comparison ? (
        <div className="card-rs" style={{ padding: 0, overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 720, borderCollapse: 'collapse', textAlign: 'right' }}>
            <thead>
              <tr style={{ background: 'var(--surface-sunken)', borderBottom: '1px solid var(--theme-card-border)' }}>
                <th style={{ padding: '12px 14px', fontSize: 12, fontWeight: 700, color: 'var(--theme-text-secondary)' }}>
                  کد شاخص
                </th>
                <th style={{ padding: '12px 14px', fontSize: 12, fontWeight: 700, color: 'var(--theme-text-secondary)' }}>
                  شرح شاخص و موضوع
                </th>
                <th style={{ padding: '12px 14px', fontSize: 12, fontWeight: 700, color: 'var(--theme-text-secondary)' }}>
                  وضعیت در بازدید قبل
                </th>
                <th style={{ padding: '12px 14px', fontSize: 12, fontWeight: 700, color: 'var(--theme-text-secondary)' }}>
                  وضعیت در بازدید فعلی
                </th>
                <th style={{ padding: '12px 14px', fontSize: 12, fontWeight: 700, color: 'var(--theme-text-secondary)' }}>
                  طبقه‌بندی تغییر
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: 32, textAlign: 'center', color: 'var(--theme-text-muted)' }}>
                    شاخصی مطابق با فیلتر یافت نشد.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const badge = getChangeBadge(item.changeClass);

                  return (
                    <tr
                      key={item.indicatorCode}
                      style={{
                        borderBottom: '1px solid var(--theme-card-border)',
                        background: item.isRecurring
                          ? 'rgba(242, 181, 68, 0.06)'
                          : item.changeClass === 'RESOLVED_FRICTION'
                          ? 'rgba(45, 157, 120, 0.05)'
                          : item.changeClass === 'WORSENED'
                          ? 'rgba(217, 74, 86, 0.05)'
                          : 'transparent',
                      }}
                    >
                      {/* Code */}
                      <td style={{ padding: '12px 14px' }}>
                        <span className="indicator-code-badge">{item.indicatorCode}</span>
                        {item.isRecurring && (
                          <span
                            style={{
                              display: 'block',
                              fontSize: 11,
                              fontWeight: 700,
                              color: 'var(--friction-medium)',
                              marginTop: 4,
                            }}
                          >
                            ⚠️ پرتکرار
                          </span>
                        )}
                      </td>

                      {/* Subject & Statement */}
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--theme-text-primary)' }}>
                          {item.indicatorSubject}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--theme-text-secondary)', marginTop: 2 }}>
                          {item.indicatorStatement}
                        </div>
                      </td>

                      {/* Previous State */}
                      <td style={{ padding: '12px 14px', fontSize: 12 }}>
                        {item.previousAnswerState === 'FRICTION' ? (
                          <span style={{ color: 'var(--rs-color-error)', fontWeight: 700 }}>
                            اصطکاک
                          </span>
                        ) : item.previousAnswerState === 'NO_FRICTION' ? (
                          <span style={{ color: 'var(--rs-color-success)', fontWeight: 600 }}>
                            مناسب (بدون مشکل)
                          </span>
                        ) : (
                          <span style={{ color: 'var(--theme-text-muted)' }}>
                            {ANSWER_LABEL[item.previousAnswerState] || item.previousAnswerState}
                          </span>
                        )}
                      </td>

                      {/* Current State */}
                      <td style={{ padding: '12px 14px', fontSize: 12 }}>
                        {item.currentAnswerState === 'FRICTION' ? (
                          <span style={{ color: 'var(--rs-color-error)', fontWeight: 700 }}>
                            اصطکاک
                          </span>
                        ) : item.currentAnswerState === 'NO_FRICTION' ? (
                          <span style={{ color: 'var(--rs-color-success)', fontWeight: 700 }}>
                            مناسب (بدون مشکل)
                          </span>
                        ) : (
                          <span style={{ color: 'var(--theme-text-muted)' }}>
                            {ANSWER_LABEL[item.currentAnswerState] || item.currentAnswerState}
                          </span>
                        )}
                      </td>

                      {/* Change Class Badge */}
                      <td style={{ padding: '12px 14px' }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: 'var(--rs-radius-full)',
                            background: badge.bg,
                            color: badge.color,
                          }}
                        >
                          {badge.label}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div
          className="card-rs"
          style={{ padding: 48, textAlign: 'center', color: 'var(--theme-text-secondary)' }}
        >
          لطفاً دو بازدید مجزا از شعبه را برای مقایسه انتخاب فرمایید.
        </div>
      )}
    </div>
  );
};

import React, { useState, useMemo } from 'react';
import { VisitSession, QuestionResponse, Indicator, SeverityLevel } from '../types';
import { calculateVisitSummary } from '../engine/scoringEngine';
import { StatCard, StatRow } from './ui/StatCard';
import { faDateTime, faDigits, faPercent, stageLabel } from '../utils/format';
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  Award,
  MessageSquare,
  ArrowLeft,
  Filter,
  Camera,
  RotateCcw,
  Check,
  X,
  Edit2,
} from 'lucide-react';

interface SupervisorReviewProps {
  visit: VisitSession;
  onApproveVisit: (notes: string, decisions: Record<string, { status: 'APPROVED' | 'REJECTED' | 'REQUEST_CHANGE'; comment?: string }>) => void;
  onRequestRevision: (notes: string, decisions: Record<string, { status: 'APPROVED' | 'REJECTED' | 'REQUEST_CHANGE'; comment?: string }>) => void;
  onBackToDashboard: () => void;
  onCreateCorrectiveAction?: (actionData: any) => void;
}

export const SupervisorReview: React.FC<SupervisorReviewProps> = ({
  visit,
  onApproveVisit,
  onRequestRevision,
  onBackToDashboard,
  onCreateCorrectiveAction,
}) => {
  const summary = calculateVisitSummary(visit.indicators, visit.responses, visit.assessmentType);
  // Only a visit the evaluator has submitted can be approved or sent back.
  const canDecide = visit.status === 'SUBMITTED';
  const [supervisorNotes, setSupervisorNotes] = useState(visit.supervisorNotes || '');

  // Decisions map: indicatorId -> { status, comment }
  const [findingDecisions, setFindingDecisions] = useState<
    Record<string, { status: 'APPROVED' | 'REJECTED' | 'REQUEST_CHANGE'; comment?: string }>
  >(visit.findingDecisions || {});

  // Filters State
  const [filterSeverity, setFilterSeverity] = useState<string>('ALL');
  const [filterSection, setFilterSection] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterPhoto, setFilterPhoto] = useState<string>('ALL');
  const [onlyNeedsCorrection, setOnlyNeedsCorrection] = useState<boolean>(false);

  const handleSetDecisionStatus = (
    indId: string,
    status: 'APPROVED' | 'REJECTED' | 'REQUEST_CHANGE'
  ) => {
    setFindingDecisions((prev) => ({
      ...prev,
      [indId]: {
        status,
        comment: prev[indId]?.comment || '',
      },
    }));
  };

  const handleSetDecisionComment = (indId: string, comment: string) => {
    setFindingDecisions((prev) => ({
      ...prev,
      [indId]: {
        status: prev[indId]?.status || 'REQUEST_CHANGE',
        comment,
      },
    }));
  };

  // All friction items
  const allFrictionItems = useMemo(() => {
    return visit.indicators
      .map((ind) => ({ ind, resp: visit.responses[ind.id] }))
      .filter((item) => item.resp && item.resp.answerState === 'FRICTION');
  }, [visit]);

  // Unique sections for filter dropdown
  const uniqueSections = useMemo(() => {
    const set = new Set<string>();
    allFrictionItems.forEach(({ ind }) => set.add(ind.journeyStage));
    return Array.from(set);
  }, [allFrictionItems]);

  // Filtered friction items
  const filteredItems = useMemo(() => {
    return allFrictionItems.filter(({ ind, resp }) => {
      if (onlyNeedsCorrection) {
        const dec = findingDecisions[ind.id];
        return dec && dec.status === 'REQUEST_CHANGE';
      }

      if (filterSeverity !== 'ALL' && resp.severity !== filterSeverity) {
        return false;
      }
      if (filterSection !== 'ALL' && ind.journeyStage !== filterSection) {
        return false;
      }
      if (filterPhoto === 'HAS_PHOTO' && (!resp.photos || resp.photos.length === 0)) {
        return false;
      }
      if (filterPhoto === 'NO_PHOTO' && resp.photos && resp.photos.length > 0) {
        return false;
      }
      if (filterStatus !== 'ALL') {
        const currentDec = findingDecisions[ind.id]?.status || 'APPROVED';
        if (currentDec !== filterStatus) return false;
      }
      return true;
    });
  }, [allFrictionItems, filterSeverity, filterSection, filterStatus, filterPhoto, onlyNeedsCorrection, findingDecisions]);

  const needsCorrectionCount = Object.values(findingDecisions).filter(
    (d) => d.status === 'REQUEST_CHANGE'
  ).length;

  return (
    <div style={{ maxWidth: 880, margin: '20px auto', padding: '0 16px 40px' }}>
      <div className="glass-panel sup-panel" style={{ padding: 24 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap-reverse', marginBottom: 20 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700 }}>بررسی سرپرست: {visit.brandName} - {visit.branchName}</h2>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
              ارزیاب: {visit.auditorName} • کد پیگیری: <span className="ltr-code">{visit.visitCode}</span> • شروع: {faDateTime(visit.startedAt)}
            </p>
          </div>

          <button type="button" className="btn-secondary" onClick={onBackToDashboard}>
            <ArrowLeft size={16} />
            <span>بازگشت</span>
          </button>
        </div>

        {/* Section 26: Summary First */}
        <StatRow>
          <StatCard label="امتیاز اولیه سامانه" value={faPercent(summary.overallScore)} />
          <StatCard label="کل اصطکاک‌ها" value={faDigits(summary.totalFrictions)} />
          <StatCard label="موارد بحرانی" value={faDigits(summary.criticalFrictions)} tone={summary.criticalFrictions > 0 ? 'alarm' : 'default'} />
          <StatCard label="موارد شدید" value={faDigits(summary.highFrictions)} />
          <StatCard label="مدارک تصویری" value={faDigits(summary.totalPhotos)} />
          <StatCard label="نیازمند اصلاح" value={faDigits(needsCorrectionCount)} tone={needsCorrectionCount > 0 ? 'alarm' : 'default'} />
        </StatRow>

        {/* Section 27: Supervisor Filters */}
        <div style={{ background: 'var(--bg-input)', padding: 14, borderRadius: 'var(--rs-radius-card)', margin: '20px 0 16px', border: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, fontSize: 13, fontWeight: 700, color: 'var(--text-main)' }}>
            <Filter size={15} color="var(--rs-color-brand-cyan)" />
            <span>فیلترهای بررسی یافته‌ها:</span>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {/* Severity Filter */}
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>شدت عارضه:</label>
              <select
                value={filterSeverity}
                onChange={(e) => setFilterSeverity(e.target.value)}
                className="friction-textarea"
                style={{ minHeight: 34, padding: '4px 8px', fontSize: 12, borderRadius: 'var(--radius-sm)' }}
              >
                <option value="ALL">همه شدت‌ها</option>
                <option value="CRITICAL">بحرانی</option>
                <option value="HIGH">زیاد</option>
                <option value="MEDIUM">متوسط</option>
                <option value="LOW">کم</option>
              </select>
            </div>

            {/* Section Filter */}
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>بخش / مرحله:</label>
              <select
                value={filterSection}
                onChange={(e) => setFilterSection(e.target.value)}
                className="friction-textarea"
                style={{ minHeight: 34, padding: '4px 8px', fontSize: 12, borderRadius: 'var(--radius-sm)' }}
              >
                <option value="ALL">همه بخش‌ها</option>
                {uniqueSections.map((sec) => (
                  <option key={sec} value={sec}>{stageLabel(sec)}</option>
                ))}
              </select>
            </div>

            {/* Reviewer Status Filter */}
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>وضعیت بازبینی:</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="friction-textarea"
                style={{ minHeight: 34, padding: '4px 8px', fontSize: 12, borderRadius: 'var(--radius-sm)' }}
              >
                <option value="ALL">همه وضعیت‌ها</option>
                <option value="APPROVED">تأییدشده</option>
                <option value="REQUEST_CHANGE">نیازمند اصلاح</option>
                <option value="REJECTED">رد شده</option>
              </select>
            </div>

            {/* Has Photo Filter */}
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>مدرک تصویری:</label>
              <select
                value={filterPhoto}
                onChange={(e) => setFilterPhoto(e.target.value)}
                className="friction-textarea"
                style={{ minHeight: 34, padding: '4px 8px', fontSize: 12, borderRadius: 'var(--radius-sm)' }}
              >
                <option value="ALL">همه</option>
                <option value="HAS_PHOTO">دارای عکس</option>
                <option value="NO_PHOTO">بدون عکس</option>
              </select>
            </div>

            {/* Needs Correction Toggle */}
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setOnlyNeedsCorrection(!onlyNeedsCorrection)}
                style={{
                  minHeight: 34,
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: `1px solid ${onlyNeedsCorrection ? 'var(--friction-low)' : 'var(--border-subtle)'}`,
                  background: onlyNeedsCorrection ? 'var(--friction-low-bg)' : 'var(--surface-chip)',
                  color: onlyNeedsCorrection ? 'var(--friction-low)' : 'var(--text-muted)',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <AlertCircle size={14} />
                <span>فقط نیازمند اصلاح ({needsCorrectionCount})</span>
              </button>
            </div>
          </div>
        </div>

        {/* Section 26: Review Only Frictions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '20px 0 12px' }}>
          <h3 style={{ fontSize: 16, fontWeight: 700 }}>
            بررسی انطباق شواهد اصطکاک ({filteredItems.length} از {allFrictionItems.length} یافته):
          </h3>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            اقدام برای هر یافته: تأیید، درخواست اصلاح ارزیاب، یا رد مشاهده
          </span>
        </div>

        {filteredItems.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 32, background: 'var(--bg-input)', borderRadius: 'var(--radius-md)' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>هیچ یافته‌ای با فیلترهای انتخابی مطابقت ندارد.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {filteredItems.map(({ ind, resp }) => {
              const currentDec = findingDecisions[ind.id] || { status: 'APPROVED' };
              const isNeedsCorrection = currentDec.status === 'REQUEST_CHANGE';
              const isRejected = currentDec.status === 'REJECTED';
              const isApproved = currentDec.status === 'APPROVED';

              return (
                <div
                  key={ind.id}
                  style={{
                    background: 'var(--bg-input)',
                    border: `1.5px solid ${isNeedsCorrection ? 'var(--rs-color-warning)' : isRejected ? 'var(--rs-color-error)' : 'var(--border-subtle)'}`,
                    borderRadius: 'var(--rs-radius-card)',
                    padding: 16,
                    transition: 'all var(--rs-duration-micro) var(--rs-ease-standard)',
                  }}
                >
                  {/* Card Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span className="indicator-code-badge" style={{ background: 'var(--rs-color-brand-cyan)', color: 'var(--rs-color-brand-navy)', fontWeight: 800 }}>
                        {ind.code}
                      </span>
                      <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{ind.subject}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--surface-chip)', padding: '2px 8px', borderRadius: 'var(--rs-radius-control)' }}>
                        {stageLabel(ind.journeyStage)}
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          padding: '2px 8px',
                          borderRadius: 'var(--rs-radius-control)',
                          background: getSevBg(resp.severity),
                          color: getSevColor(resp.severity),
                          fontWeight: 700,
                        }}
                      >
                        شدت: {getSevLabel(resp.severity)}
                      </span>
                    </div>

                    {/* Section 26: 3 Finding Action Buttons */}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => handleSetDecisionStatus(ind.id, 'APPROVED')}
                        style={{
                          background: isApproved ? 'var(--rs-color-success)' : 'var(--surface-chip)',
                          color: isApproved ? '#fff' : 'var(--text-muted)',
                          border: `1px solid ${isApproved ? 'var(--rs-color-success)' : 'var(--border-subtle)'}`,
                          borderRadius: 'var(--rs-radius-control)',
                          padding: '5px 10px',
                          fontSize: 12,
                          cursor: 'pointer',
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          transition: 'all var(--rs-duration-micro) var(--rs-ease-standard)',
                        }}
                      >
                        <Check size={14} />
                        <span>تأیید</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSetDecisionStatus(ind.id, 'REQUEST_CHANGE')}
                        style={{
                          background: isNeedsCorrection ? 'var(--rs-color-warning)' : 'var(--surface-chip)',
                          color: isNeedsCorrection ? '#16213E' : 'var(--text-muted)',
                          border: `1px solid ${isNeedsCorrection ? 'var(--rs-color-warning)' : 'var(--border-subtle)'}`,
                          borderRadius: 'var(--rs-radius-control)',
                          padding: '5px 10px',
                          fontSize: 12,
                          cursor: 'pointer',
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          transition: 'all var(--rs-duration-micro) var(--rs-ease-standard)',
                        }}
                      >
                        <Edit2 size={14} />
                        <span>درخواست اصلاح</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSetDecisionStatus(ind.id, 'REJECTED')}
                        style={{
                          background: isRejected ? 'var(--rs-color-error)' : 'var(--surface-chip)',
                          color: isRejected ? '#fff' : 'var(--text-muted)',
                          border: `1px solid ${isRejected ? 'var(--rs-color-error)' : 'var(--border-subtle)'}`,
                          borderRadius: 'var(--rs-radius-control)',
                          padding: '5px 10px',
                          fontSize: 12,
                          cursor: 'pointer',
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          transition: 'all var(--rs-duration-micro) var(--rs-ease-standard)',
                        }}
                      >
                        <X size={14} />
                        <span>رد مشاهده</span>
                      </button>

                      {onCreateCorrectiveAction && (
                        <button
                          type="button"
                          onClick={() =>
                            onCreateCorrectiveAction({
                              title: `رفع اصطکاک: ${ind.code} - ${ind.subject}`,
                              indicatorCode: ind.code,
                              description: ind.statement + (resp.comment ? `\nتوضیح ارزیاب: ${resp.comment}` : ''),
                              priority: resp.severity === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
                              branchName: visit.branchName,
                              brandName: visit.brandName,
                              visitId: visit.id,
                              beforePhotos: resp.photos || [],
                              department: 'Operations',
                            })
                          }
                          className="btn-rs btn-rs-secondary"
                          style={{ fontSize: 11, padding: '4px 8px' }}
                        >
                          ارجاع به اقدام اصلاحی
                        </button>
                      )}
                    </div>
                  </div>

                  {/* KPI Statement */}
                  <p style={{ fontSize: 13, color: 'var(--text-main)', marginBottom: 8, lineHeight: 1.5 }}>
                    <strong>صورت شاخص:</strong> {ind.statement}
                  </p>

                  {/* Auditor Comment */}
                  {resp.comment && (
                    <div style={{ background: 'rgba(56, 189, 248, 0.08)', padding: '8px 12px', borderRadius: 'var(--radius-sm)', marginBottom: 8, border: '1px solid rgba(56, 189, 248, 0.2)' }}>
                      <span style={{ fontSize: 12, color: 'var(--theme-text-secondary)', fontWeight: 600 }}>گزارش ارزیاب: </span>
                      <span style={{ fontSize: 12, color: 'var(--theme-text-primary)' }}>{resp.comment}</span>
                    </div>
                  )}

                  {/* Auditor Recommendation */}
                  {resp.recommendation && (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
                      <strong>پیشنهاد ارزیاب:</strong> {resp.recommendation}
                    </div>
                  )}

                  {/* Evidence Photos */}
                  {resp.photos && resp.photos.length > 0 && (
                    <div style={{ margin: '10px 0' }}>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                        شواهد تصویری پیوست ({resp.photos.length} تصویر):
                      </span>
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        {resp.photos.map((p) => (
                          <div key={p.id} style={{ borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--border-subtle)', background: 'var(--surface-sunken)' }}>
                            <img src={p.url} alt={p.caption || 'مدرک تصویری'} style={{ width: 130, height: 90, objectFit: 'cover', display: 'block' }} />
                            {p.caption && (
                              <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '4px 6px', maxWidth: 130, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                {p.caption}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Supervisor Inline Comment for this finding */}
                  <div style={{ marginTop: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <MessageSquare size={13} color="var(--text-dim)" />
                      <label style={{ fontSize: 11, color: isNeedsCorrection ? 'var(--friction-low)' : 'var(--text-muted)', fontWeight: 600 }}>
                        {isNeedsCorrection ? 'توضیحات و دلیل درخواست اصلاح (مشاهده در کارتابل ارزیاب):' : 'یادداشت یا بازخورد سرپرست برای این یافته:'}
                      </label>
                    </div>
                    <input
                      type="text"
                      className="friction-textarea"
                      style={{ minHeight: 34, padding: '6px 10px', fontSize: 12, borderRadius: 'var(--radius-sm)' }}
                      placeholder="توضیح سرپرست (مثلاً: زاویه عکس کافی نیست یا شرح نقص دقیق‌تر شود)..."
                      value={currentDec.comment || ''}
                      onChange={(e) => handleSetDecisionComment(ind.id, e.target.value)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Supervisor General Notes */}
        <div style={{ margin: '24px 0 16px' }}>
          <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: 6 }}>
            جمع‌بندی و یادداشت کلی سرپرست ممیزی:
          </label>
          <textarea
            className="friction-textarea"
            placeholder="توضیحات کلی، نقاط قوت و ضعف ممیزی، دستورالعمل به ارزیاب یا جمع‌بندی مدیریتی..."
            value={supervisorNotes}
            onChange={(e) => setSupervisorNotes(e.target.value)}
          />
        </div>

        {/* Section 28: Return Visit vs Final Approval */}
        {!canDecide && (
          <div
            role="status"
            style={{
              marginBottom: 12,
              padding: '10px 14px',
              borderRadius: 'var(--rs-radius-control)',
              background: 'var(--friction-low-bg)',
              color: 'var(--theme-text-primary)',
              fontSize: 13,
            }}
          >
            {visit.status === 'APPROVED'
              ? 'این بازدید قبلاً تأیید نهایی شده است.'
              : 'ارزیاب هنوز این بازدید را برای سرپرست ارسال نکرده است. تأیید یا بازگرداندن پس از ارسال از صفحهٔ «کنترل کیفیت» ممکن است.'}
          </div>
        )}
        <div className="sup-final-actions" style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 12 }}>
          <button
            type="button"
            className="btn-secondary"
            style={{
              justifyContent: 'center',
              borderColor: 'var(--friction-low)',
              color: 'var(--friction-low)',
              background: 'rgba(245, 158, 11, 0.1)',
            }}
            onClick={() => onRequestRevision(supervisorNotes, findingDecisions)}
            disabled={!canDecide}
          >
            <RotateCcw size={18} />
            <span>بازگرداندن به ارزیاب جهت اصلاح ({needsCorrectionCount} مورد)</span>
          </button>

          <button
            type="button"
            className="btn-primary"
            style={{ justifyContent: 'center', background: 'var(--status-clean)' }}
            onClick={() => onApproveVisit(supervisorNotes, findingDecisions)}
            disabled={!canDecide}
          >
            <Award size={18} />
            <span>تأیید نهایی و صدور گزارش رسمی</span>
          </button>
        </div>
      </div>
    </div>
  );
};

function getSevBg(sev?: string) {
  if (sev === 'CRITICAL') return 'rgba(217, 74, 86, 0.2)';
  if (sev === 'HIGH') return 'rgba(234, 88, 12, 0.2)';
  if (sev === 'LOW') return 'rgba(0, 176, 240, 0.15)';
  return 'rgba(242, 181, 68, 0.2)';
}

function getSevColor(sev?: string) {
  if (sev === 'CRITICAL') return 'var(--rs-color-error)';
  if (sev === 'HIGH') return '#EA580C';
  if (sev === 'LOW') return 'var(--rs-color-brand-cyan)';
  return 'var(--rs-color-warning)';
}

function getSevLabel(sev?: string) {
  if (sev === 'CRITICAL') return 'بحرانی';
  if (sev === 'HIGH') return 'زیاد';
  if (sev === 'LOW') return 'کم';
  return 'متوسط';
}

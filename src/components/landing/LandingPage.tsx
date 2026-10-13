import React, { useMemo } from 'react';
import { PlusCircle, PlayCircle, Building2 } from 'lucide-react';
import { VisitSession, UserRole } from '../../types';
import { faDate, faDigits } from '../../utils/format';
import { computeFrictionRate, computeBrandFrictionRates, isFinishedVisit, latestVisitPerBranch } from '../../engine/frModel';
import { faRate } from '../FrictionRateReport';

/*
 * Home: what a project lead needs on opening the app — how much has been
 * recorded, what is waiting on someone, where friction is highest, and the
 * latest questionnaires. Field evaluators see only their own work.
 */

interface LandingPageProps {
  /** False for read-only roles: no entry point to start a visit. */
  canStartAudit?: boolean;
  currentUserName: string;
  currentUserRole: UserRole;
  activeSession: VisitSession | null;
  savedStoresCount: number;
  actionsCount: number;
  /** Corrective actions not yet resolved or verified. */
  openActionsCount?: number;
  /** Questionnaires visible to this person (their own, or all with access). */
  visits?: VisitSession[];
  onStartNewAudit: () => void;
  onResumeAudit: () => void;
  onOpenReport: () => void;
  onOpenActions: () => void;
  onOpenVisit?: (visit: VisitSession) => void;
  onOpenArchive?: () => void;
  onOpenBusiness?: () => void;
  onOpenReview?: () => void;
  /** Hide entry points the person has no access to. */
  canOpenReports?: boolean;
  canOpenActions?: boolean;
  canReview?: boolean;
  /** Omitted for roles without the admin tools. */
  onOpenCatalog?: () => void;
}

const STATUS: Record<string, { label: string; tone: string }> = {
  IN_PROGRESS: { label: 'در حال تکمیل', tone: 'is-progress' },
  SUBMITTED: { label: 'در انتظار بررسی', tone: 'is-submitted' },
  APPROVED: { label: 'تأییدشده', tone: 'is-approved' },
  REVISION_REQUESTED: { label: 'نیازمند اصلاح', tone: 'is-revision' },
};

export const LandingPage: React.FC<LandingPageProps> = ({
  canStartAudit = true,
  currentUserName,
  activeSession,
  savedStoresCount,
  openActionsCount = 0,
  visits = [],
  onStartNewAudit,
  onResumeAudit,
  onOpenActions,
  onOpenVisit,
  onOpenArchive,
  onOpenBusiness,
  onOpenReview,
  canOpenReports = true,
  canOpenActions = true,
  canReview = false,
}) => {
  const answered = activeSession
    ? Object.values(activeSession.responses).filter((r) => r.answerState && r.answerState !== 'UNANSWERED').length
    : 0;
  const total = activeSession?.indicators.length || 0;
  const showResume = !!activeSession && canStartAudit && (activeSession.status === 'IN_PROGRESS' || activeSession.status === 'REVISION_REQUESTED');

  const stats = useMemo(() => {
    const finished = visits.filter(isFinishedVisit);
    const brands = [...new Set(finished.map((v) => v.brandName))];
    const latest = brands.flatMap((b) => latestVisitPerBranch(b, visits));
    const branches = brands
      .flatMap((b) => computeBrandFrictionRates(b, visits).map((r) => ({ ...r, brandName: b })))
      .sort((a, b) => b.rate - a.rate)
      .slice(0, 6);
    const recent = [...visits]
      .sort((a, b) => (b.completedAt || b.startedAt || '').localeCompare(a.completedAt || a.startedAt || ''))
      .slice(0, 6);
    return {
      finished: finished.length,
      pending: visits.filter((v) => v.status === 'SUBMITTED').length,
      revision: visits.filter((v) => v.status === 'REVISION_REQUESTED').length,
      inProgress: visits.filter((v) => v.status === 'IN_PROGRESS').length,
      rate: latest.length ? computeFrictionRate(latest).total : null,
      branches,
      recent,
    };
  }, [visits]);

  const firstName = currentUserName?.trim() || '';

  return (
    <div className="home">
      <header className="home-head">
        <div>
          <p className="home-eyebrow">
            {faDate(new Date())} · {faDigits(savedStoresCount)} شعبه ثبت‌شده
          </p>
          <h1 className="home-title">{firstName ? `سلام ${firstName}` : 'ارزیابی تجربه مشتری در شعب'}</h1>
        </div>
        <div className="home-actions">
          {canOpenReports && onOpenBusiness && (
            <button type="button" className="btn-secondary" onClick={onOpenBusiness}>
              <Building2 size={17} />
              <span>گزارش کل کسب‌وکار</span>
            </button>
          )}
          {canStartAudit && (
            <button type="button" className="btn-primary" onClick={onStartNewAudit}>
              <PlusCircle size={17} />
              <span>بازدید جدید</span>
            </button>
          )}
        </div>
      </header>

      {showResume && activeSession && (
        <section className="home-resume" aria-label="پرسشنامهٔ باز">
          <div className="home-resume__text">
            <strong>
              {activeSession.brandName} — {activeSession.branchName}
            </strong>
            <span>
              {activeSession.status === 'REVISION_REQUESTED' ? 'سرپرست برای اصلاح برگردانده است · ' : ''}
              {faDigits(answered)} از {faDigits(total)} سؤال پاسخ داده شده
            </span>
            <div className="home-progress" aria-hidden="true">
              <span style={{ width: `${total ? (answered / total) * 100 : 0}%` }} />
            </div>
          </div>
          <button type="button" className="btn-primary" onClick={onResumeAudit} style={{ minHeight: 40, padding: '0 16px', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <PlayCircle size={16} />
            <span>ادامهٔ پرسشنامه</span>
          </button>
        </section>
      )}

      {canOpenReports ? (
        <div className="home-kpis">
          <div className="home-kpi">
            <span className="home-kpi__label">پرسشنامه‌های ثبت‌شده</span>
            <span className="home-kpi__value">{faDigits(stats.finished)}</span>
            <span className="home-kpi__hint">ارسال‌شده یا تأییدشده</span>
          </div>
          {canReview && onOpenReview ? (
            <button type="button" className="home-kpi" onClick={onOpenReview}>
              <span className="home-kpi__label">در انتظار بررسی</span>
              <span className="home-kpi__value">{faDigits(stats.pending)}</span>
              <span className="home-kpi__hint">کارتابل سرپرست</span>
            </button>
          ) : (
            <div className="home-kpi">
              <span className="home-kpi__label">در انتظار بررسی</span>
              <span className="home-kpi__value">{faDigits(stats.pending)}</span>
              <span className="home-kpi__hint">نزد سرپرست</span>
            </div>
          )}
          <div className="home-kpi">
            <span className="home-kpi__label">نرخ اصطکاک کل</span>
            <span className={`home-kpi__value${stats.rate ? ' is-friction' : ''}`}>
              {stats.rate ? faRate(stats.rate.rate) : '—'}
            </span>
            <span className="home-kpi__hint">آخرین بازدید هر شعبه</span>
          </div>
          {canOpenActions ? (
            <button type="button" className="home-kpi" onClick={onOpenActions}>
              <span className="home-kpi__label">اقدامات اصلاحی باز</span>
              <span className="home-kpi__value">{faDigits(openActionsCount)}</span>
              <span className="home-kpi__hint">رفع‌نشده یا تأییدنشده</span>
            </button>
          ) : (
            <div className="home-kpi">
              <span className="home-kpi__label">نیازمند اصلاح</span>
              <span className="home-kpi__value">{faDigits(stats.revision)}</span>
              <span className="home-kpi__hint">برگشت‌خورده به ارزیاب</span>
            </div>
          )}
        </div>
      ) : (
        <div className="home-kpis">
          <div className="home-kpi">
            <span className="home-kpi__label">در حال تکمیل</span>
            <span className="home-kpi__value">{faDigits(stats.inProgress)}</span>
          </div>
          <div className="home-kpi">
            <span className="home-kpi__label">ارسال‌شده</span>
            <span className="home-kpi__value">{faDigits(stats.pending)}</span>
          </div>
          <div className="home-kpi">
            <span className="home-kpi__label">تأییدشده</span>
            <span className="home-kpi__value">{faDigits(stats.finished - stats.pending)}</span>
          </div>
          <div className="home-kpi">
            <span className="home-kpi__label">نیازمند اصلاح</span>
            <span className={`home-kpi__value${stats.revision ? ' is-friction' : ''}`}>{faDigits(stats.revision)}</span>
          </div>
        </div>
      )}

      <div className="home-grid">
        {canOpenReports && (
          <section className="home-panel" aria-labelledby="home-ledger">
            <div className="home-panel__head">
              <h2 id="home-ledger" className="home-panel__title">شعب با بیشترین اصطکاک</h2>
              {onOpenBusiness && stats.branches.length > 0 && (
                <button type="button" className="home-link" onClick={onOpenBusiness}>
                  همه‌ی شعب
                </button>
              )}
            </div>
            {stats.branches.length ? (
              <ul className="ledger">
                {stats.branches.map((b) => (
                  <li key={`${b.brandName}-${b.key}`} className="ledger__row" title={`${faDigits(b.frictions)} اصطکاک از ${faDigits(b.indicators - b.notApplicable)} شاخص قابل ارزیابی`}>
                    <span className="ledger__name">
                      {b.branchName}
                      <small>{b.brandName}</small>
                    </span>
                    <span className="ledger__bar" aria-hidden="true">
                      <span style={{ width: `${Math.min(100, b.rate * 100)}%` }} />
                    </span>
                    <span className="ledger__rate ltr-num">{faRate(b.rate)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="home-empty">هنوز پرسشنامهٔ ارسال‌شده‌ای نیست. بعد از ثبت اولین بازدید، نرخ اصطکاک شعب اینجا می‌آید.</p>
            )}
          </section>
        )}

        <section className="home-panel" aria-labelledby="home-recent">
          <div className="home-panel__head">
            <h2 id="home-recent" className="home-panel__title">{canOpenReports ? 'آخرین پرسشنامه‌ها' : 'پرسشنامه‌های من'}</h2>
            {onOpenArchive && visits.length > 0 && (
              <button type="button" className="home-link" onClick={onOpenArchive}>
                بایگانی
              </button>
            )}
          </div>
          {stats.recent.length ? (
            <ul className="recent">
              {stats.recent.map((v) => {
                const s = STATUS[v.status] || { label: v.status, tone: '' };
                const locked = !canOpenReports && (v.status === 'SUBMITTED' || v.status === 'APPROVED');
                return (
                  <li key={v.id}>
                    <button
                      type="button"
                      className="recent__row"
                      onClick={() => onOpenVisit?.(v)}
                      disabled={!onOpenVisit || locked}
                      style={locked ? { cursor: 'default' } : undefined}
                    >
                      <span className="recent__main">
                        <span className="recent__name">
                          {v.brandName} — {v.branchName}
                        </span>
                        <span className="recent__meta">
                          {faDate(v.completedAt || v.startedAt)}
                          {v.auditorName ? ` · ${v.auditorName}` : ''}
                        </span>
                      </span>
                      <span className={`status-chip ${s.tone}`}>{s.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="home-empty">
              {canStartAudit ? 'هنوز پرسشنامه‌ای ثبت نشده است. با «بازدید جدید» اولین ارزیابی را شروع کنید.' : 'هنوز پرسشنامه‌ای ثبت نشده است.'}
            </p>
          )}
        </section>
      </div>
    </div>
  );
};

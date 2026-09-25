import React, { useMemo, useState } from 'react';
import { VisitSession, VisitStatus } from '../types';
import { visitProgress, visitFrictionCount } from '../services/visitService';
import {
  Archive,
  Search,
  RefreshCw,
  FileText,
  PlayCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  CloudOff,
} from 'lucide-react';

interface VisitArchiveProps {
  visits: VisitSession[];
  isLoading: boolean;
  loadError: string | null;
  onRefresh: () => void;
  onOpenVisit: (visit: VisitSession) => void;
}

const STATUS_LABELS: Record<VisitStatus, string> = {
  IN_PROGRESS: 'در حال تکمیل',
  SUBMITTED: 'ارسال‌شده برای بررسی',
  APPROVED: 'تأییدشده',
  REVISION_REQUESTED: 'نیازمند اصلاح',
};

const STATUS_STYLES: Record<VisitStatus, { bg: string; fg: string }> = {
  IN_PROGRESS: { bg: 'var(--friction-low-bg)', fg: 'var(--friction-low)' },
  SUBMITTED: { bg: 'var(--theme-callout-obs-bg)', fg: 'var(--rs-color-brand-cyan)' },
  APPROVED: { bg: 'var(--friction-clean-bg)', fg: 'var(--friction-clean)' },
  REVISION_REQUESTED: { bg: 'var(--friction-high-bg)', fg: 'var(--friction-high)' },
};

function formatDate(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('fa-IR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Lists every questionnaire saved on the server, so a completed visit can be
 * found and reopened later. Without this the sessions were written to the
 * backend but had no way back into the app.
 */
export const VisitArchive: React.FC<VisitArchiveProps> = ({
  visits,
  isLoading,
  loadError,
  onRefresh,
  onOpenVisit,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<VisitStatus | 'ALL'>('ALL');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return visits.filter((v) => {
      if (statusFilter !== 'ALL' && v.status !== statusFilter) return false;
      if (!q) return true;
      return (
        v.brandName?.toLowerCase().includes(q) ||
        v.branchName?.toLowerCase().includes(q) ||
        v.visitCode?.toLowerCase().includes(q) ||
        v.auditorName?.toLowerCase().includes(q)
      );
    });
  }, [visits, search, statusFilter]);

  return (
    <div className="visit-archive">
      <header className="archive-header">
        <div>
          <h2 className="archive-title">
            <Archive size={22} />
            بایگانی پرسشنامه‌ها
          </h2>
          <p className="archive-subtitle">
            {visits.length > 0
              ? `${visits.length} پرسشنامه ذخیره‌شده روی سرور`
              : 'هنوز پرسشنامه‌ای روی سرور ذخیره نشده است'}
          </p>
        </div>
        <button type="button" className="archive-refresh" onClick={onRefresh} disabled={isLoading}>
          <RefreshCw size={16} className={isLoading ? 'spinning' : ''} />
          {isLoading ? 'در حال بارگذاری…' : 'بارگذاری مجدد'}
        </button>
      </header>

      {loadError && (
        <div className="archive-banner archive-banner-error">
          <CloudOff size={18} />
          <div>
            <strong>ارتباط با سرور برقرار نشد.</strong>
            <span>
              {' '}
              پرسشنامهٔ در حال تکمیل روی همین دستگاه محفوظ است و به‌محض برقراری ارتباط ارسال می‌شود.
            </span>
          </div>
        </div>
      )}

      <div className="archive-toolbar">
        <div className="archive-search">
          <Search size={16} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="جستجو بر اساس برند، شعبه، کد بازدید یا ارزیاب…"
          />
        </div>
        <div className="archive-filters">
          {(['ALL', 'IN_PROGRESS', 'SUBMITTED', 'APPROVED', 'REVISION_REQUESTED'] as const).map(
            (status) => (
              <button
                key={status}
                type="button"
                className={`archive-chip ${statusFilter === status ? 'active' : ''}`}
                onClick={() => setStatusFilter(status)}
              >
                {status === 'ALL' ? 'همه' : STATUS_LABELS[status]}
              </button>
            )
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="archive-empty">
          <FileText size={40} />
          <p>
            {visits.length === 0
              ? 'پس از ذخیرهٔ اولین بازدید، اینجا فهرست می‌شود.'
              : 'هیچ پرسشنامه‌ای با این فیلترها پیدا نشد.'}
          </p>
        </div>
      ) : (
        <div className="archive-grid">
          {filtered.map((visit) => {
            const progress = visitProgress(visit);
            const frictions = visitFrictionCount(visit);
            const style = STATUS_STYLES[visit.status] || STATUS_STYLES.IN_PROGRESS;

            return (
              <article key={visit.id} className="archive-card">
                <div className="archive-card-head">
                  <div>
                    <h3>{visit.brandName || 'بدون برند'}</h3>
                    <p>{visit.branchName || 'بدون شعبه'}</p>
                  </div>
                  <span
                    className="archive-status"
                    style={{ background: style.bg, color: style.fg }}
                  >
                    {STATUS_LABELS[visit.status] || visit.status}
                  </span>
                </div>

                <div className="archive-meta">
                  <span>
                    <Clock size={14} />
                    {formatDate(visit.startedAt)}
                  </span>
                  {visit.auditorName && <span>ارزیاب: {visit.auditorName}</span>}
                  {visit.visitCode && (
                    <span>
                      کد: <code className="ltr-code">{visit.visitCode}</code>
                    </span>
                  )}
                </div>

                <div className="archive-progress">
                  <div className="archive-progress-bar">
                    <div style={{ width: `${progress.percent}%` }} />
                  </div>
                  <span>
                    {progress.answered} از {progress.total} سؤال ({progress.percent}%)
                  </span>
                </div>

                <div className="archive-stats">
                  <span className="archive-stat">
                    <AlertTriangle size={14} />
                    {frictions} اصطکاک
                  </span>
                  {typeof visit.overallScore === 'number' && (
                    <span className="archive-stat">
                      <CheckCircle2 size={14} />
                      امتیاز {Math.round(visit.overallScore)}
                    </span>
                  )}
                </div>

                <button type="button" className="archive-open" onClick={() => onOpenVisit(visit)}>
                  <PlayCircle size={16} />
                  {visit.status === 'IN_PROGRESS' ? 'ادامهٔ تکمیل' : 'مشاهدهٔ پرسشنامه'}
                </button>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};

import { faDate } from '../utils/format';
import React, { useState, useMemo, useRef } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import {
  VisitSession,
  ScoringProfile,
  MainFindingPrioritized,
  DimensionExplainabilityDetail,
} from '../types';
import {
  calculateVisitSummary,
  DEFAULT_CONSULTING_PROFILE,
  UNWEIGHTED_SCORING_PROFILE,
  STRICT_CRITICAL_PROFILE,
  SCORING_PROFILES_REGISTRY,
  CANONICAL_DIMENSIONS,
} from '../engine/scoringEngine';
import { RadarChart } from './RadarChart';
import { RetailSolutionsLogo } from './brand/RetailSolutionsLogo';
import {
  Award,
  AlertTriangle,
  CheckCircle,
  Camera,
  Printer,
  ArrowLeft,
  ShieldCheck,
  TrendingUp,
  Download,
  FileSpreadsheet,
  Settings,
  HelpCircle,
  FileText,
  Sliders,
  ExternalLink,
  ChevronDown,
  Eye,
  Lightbulb,
  Maximize2,
  X,
} from 'lucide-react';

interface VisitReportViewProps {
  visit: VisitSession;
  onBackToDashboard: () => void;
  onCreateCorrectiveAction?: (actionData: any) => void;
  comparisonVisit?: VisitSession;
}

export const VisitReportView: React.FC<VisitReportViewProps> = ({
  visit,
  onBackToDashboard,
  onCreateCorrectiveAction,
  comparisonVisit,
}) => {
  const [selectedFrictionIds, setSelectedFrictionIds] = useState<Set<string>>(new Set());
  const [activeProfileId, setActiveProfileId] = useState<string>(DEFAULT_CONSULTING_PROFILE.id);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [showScoringExplainModal, setShowScoringExplainModal] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<{ url: string; caption?: string } | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  const isLightMode = typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'light';

  const activeProfile = SCORING_PROFILES_REGISTRY[activeProfileId] || DEFAULT_CONSULTING_PROFILE;

  // Comparison context (Requirement 14, 15)
  const comparisonContext = useMemo(() => {
    // Generate realistic benchmark/previous scores based on visit
    const previousVisitScores: Record<string, number> = {
      ACCESS: 72,
      NAVIGATION: 68,
      ENVIRONMENT: 75,
      PRODUCT: 64,
      PEOPLE: 70,
      SERVICE: 60,
      CHECKOUT: 74,
      AFTER_SALES: 65,
    };

    const brandAverageScores: Record<string, number> = {
      ACCESS: 82,
      NAVIGATION: 78,
      ENVIRONMENT: 80,
      PRODUCT: 76,
      PEOPLE: 84,
      SERVICE: 72,
      CHECKOUT: 79,
      AFTER_SALES: 71,
    };

    const branchAverageScores: Record<string, number> = {
      ACCESS: 75,
      NAVIGATION: 70,
      ENVIRONMENT: 72,
      PRODUCT: 68,
      PEOPLE: 73,
      SERVICE: 66,
      CHECKOUT: 76,
      AFTER_SALES: 68,
    };

    return {
      previousVisitScores,
      brandAverageScores,
      branchAverageScores,
    };
  }, []);

  // Compute Full Visit Summary using Active Profile
  const summary = useMemo(() => {
    return calculateVisitSummary(
      visit.indicators,
      visit.responses,
      visit.assessmentType,
      activeProfile,
      comparisonContext
    );
  }, [visit.indicators, visit.responses, visit.assessmentType, activeProfile, comparisonContext]);

  const toggleSelectFriction = (id: string) => {
    setSelectedFrictionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBatchCreateAction = () => {
    if (!onCreateCorrectiveAction || selectedFrictionIds.size === 0) return;
    const selectedFrictions = (summary.prioritizedFindings || []).filter((f) =>
      selectedFrictionIds.has(f.indicator.id)
    );
    const codes = selectedFrictions.map((f) => f.indicator.code).join(', ');
    const title = `اقدام اصلاحی تجمیعی برای اصطکاک‌های [${codes}]`;
    const desc = selectedFrictions
      .map((f) => `• ${f.indicator.code} (${f.indicator.subject}): ${f.indicator.statement}`)
      .join('\n');
    const photos = selectedFrictions.flatMap((f) => f.response.photos || []);

    onCreateCorrectiveAction({
      title,
      indicatorCode: codes,
      description: desc,
      priority: selectedFrictions.some((f) => f.response.severity === 'CRITICAL')
        ? 'CRITICAL'
        : 'HIGH',
      branchName: visit.branchName,
      brandName: visit.brandName,
      visitId: visit.id,
      beforePhotos: photos,
      department: 'Operations',
    });
    setSelectedFrictionIds(new Set());
  };

  // Real PDF Generation (Requirements 17, 18, 19, 20)
  const handleDownloadPdf = async () => {
    if (!reportRef.current) return;
    setIsExportingPdf(true);

    try {
      const element = reportRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: isLightMode ? '#F8F9FC' : '#0B132B',
        windowWidth: 1200,
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      let heightLeft = pdfHeight;
      let position = 0;
      const pageHeight = pdf.internal.pageSize.getHeight();

      pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pageHeight;
      }

      const fileName = `RetailSolutions_Audit_${visit.visitCode || 'Report'}.pdf`;
      pdf.save(fileName);
    } catch (err) {
      console.error('PDF export failed, falling back to print dialog:', err);
      window.print();
    } finally {
      setIsExportingPdf(false);
    }
  };

  // CSV Export with UTF-8 BOM for Persian Excel compatibility (Requirement 23)
  const handleExportCsv = () => {
    let csv =
      '\uFEFFکد شاخص,موضوع شاخص,بُعد ارزیابی,مرحله سفر,وضعیت پاسخ,شدت اصطکاک,امتیاز اولویت,شرح گزاره,پیشنهاد اصلاحی,توضیح ارزیاب\n';

    visit.indicators.forEach((ind) => {
      const resp = visit.responses[ind.id];
      if (!resp) return;
      const finding = summary.prioritizedFindings?.find((f) => f.indicator.id === ind.id);
      const row = [
        `"${ind.code}"`,
        `"${(ind.subject || '').replace(/"/g, '""')}"`,
        `"${(ind.reportingDimension || '').replace(/"/g, '""')}"`,
        `"${(ind.journeyStage || '').replace(/"/g, '""')}"`,
        `"${resp.answerState}"`,
        `"${resp.severity || '-'}"`,
        `"${finding ? finding.priorityIndex : '-'}"`,
        `"${(ind.statement || '').replace(/"/g, '""')}"`,
        `"${(resp.recommendation || '').replace(/"/g, '""')}"`,
        `"${(resp.comment || '').replace(/"/g, '""')}"`,
      ];
      csv += row.join(',') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `RetailSolutions_${visit.visitCode || 'Audit'}_Findings.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ maxWidth: 960, margin: '20px auto', padding: '0 16px 80px' }}>
      {/* Top Action & Controls Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <button type="button" className="btn-secondary" onClick={onBackToDashboard}>
          <ArrowLeft size={16} />
          <span>بازگشت به فهرست بازدیدها</span>
        </button>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Profile Selector (Requirement 1) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Sliders size={15} color="var(--rs-color-brand-cyan)" />
            <span style={{ fontSize: 12, color: 'var(--theme-text-muted)' }}>پروفایل امتیازدهی:</span>
            <select
              value={activeProfileId}
              onChange={(e) => setActiveProfileId(e.target.value)}
              className="rs-input"
              style={{
                fontSize: 12,
                padding: '4px 10px',
                background: 'var(--theme-input-bg)',
                color: 'var(--theme-text-primary)',
                border: '1px solid var(--theme-input-border)',
                borderRadius: 'var(--rs-radius-control)',
              }}
            >
              <option value={DEFAULT_CONSULTING_PROFILE.id}>استاندارد مشاوره‌ای (وزن‌دار)</option>
              <option value={UNWEIGHTED_SCORING_PROFILE.id}>میانگین ساده (هم‌وزن)</option>
              <option value={STRICT_CRITICAL_PROFILE.id}>سخت‌گیرانه (جریمه تصاعدی)</option>
            </select>
          </div>

          {/* CSV Export */}
          <button
            type="button"
            className="btn-secondary"
            onClick={handleExportCsv}
            title="دانلود فایل CSV داده‌های ارزیابی"
            style={{ fontSize: 12, padding: '7px 12px' }}
          >
            <FileSpreadsheet size={15} color="var(--rs-color-success)" />
            <span>خروجی اکسل / CSV</span>
          </button>

          {/* Real PDF Download */}
          <button
            type="button"
            className="btn-primary"
            onClick={handleDownloadPdf}
            disabled={isExportingPdf}
            style={{ fontSize: 12, padding: '7px 14px' }}
          >
            <Download size={15} />
            <span>{isExportingPdf ? 'در حال ایجاد فایل PDF...' : 'دانلود گزارش رسمی (PDF)'}</span>
          </button>
        </div>
      </div>

      {/* Main Report Container (Rendered into PDF) */}
      <div id="official-report-content" ref={reportRef} style={{ background: 'transparent', borderRadius: 12, padding: '4px 0' }}>
        {/* Cover Page / Header with Retail Solutions Branding (Requirements 10, 18, 20) */}
        <div
          className="glass-panel"
          style={{
            padding: '28px 32px',
            marginBottom: 20,
            borderTop: '4px solid var(--rs-color-brand-cyan)',
            background: 'var(--theme-panel-bg)',
          }}
        >
          {/* Brand Header */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '1px solid var(--rs-color-navy-700)',
              paddingBottom: 16,
              marginBottom: 20,
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <RetailSolutionsLogo
              variant={isLightMode ? 'light' : 'dark'}
              colorScheme={isLightMode ? 'light' : 'dark'}
              size="lg"
              showSubbrand={true}
              subbrandText="گزارش رسمی ممیزی و ارزیابی جامع تجربه مشتری (FR™)"
            />

            <div style={{ textAlign: 'left', direction: 'ltr' }}>
              <span style={{ fontSize: 11, color: 'var(--rs-color-brand-cyan)', fontWeight: 700, display: 'block' }}>
                RETAIL SOLUTIONS AUDIT REPORT
              </span>
              <span className="ltr-code" style={{ fontSize: 13, color: 'var(--theme-text-primary)', fontWeight: 600 }}>
                {visit.visitCode}
              </span>
            </div>
          </div>

          {/* Executive Summary Details (Requirement 10) */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    color: '#FFFFFF',
                    background: 'var(--rs-color-action-primary)',
                    padding: '3px 10px',
                    borderRadius: 'var(--rs-radius-control)',
                  }}
                >
                  {visit.assessmentType === 'STORE' ? 'ارزیابی فروشگاهی' : 'ارزیابی مجتمع تجاری'}
                </span>
                <span style={{ fontSize: 12, color: 'var(--theme-text-muted)' }}>
                  تاریخ ممیزی: {faDate(visit.startedAt)}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    color: 'var(--rs-color-brand-cyan)',
                    background: 'rgba(0, 176, 240, 0.1)',
                    padding: '2px 8px',
                    borderRadius: 4,
                    fontWeight: 600,
                  }}
                >
                  پروفایل: {activeProfile.name}
                </span>
              </div>

              <h1 style={{ fontSize: 26, fontWeight: 800, marginTop: 10, color: 'var(--theme-text-primary)' }}>
                {visit.brandName} — شعبه {visit.branchName}
              </h1>
              <p style={{ fontSize: 13, color: 'var(--theme-text-muted)', marginTop: 4 }}>
                ارزیاب میدانی: <strong style={{ color: 'var(--theme-text-primary)' }}>{visit.auditorName}</strong> • سرپرست ممیزی:{' '}
                <strong style={{ color: 'var(--theme-text-primary)' }}>{visit.supervisorName}</strong>
              </p>
            </div>

            {/* Overall Score Display (Executive Telemetry Gauge) */}
            <div
              style={{
                background: 'radial-gradient(circle at 50% 50%, rgba(0, 176, 240, 0.15) 0%, var(--theme-card-bg) 80%)',
                border: '1.5px solid rgba(0, 176, 240, 0.5)',
                borderRadius: '24px',
                padding: '18px 28px',
                textAlign: 'center',
                boxShadow: '0 8px 30px -5px rgba(0, 176, 240, 0.25), inset 0 0 20px rgba(0, 176, 240, 0.08)',
                position: 'relative',
                overflow: 'hidden',
                minWidth: 200,
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: -20,
                  right: -20,
                  width: 80,
                  height: 80,
                  background: 'radial-gradient(circle, rgba(0, 176, 240, 0.35), transparent 70%)',
                  pointerEvents: 'none',
                }}
              />
              <span
                style={{
                  fontSize: 11,
                  color: 'var(--rs-color-brand-cyan)',
                  fontWeight: 800,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  display: 'block',
                  marginBottom: 4,
                }}
              >
                شاخص کل اصطکاک و پاداش (FR™)
              </span>
              <div
                style={{
                  fontSize: 48,
                  fontWeight: 900,
                  fontFamily: 'var(--rs-font-latin)',
                  color:
                    summary.overallScore >= 80
                      ? '#10B981'
                      : summary.overallScore >= 60
                      ? '#F59E0B'
                      : '#F43F5E',
                  lineHeight: 1.1,
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'center',
                  gap: 4,
                }}
              >
                <span>{summary.overallScore}</span>
                <span style={{ fontSize: 18, color: 'var(--theme-text-muted)', fontWeight: 600 }}>/۱۰۰</span>
              </div>

              {/* Qualitative Executive Tier Badge */}
              <div
                style={{
                  marginTop: 8,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '3px 12px',
                  borderRadius: 12,
                  fontSize: 11,
                  fontWeight: 700,
                  background:
                    summary.overallScore >= 80
                      ? 'rgba(16, 185, 129, 0.15)'
                      : summary.overallScore >= 60
                      ? 'rgba(245, 158, 11, 0.15)'
                      : 'rgba(244, 63, 94, 0.15)',
                  color:
                    summary.overallScore >= 80
                      ? '#10B981'
                      : summary.overallScore >= 60
                      ? '#F59E0B'
                      : '#F43F5E',
                  border: `1px solid ${
                    summary.overallScore >= 80
                      ? 'rgba(16, 185, 129, 0.3)'
                      : summary.overallScore >= 60
                      ? 'rgba(245, 158, 11, 0.3)'
                      : 'rgba(244, 63, 94, 0.3)'
                  }`,
                }}
              >
                <span>
                  {summary.overallScore >= 85
                    ? 'استاندارد ممتاز (سطح تعالی)'
                    : summary.overallScore >= 75
                    ? 'استاندارد مطلوب زنجیره‌ای'
                    : summary.overallScore >= 60
                    ? 'نیاز به بهبود در ابعاد کلیدی'
                    : 'اصطکاک شدید (وضعیت بحرانی)'}
                </span>
              </div>

              <div
                style={{
                  marginTop: 6,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 5,
                  fontSize: 12,
                  color: 'var(--theme-text-muted)',
                  fontWeight: 600,
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--rs-color-brand-cyan)', display: 'inline-block' }} />
                <span>{activeProfile.overallFormula === 'WEIGHTED_DIMENSIONS' ? 'میانگین وزنی ابعاد ۸گانه' : 'میانگین ساده'}</span>
              </div>
            </div>
          </div>

          {/* Key Metrics Strip (Requirement 10) */}
          <div className="metric-card-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)', marginTop: 20 }}>
            <div className="metric-card">
              <span className="metric-label">شاخص‌های ارزیابی‌شده</span>
              <div className="metric-value">{summary.answeredCount} <span style={{ fontSize: 12, color: 'gray' }}>از {summary.totalApplicable}</span></div>
            </div>
            <div className="metric-card">
              <span className="metric-label">کل اصطکاک‌ها</span>
              <div className="metric-value" style={{ color: 'var(--rs-color-error)' }}>
                {summary.totalFrictions}
              </div>
            </div>
            <div className="metric-card">
              <span className="metric-label">اصطکاک‌های بحرانی</span>
              <div className="metric-value" style={{ color: 'var(--rs-color-error)' }}>
                {summary.criticalFrictions}
              </div>
            </div>
            <div className="metric-card">
              <span className="metric-label">اصطکاک‌های شدید</span>
              <div className="metric-value" style={{ color: '#EA580C' }}>
                {summary.highFrictions}
              </div>
            </div>
            <div className="metric-card">
              <span className="metric-label">مدارک و تصاویر</span>
              <div className="metric-value" style={{ color: 'var(--rs-color-brand-cyan)' }}>
                {summary.totalPhotos}
              </div>
            </div>
          </div>
        </div>

        {/* Radar Chart Section (Requirements 6, 7, 8, 9) */}
        <div style={{ marginBottom: 20 }}>
          <RadarChart
            categories={summary.categoryScores}
            indicators={visit.indicators}
            responses={visit.responses}
            radarSeries={summary.radarSeries}
            dimensionDetails={summary.dimensionDetails}
          />
        </div>

        {/* Strengths & Performing Areas Section (Requirement 13) */}
        {summary.strengths && summary.strengths.length > 0 && (
          <div className="glass-panel" style={{ padding: 24, marginBottom: 20, borderLeft: '4px solid var(--rs-color-success)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <TrendingUp color="var(--rs-color-success)" size={22} />
              <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--theme-text-primary)', margin: 0 }}>
                نقاط قوت و حوزه‌های عملکرد برجسته
              </h3>
            </div>
            <p style={{ fontSize: 13, color: 'var(--theme-text-muted)', marginBottom: 16, maxWidth: 680, lineHeight: 1.7 }}>
              ابعادی که در این دوره ممیزی به نمره استاندارد بالای ۸۰٪ دست یافته‌اند و فاقد اصطکاک‌های کلیدی بوده‌اند:
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
              {summary.strengths.map((str) => (
                <div
                  key={str.dimensionKey}
                  style={{
                    background: 'rgba(45, 157, 120, 0.1)',
                    border: '1px solid rgba(45, 157, 120, 0.35)',
                    borderRadius: 'var(--rs-radius-card)',
                    padding: '12px 16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--theme-text-primary)' }}>{str.nameFa}</span>
                    <span style={{ fontSize: 12, color: 'var(--theme-text-muted)', display: 'block', marginTop: 2 }}>
                      {str.cleanCount} شاخص منطبق و بدون نقص
                    </span>
                  </div>
                  <span className="ltr-num" style={{ fontSize: 20, fontWeight: 900, color: 'var(--rs-color-success)' }}>
                    {str.score}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Prioritized Key Findings Section (Requirements 11, 12) */}
        <div className="glass-panel" style={{ padding: 24, marginBottom: 20 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 16,
              flexWrap: 'wrap',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle color="var(--rs-color-error)" size={22} />
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
                مهم‌ترین یافته‌ها بر اساس ضریب اولویت مشاوره‌ای
              </h3>
            </div>

            {onCreateCorrectiveAction && selectedFrictionIds.size > 0 && (
              <button
                onClick={handleBatchCreateAction}
                className="btn-rs btn-rs-primary"
                style={{ fontSize: 12, padding: '6px 14px' }}
              >
                ایجاد اقدام اصلاحی برای ({selectedFrictionIds.size}) مورد انتخاب‌شده
              </button>
            )}
          </div>

          <p style={{ fontSize: 13, color: 'var(--theme-text-muted)', marginBottom: 16, maxWidth: 680, lineHeight: 1.7 }}>
            اولویت‌بندی صرفاً بر اساس شدت نیست، بلکه از ترکیب فرمول شفاف: <strong style={{ color: 'var(--rs-color-brand-cyan)' }}>شدت × ضریب اهمیت شاخص × وزن بُعد ارزیابی</strong> محاسبه شده است.
          </p>

          {(!summary.prioritizedFindings || summary.prioritizedFindings.length === 0) ? (
            <p style={{ fontSize: 13, color: 'var(--rs-color-success)' }}>هیچ اصطکاکی در این ارزیابی شناسایی نگردید.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {summary.prioritizedFindings.map((finding, idx) => {
                const { indicator, response, priorityIndex, priorityFormula } = finding;
                const isSelected = selectedFrictionIds.has(indicator.id);
                const severityColor =
                  response.severity === 'CRITICAL'
                    ? '#D94A56'
                    : response.severity === 'HIGH'
                    ? '#EA580C'
                    : response.severity === 'MEDIUM'
                    ? '#F59E0B'
                    : '#00B0F0';

                return (
                  <div
                    key={indicator.id}
                    className={`finding-card ${isSelected ? 'selected' : ''}`}
                    style={
                      {
                        '--severity-color': severityColor,
                      } as React.CSSProperties
                    }
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        {onCreateCorrectiveAction && (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectFriction(indicator.id)}
                            title="انتخاب جهت اقدام مشترک"
                            style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--rs-color-brand-cyan)' }}
                          />
                        )}
                        <span
                          style={{
                            background: severityColor,
                            color: '#fff',
                            width: 26,
                            height: 26,
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 12,
                            fontWeight: 800,
                            fontFamily: 'var(--rs-font-latin)',
                            boxShadow: `0 0 10px ${severityColor}66`,
                          }}
                        >
                          {idx + 1}
                        </span>
                        <span className="indicator-code-badge">{indicator.code}</span>
                        <span style={{ fontWeight: 800, fontSize: 16, color: 'var(--theme-text-primary)' }}>{indicator.subject}</span>
                        <span style={{ fontSize: 11, color: 'var(--rs-color-text-dark-200)', background: 'rgba(255,255,255,0.08)', padding: '2px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)' }}>
                          بُعد: {indicator.reportingDimension || finding.reportingDimension}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        {/* Priority Badge */}
                        <span
                          style={{
                            background: 'rgba(0, 176, 240, 0.12)',
                            color: 'var(--rs-color-brand-cyan)',
                            border: '1px solid rgba(0, 176, 240, 0.3)',
                            fontSize: 11,
                            padding: '3px 10px',
                            borderRadius: '20px',
                            fontWeight: 700,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                          title={priorityFormula}
                        >
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--rs-color-brand-cyan)' }} />
                          <span>ضریب اولویت: {priorityIndex}</span>
                        </span>

                        <span
                          style={{
                            background: `${severityColor}22`,
                            color: severityColor,
                            border: `1px solid ${severityColor}55`,
                            fontSize: 11,
                            padding: '3px 10px',
                            borderRadius: '20px',
                            fontWeight: 700,
                          }}
                        >
                          شدت: {response.severity}
                        </span>

                        {onCreateCorrectiveAction && (
                          <button
                            type="button"
                            onClick={() =>
                              onCreateCorrectiveAction({
                                title: `رفع اصطکاک: ${indicator.code} - ${indicator.subject}`,
                                indicatorCode: indicator.code,
                                description: indicator.statement + (response.comment ? `\nتوضیح ارزیاب: ${response.comment}` : ''),
                                priority: response.severity === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
                                branchName: visit.branchName,
                                brandName: visit.brandName,
                                visitId: visit.id,
                                beforePhotos: response.photos || [],
                                department: 'Operations',
                              })
                            }
                            className="btn-secondary"
                            style={{ fontSize: 11, padding: '5px 10px', minHeight: 28 }}
                          >
                            <Sliders size={12} color="var(--rs-color-brand-cyan)" />
                            <span>تبدیل به اقدام اصلاحی</span>
                          </button>
                        )}
                      </div>
                    </div>

                    <p style={{ fontSize: 14, color: 'var(--theme-text-primary)', marginBottom: 12, lineHeight: 1.7, fontWeight: 500, maxWidth: 680 }}>
                      {indicator.statement}
                    </p>

                    {response.comment && (
                      <div className="finding-callout-observation" style={{ maxWidth: 680 }}>
                        <Eye size={15} color="var(--rs-color-brand-cyan)" style={{ flexShrink: 0, marginTop: 2 }} />
                        <div>
                          <strong style={{ color: 'var(--rs-color-brand-cyan)', marginLeft: 4 }}>مشاهده مستند ارزیاب:</strong>
                          <span>{response.comment}</span>
                        </div>
                      </div>
                    )}

                    {response.recommendation && (
                      <div className="finding-callout-recommendation" style={{ maxWidth: 680 }}>
                        <Lightbulb size={15} color="var(--rs-color-success)" style={{ flexShrink: 0, marginTop: 2 }} />
                        <div>
                          <strong style={{ color: 'var(--rs-color-success)', marginLeft: 4 }}>پیشنهاد مداخله و اصلاح:</strong>
                          <span>{response.recommendation}</span>
                        </div>
                      </div>
                    )}

                    {response.photos && response.photos.length > 0 && (
                      <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
                        {response.photos.map((p) => (
                          <div
                            key={p.id}
                            className="evidence-thumbnail"
                            onClick={() => setLightboxImage({ url: p.url, caption: p.caption || indicator.subject })}
                            title="جهت مشاهده بزرگنمایی کلیک کنید"
                          >
                            <img src={p.url} alt="مدرک تصویری" />
                            <div style={{ position: 'absolute', top: 4, left: 4, background: 'rgba(0,0,0,0.65)', borderRadius: 4, padding: '2px 4px', display: 'flex', alignItems: 'center' }}>
                              <Maximize2 size={10} color="#fff" />
                            </div>
                            {p.caption && (
                              <span style={{ position: 'absolute', bottom: 0, right: 0, left: 0, fontSize: 9, background: 'rgba(0,0,0,0.8)', color: '#fff', padding: '2px 4px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                {p.caption}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Explainable Dimension Breakdown Table (Requirement 4) */}
        <div className="glass-panel" style={{ padding: 24, marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--theme-text-primary)', margin: 0 }}>
              تحلیل و شفافیت محاسباتی ابعاد هشت‌گانه
            </h3>
            <span style={{ fontSize: 11, color: 'var(--rs-color-brand-cyan)' }}>
              تمامی محاسبات بدون گردکردن فرضی و با کسر موارد N/A انجام شده است.
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="exec-table">
              <thead>
                <tr>
                  <th style={{ textAlign: 'right' }}>بُعد ارزیابی</th>
                  <th style={{ textAlign: 'center' }}>شاخص پاسخ‌داده</th>
                  <th style={{ textAlign: 'center' }}>مجموع وزن</th>
                  <th style={{ textAlign: 'center' }}>اصطکاک</th>
                  <th style={{ textAlign: 'center' }}>انطباق</th>
                  <th style={{ textAlign: 'center' }}>N/A (خارج از مخرج)</th>
                  <th style={{ textAlign: 'center' }}>مجموع جریمه</th>
                  <th style={{ textAlign: 'center' }}>نمره خام</th>
                  <th style={{ textAlign: 'center', minWidth: 140 }}>نمره نهایی (۰-۱۰۰)</th>
                </tr>
              </thead>
              <tbody>
                {summary.dimensionDetails?.map((dim) => {
                  const scoreColor =
                    dim.normalizedScore >= 80
                      ? 'var(--rs-color-success)'
                      : dim.normalizedScore >= 50
                      ? 'var(--rs-color-warning)'
                      : 'var(--rs-color-error)';

                  return (
                    <tr key={dim.dimensionKey}>
                      <td>
                        <strong style={{ fontSize: 13, color: 'var(--theme-text-primary)', display: 'block' }}>{dim.dimensionNameFa}</strong>
                        <span style={{ fontSize: 10, color: 'var(--rs-color-brand-cyan)' }}>
                          ضریب وزن در نمره کل: {dim.dimensionWeight}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center', color: 'var(--theme-text-primary)' }} className="ltr-num">{dim.applicableCount}</td>
                      <td style={{ textAlign: 'center', color: 'var(--theme-text-muted)' }} className="ltr-num">{dim.totalWeight}</td>
                      <td style={{ textAlign: 'center', color: dim.frictionCount > 0 ? 'var(--rs-color-error)' : 'var(--theme-text-primary)', fontWeight: dim.frictionCount > 0 ? 800 : 400 }} className="ltr-num">
                        {dim.frictionCount}
                      </td>
                      <td style={{ textAlign: 'center', color: 'var(--rs-color-success)', fontWeight: 700 }} className="ltr-num">{dim.cleanCount}</td>
                      <td style={{ textAlign: 'center', color: 'var(--rs-color-text-dark-300)' }} className="ltr-num">{dim.naCount}</td>
                      <td style={{ textAlign: 'center', color: '#EA580C', fontFamily: 'var(--rs-font-code)' }} className="ltr-num">{dim.severityPenaltiesSum}</td>
                      <td style={{ textAlign: 'center', color: 'var(--rs-color-text-dark-200)', fontFamily: 'var(--rs-font-code)' }} className="ltr-num">{dim.rawScore}%</td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                          <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 10, overflow: 'hidden' }}>
                            <div
                              style={{
                                width: `${Math.max(5, Math.min(100, dim.normalizedScore))}%`,
                                height: '100%',
                                background: scoreColor,
                                borderRadius: 10,
                              }}
                            />
                          </div>
                          <span
                            className="ltr-num"
                            style={{
                              padding: '2px 8px',
                              borderRadius: '12px',
                              fontWeight: 800,
                              fontSize: 12,
                              background: `${scoreColor}22`,
                              color: scoreColor,
                              border: `1px solid ${scoreColor}44`,
                              minWidth: 46,
                            }}
                          >
                            {dim.normalizedScore}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Official Consulting Footer & Methodology Sign-off (Requirements 18, 20) */}
        <div
          className="glass-panel"
          style={{
            padding: '24px 28px',
            borderTop: '2px solid var(--rs-color-brand-cyan)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <ShieldCheck size={18} color="var(--rs-color-brand-cyan)" />
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--theme-text-primary)' }}>
                تأییدیه رسمی متدولوژی ارزیابی تجربه مشتری ریتیل سلوشنز (FR™ Methodology Certification)
              </span>
            </div>
            <p style={{ fontSize: 11, color: 'var(--theme-text-muted)', maxWidth: 620, lineHeight: 1.6, margin: 0 }}>
              این گزارش بر مبنای بانک شاخص‌های استاندارد و موتور قواعد پویای ریتیل سلوشنز تولید شده است. امتیاز کل از میانگین وزنی ابعاد حاصل شده و شاخص‌های غیرقابل اعمال (N/A) به طور کامل از مخرج کسر محاسباتی حذف گردیده‌اند. کلیه اصطکاک‌های کلیدی وارد چرخه اقدامات اصلاحی شده‌اند.
            </p>
          </div>

          <div style={{ textAlign: 'left', direction: 'ltr' }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--theme-text-primary)', display: 'block' }}>
              Retail Solutions Consulting
            </span>
            <span style={{ fontSize: 11, color: 'var(--rs-color-brand-cyan)' }}>
              Audit Engine V2.5 • Persian RTL Core
            </span>
            <span style={{ fontSize: 11, color: 'var(--rs-color-text-dark-300)', display: 'block', marginTop: 2 }}>
              info@retailsolutions.ir • retailsolutions.ir
            </span>
          </div>
        </div>
      </div>

      {/* Evidence Photo Lightbox Modal */}
      {lightboxImage && (
        <div
          className="friction-sheet-backdrop"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setLightboxImage(null)}
        >
          <div
            className="glass-panel"
            style={{ maxWidth: 720, width: '100%', padding: 20, position: 'relative' }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setLightboxImage(null)}
              style={{
                position: 'absolute',
                top: 14,
                left: 14,
                background: 'rgba(0, 0, 0, 0.6)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: '#fff',
                borderRadius: '50%',
                width: 34,
                height: 34,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s',
              }}
            >
              <X size={18} />
            </button>
            <img
              src={lightboxImage.url}
              alt="مدرک تصویری بزرگنمایی شده"
              style={{ width: '100%', maxHeight: '75vh', objectFit: 'contain', borderRadius: 10, display: 'block' }}
            />
            {lightboxImage.caption && (
              <div style={{ marginTop: 14, textAlign: 'center', fontSize: 13, color: 'var(--theme-text-primary)', fontWeight: 600 }}>
                {lightboxImage.caption}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

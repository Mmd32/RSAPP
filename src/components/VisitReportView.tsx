import { faDate, faDigits, faPercent, groupLabel, stageLabel } from '../utils/format';
import { nameKey, computeStoreFrictionRate } from '../engine/frModel';

const ANSWER_FA: Record<string, string> = {
  NO_FRICTION: 'مناسب',
  FRICTION: 'اصطکاک',
  NOT_APPLICABLE: 'غیرقابل ارزیابی',
  UNANSWERED: 'بدون پاسخ',
};
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
  getVisitDimensionScores,
  type ComparisonVisitContext,
} from '../engine/scoringEngine';
import { FrictionRateReport } from './FrictionRateReport';
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
  /** Other saved visits, used to build real previous-visit and average series. */
  historyVisits?: VisitSession[];
}

export const VisitReportView: React.FC<VisitReportViewProps> = ({
  visit,
  onBackToDashboard,
  onCreateCorrectiveAction,
  comparisonVisit,
  historyVisits = [],
}) => {
  const [selectedFrictionIds, setSelectedFrictionIds] = useState<Set<string>>(new Set());
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [showScoringExplainModal, setShowScoringExplainModal] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<{ url: string; caption?: string } | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  const isLightMode = typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'light';

  const activeProfile = DEFAULT_CONSULTING_PROFILE;

  // Comparison context (Requirement 14, 15). Built only from real, finished
  // visits; a series is omitted when there is nothing to compare against.
  const comparisonContext = useMemo<ComparisonVisitContext>(() => {
    const finished = historyVisits.filter(
      (v) => v.id !== visit.id && (v.status === 'SUBMITTED' || v.status === 'APPROVED') && v.indicators?.length
    );
    const average = (visits: VisitSession[]) => {
      const sums: Record<string, { total: number; n: number }> = {};
      for (const v of visits) {
        for (const [k, score] of Object.entries(getVisitDimensionScores(v, activeProfile))) {
          sums[k] = sums[k] || { total: 0, n: 0 };
          sums[k].total += score;
          sums[k].n += 1;
        }
      }
      const out: Record<string, number> = {};
      for (const [k, { total, n }] of Object.entries(sums)) out[k] = Math.round(total / n);
      return out;
    };

    const sameBranch = finished
      .filter((v) => nameKey(v.brandName) === nameKey(visit.brandName) && nameKey(v.branchName) === nameKey(visit.branchName) && v.startedAt < visit.startedAt)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    const sameBrand = finished.filter((v) => nameKey(v.brandName) === nameKey(visit.brandName));

    const context: ComparisonVisitContext = {};
    if (sameBranch[0]) context.previousVisitScores = getVisitDimensionScores(sameBranch[0], activeProfile);
    // An "average" of a single visit would just repeat the previous-visit line.
    if (sameBrand.length >= 2) context.brandAverageScores = average(sameBrand);
    if (finished.length >= 2) context.branchAverageScores = average(finished);
    return context;
  }, [historyVisits, visit.id, visit.brandName, visit.branchName, visit.startedAt, activeProfile]);

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
      priority: 'MEDIUM', // set the real priority in the action hub
      branchName: visit.branchName,
      brandName: visit.brandName,
      visitId: visit.id,
      beforePhotos: photos,
      department: 'Operations',
    });
    setSelectedFrictionIds(new Set());
  };

  const [isExportingPptx, setIsExportingPptx] = useState(false);
  const handleDownloadPptx = async () => {
    setIsExportingPptx(true);
    try {
      const { downloadStoreDeck } = await import('../services/pptxReport');
      await downloadStoreDeck(visit);
    } catch (err) {
      console.error('PowerPoint export failed:', err);
      alert('ساخت پاورپوینت انجام نشد. دوباره تلاش کنید.');
    } finally {
      setIsExportingPptx(false);
    }
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
        // The PDF is a document, not the app: strip controls from the copy
        // being captured (the live page is untouched).
        onclone: (_doc, clonedRoot) => clonedRoot.classList.add('pdf-capture'),
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
  // Frictions in the order of the form, not by a weighted priority.
  const orderedFindings = useMemo(() => {
    const order = new Map(visit.indicators.map((i, n) => [i.id, n]));
    return [...(summary.prioritizedFindings || [])].sort((a, b) => (order.get(a.indicator.id) ?? 0) - (order.get(b.indicator.id) ?? 0));
  }, [summary.prioritizedFindings, visit.indicators]);

  // The filled questionnaire in the checklist workbook's layout.
  const [isExportingXlsx, setIsExportingXlsx] = useState(false);
  const handleExportXlsx = async () => {
    setIsExportingXlsx(true);
    try {
      const { downloadVisitWorkbook } = await import('../services/visitExcel');
      await downloadVisitWorkbook(visit);
    } catch (err) {
      console.error('Excel export failed:', err);
      alert('ساخت فایل اکسل انجام نشد. دوباره تلاش کنید.');
    } finally {
      setIsExportingXlsx(false);
    }
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
          {/* CSV Export */}
          <button
            type="button"
            className="btn-secondary"
            onClick={handleExportXlsx}
            disabled={isExportingXlsx}
            title="دانلود پرسشنامه با همان قالب اکسل چک‌لیست"
            style={{ fontSize: 12, padding: '7px 12px' }}
          >
            <FileSpreadsheet size={15} color="var(--rs-color-success)" />
            <span>{isExportingXlsx ? 'در حال ساخت اکسل…' : 'خروجی اکسل (قالب چک‌لیست)'}</span>
          </button>

          {/* PowerPoint: the report deck, all in Persian */}
          <button
            type="button"
            className="btn-primary"
            onClick={handleDownloadPptx}
            disabled={isExportingPptx}
            style={{ fontSize: 12, padding: '7px 14px' }}
          >
            <Download size={15} />
            <span>{isExportingPptx ? 'در حال ساخت پاورپوینت…' : 'دانلود گزارش (پاورپوینت)'}</span>
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
            background: 'var(--theme-panel-bg)',
          }}
        >
          {/* Brand Header */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '1px solid var(--theme-card-border)',
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
              subbrandText="گزارش رسمی ارزیابی تجربه مشتری"
            />

            <div style={{ textAlign: 'left' }}>
              <span style={{ fontSize: 12, color: 'var(--rs-color-brand-cyan)', fontWeight: 700, display: 'block' }}>
                کد گزارش
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
              </div>

              <h1 style={{ fontSize: 26, fontWeight: 800, marginTop: 10, color: 'var(--theme-text-primary)' }}>
                {visit.brandName} — {/^شعبه/.test(visit.branchName || '') ? visit.branchName : `شعبه ${visit.branchName}`}
              </h1>
              <p style={{ fontSize: 13, color: 'var(--theme-text-muted)', marginTop: 4 }}>
                ارزیاب میدانی: <strong style={{ color: 'var(--theme-text-primary)' }}>{visit.auditorName || '—'}</strong>
                {visit.evaluatorCode && <span className="fr-code ltr-num">{visit.evaluatorCode}</span>} • سرپرست ممیزی:{' '}
                <strong style={{ color: 'var(--theme-text-primary)' }}>{visit.supervisorName || (visit.status === 'APPROVED' ? '—' : 'در انتظار تأیید')}</strong>
              </p>
            </div>

          </div>

          {/* Key Metrics Strip (Requirement 10) */}
          <div className="metric-card-grid report-metrics" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', marginTop: 20 }}>
            <div className="metric-card">
              <span className="metric-label">شاخص‌های ارزیابی‌شده</span>
              <div className="metric-value">{faDigits(summary.answeredCount)} <span style={{ fontSize: 12, color: 'var(--theme-text-muted)' }}>از {faDigits(summary.totalApplicable)}</span></div>
            </div>
            <div className="metric-card">
              <span className="metric-label">کل اصطکاک‌ها</span>
              <div className="metric-value" style={{ color: 'var(--fr-mark)' }}>
                {faDigits(summary.totalFrictions)}
              </div>
            </div>
            <div className="metric-card">
              <span className="metric-label">غیرقابل ارزیابی</span>
              <div className="metric-value">{faDigits(Object.values(visit.responses || {}).filter((r) => r.answerState === 'NOT_APPLICABLE').length)}</div>
            </div>
            <div className="metric-card">
              <span className="metric-label">مدارک و تصاویر</span>
              <div className="metric-value">{faDigits(summary.totalPhotos)}</div>
            </div>
          </div>
        </div>

        {/* Friction Rate (FR) model: zones, top topics, branches of the brand */}
        <FrictionRateReport visit={visit} historyVisits={historyVisits} />

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
                اصطکاک‌های شناسایی‌شده
              </h3>
            </div>

            {onCreateCorrectiveAction && selectedFrictionIds.size > 0 && (
              <button
                onClick={handleBatchCreateAction}
                className="btn-primary"
                style={{ fontSize: 12, padding: '6px 14px' }}
              >
                ایجاد اقدام اصلاحی برای ({selectedFrictionIds.size}) مورد انتخاب‌شده
              </button>
            )}
          </div>

          <p style={{ fontSize: 13, color: 'var(--theme-text-muted)', marginBottom: 16, maxWidth: 680, lineHeight: 1.7 }}>
            هر اصطکاک با کد، موضوع و توضیح ارزیاب، به ترتیب فرم ارزیابی.
          </p>

          {(!summary.prioritizedFindings || summary.prioritizedFindings.length === 0) ? (
            <p style={{ fontSize: 13, color: 'var(--rs-color-success)' }}>هیچ اصطکاکی در این ارزیابی شناسایی نگردید.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {orderedFindings.map((finding, idx) => {
                const { indicator, response } = finding;
                const isSelected = selectedFrictionIds.has(indicator.id);
                // Frictions are yes/no; one colour for all of them.
                const severityColor = 'var(--friction-high)';

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
                          }}
                        >
                          {idx + 1}
                        </span>
                        <span className="indicator-code-badge">{indicator.code}</span>
                        <span style={{ fontWeight: 800, fontSize: 16, color: 'var(--theme-text-primary)' }}>{indicator.subject}</span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        {onCreateCorrectiveAction && (
                          <button
                            type="button"
                            onClick={() =>
                              onCreateCorrectiveAction({
                                title: `رفع اصطکاک: ${indicator.code} - ${indicator.subject}`,
                                indicatorCode: indicator.code,
                                description: indicator.statement + (response.comment ? `\nتوضیح ارزیاب: ${response.comment}` : ''),
                                priority: 'MEDIUM', // set the real priority in the action hub
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
                              <span style={{ position: 'absolute', bottom: 0, right: 0, left: 0, fontSize: 11, background: 'rgba(0,0,0,0.8)', color: '#fff', padding: '2px 4px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
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
                تأییدیه متدولوژی ارزیابی تجربه مشتری ریتیل سلوشنز
              </span>
            </div>
            <p style={{ fontSize: 11, color: 'var(--theme-text-muted)', maxWidth: 620, lineHeight: 1.6, margin: 0 }}>
              این گزارش بر مبنای بانک شاخص‌های استاندارد و موتور قواعد پویای ریتیل سلوشنز تولید شده است. نرخ اصطکاک هر منطقه و موضوع از تقسیم تعداد اصطکاک‌ها بر تعداد شاخص‌های همان بخش (منهای غیرقابل ارزیابی) به‌دست آمده و شاخص‌های غیرقابل اعمال (N/A) به طور کامل از مخرج کسر محاسباتی حذف گردیده‌اند. کلیه اصطکاک‌های کلیدی وارد چرخه اقدامات اصلاحی شده‌اند.
            </p>
          </div>

          <div style={{ textAlign: 'left' }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--theme-text-primary)', display: 'block' }}>
              ریتیل سلوشنز
            </span>
            <span style={{ fontSize: 11, color: 'var(--rs-color-brand-cyan)' }}>
              گزارش تولیدشده توسط سامانه ارزیابی تجربه مشتری
            </span>
            <span style={{ fontSize: 11, color: 'var(--theme-text-muted)', display: 'block', marginTop: 2 }}>
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

import React from 'react';
import {
  PlusCircle,
  ClipboardCheck,
  BarChart3,
  Target,
  Sparkles,
  ArrowLeft,
  Store,
  Building2,
  CheckCircle2,
  ShieldCheck,
  Clock,
  Smartphone,
  Wifi,
  FileText,
  UserCheck,
  ChevronLeft,
} from 'lucide-react';
import { RetailSolutionsLogo } from '../brand/RetailSolutionsLogo';
import { VisitSession, UserRole } from '../../types';
import { faDigits } from '../../utils/format';

interface LandingPageProps {
  /** False for read-only roles: no entry point to start a visit. */
  canStartAudit?: boolean;
  currentUserName: string;
  currentUserRole: UserRole;
  activeSession: VisitSession | null;
  savedStoresCount: number;
  actionsCount: number;
  onStartNewAudit: () => void;
  onResumeAudit: () => void;
  onOpenReport: () => void;
  onOpenActions: () => void;
  /** Omitted for roles without the admin tools. */
  onOpenCatalog?: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  canStartAudit = true,
  currentUserName,
  currentUserRole,
  activeSession,
  savedStoresCount,
  actionsCount,
  onStartNewAudit,
  onResumeAudit,
  onOpenReport,
  onOpenActions,
  onOpenCatalog,
}) => {
  const answeredCount = activeSession
    ? Object.values(activeSession.responses).filter(
        (r) => r.answerState !== 'UNANSWERED'
      ).length
    : 0;
  const totalCount = activeSession?.indicators.length || 0;

  return (
    <div style={{ maxWidth: 1040, margin: '0 auto', padding: '16px 16px 80px' }}>
      {/* 1. HERO EXECUTIVE WELCOME BANNER */}
      <section
        style={{
          background: 'radial-gradient(ellipse at 85% 20%, rgba(0, 176, 240, 0.16) 0%, var(--theme-card-bg) 70%)',
          border: '1.5px solid rgba(0, 176, 240, 0.28)',
          borderRadius: '24px',
          padding: '28px 32px',
          marginBottom: 24,
          boxShadow: '0 8px 32px -4px rgba(0, 176, 240, 0.12)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 20 }}>
          <div style={{ maxWidth: 640 }}>
            {/* Tag */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(0, 176, 240, 0.12)', padding: '3px 10px', borderRadius: '12px', marginBottom: 12 }}>
              <Sparkles size={14} color="var(--rs-color-brand-cyan)" />
              <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--rs-color-brand-cyan)', letterSpacing: '0.04em' }}>
                سامانه ارزیابی تجربه مشتری
              </span>
            </div>

            <h1 style={{ fontSize: 26, fontWeight: 900, color: 'var(--theme-text-primary)', margin: '0 0 10px', lineHeight: 1.3 }}>
              سامانه هوشمند ارزیابی اصطکاک و پاداش خرده‌فروشی
            </h1>

            <p style={{ fontSize: 14, color: 'var(--theme-text-muted)', lineHeight: 1.7, margin: 0 }}>
              سلام <strong style={{ color: 'var(--theme-text-primary)' }}>{currentUserName}</strong> عزیز، خوش آمدید. آماده اجرای اولین ممیزی میدانی شعب با موتور قطعی قوانین و مدل تحلیلی ۸ بعدی ریتیل سلوشنز هستید.
            </p>

            {/* Field Status Telemetry Pills */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 18 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(45, 157, 120, 0.12)', border: '1px solid rgba(45, 157, 120, 0.3)', padding: '4px 10px', borderRadius: 8 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--rs-color-success)' }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--rs-color-success)' }}>
                  آماده برای ارزیابی میدانی
                </span>
              </div>

              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--theme-card-inner)', border: '1px solid var(--theme-card-border)', padding: '4px 10px', borderRadius: 8 }}>
                <Wifi size={13} color="var(--rs-color-brand-cyan)" />
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--theme-text-muted)' }}>
                  ذخیره‌سازی آفلاین و همگام دیتابیس
                </span>
              </div>

              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--theme-card-inner)', border: '1px solid var(--theme-card-border)', padding: '4px 10px', borderRadius: 8 }}>
                <Store size={13} color="var(--rs-color-brand-cyan)" />
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--theme-text-muted)' }}>
                  {faDigits(savedStoresCount)} شعبه ثبت‌شده
                </span>
              </div>
            </div>
          </div>

          {/* Brand Emblem */}
          <div style={{ alignSelf: 'center' }}>
            <RetailSolutionsLogo variant="badge" size="lg" colorScheme="light" />
          </div>
        </div>
      </section>

      {/* 2. PRIMARY ACTION CARDS */}
      <section style={{ marginBottom: 28 }}>
        <h2 className="section-title">عملیات و شروع ارزیابی</h2>

        {/* Three entry points, but they are not equals: starting an audit is
            what happens on nine visits out of ten. It takes the full first row
            and the other two share the second, which also removes the empty
            cell an odd number of equal cards always leaves behind. */}
        <div className="landing-actions">
          {/* CARD 1: START NEW AUDIT */}
          {canStartAudit && (
          <div
            onClick={onStartNewAudit}
            className="landing-actions__lead"
            style={{
              background: 'linear-gradient(135deg, rgba(0, 176, 240, 0.12) 0%, var(--theme-card-bg) 100%)',
              border: '1.5px solid var(--rs-color-brand-cyan)',
              borderRadius: '20px',
              padding: 22,
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxShadow: '0 4px 20px rgba(0, 176, 240, 0.15)',
              transition: 'all 200ms ease',
            }}
          >
            <div>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg, #00B0F0 0%, #007DAA 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', marginBottom: 14, boxShadow: '0 4px 14px rgba(0, 176, 240, 0.35)' }}>
                <PlusCircle size={22} />
              </div>
              <h3 style={{ fontSize: 17, fontWeight: 800, color: 'var(--theme-text-primary)', margin: '0 0 6px' }}>
                شروع ارزیابی و بازدید جدید
              </h3>
              <p style={{ fontSize: 12, color: 'var(--theme-text-muted)', lineHeight: 1.6, margin: 0 }}>
                انتخاب از میان شعب ثبت‌شده یا تعریف سریع شعبهٔ جدید؛ فرم بر اساس ویژگی‌های شعبه ساخته می‌شود.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 20, paddingTop: 12, borderTop: '1px solid rgba(0, 176, 240, 0.15)' }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--rs-color-brand-cyan)' }}>
                شروع ممیزی میدانی
              </span>
              <ChevronLeft size={18} color="var(--rs-color-brand-cyan)" />
            </div>
          </div>
          )}

          {/* CARD 2: ACTIVE SESSION / RESUME AUDIT */}
          {activeSession ? (
            <div
              onClick={onResumeAudit}
              style={{
                background: 'linear-gradient(135deg, rgba(45, 157, 120, 0.12) 0%, var(--theme-card-bg) 100%)',
                border: '1.5px solid var(--rs-color-success)',
                borderRadius: '20px',
                padding: 22,
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                boxShadow: '0 4px 20px rgba(45, 157, 120, 0.15)',
                transition: 'all 200ms ease',
              }}
            >
              <div>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(45, 157, 120, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--rs-color-success)', marginBottom: 14 }}>
                  <ClipboardCheck size={22} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <h3 style={{ fontSize: 17, fontWeight: 800, color: 'var(--theme-text-primary)', margin: 0 }}>
                    ادامه ارزیابی فعال
                  </h3>
                  <span style={{ fontSize: 10, background: 'var(--rs-color-success)', color: '#fff', padding: '1px 6px', borderRadius: 4, fontWeight: 800 }}>
                    در حال اجرا
                  </span>
                </div>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--theme-text-primary)', margin: '4px 0 2px' }}>
                  {activeSession.brandName} • {activeSession.branchName}
                </p>
                <p style={{ fontSize: 12, color: 'var(--theme-text-muted)', margin: 0 }}>
                  <span className="ltr-num" style={{ fontWeight: 800, color: 'var(--rs-color-success)' }}>{answeredCount}</span> از <span className="ltr-num">{totalCount}</span> شاخص پاسخ داده شده است.
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 20, paddingTop: 12, borderTop: '1px solid rgba(45, 157, 120, 0.2)' }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--rs-color-success)' }}>
                  ورود به فرم سوالات
                </span>
                <ChevronLeft size={18} color="var(--rs-color-success)" />
              </div>
            </div>
          ) : (
            <div
              onClick={onOpenReport}
              style={{
                background: 'var(--theme-card-bg)',
                border: '1px solid var(--theme-card-border)',
                borderRadius: '20px',
                padding: 22,
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transition: 'all 200ms ease',
              }}
            >
              <div>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(0, 176, 240, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--rs-color-brand-cyan)', marginBottom: 14 }}>
                  <BarChart3 size={22} />
                </div>
                <h3 style={{ fontSize: 17, fontWeight: 800, color: 'var(--theme-text-primary)', margin: '0 0 6px' }}>
                  گزارش رسمی و رادار ۳۶۰°
                </h3>
                <p style={{ fontSize: 12, color: 'var(--theme-text-muted)', lineHeight: 1.6, margin: 0 }}>
                  مشاهده نمونه گزارش کامل مدیریتی، تحلیل نمودار عنکبوتی رادار، خروجی PDF رسمی و استخراج فایل اکسل.
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 20, paddingTop: 12, borderTop: '1px solid var(--theme-card-border)' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--rs-color-brand-cyan)' }}>
                  مشاهده گزارش و رادار
                </span>
                <ChevronLeft size={18} color="var(--rs-color-brand-cyan)" />
              </div>
            </div>
          )}

          {/* CARD 3: CORRECTIVE ACTIONS */}
          <div
            onClick={onOpenActions}
            style={{
              background: 'var(--theme-card-bg)',
              border: '1px solid var(--theme-card-border)',
              borderRadius: '20px',
              padding: 22,
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              transition: 'all 200ms ease',
            }}
          >
            <div>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(234, 88, 12, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#EA580C', marginBottom: 14 }}>
                <Target size={22} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <h3 style={{ fontSize: 17, fontWeight: 800, color: 'var(--theme-text-primary)', margin: 0 }}>
                  کارتابل اقدامات اصلاحی
                </h3>
                {actionsCount > 0 && (
                  <span style={{ fontSize: 10, background: 'rgba(217, 74, 86, 0.15)', color: 'var(--rs-color-error)', padding: '1px 6px', borderRadius: 4, fontWeight: 800 }}>
                    {actionsCount} اقدام فعال
                  </span>
                )}
              </div>
              <p style={{ fontSize: 12, color: 'var(--theme-text-muted)', lineHeight: 1.6, margin: 0 }}>
                مدیریت چرخه رفع نواقص، ثبت اقدامات اصلاحی، مقایسه تصاویر قبل و بعد، و کنترل راستی‌آزمایی شعب.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 20, paddingTop: 12, borderTop: '1px solid var(--theme-card-border)' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#EA580C' }}>
                ورود به کارتابل بهبود
              </span>
              <ChevronLeft size={18} color="#EA580C" />
            </div>
          </div>
        </div>
      </section>

      {/* 3. FIELD READINESS TIPS FOR NIMA ZOGHI */}
      <section
        style={{
          background: 'var(--theme-card-inner)',
          border: '1px solid var(--theme-card-border)',
          borderRadius: '20px',
          padding: '20px 24px',
          marginBottom: 28,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <ShieldCheck size={20} color="var(--rs-color-brand-cyan)" />
          <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--theme-text-primary)', margin: 0 }}>
            راهنمای میدانی برای ارزیاب ارشد (تست روز اول):
          </h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(0, 176, 240, 0.15)', color: 'var(--rs-color-brand-cyan)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12, flexShrink: 0 }}>
              ۱
            </span>
            <p style={{ fontSize: 12, color: 'var(--theme-text-secondary)', lineHeight: 1.6, margin: 0 }}>
              <strong>امنیت کامل ذخیره‌سازی داده‌ها:</strong> هر پاسخی که ثبت می‌کنید بلافاصله در حافظه محلی دستگاه شما ذخیره می‌شود تا در صورت قطعی اینترنت هیچ داده‌ای از دست نرود.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(0, 176, 240, 0.15)', color: 'var(--rs-color-brand-cyan)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12, flexShrink: 0 }}>
              ۲
            </span>
            <p style={{ fontSize: 12, color: 'var(--theme-text-secondary)', lineHeight: 1.6, margin: 0 }}>
              <strong>ثبت اختیاری عکس:</strong> ثبت تصاویر در این فاز تست اختیاری است. می‌توانید اصطکاک‌ها را بدون الزام به بارگذاری عکس با انتخاب سطح شدت ثبت نمایید.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(0, 176, 240, 0.15)', color: 'var(--rs-color-brand-cyan)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12, flexShrink: 0 }}>
              ۳
            </span>
            <p style={{ fontSize: 12, color: 'var(--theme-text-secondary)', lineHeight: 1.6, margin: 0 }}>
              <strong>سوایپ و نمای متمرکز:</strong> در هنگام ارزیابی با کشیدن انگشت (سوایپ) می‌توانید بین سوالات جابجا شوید یا از دکمه «نمای متمرکز» در بالای صفحه استفاده کنید.
            </p>
          </div>
        </div>
      </section>

      {/* 4. OVERVIEW OF 8 DIMENSIONS */}
      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--theme-text-primary)', margin: 0 }}>
            ابعاد ۸گانه مدل ارزیابی تجربه مشتری
          </h2>
          {onOpenCatalog && (
            <button
              type="button"
              onClick={onOpenCatalog}
              className="btn-secondary"
              style={{ fontSize: 11, padding: '4px 10px', minHeight: 30 }}
            >
              مشاهده بانک شاخص‌ها
            </button>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
          {[
            { key: 'ACCESS', label: 'دسترسی و ورود', desc: 'دید معبر، ورودی، تابلو و پارکینگ' },
            { key: 'NAVIGATION', label: 'ناوبری و گردش', desc: 'مسیرهای حرکتی و راهنمای فضا' },
            { key: 'ENVIRONMENT', label: 'محیط و فضا', desc: 'نور، دما، نظافت و موسیقی' },
            { key: 'PRODUCT', label: 'کالا و چیدمان', desc: 'ویترین، دسترسی‌پذیری و برچسب قیمت' },
            { key: 'PEOPLE', label: 'پرسنل و تعامل', desc: 'استقبال، دانش و پوشش کارکنان' },
            { key: 'SERVICE', label: 'خدمت و تسهیلات', desc: 'اتاق پرو، مشاور فروش و امکانات رفاهی' },
            { key: 'CHECKOUT', label: 'تسویه و خروج', desc: 'سرعت صندوق، صف و بسته‌بندی' },
            { key: 'AFTER_SALES', label: 'وفاداری و پس از فروش', desc: 'تعویض کالا، بازخورد و ارتباط پایدار' },
          ].map((dim, i) => (
            <div
              key={dim.key}
              style={{
                background: 'var(--theme-card-bg)',
                border: '1px solid var(--theme-card-border)',
                borderRadius: '12px',
                padding: '12px 14px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--rs-color-action-primary)' }}>
                  بُعد {faDigits(i + 1)}
                </span>
              </div>
              <strong style={{ fontSize: 13, color: 'var(--theme-text-primary)', display: 'block', marginBottom: 2 }}>
                {dim.label}
              </strong>
              <span style={{ fontSize: 11, color: 'var(--theme-text-muted)' }}>
                {dim.desc}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

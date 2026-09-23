import React, { useState, useMemo } from 'react';
import {
  AssessmentType,
  BusinessTypeCode,
  LocationContextCode,
  StoreFormatCode,
  MallTypeCode,
  StoreAttributes,
  Indicator,
  VisitSession,
  AssessmentProfile,
} from '../types';
import { generateDynamicChecklistWithAudit } from '../engine/ruleEngine';
import { SAMPLE_REAL_VISIT } from '../data/sampleRealVisit';
import {
  Store,
  Building2,
  Sparkles,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  HelpCircle,
  ShieldCheck,
  Tag,
  MapPin,
  CheckSquare,
  Sliders,
} from 'lucide-react';

interface StartVisitWizardProps {
  allIndicators: Indicator[];
  onStartVisit: (session: VisitSession) => void;
  onCancel?: () => void;
}

export const StartVisitWizard: React.FC<StartVisitWizardProps> = ({
  allIndicators,
  onStartVisit,
  onCancel,
}) => {
  const [step, setStep] = useState<number>(1);

  // Wizard state
  const [assessmentType, setAssessmentType] = useState<AssessmentType>('STORE');
  const [brandName, setBrandName] = useState('زارا (Zara)');
  const [branchName, setBranchName] = useState('شعبه خیابان ولیعصر');
  const [businessType, setBusinessType] = useState<BusinessTypeCode>('Fashion');
  const [mallType, setMallType] = useState<MallTypeCode>('Regional');
  const [locationContext, setLocationContext] = useState<LocationContextCode>('STREET_STORE');
  const [storeFormat, setStoreFormat] = useState<StoreFormatCode>('CHAIN');
  const [auditorName, setAuditorName] = useState('نیما رضایی (ارزیاب ارشد)');
  const [supervisorName, setSupervisorName] = useState('مهندس سارا احمدی (سرپرست)');

  const [attributes, setAttributes] = useState<StoreAttributes>({
    has_window_display: true,
    has_fitting_room: true,
    has_mannequins: true,
    has_elevator: false,
    has_stairs: false,
    has_parking: false,
    has_customer_toilet: false,
    has_checkout_counter: true,
    has_food_service: false,
    has_anti_theft_gate: true,
    // compatibility
    hasFittingRoom: true,
    hasShowcase: true,
    hasMannequins: true,
    hasElevator: false,
  });

  const toggleAttribute = (key: string, compatKey?: string) => {
    setAttributes((prev) => {
      const nextVal = !prev[key];
      const updated = { ...prev, [key]: nextVal };
      if (compatKey) updated[compatKey] = nextVal;
      return updated;
    });
  };

  // Compile full profile
  const profile: AssessmentProfile = useMemo(() => {
    if (assessmentType === 'STORE') {
      return {
        assessmentType: 'STORE',
        businessType,
        locationContext,
        storeFormat,
        brand: brandName,
        branch: branchName,
        attributes,
      };
    } else {
      return {
        assessmentType: 'MALL',
        mallType,
        locationContext,
        brand: brandName,
        branch: branchName,
        attributes,
      };
    }
  }, [assessmentType, businessType, locationContext, storeFormat, mallType, brandName, branchName, attributes]);

  // Evaluated indicators via deterministic engine
  const { indicators: previewIndicators, auditTrail } = useMemo(() => {
    return generateDynamicChecklistWithAudit(allIndicators, profile);
  }, [allIndicators, profile]);

  const uniqueSectionsCount = useMemo(() => {
    return new Set(previewIndicators.map((i) => i.journeyStage)).size;
  }, [previewIndicators]);

  const mandatoryPhotoCount = useMemo(() => {
    return previewIndicators.filter((i) => i.requiresPhoto).length;
  }, [previewIndicators]);

  const estimatedMinutes = Math.max(15, Math.round(previewIndicators.length * 0.35));

  const handleStart = () => {
    const session: VisitSession = {
      id: 'visit_' + Date.now(),
      visitCode: `VST-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      brandName,
      branchName,
      assessmentType,
      businessType: assessmentType === 'STORE' ? businessType : undefined,
      locationContext,
      storeFormat: assessmentType === 'STORE' ? storeFormat : undefined,
      mallType: assessmentType === 'MALL' ? mallType : undefined,
      attributes,
      auditorName,
      supervisorName,
      startedAt: new Date().toISOString(),
      status: 'IN_PROGRESS',
      indicators: previewIndicators,
      responses: {},
    };

    onStartVisit(session);
  };

  const stepTitles = [
    'نوع ارزیابی',
    'مجموعه / برند',
    'شعبه محل ارزیابی',
    assessmentType === 'STORE' ? 'رسته کسب‌وکار' : 'مقیاس مرکز خرید',
    'بافت موقعیتی (Location)',
    'قالب فروشگاه (Format)',
    'ویژگی‌های فیزیکی محل',
    'پیش‌نمایش فرم و تایید',
  ];

  return (
    <div style={{ maxWidth: 540, margin: '16px auto', padding: '0 12px 60px' }}>
      {/* Wizard Progress Header */}
      <div className="glass-panel" style={{ padding: '16px 20px', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--rs-color-brand-cyan)' }}>
            مرحله {step} از ۸: {stepTitles[step - 1]}
          </span>
          <span className="ltr-num" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {Math.round((step / 8) * 100)}%
          </span>
        </div>
        <div className="progress-bar-bg" style={{ height: 6 }}>
          <div className="progress-bar-fill" style={{ width: `${(step / 8) * 100}%` }} />
        </div>
      </div>

      {/* Main Step Card */}
      <div className="glass-panel" style={{ padding: 22, minHeight: 380, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          {/* STEP 1: Assessment Type */}
          {step === 1 && (
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>مرحله ۱: نوع ارزیابی میدانی</h2>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
                مشخص کنید موضوع ارزیابی یک واحد فروشگاهی مستقل است یا کل یک مجتمع تجاری.
              </p>

              <div
                style={{
                  marginBottom: 20,
                  padding: '16px 20px',
                  background: 'linear-gradient(135deg, rgba(0, 176, 240, 0.12) 0%, var(--theme-card-bg) 100%)',
                  border: '1px solid rgba(0, 176, 240, 0.35)',
                  borderRadius: '16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 12,
                  boxShadow: 'var(--rs-shadow-card)',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <Sparkles size={14} color="var(--rs-color-brand-cyan)" />
                    <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--rs-color-brand-cyan)', letterSpacing: '0.05em' }}>
                      دموی سازمانی آماده ریتیل سلوشنز
                    </span>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--theme-text-primary)', display: 'block' }}>
                    مشاهده گزارش ارزیابی نمونه مدیر (Executive Audit Demo)
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--theme-text-muted)', display: 'block', marginTop: 2 }}>
                    شامل ۶۵ شاخص، ۱۶ اصطکاک، ۴ مورد بحرانی و ۱۲ تصویر مستند میدانی
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onStartVisit(SAMPLE_REAL_VISIT)}
                  className="btn-primary"
                  style={{ fontSize: 12, padding: '8px 16px', minHeight: 38 }}
                >
                  <Sparkles size={14} />
                  <span>بارگذاری فوری ارزیابی نمونه</span>
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <button
                  type="button"
                  onClick={() => setAssessmentType('STORE')}
                  style={{
                    padding: '24px 14px',
                    borderRadius: '16px',
                    border: `2px solid ${assessmentType === 'STORE' ? 'var(--rs-color-brand-cyan)' : 'var(--theme-card-border)'}`,
                    background:
                      assessmentType === 'STORE'
                        ? 'var(--theme-callout-obs-bg)'
                        : 'var(--theme-card-bg)',
                    color: 'var(--theme-text-primary)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 12,
                    textAlign: 'center',
                    transition: 'all 200ms cubic-bezier(0.16, 1, 0.3, 1)',
                    boxShadow: assessmentType === 'STORE' ? '0 0 25px rgba(0, 176, 240, 0.22)' : 'var(--rs-shadow-card)',
                    transform: assessmentType === 'STORE' ? 'scale(1.02)' : 'none',
                  }}
                >
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: '50%',
                      background: assessmentType === 'STORE' ? 'rgba(0, 176, 240, 0.22)' : 'var(--theme-nav-btn-bg)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Store size={30} color={assessmentType === 'STORE' ? 'var(--rs-color-brand-cyan)' : '#94A3B8'} />
                  </div>
                  <div>
                    <strong style={{ fontSize: 16, display: 'block', fontWeight: 800 }}>ارزیابی فروشگاه</strong>
                    <span style={{ fontSize: 11, color: 'var(--theme-text-muted)', marginTop: 2, display: 'block' }}>Store Assessment</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setAssessmentType('MALL')}
                  style={{
                    padding: '24px 14px',
                    borderRadius: '16px',
                    border: `2px solid ${assessmentType === 'MALL' ? 'var(--rs-color-brand-cyan)' : 'var(--theme-card-border)'}`,
                    background:
                      assessmentType === 'MALL'
                        ? 'var(--theme-callout-obs-bg)'
                        : 'var(--theme-card-bg)',
                    color: 'var(--theme-text-primary)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 12,
                    textAlign: 'center',
                    transition: 'all 200ms cubic-bezier(0.16, 1, 0.3, 1)',
                    boxShadow: assessmentType === 'MALL' ? '0 0 25px rgba(0, 176, 240, 0.22)' : 'var(--rs-shadow-card)',
                    transform: assessmentType === 'MALL' ? 'scale(1.02)' : 'none',
                  }}
                >
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: '50%',
                      background: assessmentType === 'MALL' ? 'rgba(0, 176, 240, 0.22)' : 'var(--theme-nav-btn-bg)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Building2 size={30} color={assessmentType === 'MALL' ? 'var(--rs-color-brand-cyan)' : '#94A3B8'} />
                  </div>
                  <div>
                    <strong style={{ fontSize: 16, display: 'block', fontWeight: 800 }}>ارزیابی مرکز خرید</strong>
                    <span style={{ fontSize: 11, color: 'var(--theme-text-muted)', marginTop: 2, display: 'block' }}>Mall Infrastructure</span>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Brand / Collection */}
          {step === 2 && (
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>مرحله ۲: مجموعه یا برند</h2>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
                نام تجاری یا هلدینگ مورد ارزیابی را مشخص کنید.
              </p>

              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                  نام برند / مرکز:
                </label>
                <input
                  type="text"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  className="friction-textarea"
                  style={{ minHeight: 46, padding: '10px 14px', fontSize: 15 }}
                  placeholder="مثلاً: زارا، ال‌سی وایکیکی، هایپراستار..."
                />
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                {['زارا (Zara)', 'ال‌سی وایکیکی', 'مانگو (Mango)', 'هایپراستار', 'مرکز خرید کوروش', 'ایران مال', 'پالادیوم'].map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setBrandName(b)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 'var(--radius-full)',
                      border: '1px solid var(--border-subtle)',
                      background: brandName === b ? 'var(--rs-color-brand-cyan)' : 'var(--theme-input-bg)',
                      color: brandName === b ? '#FFFFFF' : 'var(--theme-text-primary)',
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* STEP 3: Branch */}
          {step === 3 && (
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>مرحله ۳: شعبه و موقعیت</h2>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
                نام و نشانی دقیق این شعبه را وارد نمایید.
              </p>

              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                  نام شعبه:
                </label>
                <input
                  type="text"
                  value={branchName}
                  onChange={(e) => setBranchName(e.target.value)}
                  className="friction-textarea"
                  style={{ minHeight: 46, padding: '10px 14px', fontSize: 15 }}
                  placeholder="مثلاً: شعبه خیابان ولیعصر، طبقه G1 کوروش..."
                />
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {['شعبه خیابان ولیعصر', 'شعبه مجتمع کوروش (طبقه G)', 'شعبه بلوار اندرزگو', 'شعبه ایران مال'].map((br) => (
                  <button
                    key={br}
                    type="button"
                    onClick={() => setBranchName(br)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 'var(--radius-full)',
                      border: '1px solid var(--border-subtle)',
                      background: branchName === br ? 'var(--rs-color-brand-cyan)' : 'var(--theme-input-bg)',
                      color: branchName === br ? '#FFFFFF' : 'var(--theme-text-primary)',
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    {br}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* STEP 4: Business Type or Mall Type */}
          {step === 4 && (
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>
                مرحله ۴: {assessmentType === 'STORE' ? 'رسته کسب‌وکار (صنف)' : 'مقیاس و رده مرکز خرید'}
              </h2>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
                موتور ارزیابی از این فیلد برای انطباق با ماتریس پایه فایل اکسل استفاده می‌کند.
              </p>

              {assessmentType === 'STORE' ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, maxHeight: 260, overflowY: 'auto' }}>
                  {[
                    { code: 'Fashion', label: 'پوشاک (Fashion)' },
                    { code: 'Shoe_Bag', label: 'کیف و کفش (Shoe & Bag)' },
                    { code: 'Watch_Jewelry', label: 'ساعت و طلا (Jewelry)' },
                    { code: 'FMCG', label: 'تندمصرف (FMCG)' },
                    { code: 'F_B', label: 'کافه و غذا (F&B)' },
                    { code: 'Hardware', label: 'ابزار و یراق (Hardware)' },
                    { code: 'Homeware', label: 'لوازم خانگی (Homeware)' },
                    { code: 'Beauty_Cosmetics', label: 'آرایشی و زیبایی (Beauty)' },
                    { code: 'Electronics', label: 'الکترونیک و دیجیتال' },
                    { code: 'Entertainment', label: 'سرگرمی و اسباب‌بازی' },
                    { code: 'Sports', label: 'لوازم ورزشی (Sports)' },
                    { code: 'Specialty', label: 'کالای تخصصی (Specialty)' },
                    { code: 'Services', label: 'خدمات و پشتیبانی' },
                  ].map((bt) => (
                    <button
                      key={bt.code}
                      type="button"
                      onClick={() => setBusinessType(bt.code as BusinessTypeCode)}
                      style={{
                        padding: '10px',
                        borderRadius: 'var(--rs-radius-control)',
                        border: `1.5px solid ${businessType === bt.code ? 'var(--rs-color-brand-cyan)' : 'var(--border-subtle)'}`,
                        background: businessType === bt.code ? 'rgba(0, 176, 240, 0.14)' : 'var(--theme-input-bg)',
                        color: businessType === bt.code ? 'var(--rs-color-brand-cyan)' : 'var(--theme-text-primary)',
                        fontSize: 12,
                        fontWeight: businessType === bt.code ? 700 : 500,
                        textAlign: 'right',
                        cursor: 'pointer',
                        transition: 'all var(--rs-duration-micro) var(--rs-ease-standard)',
                      }}
                    >
                      {bt.label}
                    </button>
                  ))}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    { code: 'SM', label: 'مرکز خرید محلی / پایه (SM)', sub: 'پارکینگ و خدمات ساده' },
                    { code: 'Neighborhood', label: 'مرکز تجاری محله‌ای (Neighborhood)', sub: 'تأمین روزمره با تنوع متوسط' },
                    { code: 'Community', label: 'مرکز خرید منطقه‌ای (Community)', sub: 'خدمات کامل منطقه‌ای' },
                    { code: 'Regional', label: 'مرکز خرید منطقه‌ای بزرگ (Regional)', sub: 'مگامال کامل با پارکینگ ۲۱ گانه' },
                    { code: 'Super_Regional', label: 'ابر مرکز خرید فرامنطقه‌ای (Super Regional)', sub: 'کامل‌ترین مقیاس تجاری و رفاهی' },
                  ].map((mt) => (
                    <button
                      key={mt.code}
                      type="button"
                      onClick={() => setMallType(mt.code as MallTypeCode)}
                      style={{
                        padding: '12px 16px',
                        borderRadius: 'var(--rs-radius-control)',
                        border: `1.5px solid ${mallType === mt.code ? 'var(--rs-color-brand-cyan)' : 'var(--border-subtle)'}`,
                        background: mallType === mt.code ? 'rgba(0, 176, 240, 0.14)' : 'var(--theme-input-bg)',
                        color: 'var(--theme-text-primary)',
                        textAlign: 'right',
                        cursor: 'pointer',
                        transition: 'all var(--rs-duration-micro) var(--rs-ease-standard)',
                      }}
                    >
                      <strong style={{ fontSize: 14, display: 'block' }}>{mt.label}</strong>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{mt.sub}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* STEP 5: Location Context */}
          {step === 5 && (
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>مرحله ۵: بافت موقعیتی (Location Context)</h2>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
                موقعیت استقرار واحد را تعیین کنید تا قوانین اختصاصی خیابانی یا داخل مال اعمال شوند.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { code: 'STREET_STORE', label: 'فروشگاه خیابانی (Street Store)', desc: 'واحد مستقل با دید مستقیم از معبر و پیاده‌رو شهری' },
                  { code: 'MALL_STORE', label: 'فروشگاه داخل مال (Mall Store)', desc: 'واحد تجاری مستقر در راهروها یا طبقات مرکز خرید' },
                  { code: 'FOOD_COURT', label: 'غرفه فودکورت (Food Court Unit)', desc: 'غرفه غذایی مستقر در سالن غذاخوری مجتمع تجاری' },
                  { code: 'STANDALONE', label: 'فروشگاه مستقل بزرگ (Standalone)', desc: 'مجتمع مستقل حومه یا بزرگ‌مقیاس با محوطه باز' },
                  { code: 'SHOP_IN_SHOP', label: 'شاپ این شاپ (Shop-in-Shop)', desc: 'غرفه داخل دیپارتمنت‌استور یا فروشگاه زنجیره‌ای' },
                  { code: 'KIOSK', label: 'کیوسک / غرفه جزیره‌ای (Kiosk)', desc: 'کیوسک مستقر در کریدور یا فضای باز' },
                ].map((lc) => (
                  <button
                    key={lc.code}
                    type="button"
                    onClick={() => setLocationContext(lc.code as LocationContextCode)}
                    style={{
                      padding: '12px 14px',
                      borderRadius: 'var(--rs-radius-control)',
                      border: `1.5px solid ${locationContext === lc.code ? 'var(--rs-color-brand-cyan)' : 'var(--border-subtle)'}`,
                      background: locationContext === lc.code ? 'rgba(0, 176, 240, 0.14)' : 'var(--theme-input-bg)',
                      color: 'var(--theme-text-primary)',
                      textAlign: 'right',
                      cursor: 'pointer',
                      transition: 'all var(--rs-duration-micro) var(--rs-ease-standard)',
                    }}
                  >
                    <strong style={{ fontSize: 14, display: 'block' }}>{lc.label}</strong>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{lc.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* STEP 6: Store Format */}
          {step === 6 && (
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>مرحله ۶: قالب و فرمت شعبه</h2>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
                مقیاس عملیاتی و کانسپت فروشگاه را مشخص کنید.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { code: 'FLAGSHIP', label: 'شعبه پرچمدار (Flagship)', desc: 'بزرگ‌ترین مقیاس و کامل‌ترین خدمات برند' },
                  { code: 'CHAIN', label: 'شعبه استاندارد زنجیره‌ای (Standard Chain)', desc: 'قالب استاندارد شعبات درون‌شهری' },
                  { code: 'BOUTIQUE', label: 'بوتیک و فروشگاه جمع‌وجور (Boutique)', desc: 'مساحت محدود با تمرکز بر گلچین محصولات' },
                  { code: 'SHOP_IN_SHOP', label: 'شاپ این شاپ (Corner / Shop-in-Shop)', desc: 'کانتر اختصاصی برند در یک مجموعه بزرگ‌تر' },
                  { code: 'KIOSK', label: 'کیوسک موقت یا دائمی (Kiosk)', desc: 'غرفه کوچک جزیره‌ای' },
                ].map((sf) => (
                  <button
                    key={sf.code}
                    type="button"
                    onClick={() => setStoreFormat(sf.code as StoreFormatCode)}
                    style={{
                      padding: '12px 14px',
                      borderRadius: 'var(--rs-radius-control)',
                      border: `1.5px solid ${storeFormat === sf.code ? 'var(--rs-color-brand-cyan)' : 'var(--border-subtle)'}`,
                      background: storeFormat === sf.code ? 'rgba(0, 176, 240, 0.14)' : 'var(--theme-input-bg)',
                      color: 'var(--theme-text-primary)',
                      textAlign: 'right',
                      cursor: 'pointer',
                      transition: 'all var(--rs-duration-micro) var(--rs-ease-standard)',
                    }}
                  >
                    <strong style={{ fontSize: 14, display: 'block' }}>{sf.label}</strong>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{sf.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* STEP 7: Relevant Attributes */}
          {step === 7 && (
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>مرحله ۷: ویژگی‌های فیزیکی محل (Attributes)</h2>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>
                امکانات موجود را تیک بزنید تا سؤالات نامربوط بر اساس وابستگی‌های قطعی فیلتر شوند.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8, maxHeight: 270, overflowY: 'auto' }}>
                {[
                  { key: 'has_window_display', compat: 'hasShowcase', label: 'ویترین شیشه‌ای و مانکن رو به بیرون', desc: 'کدهای FW02-06 در صورت عدم وجود حذف می‌شوند' },
                  { key: 'has_fitting_room', compat: 'hasFittingRoom', label: 'اتاق پرو لباس', desc: 'کدهای FFR02-06 در صورت عدم وجود حذف می‌شوند' },
                  { key: 'has_mannequins', compat: 'hasMannequins', label: 'مانکن‌های نمایشی داخل فروشگاه', desc: 'کدهای FMA در صورت عدم وجود حذف می‌شوند' },
                  { key: 'has_elevator', compat: 'hasElevator', label: 'آسانسور، پله‌برقی یا پله داخلی طبقات', desc: 'کدهای FAFE01-04 در فروشگاه تک‌طبقه حذف می‌شوند' },
                  { key: 'has_parking', compat: 'hasParking', label: 'پارکینگ اختصاصی مشتریان', desc: 'شاخص‌های پارکینگ فروشگاه' },
                  { key: 'has_customer_toilet', compat: 'hasCustomerToilet', label: 'سرویس بهداشتی در دسترس مشتریان', desc: 'رفاهیات بهداشتی داخلی' },
                  { key: 'has_checkout_counter', compat: undefined, label: 'کانتر صندوق و سیستم صف', desc: 'شاخص‌های صف و تسویه' },
                  { key: 'has_anti_theft_gate', compat: undefined, label: 'گیت دزدگیر و سیستم امنیتی کالا', desc: 'حفاظت فیزیکی کالا' },
                ].map((attr) => {
                  const isChecked = Boolean(attributes[attr.key]);
                  return (
                    <div
                      key={attr.key}
                      onClick={() => toggleAttribute(attr.key, attr.compat)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        borderRadius: 'var(--rs-radius-control)',
                        border: `1.5px solid ${isChecked ? 'var(--rs-color-success)' : 'var(--border-subtle)'}`,
                        background: isChecked ? 'rgba(45, 157, 120, 0.12)' : 'var(--bg-input)',
                        cursor: 'pointer',
                        transition: 'all var(--rs-duration-micro) var(--rs-ease-standard)',
                      }}
                    >
                      <div>
                        <strong style={{ fontSize: 13, display: 'block', color: isChecked ? 'var(--theme-text-primary)' : 'var(--text-muted)' }}>
                          {attr.label}
                        </strong>
                        <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{attr.desc}</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        style={{ width: 18, height: 18, accentColor: 'var(--rs-color-success)', cursor: 'pointer' }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 8: PREVIEW & CONFIRMATION */}
          {step === 8 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <CheckCircle2 color="var(--rs-color-success)" size={26} />
                <h2 style={{ fontSize: 18, fontWeight: 800 }}>مرحله ۸: پیش‌نمایش فرم نهایی</h2>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
                موتور قوانین چک‌لیست را به صورت قطعی تولید کرد. مشخصات نهایی را بررسی و تایید نمایید:
              </p>

              {/* Profile Summary Card */}
              <div style={{ background: 'var(--bg-input)', borderRadius: 'var(--rs-radius-card)', padding: 14, marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>محل و شعبه:</span>
                  <strong style={{ fontSize: 13 }}>{brandName} — {branchName}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>نوع ارزیابی:</span>
                  <span style={{ fontSize: 13, color: 'var(--rs-color-brand-cyan)', fontWeight: 600 }}>
                    {assessmentType === 'STORE' ? `فروشگاه (${businessType})` : `مرکز خرید (${mallType})`}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>موقعیت و بافت:</span>
                  <span style={{ fontSize: 12, color: 'var(--text-main)' }}>{locationContext}</span>
                </div>
              </div>

              {/* Key Quantitative Metrics */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
                <div className="metric-card" style={{ padding: 10 }}>
                  <span className="metric-value ltr-num" style={{ fontSize: 20, color: 'var(--rs-color-brand-cyan)' }}>
                    {previewIndicators.length}
                  </span>
                  <span className="metric-label" style={{ fontSize: 10 }}>کل سؤالات</span>
                </div>

                <div className="metric-card" style={{ padding: 10 }}>
                  <span className="metric-value ltr-num" style={{ fontSize: 20, color: 'var(--rs-color-success)' }}>
                    {uniqueSectionsCount}
                  </span>
                  <span className="metric-label" style={{ fontSize: 10 }}>بخش‌ها</span>
                </div>

                <div className="metric-card" style={{ padding: 10 }}>
                  <span className="metric-value ltr-num" style={{ fontSize: 20, color: 'var(--rs-color-warning)' }}>
                    {mandatoryPhotoCount}
                  </span>
                  <span className="metric-label" style={{ fontSize: 10 }}>عکس الزامی</span>
                </div>

                <div className="metric-card" style={{ padding: 10 }}>
                  <span className="metric-value ltr-num" style={{ fontSize: 20, color: 'var(--rs-color-action-primary)' }}>
                    ~{estimatedMinutes}
                  </span>
                  <span className="metric-label" style={{ fontSize: 10 }}>دقیقه برآورد</span>
                </div>
              </div>

              <div style={{ background: 'rgba(0, 176, 240, 0.08)', border: '1px solid rgba(0, 176, 240, 0.25)', borderRadius: 'var(--rs-radius-card)', padding: 12 }}>
                <span style={{ fontSize: 12, color: 'var(--rs-color-brand-cyan)', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  ✓ تایید ممیزی و منشأ قوانین:
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  تمامی شاخص‌ها با قوانین مصوب (APPROVED) منطبق شده‌اند. هیچ سوال غیرمرتبط با موقعیت مکانی یا صنف در فرم وجود ندارد.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Wizard Navigation Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border-subtle)' }}>
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => Math.max(1, s - 1))}
              className="btn-secondary"
              style={{ minHeight: 46 }}
            >
              <ArrowRight size={18} />
              مرحله قبل
            </button>
          ) : (
            onCancel ? (
              <button type="button" onClick={onCancel} className="btn-secondary" style={{ minHeight: 46 }}>
                انصراف
              </button>
            ) : <div />
          )}

          {step < 8 ? (
            <button
              type="button"
              onClick={() => setStep((s) => Math.min(8, s + 1))}
              className="btn-primary"
              style={{ minHeight: 46 }}
            >
              گام بعدی
              <ArrowLeft size={18} />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleStart}
              className="btn-primary"
              style={{ background: 'var(--rs-color-action-primary)', minHeight: 46, boxShadow: '0 4px 16px rgba(0, 125, 170, 0.35)' }}
            >
              <CheckCircle2 size={18} />
              شروع ارزیابی میدانی
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

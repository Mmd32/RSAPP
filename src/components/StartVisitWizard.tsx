import { CodeText } from './ui/CodeText';
import React, { useState, useMemo, useEffect } from 'react';
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
  SavedStoreDirectoryItem,
} from '../types';
import { generateDynamicChecklistWithAudit } from '../engine/ruleEngine';
import { SAMPLE_REAL_VISIT } from '../data/sampleRealVisit';
import { StoreService } from '../services/storeService';
import {
  Store,
  Building2,
  Sparkles,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Search,
  Check,
  Trash2,
  Plus,
  BookmarkCheck,
  MapPin,
  Tag,
  Sliders,
} from 'lucide-react';
import { profileLabel } from '../utils/format';
import { PHOTOS_REQUIRED } from '../config/policy';

interface StartVisitWizardProps {
  allIndicators: Indicator[];
  onStartVisit: (session: VisitSession) => void;
  onCancel?: () => void;
  /** Recorded as the evaluator of the new visit. */
  currentUserName?: string;
}

export const StartVisitWizard: React.FC<StartVisitWizardProps> = ({
  allIndicators,
  onStartVisit,
  onCancel,
  currentUserName,
}) => {
  const [step, setStep] = useState<number>(1);
  const [wizardMode, setWizardMode] = useState<'DIRECTORY' | 'MANUAL'>('DIRECTORY');

  // Store Directory State
  const [savedStores, setSavedStores] = useState<SavedStoreDirectoryItem[]>([]);
  const [storeSearchQuery, setStoreSearchQuery] = useState('');
  const [saveToDirectory, setSaveToDirectory] = useState<boolean>(true);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);

  // Load saved stores from local cache & server
  useEffect(() => {
    StoreService.getAllStores().then((stores) => {
      setSavedStores(stores);
      if (stores.length === 0) {
        setWizardMode('MANUAL');
      }
    });
  }, []);

  // Wizard fields state
  const [assessmentType, setAssessmentType] = useState<AssessmentType>('STORE');
  const [brandName, setBrandName] = useState('زارا (Zara)');
  const [branchName, setBranchName] = useState('شعبه خیابان ولیعصر');
  const [businessType, setBusinessType] = useState<BusinessTypeCode>('Fashion');
  const [mallType, setMallType] = useState<MallTypeCode>('Regional');
  const [locationContext, setLocationContext] = useState<LocationContextCode>('STREET_STORE');
  const [storeFormat, setStoreFormat] = useState<StoreFormatCode>('FLAGSHIP');
  const [auditorName, setAuditorName] = useState(currentUserName || '');
  // The supervisor is recorded when someone actually approves the visit.
  const [supervisorName, setSupervisorName] = useState('');

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

  // Select store from directory & auto-populate everything
  const handleSelectSavedStore = (store: SavedStoreDirectoryItem) => {
    setSelectedStoreId(store.id);
    setBrandName(store.brandName);
    setBranchName(store.branchName);
    setAssessmentType(store.assessmentType);
    if (store.businessType) setBusinessType(store.businessType);
    if (store.mallType) setMallType(store.mallType);
    if (store.locationContext) setLocationContext(store.locationContext);
    if (store.storeFormat) setStoreFormat(store.storeFormat);
    if (store.attributes) setAttributes(store.attributes);

    // Jump straight to confirmation step!
    setStep(8);
  };

  const handleDeleteSavedStore = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm('آیا از حذف این فروشگاه از بانک شعب اطمینان دارید؟')) {
      await StoreService.deleteStore(id);
      setSavedStores((prev) => prev.filter((s) => s.id !== id));
      if (selectedStoreId === id) setSelectedStoreId(null);
    }
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

  // Evaluated indicators via deterministic rule engine
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

  const handleStart = async () => {
    // 1. Persist to database if toggle is checked
    if (saveToDirectory) {
      await StoreService.saveStore({
        brandName,
        branchName,
        assessmentType,
        businessType: assessmentType === 'STORE' ? businessType : undefined,
        mallType: assessmentType === 'MALL' ? mallType : undefined,
        locationContext,
        storeFormat: assessmentType === 'STORE' ? storeFormat : undefined,
        attributes,
        auditorName,
        supervisorName,
      });
    }

    // 2. Launch assessment session
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

  const filteredStores = useMemo(() => {
    if (!storeSearchQuery.trim()) return savedStores;
    const q = storeSearchQuery.toLowerCase();
    return savedStores.filter(
      (s) =>
        s.brandName.toLowerCase().includes(q) ||
        s.branchName.toLowerCase().includes(q) ||
        (s.businessType && s.businessType.toLowerCase().includes(q)) ||
        (s.address && s.address.toLowerCase().includes(q))
    );
  }, [savedStores, storeSearchQuery]);

  const stepTitles = [
    'انتخاب یا ثبت فروشگاه',
    'مجموعه / برند',
    'شعبه محل ارزیابی',
    assessmentType === 'STORE' ? 'رسته کسب‌وکار' : 'مقیاس مرکز خرید',
    'بافت موقعیتی',
    'قالب فروشگاه',
    'ویژگی‌های فیزیکی محل',
    'پیش‌نمایش فرم و تایید',
  ];

  return (
    <div style={{ maxWidth: 640, margin: '16px auto', padding: '0 12px 64px' }}>
      {/* Wizard Progress Header */}
      <div className="glass-panel" style={{ padding: '14px 18px', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--rs-color-brand-cyan)' }}>
            مرحله {step} از ۸: {stepTitles[step - 1]}
          </span>
          <span className="ltr-num" style={{ fontSize: 12, color: 'var(--theme-text-muted)', fontWeight: 700 }}>
            {Math.round((step / 8) * 100)}%
          </span>
        </div>
        <div className="progress-bar-bg" style={{ height: 6 }}>
          <div className="progress-bar-fill" style={{ width: `${(step / 8) * 100}%` }} />
        </div>
      </div>

      {/* Main Step Card */}
      <div
        className="glass-panel"
        style={{
          padding: 20,
          minHeight: 380,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <div>
          {/* ================================================================ */}
          {/* STEP 1: STORE DIRECTORY / ASSESSMENT TYPE SELECTION */}
          {/* ================================================================ */}
          {step === 1 && (
            <div>
              {/* Executive Demo Banner */}
              <div
                style={{
                  marginBottom: 16,
                  padding: '12px 16px',
                  background: 'linear-gradient(135deg, rgba(0, 176, 240, 0.12) 0%, var(--theme-card-bg) 100%)',
                  border: '1px solid rgba(0, 176, 240, 0.35)',
                  borderRadius: '14px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      background: 'rgba(0, 176, 240, 0.18)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Sparkles size={18} color="var(--rs-color-brand-cyan)" />
                  </div>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--theme-text-primary)', display: 'block' }}>
                      مشاهده نمونه گزارش کامل ارزیابی
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--theme-text-muted)' }}>
                      ۶۵ شاخص، ۱۶ اصطکاک مستند، تصاویر و تحلیل رادار ۳۶۰°
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onStartVisit(SAMPLE_REAL_VISIT)}
                  className="btn-primary"
                  style={{ fontSize: 11, padding: '7px 14px', minHeight: 34 }}
                >
                  بارگذاری ارزیابی نمونه
                </button>
              </div>

              {/* Toggle Between Saved Directory and New Store */}
              <div
                style={{
                  display: 'flex',
                  background: 'var(--theme-nav-btn-bg)',
                  borderRadius: '12px',
                  padding: 4,
                  marginBottom: 16,
                  border: '1px solid var(--theme-card-border)',
                }}
              >
                <button
                  type="button"
                  onClick={() => setWizardMode('DIRECTORY')}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: '9px',
                    border: 'none',
                    background: wizardMode === 'DIRECTORY' ? 'var(--theme-card-bg)' : 'transparent',
                    color: wizardMode === 'DIRECTORY' ? 'var(--rs-color-brand-cyan)' : 'var(--theme-text-muted)',
                    fontWeight: wizardMode === 'DIRECTORY' ? 800 : 600,
                    fontSize: 12,
                    cursor: 'pointer',
                    boxShadow: wizardMode === 'DIRECTORY' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    transition: 'all 150ms ease',
                  }}
                >
                  <BookmarkCheck size={15} />
                  <span>فروشگاه‌های ذخیره‌شده ({savedStores.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setWizardMode('MANUAL')}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: '9px',
                    border: 'none',
                    background: wizardMode === 'MANUAL' ? 'var(--theme-card-bg)' : 'transparent',
                    color: wizardMode === 'MANUAL' ? 'var(--rs-color-brand-cyan)' : 'var(--theme-text-muted)',
                    fontWeight: wizardMode === 'MANUAL' ? 800 : 600,
                    fontSize: 12,
                    cursor: 'pointer',
                    boxShadow: wizardMode === 'MANUAL' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    transition: 'all 150ms ease',
                  }}
                >
                  <Plus size={15} />
                  <span>تعریف فروشگاه جدید</span>
                </button>
              </div>

              {/* MODE 1: SAVED STORES DIRECTORY */}
              {wizardMode === 'DIRECTORY' && (
                <div>
                  {/* Search Bar for Directory */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      background: 'var(--theme-input-bg)',
                      border: '1px solid var(--theme-input-border)',
                      borderRadius: '10px',
                      padding: '8px 12px',
                      marginBottom: 12,
                    }}
                  >
                    <Search size={16} color="var(--theme-text-muted)" />
                    <input
                      type="text"
                      placeholder="جستجوی سریع بین فروشگاه‌ها و شعب..."
                      value={storeSearchQuery}
                      onChange={(e) => setStoreSearchQuery(e.target.value)}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        outline: 'none',
                        width: '100%',
                        fontSize: 12,
                        color: 'var(--theme-text-primary)',
                      }}
                    />
                    {storeSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setStoreSearchQuery('')}
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'gray', padding: 2 }}
                      >
                        ×
                      </button>
                    )}
                  </div>

                  {/* List of Saved Stores */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 310, overflowY: 'auto', paddingLeft: 4 }}>
                    {filteredStores.map((store) => {
                      const isSelected = selectedStoreId === store.id;
                      return (
                        <div
                          key={store.id}
                          onClick={() => handleSelectSavedStore(store)}
                          style={{
                            padding: '12px 14px',
                            borderRadius: '12px',
                            border: `1.5px solid ${isSelected ? 'var(--rs-color-brand-cyan)' : 'var(--theme-card-border)'}`,
                            background: isSelected ? 'rgba(0, 176, 240, 0.08)' : 'var(--theme-card-bg)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 12,
                            transition: 'all 150ms ease',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                width: 38,
                                height: 38,
                                borderRadius: 10,
                                background: store.assessmentType === 'STORE' ? 'rgba(0, 176, 240, 0.15)' : 'rgba(45, 157, 120, 0.15)',
                                color: store.assessmentType === 'STORE' ? 'var(--rs-color-brand-cyan)' : 'var(--rs-color-success)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                              }}
                            >
                              {store.assessmentType === 'STORE' ? <Store size={20} /> : <Building2 size={20} />}
                            </div>

                            <div style={{ overflow: 'hidden' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                <strong style={{ fontSize: 13, color: 'var(--theme-text-primary)' }}>
                                  {store.brandName}
                                </strong>
                                <span style={{ fontSize: 12, color: 'var(--theme-text-muted)' }}>
                                  • {store.branchName}
                                </span>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
                                <span
                                  style={{
                                    fontSize: 10,
                                    background: 'var(--theme-badge-bg)',
                                    color: 'var(--theme-text-muted)',
                                    padding: '1px 6px',
                                    borderRadius: 4,
                                    fontWeight: 700,
                                  }}
                                >
                                  {store.assessmentType === 'STORE' ? (store.businessType ? profileLabel(store.businessType) : 'فروشگاهی') : (store.mallType ? profileLabel(store.mallType) : 'مرکز خرید')}
                                </span>

                                {store.storeFormat && (
                                  <span style={{ fontSize: 10, color: 'var(--theme-text-muted)' }}>
                                    {profileLabel(store.storeFormat)}
                                  </span>
                                )}

                                {store.lastVisitedAt && (
                                  <span style={{ fontSize: 10, color: 'var(--rs-color-brand-cyan)', direction: 'rtl' }}>
                                    آخرین ارزیابی: {new Date(store.lastVisitedAt).toLocaleDateString('fa-IR')}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <button
                              type="button"
                              onClick={() => handleSelectSavedStore(store)}
                              className="btn-primary"
                              style={{ fontSize: 11, padding: '6px 12px', minHeight: 32, whiteSpace: 'nowrap' }}
                            >
                              انتخاب سریع
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleDeleteSavedStore(e, store.id)}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--theme-text-muted)',
                                padding: 6,
                                cursor: 'pointer',
                                borderRadius: 6,
                              }}
                              title="حذف از دیتابیس"
                              aria-label="حذف فروشگاه"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {filteredStores.length === 0 && (
                      <div style={{ textAlign: 'center', padding: '24px 12px', color: 'var(--theme-text-muted)', fontSize: 12 }}>
                        فروشگاهی با این نام یافت نشد. می‌توانید با گزینه «تعریف فروشگاه جدید» فروشگاه مد نظر را اضافه کنید.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* MODE 2: MANUAL NEW STORE TYPE SELECTION */}
              {wizardMode === 'MANUAL' && (
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 800, marginBottom: 6 }}>انتخاب نوع واحد مورد ارزیابی</h3>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
                    مشخص کنید موضوع ارزیابی یک واحد فروشگاهی مستقل است یا کل یک مجتمع تجاری.
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <button
                      type="button"
                      onClick={() => setAssessmentType('STORE')}
                      style={{
                        padding: '18px 12px',
                        borderRadius: '14px',
                        border: `2px solid ${assessmentType === 'STORE' ? 'var(--rs-color-brand-cyan)' : 'var(--theme-card-border)'}`,
                        background: assessmentType === 'STORE' ? 'rgba(0, 176, 240, 0.1)' : 'var(--theme-card-bg)',
                        color: 'var(--theme-text-primary)',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 10,
                        textAlign: 'center',
                        transition: 'all 150ms ease',
                      }}
                    >
                      <div
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: '50%',
                          background: assessmentType === 'STORE' ? 'rgba(0, 176, 240, 0.2)' : 'var(--theme-nav-btn-bg)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Store size={26} color={assessmentType === 'STORE' ? 'var(--rs-color-brand-cyan)' : '#94A3B8'} />
                      </div>
                      <div>
                        <strong style={{ fontSize: 14, display: 'block', fontWeight: 800 }}>ارزیابی فروشگاه</strong>
                        <span style={{ fontSize: 11, color: 'var(--theme-text-muted)', marginTop: 2, display: 'block' }}>Store Assessment</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAssessmentType('MALL')}
                      style={{
                        padding: '18px 12px',
                        borderRadius: '14px',
                        border: `2px solid ${assessmentType === 'MALL' ? 'var(--rs-color-brand-cyan)' : 'var(--theme-card-border)'}`,
                        background: assessmentType === 'MALL' ? 'rgba(0, 176, 240, 0.1)' : 'var(--theme-card-bg)',
                        color: 'var(--theme-text-primary)',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 10,
                        textAlign: 'center',
                        transition: 'all 150ms ease',
                      }}
                    >
                      <div
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: '50%',
                          background: assessmentType === 'MALL' ? 'rgba(0, 176, 240, 0.2)' : 'var(--theme-nav-btn-bg)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Building2 size={26} color={assessmentType === 'MALL' ? 'var(--rs-color-brand-cyan)' : '#94A3B8'} />
                      </div>
                      <div>
                        <strong style={{ fontSize: 14, display: 'block', fontWeight: 800 }}>ارزیابی مرکز خرید</strong>
                        <span style={{ fontSize: 11, color: 'var(--theme-text-muted)', marginTop: 2, display: 'block' }}>Mall Infrastructure</span>
                      </div>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================================================================ */}
          {/* STEP 2: BRAND */}
          {/* ================================================================ */}
          {step === 2 && (
            <div>
              <h2 style={{ fontSize: 17, fontWeight: 800, marginBottom: 6 }}>مرحله ۲: مجموعه یا برند</h2>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
                نام تجاری یا هلدینگ مورد ارزیابی را مشخص کنید.
              </p>

              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                  نام برند / مرکز:
                </label>
                <input
                  type="text"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  className="friction-textarea"
                  style={{ minHeight: 44, padding: '10px 14px', fontSize: 14 }}
                  placeholder="مثلاً: زارا، ال‌سی وایکیکی، هایپراستار..."
                />
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                {['زارا (Zara)', 'ال‌سی وایکیکی', 'مانگو (Mango)', 'هایپراستار', 'مرکز خرید کوروش', 'ایران مال', 'پالادیوم'].map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setBrandName(b)}
                    style={{
                      padding: '5px 10px',
                      borderRadius: 'var(--radius-full)',
                      border: '1px solid var(--border-subtle)',
                      background: brandName === b ? 'var(--rs-color-brand-cyan)' : 'var(--theme-input-bg)',
                      color: brandName === b ? '#FFFFFF' : 'var(--theme-text-primary)',
                      fontSize: 11,
                      cursor: 'pointer',
                    }}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* STEP 3: BRANCH */}
          {/* ================================================================ */}
          {step === 3 && (
            <div>
              <h2 style={{ fontSize: 17, fontWeight: 800, marginBottom: 6 }}>مرحله ۳: شعبه و موقعیت</h2>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
                نام و نشانی دقیق این شعبه را وارد نمایید.
              </p>

              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                  نام شعبه:
                </label>
                <input
                  type="text"
                  value={branchName}
                  onChange={(e) => setBranchName(e.target.value)}
                  className="friction-textarea"
                  style={{ minHeight: 44, padding: '10px 14px', fontSize: 14 }}
                  placeholder="مثلاً: شعبه خیابان ولیعصر، طبقه G1 کوروش..."
                />
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {['شعبه خیابان ولیعصر', 'شعبه مجتمع کوروش', 'شعبه پالادیوم', 'شعبه بزرگراه باکری'].map((br) => (
                  <button
                    key={br}
                    type="button"
                    onClick={() => setBranchName(br)}
                    style={{
                      padding: '5px 10px',
                      borderRadius: 'var(--radius-full)',
                      border: '1px solid var(--border-subtle)',
                      background: branchName === br ? 'var(--rs-color-brand-cyan)' : 'var(--theme-input-bg)',
                      color: branchName === br ? '#FFFFFF' : 'var(--theme-text-primary)',
                      fontSize: 11,
                      cursor: 'pointer',
                    }}
                  >
                    {br}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* STEP 4: BUSINESS TYPE OR MALL SCALE */}
          {/* ================================================================ */}
          {step === 4 && (
            <div>
              <h2 style={{ fontSize: 17, fontWeight: 800, marginBottom: 6 }}>
                مرحله ۴: {assessmentType === 'STORE' ? 'رسته کسب‌وکار (صنف)' : 'مقیاس و رده مرکز خرید'}
              </h2>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
                موتور ارزیابی از این فیلد برای انطباق با ماتریس استاندارد شاخص‌ها استفاده می‌کند.
              </p>

              {assessmentType === 'STORE' ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, maxHeight: 250, overflowY: 'auto' }}>
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
                        padding: '10px 12px',
                        borderRadius: 'var(--rs-radius-control)',
                        border: `1.5px solid ${businessType === bt.code ? 'var(--rs-color-brand-cyan)' : 'var(--border-subtle)'}`,
                        background: businessType === bt.code ? 'rgba(0, 176, 240, 0.14)' : 'var(--theme-input-bg)',
                        color: businessType === bt.code ? 'var(--rs-color-brand-cyan)' : 'var(--theme-text-primary)',
                        fontSize: 12,
                        fontWeight: businessType === bt.code ? 700 : 500,
                        textAlign: 'right',
                        cursor: 'pointer',
                        transition: 'all 120ms ease',
                      }}
                    >
                      {bt.label}
                    </button>
                  ))}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
                        padding: '10px 14px',
                        borderRadius: 'var(--rs-radius-control)',
                        border: `1.5px solid ${mallType === mt.code ? 'var(--rs-color-brand-cyan)' : 'var(--border-subtle)'}`,
                        background: mallType === mt.code ? 'rgba(0, 176, 240, 0.14)' : 'var(--theme-input-bg)',
                        color: 'var(--theme-text-primary)',
                        textAlign: 'right',
                        cursor: 'pointer',
                        transition: 'all 120ms ease',
                      }}
                    >
                      <strong style={{ fontSize: 13, display: 'block' }}>{mt.label}</strong>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{mt.sub}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ================================================================ */}
          {/* STEP 5: LOCATION CONTEXT */}
          {/* ================================================================ */}
          {step === 5 && (
            <div>
              <h2 style={{ fontSize: 17, fontWeight: 800, marginBottom: 6 }}>مرحله ۵: بافت موقعیتی (Location Context)</h2>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
                موقعیت استقرار واحد را تعیین کنید تا شاخص‌های متناسب خیابانی یا درون مجتمع اعمال شوند.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { code: 'STREET_STORE', label: 'فروشگاه واقع در خیابان', desc: 'واحد مستقل با دید مستقیم از پیاده‌رو شهری' },
                  { code: 'MALL_STORE', label: 'فروشگاه داخل مرکز خرید', desc: 'واحد تجاری مستقر در راهروها یا طبقات مرکز خرید' },
                  { code: 'SHOP_IN_SHOP', label: 'شاپ این شاپ (Shop-in-Shop)', desc: 'غرفه داخل دیپارتمنت‌استور یا فروشگاه زنجیره‌ای' },
                  { code: 'KIOSK', label: 'کیوسک / پاپ‌آپ', desc: 'کیوسک یا غرفهٔ پاپ‌آپ در کریدور یا فضای باز' },
                ].map((lc) => (
                  <button
                    key={lc.code}
                    type="button"
                    onClick={() => setLocationContext(lc.code as LocationContextCode)}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 'var(--rs-radius-control)',
                      border: `1.5px solid ${locationContext === lc.code ? 'var(--rs-color-brand-cyan)' : 'var(--border-subtle)'}`,
                      background: locationContext === lc.code ? 'rgba(0, 176, 240, 0.14)' : 'var(--theme-input-bg)',
                      color: 'var(--theme-text-primary)',
                      textAlign: 'right',
                      cursor: 'pointer',
                      transition: 'all 120ms ease',
                    }}
                  >
                    <strong style={{ fontSize: 13, display: 'block' }}>{lc.label}</strong>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{lc.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* STEP 6: STORE FORMAT */}
          {/* ================================================================ */}
          {step === 6 && (
            <div>
              <h2 style={{ fontSize: 17, fontWeight: 800, marginBottom: 6 }}>مرحله ۶: قالب و فرمت شعبه</h2>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
                مقیاس عملیاتی و کانسپت فروشگاه را مشخص کنید.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
                      padding: '10px 12px',
                      borderRadius: 'var(--rs-radius-control)',
                      border: `1.5px solid ${storeFormat === sf.code ? 'var(--rs-color-brand-cyan)' : 'var(--border-subtle)'}`,
                      background: storeFormat === sf.code ? 'rgba(0, 176, 240, 0.14)' : 'var(--theme-input-bg)',
                      color: 'var(--theme-text-primary)',
                      textAlign: 'right',
                      cursor: 'pointer',
                      transition: 'all 120ms ease',
                    }}
                  >
                    <strong style={{ fontSize: 13, display: 'block' }}>{sf.label}</strong>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{sf.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* STEP 7: PHYSICAL ATTRIBUTES */}
          {/* ================================================================ */}
          {step === 7 && (
            <div>
              <h2 style={{ fontSize: 17, fontWeight: 800, marginBottom: 6 }}>مرحله ۷: ویژگی‌های فیزیکی محل (Attributes)</h2>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                امکانات موجود در این شعبه را تیک بزنید تا سؤالات بر اساس امکانات واقعی فیلتر شوند.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8, maxHeight: 260, overflowY: 'auto' }}>
                {[
                  { key: 'has_window_display', compat: 'hasShowcase', label: 'ویترین شیشه‌ای و مانکن رو به بیرون', desc: 'کدهای FW02-06 در صورت عدم وجود حذف می‌شوند' },
                  { key: 'has_fitting_room', compat: 'hasFittingRoom', label: 'اتاق پرو لباس', desc: 'کدهای FFR02-06 در صورت عدم وجود حذف می‌شوند' },
                  { key: 'has_mannequins', compat: 'hasMannequins', label: 'مانکن‌های نمایشی داخل فروشگاه', desc: 'کدهای FMA در صورت عدم وجود حذف می‌شوند' },
                  { key: 'has_elevator', compat: 'hasElevator', label: 'آسانسور، پله‌برقی یا پله داخلی طبقات', desc: 'شاخص‌های دسترسی بین‌طبقه‌ای' },
                  { key: 'has_parking', compat: 'hasParking', label: 'پارکینگ اختصاصی مشتریان', desc: 'شاخص‌های پارکینگ فروشگاه' },
                  { key: 'has_customer_toilet', compat: 'hasCustomerToilet', label: 'سرویس بهداشتی در دسترس مشتریان', desc: 'رفاهیات بهداشتی داخلی' },
                  { key: 'has_checkout_counter', compat: undefined, label: 'کانتر صندوق و سیستم صف', desc: 'شاخص‌های تسویه و صف' },
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
                        transition: 'all 120ms ease',
                      }}
                    >
                      <div>
                        <strong style={{ fontSize: 13, display: 'block', color: isChecked ? 'var(--theme-text-primary)' : 'var(--text-muted)' }}>
                          {attr.label}
                        </strong>
                        <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                          <CodeText>{attr.desc}</CodeText>
                        </span>
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

          {/* ================================================================ */}
          {/* STEP 8: PREVIEW & FINAL CONFIRMATION */}
          {/* ================================================================ */}
          {step === 8 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <CheckCircle2 color="var(--rs-color-success)" size={24} />
                <h2 style={{ fontSize: 17, fontWeight: 800 }}>مرحله ۸: پیش‌نمایش فرم و تأیید نهایی</h2>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
                چک‌لیست بر اساس استانداردها آماده شد. مشخصات نهایی را بررسی و تایید نمایید:
              </p>

              {/* Profile Summary Card */}
              <div
                style={{
                  background: 'var(--theme-card-inner)',
                  borderRadius: '12px',
                  padding: 14,
                  marginBottom: 14,
                  border: '1px solid var(--theme-card-border)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>محل و شعبه:</span>
                  <strong style={{ fontSize: 13, color: 'var(--theme-text-primary)' }}>
                    {brandName} — {branchName}
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>نوع ارزیابی:</span>
                  <span style={{ fontSize: 13, color: 'var(--rs-color-brand-cyan)', fontWeight: 700 }}>
                    {assessmentType === 'STORE' ? `فروشگاه ${profileLabel(businessType)}` : profileLabel(mallType)}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>موقعیت و قالب:</span>
                  <span style={{ fontSize: 12, color: 'var(--theme-text-primary)' }}>
                    {profileLabel(locationContext)} • {assessmentType === 'STORE' ? profileLabel(storeFormat) : 'مرکز تجاری'}
                  </span>
                </div>
              </div>

              {/* Metrics Strip */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 14 }}>
                <div className="metric-card" style={{ padding: 8, textAlign: 'center' }}>
                  <span className="metric-value ltr-num" style={{ fontSize: 18, color: 'var(--rs-color-brand-cyan)' }}>
                    {previewIndicators.length}
                  </span>
                  <span className="metric-label" style={{ fontSize: 10 }}>کل شاخص‌ها</span>
                </div>

                <div className="metric-card" style={{ padding: 8, textAlign: 'center' }}>
                  <span className="metric-value ltr-num" style={{ fontSize: 18, color: 'var(--rs-color-success)' }}>
                    {uniqueSectionsCount}
                  </span>
                  <span className="metric-label" style={{ fontSize: 10 }}>بخش سفر</span>
                </div>

                <div className="metric-card" style={{ padding: 8, textAlign: 'center' }}>
                  <span className="metric-value ltr-num" style={{ fontSize: 18, color: 'var(--rs-color-warning)' }}>
                    {mandatoryPhotoCount}
                  </span>
                  <span className="metric-label" style={{ fontSize: 10 }}>{PHOTOS_REQUIRED ? 'عکس الزامی' : 'عکس توصیه‌شده'}</span>
                </div>

                <div className="metric-card" style={{ padding: 8, textAlign: 'center' }}>
                  <span className="metric-value ltr-num" style={{ fontSize: 18, color: 'var(--rs-color-action-primary)' }}>
                    ~{estimatedMinutes}
                  </span>
                  <span className="metric-label" style={{ fontSize: 10 }}>دقیقه تخمینی</span>
                </div>
              </div>

              {/* Persistence Checkbox */}
              <div
                style={{
                  background: 'rgba(0, 176, 240, 0.07)',
                  border: '1px solid rgba(0, 176, 240, 0.25)',
                  borderRadius: '10px',
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
                onClick={() => setSaveToDirectory(!saveToDirectory)}
              >
                <input
                  type="checkbox"
                  checked={saveToDirectory}
                  onChange={(e) => setSaveToDirectory(e.target.checked)}
                  style={{ width: 17, height: 17, accentColor: 'var(--rs-color-brand-cyan)', cursor: 'pointer' }}
                />
                <div style={{ flex: 1 }}>
                  <strong style={{ fontSize: 12, color: 'var(--theme-text-primary)', display: 'block' }}>
                    ذخیره و به‌روزرسانی مشخصات این فروشگاه در دیتابیس
                  </strong>
                  <span style={{ fontSize: 11, color: 'var(--theme-text-muted)' }}>
                    در دفعات بعدی می‌توانید این فروشگاه را با ۱ کلیک انتخاب و فرم‌ها را سریعاً تکمیل کنید.
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Wizard Navigation Controls */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 20,
            paddingTop: 14,
            borderTop: '1px solid var(--theme-card-border)',
            gap: 10,
          }}
        >
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => Math.max(1, s - 1))}
              className="btn-secondary"
              style={{ minHeight: 44, padding: '8px 16px', fontSize: 13 }}
            >
              <ArrowRight size={16} />
              مرحله قبل
            </button>
          ) : onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              className="btn-secondary"
              style={{ minHeight: 44, padding: '8px 16px', fontSize: 13 }}
            >
              انصراف
            </button>
          ) : (
            <div />
          )}

          {step < 8 ? (
            <button
              type="button"
              onClick={() => setStep((s) => Math.min(8, s + 1))}
              className="btn-primary"
              style={{ minHeight: 44, padding: '8px 18px', fontSize: 13 }}
            >
              گام بعدی
              <ArrowLeft size={16} />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleStart}
              className="btn-primary"
              style={{
                background: 'var(--rs-color-action-primary)',
                minHeight: 44,
                padding: '8px 20px',
                fontSize: 13,
                boxShadow: '0 4px 16px rgba(0, 125, 170, 0.35)',
              }}
            >
              <CheckCircle2 size={16} />
              شروع ارزیابی میدانی
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

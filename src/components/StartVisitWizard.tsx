import { CodeText } from './ui/CodeText';
import React, { useState, useMemo, useEffect } from 'react';
import {
  AssessmentType,
  BusinessTypeCode,
  FbService,
  FbType,
  LocationContextCode,
  MallTypeCode,
  StoreAttributes,
  Indicator,
  VisitSession,
  AssessmentProfile,
  SavedStoreDirectoryItem,
} from '../types';
import { generateDynamicChecklistWithAudit } from '../engine/ruleEngine';
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
import { faDigits, profileLabel } from '../utils/format';
import { FB_FORMATS, FB_SERVICES, FB_TYPES, describeStoreFormat, sectorHasFormatWorkbooks, storeFormatsFor } from '../data/storeFormats';
import { BrandService, type Brand } from '../services/brandService';
import { nameKey } from '../engine/frModel';
import { PHOTOS_REQUIRED } from '../config/policy';

interface StartVisitWizardProps {
  allIndicators: Indicator[];
  onStartVisit: (session: VisitSession) => void;
  onCancel?: () => void;
  /** Recorded as the evaluator of the new visit. */
  currentUserName?: string;
  /** Registered brands: a visit is for one of them, or for a brand defined right here. */
  brands?: Brand[];
  onBrandsChanged?: () => Promise<void>;
  /** A branch chosen elsewhere (brand manager, business report) to start a visit for. */
  preset?: { brandName: string; branchName: string } | null;
  onPresetUsed?: () => void;
}

export const StartVisitWizard: React.FC<StartVisitWizardProps> = ({
  allIndicators,
  onStartVisit,
  onCancel,
  currentUserName,
  brands = [],
  onBrandsChanged,
  preset,
  onPresetUsed,
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
  const [brandName, setBrandName] = useState('');
  const [newBrand, setNewBrand] = useState('');
  const [brandBusy, setBrandBusy] = useState(false);
  const [brandError, setBrandError] = useState<string | null>(null);
  const [branchName, setBranchName] = useState('');
  const [businessType, setBusinessType] = useState<BusinessTypeCode>('Fashion');
  const [mallType, setMallType] = useState<MallTypeCode>('Regional');
  const [locationContext, setLocationContext] = useState<LocationContextCode>('STREET_STORE');
  // F&B picks three things: type, format and service. Nothing is preselected: all three must be chosen.
  const [fbType, setFbType] = useState<FbType | undefined>(undefined);
  const [fbFormat, setFbFormat] = useState<LocationContextCode | undefined>(undefined);
  const [fbService, setFbService] = useState<FbService | undefined>(undefined);
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

  // F&B choices of a saved branch. Branches saved before the three choices existed carry a single code
  // (RESTAURANT, TABLE_SERVICE ...): it fills the matching choice and the rest has to be picked.
  const applyStoreFb = (st: SavedStoreDirectoryItem) => {
    let t: FbType | undefined = st.fbType;
    let sv: FbService | undefined = st.fbService;
    let f: LocationContextCode | undefined = st.locationContext;
    if (f === 'RESTAURANT' || f === 'COFFEE_SHOP') { t = t ?? f; f = undefined; }
    else if (f === 'TABLE_SERVICE' || f === 'COUNTER_SERVICE') { sv = sv ?? f; f = undefined; }
    if (f !== 'STREET_STORE' && f !== 'FOOD_COURT') f = undefined;
    setFbType(t);
    setFbService(sv);
    setFbFormat(f);
    return !!(t && f && sv);
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
    const fbDone = store.assessmentType === 'STORE' && store.businessType === 'F_B' ? applyStoreFb(store) : true;
    // Branches defined in the brand manager have no feature answers yet: keep the defaults.
    if (store.attributes && Object.keys(store.attributes).length) setAttributes(store.attributes);

    // Jump straight to confirmation, unless the branch has no recorded features yet (or an F&B branch
    // still has to choose its type, format and service).
    setStep(!fbDone ? 5 : store.attributes && Object.keys(store.attributes).length ? 7 : 4);
  };

  // Choosing a branch in the branch step fills what is known about it and carries on with the next steps.
  const pickBranch = (store: SavedStoreDirectoryItem) => {
    setSelectedStoreId(store.id);
    setBranchName(store.branchName);
    if (store.locationContext) setLocationContext(store.locationContext);
    if (store.assessmentType === assessmentType) {
      if (store.businessType) setBusinessType(store.businessType);
      if (store.mallType) setMallType(store.mallType);
      if (store.assessmentType === 'STORE' && store.businessType === 'F_B') applyStoreFb(store);
    }
    if (store.attributes && Object.keys(store.attributes).length) setAttributes(store.attributes);
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
        ...(businessType === 'F_B' ? { fbType, fbService } : {}),
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
  }, [assessmentType, businessType, locationContext, fbType, fbService, mallType, brandName, branchName, attributes]);

  // Evaluated indicators via deterministic rule engine
  const { indicators: previewIndicators, auditTrail } = useMemo(() => {
    return generateDynamicChecklistWithAudit(allIndicators, profile);
  }, [allIndicators, profile]);

  const isFb = assessmentType === 'STORE' && businessType === 'F_B';
  const fbComplete = !!(fbType && fbFormat && fbService);
  // The format follows the sector. F&B: the format is the one picked among street / food court; other
  // sectors fall back to the first format they have when the current one is not theirs.
  useEffect(() => {
    if (isFb) {
      if (locationContext !== (fbFormat ?? 'STREET_STORE')) setLocationContext(fbFormat ?? 'STREET_STORE');
      return;
    }
    const list = storeFormatsFor(assessmentType === 'STORE' ? businessType : undefined);
    if (!list.some((f) => f.code === locationContext)) setLocationContext(list.find((f) => f.code === 'STREET_STORE')?.code ?? list[0].code);
  }, [assessmentType, businessType, locationContext, isFb, fbFormat]);

  // How many F&B indicators an option would leave, given the other two choices (a row needs an X in each).
  const fbOptionCount = (kind: 'type' | 'format' | 'service', code: string) => {
    const chosen = [kind === 'type' ? code : fbType, kind === 'format' ? code : fbFormat, kind === 'service' ? code : fbService].filter(Boolean) as string[];
    return allIndicators.filter(
      (i) =>
        i.template === 'STORE' &&
        i.status !== 'ARCHIVED' &&
        (!i.applicableBusinessTypes?.length || i.applicableBusinessTypes.includes('F_B')) &&
        chosen.every((c) => !i.applicableFormats?.length || i.applicableFormats.includes(c as LocationContextCode)),
    ).length;
  };

  // How many indicators each store format asks for this sector (shown when the format is chosen).
  const formatCounts = useMemo(() => {
    const out: Record<string, number> = {};
    if (assessmentType !== 'STORE' || businessType === 'F_B') return out;
    for (const { code } of storeFormatsFor(businessType)) {
      out[code] = generateDynamicChecklistWithAudit(allIndicators, { ...profile, locationContext: code }).indicators.length;
    }
    return out;
  }, [allIndicators, profile, assessmentType, businessType]);

  const uniqueSectionsCount = useMemo(() => {
    return new Set(previewIndicators.map((i) => i.journeyStage)).size;
  }, [previewIndicators]);

  const mandatoryPhotoCount = useMemo(() => {
    return previewIndicators.filter((i) => i.requiresPhoto).length;
  }, [previewIndicators]);

  const estimatedMinutes = Math.max(15, Math.round(previewIndicators.length * 0.35));

  const activeBrands = useMemo(() => brands.filter((b) => b.isActive), [brands]);
  // Branches of the chosen brand: its directory entries, under its current name or any earlier one.
  const brandBranches = useMemo(() => {
    const brand = brands.find((b) => nameKey(b.name) === nameKey(brandName));
    const keys = new Set([brandName, ...(brand ? [brand.name, ...brand.aliases] : [])].map(nameKey));
    return savedStores.filter((s) => keys.has(nameKey(s.brandName)) && s.isActive !== false);
  }, [brands, brandName, savedStores]);

  const chooseBrand = (name: string) => {
    if (nameKey(name) !== nameKey(brandName)) {
      setBranchName('');
      setSelectedStoreId(null);
    }
    setBrandName(name);
  };

  // From the list: a new branch for this brand goes straight to the branch step.
  const startBranchOf = (name: string) => {
    chooseBrand(name);
    setWizardMode('MANUAL');
    setStep(3);
  };

  const [branchBusy, setBranchBusy] = useState(false);
  const [branchError, setBranchError] = useState<string | null>(null);
  // Defining a branch saves it in the brand's list right away, so it exists even if the visit is not started.
  const defineBranch = async () => {
    const name = branchName.trim();
    if (!name || !brandName.trim()) return;
    setBranchBusy(true);
    setBranchError(null);
    try {
      const exact = brandBranches.find((b) => nameKey(b.branchName) === nameKey(name));
      const saved = exact || (await StoreService.saveStore({
        brandName,
        branchName: name,
        assessmentType,
        businessType: assessmentType === 'STORE' ? businessType : undefined,
        mallType: assessmentType === 'MALL' ? mallType : undefined,
        locationContext,
        ...(isFb ? { fbType, fbService } : {}),
        attributes: undefined as any,
      }));
      setSavedStores(await StoreService.getAllStores());
      await onBrandsChanged?.();
      setBranchName(saved.branchName);
      setSelectedStoreId(saved.id);
    } catch (e: any) {
      setBranchError(e?.message || 'تعریف شعبه انجام نشد.');
    } finally {
      setBranchBusy(false);
    }
  };

  // A branch picked on another screen: fill it in and continue from there.
  useEffect(() => {
    if (!preset) return;
    const found = savedStores.find((s) => nameKey(s.brandName) === nameKey(preset.brandName) && nameKey(s.branchName) === nameKey(preset.branchName));
    if (!found && !savedStores.length) return; // the directory is still loading
    if (found) handleSelectSavedStore(found);
    else {
      setBrandName(preset.brandName);
      setBranchName(preset.branchName);
      setWizardMode('MANUAL');
      setStep(4);
    }
    onPresetUsed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset, savedStores]);

  const defineBrand = async () => {
    if (newBrand.trim().length < 2) return;
    setBrandBusy(true);
    setBrandError(null);
    try {
      const brand = await BrandService.create({ name: newBrand, businessType: assessmentType === 'STORE' ? businessType : undefined });
      await onBrandsChanged?.();
      chooseBrand(brand.name);
      setNewBrand('');
    } catch (e: any) {
      setBrandError(e?.message || 'تعریف برند انجام نشد.');
    } finally {
      setBrandBusy(false);
    }
  };

  const handleStart = async () => {
    // 1. Persist to database if toggle is checked
    if (saveToDirectory) {
      await StoreService.saveStore({
        brandName,
        branchName: brandBranches.find((b) => nameKey(b.branchName) === nameKey(branchName))?.branchName || branchName,
        assessmentType,
        businessType: assessmentType === 'STORE' ? businessType : undefined,
        mallType: assessmentType === 'MALL' ? mallType : undefined,
        locationContext,
        ...(isFb ? { fbType, fbService } : {}),
        attributes,
        ...(auditorName ? { auditorName } : {}),
        ...(supervisorName ? { supervisorName } : {}),
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
      ...(isFb ? { fbType, fbService } : {}),
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

  // The directory, grouped by brand; brands without a branch are listed too so a first branch can be added.
  const storeGroups = useMemo(() => {
    const groups = new Map<string, { name: string; stores: SavedStoreDirectoryItem[] }>();
    const key = (n: string) => nameKey(brands.find((b) => [b.name, ...b.aliases].some((x) => nameKey(x) === nameKey(n)))?.name || n);
    const displayName = (n: string) => brands.find((b) => [b.name, ...b.aliases].some((x) => nameKey(x) === nameKey(n)))?.name || n;
    const q = storeSearchQuery.trim();
    for (const b of brands) if (b.isActive && !q) groups.set(nameKey(b.name), { name: b.name, stores: [] });
    for (const st of filteredStores) {
      if (st.isActive === false) continue;
      const k = key(st.brandName);
      if (!groups.has(k)) groups.set(k, { name: displayName(st.brandName), stores: [] });
      groups.get(k)!.stores.push(st);
    }
    return [...groups.values()].sort((a, b) => b.stores.length - a.stores.length || a.name.localeCompare(b.name, 'fa'));
  }, [brands, filteredStores, storeSearchQuery]);


  // The facilities step only filters indicators of sectors without a workbook per format; skip it otherwise.
  const skipFacilities = assessmentType === 'STORE' && sectorHasFormatWorkbooks(businessType);
  const totalSteps = skipFacilities ? 6 : 7;
  const shownStep = skipFacilities && step === 7 ? 6 : step;

  const stepTitles = [
    'انتخاب یا ثبت فروشگاه',
    'مجموعه / برند',
    'شعبه محل ارزیابی',
    assessmentType === 'STORE' ? 'بخش (سکتور) مورد نظر' : 'مقیاس مرکز خرید',
    'موقعیت مکانی فروشگاه',
    'امکانات فیزیکی محل مورد ارزیابی',
    'پیش‌نمایش فرم و تایید',
  ];

  return (
    <div style={{ maxWidth: 640, margin: '16px auto', padding: '0 12px 64px' }}>
      {/* Wizard Progress Header */}
      <div className="glass-panel" style={{ padding: '14px 18px', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--rs-color-brand-cyan)' }}>
            مرحله {faDigits(shownStep)} از {faDigits(totalSteps)}: {stepTitles[step - 1]}
          </span>
          <span className="ltr-num" style={{ fontSize: 12, color: 'var(--theme-text-muted)', fontWeight: 700 }}>
            {Math.round((shownStep / totalSteps) * 100)}%
          </span>
        </div>
        <div className="progress-bar-bg" style={{ height: 6 }}>
          <div className="progress-bar-fill" style={{ width: `${(shownStep / totalSteps) * 100}%` }} />
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
                    {storeGroups.map((group) => (
                    <React.Fragment key={group.name}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 4 }}>
                      <strong style={{ fontSize: 13, color: 'var(--theme-text-primary)' }}>{group.name} <span style={{ fontWeight: 400, color: 'var(--theme-text-muted)', fontSize: 11 }}>· {faDigits(group.stores.length)} شعبه</span></strong>
                      <button type="button" className="btn-secondary" style={{ fontSize: 11, padding: '4px 10px', minHeight: 28 }} onClick={() => startBranchOf(group.name)}>
                        <Plus size={12} /> شعبهٔ جدید
                      </button>
                    </div>
                    {group.stores.length === 0 && (
                      <div style={{ fontSize: 11, color: 'var(--theme-text-muted)', padding: '2px 4px 6px' }}>این برند هنوز شعبه‌ای ندارد؛ با «شعبهٔ جدید» اولین شعبه را تعریف کنید.</div>
                    )}
                    {group.stores.map((store) => {
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
                                    fontSize: 11,
                                    background: 'var(--theme-badge-bg)',
                                    color: 'var(--theme-text-muted)',
                                    padding: '1px 6px',
                                    borderRadius: 4,
                                    fontWeight: 700,
                                  }}
                                >
                                  {store.assessmentType === 'STORE' ? (store.businessType ? profileLabel(store.businessType) : 'فروشگاهی') : (store.mallType ? profileLabel(store.mallType) : 'مرکز خرید')}
                                </span>

                                {store.lastVisitedAt && (
                                  <span style={{ fontSize: 11, color: 'var(--rs-color-brand-cyan)', direction: 'rtl' }}>
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
                    </React.Fragment>
                    ))}

                    {storeGroups.length === 0 && (
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
                    نوع واحد مورد ارزیابی را مشخص کنید.
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
                        <span style={{ fontSize: 11, color: 'var(--theme-text-muted)', marginTop: 2, display: 'block' }}>ارزیابی یک واحد فروشگاهی</span>
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
                        <span style={{ fontSize: 11, color: 'var(--theme-text-muted)', marginTop: 2, display: 'block' }}>ارزیابی زیرساخت کل مجتمع</span>
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
                برند مورد ارزیابی را انتخاب کنید، یا اگر برای اولین بار است برند جدید تعریف کنید. گزارش کل کسب‌وکار همهٔ شعب هر برند را با هم مقایسه می‌کند.
              </p>

              {activeBrands.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }} role="group" aria-label="برندهای تعریف‌شده">
                  {activeBrands.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => chooseBrand(b.name)}
                      aria-pressed={nameKey(brandName) === nameKey(b.name)}
                      style={{
                        padding: '8px 14px',
                        borderRadius: 'var(--radius-full)',
                        border: '1px solid var(--border-subtle)',
                        background: nameKey(brandName) === nameKey(b.name) ? 'var(--rs-color-brand-cyan)' : 'var(--theme-input-bg)',
                        color: nameKey(brandName) === nameKey(b.name) ? '#FFFFFF' : 'var(--theme-text-primary)',
                        fontSize: 13,
                        cursor: 'pointer',
                      }}
                    >
                      {b.name}
                    </button>
                  ))}
                </div>
              )}

              <div style={{ marginBottom: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                  {activeBrands.length ? 'برند جدید:' : 'نام برند / مرکز:'}
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    value={newBrand}
                    onChange={(e) => setNewBrand(e.target.value)}
                    className="friction-textarea"
                    style={{ minHeight: 44, padding: '10px 14px', fontSize: 14, flex: 1 }}
                    placeholder="نام برند را بنویسید…"
                    onKeyDown={(e) => e.key === 'Enter' && defineBrand()}
                  />
                  <button type="button" className="btn-secondary" disabled={brandBusy || newBrand.trim().length < 2} onClick={defineBrand}>
                    <Plus size={15} /> تعریف برند
                  </button>
                </div>
                {brandError && <div className="auth-error" role="alert" style={{ marginTop: 8 }}>{brandError}</div>}
              </div>
              {brandName && <p style={{ fontSize: 12, marginTop: 10 }}>برند انتخاب‌شده: <strong>{brandName}</strong></p>}
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
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    value={branchName}
                    onChange={(e) => setBranchName(e.target.value)}
                    className="friction-textarea"
                    style={{ minHeight: 44, padding: '10px 14px', fontSize: 14, flex: 1 }}
                    placeholder="نام شعبه، مثلاً: ولیعصر، طبقه G1 کوروش…"
                    onKeyDown={(e) => e.key === 'Enter' && defineBranch()}
                  />
                  <button type="button" className="btn-secondary" disabled={branchBusy || !branchName.trim()} onClick={defineBranch}>
                    <Plus size={15} /> تعریف شعبه
                  </button>
                </div>
                {branchError && <div className="auth-error" role="alert" style={{ marginTop: 8 }}>{branchError}</div>}
                {selectedStoreId && brandBranches.some((b) => b.id === selectedStoreId && nameKey(b.branchName) === nameKey(branchName)) && (
                  <p style={{ fontSize: 12, marginTop: 8 }}>شعبهٔ <strong>{branchName}</strong> برای برند <strong>{brandName}</strong> ثبت شده است.</p>
                )}
              </div>

              {brandBranches.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }} role="group" aria-label="شعب این برند">
                  {brandBranches.map((br) => (
                    <button
                      key={br.id}
                      type="button"
                      onClick={() => pickBranch(br)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 'var(--radius-full)',
                        border: '1px solid var(--border-subtle)',
                        background: nameKey(branchName) === nameKey(br.branchName) ? 'var(--rs-color-brand-cyan)' : 'var(--theme-input-bg)',
                        color: nameKey(branchName) === nameKey(br.branchName) ? '#FFFFFF' : 'var(--theme-text-primary)',
                        fontSize: 12,
                        cursor: 'pointer',
                      }}
                    >
                      {br.branchName}{br.city ? ` · ${br.city}` : ''}
                    </button>
                  ))}
                </div>
              )}
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10 }}>
                {brandBranches.length ? 'یکی از شعب بالا را انتخاب کنید یا نام شعبهٔ جدید را بنویسید؛ شعبهٔ جدید به فهرست شعب این برند اضافه می‌شود.' : 'این برند هنوز شعبه‌ای ندارد؛ نام شعبه را بنویسید تا به فهرست اضافه شود.'}
              </p>
            </div>
          )}

          {/* ================================================================ */}
          {/* STEP 4: BUSINESS TYPE OR MALL SCALE */}
          {/* ================================================================ */}
          {step === 4 && (
            <div>
              <h2 style={{ fontSize: 17, fontWeight: 800, marginBottom: 6 }}>
                مرحله ۴: {assessmentType === 'STORE' ? 'بخش (سکتور) مورد نظر' : 'مقیاس و رده مرکز خرید'}
              </h2>

              {assessmentType === 'STORE' ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                  {[
                    { code: 'Fashion', label: 'پوشاک' },
                    { code: 'Shoe_Bag', label: 'کیف و کفش' },
                    { code: 'Watch_Jewelry', label: 'ساعت، طلا، نقره و جواهرات' },
                    { code: 'FMCG', label: 'فروشگاه کالاهای تند گردش (سوپرمارکت و هایپرمارکت)' },
                    { code: 'F_B', label: 'رستوران و کافه' },
                    { code: 'Hardware', label: 'فروشگاه سخت افزار (ابزارآلات و....)' },
                    { code: 'Homeware', label: 'لوازم خانگی' },
                    { code: 'Beauty_Cosmetics', label: 'آرایشی و زیبایی' },
                    { code: 'Electronics', label: 'الکترونیک و دیجیتال' },
                    { code: 'Entertainment', label: 'سرگرمی و اسباب‌بازی' },
                    { code: 'Sports', label: 'فروشگاه کالای ورزشی' },
                    { code: 'Specialty', label: 'فروشگاه‌های تخصصی' },
                    { code: 'Services', label: 'فروشگاه خدماتی' },
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
                    { code: 'SM', label: 'مرکز خرید محلی / پایه', sub: 'پارکینگ و خدمات ساده' },
                    { code: 'Neighborhood', label: 'مرکز تجاری محله‌ای', sub: 'تأمین روزمره با تنوع متوسط' },
                    { code: 'Community', label: 'مرکز خرید منطقه‌ای', sub: 'خدمات کامل منطقه‌ای' },
                    { code: 'Regional', label: 'مرکز خرید منطقه‌ای بزرگ', sub: 'مگامال کامل با پارکینگ ۲۱ گانه' },
                    { code: 'Super_Regional', label: 'ابر مرکز خرید فرامنطقه‌ای', sub: 'کامل‌ترین مقیاس تجاری و رفاهی' },
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
              <h2 style={{ fontSize: 17, fontWeight: 800, marginBottom: 6 }}>مرحله ۵: موقعیت مکانی فروشگاه</h2>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
                {isFb
                  ? 'نوع واحد، فرمت و نوع سرویس را انتخاب کنید؛ فقط شاخص‌هایی پرسیده می‌شوند که برای هر سه انتخاب در فایل اکسل ضربدر دارند.'
                  : 'موقعیت استقرار واحد را تعیین کنید تا شاخص‌های متناسب خیابانی یا درون مجتمع اعمال شوند.'}
              </p>

              {isFb ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {([
                    { kind: 'type' as const, title: '۱. نوع واحد', list: FB_TYPES, value: fbType, set: (c: string) => setFbType(c as FbType) },
                    { kind: 'format' as const, title: '۲. فرمت (محل استقرار)', list: FB_FORMATS, value: fbFormat, set: (c: string) => setFbFormat(c as LocationContextCode) },
                    { kind: 'service' as const, title: '۳. نوع سرویس', list: FB_SERVICES, value: fbService, set: (c: string) => setFbService(c as FbService) },
                  ]).map((group) => (
                    <div key={group.kind}>
                      <strong style={{ fontSize: 13, display: 'block', marginBottom: 6 }}>{group.title}</strong>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {group.list.map((opt) => (
                          <button
                            key={opt.code}
                            type="button"
                            aria-pressed={group.value === opt.code}
                            onClick={() => group.set(opt.code)}
                            style={{
                              padding: '10px 12px',
                              borderRadius: 'var(--rs-radius-control)',
                              border: `1.5px solid ${group.value === opt.code ? 'var(--rs-color-brand-cyan)' : 'var(--border-subtle)'}`,
                              background: group.value === opt.code ? 'rgba(0, 176, 240, 0.14)' : 'var(--theme-input-bg)',
                              color: 'var(--theme-text-primary)',
                              textAlign: 'right',
                              cursor: 'pointer',
                              transition: 'all 120ms ease',
                            }}
                          >
                            <strong style={{ fontSize: 13, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                              <span>{opt.label}</span>
                              <span className="ltr-num" style={{ color: 'var(--rs-color-brand-cyan)' }}>{faDigits(fbOptionCount(group.kind, opt.code))} شاخص</span>
                            </strong>
                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{opt.desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  <p style={{ fontSize: 12, color: fbComplete ? 'var(--theme-text-primary)' : 'var(--text-muted)', margin: 0 }}>
                    {fbComplete
                      ? `با این انتخاب (${describeStoreFormat('F_B', locationContext, fbType, fbService)}): ${faDigits(previewIndicators.length)} شاخص پرسیده می‌شود. فقط شاخص‌هایی که در هر سه ستون انتخاب‌شده ضربدر دارند.`
                      : 'هر سه مورد را انتخاب کنید؛ عدد کنار هر گزینه تعداد شاخص‌ها با توجه به انتخاب‌های دیگر است.'}
                  </p>
                </div>
              ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {storeFormatsFor(assessmentType === 'STORE' ? businessType : undefined).map((lc) => (
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
                    <strong style={{ fontSize: 13, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span>{lc.label}</span>
                      <span className="ltr-num" style={{ color: 'var(--rs-color-brand-cyan)' }}>{faDigits(formatCounts[lc.code] ?? 0)} شاخص</span>
                    </strong>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{lc.desc}</span>
                  </button>
                ))}
              </div>
              )}
            </div>
          )}

          {/* ================================================================ */}
          {/* STEP 6: PHYSICAL ATTRIBUTES */}
          {/* ================================================================ */}
          {step === 6 && (
            <div>
              <h2 style={{ fontSize: 17, fontWeight: 800, marginBottom: 6 }}>مرحله ۶: امکانات فیزیکی محل مورد ارزیابی</h2>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                امکانات موجود در این شعبه را تیک بزنید تا سؤالات بر اساس امکانات واقعی فیلتر شوند.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
                {[
                  { key: 'has_window_display', compat: 'hasShowcase', label: 'ویترین شیشه‌ای و مانکن رو به بیرون', desc: 'کدهای FW02-06 در صورت عدم وجود حذف می‌شوند' },
                  { key: 'has_fitting_room', compat: 'hasFittingRoom', label: 'اتاق پرو لباس', desc: 'کدهای FFR02-06 در صورت عدم وجود حذف می‌شوند' },
                  { key: 'has_mannequins', compat: 'hasMannequins', label: 'مانکن‌های نمایشی داخل فروشگاه', desc: 'کدهای FMA در صورت عدم وجود حذف می‌شوند' },
                  { key: 'has_elevator', compat: 'hasElevator', label: 'آسانسور، پله‌برقی یا پله داخلی طبقات', desc: 'شاخص‌های دسترسی بین‌طبقه‌ای' },
                  { key: 'has_parking', compat: 'hasParking', label: 'پارکینگ اختصاصی مشتریان', desc: 'شاخص‌های پارکینگ فروشگاه' },
                  { key: 'has_customer_toilet', compat: 'hasCustomerToilet', label: 'سرویس بهداشتی در دسترس مشتریان', desc: 'رفاهیات بهداشتی داخلی' },
                  { key: 'has_checkout_counter', compat: undefined, label: 'صندوق', desc: 'شاخص‌های تسویه و صف' },
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
          {step === 7 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <CheckCircle2 color="var(--rs-color-success)" size={24} />
                <h2 style={{ fontSize: 17, fontWeight: 800 }}>مرحله ۷: پیش‌نمایش فرم و تأیید نهایی</h2>
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
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>موقعیت:</span>
                  <span style={{ fontSize: 12, color: 'var(--theme-text-primary)' }}>
                    {assessmentType === 'STORE' ? describeStoreFormat(businessType, locationContext, fbType, fbService) : 'مرکز تجاری'}
                  </span>
                </div>
                {assessmentType === 'STORE' && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>شاخص‌های این قالب:</span>
                    <span style={{ fontSize: 12, color: 'var(--theme-text-primary)' }}>
                      {faDigits(previewIndicators.length)} شاخص ({profileLabel(businessType)} · {describeStoreFormat(businessType, locationContext, fbType, fbService)})
                    </span>
                  </div>
                )}
              </div>

              {/* Metrics Strip */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 14 }}>
                <div className="metric-card" style={{ padding: 8, textAlign: 'center' }}>
                  <span className="metric-value ltr-num" style={{ fontSize: 18, color: 'var(--rs-color-brand-cyan)' }}>
                    {previewIndicators.length}
                  </span>
                  <span className="metric-label" style={{ fontSize: 11 }}>کل شاخص‌ها</span>
                </div>

                <div className="metric-card" style={{ padding: 8, textAlign: 'center' }}>
                  <span className="metric-value ltr-num" style={{ fontSize: 18, color: 'var(--rs-color-success)' }}>
                    {uniqueSectionsCount}
                  </span>
                  <span className="metric-label" style={{ fontSize: 11 }}>بخش سفر</span>
                </div>

                <div className="metric-card" style={{ padding: 8, textAlign: 'center' }}>
                  <span className="metric-value ltr-num" style={{ fontSize: 18, color: 'var(--rs-color-warning)' }}>
                    {mandatoryPhotoCount}
                  </span>
                  <span className="metric-label" style={{ fontSize: 11 }}>{PHOTOS_REQUIRED ? 'عکس الزامی' : 'عکس توصیه‌شده'}</span>
                </div>

                <div className="metric-card" style={{ padding: 8, textAlign: 'center' }}>
                  <span className="metric-value ltr-num" style={{ fontSize: 18, color: 'var(--rs-color-action-primary)' }}>
                    ~{estimatedMinutes}
                  </span>
                  <span className="metric-label" style={{ fontSize: 11 }}>دقیقه تخمینی</span>
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
              onClick={() => setStep((s) => (skipFacilities && s === 7 ? 5 : Math.max(1, s - 1)))}
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

          {step < 7 ? (
            <button
              type="button"
              onClick={() => setStep((s) => (skipFacilities && s === 5 ? 7 : Math.min(7, s + 1)))}
              // Brand and branch are required: a visit without them cannot be saved.
              disabled={(step === 2 && !brandName.trim()) || (step === 3 && !branchName.trim()) || (step === 5 && isFb && !fbComplete)}
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
              disabled={!previewIndicators.length}
              title={previewIndicators.length ? undefined : 'شاخصی برای این فروشگاه در برنامه نیست؛ از «بانک شاخص‌ها» شاخص اضافه کنید.'}
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
              شروع ارزیابی
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

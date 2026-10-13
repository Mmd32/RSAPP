import React, { useState, useEffect, useMemo, useRef } from 'react';
import catalogData from './data/catalog.json';
import {
  Indicator,
  VisitSession,
  QuestionResponse,
  AnswerState,
  SeverityLevel,
  EvidencePhoto,
} from './types';
import { StartVisitWizard } from './components/StartVisitWizard';
import { LandingPage } from './components/landing/LandingPage';
import { ReviewQueue } from './components/ReviewQueue';
import { StoreService } from './services/storeService';
import { apiFetch } from './services/apiClient';
import { VisitSync, fetchPastVisits } from './services/visitService';
import { flushPendingPhotos } from './services/photoService';
import { FormOverview } from './components/FormOverview';
import { QuestionCard } from './components/QuestionCard';
import { FrictionSheet } from './components/FrictionSheet';
import { ReviewScreen } from './components/ReviewScreen';
import { ComparisonEngine } from './engine/comparisonEngine';
import { getVisitScore } from './engine/scoringEngine';
import { FilterEmptyState } from './components/FilterEmptyState';
import { UserManagement } from './components/UserManagement';
import { ChangePasswordScreen } from './components/auth/AuthScreen';
import { useAuth } from './auth/AuthContext';
import { capabilities } from './auth/roles';
import { RetailSolutionsLogo } from './components/brand/RetailSolutionsLogo';
import { AppSidebar } from './components/layout/AppSidebar';
import { MobileTabBar } from './components/layout/MobileTabBar';
import { SAMPLE_REAL_VISIT } from './data/sampleRealVisit';
import {
  CorrectiveAction,
  CorrectiveActionPriority,
  CorrectiveActionStatus,
  ActionDepartment,
  RootCauseCategory,
  UserRole,
} from './types';
import {
  Sparkles,
  Layers,
  Sliders,
  ShieldCheck,
  FileSpreadsheet,
  RotateCcw,
  WifiOff,
  AlertTriangle,
  Monitor,
  Smartphone,
  CheckCircle2,
  Trash2,
  Bookmark,
  Check,
  X,
  HelpCircle,
  TrendingUp,
  PlusCircle,
  ClipboardCheck,
  CheckCheck,
  BarChart3,
  Target,
  GitCompare,
  FlaskConical,
  Database,
  UserCheck,
  Sun,
  Moon,
  ChevronDown,
  Menu,
} from 'lucide-react';
import { stageLabel } from './utils/format';

// Code Splitting for heavy secondary views (Audit Priority 3 / P2)
const VisitReportView = React.lazy(() =>
  import('./components/VisitReportView').then((m) => ({ default: m.VisitReportView }))
);
const BusinessReportView = React.lazy(() =>
  import('./components/BusinessReportView').then((m) => ({ default: m.BusinessReportView }))
);
const CorrectiveActionsHub = React.lazy(() =>
  import('./components/CorrectiveActionsHub').then((m) => ({ default: m.CorrectiveActionsHub }))
);
const VisitArchive = React.lazy(() =>
  import('./components/VisitArchive').then((m) => ({ default: m.VisitArchive }))
);
const RevisitComparisonView = React.lazy(() =>
  import('./components/RevisitComparisonView').then((m) => ({ default: m.RevisitComparisonView }))
);
const SupervisorReview = React.lazy(() =>
  import('./components/SupervisorReview').then((m) => ({ default: m.SupervisorReview }))
);
const AdminQuestionBank = React.lazy(() =>
  import('./components/AdminQuestionBank').then((m) => ({ default: m.AdminQuestionBank }))
);
const ScenarioRunner = React.lazy(() =>
  import('./components/ScenarioRunner').then((m) => ({ default: m.ScenarioRunner }))
);

const ViewLoadingFallback: React.FC = () => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 340,
      gap: 14,
    }}
  >
    <div
      style={{
        width: 36,
        height: 36,
        border: '3px solid var(--theme-card-border)',
        borderTopColor: 'var(--rs-color-brand-cyan)',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }}
    />
    <span style={{ fontSize: 13, color: 'var(--theme-text-muted)', fontWeight: 600 }}>
      در حال بارگذاری اطلاعات بخش...
    </span>
  </div>
);

type ViewMode =
  | 'LANDING'
  | 'WIZARD'
  | 'AUDIT'
  | 'REVIEW'
  | 'SUPERVISOR'
  | 'REPORT'
  | 'BUSINESS'
  | 'CATALOG'
  | 'SCENARIOS'
  | 'ACTIONS'
  | 'REVISIT'
  | 'ARCHIVE'
  | 'USERS'
  | 'PASSWORD';

const LOCAL_STORAGE_KEY = 'rsapp_active_visit_v1';

// Seed actions for initial demonstration
const INITIAL_DEMO_ACTIONS: CorrectiveAction[] = [
  {
    id: 'act_demo_01',
    tenantId: 'org_retail_holding',
    findingId: 'finding_01',
    indicatorCode: 'FS02',
    visitId: 'visit_baseline_demo',
    branchId: 'شعبه ونک',
    branchName: 'شعبه ونک',
    brandName: 'ZARA',
    title: 'تعمیر و تنظیم روشنایی موضعی تابلوی اصلی فروشگاه',
    description: 'نیمی از حروف نئونی تابلوی بیرونی در تاریکی شب خاموش بوده و دید مستقیم از معبر را مختل می‌کند.',
    priority: 'HIGH',
    status: 'IN_PROGRESS',
    owner: 'مهندس رضایی',
    department: 'Maintenance',
    dueDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // Overdue
    rootCause: 'FACILITY',
    beforePhotos: [
      {
        id: 'p_before_01',
        url: 'https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?auto=format&fit=crop&w=400&q=80',
        timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ],
    afterPhotos: [],
    reopenCount: 0,
    reopenComments: [],
    createdBy: 'علی کاظمی (ارزیاب)',
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'act_demo_02',
    tenantId: 'org_retail_holding',
    findingId: 'finding_02',
    indicatorCode: 'FFR04',
    visitId: 'visit_baseline_demo',
    branchId: 'شعبه ونک',
    branchName: 'شعبه ونک',
    brandName: 'ZARA',
    title: 'تجهیز اتاق‌های پرو به آینه قدی ضد موج و قلاب آویز استاندارد',
    description: 'در ۳ اتاق پرو انتهای سالن، آینه‌ها دچار اعوجاج بوده و قلاب نگهداری لباس‌ها شکسته است.',
    priority: 'CRITICAL',
    status: 'WAITING_REVIEW',
    owner: 'مریم اکبری',
    department: 'Operations',
    dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    rootCause: 'EQUIPMENT',
    beforePhotos: [
      {
        id: 'p_before_02',
        url: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=400&q=80',
        timestamp: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ],
    afterPhotos: [
      {
        id: 'p_after_02',
        url: 'https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?auto=format&fit=crop&w=400&q=80',
        timestamp: new Date().toISOString(),
      },
    ],
    resolutionNote: 'آینه‌های جدید کریستال سوپرکلیر نصب و قلاب‌های دوتایی استیل در تمامی اتاق‌های پرو تعویض گردید.',
    completionDate: new Date().toISOString(),
    reopenCount: 0,
    reopenComments: [],
    createdBy: 'سارا امینی (سرپرست)',
    createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'act_demo_03',
    tenantId: 'org_retail_holding',
    findingId: 'finding_03',
    indicatorCode: 'FCP08',
    visitId: 'visit_baseline_demo',
    branchId: 'شعبه کوروش',
    branchName: 'شعبه کوروش',
    brandName: 'مانگو',
    title: 'کالیبراسیون و تست سرعت دستگاه جداکننده تگ دزدگیر صندوق',
    description: 'دستگاه مگنتیک تگ‌بازکن صندوق شماره ۲ کند بوده و منجر به تشکیل صف تسویه و نارضایتی شده است.',
    priority: 'MEDIUM',
    status: 'VERIFIED',
    owner: 'حسین پناهی',
    department: 'IT',
    dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    rootCause: 'TECHNOLOGY',
    beforePhotos: [],
    afterPhotos: [],
    resolutionNote: 'دستگاه با مگنت قوی‌تر تعویض و تست سرعت خروج کالا با موفقیت انجام شد.',
    completionDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    verifiedBy: 'سارا امینی',
    verifiedAt: new Date().toISOString(),
    verificationNote: 'تست میدانی انجام شد و صف تسویه به حالت روان بازگشت.',
    reopenCount: 0,
    reopenComments: [],
    createdBy: 'مهندس رضوانی',
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export const App: React.FC = () => {
  const { user, logout, signedIn } = useAuth();
  // AuthGate only renders App for a signed-in user.
  const currentUser = user!;
  const can = capabilities(currentUser);
  // One draft per account, so a shared tablet never resumes someone else's visit.
  const activeVisitKey = `${LOCAL_STORAGE_KEY}:${currentUser.id}`;
  const allIndicators: Indicator[] = catalogData.indicators as any;

  const [activeSession, setActiveSession] = useState<VisitSession | null>(null);

  // Deep Linking & URL Routing via window.location.hash (Audit Priority 9 / N2)
  const getInitialViewMode = (): ViewMode => {
    if (typeof window !== 'undefined' && window.location.hash) {
      const hash = window.location.hash.replace('#', '').toUpperCase();
      const validModes: ViewMode[] = [
        'LANDING',
        'WIZARD',
        'AUDIT',
        'REVIEW',
        'SUPERVISOR',
        'REPORT',
        'BUSINESS',
        'CATALOG',
        'SCENARIOS',
        'ACTIONS',
        'REVISIT',
        'ARCHIVE',
        'USERS',
        'PASSWORD',
      ];
      if (validModes.includes(hash as ViewMode)) {
        return hash as ViewMode;
      }
    }
    return 'LANDING';
  };

  const [savedStoresCount, setSavedStoresCount] = useState<number>(() => {
    return StoreService.getLocalStores().length;
  });
  // The cached count can be stale; refresh it from the server once on load.
  useEffect(() => {
    StoreService.getAllStores().then((stores) => setSavedStoresCount(stores.length)).catch(() => {});
  }, []);

  const [viewMode, setViewModeState] = useState<ViewMode>(getInitialViewMode);

  // Keep people out of screens their role cannot use (the server refuses the
  // underlying writes anyway; this avoids offering them).
  const viewAllowed = (mode: ViewMode): boolean => {
    if (mode === 'WIZARD' || mode === 'AUDIT' || mode === 'REVIEW') return can.fieldWork;
    if (mode === 'SUPERVISOR') return can.review;
    if (mode === 'CATALOG') return can.adminTools;
    // Engineering tool: not in the menu, reachable by administrators at #scenarios.
    if (mode === 'SCENARIOS') return can.manageUsers;
    if (mode === 'USERS') return can.manageUsers;
    // Field evaluators only record: the archive lists their own questionnaires,
    // reports and comparisons are for people with report access.
    if (mode === 'ARCHIVE') return can.reports || can.fieldWork;
    if (mode === 'REPORT' || mode === 'REVISIT' || mode === 'BUSINESS') return can.reports;
    if (mode === 'ACTIONS') return can.actions;
    return true;
  };
  useEffect(() => {
    if (!viewAllowed(viewMode)) setViewModeState('LANDING');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, currentUser.role]);
  const [toolsDropdownOpen, setToolsDropdownOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);

  const setViewMode = (mode: ViewMode) => {
    setViewModeState(mode);
    setToolsDropdownOpen(false);
    if (typeof window !== 'undefined') {
      window.location.hash = mode.toLowerCase();
    }
  };

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '').toUpperCase();
      const validModes: ViewMode[] = [
        'WIZARD',
        'AUDIT',
        'REVIEW',
        'SUPERVISOR',
        'REPORT',
        'BUSINESS',
        'CATALOG',
        'SCENARIOS',
        'ACTIONS',
        'REVISIT',
        'ARCHIVE',
        'USERS',
      ];
      if (validModes.includes(hash as ViewMode)) {
        setViewModeState(hash as ViewMode);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Executive Light/Dark Theme Mode (defaults to Light Mode as requested by user)
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('rsapp_theme_mode');
      if (saved === 'light' || saved === 'dark') return saved;
    }
    return 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', themeMode);
    localStorage.setItem('rsapp_theme_mode', themeMode);
  }, [themeMode]);

  const toggleTheme = () => {
    setThemeMode((prev) => (prev === 'light' ? 'dark' : 'light'));
  };
  const currentUserRole = currentUser.role as UserRole;
  const currentUserName = currentUser.name;
  const currentTenantId = currentUser.tenantId;

  // Corrective Actions State
  const [actions, setActions] = useState<CorrectiveAction[]>(INITIAL_DEMO_ACTIONS);

  // Past Visits for Comparison & Historical tracking
  const [pastVisits, setPastVisits] = useState<VisitSession[]>([]);
  const [isLoadingVisits, setIsLoadingVisits] = useState(false);
  const [visitsLoadError, setVisitsLoadError] = useState<string | null>(null);

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [currentStage, setCurrentStage] = useState<string>('APPROACH');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [auditFilter, setAuditFilter] = useState<'ALL' | 'MISSING' | 'FRICTION' | 'FLAGGED'>('ALL');
  const [quickMode, setQuickMode] = useState<boolean>(true);
  const [isFrictionSheetOpen, setIsFrictionSheetOpen] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [isDesktopSplitView, setIsDesktopSplitView] = useState<boolean>(
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : false
  );

  // Resume Visit Prompt Modal state
  const [resumeCandidate, setResumeCandidate] = useState<VisitSession | null>(null);

  // Prevent Data Loss Confirm Modal
  const [showDiscardModal, setShowDiscardModal] = useState<boolean>(false);

  // Undo Snackbar state (Section 14)
  const [undoState, setUndoState] = useState<{
    indicatorId: string;
    previousIndex: number;
    previousResponse: QuestionResponse;
  } | null>(null);

  const undoTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Listen for online / offline events (Section 20)
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => {
      setIsOnline(false);
      if (activeSession) {
        setActiveSession((prev) => {
          if (!prev) return prev;
          const count = (prev.analytics?.offlineEventsCount || 0) + 1;
          return {
            ...prev,
            analytics: {
              ...(prev.analytics || {
                startTime: prev.startedAt,
                resumeCount: 0,
                offlineEventsCount: 0,
                numberOfChanges: 0,
              }),
              offlineEventsCount: count,
            },
          };
        });
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [activeSession]);

  // Check for saved visit on initial mount (Section 21: Resume)
  useEffect(() => {
    try {
      // Drafts from before accounts existed were stored under a shared key;
      // hand one over to the first account that signs in on this device.
      const legacy = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (legacy && !localStorage.getItem(activeVisitKey)) {
        localStorage.setItem(activeVisitKey, legacy);
      }
      localStorage.removeItem(LOCAL_STORAGE_KEY);

      const saved = localStorage.getItem(activeVisitKey);
      if (saved) {
        const parsed: VisitSession = JSON.parse(saved);
        if (parsed && parsed.indicators && parsed.indicators.length > 0) {
          setResumeCandidate(parsed);
        }
      }
    } catch (e) {
      console.error('Failed to load session from localStorage', e);
    }
  }, []);

  const [actionsNotice, setActionsNotice] = useState<string | null>(null);

  const reloadActions = () =>
    apiFetch('/actions')
      .then((res) => (res.ok ? res.json() : null))
      .then((serverActions: CorrectiveAction[] | null) => {
        if (Array.isArray(serverActions)) setActions(serverActions);
      })
      .catch(() => undefined);

  /**
   * Sends a corrective-action change. Changes are applied optimistically; if
   * the server refuses one (e.g. the role may not do it), the list is reloaded
   * from the server and the reason shown, instead of keeping a local change
   * that was never saved. Network failures keep the optimistic state.
   */
  const syncAction = (path: string, init: RequestInit) => {
    apiFetch(path, init)
      .then(async (res) => {
        if (res.ok || res.status === 401) return;
        const body = await res.json().catch(() => ({}));
        setActionsNotice(body?.error || 'تغییر در سرور ذخیره نشد.');
        reloadActions();
      })
      .catch((err) => console.warn(`Action sync deferred (offline): ${path}`, err));
  };

  // Hydrate corrective actions from the backend on mount. The server is the
  // source of truth, even when it has none yet: demo actions stay only when
  // the API is unreachable, so they never mix with real ones.
  useEffect(() => {
    let cancelled = false;
    // People without access to corrective actions would only get a refusal.
    if (!can.actions) return;

    apiFetch('/actions')
      .then((res) => (res.ok ? res.json() : null))
      .then((serverActions: CorrectiveAction[] | null) => {
        if (cancelled || !Array.isArray(serverActions)) return;
        setActions(serverActions);
      })
      .catch((err) => {
        console.warn('Corrective actions could not be loaded from the backend; using local data.', err);
      });

    return () => {
      cancelled = true;
    };
    // Re-fetch when the active tenant or the person's access changes.
  }, [currentTenantId, can.actions]);

  // Load previously saved questionnaires so finished visits are reachable
  // again. Without this they were written to the backend but never read back.
  const loadPastVisits = React.useCallback(() => {
    setIsLoadingVisits(true);
    setVisitsLoadError(null);

    return fetchPastVisits(currentTenantId)
      .then((visits) => {
        setPastVisits(visits);
      })
      .catch((err) => {
        console.warn('Could not load saved visits from the backend.', err);
        setVisitsLoadError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => setIsLoadingVisits(false));
  }, [currentTenantId]);

  useEffect(() => {
    loadPastVisits();
  }, [loadPastVisits]);

  // A field audit often ends by locking the phone or closing the tab, which is
  // exactly when a debounced write would be lost. Flush on the way out.
  useEffect(() => {
    const handleHide = () => {
      if (document.visibilityState === 'hidden') {
        VisitSync.flushOnUnload(currentTenantId);
      }
    };
    const handlePageHide = () => VisitSync.flushOnUnload(currentTenantId);

    document.addEventListener('visibilitychange', handleHide);
    window.addEventListener('pagehide', handlePageHide);
    return () => {
      document.removeEventListener('visibilitychange', handleHide);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [currentTenantId]);

  // Retry deferred work as soon as connectivity returns: the questionnaire
  // first, then any evidence photos taken while the store had no signal.
  useEffect(() => {
    const handleBackOnline = () => {
      if (VisitSync.hasPendingWork()) {
        VisitSync.flush(currentTenantId);
      }
      flushPendingPhotos(currentTenantId).catch((err) =>
        console.warn('Queued photos could not be uploaded yet.', err)
      );
    };
    window.addEventListener('online', handleBackOnline);
    return () => window.removeEventListener('online', handleBackOnline);
  }, [currentTenantId]);

  // Also try once on load, for photos left queued by an earlier session, and
  // for answers whose sync was refused because the session had expired (the
  // app remounts after signing back in).
  useEffect(() => {
    flushPendingPhotos(currentTenantId).catch(() => undefined);
    VisitSync.flush(currentTenantId).catch(() => undefined);
  }, [currentTenantId]);

  // Autosave to localStorage and background API sync (Dual Persistence for field durability)
  const saveVisitState = (session: VisitSession) => {
    setIsSaving(true);
    const updatedAnalytics = {
      ...(session.analytics || {
        startTime: session.startedAt,
        resumeCount: 0,
        offlineEventsCount: 0,
        numberOfChanges: 0,
      }),
      lastActivityAt: new Date().toISOString(),
      numberOfChanges: (session.analytics?.numberOfChanges || 0) + 1,
    };

    const sessionWithAnalytics = {
      ...session,
      analytics: updatedAnalytics,
    };

    setActiveSession({ ...sessionWithAnalytics });
    
    // 1. Guaranteed Local Persistence (Zero data loss even without network)
    try {
      localStorage.setItem(activeVisitKey, JSON.stringify(sessionWithAnalytics));
    } catch (e) {
      console.error('Storage error', e);
    }

    // 2. Dual Background API Sync (Persist to backend data/visits.json & auto-upsert store directory)
    // Coalesced background sync. A session carries its whole indicator set, so
    // posting on every answer would push hundreds of megabytes over one audit.
    VisitSync.queue(sessionWithAnalytics, currentTenantId);

    setTimeout(() => {
      setIsSaving(false);
    }, 300);
  };

  const handleStartVisit = (newSession: VisitSession) => {
    setActiveSession(newSession);
    setCurrentQuestionIndex(0);
    if (newSession.indicators.length > 0) {
      setCurrentStage(newSession.indicators[0].journeyStage);
    }
    saveVisitState(newSession);
    setViewMode('AUDIT');
  };

  const handleAcceptResume = () => {
    if (!resumeCandidate) return;
    const resumedSession: VisitSession = {
      ...resumeCandidate,
      analytics: {
        ...(resumeCandidate.analytics || {
          startTime: resumeCandidate.startedAt,
          resumeCount: 0,
          offlineEventsCount: 0,
          numberOfChanges: 0,
        }),
        resumeCount: (resumeCandidate.analytics?.resumeCount || 0) + 1,
        lastActivityAt: new Date().toISOString(),
      },
    };
    setActiveSession(resumedSession);
    setResumeCandidate(null);
    if (resumedSession.indicators.length > 0) {
      setCurrentStage(resumedSession.indicators[0].journeyStage);
    }
    setViewMode('AUDIT');
  };

  const handleDiscardResume = () => {
    localStorage.removeItem(activeVisitKey);
    setResumeCandidate(null);
    setActiveSession(null);
    setViewMode('WIZARD');
  };

  // Filtered indicators based on search query AND quick filter (Section 16: Navigation)
  const displayedIndicators = useMemo(() => {
    if (!activeSession) return [];
    let list = activeSession.indicators;

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((ind) => {
        return (
          ind.code.toLowerCase().includes(q) ||
          ind.subject.toLowerCase().includes(q) ||
          ind.statement.toLowerCase().includes(q)
        );
      });
    }

    // Quick filter (All, Missing, Friction, Flagged)
    if (auditFilter === 'MISSING') {
      list = list.filter((ind) => {
        const r = activeSession.responses[ind.id];
        return !r || r.answerState === 'UNANSWERED';
      });
    } else if (auditFilter === 'FRICTION') {
      list = list.filter((ind) => {
        const r = activeSession.responses[ind.id];
        return r && r.answerState === 'FRICTION';
      });
    } else if (auditFilter === 'FLAGGED') {
      list = list.filter((ind) => {
        const r = activeSession.responses[ind.id];
        return r && r.isFlagged;
      });
    }

    return list;
  }, [activeSession, searchQuery, auditFilter]);

  // The report shows the visit being worked on, else the latest finished one.
  // The built-in sample appears only when there is no real visit at all.
  const latestFinishedVisit = useMemo(
    () =>
      [...pastVisits]
        .filter((v) => (v.status === 'SUBMITTED' || v.status === 'APPROVED') && v.indicators?.length)
        .sort((a, b) => (b.completedAt || b.startedAt).localeCompare(a.completedAt || a.startedAt))[0] || null,
    [pastVisits]
  );
  const reportVisit: VisitSession = activeSession || latestFinishedVisit || SAMPLE_REAL_VISIT;

  const currentIndicator = displayedIndicators[currentQuestionIndex] || displayedIndicators[0] || activeSession?.indicators[0];

  // Update current stage chip when moving through questions
  useEffect(() => {
    if (currentIndicator) {
      setCurrentStage(currentIndicator.journeyStage);
    }
  }, [currentIndicator]);

  // Answer handler with Quick Mode & Undo (Section 13, 14)
  const handleAnswerState = (state: AnswerState) => {
    if (!activeSession || !currentIndicator) return;

    const existing = activeSession.responses[currentIndicator.id] || {
      indicatorId: currentIndicator.id,
      answerState: 'UNANSWERED',
      photos: [],
      isFlagged: false,
    };

    const updatedResponse: QuestionResponse = {
      ...existing,
      answerState: state,
      // Frictions are recorded as yes/no; no severity is kept.
      severity: undefined,
      answeredAt: new Date().toISOString(),
    };

    const updatedSession = {
      ...activeSession,
      responses: {
        ...activeSession.responses,
        [currentIndicator.id]: updatedResponse,
      },
    };

    saveVisitState(updatedSession);

    // Section 13 & 14: Quick Mode auto advance on No Friction + Undo Snackbar
    if (state === 'NO_FRICTION' && quickMode) {
      if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);

      setUndoState({
        indicatorId: currentIndicator.id,
        previousIndex: currentQuestionIndex,
        previousResponse: existing,
      });

      // Advance with short delay
      setTimeout(() => {
        // Under the "unanswered" filter the answered question drops out of the
        // list, so the next one slides into the current index by itself.
        if (auditFilter === 'MISSING') return;
        if (currentQuestionIndex < displayedIndicators.length - 1) {
          setCurrentQuestionIndex((prev) => prev + 1);
        }
      }, 350);

      // Auto dismiss undo after 4 seconds
      undoTimeoutRef.current = setTimeout(() => {
        setUndoState(null);
      }, 4000);
    }
  };

  // Section 14: Undo Action
  const handleUndoAutoAdvance = () => {
    if (!undoState || !activeSession) return;
    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);

    const revertedSession = {
      ...activeSession,
      responses: {
        ...activeSession.responses,
        [undoState.indicatorId]: undoState.previousResponse,
      },
    };

    saveVisitState(revertedSession);
    setCurrentQuestionIndex(undoState.previousIndex);
    setUndoState(null);
  };

  const handleSaveFriction = (data: {
    comment: string;
    recommendation: string;
    photos: EvidencePhoto[];
  }) => {
    if (!activeSession || !currentIndicator) return;

    const existing = activeSession.responses[currentIndicator.id] || {
      indicatorId: currentIndicator.id,
      answerState: 'FRICTION',
      photos: [],
      isFlagged: false,
    };

    const updatedResponse: QuestionResponse = {
      ...existing,
      answerState: 'FRICTION',
      // Frictions are yes/no now; drop any severity from an older answer.
      severity: undefined,
      comment: data.comment,
      recommendation: data.recommendation,
      photos: data.photos,
      answeredAt: new Date().toISOString(),
    };

    const updatedSession = {
      ...activeSession,
      responses: {
        ...activeSession.responses,
        [currentIndicator.id]: updatedResponse,
      },
    };

    saveVisitState(updatedSession);
  };

  const handleToggleFlag = () => {
    if (!activeSession || !currentIndicator) return;

    const existing = activeSession.responses[currentIndicator.id] || {
      indicatorId: currentIndicator.id,
      answerState: 'UNANSWERED',
      photos: [],
      isFlagged: false,
    };

    const updatedResponse: QuestionResponse = {
      ...existing,
      isFlagged: !existing.isFlagged,
    };

    const updatedSession = {
      ...activeSession,
      responses: {
        ...activeSession.responses,
        [currentIndicator.id]: updatedResponse,
      },
    };

    saveVisitState(updatedSession);
  };

  const handleSelectStage = (stageKey: string) => {
    if (!activeSession) return;
    setCurrentStage(stageKey);
    const firstIdx = displayedIndicators.findIndex((i) => i.journeyStage === stageKey);
    if (firstIdx !== -1) {
      setCurrentQuestionIndex(firstIdx);
    }
  };

  const handleJumpToQuestion = (index: number) => {
    setCurrentQuestionIndex(index);
    setViewMode('AUDIT');
  };

  /**
   * Reopens a saved questionnaire. An in-progress visit becomes the active
   * session again; a submitted or approved one opens read-only, which the
   * existing `isVisitReadOnly` check already enforces downstream.
   */
  const handleOpenArchivedVisit = (visit: VisitSession) => {
    // Make sure any queued write for the current session lands first, so
    // switching away from a half-finished audit cannot drop answers.
    VisitSync.flush(currentTenantId);

    setActiveSession(visit);
    setCurrentQuestionIndex(0);
    if (visit.indicators?.length > 0) {
      setCurrentStage(visit.indicators[0].journeyStage);
    }
    try {
      localStorage.setItem(activeVisitKey, JSON.stringify(visit));
    } catch (e) {
      console.error('Storage error', e);
    }
    setResumeCandidate(null);
    if (visit.status === 'SUBMITTED' && can.review) setViewMode('SUPERVISOR');
    else if ((visit.status === 'IN_PROGRESS' || visit.status === 'REVISION_REQUESTED') && can.fieldWork) setViewMode('AUDIT');
    else setViewMode(can.reports ? 'REPORT' : 'ARCHIVE');
  };

  const handleSubmitVisit = () => {
    if (!activeSession) return;
    const updated: VisitSession = {
      ...activeSession,
      status: 'SUBMITTED',
      completedAt: new Date().toISOString(),
      overallScore: getVisitScore(activeSession),
    };
    saveVisitState(updated);
    // Submitting is a milestone: push it now rather than waiting for the debounce.
    VisitSync.flush(currentTenantId).then(loadPastVisits);
    // Evaluators only record: after sending, they go back to their list.
    setViewMode(can.review ? 'SUPERVISOR' : 'ARCHIVE');
  };

  const handleApproveVisit = (
    notes: string,
    decisions: Record<string, { status: 'APPROVED' | 'REJECTED' | 'REQUEST_CHANGE'; comment?: string }>
  ) => {
    if (!activeSession) return;
    const updated: VisitSession = {
      ...activeSession,
      status: 'APPROVED',
      supervisorName: currentUserName,
      supervisorNotes: notes,
      findingDecisions: decisions,
      overallScore: getVisitScore(activeSession),
    };
    saveVisitState(updated);
    VisitSync.flush(currentTenantId).then(loadPastVisits);
    setViewMode('REPORT');
  };

  const handleRequestRevision = (
    notes: string,
    decisions: Record<string, { status: 'APPROVED' | 'REJECTED' | 'REQUEST_CHANGE'; comment?: string }>
  ) => {
    if (!activeSession) return;
    const updated: VisitSession = {
      ...activeSession,
      status: 'REVISION_REQUESTED',
      supervisorNotes: notes,
      findingDecisions: decisions,
    };
    saveVisitState(updated);
    VisitSync.flush(currentTenantId).then(loadPastVisits);
    setViewMode('AUDIT');
  };

  const handleConfirmDiscardSession = () => {
    localStorage.removeItem(activeVisitKey);
    setActiveSession(null);
    setShowDiscardModal(false);
    setViewMode('WIZARD');
  };

  // Action Analytics & Handlers (Prompt 4)
  const actionAnalytics = useMemo(() => {
    return ComparisonEngine.computeActionAnalytics(actions);
  }, [actions]);

  const handleCreateCorrectiveAction = (actionData: Partial<CorrectiveAction>) => {
    const newAction: CorrectiveAction = {
      id: `act_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      tenantId: currentTenantId,
      findingId: actionData.findingId || `finding_${Date.now()}`,
      indicatorCode: actionData.indicatorCode || 'GEN01',
      visitId: actionData.visitId || activeSession?.id || 'manual',
      branchId: actionData.branchId || actionData.branchName || 'شعبه',
      branchName: actionData.branchName || activeSession?.branchName || 'شعبه ونک',
      brandName: actionData.brandName || activeSession?.brandName || 'ZARA',
      title: actionData.title || 'اقدام اصلاحی جدید',
      description: actionData.description || '',
      priority: actionData.priority || 'MEDIUM',
      status: actionData.owner ? 'ASSIGNED' : 'OPEN',
      owner: actionData.owner,
      department: actionData.department || 'Operations',
      dueDate: actionData.dueDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      rootCause: actionData.rootCause,
      beforePhotos: actionData.beforePhotos || [],
      afterPhotos: actionData.afterPhotos || [],
      reopenCount: 0,
      reopenComments: [],
      createdBy: currentUserName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setActions((prev) => [newAction, ...prev]);

    syncAction('/actions', {
      method: 'POST',
      body: JSON.stringify(newAction),
    });

    setViewMode('ACTIONS');
  };

  const handleUpdateCorrectiveAction = (id: string, updates: Partial<CorrectiveAction>) => {
    setActions((prev) =>
      prev.map((a) =>
        a.id === id
          ? {
              ...a,
              ...updates,
              // Mirrors the server: assigning an owner moves a new action to ASSIGNED.
              ...(updates.owner && a.status === 'OPEN' ? { status: 'ASSIGNED' as const } : {}),
              updatedAt: new Date().toISOString(),
            }
          : a
      )
    );

    syncAction(`/actions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  };

  const handleResolveCorrectiveAction = (
    id: string,
    resolutionNote: string,
    afterPhotos: EvidencePhoto[],
    rootCause?: RootCauseCategory
  ) => {
    setActions((prev) =>
      prev.map((a) => {
        if (a.id !== id) return a;
        return {
          ...a,
          status: 'WAITING_REVIEW',
          resolutionNote,
          completionDate: new Date().toISOString(),
          afterPhotos: [...a.afterPhotos, ...afterPhotos],
          rootCause: rootCause || a.rootCause,
          updatedAt: new Date().toISOString(),
        };
      })
    );

    syncAction(`/actions/${id}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ resolutionNote, afterPhotos, rootCause }),
    });
  };

  const handleVerifyCorrectiveAction = (id: string, verificationNote?: string) => {
    setActions((prev) =>
      prev.map((a) => {
        if (a.id !== id) return a;
        return {
          ...a,
          status: 'VERIFIED',
          verifiedBy: currentUserName,
          verifiedAt: new Date().toISOString(),
          verificationNote: verificationNote || 'تایید شد',
          updatedAt: new Date().toISOString(),
        };
      })
    );

    syncAction(`/actions/${id}/verify`, {
      method: 'POST',
      body: JSON.stringify({ verificationNote }),
    });
  };

  const handleReopenCorrectiveAction = (id: string, comment: string) => {
    setActions((prev) =>
      prev.map((a) => {
        if (a.id !== id) return a;
        return {
          ...a,
          status: 'REOPENED',
          reopenCount: (a.reopenCount || 0) + 1,
          reopenComments: [
            ...(a.reopenComments || []),
            {
              id: `rc_${Date.now()}`,
              comment,
              reopenedBy: currentUserName,
              timestamp: new Date().toISOString(),
            },
          ],
          updatedAt: new Date().toISOString(),
        };
      })
    );

    syncAction(`/actions/${id}/reopen`, {
      method: 'POST',
      body: JSON.stringify({ comment }),
    });
  };

  const isVisitReadOnly = activeSession?.status === 'SUBMITTED' || activeSession?.status === 'APPROVED';

  return (
    <div className="app-shell">
      {/* 1. Modern Collapsible Sidebar (Linear × Apple Style) */}
      <AppSidebar
        viewMode={viewMode}
        onSelectViewMode={setViewMode}
        activeSession={activeSession}
        actionsCount={actions.length}
        themeMode={themeMode}
        onToggleTheme={toggleTheme}
        currentUserRole={currentUserRole}
        currentUserName={currentUserName}
        reportIsSample={!activeSession && !latestFinishedVisit}
        can={can}
        onLogout={logout}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* 2. Main Content Canvas */}
      <div className="app-main-layout">
        {/* Semantic H1 for WCAG 2.1 Heading Hierarchy */}
        <h1 className="visually-hidden">سامانه ارزیابی اصطکاک و پاداش ریتیل سلوشنز</h1>

        {/* Minimal High-End Top Navbar */}
        <header className="app-top-navbar">
          <div className="top-nav-title-wrap">
            <button
              type="button"
              className="mobile-menu-btn"
              onClick={() => setIsMobileSidebarOpen(true)}
              aria-label="باز کردن منو"
            >
              <Menu size={18} />
            </button>
            <div className="mobile-only" style={{ display: 'none' }}>
              <RetailSolutionsLogo
                variant="badge"
                size="xs"
                colorScheme={themeMode}
              />
            </div>
            <h2 className="top-nav-page-title">
              {viewMode === 'LANDING' && 'صفحه اصلی'}
              {viewMode === 'WIZARD' && 'ارزیابی جدید'}
              {viewMode === 'AUDIT' &&
                (activeSession
                  ? `${activeSession.brandName} • ${activeSession.branchName}`
                  : 'فرم ارزیابی میدانی')}
              {viewMode === 'REVIEW' && 'کنترل کیفیت و مرور پاسخ‌ها'}
              {viewMode === 'SUPERVISOR' && 'کارتابل سرپرست ارزیابی'}
              {viewMode === 'REPORT' && 'گزارش تحلیلی و رادار ۳۶۰°'}
              {viewMode === 'BUSINESS' && 'گزارش کل کسب‌وکار'}
              {viewMode === 'REVISIT' && 'تحلیل مقایسه‌ای و پایش بهبود'}
              {viewMode === 'ACTIONS' && 'کارتابل پیگیری اقدامات اصلاحی'}
              {viewMode === 'CATALOG' && 'بانک جامع شاخص‌های استاندارد'}
              {viewMode === 'SCENARIOS' && 'محیط تست و اجرای سناریوها'}
              {viewMode === 'USERS' && 'کاربران و دسترسی‌ها'}
              {viewMode === 'PASSWORD' && 'تغییر رمز عبور'}
              {viewMode === 'ARCHIVE' && 'بایگانی پرسشنامه‌ها'}
            </h2>
            {viewMode === 'AUDIT' && activeSession && (
              <span
                style={{
                  fontSize: 12,
                  background: 'rgba(0,176,240,0.12)',
                  color: 'var(--rs-color-brand-cyan)',
                  padding: '2px 8px',
                  borderRadius: 12,
                  fontWeight: 700,
                }}
              >
                {activeSession.assessmentType === 'STORE'
                  ? 'فروشگاهی'
                  : 'مجتمع تجاری'}
              </span>
            )}
          </div>

          {/* Top Navbar Action Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {viewMode === 'AUDIT' && (
              <button
                type="button"
                onClick={() => setIsDesktopSplitView(!isDesktopSplitView)}
                className="btn-secondary desktop-only"
                style={{ padding: '6px 12px', fontSize: 12, minHeight: 34 }}
                title="تغییر نحوه نمایش دسکتاپ"
                aria-label="تغییر نحوه نمایش دسکتاپ و موبایل"
              >
                {isDesktopSplitView ? <Smartphone size={14} /> : <Monitor size={14} />}
                <span>
                  {isDesktopSplitView
                    ? 'نمای تک‌ستونه'
                    : 'نمای سه‌ستونه'}
                </span>
              </button>
            )}

            {/* Discarding is only offered where the visit is being worked on,
                and only while it can still be edited. */}
            {activeSession &&
              (viewMode === 'AUDIT' || viewMode === 'REVIEW') &&
              (activeSession.status === 'IN_PROGRESS' || activeSession.status === 'REVISION_REQUESTED') && (
              <button
                type="button"
                onClick={() => setShowDiscardModal(true)}
                className="topbar-discard"
                title="انصراف از بازدید و پاکسازی داده‌ها"
                aria-label="انصراف از بازدید و پاکسازی داده‌ها"
              >
                <Trash2 size={14} />
                <span className="topbar-discard__label">حذف بازدید</span>
              </button>
            )}
          </div>
        </header>

      {/* Section 20: Offline Warning Banner */}
      {!isOnline && (
        <div className="offline-banner">
          <WifiOff size={16} />
          <span>اتصال اینترنت قطع است؛ اطلاعات به‌صورت امن روی دستگاه ذخیره می‌شود.</span>
        </div>
      )}

      {/* Section 28: Supervisor Return Notice */}
      {viewMode === 'AUDIT' && activeSession?.status === 'REVISION_REQUESTED' && (
        <div style={{ background: 'rgba(242, 181, 68, 0.15)', borderBottom: '1px solid var(--rs-color-warning)', color: 'var(--rs-color-warning)', padding: '10px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <AlertTriangle size={18} color="var(--rs-color-warning)" />
            <span>
              <strong>بازگردانده شده توسط سرپرست: </strong>
              {activeSession.supervisorNotes || 'برخی اصطکاک‌ها نیازمند بازبینی یا تکمیل شواهد هستند.'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setViewMode('REVIEW')}
            className="btn-secondary"
            style={{ padding: '4px 10px', fontSize: 11, minHeight: 28, borderColor: 'var(--rs-color-warning)', color: 'var(--rs-color-warning)' }}
          >
            مشاهده مغایرت‌ها
          </button>
        </div>
      )}

      {/* Section 25: Read-Only Warning Notice if Submitted/Approved */}
      {viewMode === 'AUDIT' && isVisitReadOnly && (
        <div style={{ background: 'rgba(0, 176, 240, 0.12)', borderBottom: '1px solid var(--rs-color-brand-cyan)', color: 'var(--rs-color-brand-cyan)', padding: '8px 18px', textAlign: 'center', fontSize: 12, fontWeight: 600 }}>
          این ارزیابی به سرپرست ارسال شده و در حالت فقط‌خواندنی (Read-Only) قرار دارد.
        </div>
      )}

      {/* Main View Router */}
      <main>
        {/* Section 21: Resume Visit Prompt Modal */}
        {resumeCandidate && !activeSession && (
          <div className="friction-sheet-backdrop" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div className="glass-panel" style={{ maxWidth: 460, width: '100%', padding: 24 }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(0, 176, 240, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <RotateCcw size={26} color="var(--rs-color-brand-cyan)" />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 700, textAlign: 'center', marginBottom: 6, color: 'var(--theme-text-primary)' }}>
                بازگشت به ارزیابی ذخیره‌شده
              </h3>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', marginBottom: 20 }}>
                یک پیش‌نویس ارزیابی فعال در حافظه دستگاه یافت شد:
              </p>

              <div style={{ background: 'var(--bg-input)', padding: 14, borderRadius: 'var(--rs-radius-card)', marginBottom: 20, border: '1px solid var(--border-subtle)', fontSize: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ color: 'var(--text-muted)' }}>محل ارزیابی:</span>
                  <strong style={{ color: 'var(--theme-text-primary)' }}>{resumeCandidate.brandName} - {resumeCandidate.branchName}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ color: 'var(--text-muted)' }}>درصد تکمیل:</span>
                  <span className="ltr-num" style={{ color: 'var(--rs-color-success)', fontWeight: 700 }}>
                    {Object.values(resumeCandidate.responses).filter((r) => r.answerState !== 'UNANSWERED').length} از {resumeCandidate.indicators.length} (
                    {Math.round(
                      (Object.values(resumeCandidate.responses).filter((r) => r.answerState !== 'UNANSWERED').length /
                        resumeCandidate.indicators.length) *
                        100
                    )}%)
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ color: 'var(--text-muted)' }}>اصطکاک‌های ثبت‌شده:</span>
                  <span style={{ color: 'var(--rs-color-error)', fontWeight: 700 }}>
                    {Object.values(resumeCandidate.responses).filter((r) => r.answerState === 'FRICTION').length} مورد
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>زمان شروع:</span>
                  <span style={{ color: 'var(--text-main)', fontSize: 12 }}>
                    {new Date(resumeCandidate.startedAt).toLocaleString('fa-IR')}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ flex: 1, justifyContent: 'center' }}
                  onClick={handleDiscardResume}
                >
                  انصراف و شروع جدید
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  style={{ flex: 1.3, justifyContent: 'center' }}
                  onClick={handleAcceptResume}
                >
                  ادامه ارزیابی
                </button>
              </div>
            </div>
          </div>
        )}

        {/* LANDING VIEW */}
        {viewMode === 'LANDING' && (
          <LandingPage
            canStartAudit={can.fieldWork}
            canOpenReports={can.reports}
            canOpenActions={can.actions}
            currentUserName={currentUserName}
            currentUserRole={currentUserRole}
            activeSession={activeSession}
            savedStoresCount={savedStoresCount}
            actionsCount={actions.length}
            openActionsCount={actions.filter((a) => !['RESOLVED', 'VERIFIED', 'CANCELLED'].includes(a.status)).length}
            visits={pastVisits}
            canReview={can.review}
            onOpenVisit={handleOpenArchivedVisit}
            onOpenArchive={() => setViewMode('ARCHIVE')}
            onOpenBusiness={can.reports ? () => setViewMode('BUSINESS') : undefined}
            onOpenReview={can.review ? () => setViewMode('SUPERVISOR') : undefined}
            onStartNewAudit={() => setViewMode('WIZARD')}
            onResumeAudit={() => setViewMode('AUDIT')}
            onOpenReport={() => setViewMode('REPORT')}
            onOpenActions={() => setViewMode('ACTIONS')}
            onOpenCatalog={can.adminTools ? () => setViewMode('CATALOG') : undefined}
          />
        )}

        {viewMode === 'WIZARD' && (
          <StartVisitWizard
            allIndicators={allIndicators}
            onStartVisit={handleStartVisit}
            currentUserName={currentUserName}
          />
        )}

        {/* AUDIT VIEW (Section 6, 16, 29) */}
        {viewMode === 'AUDIT' && activeSession && currentIndicator && (
          <>
            {/* Quick Navigation Filter Pills */}
            <div style={{ maxWidth: isDesktopSplitView ? 1200 : 540, margin: '10px auto 0', padding: '0 8px', display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>نمایش:</span>
              <button
                type="button"
                onClick={() => setAuditFilter('ALL')}
                style={{
                  background: auditFilter === 'ALL' ? 'var(--rs-color-action-primary)' : 'var(--bg-input)',
                  color: auditFilter === 'ALL' ? '#fff' : 'var(--text-muted)',
                  border: `1px solid ${auditFilter === 'ALL' ? 'var(--rs-color-action-primary)' : 'var(--border-subtle)'}`,
                  borderRadius: 'var(--rs-radius-full)',
                  padding: '3px 10px',
                  fontSize: 11,
                  cursor: 'pointer',
                  fontWeight: 600,
                  transition: 'all var(--rs-duration-micro) var(--rs-ease-standard)',
                }}
              >
                همه ({activeSession.indicators.length})
              </button>
              <button
                type="button"
                onClick={() => setAuditFilter('MISSING')}
                style={{
                  background: auditFilter === 'MISSING' ? 'var(--rs-color-error)' : 'var(--bg-input)',
                  color: auditFilter === 'MISSING' ? '#fff' : 'var(--text-muted)',
                  border: `1px solid ${auditFilter === 'MISSING' ? 'var(--rs-color-error)' : 'var(--border-subtle)'}`,
                  borderRadius: 'var(--rs-radius-full)',
                  padding: '3px 10px',
                  fontSize: 11,
                  cursor: 'pointer',
                  fontWeight: 600,
                  transition: 'all var(--rs-duration-micro) var(--rs-ease-standard)',
                }}
              >
                بدون پاسخ
              </button>
              <button
                type="button"
                onClick={() => setAuditFilter('FRICTION')}
                style={{
                  background: auditFilter === 'FRICTION' ? 'var(--rs-color-warning)' : 'var(--bg-input)',
                  color: auditFilter === 'FRICTION' ? 'var(--rs-color-navy-900)' : 'var(--text-muted)',
                  border: `1px solid ${auditFilter === 'FRICTION' ? 'var(--rs-color-warning)' : 'var(--border-subtle)'}`,
                  borderRadius: 'var(--rs-radius-full)',
                  padding: '3px 10px',
                  fontSize: 11,
                  cursor: 'pointer',
                  fontWeight: 600,
                  transition: 'all var(--rs-duration-micro) var(--rs-ease-standard)',
                }}
              >
                اصطکاک‌ها
              </button>
              <button
                type="button"
                onClick={() => setAuditFilter('FLAGGED')}
                style={{
                  background: auditFilter === 'FLAGGED' ? 'var(--rs-color-success)' : 'var(--bg-input)',
                  color: auditFilter === 'FLAGGED' ? '#fff' : 'var(--text-muted)',
                  border: `1px solid ${auditFilter === 'FLAGGED' ? 'var(--rs-color-success)' : 'var(--border-subtle)'}`,
                  borderRadius: 'var(--rs-radius-full)',
                  padding: '3px 10px',
                  fontSize: 11,
                  cursor: 'pointer',
                  fontWeight: 600,
                  transition: 'all var(--rs-duration-micro) var(--rs-ease-standard)',
                }}
              >
                نشانه‌دار
              </button>
            </div>

            {/* Layout Switch: Desktop Split View vs Mobile Focus */}
            {isDesktopSplitView ? (
              <div className="desktop-split-view">
                {/* Column 1: Sidebar (Sections & Progress) */}
                <aside className="split-pane split-sidebar">
                  <div style={{ marginBottom: 16 }}>
                    <strong style={{ fontSize: 15, color: 'var(--theme-text-primary)', display: 'block' }}>{activeSession.brandName}</strong>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{activeSession.branchName}</span>
                  </div>

                  <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 12 }}>
                    مراحل ارزیابی
                  </h4>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {Array.from(new Set(activeSession.indicators.map((i) => i.journeyStage))).map((st) => {
                      const isCurrent = currentStage === st;
                      const countTotal = activeSession.indicators.filter((i) => i.journeyStage === st).length;
                      const countAns = activeSession.indicators.filter(
                        (i) => i.journeyStage === st && activeSession.responses[i.id]?.answerState !== 'UNANSWERED'
                      ).length;

                      return (
                        <div
                          key={st}
                          onClick={() => handleSelectStage(st)}
                          style={{
                            padding: '10px 12px',
                            borderRadius: 'var(--rs-radius-control)',
                            border: `1px solid ${isCurrent ? 'var(--rs-color-brand-cyan)' : 'var(--border-subtle)'}`,
                            background: isCurrent ? 'rgba(0, 176, 240, 0.14)' : 'var(--bg-input)',
                            cursor: 'pointer',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            transition: 'all var(--rs-duration-micro) var(--rs-ease-standard)',
                          }}
                        >
                          <span style={{ fontSize: 12, fontWeight: isCurrent ? 700 : 500, color: isCurrent ? 'var(--rs-color-brand-cyan)' : 'var(--text-main)' }}>
                            {stageLabel(st)}
                          </span>
                          <span className="ltr-num" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {countAns}/{countTotal}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border-subtle)' }}>
                    <button
                      type="button"
                      className="btn-primary"
                      style={{ width: '100%', justifyContent: 'center' }}
                      onClick={() => setViewMode('REVIEW')}
                    >
                      مرور و کنترل کیفیت
                    </button>
                  </div>
                </aside>

                {/* Column 2: Middle (Scrollable Question List) */}
                <div className="split-pane split-middle">
                  <div style={{ marginBottom: 12 }}>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="جستجوی شاخص..."
                      className="friction-textarea"
                      style={{ minHeight: 36, padding: '6px 12px', fontSize: 12, margin: 0 }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {displayedIndicators.map((ind, idx) => {
                      const resp = activeSession.responses[ind.id];
                      const isSel = idx === currentQuestionIndex;
                      const isClean = resp?.answerState === 'NO_FRICTION';
                      const isFriction = resp?.answerState === 'FRICTION';
                      const isNA = resp?.answerState === 'NOT_APPLICABLE';

                      return (
                        <div
                          key={ind.id}
                          onClick={() => setCurrentQuestionIndex(idx)}
                          style={{
                            padding: '8px 10px',
                            borderRadius: 'var(--rs-radius-control)',
                            border: `1px solid ${isSel ? 'var(--rs-color-brand-cyan)' : 'var(--border-subtle)'}`,
                            background: isSel ? 'rgba(0, 176, 240, 0.14)' : 'var(--bg-input)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            transition: 'all var(--rs-duration-micro) var(--rs-ease-standard)',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                            <span className="indicator-code-badge is-small">
                              {ind.code}
                            </span>
                            <span style={{ fontSize: 12, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {ind.subject}
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                            {isClean && <CheckCircle2 size={14} color="var(--rs-color-success)" />}
                            {isFriction && <AlertTriangle size={14} color="var(--rs-color-error)" />}
                            {isNA && <HelpCircle size={14} color="#646E8C" />}
                            {resp?.isFlagged && <Bookmark size={13} fill="var(--rs-color-warning)" color="var(--rs-color-warning)" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Column 3: Main (Focused Question Card & Details) */}
                <div className="split-pane split-main">
                  {displayedIndicators.length === 0 ? (
                    <FilterEmptyState
                      filter={auditFilter}
                      onShowAll={() => { setAuditFilter('ALL'); setSearchQuery(''); setCurrentQuestionIndex(0); }}
                      onReview={() => setViewMode('REVIEW')}
                    />
                  ) : (
                    <QuestionCard
                      indicator={currentIndicator}
                      response={activeSession.responses[currentIndicator.id]}
                      currentIndex={currentQuestionIndex}
                      totalCount={displayedIndicators.length}
                      sectionName={currentStage}
                      onAnswer={handleAnswerState}
                      onOpenFrictionSheet={() => setIsFrictionSheetOpen(true)}
                      onToggleFlag={handleToggleFlag}
                      onPrev={() => setCurrentQuestionIndex((prev) => Math.max(0, prev - 1))}
                      onNext={() =>
                        setCurrentQuestionIndex((prev) =>
                          Math.min(displayedIndicators.length - 1, prev + 1)
                        )
                      }
                      quickMode={quickMode}
                      onToggleQuickMode={() => setQuickMode(!quickMode)}
                      supervisorNote={activeSession.findingDecisions?.[currentIndicator.id]?.comment}
                    />
                  )}
                </div>
              </div>
            ) : (
              /* Mobile single-focus flow.
                 The question comes first: the overview panel is about 426px of
                 progress, search and stage chips, which on a phone pushed the
                 answer options and the next button below the fold on every one
                 of 253 questions. Navigation and filters still follow underneath,
                 where they are reached deliberately rather than scrolled past. */
              <>
                {displayedIndicators.length === 0 ? (
                  <FilterEmptyState
                    filter={auditFilter}
                    onShowAll={() => { setAuditFilter('ALL'); setSearchQuery(''); setCurrentQuestionIndex(0); }}
                    onReview={() => setViewMode('REVIEW')}
                  />
                ) : (
                  <QuestionCard
                    indicator={currentIndicator}
                    response={activeSession.responses[currentIndicator.id]}
                    currentIndex={currentQuestionIndex}
                    totalCount={displayedIndicators.length}
                    sectionName={currentStage}
                    onAnswer={handleAnswerState}
                    onOpenFrictionSheet={() => setIsFrictionSheetOpen(true)}
                    onToggleFlag={handleToggleFlag}
                    onPrev={() => setCurrentQuestionIndex((prev) => Math.max(0, prev - 1))}
                    onNext={() =>
                      setCurrentQuestionIndex((prev) =>
                        Math.min(displayedIndicators.length - 1, prev + 1)
                      )
                    }
                    quickMode={quickMode}
                    onToggleQuickMode={() => setQuickMode(!quickMode)}
                    supervisorNote={activeSession.findingDecisions?.[currentIndicator.id]?.comment}
                  />
                )}

                <FormOverview
                  indicators={activeSession.indicators}
                  responses={activeSession.responses}
                  currentStage={currentStage}
                  onSelectStage={handleSelectStage}
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                  brandName={activeSession.brandName}
                  branchName={activeSession.branchName}
                  startTime={activeSession.startedAt}
                  autosaveState={!isOnline ? 'OFFLINE' : isSaving ? 'SAVING' : 'SAVED'}
                  onOpenReview={() => setViewMode('REVIEW')}
                  assessmentType={activeSession.assessmentType}
                />
              </>
            )}

            {/* Friction Flow Bottom Sheet (Section 9) */}
            <FrictionSheet
              tenantId={currentTenantId}
              visitId={activeSession?.id}
              indicator={currentIndicator}
              currentResponse={activeSession.responses[currentIndicator.id]}
              isOpen={isFrictionSheetOpen}
              onClose={() => setIsFrictionSheetOpen(false)}
              onSave={handleSaveFriction}
            />

            {/* Section 14: Undo Snackbar */}
            {undoState && (
              <div className="undo-snackbar">
                <span>وضعیت مناسب ثبت شد</span>
                <button
                  type="button"
                  className="undo-btn"
                  onClick={handleUndoAutoAdvance}
                >
                  بازگردانی
                </button>
              </div>
            )}
          </>
        )}

        {/* REVIEW SCREEN (Section 23, 24, 25) */}
        {viewMode === 'REVIEW' && activeSession && (
          <ReviewScreen
            indicators={activeSession.indicators}
            responses={activeSession.responses}
            onJumpToQuestion={handleJumpToQuestion}
            onBackToAudit={() => setViewMode('AUDIT')}
            onSubmitVisit={handleSubmitVisit}
            assessmentType={activeSession.assessmentType}
          />
        )}

        {/* Lazy Loaded Views with Suspense Boundary */}
        <React.Suspense fallback={<ViewLoadingFallback />}>
          {/* SUPERVISOR CARPET (Section 26, 27, 28) */}
          {viewMode === 'SUPERVISOR' && !(activeSession && activeSession.status === 'SUBMITTED') && (
            <ReviewQueue visits={pastVisits} isLoading={isLoadingVisits} onOpen={handleOpenArchivedVisit} />
          )}

          {viewMode === 'SUPERVISOR' && activeSession && activeSession.status === 'SUBMITTED' && (
            <SupervisorReview
              visit={activeSession}
              onApproveVisit={handleApproveVisit}
              onRequestRevision={handleRequestRevision}
              onBackToDashboard={() => setViewMode('AUDIT')}
              onCreateCorrectiveAction={can.createActions ? handleCreateCorrectiveAction : undefined}
            />
          )}

          {/* OFFICIAL AUDIT REPORT (With Radar Chart) */}
          {viewMode === 'REPORT' && (
            <VisitReportView
              visit={reportVisit}
              historyVisits={pastVisits}
              isSample={reportVisit === SAMPLE_REAL_VISIT}
              onBackToDashboard={() => setViewMode(activeSession ? 'AUDIT' : 'WIZARD')}
              onCreateCorrectiveAction={handleCreateCorrectiveAction}
            />
          )}

          {actionsNotice && viewMode === 'ACTIONS' && (
            <div className="app-notice" role="alert">
              <span>{actionsNotice}</span>
              <button type="button" onClick={() => setActionsNotice(null)} aria-label="بستن">
                ×
              </button>
            </div>
          )}

          {/* CORRECTIVE ACTIONS HUB (Prompt 4) */}
          {viewMode === 'ACTIONS' && (
            <CorrectiveActionsHub
              canManageActions={can.createActions}
              canResolveActions={can.resolveActions}
              canVerifyActions={can.verifyActions}
              actions={actions}
              analytics={actionAnalytics}
              currentUserRole={currentUserRole}
              currentUserName={currentUserName}
              onUpdateAction={handleUpdateCorrectiveAction}
              onResolveAction={handleResolveCorrectiveAction}
              onVerifyAction={handleVerifyCorrectiveAction}
              onReopenAction={handleReopenCorrectiveAction}
              onCreateAction={handleCreateCorrectiveAction}
            />
          )}

          {/* SAVED QUESTIONNAIRES */}
          {viewMode === 'USERS' && can.manageUsers && <UserManagement currentUserId={currentUser.id} onSelfUpdated={signedIn} />}

          {viewMode === 'PASSWORD' && (
            <ChangePasswordScreen
              embedded
              forced={false}
              onDone={(u) => {
                signedIn(u);
                setViewMode('LANDING');
              }}
              onCancel={() => setViewMode('LANDING')}
            />
          )}

          {viewMode === 'ARCHIVE' && (
            <VisitArchive
              visits={pastVisits}
              isLoading={isLoadingVisits}
              loadError={visitsLoadError}
              onRefresh={loadPastVisits}
              onOpenVisit={handleOpenArchivedVisit}
              canViewReports={can.reports}
            />
          )}

          {viewMode === 'BUSINESS' && <BusinessReportView visits={pastVisits} isLoading={isLoadingVisits} />}

          {/* REVISIT HISTORICAL COMPARISON VIEW (Prompt 4) */}
          {viewMode === 'REVISIT' && (
            <RevisitComparisonView
              visits={
                pastVisits.length > 0
                  ? pastVisits
                  : activeSession
                  ? [activeSession]
                  : []
              }
              actions={actions}
              onSelectVisitForAudit={(visitId) => {
                const visit = pastVisits.find((v) => v.id === visitId);
                if (visit) handleOpenArchivedVisit(visit);
              }}
              onNavigateToActions={() => setViewMode('ACTIONS')}
            />
          )}

          {/* CATALOG / ADMIN QUESTION BANK */}
          {viewMode === 'CATALOG' && (
            <AdminQuestionBank indicators={allIndicators} />
          )}

          {/* SCENARIO RUNNER (Scenarios A-G) */}
          {viewMode === 'SCENARIOS' && (
            <ScenarioRunner indicators={allIndicators} />
          )}
        </React.Suspense>

        {/* Section 22: Prevent Data Loss Confirm Dialog */}
        {showDiscardModal && (
          <div className="friction-sheet-backdrop" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div className="glass-panel" style={{ maxWidth: 420, width: '100%', padding: 24, textAlign: 'center' }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(217, 74, 86, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <Trash2 size={26} color="var(--rs-color-error)" />
              </div>
              <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 8, color: 'var(--theme-text-primary)' }}>
                تأیید انصراف و پاکسازی ارزیابی
              </h3>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 20 }}>
                آیا از خروج و حذف این ارزیابی اطمینان دارید؟
                <br />
                <strong style={{ color: 'var(--rs-color-error)' }}>تمامی پاسخ‌ها و تصاویر ذخیره‌شده از روی این دستگاه پاک خواهند شد.</strong>
              </p>

              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ flex: 1, justifyContent: 'center' }}
                  onClick={() => setShowDiscardModal(false)}
                >
                  انصراف و ادامه کار
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  style={{ flex: 1.2, justifyContent: 'center', background: 'var(--rs-color-error)', boxShadow: '0 4px 16px rgba(217, 74, 86, 0.35)' }}
                  onClick={handleConfirmDiscardSession}
                >
                  حذف پیش‌نویس
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

        {/* Mobile Bottom Tab Bar */}
        <MobileTabBar
          viewMode={viewMode}
          onSelectViewMode={setViewMode}
          activeSession={activeSession}
          actionsCount={actions.length}
          onOpenMobileMenu={() => setIsMobileSidebarOpen(true)}
          canFieldWork={can.fieldWork}
          canReports={can.reports}
          canActions={can.actions}
        />
      </div>
    </div>
  );
};


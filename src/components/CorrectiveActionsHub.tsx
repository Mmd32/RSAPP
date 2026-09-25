import React, { useState, useMemo } from 'react';
import { faDateShort, faDigits, faPercent, departmentLabel, DEPARTMENT_LABEL } from '../utils/format';
import { StatCard, StatRow } from './ui/StatCard';
import {
  CorrectiveAction,
  CorrectiveActionPriority,
  CorrectiveActionStatus,
  ActionDepartment,
  RootCauseCategory,
  ActionAuditLog,
  ActionAnalyticsSummary,
  UserRole,
  EvidencePhoto,
} from '../types';
import {
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldAlert,
  ArrowUpDown,
  Filter,
  Search,
  Plus,
  Calendar,
  User,
  Building,
  RotateCcw,
  Check,
  X,
  Eye,
  Camera,
  Layers,
  History,
  AlertCircle,
  ChevronDown,
} from 'lucide-react';

interface CorrectiveActionsHubProps {
  actions: CorrectiveAction[];
  analytics: ActionAnalyticsSummary;
  currentUserRole: UserRole;
  currentUserName: string;
  onUpdateAction: (id: string, updates: Partial<CorrectiveAction>) => void;
  onResolveAction: (
    id: string,
    resolutionNote: string,
    afterPhotos: EvidencePhoto[],
    rootCause?: RootCauseCategory
  ) => void;
  onVerifyAction: (id: string, verificationNote?: string) => void;
  onReopenAction: (id: string, comment: string) => void;
  onCreateAction: (actionData: Partial<CorrectiveAction>) => void;
}

export const CorrectiveActionsHub: React.FC<CorrectiveActionsHubProps> = ({
  actions,
  analytics,
  currentUserRole,
  currentUserName,
  onUpdateAction,
  onResolveAction,
  onVerifyAction,
  onReopenAction,
  onCreateAction,
}) => {
  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('ALL');
  const [selectedBranch, setSelectedBranch] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedPriority, setSelectedPriority] = useState<string>('ALL');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('ALL');
  const [onlyOverdue, setOnlyOverdue] = useState(false);

  // Selected Action for Modal Details
  const [selectedAction, setSelectedAction] = useState<CorrectiveAction | null>(null);

  // Resolution Modal State
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolutionNote, setResolutionNote] = useState('');
  const [selectedRootCause, setSelectedRootCause] = useState<RootCauseCategory>('FACILITY');
  const [afterPhotoUrl, setAfterPhotoUrl] = useState('');

  // Reopen Modal State
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [reopenComment, setReopenComment] = useState('');

  // Create Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newActionTitle, setNewActionTitle] = useState('');
  const [newActionCode, setNewActionCode] = useState('FS02');
  const [newActionBranch, setNewActionBranch] = useState('شعبه ونک');
  const [newActionBrand, setNewActionBrand] = useState('ZARA');
  const [newActionDept, setNewActionDept] = useState<ActionDepartment>('Maintenance');
  const [newActionPriority, setNewActionPriority] = useState<CorrectiveActionPriority>('HIGH');
  const [newActionDesc, setNewActionDesc] = useState('');
  const [newActionDueDate, setNewActionDueDate] = useState('2026-10-01');

  // Unique Brands & Branches for Filter Dropdowns
  const brands = useMemo(() => Array.from(new Set(actions.map((a) => a.brandName))), [actions]);
  const branches = useMemo(() => Array.from(new Set(actions.map((a) => a.branchName))), [actions]);

  // Filtered Actions
  const filteredActions = useMemo(() => {
    const now = Date.now();
    return actions.filter((a) => {
      if (selectedBrand !== 'ALL' && a.brandName !== selectedBrand) return false;
      if (selectedBranch !== 'ALL' && a.branchName !== selectedBranch) return false;
      if (selectedStatus !== 'ALL' && a.status !== selectedStatus) return false;
      if (selectedPriority !== 'ALL' && a.priority !== selectedPriority) return false;
      if (selectedDepartment !== 'ALL' && a.department !== selectedDepartment) return false;

      const isOverdue =
        (a.status === 'OPEN' ||
          a.status === 'ASSIGNED' ||
          a.status === 'IN_PROGRESS' ||
          a.status === 'REOPENED') &&
        new Date(a.dueDate).getTime() < now;

      if (onlyOverdue && !isOverdue) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          a.title.toLowerCase().includes(q) ||
          a.indicatorCode.toLowerCase().includes(q) ||
          a.branchName.toLowerCase().includes(q) ||
          (a.owner && a.owner.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [
    actions,
    selectedBrand,
    selectedBranch,
    selectedStatus,
    selectedPriority,
    selectedDepartment,
    onlyOverdue,
    searchQuery,
  ]);

  // Color helpers
  const getPriorityBadge = (p: CorrectiveActionPriority) => {
    switch (p) {
      case 'CRITICAL':
        return { label: 'بحرانی', bg: 'var(--friction-critical-bg)', color: 'var(--friction-critical)', border: 'var(--friction-critical)' };
      case 'HIGH':
        return { label: 'بالا', bg: 'var(--friction-high-bg)', color: 'var(--friction-high)', border: 'var(--friction-high)' };
      case 'MEDIUM':
        return { label: 'متوسط', bg: 'var(--friction-medium-bg)', color: 'var(--friction-medium)', border: 'var(--friction-medium)' };
      case 'LOW':
        return { label: 'پایین', bg: 'rgba(0, 176, 240, 0.15)', color: '#00B0F0', border: '#00B0F0' };
    }
  };

  const getStatusBadge = (s: CorrectiveActionStatus) => {
    switch (s) {
      case 'OPEN':
        return { label: 'باز / جدید', bg: 'var(--surface-chip)', color: 'var(--theme-text-primary)' };
      case 'ASSIGNED':
        return { label: 'ارجاع‌شده', bg: 'rgba(0, 176, 240, 0.12)', color: '#007DAA' };
      case 'IN_PROGRESS':
        return { label: 'در حال انجام', bg: 'rgba(242, 181, 68, 0.15)', color: 'var(--friction-medium)' };
      case 'WAITING_REVIEW':
        return { label: 'در انتظار تایید', bg: 'rgba(139, 92, 246, 0.15)', color: '#7C3AED' };
      case 'RESOLVED':
        return { label: 'اصلاح‌شده', bg: 'rgba(45, 157, 120, 0.15)', color: '#2D9D78' };
      case 'VERIFIED':
        return { label: 'تایید نهایی', bg: 'rgba(45, 157, 120, 0.25)', color: 'var(--friction-clean)' };
      case 'REOPENED':
        return { label: 'بازگشایی مجدد', bg: 'var(--friction-high-bg)', color: 'var(--friction-high)' };
      case 'CANCELLED':
        return { label: 'لغوشده', bg: 'var(--surface-chip)', color: 'var(--theme-text-muted)' };
    }
  };

  const isOverdueAction = (a: CorrectiveAction) => {
    const isOpen =
      a.status === 'OPEN' ||
      a.status === 'ASSIGNED' ||
      a.status === 'IN_PROGRESS' ||
      a.status === 'REOPENED';
    return isOpen && new Date(a.dueDate).getTime() < Date.now();
  };

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '16px 12px 64px 12px' }}>
      {/* Header & Title */}
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
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--theme-text-primary)' }}>
              اقدامات اصلاحی
            </h1>
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                background: 'var(--surface-sunken)',
                color: 'var(--rs-color-action-primary)',
                padding: '2px 8px',
                borderRadius: 'var(--rs-radius-full)',
                border: '1px solid var(--theme-card-border)',
              }}
            >
              {actions.length} اقدام
            </span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--theme-text-secondary)', marginTop: 4 }}>
            مدیریت، پیگیری، بارگذاری مدارک قبل/بعد، و راستی‌آزمایی اقدامات بهبود مستمر ریتیل
          </p>
        </div>

        {/* Create Action Button (Allowed for Manager, Supervisor, Admin) */}
        {(currentUserRole === 'Manager' ||
          currentUserRole === 'Supervisor' ||
          currentUserRole === 'Admin') && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-rs btn-rs-primary"
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Plus size={16} />
            ثبت اقدام جدید
          </button>
        )}
      </div>

      {/* 1. Executive Metrics Strip (Requirement 11 & 18) */}
      <StatRow>
        <StatCard
          label="اقدامات باز"
          value={faDigits(analytics.openActions)}
          hint="در حال پیگیری در شعب"
        />
        <StatCard
          label="سررسید گذشته"
          value={faDigits(analytics.overdueActions)}
          hint="نیازمند اقدام فوری مسئول شعبه"
          /* Only an overdue action that actually exists is an alarm. */
          tone={analytics.overdueActions > 0 ? 'alarm' : 'default'}
        />
        <StatCard
          label="اصطکاک‌های بحرانی"
          value={faDigits(analytics.criticalActions)}
          hint="اولویت اول اصلاح"
          tone={analytics.criticalActions > 0 ? 'alarm' : 'default'}
        />
        <StatCard
          label="در انتظار راستی‌آزمایی"
          value={faDigits(analytics.awaitingVerificationActions)}
          hint="مدرک ارسال شده و آماده بررسی"
        />
        <StatCard
          label="نرخ رفع و تأیید"
          value={faPercent(analytics.resolutionRate)}
          hint={`میانگین زمان: ${faDigits(analytics.medianResolutionHours)} ساعت`}
          tone="positive"
        />
      </StatRow>

      {/* 2. Filter Toolbar (Requirement 12) */}
      <div
        className="card-rs"
        style={{
          padding: 14,
          marginBottom: 20,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 10,
          alignItems: 'center',
          background: 'var(--theme-card-bg)',
        }}
      >
        <div style={{ flex: '1 1 200px', position: 'relative' }}>
          <Search
            size={16}
            style={{
              position: 'absolute',
              right: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--theme-text-muted)',
            }}
          />
          <input
            type="text"
            className="input-rs"
            placeholder="جستجو در عنوان، کد شاخص، شعبه، یا مسئول..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingRight: 32, fontSize: 13, width: '100%' }}
          />
        </div>

        {/* Filter Brand */}
        <select
          className="select-rs"
          value={selectedBrand}
          onChange={(e) => setSelectedBrand(e.target.value)}
          style={{ width: 'auto', minWidth: 120, fontSize: 13 }}
        >
          <option value="ALL">همه برندها</option>
          {brands.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>

        {/* Filter Branch */}
        <select
          className="select-rs"
          value={selectedBranch}
          onChange={(e) => setSelectedBranch(e.target.value)}
          style={{ width: 'auto', minWidth: 130, fontSize: 13 }}
        >
          <option value="ALL">همه شعب</option>
          {branches.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>

        {/* Filter Status */}
        <select
          className="select-rs"
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          style={{ width: 'auto', minWidth: 130, fontSize: 13 }}
        >
          <option value="ALL">همه وضعیت‌ها</option>
          <option value="OPEN">باز / جدید</option>
          <option value="ASSIGNED">ارجاع‌شده</option>
          <option value="IN_PROGRESS">در حال انجام</option>
          <option value="WAITING_REVIEW">در انتظار تایید</option>
          <option value="RESOLVED">اصلاح‌شده</option>
          <option value="VERIFIED">تایید نهایی</option>
          <option value="REOPENED">بازگشایی مجدد</option>
        </select>

        {/* Filter Priority */}
        <select
          className="select-rs"
          value={selectedPriority}
          onChange={(e) => setSelectedPriority(e.target.value)}
          style={{ width: 'auto', minWidth: 120, fontSize: 13 }}
        >
          <option value="ALL">همه اولویت‌ها</option>
          <option value="CRITICAL">بحرانی</option>
          <option value="HIGH">بالا</option>
          <option value="MEDIUM">متوسط</option>
          <option value="LOW">پایین</option>
        </select>

        {/* Filter Department */}
        <select
          className="select-rs"
          value={selectedDepartment}
          onChange={(e) => setSelectedDepartment(e.target.value)}
          style={{ width: 'auto', minWidth: 130, fontSize: 13 }}
        >
          <option value="ALL">همه دپارتمان‌ها</option>
          {/* One source for these names, so the filter and the table can
              never drift apart. */}
          {Object.entries(DEPARTMENT_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        {/* Overdue Checkbox */}
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            padding: '6px 10px',
            borderRadius: 'var(--rs-radius-control)',
            background: onlyOverdue ? 'var(--friction-high-bg)' : 'transparent',
            color: onlyOverdue ? 'var(--rs-color-error)' : 'var(--theme-text-primary)',
            border: `1px solid ${onlyOverdue ? 'var(--rs-color-error)' : 'var(--theme-card-border)'}`,
          }}
        >
          <input
            type="checkbox"
            checked={onlyOverdue}
            onChange={(e) => setOnlyOverdue(e.target.checked)}
          />
          فقط سررسید گذشته
        </label>
      </div>

      {/* 3. Action List Table (Enterprise Style) */}
      <div className="card-rs" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
          <thead>
            <tr
              style={{
                background: 'var(--surface-sunken)',
                borderBottom: '1px solid var(--theme-card-border)',
              }}
            >
              <th style={{ padding: '12px 14px', fontSize: 12, fontWeight: 700, color: 'var(--theme-text-secondary)' }}>
                کد / عنوان اقدام
              </th>
              <th style={{ padding: '12px 14px', fontSize: 12, fontWeight: 700, color: 'var(--theme-text-secondary)' }}>
                شعبه / برند
              </th>
              <th style={{ padding: '12px 14px', fontSize: 12, fontWeight: 700, color: 'var(--theme-text-secondary)' }}>
                اولویت
              </th>
              <th style={{ padding: '12px 14px', fontSize: 12, fontWeight: 700, color: 'var(--theme-text-secondary)' }}>
                وضعیت
              </th>
              <th style={{ padding: '12px 14px', fontSize: 12, fontWeight: 700, color: 'var(--theme-text-secondary)' }}>
                مسئول / واحد
              </th>
              <th style={{ padding: '12px 14px', fontSize: 12, fontWeight: 700, color: 'var(--theme-text-secondary)' }}>
                مهلت
              </th>
              <th style={{ padding: '12px 14px', fontSize: 12, fontWeight: 700, color: 'var(--theme-text-secondary)' }}>
                مدارک
              </th>
              <th style={{ padding: '12px 14px', fontSize: 12, fontWeight: 700, color: 'var(--theme-text-secondary)' }}>
                عملیات
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredActions.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: '60px 24px', textAlign: 'center' }}>
                  {actions.length === 0 ? (
                    <div style={{ maxWidth: 440, margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
                      <div
                        style={{
                          width: 64,
                          height: 64,
                          borderRadius: '50%',
                          background: 'rgba(0, 176, 240, 0.12)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 4px 20px rgba(0, 176, 240, 0.2)',
                        }}
                      >
                        <ShieldAlert size={32} color="var(--rs-color-brand-cyan)" />
                      </div>
                      <h4 style={{ fontSize: 17, fontWeight: 700, color: 'var(--theme-text-primary)', margin: 0 }}>
                        هنوز هیچ اقدام اصلاحی ثبت نشده است
                      </h4>
                      <p style={{ fontSize: 13, color: 'var(--theme-text-muted)', lineHeight: 1.6, margin: 0 }}>
                        شما می‌توانید از صفحه گزارش بازدید روی اصطکاک‌ها کلیک کنید تا به اقدام تبدیل شوند، یا مستقیماً اولین اقدام اصلاحی را به صورت دستی ایجاد نمایید.
                      </p>
                      <button
                        type="button"
                        className="btn-primary"
                        style={{ marginTop: 8, padding: '8px 20px', fontSize: 13 }}
                        onClick={() => setShowCreateModal(true)}
                      >
                        <Plus size={16} />
                        <span>تعریف اولین اقدام اصلاحی</span>
                      </button>
                    </div>
                  ) : (
                    <div style={{ maxWidth: 360, margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                      <Filter size={28} color="var(--theme-text-muted)" style={{ opacity: 0.6 }} />
                      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--theme-text-primary)' }}>
                        هیچ موردی با فیلترهای انتخابی یافت نشد
                      </span>
                      <p style={{ fontSize: 12, color: 'var(--theme-text-muted)', margin: 0 }}>
                        لطفاً معیارهای جستجو یا وضعیت‌های فیلتر را تغییر دهید.
                      </p>
                    </div>
                  )}
                </td>
              </tr>
            ) : (
              filteredActions.map((action) => {
                const pBadge = getPriorityBadge(action.priority);
                const sBadge = getStatusBadge(action.status);
                const isOverdue = isOverdueAction(action);

                return (
                  <tr
                    key={action.id}
                    style={{
                      borderBottom: '1px solid var(--theme-card-border)',
                      background: isOverdue ? 'rgba(217, 74, 86, 0.08)' : 'var(--theme-card-bg)',
                    }}
                  >
                    {/* Title & Code */}
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span
                          className="ltr-code"
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: '2px 6px',
                            background: 'var(--surface-sunken)',
                            color: 'var(--theme-text-primary)',
                            borderRadius: 'var(--rs-radius-control)',
                          }}
                        >
                          {action.indicatorCode}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--theme-text-primary)' }}>
                          {action.title}
                        </span>
                        {action.reopenCount > 0 && (
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              background: 'var(--friction-high-bg)',
                              color: 'var(--rs-color-error)',
                              padding: '1px 5px',
                              borderRadius: 'var(--rs-radius-full)',
                            }}
                          >
                            بازگشایی {action.reopenCount}×
                          </span>
                        )}
                      </div>
                      {action.description && (
                        <div
                          style={{
                            fontSize: 12,
                            color: 'var(--theme-text-secondary)',
                            marginTop: 2,
                            maxWidth: 320,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {action.description}
                        </div>
                      )}
                    </td>

                    {/* Branch & Brand */}
                    <td style={{ padding: '12px 14px', fontSize: 12, color: 'var(--theme-text-primary)' }}>
                      <div style={{ fontWeight: 600 }}>{action.branchName}</div>
                      <div style={{ fontSize: 11, color: 'var(--theme-text-muted)' }}>{action.brandName}</div>
                    </td>

                    {/* Priority */}
                    <td style={{ padding: '12px 14px' }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 'var(--rs-radius-full)',
                          background: pBadge.bg,
                          color: pBadge.color,
                          border: `1px solid ${pBadge.border}`,
                        }}
                      >
                        {pBadge.label}
                      </span>
                    </td>

                    {/* Status */}
                    <td style={{ padding: '12px 14px' }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: 'var(--rs-radius-full)',
                          background: sBadge.bg,
                          color: sBadge.color,
                        }}
                      >
                        {sBadge.label}
                      </span>
                    </td>

                    {/* Owner & Department */}
                    <td style={{ padding: '12px 14px', fontSize: 12 }}>
                      <div style={{ fontWeight: 600, color: 'var(--theme-text-primary)' }}>
                        {action.owner || 'نامشخص'}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--theme-text-muted)' }}>
                        {departmentLabel(action.department)}
                      </div>
                    </td>

                    {/* Due Date & Overdue Flag */}
                    <td style={{ padding: '12px 14px', fontSize: 12 }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          color: isOverdue ? 'var(--rs-color-error)' : 'var(--theme-text-secondary)',
                          fontWeight: isOverdue ? 700 : 500,
                        }}
                      >
                        {isOverdue && <AlertTriangle size={14} color="var(--rs-color-error)" />}
                        <span>{faDateShort(action.dueDate)}</span>
                      </div>
                      {isOverdue && (
                        <span style={{ fontSize: 10, color: 'var(--rs-color-error)', fontWeight: 700 }}>
                          منقضی شده
                        </span>
                      )}
                    </td>

                    {/* Evidence summary */}
                    <td style={{ padding: '12px 14px', fontSize: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span
                          title="عکس قبل"
                          style={{
                            fontSize: 11,
                            padding: '1px 6px',
                            background: 'var(--friction-low-bg)',
                            color: 'var(--friction-medium)',
                            borderRadius: 'var(--rs-radius-control)',
                          }}
                        >
                          قبل: {action.beforePhotos?.length || 0}
                        </span>
                        <span
                          title="عکس بعد"
                          style={{
                            fontSize: 11,
                            padding: '1px 6px',
                            background: action.afterPhotos?.length > 0 ? 'var(--friction-clean-bg)' : 'var(--surface-chip)',
                            color: action.afterPhotos?.length > 0 ? 'var(--friction-clean)' : '#646E8C',
                            borderRadius: 'var(--rs-radius-control)',
                          }}
                        >
                          بعد: {action.afterPhotos?.length || 0}
                        </span>
                      </div>
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '12px 14px' }}>
                      <button
                        onClick={() => setSelectedAction(action)}
                        className="btn-rs btn-rs-secondary"
                        style={{ padding: '5px 10px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
                      >
                        <Eye size={14} />
                        جزئیات و اقدام
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 4. Action Detail & Resolution Modal */}
      {selectedAction && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(22, 33, 62, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16,
          }}
        >
          <div
            className="card-rs"
            style={{
              background: 'var(--theme-modal-bg)',
              width: '100%',
              maxWidth: 780,
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: 24,
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                borderBottom: '1px solid var(--theme-card-border)',
                paddingBottom: 16,
                marginBottom: 16,
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    className="ltr-code"
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      background: 'var(--surface-sunken)',
                      color: 'var(--theme-text-primary)',
                      padding: '2px 8px',
                      borderRadius: 'var(--rs-radius-control)',
                    }}
                  >
                    {selectedAction.indicatorCode}
                  </span>
                  <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--theme-text-primary)' }}>
                    {selectedAction.title}
                  </h2>
                </div>
                <div style={{ fontSize: 12, color: 'var(--theme-text-secondary)', marginTop: 4 }}>
                  {selectedAction.branchName} • برند: {selectedAction.brandName} • ثبت شده در تاریخ{' '}
                  <span className="ltr-code">{selectedAction.createdAt.slice(0, 10)}</span>
                </div>
              </div>

              <button
                onClick={() => setSelectedAction(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--theme-text-muted)',
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Metadata Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                gap: 12,
                marginBottom: 20,
                background: 'var(--surface-sunken)',
                padding: 12,
                borderRadius: 'var(--rs-radius-card)',
              }}
            >
              <div>
                <span style={{ fontSize: 11, color: 'var(--theme-text-secondary)' }}>وضعیت جاری:</span>
                <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--theme-text-primary)', marginTop: 2 }}>
                  {getStatusBadge(selectedAction.status).label}
                </div>
              </div>
              <div>
                <span style={{ fontSize: 11, color: 'var(--theme-text-secondary)' }}>اولویت:</span>
                <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--theme-text-primary)', marginTop: 2 }}>
                  {getPriorityBadge(selectedAction.priority).label}
                </div>
              </div>
              <div>
                <span style={{ fontSize: 11, color: 'var(--theme-text-secondary)' }}>مسئول انجام:</span>
                <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--theme-text-primary)', marginTop: 2 }}>
                  {selectedAction.owner || 'تعیین نشده'}
                </div>
              </div>
              <div>
                <span style={{ fontSize: 11, color: 'var(--theme-text-secondary)' }}>دپارتمان:</span>
                <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--theme-text-primary)', marginTop: 2 }}>
                  {selectedAction.department}
                </div>
              </div>
              <div>
                <span style={{ fontSize: 11, color: 'var(--theme-text-secondary)' }}>مهلت اجرا:</span>
                <div
                  className="ltr-code"
                  style={{
                    fontWeight: 700,
                    fontSize: 13,
                    color: isOverdueAction(selectedAction) ? 'var(--rs-color-error)' : 'var(--theme-text-primary)',
                    marginTop: 2,
                  }}
                >
                  {faDateShort(selectedAction.dueDate)}
                </div>
              </div>
              <div>
                <span style={{ fontSize: 11, color: 'var(--theme-text-secondary)' }}>ریشه علت (Root Cause):</span>
                <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--theme-text-primary)', marginTop: 2 }}>
                  {selectedAction.rootCause || 'بررسی نشده'}
                </div>
              </div>
            </div>

            {/* Description */}
            {selectedAction.description && (
              <div style={{ marginBottom: 20 }}>
                <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--theme-text-primary)', marginBottom: 6 }}>
                  شرح مشکل و اصطکاک ارزیابی:
                </h4>
                <p style={{ fontSize: 13, color: 'var(--theme-text-secondary)', lineHeight: 1.6 }}>
                  {selectedAction.description}
                </p>
              </div>
            )}

            {/* Side-by-Side Before vs After Evidence Photos (Requirement 6) */}
            <div style={{ marginBottom: 24 }}>
              <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--theme-text-primary)', marginBottom: 12 }}>
                مقایسه شواهد تصویری قبل و بعد (Before / After Evidence)
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {/* Before Box */}
                <div
                  style={{
                    border: '1px solid var(--theme-card-border)',
                    borderRadius: 'var(--rs-radius-card)',
                    padding: 12,
                    background: 'var(--surface-chip)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 12,
                      fontWeight: 700,
                      color: 'var(--rs-color-error)',
                      marginBottom: 8,
                    }}
                  >
                    <Camera size={14} />
                    شواهد اصطکاک اولیه (Before Photos)
                  </div>
                  {selectedAction.beforePhotos && selectedAction.beforePhotos.length > 0 ? (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {selectedAction.beforePhotos.map((p) => (
                        <div
                          key={p.id}
                          style={{
                            width: 100,
                            height: 100,
                            borderRadius: 'var(--rs-radius-control)',
                            overflow: 'hidden',
                            border: '1px solid var(--theme-card-border)',
                          }}
                        >
                          <img
                            src={p.url}
                            alt="Before"
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: 'var(--theme-text-muted)', fontStyle: 'italic' }}>
                      عکس اولیه ثبت نشده است.
                    </div>
                  )}
                </div>

                {/* After Box */}
                <div
                  style={{
                    border: '1px solid var(--theme-card-border)',
                    borderRadius: 'var(--rs-radius-card)',
                    padding: 12,
                    background:
                      selectedAction.afterPhotos && selectedAction.afterPhotos.length > 0
                        ? 'var(--friction-clean-bg)'
                        : 'var(--surface-chip)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 12,
                      fontWeight: 700,
                      color: 'var(--rs-color-success)',
                      marginBottom: 8,
                    }}
                  >
                    <CheckCircle2 size={14} />
                    شواهد اصلاح و بهبود (After Photos)
                  </div>
                  {selectedAction.afterPhotos && selectedAction.afterPhotos.length > 0 ? (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {selectedAction.afterPhotos.map((p) => (
                        <div
                          key={p.id}
                          style={{
                            width: 100,
                            height: 100,
                            borderRadius: 'var(--rs-radius-control)',
                            overflow: 'hidden',
                            border: '1px solid var(--rs-color-success)',
                          }}
                        >
                          <img
                            src={p.url}
                            alt="After"
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: 'var(--theme-text-muted)', fontStyle: 'italic' }}>
                      هنوز تصویر اصلاح بارگذاری نشده است.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Resolution Note if resolved */}
            {selectedAction.resolutionNote && (
              <div
                style={{
                  background: 'var(--friction-clean-bg)',
                  border: '1px solid var(--rs-color-success)',
                  borderRadius: 'var(--rs-radius-card)',
                  padding: 12,
                  marginBottom: 20,
                }}
              >
                <h5 style={{ fontSize: 12, fontWeight: 700, color: 'var(--friction-clean)', marginBottom: 4 }}>
                  گزارش تکمیل اصلاحات توسط مسئول:
                </h5>
                <p style={{ fontSize: 12, color: 'var(--theme-text-primary)' }}>
                  {selectedAction.resolutionNote}
                </p>
                {selectedAction.completionDate && (
                  <div style={{ fontSize: 10, color: 'var(--friction-clean)', marginTop: 4 }}>
                    تاریخ تکمیل:{' '}
                    <span className="ltr-code">{selectedAction.completionDate.slice(0, 10)}</span>
                  </div>
                )}
              </div>
            )}

            {/* Verification Note if verified */}
            {selectedAction.verificationNote && (
              <div
                style={{
                  background: 'var(--surface-sunken)',
                  border: '1px solid var(--theme-card-border)',
                  borderRadius: 'var(--rs-radius-card)',
                  padding: 12,
                  marginBottom: 20,
                }}
              >
                <h5 style={{ fontSize: 12, fontWeight: 700, color: 'var(--theme-text-primary)', marginBottom: 4 }}>
                  تاییدیه ارزیاب / سرپرست:
                </h5>
                <p style={{ fontSize: 12, color: 'var(--theme-text-primary)' }}>
                  {selectedAction.verificationNote}
                </p>
                <div style={{ fontSize: 10, color: 'var(--theme-text-secondary)', marginTop: 4 }}>
                  تاییدکننده: {selectedAction.verifiedBy} در تاریخ{' '}
                  <span className="ltr-code">{selectedAction.verifiedAt?.slice(0, 10)}</span>
                </div>
              </div>
            )}

            {/* Reopen Comments if any */}
            {selectedAction.reopenComments && selectedAction.reopenComments.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <h5 style={{ fontSize: 12, fontWeight: 700, color: 'var(--rs-color-error)', marginBottom: 6 }}>
                  تاریخچه بازگشایی مجدد (Reopen History):
                </h5>
                {selectedAction.reopenComments.map((rc) => (
                  <div
                    key={rc.id}
                    style={{
                      background: 'var(--friction-high-bg)',
                      borderRadius: 'var(--rs-radius-control)',
                      padding: '6px 10px',
                      fontSize: 12,
                      color: 'var(--theme-text-primary)',
                      marginBottom: 6,
                    }}
                  >
                    <div>{rc.comment}</div>
                    <div style={{ fontSize: 10, color: 'var(--rs-color-error)', marginTop: 2 }}>
                      توسط: {rc.reopenedBy} •{' '}
                      <span className="ltr-code">{rc.timestamp.slice(0, 10)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Action Buttons Toolbar depending on State and Role */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 10,
                marginTop: 24,
                borderTop: '1px solid var(--theme-card-border)',
                paddingTop: 16,
                flexWrap: 'wrap',
              }}
            >
              {/* Owner / Manager can resolve */}
              {(selectedAction.status === 'OPEN' ||
                selectedAction.status === 'ASSIGNED' ||
                selectedAction.status === 'IN_PROGRESS' ||
                selectedAction.status === 'REOPENED') && (
                <button
                  onClick={() => setShowResolveModal(true)}
                  className="btn-rs btn-rs-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <CheckCircle2 size={16} />
                  ثبت رفع اصطکاک (Resolve)
                </button>
              )}

              {/* Verifier / Supervisor / Evaluator can Verify (Requirement 8) */}
              {selectedAction.status === 'WAITING_REVIEW' && (
                <>
                  <button
                    onClick={() => {
                      onVerifyAction(selectedAction.id, 'اصلاح با موفقیت تایید شد.');
                      setSelectedAction(null);
                    }}
                    className="btn-rs btn-rs-primary"
                    style={{
                      background: 'var(--rs-color-success)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <Check size={16} />
                    تایید نهایی
                  </button>

                  <button
                    onClick={() => setShowReopenModal(true)}
                    className="btn-rs btn-rs-danger"
                    style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <RotateCcw size={16} />
                    رد و بازگشایی مجدد (Reopen)
                  </button>
                </>
              )}

              <button
                onClick={() => setSelectedAction(null)}
                className="btn-rs btn-rs-secondary"
              >
                بستن
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Resolve Action Submission Modal */}
      {showResolveModal && selectedAction && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(22, 33, 62, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: 16,
          }}
        >
          <div
            className="card-rs"
            style={{ background: 'var(--theme-modal-bg)', width: '100%', maxWidth: 520, padding: 20 }}
          >
            <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--theme-text-primary)', marginBottom: 12 }}>
              ثبت گزارش رفع اصطکاک و اصلاح
            </h3>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                گزارش اقدامات انجام شده (Resolution Note) *
              </label>
              <textarea
                className="textarea-rs"
                rows={3}
                placeholder="توضیح دهید مشکل چگونه برطرف شد..."
                value={resolutionNote}
                onChange={(e) => setResolutionNote(e.target.value)}
              />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                ریشه علت مشکل
              </label>
              <select
                className="select-rs"
                value={selectedRootCause}
                onChange={(e) => setSelectedRootCause(e.target.value as RootCauseCategory)}
              >
                <option value="FACILITY">تاسیسات و امکانات (FACILITY)</option>
                <option value="EQUIPMENT">تجهیزات و ابزار (EQUIPMENT)</option>
                <option value="PROCESS">فرآیند و دستورالعمل (PROCESS)</option>
                <option value="PEOPLE">پرسنل و رفتار (PEOPLE)</option>
                <option value="TRAINING">آموزش و مهارت (TRAINING)</option>
                <option value="POLICY">سیاست‌گذاری (POLICY)</option>
                <option value="TECHNOLOGY">فناوری و نرم‌افزار (TECHNOLOGY)</option>
                <option value="OTHER">سایر (OTHER)</option>
              </select>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                آدرس یا تصویر بعد از اصلاح (After Photo URL)
              </label>
              <input
                type="text"
                className="input-rs"
                placeholder="https://... یا انتخاب از گالری"
                value={afterPhotoUrl}
                onChange={(e) => setAfterPhotoUrl(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                onClick={() => setShowResolveModal(false)}
                className="btn-rs btn-rs-secondary"
              >
                انصراف
              </button>
              <button
                disabled={!resolutionNote.trim()}
                onClick={() => {
                  const photos: EvidencePhoto[] = afterPhotoUrl.trim()
                    ? [
                        {
                          id: `p_after_${Date.now()}`,
                          url: afterPhotoUrl.trim(),
                          timestamp: new Date().toISOString(),
                        },
                      ]
                    : [];
                  onResolveAction(selectedAction.id, resolutionNote, photos, selectedRootCause);
                  setShowResolveModal(false);
                  setSelectedAction(null);
                }}
                className="btn-rs btn-rs-primary"
              >
                ثبت و ارسال جهت تایید
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Reopen Modal */}
      {showReopenModal && selectedAction && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(22, 33, 62, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: 16,
          }}
        >
          <div
            className="card-rs"
            style={{ background: 'var(--theme-modal-bg)', width: '100%', maxWidth: 480, padding: 20 }}
          >
            <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--rs-color-error)', marginBottom: 8 }}>
              بازگشایی مجدد اقدام (Reopen Action)
            </h3>
            <p style={{ fontSize: 12, color: 'var(--theme-text-secondary)', marginBottom: 12 }}>
              اگر بررسی نشان داد مشکل به درستی حل نشده یا مدارک کافی نیست، دلیل را یادداشت کنید:
            </p>

            <textarea
              className="textarea-rs"
              rows={3}
              placeholder="دلیل عدم تایید و الزامات اصلاح مجدد..."
              value={reopenComment}
              onChange={(e) => setReopenComment(e.target.value)}
              style={{ marginBottom: 16 }}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                onClick={() => setShowReopenModal(false)}
                className="btn-rs btn-rs-secondary"
              >
                انصراف
              </button>
              <button
                disabled={!reopenComment.trim()}
                onClick={() => {
                  onReopenAction(selectedAction.id, reopenComment);
                  setShowReopenModal(false);
                  setSelectedAction(null);
                }}
                className="btn-rs btn-rs-danger"
              >
                بازگشایی اقدام
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Create New Action Modal */}
      {showCreateModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(22, 33, 62, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: 16,
          }}
        >
          <div
            className="card-rs"
            style={{ background: 'var(--theme-modal-bg)', width: '100%', maxWidth: 560, padding: 24 }}
          >
            <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--theme-text-primary)', marginBottom: 16 }}>
              ثبت اقدام اصلاحی جدید (New Corrective Action)
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                  کد شاخص (Indicator Code)
                </label>
                <input
                  type="text"
                  className="input-rs ltr-code"
                  value={newActionCode}
                  onChange={(e) => setNewActionCode(e.target.value)}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                  نام شعبه
                </label>
                <input
                  type="text"
                  className="input-rs"
                  value={newActionBranch}
                  onChange={(e) => setNewActionBranch(e.target.value)}
                />
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                عنوان اقدام اصلاحی *
              </label>
              <input
                type="text"
                className="input-rs"
                placeholder="مثلاً: تعویض چراغ‌های هالوژن سوخته بالای رگال‌ها"
                value={newActionTitle}
                onChange={(e) => setNewActionTitle(e.target.value)}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                  دپارتمان مسئول
                </label>
                <select
                  className="select-rs"
                  value={newActionDept}
                  onChange={(e) => setNewActionDept(e.target.value as ActionDepartment)}
                >
                  <option value="Maintenance">تاسیسات و نگهداری</option>
                  <option value="Operations">عملیات فروشگاه</option>
                  <option value="Branch Manager">مدیر شعبه</option>
                  <option value="Marketing">مارکتینگ و چیدمان</option>
                  <option value="HR">منابع انسانی</option>
                  <option value="IT">فناوری اطلاعات</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                  اولویت (Priority)
                </label>
                <select
                  className="select-rs"
                  value={newActionPriority}
                  onChange={(e) => setNewActionPriority(e.target.value as CorrectiveActionPriority)}
                >
                  <option value="CRITICAL">بحرانی</option>
                  <option value="HIGH">بالا</option>
                  <option value="MEDIUM">متوسط</option>
                  <option value="LOW">پایین</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                مهلت انجام (Due Date)
              </label>
              <input
                type="date"
                className="input-rs ltr-code"
                value={newActionDueDate}
                onChange={(e) => setNewActionDueDate(e.target.value)}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                توضیحات و دستورالعمل رفع
              </label>
              <textarea
                className="textarea-rs"
                rows={3}
                placeholder="دستورالعمل و الزامات اجرای این اقدام..."
                value={newActionDesc}
                onChange={(e) => setNewActionDesc(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                onClick={() => setShowCreateModal(false)}
                className="btn-rs btn-rs-secondary"
              >
                انصراف
              </button>
              <button
                disabled={!newActionTitle.trim()}
                onClick={() => {
                  onCreateAction({
                    title: newActionTitle.trim(),
                    indicatorCode: newActionCode.trim(),
                    branchName: newActionBranch.trim(),
                    brandName: newActionBrand.trim(),
                    department: newActionDept,
                    priority: newActionPriority,
                    dueDate: new Date(newActionDueDate).toISOString(),
                    description: newActionDesc.trim(),
                  });
                  setShowCreateModal(false);
                }}
                className="btn-rs btn-rs-primary"
              >
                ایجاد اقدام
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React from 'react';
import {
  Home,
  PlusCircle,
  ClipboardCheck,
  CheckCheck,
  ShieldCheck,
  BarChart3,
  GitCompare,
  Archive,
  Target,
  Database,
  FlaskConical,
  Sun,
  Moon,
  ChevronRight,
  ChevronLeft,
  UserCheck,
  Users,
  KeyRound,
  LogOut,
  Sparkles,
  Layers,
  X,
} from 'lucide-react';
import { RetailSolutionsLogo } from '../brand/RetailSolutionsLogo';
import { VisitSession, UserRole } from '../../types';
import { ROLE_LABEL, Role, Capabilities } from '../../auth/roles';

export type ViewMode =
  | 'LANDING'
  | 'WIZARD'
  | 'AUDIT'
  | 'REVIEW'
  | 'SUPERVISOR'
  | 'REPORT'
  | 'CATALOG'
  | 'SCENARIOS'
  | 'ACTIONS'
  | 'REVISIT'
  | 'ARCHIVE'
  | 'USERS'
  | 'PASSWORD';

interface AppSidebarProps {
  viewMode: ViewMode;
  onSelectViewMode: (mode: ViewMode) => void;
  activeSession: VisitSession | null;
  actionsCount: number;
  themeMode: 'light' | 'dark';
  onToggleTheme: () => void;
  currentUserRole: UserRole;
  currentUserName: string;
  /** What the signed-in person may use; menus follow it. */
  can: Capabilities;
  onLogout: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
  viewMode,
  onSelectViewMode,
  activeSession,
  actionsCount,
  themeMode,
  onToggleTheme,
  currentUserRole,
  currentUserName,
  can,
  onLogout,
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
  onCloseMobile,
}) => {
  const answeredCount = activeSession
    ? Object.values(activeSession.responses).filter(
        (r) => r.answerState !== 'UNANSWERED'
      ).length
    : 0;
  const totalCount = activeSession?.indicators.length || 0;

  const handleNavClick = (mode: ViewMode) => {
    onSelectViewMode(mode);
    if (isMobileOpen) onCloseMobile();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          className="sidebar-mobile-backdrop"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        className={`app-sidebar ${isCollapsed ? 'collapsed' : ''} ${
          isMobileOpen ? 'mobile-open' : ''
        }`}
        aria-label="ناوبری اصلی سیستم"
      >
        {/* Sidebar Header: Brand Mark & Collapse Button */}
        <div className="sidebar-header">
          {!isCollapsed ? (
            <div className="sidebar-brand-full">
              <RetailSolutionsLogo
                variant={themeMode === 'dark' ? 'dark' : 'light'}
                colorScheme={themeMode}
                size="md"
                showSubbrand={true}
              />
            </div>
          ) : (
            <div
              className="sidebar-brand-mini"
              title="Retail Solutions — ارزیابی تجربه مشتری"
            >
              <span className="brand-logo-icon">RS</span>
            </div>
          )}

          {/* Desktop Collapse Toggle */}
          <button
            type="button"
            className="sidebar-toggle-btn desktop-only"
            onClick={onToggleCollapse}
            title={isCollapsed ? 'باز کردن سایدبار' : 'جمع کردن سایدبار'}
            aria-label={isCollapsed ? 'باز کردن منو' : 'جمع کردن منو'}
          >
            {isCollapsed ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
          </button>

          {/* Mobile Close Button */}
          <button
            type="button"
            className="sidebar-toggle-btn mobile-only"
            onClick={onCloseMobile}
            aria-label="بستن منو"
          >
            <X size={18} />
          </button>
        </div>

        {/* Active Session Mini Card (When Active) */}
        {activeSession && !isCollapsed && (
          <div className="sidebar-active-session-pill">
            <div className="session-pill-indicator" />
            <div className="session-pill-content">
              <span className="session-brand-title">
                {activeSession.brandName} • {activeSession.branchName}
              </span>
              <span className="session-progress-text ltr-num">
                {answeredCount}/{totalCount} شاخص پاسخ‌داده
              </span>
            </div>
          </div>
        )}

        {/* Navigation Sections */}
        <nav className="sidebar-nav-scroll">
          {/* GROUP 1: FIELD AUDIT */}
          <div className="sidebar-nav-group">
            {!isCollapsed && (
              <span className="sidebar-group-heading">ارزیابی میدانی</span>
            )}

            <button
              type="button"
              className={`sidebar-nav-item ${viewMode === 'LANDING' ? 'active' : ''}`}
              onClick={() => handleNavClick('LANDING')}
              title="صفحه اصلی"
            >
              <div className="nav-icon-wrap">
                <Home size={18} />
              </div>
              {!isCollapsed && <span className="nav-item-label">صفحه اصلی</span>}
            </button>

            {can.fieldWork && (
            <button
              type="button"
              className={`sidebar-nav-item ${viewMode === 'WIZARD' ? 'active' : ''}`}
              onClick={() => handleNavClick('WIZARD')}
              title="بازدید جدید"
            >
              <div className="nav-icon-wrap">
                <PlusCircle size={18} />
              </div>
              {!isCollapsed && <span className="nav-item-label">بازدید جدید</span>}
            </button>
            )}

            {activeSession && (
              <button
                type="button"
                className={`sidebar-nav-item ${viewMode === 'AUDIT' ? 'active' : ''}`}
                onClick={() => handleNavClick('AUDIT')}
                title="فرم ارزیابی"
              >
                <div className="nav-icon-wrap">
                  <ClipboardCheck size={18} />
                </div>
                {!isCollapsed && (
                  <>
                    <span className="nav-item-label">فرم ارزیابی</span>
                    <span className="nav-item-badge ltr-num">
                      {answeredCount}/{totalCount}
                    </span>
                  </>
                )}
              </button>
            )}

            {activeSession && (
              <button
                type="button"
                className={`sidebar-nav-item ${viewMode === 'REVIEW' ? 'active' : ''}`}
                onClick={() => handleNavClick('REVIEW')}
                title="کنترل کیفیت"
              >
                <div className="nav-icon-wrap">
                  <CheckCheck size={18} />
                </div>
                {!isCollapsed && <span className="nav-item-label">کنترل کیفیت</span>}
              </button>
            )}

            {activeSession && can.review && (
              <button
                type="button"
                className={`sidebar-nav-item ${viewMode === 'SUPERVISOR' ? 'active' : ''}`}
                onClick={() => handleNavClick('SUPERVISOR')}
                title="کارتابل سرپرست"
              >
                <div className="nav-icon-wrap">
                  <ShieldCheck size={18} />
                </div>
                {!isCollapsed && <span className="nav-item-label">کارتابل سرپرست</span>}
              </button>
            )}
          </div>

          <div className="sidebar-divider" />

          {(can.reports || can.fieldWork) && (
          <>
          {/* GROUP 2: INTELLIGENCE & REPORTING */}
          <div className="sidebar-nav-group">
            {!isCollapsed && (
              <span className="sidebar-group-heading">هوش تجاری و رادار</span>
            )}

            <button
              type="button"
              className={`sidebar-nav-item ${viewMode === 'REPORT' ? 'active' : ''}`}
              onClick={() => handleNavClick('REPORT')}
              title="گزارش و رادار ۳۶۰"
            >
              <div className="nav-icon-wrap">
                <BarChart3 size={18} />
              </div>
              {!isCollapsed && (
                <>
                  <span className="nav-item-label">گزارش و رادار</span>
                  {!activeSession && (
                    <span className="nav-item-tag">نمونه</span>
                  )}
                </>
              )}
            </button>

            <button
              type="button"
              className={`sidebar-nav-item ${viewMode === 'ARCHIVE' ? 'active' : ''}`}
              onClick={() => handleNavClick('ARCHIVE')}
              title="بایگانی پرسشنامه‌ها"
            >
              <div className="nav-icon-wrap">
                <Archive size={18} />
              </div>
              {!isCollapsed && <span className="nav-item-label">بایگانی بازدیدها</span>}
            </button>

            <button
              type="button"
              className={`sidebar-nav-item ${viewMode === 'REVISIT' ? 'active' : ''}`}
              onClick={() => handleNavClick('REVISIT')}
              title="مقایسه و بهبود"
            >
              <div className="nav-icon-wrap">
                <GitCompare size={18} />
              </div>
              {!isCollapsed && <span className="nav-item-label">مقایسه و روند</span>}
            </button>
          </div>

          <div className="sidebar-divider" />
          </>
          )}

          {can.actions && (
          <>
          {/* GROUP 3: ACTION MANAGEMENT */}
          <div className="sidebar-nav-group">
            {!isCollapsed && (
              <span className="sidebar-group-heading">چرخه بهبود مستمر</span>
            )}

            <button
              type="button"
              className={`sidebar-nav-item ${viewMode === 'ACTIONS' ? 'active' : ''}`}
              onClick={() => handleNavClick('ACTIONS')}
              title="اقدامات اصلاحی"
            >
              <div className="nav-icon-wrap">
                <Target size={18} />
              </div>
              {!isCollapsed && (
                <>
                  <span className="nav-item-label">اقدامات اصلاحی</span>
                  {actionsCount > 0 && (
                    <span className="nav-item-alert-badge ltr-num">
                      {actionsCount}
                    </span>
                  )}
                </>
              )}
            </button>
          </div>

          <div className="sidebar-divider" />
          </>
          )}

          {can.adminTools && (
          <>
          {/* GROUP 4: ADVANCED TOOLS */}
          <div className="sidebar-nav-group">
            {!isCollapsed && (
              <span className="sidebar-group-heading">تنظیمات و ابزارها</span>
            )}

            <button
              type="button"
              className={`sidebar-nav-item ${viewMode === 'CATALOG' ? 'active' : ''}`}
              onClick={() => handleNavClick('CATALOG')}
              title="بانک شاخص‌ها"
            >
              <div className="nav-icon-wrap">
                <Database size={18} />
              </div>
              {!isCollapsed && <span className="nav-item-label">بانک شاخص‌ها</span>}
            </button>

            <button
              type="button"
              className={`sidebar-nav-item ${viewMode === 'SCENARIOS' ? 'active' : ''}`}
              onClick={() => handleNavClick('SCENARIOS')}
              title="تست سناریوها"
            >
              <div className="nav-icon-wrap">
                <FlaskConical size={18} />
              </div>
              {!isCollapsed && <span className="nav-item-label">تست سناریوها</span>}
            </button>
                      {can.manageUsers && (
              <button
                type="button"
                className={`sidebar-nav-item ${viewMode === 'USERS' ? 'active' : ''}`}
                onClick={() => handleNavClick('USERS')}
                title="کاربران و دسترسی‌ها"
              >
                <div className="nav-icon-wrap">
                  <Users size={18} />
                </div>
                {!isCollapsed && <span className="nav-item-label">کاربران و دسترسی‌ها</span>}
              </button>
            )}
          </div>
          </>
          )}
        </nav>

        {/* Sidebar Footer: User Role & Theme Toggle */}
        <div className="sidebar-footer">
          {!isCollapsed ? (
            <>
              {/* User Role Card */}
              <div className="sidebar-user-card">
                <div className="user-avatar">
                  <UserCheck size={16} />
                </div>
                <div className="user-info">
                  <span className="user-name">{currentUserName}</span>
                  <span className="user-role-label">{ROLE_LABEL[currentUserRole as Role] || currentUserRole}</span>
                </div>
              </div>
              <div className="sidebar-account-actions">
                <button type="button" className="sidebar-account-btn" onClick={() => handleNavClick('PASSWORD')}>
                  <KeyRound size={14} />
                  <span>تغییر رمز</span>
                </button>
                <button type="button" className="sidebar-account-btn is-danger" onClick={onLogout}>
                  <LogOut size={14} />
                  <span>خروج</span>
                </button>
              </div>

              {/* Theme Toggle Button */}
              <button
                type="button"
                className="sidebar-theme-btn"
                onClick={onToggleTheme}
                aria-label="تغییر تم روز و شب"
              >
                {themeMode === 'light' ? (
                  <>
                    <Moon size={15} />
                    <span>حالت شب</span>
                  </>
                ) : (
                  <>
                    <Sun size={15} color="#FBBF24" />
                    <span>حالت روز</span>
                  </>
                )}
              </button>
            </>
          ) : (
            <div className="sidebar-footer-collapsed">
              <button
                type="button"
                className="sidebar-mini-icon-btn"
                onClick={onToggleTheme}
                title={themeMode === 'light' ? 'حالت شب' : 'حالت روز'}
                aria-label="تغییر تم"
              >
                {themeMode === 'light' ? <Moon size={16} /> : <Sun size={16} color="#FBBF24" />}
              </button>
              <button type="button" className="sidebar-mini-icon-btn" onClick={onLogout} title="خروج" aria-label="خروج">
                <LogOut size={16} />
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};

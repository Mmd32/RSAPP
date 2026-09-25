import React from 'react';
import {
  Home,
  PlusCircle,
  ClipboardCheck,
  BarChart3,
  Target,
  Menu,
  Archive,
} from 'lucide-react';
import { ViewMode } from './AppSidebar';
import { VisitSession } from '../../types';

interface MobileTabBarProps {
  viewMode: ViewMode;
  onSelectViewMode: (mode: ViewMode) => void;
  activeSession: VisitSession | null;
  actionsCount: number;
  onOpenMobileMenu: () => void;
  /** False for read-only roles, who get the archive and actions instead. */
  canFieldWork: boolean;
}

export const MobileTabBar: React.FC<MobileTabBarProps> = ({
  viewMode,
  onSelectViewMode,
  activeSession,
  actionsCount,
  onOpenMobileMenu,
  canFieldWork,
}) => {
  const answeredCount = activeSession
    ? Object.values(activeSession.responses).filter(
        (r) => r.answerState !== 'UNANSWERED'
      ).length
    : 0;
  const totalCount = activeSession?.indicators.length || 0;

  return (
    <nav className="mobile-bottom-tab-bar" aria-label="ناوبری سریع موبایل">
      {/* 1. HOME / LANDING */}
      <button
        type="button"
        className={`mobile-tab-btn ${viewMode === 'LANDING' ? 'active' : ''}`}
        onClick={() => onSelectViewMode('LANDING')}
        aria-label="صفحه اصلی"
      >
        <div className="mobile-tab-icon-wrap">
          <Home size={19} />
        </div>
        <span className="mobile-tab-label">خانه</span>
      </button>

      {canFieldWork ? (
        <>
      {/* 2. WIZARD */}
      <button
        type="button"
        className={`mobile-tab-btn ${viewMode === 'WIZARD' ? 'active' : ''}`}
        onClick={() => onSelectViewMode('WIZARD')}
        aria-label="بازدید جدید"
      >
        <div className="mobile-tab-icon-wrap">
          <PlusCircle size={19} />
        </div>
        <span className="mobile-tab-label">شروع جدید</span>
      </button>

      {/* 3. AUDIT (Active Form) */}
      <button
        type="button"
        className={`mobile-tab-btn ${viewMode === 'AUDIT' ? 'active' : ''} ${!activeSession ? 'disabled' : ''}`}
        onClick={() => activeSession && onSelectViewMode('AUDIT')}
        aria-label="فرم ارزیابی"
        disabled={!activeSession}
      >
        <div className="mobile-tab-icon-wrap">
          <ClipboardCheck size={19} />
          {activeSession && (
            <span className="mobile-tab-badge ltr-num">
              {answeredCount}/{totalCount}
            </span>
          )}
        </div>
        <span className="mobile-tab-label">فرم ارزیابی</span>
      </button>
        </>
      ) : (
        <>
      {/* 2-3. Read-only roles: archive and actions */}
      <button
        type="button"
        className={`mobile-tab-btn ${viewMode === 'ARCHIVE' ? 'active' : ''}`}
        onClick={() => onSelectViewMode('ARCHIVE')}
        aria-label="بایگانی"
      >
        <div className="mobile-tab-icon-wrap">
          <Archive size={19} />
        </div>
        <span className="mobile-tab-label">بایگانی</span>
      </button>
      <button
        type="button"
        className={`mobile-tab-btn ${viewMode === 'ACTIONS' ? 'active' : ''}`}
        onClick={() => onSelectViewMode('ACTIONS')}
        aria-label="اقدامات اصلاحی"
      >
        <div className="mobile-tab-icon-wrap">
          <Target size={19} />
          {actionsCount > 0 && <span className="mobile-tab-badge ltr-num">{actionsCount}</span>}
        </div>
        <span className="mobile-tab-label">اقدامات</span>
      </button>
        </>
      )}

      {/* 4. REPORT */}
      <button
        type="button"
        className={`mobile-tab-btn ${viewMode === 'REPORT' ? 'active' : ''}`}
        onClick={() => onSelectViewMode('REPORT')}
        aria-label="گزارش و رادار"
      >
        <div className="mobile-tab-icon-wrap">
          <BarChart3 size={19} />
        </div>
        <span className="mobile-tab-label">رادار ۳۶۰</span>
      </button>

      {/* 5. MENU / MORE */}
      <button
        type="button"
        className="mobile-tab-btn"
        onClick={onOpenMobileMenu}
        aria-label="منوی سایر امکانات"
      >
        <div className="mobile-tab-icon-wrap">
          <Menu size={19} />
          {actionsCount > 0 && (
            <span className="mobile-tab-alert-dot">{actionsCount}</span>
          )}
        </div>
        <span className="mobile-tab-label">منو</span>
      </button>
    </nav>
  );
};

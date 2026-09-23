import React from 'react';
import {
  PlusCircle,
  ClipboardCheck,
  BarChart3,
  Target,
  Menu,
} from 'lucide-react';
import { ViewMode } from './AppSidebar';
import { VisitSession } from '../../types';

interface MobileTabBarProps {
  viewMode: ViewMode;
  onSelectViewMode: (mode: ViewMode) => void;
  activeSession: VisitSession | null;
  actionsCount: number;
  onOpenMobileMenu: () => void;
}

export const MobileTabBar: React.FC<MobileTabBarProps> = ({
  viewMode,
  onSelectViewMode,
  activeSession,
  actionsCount,
  onOpenMobileMenu,
}) => {
  const answeredCount = activeSession
    ? Object.values(activeSession.responses).filter(
        (r) => r.answerState !== 'UNANSWERED'
      ).length
    : 0;
  const totalCount = activeSession?.indicators.length || 0;

  return (
    <nav className="mobile-bottom-tab-bar" aria-label="ناوبری سریع موبایل">
      {/* 1. WIZARD */}
      <button
        type="button"
        className={`mobile-tab-btn ${viewMode === 'WIZARD' ? 'active' : ''}`}
        onClick={() => onSelectViewMode('WIZARD')}
        aria-label="بازدید جدید"
      >
        <div className="mobile-tab-icon-wrap">
          <PlusCircle size={20} />
        </div>
        <span className="mobile-tab-label">شروع جدید</span>
      </button>

      {/* 2. AUDIT (Active Form) */}
      <button
        type="button"
        className={`mobile-tab-btn ${viewMode === 'AUDIT' ? 'active' : ''} ${!activeSession ? 'disabled' : ''}`}
        onClick={() => activeSession && onSelectViewMode('AUDIT')}
        aria-label="فرم ارزیابی"
        disabled={!activeSession}
      >
        <div className="mobile-tab-icon-wrap">
          <ClipboardCheck size={20} />
          {activeSession && (
            <span className="mobile-tab-badge ltr-num">
              {answeredCount}/{totalCount}
            </span>
          )}
        </div>
        <span className="mobile-tab-label">فرم ارزیابی</span>
      </button>

      {/* 3. REPORT */}
      <button
        type="button"
        className={`mobile-tab-btn ${viewMode === 'REPORT' ? 'active' : ''}`}
        onClick={() => onSelectViewMode('REPORT')}
        aria-label="گزارش و رادار"
      >
        <div className="mobile-tab-icon-wrap">
          <BarChart3 size={20} />
        </div>
        <span className="mobile-tab-label">رادار ۳۶۰</span>
      </button>

      {/* 4. ACTIONS */}
      <button
        type="button"
        className={`mobile-tab-btn ${viewMode === 'ACTIONS' ? 'active' : ''}`}
        onClick={() => onSelectViewMode('ACTIONS')}
        aria-label="اقدامات اصلاحی"
      >
        <div className="mobile-tab-icon-wrap">
          <Target size={20} />
          {actionsCount > 0 && (
            <span className="mobile-tab-alert-dot">{actionsCount}</span>
          )}
        </div>
        <span className="mobile-tab-label">اقدامات</span>
      </button>

      {/* 5. MENU / MORE */}
      <button
        type="button"
        className="mobile-tab-btn"
        onClick={onOpenMobileMenu}
        aria-label="منوی سایر امکانات"
      >
        <div className="mobile-tab-icon-wrap">
          <Menu size={20} />
        </div>
        <span className="mobile-tab-label">سایر</span>
      </button>
    </nav>
  );
};

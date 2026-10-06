import React, { useState, useMemo, useEffect } from 'react';
import { Indicator } from '../types';
import { Database, Filter, CheckCircle, AlertTriangle, Layers, Plus } from 'lucide-react';
import { stageLabel, groupLabel, faDigits } from '../utils/format';

interface AdminQuestionBankProps {
  indicators: Indicator[];
}

const PAGE_SIZE = 100;

export const AdminQuestionBank: React.FC<AdminQuestionBankProps> = ({ indicators }) => {
  const [templateFilter, setTemplateFilter] = useState<'ALL' | 'STORE' | 'MALL'>('ALL');
  const [selectedGroup, setSelectedGroup] = useState<string>('ALL');
  const [filterNeedsReview, setFilterNeedsReview] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedIndicator, setSelectedIndicator] = useState<Indicator | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  // A new filter starts from the first page again.
  useEffect(() => setVisibleCount(PAGE_SIZE), [templateFilter, selectedGroup, filterNeedsReview, searchQuery]);

  // Extract unique groups
  const groups = useMemo(() => {
    const set = new Set<string>();
    indicators.forEach((i) => set.add(i.group));
    return Array.from(set);
  }, [indicators]);

  const filteredIndicators = useMemo(() => {
    return indicators.filter((ind) => {
      if (templateFilter !== 'ALL' && ind.template !== templateFilter) return false;
      if (selectedGroup !== 'ALL' && ind.group !== selectedGroup) return false;
      if (filterNeedsReview && !ind.needsReview) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const codeMatch = ind.code.toLowerCase().includes(q);
        const subjMatch = ind.subject.toLowerCase().includes(q);
        const stmtMatch = ind.statement.toLowerCase().includes(q);
        if (!codeMatch && !subjMatch && !stmtMatch) return false;
      }
      return true;
    });
  }, [indicators, templateFilter, selectedGroup, filterNeedsReview, searchQuery]);

  return (
    <div style={{ maxWidth: 1040, margin: '20px auto', padding: '0 16px 40px' }}>
      {/* Header */}
      <div className="glass-panel" style={{ padding: 24, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Database color="var(--rs-color-brand-cyan)" size={24} />
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 700 }}>بانک مرکزی شاخص‌ها و موتور قوانین</h2>
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                مدیریت {indicators.length} شاخص استخراج‌شده از فایلهای مرجع اکسل بدون نیاز به تغییر در کد
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: 'var(--rs-color-brand-cyan)',
                background: 'rgba(0, 176, 240, 0.12)',
                padding: '6px 12px',
                borderRadius: 'var(--rs-radius-control)',
                border: '1px solid rgba(0, 176, 240, 0.25)',
              }}
            >
              ۲۵۵ فروشگاه • ۲۲۶ مرکز خرید
            </span>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginTop: 20 }}>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-dim)', display: 'block', marginBottom: 4 }}>خانواده ارزیابی:</label>
            <select
              className="friction-textarea"
              style={{ minHeight: 38, padding: '6px 10px', fontSize: 12 }}
              value={templateFilter}
              onChange={(e) => setTemplateFilter(e.target.value as any)}
            >
              <option value="ALL">همه خانواده‌ها</option>
              <option value="STORE">فروشگاه</option>
              <option value="MALL">مرکز خرید</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: 11, color: 'var(--text-dim)', display: 'block', marginBottom: 4 }}>گروه کلان:</label>
            <select
              className="friction-textarea"
              style={{ minHeight: 38, padding: '6px 10px', fontSize: 12 }}
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
            >
              <option value="ALL">همه گروه‌ها</option>
              {groups.map((g) => (
                <option key={g} value={g}>{groupLabel(g)}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: 11, color: 'var(--text-dim)', display: 'block', marginBottom: 4 }}>جستجو:</label>
            <input
              type="text"
              className="friction-textarea"
              style={{ minHeight: 38, padding: '6px 10px', fontSize: 12 }}
              placeholder="جستجو با کد یا متن..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 6 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer', color: 'var(--text-muted)' }}>
              <input
                type="checkbox"
                checked={filterNeedsReview}
                onChange={(e) => setFilterNeedsReview(e.target.checked)}
                style={{ accentColor: 'var(--rs-color-warning)' }}
              />
              <span>فقط موارد نیازمند بازبینی</span>
            </label>
          </div>
        </div>
      </div>

      {/* Indicators Table */}
      <div className="glass-panel" style={{ padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            نمایش <strong style={{ color: 'var(--theme-text-primary)' }}>{filteredIndicators.length}</strong> شاخص از مجموع {indicators.length}
          </span>
        </div>

        <div style={{ overflowX: 'auto', maxHeight: '600px' }}>
          <table style={{ width: '100%', minWidth: 720, borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--theme-card-border)', color: 'var(--text-muted)', position: 'sticky', top: 0, background: 'var(--surface-sunken)' }}>
                <th style={{ textAlign: 'right', padding: '10px 8px' }}>کد شاخص</th>
                <th style={{ textAlign: 'right', padding: '10px 8px' }}>گروه و موضوع</th>
                <th style={{ textAlign: 'right', padding: '10px 8px' }}>متن استاندارد KPI</th>
                <th style={{ textAlign: 'center', padding: '10px 8px' }}>مرحله سفر</th>
                <th style={{ textAlign: 'center', padding: '10px 8px' }}>وزن</th>
                <th style={{ textAlign: 'center', padding: '10px 8px' }}>عکس</th>
              </tr>
            </thead>
            <tbody>
              {filteredIndicators.slice(0, visibleCount).map((ind) => (
                <tr
                  key={ind.id}
                  style={{ borderBottom: '1px solid var(--theme-card-border)', cursor: 'pointer', transition: 'background var(--rs-duration-micro) var(--rs-ease-standard)' }}
                  onClick={() => setSelectedIndicator(ind)}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0, 176, 240, 0.06)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '10px 8px' }}>
                    <span className="indicator-code-badge">{ind.code}</span>
                  </td>
                  <td style={{ padding: '10px 8px' }}>
                    <div style={{ fontWeight: 600 }}>{ind.subject}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{groupLabel(ind.group)}</div>
                  </td>
                  <td style={{ padding: '10px 8px', maxWidth: 360, color: 'var(--text-main)', lineHeight: 1.5 }}>
                    {ind.statement}
                  </td>
                  <td style={{ textAlign: 'center', padding: '10px 8px', fontSize: 11, color: 'var(--rs-color-brand-cyan)' }}>
                    {stageLabel(ind.journeyStage)}
                  </td>
                  <td style={{ textAlign: 'center', padding: '10px 8px', fontFamily: 'var(--rs-font-en)' }}>
                    {ind.weight}
                  </td>
                  <td style={{ textAlign: 'center', padding: '10px 8px' }}>
                    {ind.requiresPhoto ? (
                      <span style={{ color: 'var(--rs-color-error)', fontSize: 11, fontWeight: 700 }}>الزامی</span>
                    ) : (
                      <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>اختیاری</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredIndicators.length > visibleCount && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}>
            <button type="button" className="btn-secondary" onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}>
              نمایش {faDigits(Math.min(PAGE_SIZE, filteredIndicators.length - visibleCount))} شاخص دیگر (
              {faDigits(filteredIndicators.length - visibleCount)} باقی‌مانده)
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

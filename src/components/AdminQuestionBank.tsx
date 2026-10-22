import React, { useState, useMemo, useEffect } from 'react';
import { Indicator } from '../types';
import { Database, Filter, CheckCircle, AlertTriangle, Layers, Plus, FileSpreadsheet } from 'lucide-react';
import { stageLabel, groupLabel, faDigits, profileLabel } from '../utils/format';
import { IndicatorEditor, IndicatorForm } from './IndicatorEditor';
import { IndicatorExcel } from './IndicatorExcel';
import type { IndicatorEdit, CustomIndicatorInput } from '../services/indicatorService';

/** The five store zones and the thirteen retail sectors of the FR model. */
const STORE_ZONES = ['FLOOR', 'SERVICES', 'TEAM', 'PRODUCT', 'CASH'];
const RETAIL_SECTORS = [
  'Fashion', 'Shoe_Bag', 'Watch_Jewelry', 'FMCG', 'F_B', 'Hardware', 'Homeware',
  'Beauty_Cosmetics', 'Electronics', 'Entertainment', 'Sports', 'Specialty', 'Services',
];

/**
 * Indicators per zone for each retail sector, straight from the catalog. A
 * visit narrows this further by the store's features (fitting room, parking,
 * ...), so a store's own counts come from its visit, shown in its report.
 */
const SectorZoneMatrix: React.FC<{ indicators: Indicator[] }> = ({ indicators }) => {
  const store = indicators.filter((i) => i.template === 'STORE' && i.status !== 'ARCHIVED');
  const rows = RETAIL_SECTORS.map((sector) => {
    const applicable = store.filter(
      (i) => !i.applicableBusinessTypes?.length || i.applicableBusinessTypes.includes(sector),
    );
    return { sector, counts: STORE_ZONES.map((z) => applicable.filter((i) => i.group === z).length), total: applicable.length };
  });
  if (!store.length) return null;
  return (
    <section className="fr-card" aria-labelledby="sector-zone-title">
      <header className="fr-card__header">
        <div>
          <h3 id="sector-zone-title" className="fr-card__title">شاخص‌های هر منطقه به تفکیک سکتور ریتیل</h3>
          <p className="fr-card__subtitle">
            تعداد شاخص‌های بانک برای هر سکتور در پنج منطقه‌ی فروشگاه. در هر بازدید، این تعداد بر اساس ویژگی‌های فروشگاه
            (اتاق پرو، پارکینگ و …) کمتر می‌شود و عدد دقیق هر فروشگاه در گزارش همان بازدید آمده است.
          </p>
        </div>
      </header>
      <div className="fr-table-wrap">
        <table className="fr-table">
          <thead>
            <tr>
              <th scope="col">سکتور</th>
              {STORE_ZONES.map((z) => (
                <th key={z} scope="col">{groupLabel(z)}</th>
              ))}
              <th scope="col">جمع</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.sector}>
                <th scope="row">{profileLabel(r.sector)}</th>
                {r.counts.map((c, i) => (
                  <td key={STORE_ZONES[i]} className="ltr-num">{faDigits(c)}</td>
                ))}
                <td className="ltr-num fr-table__rate">{faDigits(r.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};

interface AdminQuestionBankProps {
  /** The checklist with edits applied: what questionnaires are built from. */
  indicators: Indicator[];
  /** The checklist as the file has it, to show what an edit changed. */
  baseIndicators?: Indicator[];
  canEdit?: boolean;
  onSaveIndicator?: (id: string, edit: IndicatorEdit) => Promise<void>;
  onResetIndicator?: (id: string) => Promise<void>;
  onCreateIndicator?: (input: CustomIndicatorInput) => Promise<void>;
  onUpdateCustom?: (id: string, input: CustomIndicatorInput) => Promise<void>;
  onDeleteCustom?: (id: string) => Promise<void>;
  onReload?: () => Promise<void>;
}

const PAGE_SIZE = 100;

/**
 * Pivot of the store checklist: zone → topic, with the number of KPIs and
 * their codes, for one sector or for all. Answers "which indicator belongs
 * where" at a glance.
 */
const IndicatorPivot: React.FC<{ indicators: Indicator[] }> = ({ indicators }) => {
  const [sector, setSector] = useState<string>('ALL');
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const rows = useMemo(() => {
    const store = indicators.filter(
      (i) =>
        i.template === 'STORE' &&
        i.status !== 'ARCHIVED' &&
        (sector === 'ALL' || !i.applicableBusinessTypes?.length || i.applicableBusinessTypes.includes(sector)),
    );
    return STORE_ZONES.map((zone) => {
      const inZone = store.filter((i) => i.group === zone).sort((a, b) => a.displayOrder - b.displayOrder);
      const topics = new Map<string, Indicator[]>();
      for (const i of inZone) {
        const key = i.subject || '—';
        if (!topics.has(key)) topics.set(key, []);
        topics.get(key)!.push(i);
      }
      return { zone, count: inZone.length, topics: [...topics.entries()] };
    });
  }, [indicators, sector]);
  const total = rows.reduce((n, r) => n + r.count, 0);
  if (!total && sector === 'ALL') return null;
  const toggle = (zone: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(zone)) next.delete(zone);
      else next.add(zone);
      return next;
    });

  return (
    <section className="fr-card" aria-labelledby="pivot-title">
      <header className="fr-card__header">
        <div>
          <h3 id="pivot-title" className="fr-card__title">جدول محوری شاخص‌ها (منطقه ← موضوع ← کد)</h3>
          <p className="fr-card__subtitle">
            هر شاخص (KPI) کد ثابت خود را دارد و به یک موضوع در یکی از پنج منطقه تعلق دارد. روی هر منطقه بزنید تا موضوع‌ها و
            کدهایش را ببینید.
          </p>
        </div>
        <label className="business-brand">
          <span>سکتور</span>
          <select className="select-rs" value={sector} onChange={(e) => setSector(e.target.value)}>
            <option value="ALL">همه‌ی سکتورها</option>
            {RETAIL_SECTORS.map((s) => (
              <option key={s} value={s}>
                {profileLabel(s)}
              </option>
            ))}
          </select>
        </label>
      </header>
      <div className="fr-table-wrap">
        <table className="fr-table pivot-table">
          <thead>
            <tr>
              <th scope="col">منطقه / موضوع</th>
              <th scope="col">تعداد KPI</th>
              <th scope="col">کدها</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <React.Fragment key={r.zone}>
                <tr className="pivot-zone">
                  <th scope="row">
                    <button type="button" className="pivot-toggle" aria-expanded={open.has(r.zone)} onClick={() => toggle(r.zone)}>
                      <span className="fr-swatch" style={{ background: `var(--zone-${r.zone})` }} aria-hidden="true" />
                      {groupLabel(r.zone)}
                      <span className="pivot-caret" aria-hidden="true">{open.has(r.zone) ? '−' : '+'}</span>
                    </button>
                  </th>
                  <td className="ltr-num fr-table__rate">{faDigits(r.count)}</td>
                  <td className="pivot-muted">{faDigits(r.topics.length)} موضوع</td>
                </tr>
                {open.has(r.zone) &&
                  r.topics.map(([topic, items]) => (
                    <tr key={topic} className="pivot-topic">
                      <th scope="row">{topic}</th>
                      <td className="ltr-num">{faDigits(items.length)}</td>
                      <td>
                        <span className="pivot-codes" dir="ltr">
                          {items.map((i) => i.code).join(' · ')}
                        </span>
                      </td>
                    </tr>
                  ))}
              </React.Fragment>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">جمع کل</th>
              <td className="ltr-num">{faDigits(total)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
};

export const AdminQuestionBank: React.FC<AdminQuestionBankProps> = ({
  indicators: allIndicators,
  baseIndicators = [],
  canEdit = false,
  onSaveIndicator,
  onResetIndicator,
  onCreateIndicator,
  onUpdateCustom,
  onDeleteCustom,
  onReload,
}) => {
  // Archived indicators are kept for old visits only; rows switched off by hand stay listed so they can be switched on again.
  const indicators = useMemo(() => allIndicators.filter((i) => i.status !== 'ARCHIVED' || i.disabled), [allIndicators]);
  const activeIndicators = useMemo(() => indicators.filter((i) => !i.disabled), [indicators]);
  const storeCount = activeIndicators.filter((i) => i.template === 'STORE').length;
  const mallCount = activeIndicators.filter((i) => i.template === 'MALL').length;
  const addedCount = indicators.filter((i) => i.custom).length;
  const disabledCount = indicators.filter((i) => i.disabled).length;
  const [creating, setCreating] = useState(false);
  const [excelOpen, setExcelOpen] = useState(false);
  const [onlyAdded, setOnlyAdded] = useState(false);
  const editedCount = indicators.filter((i) => i.edited).length;
  const noteCount = indicators.filter((i) => i.auditorNote).length;
  const [templateFilter, setTemplateFilter] = useState<'ALL' | 'STORE' | 'MALL'>('ALL');
  const [selectedGroup, setSelectedGroup] = useState<string>('ALL');
  const [onlyEdited, setOnlyEdited] = useState<boolean>(false);
  const [onlyWithNote, setOnlyWithNote] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  // A new filter starts from the first page again.
  useEffect(() => setVisibleCount(PAGE_SIZE), [templateFilter, selectedGroup, onlyEdited, onlyWithNote, onlyAdded, searchQuery]);

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
      if (onlyEdited && !ind.edited) return false;
      if (onlyWithNote && !ind.auditorNote) return false;
      if (onlyAdded && !ind.custom) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const codeMatch = ind.code.toLowerCase().includes(q);
        const subjMatch = ind.subject.toLowerCase().includes(q);
        const stmtMatch = ind.statement.toLowerCase().includes(q);
        if (!codeMatch && !subjMatch && !stmtMatch) return false;
      }
      return true;
    });
  }, [indicators, templateFilter, selectedGroup, onlyEdited, onlyWithNote, onlyAdded, searchQuery]);

  // Previous / next in the editor follow the list as currently filtered.
  const selectedPosition = selectedId ? filteredIndicators.findIndex((i) => i.id === selectedId) : -1;
  const selected = selectedPosition >= 0 ? filteredIndicators[selectedPosition] : null;

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
                مدیریت {faDigits(activeIndicators.length)} شاخص فعال بدون نیاز به تغییر در کد
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {onReload && (
              <button type="button" className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 38, padding: '0 14px' }} onClick={() => setExcelOpen(true)}>
                <FileSpreadsheet size={16} />
                <span>اکسل</span>
              </button>
            )}
            {canEdit && onCreateIndicator && (
              <button type="button" className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 38, padding: '0 14px' }} onClick={() => setCreating(true)}>
                <Plus size={16} />
                <span>افزودن شاخص جدید</span>
              </button>
            )}
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
              {faDigits(storeCount)} فروشگاه • {faDigits(mallCount)} مرکز خرید
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

          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, paddingBottom: 6, flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer', color: 'var(--text-muted)' }}>
              <input type="checkbox" checked={onlyEdited} onChange={(e) => setOnlyEdited(e.target.checked)} />
              <span>فقط ویرایش‌شده‌ها ({faDigits(editedCount)})</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer', color: 'var(--text-muted)' }}>
              <input type="checkbox" checked={onlyWithNote} onChange={(e) => setOnlyWithNote(e.target.checked)} />
              <span>فقط دارای نکته برای ارزیاب ({faDigits(noteCount)})</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer', color: 'var(--text-muted)' }}>
              <input type="checkbox" checked={onlyAdded} onChange={(e) => setOnlyAdded(e.target.checked)} />
              <span>فقط افزوده‌شده‌ها ({faDigits(addedCount)}){disabledCount ? ` • غیرفعال: ${faDigits(disabledCount)}` : ''}</span>
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
                <th style={{ textAlign: 'center', padding: '10px 8px' }}>عکس</th>
                <th style={{ textAlign: 'center', padding: '10px 8px' }}>{canEdit ? 'ویرایش' : 'جزئیات'}</th>
              </tr>
            </thead>
            <tbody>
              {filteredIndicators.slice(0, visibleCount).map((ind) => (
                <tr
                  key={ind.id}
                  style={{ borderBottom: '1px solid var(--theme-card-border)', cursor: 'pointer', transition: 'background var(--rs-duration-micro) var(--rs-ease-standard)' }}
                  onClick={() => setSelectedId(ind.id)}
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
                    {(ind.edited || ind.auditorNote || ind.custom || ind.disabled) && (
                      <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                        {ind.custom && <span className="ie-chip">افزوده‌شده</span>}
                        {ind.edited && <span className="ie-chip">ویرایش‌شده</span>}
                        {ind.disabled && <span className="ie-chip ie-chip--off">غیرفعال</span>}
                        {ind.auditorNote && <span className="ie-chip ie-chip--note" title={ind.auditorNote}>دارای نکته</span>}
                      </div>
                    )}
                  </td>
                  <td style={{ textAlign: 'center', padding: '10px 8px', fontSize: 11, color: 'var(--rs-color-brand-cyan)' }}>
                    {stageLabel(ind.journeyStage)}
                  </td>
                  <td style={{ textAlign: 'center', padding: '10px 8px' }}>
                    {ind.requiresPhoto ? (
                      <span style={{ color: 'var(--rs-color-error)', fontSize: 11, fontWeight: 700 }}>الزامی</span>
                    ) : (
                      <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>اختیاری</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'center', padding: '10px 8px' }}>
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ minHeight: 30, padding: '0 12px', fontSize: 12 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedId(ind.id);
                      }}
                    >
                      {canEdit ? 'ویرایش' : 'نمایش'}
                    </button>
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

      <SectorZoneMatrix indicators={indicators} />
      <IndicatorPivot indicators={indicators} />

      {excelOpen && onReload && (
        <IndicatorExcel indicators={indicators} canEdit={canEdit} onChanged={onReload} onClose={() => setExcelOpen(false)} />
      )}
      {creating && onCreateIndicator && onUpdateCustom && onDeleteCustom && (
        <IndicatorForm
          all={indicators}
          onCreate={onCreateIndicator}
          onUpdate={onUpdateCustom}
          onDelete={onDeleteCustom}
          onClose={() => setCreating(false)}
        />
      )}
      {selected && selected.custom && canEdit && onUpdateCustom && onDeleteCustom && onCreateIndicator && (
        <IndicatorForm
          key={selected.id}
          indicator={selected}
          all={indicators}
          onCreate={onCreateIndicator}
          onUpdate={onUpdateCustom}
          onDelete={onDeleteCustom}
          onClose={() => setSelectedId(null)}
        />
      )}
      {selected && !(selected.custom && canEdit) && (
        <IndicatorEditor
          indicator={selected}
          original={baseIndicators.find((i) => i.id === selected.id) || selected}
          position={selectedPosition + 1}
          total={filteredIndicators.length}
          canEdit={canEdit && !!onSaveIndicator && !!onResetIndicator}
          onSave={async (id, edit) => onSaveIndicator?.(id, edit)}
          onReset={async (id) => onResetIndicator?.(id)}
          onMove={(step) => {
            const next = filteredIndicators[selectedPosition + step];
            if (next) setSelectedId(next.id);
          }}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
};

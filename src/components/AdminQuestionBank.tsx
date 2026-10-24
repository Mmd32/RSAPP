import React, { useState, useMemo, useEffect } from 'react';
import { Indicator, LocationContextCode } from '../types';
import { generateDynamicChecklistWithAudit } from '../engine/ruleEngine';
import { Database, Filter, CheckCircle, AlertTriangle, Layers, Plus, FileSpreadsheet, Trash2 } from 'lucide-react';
import { groupLabel, faDigits, profileLabel } from '../utils/format';
import { nameKey } from '../engine/frModel';
import { PHOTOS_REQUIRED } from '../config/policy';
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
  /** True once every indicator of the checklist file has been removed. */
  cleared?: boolean;
  onClearAll?: () => Promise<void>;
  onRestoreChecklist?: () => Promise<void>;
}

const PAGE_SIZE = 100;

/** The formats a store can have (the "where is it" step of a new visit). */
const FORMATS: { code: LocationContextCode; label: string }[] = [
  { code: 'STREET_STORE', label: 'فروشگاه واقع در خیابان' },
  { code: 'MALL_STORE', label: 'فروشگاه داخل مرکز خرید' },
  { code: 'SHOP_IN_SHOP', label: 'شاپ این شاپ' },
  { code: 'KIOSK', label: 'کیوسک / پاپ‌آپ' },
];

/** The facilities a new visit asks about; each switches some indicators off when missing. */
const FEATURES: { key: string; compat?: string; label: string }[] = [
  { key: 'has_window_display', compat: 'hasShowcase', label: 'ویترین شیشه‌ای و مانکن رو به بیرون' },
  { key: 'has_fitting_room', compat: 'hasFittingRoom', label: 'اتاق پرو' },
  { key: 'has_mannequins', compat: 'hasMannequins', label: 'مانکن‌های نمایشی داخل فروشگاه' },
  { key: 'has_elevator', compat: 'hasElevator', label: 'آسانسور، پله‌برقی یا پله داخلی' },
  { key: 'has_parking', compat: 'hasParking', label: 'پارکینگ اختصاصی' },
  { key: 'has_customer_toilet', compat: 'hasCustomerToilet', label: 'سرویس بهداشتی مشتریان' },
  { key: 'has_checkout_counter', label: 'صندوق' },
  { key: 'has_anti_theft_gate', label: 'گیت دزدگیر' },
];

/**
 * Pivot of the store checklist: zone → topic → code. Choose the sector (as in a
 * new visit) and the table shows, per topic, how many indicators the checklist
 * file gives that sector, and how many are asked in each store format
 * (street store, inside a mall, shop-in-shop, kiosk) given the facilities
 * ticked below. Any column can be clicked to sort by it.
 */
const IndicatorPivot: React.FC<{ indicators: Indicator[]; cleared?: boolean; onRestore?: () => void }> = ({ indicators, cleared = false, onRestore }) => {
  const [sector, setSector] = useState<string>('Fashion');
  const [features, setFeatures] = useState<Record<string, boolean>>(() => Object.fromEntries(FEATURES.map((f) => [f.key, true])));
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null);
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const [format, setFormat] = useState<string>('ALL');

  const store = useMemo(
    () => indicators.filter((i) => i.template === 'STORE' && i.status !== 'ARCHIVED'),
    [indicators],
  );
  // Indicators the workbook marks for the sector (all of them for "all sectors").
  const inSector = useMemo(
    () => store.filter((i) => sector === 'ALL' || !i.applicableBusinessTypes?.length || i.applicableBusinessTypes.includes(sector)),
    [store, sector],
  );
  // The sector has its own checklist file per store format (Fashion): the format's X decides, not the facilities.
  const hasFormatFiles = sector !== 'ALL' && inSector.some((i) => i.applicableFormats?.length);
  const activeFormat = hasFormatFiles ? format : 'ALL';
  // Per format: the ids the questionnaire would ask, by the same rules a new visit uses.
  const askedIn = useMemo(() => {
    const attributes: Record<string, boolean> = {};
    for (const f of FEATURES) {
      attributes[f.key] = !!features[f.key];
      if (f.compat) attributes[f.compat] = !!features[f.key];
    }
    const out = new Map<string, Set<string>>();
    if (sector === 'ALL') return out;
    for (const format of FORMATS) {
      const { indicators: asked } = generateDynamicChecklistWithAudit(store, {
        assessmentType: 'STORE',
        businessType: sector as any,
        locationContext: format.code,
        brand: '',
        branch: '',
        attributes,
      } as any);
      out.set(format.code, new Set(asked.map((i) => i.id)));
    }
    return out;
  }, [store, sector, features]);

  const ofSector = useMemo(
    () => (activeFormat === 'ALL' ? inSector : inSector.filter((i) => askedIn.get(activeFormat)?.has(i.id))),
    [inSector, activeFormat, askedIn],
  );

  const countOf = (items: Indicator[], format: string) => (format === 'total' ? items.length : items.filter((i) => askedIn.get(format)?.has(i.id)).length);

  const rows = useMemo(() => {
    const zones = STORE_ZONES.map((zone) => {
      const inZone = ofSector.filter((i) => i.group === zone).sort((a, b) => a.displayOrder - b.displayOrder);
      const topics = new Map<string, Indicator[]>();
      for (const i of inZone) {
        const key = i.subject || '—';
        if (!topics.has(key)) topics.set(key, []);
        topics.get(key)!.push(i);
      }
      let list = [...topics.entries()];
      if (sort) {
        const dir = sort.dir === 'asc' ? 1 : -1;
        list = list.sort((a, b) =>
          sort.key === 'name' ? a[0].localeCompare(b[0], 'fa') * dir : (countOf(a[1], sort.key) - countOf(b[1], sort.key)) * dir,
        );
      }
      return { zone, items: inZone, topics: list };
    });
    if (sort && sort.key !== 'name') {
      const dir = sort.dir === 'asc' ? 1 : -1;
      zones.sort((a, b) => (countOf(a.items, sort.key) - countOf(b.items, sort.key)) * dir);
    }
    return zones;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ofSector, sort, askedIn]);
  if (!store.length) return null;

  const toggleZone = (zone: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(zone)) next.delete(zone);
      else next.add(zone);
      return next;
    });
  const sortBy = (key: string) => setSort((cur) => (cur?.key === key ? (cur.dir === 'desc' ? { key, dir: 'asc' } : null) : { key, dir: 'desc' }));
  const arrow = (key: string) => (sort?.key === key ? (sort.dir === 'desc' ? ' ▼' : ' ▲') : '');
  const head = (key: string, label: React.ReactNode) => (
    <th scope="col" aria-sort={sort?.key === key ? (sort.dir === 'desc' ? 'descending' : 'ascending') : 'none'}>
      <button type="button" className="pivot-sort" onClick={() => sortBy(key)}>{label}{arrow(key)}</button>
    </th>
  );
  const formatCols = sector === 'ALL' || activeFormat !== 'ALL' ? [] : FORMATS;

  return (
    <section className="fr-card" aria-labelledby="pivot-title">
      <header className="fr-card__header">
        <div>
          <h3 id="pivot-title" className="fr-card__title">جدول محوری شاخص‌ها (منطقه ← موضوع ← کد)</h3>
          <p className="fr-card__subtitle">
            سکتور را انتخاب کنید. «کل» تعداد شاخص‌های فایل چک‌لیست برای آن سکتور است و هر ستون فرمت، تعداد شاخص‌هایی که در همان فرمت پرسیده می‌شود. برای پوشاک هر قالب فایل اکسل خودش را دارد؛ قالب را انتخاب کنید تا فقط موضوع‌ها و کدهای همان قالب دیده شود (برای سایر سکتورها امکانات تیک‌خورده اثر دارد). روی عنوان ستون‌ها بزنید تا مرتب شوند؛ روی هر منطقه بزنید تا موضوع‌ها و کدها را ببینید.
          </p>
        </div>
        <label className="business-brand">
          <span>سکتور</span>
          <select className="select-rs" value={sector} onChange={(e) => setSector(e.target.value)}>
            <option value="ALL">همه‌ی سکتورها</option>
            {RETAIL_SECTORS.map((s) => (
              <option key={s} value={s}>{profileLabel(s)}</option>
            ))}
          </select>
        </label>
      </header>

      <p className="pivot-muted" dir="ltr" style={{ margin: '0 0 8px' }}>
        build {__APP_BUILD__} · formats-aware catalog: {store.filter((i) => i.applicableFormats?.length).length} rows · custom rows: {store.filter((i) => i.custom).length} · catalog cleared: {cleared ? 'yes' : 'no'}
      </p>

      {sector !== 'ALL' && !hasFormatFiles && sector === 'Fashion' && (
        <div className="glass-panel" style={{ padding: 12, marginBottom: 12, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13 }}>
            شاخص‌های پوشاک در این حساب از فایل‌های قالب (کیوسک، شاپ این شاپ، مرکز خرید، خیابان) نیستند؛ چک‌لیست اصلی{cleared ? ' حذف شده است' : ' در این لیست نیست'}. برای دیدن فهرست هر قالب، چک‌لیست اصلی را برگردانید.
          </span>
          {onRestore && (
            <button type="button" className="btn-secondary" onClick={onRestore}>بازگرداندن چک‌لیست اصلی</button>
          )}
        </div>
      )}

      {hasFormatFiles && (
        <div className="pivot-features">
          <span className="ie-label">قالب فروشگاه (شاخص‌ها دقیقاً از فایل اکسل همان قالب)</span>
          <div className="ie-checks">
            {[{ code: 'ALL', label: 'همه قالب‌ها' }, ...FORMATS].map((f) => (
              <label key={f.code} className="ie-check">
                <input type="radio" name="pivot-format" checked={activeFormat === f.code} onChange={() => setFormat(f.code)} />
                <span>{f.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {sector !== 'ALL' && !hasFormatFiles && (
        <fieldset className="pivot-features">
          <legend className="ie-label">امکانات فروشگاه (مثل مرحلهٔ «امکانات فیزیکی» بازدید جدید)</legend>
          <div className="ie-checks">
            {FEATURES.map((f) => (
              <label key={f.key} className="ie-check">
                <input type="checkbox" checked={!!features[f.key]} onChange={(e) => setFeatures((cur) => ({ ...cur, [f.key]: e.target.checked }))} />
                <span>{f.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <div className="fr-table-wrap">
        <table className="fr-table pivot-table">
          <thead>
            <tr>
              {head('name', 'منطقه / موضوع')}
              {head('total', activeFormat === 'ALL' ? (hasFormatFiles ? 'همه قالب‌ها (اجتماع فایل‌ها)' : 'کل (بر اساس اکسل)') : 'شاخص‌های این قالب')}
              {formatCols.map((f) => head(f.code, f.label))}
              <th scope="col">کدها</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <React.Fragment key={r.zone}>
                <tr className="pivot-zone">
                  <th scope="row">
                    <button type="button" className="pivot-toggle" aria-expanded={open.has(r.zone)} onClick={() => toggleZone(r.zone)}>
                      <span className="fr-swatch" style={{ background: `var(--zone-${r.zone})` }} aria-hidden="true" />
                      {groupLabel(r.zone)}
                      <span className="pivot-caret" aria-hidden="true">{open.has(r.zone) ? '−' : '+'}</span>
                    </button>
                  </th>
                  <td className="ltr-num fr-table__rate">{faDigits(r.items.length)}</td>
                  {formatCols.map((f) => (
                    <td key={f.code} className="ltr-num">{faDigits(countOf(r.items, f.code))}</td>
                  ))}
                  <td className="pivot-muted">{faDigits(r.topics.length)} موضوع</td>
                </tr>
                {open.has(r.zone) &&
                  r.topics.map(([topic, items]) => (
                    <tr key={topic} className="pivot-topic">
                      <th scope="row">{topic}</th>
                      <td className="ltr-num">{faDigits(items.length)}</td>
                      {formatCols.map((f) => (
                        <td key={f.code} className="ltr-num">{faDigits(countOf(items, f.code))}</td>
                      ))}
                      <td>
                        <span className="pivot-codes" dir="ltr">{items.map((i) => i.code).join(' · ')}</span>
                      </td>
                    </tr>
                  ))}
              </React.Fragment>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">جمع کل</th>
              <td className="ltr-num">{faDigits(ofSector.length)}</td>
              {formatCols.map((f) => (
                <td key={f.code} className="ltr-num">{faDigits(countOf(ofSector, f.code))}</td>
              ))}
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
  cleared = false,
  onClearAll,
  onRestoreChecklist,
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
  const [clearing, setClearing] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [clearBusy, setClearBusy] = useState(false);
  const [clearError, setClearError] = useState<string | null>(null);
  const runClear = async (job?: () => Promise<void>) => {
    if (!job) return;
    setClearBusy(true);
    setClearError(null);
    try {
      await job();
      setClearing(false);
      setConfirmText('');
    } catch (e: any) {
      setClearError(e?.message || 'انجام نشد.');
    } finally {
      setClearBusy(false);
    }
  };
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
  // Zones for the store family, groups for the mall family; both in the checklist's order.
  const groups = useMemo(() => {
    const set = new Set<string>();
    [...indicators]
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .filter((i) => templateFilter === 'ALL' || i.template === templateFilter)
      .forEach((i) => set.add(i.group));
    return Array.from(set);
  }, [indicators, templateFilter]);
  // A group that does not belong to the chosen family is cleared.
  useEffect(() => {
    if (selectedGroup !== 'ALL' && !groups.includes(selectedGroup)) setSelectedGroup('ALL');
  }, [groups, selectedGroup]);

  const filteredIndicators = useMemo(() => {
    return indicators.filter((ind) => {
      if (templateFilter !== 'ALL' && ind.template !== templateFilter) return false;
      if (selectedGroup !== 'ALL' && ind.group !== selectedGroup) return false;
      if (onlyEdited && !ind.edited) return false;
      if (onlyWithNote && !ind.auditorNote) return false;
      if (onlyAdded && !ind.custom) return false;

      if (searchQuery.trim()) {
        // Arabic and Persian letters, spaces and case do not matter.
        const q = nameKey(searchQuery);
        const codeMatch = nameKey(ind.code).includes(q);
        const subjMatch = nameKey(ind.subject).includes(q);
        const stmtMatch = nameKey(ind.statement).includes(q);
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
              <h2 style={{ fontSize: 20, fontWeight: 700 }}>بانک شاخص‌ها</h2>
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
            {canEdit && onClearAll && !(cleared && !indicators.length) && (
              <button type="button" className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 38, padding: '0 14px', color: 'var(--fr-mark)' }} onClick={() => setClearing(true)}>
                <Trash2 size={16} />
                <span>حذف همهٔ شاخص‌ها</span>
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
            نمایش <strong style={{ color: 'var(--theme-text-primary)' }}>{faDigits(filteredIndicators.length)}</strong> شاخص از مجموع {faDigits(indicators.length)}
          </span>
        </div>

        <div style={{ overflowX: 'auto', maxHeight: '600px' }}>
          <table style={{ width: '100%', minWidth: 720, borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--theme-card-border)', color: 'var(--text-muted)', position: 'sticky', top: 0, background: 'var(--surface-sunken)' }}>
                <th style={{ textAlign: 'right', padding: '10px 8px' }}>کد شاخص</th>
                <th style={{ textAlign: 'right', padding: '10px 8px' }}>گروه و موضوع</th>
                <th style={{ textAlign: 'right', padding: '10px 8px' }}>متن استاندارد KPI</th>
                <th style={{ textAlign: 'center', padding: '10px 8px' }}>سکتورها</th>
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
                    {ind.template === 'STORE'
                      ? (ind.applicableBusinessTypes?.length || 0) >= 13 || !ind.applicableBusinessTypes?.length
                        ? 'همه (۱۳)'
                        : (ind.applicableBusinessTypes!.length <= 2
                            ? ind.applicableBusinessTypes!.map((c) => profileLabel(c)).join('، ')
                            : <span title={ind.applicableBusinessTypes!.map((c) => profileLabel(c)).join('، ')}>{faDigits(ind.applicableBusinessTypes!.length)} سکتور</span>)
                      : (ind.applicableMallTypes?.length || 0) >= 5
                      ? 'همه (۵)'
                      : <span title={(ind.applicableMallTypes || []).map((c) => profileLabel(c)).join('، ')}>{faDigits(ind.applicableMallTypes?.length || 0)} نوع</span>}
                  </td>
                  <td style={{ textAlign: 'center', padding: '10px 8px' }}>
                    {PHOTOS_REQUIRED && ind.requiresPhoto ? (
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
      <IndicatorPivot indicators={indicators} cleared={cleared} onRestore={canEdit && onRestoreChecklist ? () => runClear(onRestoreChecklist) : undefined} />

      {cleared && (
        <div className="glass-panel" style={{ padding: 16, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13 }}>
            چک‌لیست اصلی حذف شده است{indicators.length ? '؛ فقط شاخص‌هایی که خودتان اضافه کرده‌اید در برنامه هستند.' : ' و هیچ شاخصی در برنامه نیست. با «افزودن شاخص جدید» یا «اکسل» شاخص بسازید.'}
          </span>
          {canEdit && onRestoreChecklist && (
            <button type="button" className="btn-secondary" disabled={clearBusy} onClick={() => runClear(onRestoreChecklist)}>
              بازگرداندن چک‌لیست اصلی
            </button>
          )}
        </div>
      )}
      {clearing && onClearAll && (
        <div className="ie-backdrop" role="dialog" aria-modal="true" aria-labelledby="clr-title" onMouseDown={(e) => e.target === e.currentTarget && setClearing(false)}>
          <div className="ie-dialog">
            <h3 id="clr-title" className="ie-title">حذف همهٔ شاخص‌ها</h3>
            <p className="ie-info">
              همهٔ {faDigits(activeIndicators.length)} شاخص فعال از برنامه حذف می‌شود: شاخص‌های افزوده‌شده برای همیشه پاک می‌شوند و چک‌لیست اصلی (فروشگاه و مرکز خرید) کنار گذاشته می‌شود.
              پرسشنامه‌هایی که قبلاً شروع یا ارسال شده‌اند و گزارش‌هایشان دست‌نخورده می‌مانند. بعداً می‌توانید چک‌لیست اصلی را برگردانید یا شاخص تازه اضافه کنید.
            </p>
            <label className="ie-field">
              <span className="ie-label">برای تأیید، عبارت «حذف همه» را بنویسید</span>
              <input className="ie-input" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
            </label>
            {clearError && <div className="auth-error" role="alert">{clearError}</div>}
            <footer className="ie-foot">
              <span />
              <div className="ie-actions">
                <button type="button" className="btn-secondary" onClick={() => setClearing(false)}>انصراف</button>
                <button type="button" className="btn-primary" style={{ background: 'var(--fr-mark)' }} disabled={clearBusy || confirmText.trim() !== 'حذف همه'} onClick={() => runClear(onClearAll)}>
                  حذف همهٔ شاخص‌ها
                </button>
              </div>
            </footer>
          </div>
        </div>
      )}
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

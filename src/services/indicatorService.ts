import { apiFetch } from './apiClient';
import type { Indicator } from '../types';

/**
 * Hand edits of indicators: the wording a reviewer prefers and a note for the
 * auditor. The checklist file stays the source of the list; an edit only
 * changes how one row reads. Stored on the server so everyone gets the same
 * text, and cached on the device so a questionnaire can still be started offline.
 */
export interface IndicatorOverride {
  indicatorId: string;
  code: string;
  statement?: string;
  /** An empty string means "no note", hiding a note the checklist had. */
  auditorNote?: string;
  disabled?: boolean;
  updatedAt: string;
  updatedBy: string;
  updatedByName?: string;
}

export interface IndicatorEdit {
  statement?: string;
  /** Empty or null clears the note. */
  auditorNote?: string | null;
  disabled?: boolean;
}

/** An indicator added by hand: everything a row of the checklist has. */
export interface CustomIndicator {
  id: string;
  code: string;
  template: 'STORE' | 'MALL';
  group: string;
  subject: string;
  statement: string;
  auditorNote?: string;
  applicableBusinessTypes: string[];
  applicableMallTypes: string[];
  requiresPhoto: boolean;
  requiresComment: boolean;
  weight: number;
  journeyStage: string;
  reportingDimension: string;
  displayOrder: number;
  status: 'ACTIVE' | 'ARCHIVED';
  createdAt: string;
  createdByName?: string;
  updatedAt: string;
}

export interface CustomIndicatorInput {
  template?: 'STORE' | 'MALL';
  group?: string;
  subject?: string;
  code?: string;
  statement?: string;
  auditorNote?: string | null;
  applicableBusinessTypes?: string[];
  applicableMallTypes?: string[];
  requiresPhoto?: boolean;
  requiresComment?: boolean;
  weight?: number;
  status?: 'ACTIVE' | 'ARCHIVED';
}

const cacheKey = (tenantId: string) => `rsapp_indicator_overrides_v1:${tenantId}`;
const customCacheKey = (tenantId: string) => `rsapp_custom_indicators_v1:${tenantId}`;

function readCache(tenantId: string): IndicatorOverride[] {
  try {
    const raw = localStorage.getItem(cacheKey(tenantId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeCache(tenantId: string, overrides: IndicatorOverride[]) {
  try {
    localStorage.setItem(cacheKey(tenantId), JSON.stringify(overrides));
  } catch {
    /* storage unavailable: the server copy is still the truth */
  }
}

async function failure(res: Response): Promise<Error> {
  const body = await res.json().catch(() => ({}));
  return new Error(body?.error || 'ذخیره انجام نشد. دوباره تلاش کنید.');
}

export const IndicatorService = {
  /** The last copy this device saw, for the first paint before the server answers. */
  cached(tenantId: string): IndicatorOverride[] {
    return readCache(tenantId);
  },

  /** Server copy when reachable, else the last copy this device saw. */
  async load(tenantId: string): Promise<IndicatorOverride[]> {
    try {
      const res = await apiFetch('/indicator-overrides');
      if (!res.ok) return readCache(tenantId);
      const list = (await res.json()) as IndicatorOverride[];
      if (!Array.isArray(list)) return readCache(tenantId);
      writeCache(tenantId, list);
      return list;
    } catch {
      return readCache(tenantId);
    }
  },

  /** Returns the stored override, or null when the row is back to the checklist's own text. */
  async save(indicatorId: string, edit: IndicatorEdit): Promise<IndicatorOverride | null> {
    const res = await apiFetch(`/indicator-overrides/${encodeURIComponent(indicatorId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(edit),
    });
    if (!res.ok) throw await failure(res);
    return ((await res.json()) as { override: IndicatorOverride | null }).override;
  },

  async reset(indicatorId: string): Promise<void> {
    const res = await apiFetch(`/indicator-overrides/${encodeURIComponent(indicatorId)}`, { method: 'DELETE' });
    if (!res.ok) throw await failure(res);
  },

  remember(tenantId: string, overrides: IndicatorOverride[]) {
    writeCache(tenantId, overrides);
  },

  // --- indicators added by hand ---------------------------------------------

  cachedCustom(tenantId: string): CustomIndicator[] {
    try {
      const parsed = JSON.parse(localStorage.getItem(customCacheKey(tenantId)) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  },

  rememberCustom(tenantId: string, list: CustomIndicator[]) {
    try {
      localStorage.setItem(customCacheKey(tenantId), JSON.stringify(list));
    } catch {
      /* storage unavailable */
    }
  },

  async loadCustom(tenantId: string): Promise<CustomIndicator[]> {
    try {
      const res = await apiFetch('/custom-indicators');
      if (!res.ok) return IndicatorService.cachedCustom(tenantId);
      const list = (await res.json()) as CustomIndicator[];
      if (!Array.isArray(list)) return IndicatorService.cachedCustom(tenantId);
      IndicatorService.rememberCustom(tenantId, list);
      return list;
    } catch {
      return IndicatorService.cachedCustom(tenantId);
    }
  },

  async createCustom(input: CustomIndicatorInput): Promise<CustomIndicator> {
    const res = await apiFetch('/custom-indicators', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw await failure(res);
    return (await res.json()) as CustomIndicator;
  },

  async updateCustom(id: string, input: CustomIndicatorInput): Promise<CustomIndicator> {
    const res = await apiFetch(`/custom-indicators/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw await failure(res);
    return (await res.json()) as CustomIndicator;
  },

  /** Deletes every indicator: hand-added ones for good, the checklist file's are switched off. */
  async clearAll(): Promise<void> {
    const res = await apiFetch('/indicators/clear', { method: 'POST' });
    if (!res.ok) throw await failure(res);
  },

  /** Brings the checklist file's indicators back after clearAll. */
  async restoreChecklist(): Promise<void> {
    const res = await apiFetch('/indicators/restore', { method: 'POST' });
    if (!res.ok) throw await failure(res);
  },

  async removeCustom(id: string): Promise<void> {
    const res = await apiFetch(`/custom-indicators/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!res.ok) throw await failure(res);
  },
};

/** The checklist with every edit applied. An edit whose code no longer matches its row is ignored. */
/** Marker the server stores when every indicator of the checklist file has been removed. */
export const CLEARED_ID = '__CATALOG_CLEARED__';
export const isCatalogCleared = (overrides: IndicatorOverride[]) => overrides.some((o) => o.indicatorId === CLEARED_ID);

export function applyOverrides(base: Indicator[], overrides: IndicatorOverride[]): Indicator[] {
  if (!overrides.length) return base;
  if (isCatalogCleared(overrides)) return [];
  const byId = new Map(overrides.map((o) => [o.indicatorId, o]));
  return base.map((ind) => {
    const o = byId.get(ind.id);
    if (!o || o.code !== ind.code) return ind;
    const note = o.auditorNote !== undefined ? o.auditorNote : ind.auditorNote;
    const edited = o.statement !== undefined || o.auditorNote !== undefined;
    return {
      ...ind,
      statement: o.statement ?? ind.statement,
      auditorNote: note || undefined,
      ...(edited ? { edited: true } : {}),
      // Switched off: the rule engine and every list that counts active rows already skip ARCHIVED.
      ...(o.disabled ? { status: 'ARCHIVED' as const, disabled: true } : {}),
    };
  });
}

export function customToIndicator(c: CustomIndicator): Indicator {
  return {
    id: c.id,
    code: c.code,
    template: c.template,
    group: c.group,
    subject: c.subject,
    journeyStage: c.journeyStage,
    reportingDimension: c.reportingDimension,
    originalText: c.statement,
    statement: c.statement,
    status: c.status,
    version: 1,
    weight: c.weight,
    requiresPhoto: c.requiresPhoto,
    requiresComment: c.requiresComment,
    auditorNote: c.auditorNote,
    displayOrder: c.displayOrder,
    applicableBusinessTypes: c.applicableBusinessTypes,
    applicableMallTypes: c.applicableMallTypes,
    custom: true,
    ...(c.status === 'ARCHIVED' ? { disabled: true } : {}),
  };
}

const TEMPLATE_RANK: Record<string, number> = { STORE: 0, MALL: 1 };

/** Checklist rows with edits applied, plus the rows added by hand, in form order. */
export function buildIndicatorList(base: Indicator[], overrides: IndicatorOverride[], custom: CustomIndicator[]): Indicator[] {
  const edited = applyOverrides(base, overrides);
  if (!custom.length) return edited;
  return [...edited, ...custom.map(customToIndicator)].sort(
    (a, b) => (TEMPLATE_RANK[a.template] ?? 9) - (TEMPLATE_RANK[b.template] ?? 9) || a.displayOrder - b.displayOrder
  );
}

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
  updatedAt: string;
  updatedBy: string;
  updatedByName?: string;
}

export interface IndicatorEdit {
  statement?: string;
  /** Empty or null clears the note. */
  auditorNote?: string | null;
}

const cacheKey = (tenantId: string) => `rsapp_indicator_overrides_v1:${tenantId}`;

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
};

/** The checklist with every edit applied. An edit whose code no longer matches its row is ignored. */
export function applyOverrides(base: Indicator[], overrides: IndicatorOverride[]): Indicator[] {
  if (!overrides.length) return base;
  const byId = new Map(overrides.map((o) => [o.indicatorId, o]));
  return base.map((ind) => {
    const o = byId.get(ind.id);
    if (!o || o.code !== ind.code) return ind;
    const note = o.auditorNote !== undefined ? o.auditorNote : ind.auditorNote;
    return {
      ...ind,
      statement: o.statement ?? ind.statement,
      auditorNote: note || undefined,
      edited: true,
    };
  });
}

import type { SavedStoreDirectoryItem, VisitSession } from '../types';
import { nameKey } from '../engine/frModel';
import { apiFetch } from './apiClient';

/** A brand (business): the name its branches and visits are grouped under. */
export interface Brand {
  id: string;
  name: string;
  /** Earlier names and merged-in spellings. */
  aliases: string[];
  businessType?: string;
  notes?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BrandInput {
  name?: string;
  businessType?: string;
  notes?: string;
  isActive?: boolean;
}

const cacheKey = (tenantId: string) => `rsapp_brands_v1:${tenantId}`;

async function failure(res: Response): Promise<Error> {
  const body = await res.json().catch(() => ({}));
  return new Error(body?.error || 'انجام نشد. دوباره تلاش کنید.');
}

export const BrandService = {
  cached(tenantId: string): Brand[] {
    try {
      const parsed = JSON.parse(localStorage.getItem(cacheKey(tenantId)) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  },

  async load(tenantId: string): Promise<Brand[]> {
    try {
      const res = await apiFetch('/brands');
      if (!res.ok) return BrandService.cached(tenantId);
      const list = (await res.json()) as Brand[];
      if (!Array.isArray(list)) return BrandService.cached(tenantId);
      try {
        localStorage.setItem(cacheKey(tenantId), JSON.stringify(list));
      } catch {
        /* storage unavailable */
      }
      return list;
    } catch {
      return BrandService.cached(tenantId);
    }
  },

  async create(input: BrandInput): Promise<Brand> {
    const res = await apiFetch('/brands', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
    const body = await res.json().catch(() => ({}));
    // An existing brand under another spelling is simply the brand to use.
    if (res.status === 409 && body?.brand) return body.brand as Brand;
    if (!res.ok) throw new Error(body?.error || 'انجام نشد. دوباره تلاش کنید.');
    return body as Brand;
  },

  async update(id: string, input: BrandInput): Promise<Brand> {
    const res = await apiFetch(`/brands/${encodeURIComponent(id)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
    if (!res.ok) throw await failure(res);
    return (await res.json()) as Brand;
  },

  async merge(id: string, intoId: string): Promise<Brand> {
    const res = await apiFetch(`/brands/${encodeURIComponent(id)}/merge`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ intoId }) });
    if (!res.ok) throw await failure(res);
    return (await res.json()) as Brand;
  },

  async remove(id: string): Promise<{ removedBranches: number }> {
    const res = await apiFetch(`/brands/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!res.ok) throw await failure(res);
    return (await res.json()) as { removedBranches: number };
  },
};

/**
 * Visits keep the brand and branch names as they were typed. For reports they
 * are mapped to the brand and branch they belong to today, so a renamed or
 * merged brand (or a renamed or moved branch) is still one brand and one branch.
 */
export function canonicalizeVisits(visits: VisitSession[], brands: Brand[], stores: SavedStoreDirectoryItem[]): VisitSession[] {
  if (!brands.length && !stores.length) return visits;
  const brandOf = new Map<string, Brand>();
  for (const b of brands) for (const n of [b.name, ...b.aliases]) brandOf.set(nameKey(n), b);

  // (brand key, branch key) -> the directory branch that name pair belongs to.
  const branchOf = new Map<string, SavedStoreDirectoryItem>();
  for (const s of stores) {
    const brandNames = [s.brandName, ...(s.previousBrands || []), ...(brandOf.get(nameKey(s.brandName))?.aliases || [])];
    for (const bn of brandNames) for (const rn of [s.branchName, ...(s.aliases || [])]) branchOf.set(`${nameKey(bn)}|${nameKey(rn)}`, s);
  }

  return visits.map((v) => {
    const s = branchOf.get(`${nameKey(v.brandName)}|${nameKey(v.branchName)}`);
    const brandName = s?.brandName ?? brandOf.get(nameKey(v.brandName))?.name ?? v.brandName;
    const branchName = s?.branchName ?? v.branchName;
    return brandName === v.brandName && branchName === v.branchName ? v : { ...v, brandName, branchName };
  });
}

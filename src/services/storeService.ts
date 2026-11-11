import { SavedStoreDirectoryItem } from '../types';
import { apiFetch } from './apiClient';

const LOCAL_STORAGE_KEY = 'RSAPP_STORE_DIRECTORY_CACHE';
const STORES_ENDPOINT = '/stores';

// Demo stores that older builds cached next to real ones; they are dropped when found.
const SEED_IDS = new Set(['store_zara_valiasr', 'store_lcw_kourosh', 'store_mango_palladium', 'store_hyperstar_bakeri']);

export const StoreService = {
  getLocalStores(): SavedStoreDirectoryItem[] {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Older builds cached the demo seeds alongside real stores.
          return parsed.filter((s: SavedStoreDirectoryItem) => !SEED_IDS.has(s.id));
        }
      }
    } catch (e) {
      console.warn('Could not read store directory from localStorage', e);
    }
    return [];
  },

  setLocalStores(stores: SavedStoreDirectoryItem[]) {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(stores));
    } catch (e) {
      console.warn('Could not save store directory to localStorage', e);
    }
  },

  async getAllStores(): Promise<SavedStoreDirectoryItem[]> {
    const local = this.getLocalStores();
    try {
      const res = await apiFetch(STORES_ENDPOINT);
      if (res.ok) {
        const serverStores: SavedStoreDirectoryItem[] = await res.json();
        // The server is the source of truth whenever it answers, even with an
        // empty list; demo seeds are only an offline first-run fallback.
        if (Array.isArray(serverStores)) {
          // Merge unique server stores with local
          const map = new Map<string, SavedStoreDirectoryItem>();
          serverStores.forEach((s) => map.set(s.id, s));
          local.forEach((s) => {
            if (!SEED_IDS.has(s.id) && !map.has(s.id)) map.set(s.id, s);
          });
          const merged = Array.from(map.values());
          this.setLocalStores(merged);
          return merged;
        }
      }
    } catch (err) {
      // Offline fallback
    }
    return local;
  },

  async saveStore(storeData: Partial<SavedStoreDirectoryItem>): Promise<SavedStoreDirectoryItem> {
    const local = this.getLocalStores();
    const existingIdx = local.findIndex(
      (s) =>
        s.brandName.trim().toLowerCase() === (storeData.brandName || '').trim().toLowerCase() &&
        s.branchName.trim().toLowerCase() === (storeData.branchName || '').trim().toLowerCase()
    );

    const now = new Date().toISOString();
    let saved: SavedStoreDirectoryItem;

    if (existingIdx >= 0) {
      saved = {
        ...local[existingIdx],
        ...storeData,
        lastVisitedAt: now,
      } as SavedStoreDirectoryItem;
      local[existingIdx] = saved;
    } else {
      saved = {
        id: storeData.id || `store_${Date.now()}`,
        brandName: storeData.brandName || '',
        branchName: storeData.branchName || '',
        assessmentType: storeData.assessmentType || 'STORE',
        businessType: storeData.businessType || 'Fashion',
        locationContext: storeData.locationContext || 'STREET_STORE',
        ...(storeData.fbType ? { fbType: storeData.fbType } : {}),
        ...(storeData.fbService ? { fbService: storeData.fbService } : {}),
        ...(storeData.fbOutdoor !== undefined ? { fbOutdoor: storeData.fbOutdoor } : {}),
        mallType: storeData.mallType,
        attributes: storeData.attributes || {},
        auditorName: storeData.auditorName,
        supervisorName: storeData.supervisorName,
        address: storeData.address,
        city: storeData.city,
        lastVisitedAt: now,
        createdAt: now,
      };
      local.unshift(saved);
    }

    this.setLocalStores(local);

    // Sync with server if online
    try {
      await apiFetch(STORES_ENDPOINT, {
        method: 'POST',
        body: JSON.stringify(saved),
      });
    } catch (e) {
      // Offline sync fallback
    }

    return saved;
  },

  /** Edits a branch on the server (name, city, address, manager, active, brand). */
  async updateStore(id: string, patch: Record<string, unknown>): Promise<SavedStoreDirectoryItem> {
    const res = await apiFetch(`${STORES_ENDPOINT}/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body?.error || 'ذخیره انجام نشد.');
    const local = this.getLocalStores().map((s) => (s.id === id ? { ...s, ...body } : s));
    this.setLocalStores(local);
    return body as SavedStoreDirectoryItem;
  },

  async deleteStore(id: string): Promise<boolean> {
    let local = this.getLocalStores();
    local = local.filter((s) => s.id !== id);
    this.setLocalStores(local);

    try {
      await apiFetch(`${STORES_ENDPOINT}/${id}`, {
        method: 'DELETE',
      });
    } catch (e) {}

    return true;
  },
};

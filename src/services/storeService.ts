import { SavedStoreDirectoryItem } from '../types';

const LOCAL_STORAGE_KEY = 'RSAPP_STORE_DIRECTORY_CACHE';
const API_BASE_URL = 'http://localhost:3001/api/stores';

// Default seed stores if offline or empty
const SEED_STORES: SavedStoreDirectoryItem[] = [
  {
    id: 'store_zara_valiasr',
    brandName: 'زارا (Zara)',
    branchName: 'شعبه خیابان ولیعصر',
    assessmentType: 'STORE',
    businessType: 'Fashion',
    locationContext: 'STREET_STORE',
    storeFormat: 'FLAGSHIP',
    attributes: {
      has_window_display: true,
      has_fitting_room: true,
      has_mannequins: true,
      has_elevator: false,
      has_stairs: false,
      has_parking: false,
      has_customer_toilet: false,
      has_checkout_counter: true,
      has_food_service: false,
      has_anti_theft_gate: true,
      hasFittingRoom: true,
      hasShowcase: true,
      hasMannequins: true,
    },
    auditorName: 'نیما ذوقی (ارزیاب ارشد)',
    supervisorName: 'مهندس سارا احمدی (سرپرست)',
    address: 'تهران، خیابان ولیعصر، بالاتر از میدان ونک',
    city: 'تهران',
    lastVisitedAt: '2026-09-20T10:30:00.000Z',
    createdAt: '2026-09-01T08:00:00.000Z',
  },
  {
    id: 'store_lcw_kourosh',
    brandName: 'ال‌سی وایکیکی (LC Waikiki)',
    branchName: 'شعبه کوروش مال',
    assessmentType: 'STORE',
    businessType: 'Fashion',
    locationContext: 'MALL_STORE',
    storeFormat: 'CHAIN',
    attributes: {
      has_window_display: true,
      has_fitting_room: true,
      has_mannequins: true,
      has_elevator: false,
      has_stairs: false,
      has_parking: true,
      has_customer_toilet: true,
      has_checkout_counter: true,
      has_food_service: false,
      has_anti_theft_gate: true,
      hasFittingRoom: true,
      hasShowcase: true,
      hasMannequins: true,
    },
    auditorName: 'علی کاظمی (ارزیاب)',
    supervisorName: 'مهندس سارا احمدی (سرپرست)',
    address: 'تهران، بزرگراه ستاری، مجتمع کوروش مال، طبقه ۱',
    city: 'تهران',
    lastVisitedAt: '2026-09-18T14:15:00.000Z',
    createdAt: '2026-09-01T08:00:00.000Z',
  },
  {
    id: 'store_mango_palladium',
    brandName: 'مانگو (Mango)',
    branchName: 'شعبه مرکز خرید پالادیوم',
    assessmentType: 'STORE',
    businessType: 'Fashion',
    locationContext: 'MALL_STORE',
    storeFormat: 'BOUTIQUE',
    attributes: {
      has_window_display: true,
      has_fitting_room: true,
      has_mannequins: true,
      has_elevator: false,
      has_stairs: false,
      has_parking: true,
      has_customer_toilet: true,
      has_checkout_counter: true,
      has_food_service: false,
      has_anti_theft_gate: true,
      hasFittingRoom: true,
      hasShowcase: true,
      hasMannequins: true,
    },
    auditorName: 'مریم اکبری (ارزیاب)',
    supervisorName: 'مهندس سارا احمدی (سرپرست)',
    address: 'تهران، زعفرانیه، خیابان مقدس اردبیلی، پالادیوم مال',
    city: 'تهران',
    lastVisitedAt: '2026-09-15T11:00:00.000Z',
    createdAt: '2026-09-01T08:00:00.000Z',
  },
  {
    id: 'store_hyperstar_bakeri',
    brandName: 'هایپراستار (Hyperstar)',
    branchName: 'شعبه شهید باکری',
    assessmentType: 'STORE',
    businessType: 'FMCG',
    locationContext: 'STANDALONE',
    storeFormat: 'FLAGSHIP',
    attributes: {
      has_window_display: false,
      has_fitting_room: false,
      has_mannequins: false,
      has_elevator: true,
      has_stairs: true,
      has_parking: true,
      has_customer_toilet: true,
      has_checkout_counter: true,
      has_food_service: true,
      has_anti_theft_gate: true,
      hasElevator: true,
      hasParking: true,
      hasCustomerToilet: true,
    },
    auditorName: 'نیما ذوقی (ارزیاب ارشد)',
    supervisorName: 'مهندس سارا احمدی (سرپرست)',
    address: 'تهران، اتوبان باکری جنوب، مجتمع ارم هایپراستار',
    city: 'تهران',
    lastVisitedAt: '2026-09-10T16:00:00.000Z',
    createdAt: '2026-09-01T08:00:00.000Z',
  },
  {
    id: 'mall_kourosh',
    brandName: 'مرکز خرید کوروش',
    branchName: 'مجتمع تجاری فرهنگی کوروش مال',
    assessmentType: 'MALL',
    mallType: 'Regional',
    locationContext: 'STANDALONE',
    attributes: {
      has_window_display: true,
      has_fitting_room: false,
      has_mannequins: false,
      has_elevator: true,
      has_stairs: true,
      has_parking: true,
      has_customer_toilet: true,
      has_checkout_counter: false,
      has_food_service: true,
      has_anti_theft_gate: false,
      hasElevator: true,
      hasParking: true,
      hasCustomerToilet: true,
    },
    auditorName: 'نیما ذوقی (ارزیاب ارشد)',
    supervisorName: 'مهندس سارا احمدی (سرپرست)',
    address: 'تهران، بزرگراه ستاری شمال، تقاطع پیامبر مرکزی',
    city: 'تهران',
    lastVisitedAt: '2026-09-05T09:30:00.000Z',
    createdAt: '2026-09-01T08:00:00.000Z',
  },
];

export const StoreService = {
  getLocalStores(): SavedStoreDirectoryItem[] {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Could not read store directory from localStorage', e);
    }
    return SEED_STORES;
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
      const res = await fetch(API_BASE_URL, {
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        const serverStores: SavedStoreDirectoryItem[] = await res.json();
        if (Array.isArray(serverStores) && serverStores.length > 0) {
          // Merge unique server stores with local
          const map = new Map<string, SavedStoreDirectoryItem>();
          serverStores.forEach((s) => map.set(s.id, s));
          local.forEach((s) => {
            if (!map.has(s.id)) map.set(s.id, s);
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
        storeFormat: storeData.storeFormat || 'CHAIN',
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
      await fetch(API_BASE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(saved),
      });
    } catch (e) {
      // Offline sync fallback
    }

    return saved;
  },

  async deleteStore(id: string): Promise<boolean> {
    let local = this.getLocalStores();
    local = local.filter((s) => s.id !== id);
    this.setLocalStores(local);

    try {
      await fetch(`${API_BASE_URL}/${id}`, {
        method: 'DELETE',
      });
    } catch (e) {}

    return true;
  },
};

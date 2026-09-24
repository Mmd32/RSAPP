import fs from 'fs';
import path from 'path';
import { logger } from '../logger.js';
import { dataPath, ensureDir, writeJsonAtomic } from '../config.js';
import { CorrectiveAction, ActionAuditLog } from '../types/actions.js';
import { DataStore, VisitFilter, StoredPhoto, PhotoMetadata } from './types.js';

const DEFAULT_TENANT = 'org_retail_holding';

const SEED_ORGANIZATION = {
  id: DEFAULT_TENANT,
  name: 'هلدینگ ریتیل سلوشنز',
  code: 'RS_HOLDING',
  brands: ['ZARA', 'LC Waikiki', 'کوروش مال', 'مانگو'],
  isActive: true,
  createdAt: new Date().toISOString(),
};

/**
 * JSON-file backed store: the zero-configuration default. Everything is held in
 * memory and mirrored to `DATA_DIR/*.json` on each write, which keeps local
 * development and offline demos working without a database.
 *
 * Suitable for a single process. Set DATABASE_URL to use PostgreSQL instead.
 */
export class JsonDataStore implements DataStore {
  readonly name = 'json-files';

  private visits: Record<string, any> = {};
  private actions: Record<string, CorrectiveAction> = {};
  private auditLogs: ActionAuditLog[] = [];
  private storeDirectory: any[] = [];
  private organizations: Record<string, any> = { [DEFAULT_TENANT]: SEED_ORGANIZATION };

  private readonly visitsPath = dataPath('visits.json');
  private readonly actionsPath = dataPath('actions.json');
  private readonly auditPath = dataPath('action_audit_logs.json');
  private readonly orgsPath = dataPath('organizations.json');
  private readonly storesPath = dataPath('stores.json');
  private readonly photosIndexPath = dataPath('photos.json');
  private readonly photosDir = dataPath('uploads');

  /** Photo bytes live as files; this index holds their metadata. */
  private photoIndex: Record<string, PhotoMetadata> = {};

  async init(): Promise<void> {
    this.visits = this.read(this.visitsPath, this.visits);
    this.actions = this.read(this.actionsPath, this.actions);
    this.auditLogs = this.read(this.auditPath, this.auditLogs);
    this.organizations = this.read(this.orgsPath, this.organizations);
    this.storeDirectory = this.read(this.storesPath, this.storeDirectory);
    this.photoIndex = this.read(this.photosIndexPath, this.photoIndex);
  }

  async close(): Promise<void> {
    // Nothing to release; every write already hit the disk.
  }

  private read<T>(filePath: string, fallback: T): T {
    if (!fs.existsSync(filePath)) return fallback;
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
    } catch (e) {
      // A corrupt store must not take the API down.
      logger.error(`Could not parse data store ${path.basename(filePath)}`, e);
      return fallback;
    }
  }

  private write(filePath: string, value: unknown) {
    try {
      writeJsonAtomic(filePath, value);
    } catch (e) {
      // Read-only or full disk: keep serving requests, but make it visible.
      logger.error(`Failed to persist ${path.basename(filePath)}`, e);
    }
  }

  async listVisits(filter: VisitFilter = {}): Promise<any[]> {
    let list = Object.values(this.visits);
    if (filter.tenantId) {
      list = list.filter((v: any) => (v.tenantId || DEFAULT_TENANT) === filter.tenantId);
    }
    if (filter.brandName) list = list.filter((v: any) => v.brandName === filter.brandName);
    if (filter.branchName) list = list.filter((v: any) => v.branchName === filter.branchName);
    return list;
  }

  async getVisit(id: string): Promise<any | null> {
    return this.visits[id] ?? null;
  }

  async saveVisit(visit: any): Promise<void> {
    this.visits[visit.id] = visit;
    this.write(this.visitsPath, this.visits);
  }

  async countVisits(): Promise<number> {
    return Object.keys(this.visits).length;
  }

  async listStores(): Promise<any[]> {
    return [...this.storeDirectory];
  }

  async saveStore(store: any): Promise<void> {
    const index = this.storeDirectory.findIndex((s) => s.id === store.id);
    if (index >= 0) {
      this.storeDirectory[index] = store;
    } else {
      this.storeDirectory.unshift(store);
    }
    this.write(this.storesPath, this.storeDirectory);
  }

  async deleteStore(id: string): Promise<boolean> {
    const before = this.storeDirectory.length;
    this.storeDirectory = this.storeDirectory.filter((s) => s.id !== id);
    if (this.storeDirectory.length === before) return false;
    this.write(this.storesPath, this.storeDirectory);
    return true;
  }

  async listOrganizations(): Promise<any[]> {
    return Object.values(this.organizations);
  }

  async saveOrganization(organization: any): Promise<void> {
    this.organizations[organization.id] = organization;
    this.write(this.orgsPath, this.organizations);
  }

  async listActions(tenantId?: string): Promise<CorrectiveAction[]> {
    const list = Object.values(this.actions);
    if (!tenantId) return list;
    return list.filter((a) => (a.tenantId || DEFAULT_TENANT) === tenantId);
  }

  async getAction(id: string): Promise<CorrectiveAction | null> {
    return this.actions[id] ?? null;
  }

  async saveAction(action: CorrectiveAction): Promise<void> {
    this.actions[action.id] = action;
    this.write(this.actionsPath, this.actions);
  }

  async countActions(): Promise<number> {
    return Object.keys(this.actions).length;
  }

  async listAuditLogs(actionId: string): Promise<ActionAuditLog[]> {
    return this.auditLogs.filter((l) => l.actionId === actionId);
  }

  async appendAuditLog(log: ActionAuditLog): Promise<void> {
    this.auditLogs.push(log);
    this.write(this.auditPath, this.auditLogs);
  }

  private photoFile(id: string): string {
    return path.join(this.photosDir, id);
  }

  async savePhoto(photo: StoredPhoto): Promise<PhotoMetadata> {
    ensureDir(this.photosDir);
    fs.writeFileSync(this.photoFile(photo.id), photo.data);

    const { data, ...meta } = photo;
    this.photoIndex[photo.id] = meta;
    this.write(this.photosIndexPath, this.photoIndex);
    return meta;
  }

  async getPhoto(id: string): Promise<StoredPhoto | null> {
    const meta = this.photoIndex[id];
    const file = this.photoFile(id);
    if (!meta || !fs.existsSync(file)) return null;
    return { ...meta, data: fs.readFileSync(file) };
  }

  async deletePhoto(id: string): Promise<boolean> {
    if (!this.photoIndex[id]) return false;
    delete this.photoIndex[id];
    this.write(this.photosIndexPath, this.photoIndex);
    try {
      fs.unlinkSync(this.photoFile(id));
    } catch {
      // The metadata is gone either way; a missing file is not an error.
    }
    return true;
  }
}

import { CorrectiveAction, ActionAuditLog } from '../types/actions.js';

/**
 * An evidence photo. Photos are stored separately from the questionnaire and
 * referenced by URL: a visit document is re-sent on every sync, so embedding
 * image data would re-upload every photo on each save.
 */
export interface StoredPhoto {
  id: string;
  tenantId: string;
  visitId?: string;
  indicatorCode?: string;
  mimeType: string;
  sizeBytes: number;
  data: Buffer;
  createdAt: string;
}

/**
 * A hand edit of one indicator: the wording the client's reviewers prefer and a
 * note for the auditor. The workbook stays the source of the list itself; an
 * override only changes how one row reads. Keyed by the catalog's indicator id,
 * with the code kept so an override that no longer matches its row is ignored.
 */
export interface IndicatorOverride {
  indicatorId: string;
  code: string;
  statement?: string;
  auditorNote?: string;
  /** Hidden from every new questionnaire (kept so it can be switched back on). */
  disabled?: boolean;
  updatedAt: string;
  updatedBy: string;
  updatedByName?: string;
}

/**
 * An indicator added by hand in the question bank, with everything a row of the
 * checklist has. Stored apart from the checklist file, which stays untouched.
 */
/** A brand (business) assessed by the app; its branches are the stores directory entries with the same brand name. */
export interface Brand {
  id: string;
  name: string;
  /** Earlier names and merged-in spellings: visits recorded under them still belong to this brand. */
  aliases: string[];
  businessType?: string;
  notes?: string;
  isActive: boolean;
  createdAt: string;
  createdBy?: string;
  updatedAt: string;
}

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
  createdBy: string;
  createdByName?: string;
  updatedAt: string;
  updatedBy: string;
  updatedByName?: string;
}

/** Photo metadata without the bytes, which is what the API returns. */
export type PhotoMetadata = Omit<StoredPhoto, 'data'>;

/**
 * A login account. The password is only ever stored as a salted scrypt hash;
 * `sessionVersion` is bumped to revoke every token issued before it.
 */
export interface StoredUser {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  role: string;
  /** Short evaluator code shown on questionnaires and reports (e.g. EV-07). */
  code?: string | null;
  /** Explicit permission list; null/absent means the role's defaults. */
  permissions?: string[] | null;
  passwordHash: string;
  isActive: boolean;
  sessionVersion: number;
  failedLogins: number;
  lockedUntil?: string | null;
  mustChangePassword?: boolean;
  lastLoginAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Query filters applied to a visit listing. */
export interface VisitFilter {
  tenantId?: string;
  brandName?: string;
  branchName?: string;
}

/**
 * Persistence contract shared by the JSON file store and the PostgreSQL store.
 *
 * Entities are passed around as whole documents, matching how the API exchanges
 * them with the frontend. Coarse filtering that both backends can push down
 * lives here; the narrower query filters stay in the route handlers.
 */
export interface DataStore {
  /** Human-readable backend name, surfaced by /api/health. */
  readonly name: string;

  /** Opens connections and applies schema migrations. */
  init(): Promise<void>;
  close(): Promise<void>;

  listVisits(filter?: VisitFilter): Promise<any[]>;
  getVisit(id: string): Promise<any | null>;
  saveVisit(visit: any): Promise<void>;
  countVisits(): Promise<number>;

  listStores(): Promise<any[]>;
  saveStore(store: any): Promise<void>;
  deleteStore(id: string): Promise<boolean>;

  listOrganizations(): Promise<any[]>;
  saveOrganization(organization: any): Promise<void>;

  listActions(tenantId?: string): Promise<CorrectiveAction[]>;
  getAction(id: string): Promise<CorrectiveAction | null>;
  saveAction(action: CorrectiveAction): Promise<void>;
  countActions(): Promise<number>;

  listAuditLogs(actionId: string): Promise<ActionAuditLog[]>;
  appendAuditLog(log: ActionAuditLog): Promise<void>;

  listUsers(tenantId?: string): Promise<StoredUser[]>;
  getUser(id: string): Promise<StoredUser | null>;
  /** Case-insensitive lookup. */
  getUserByEmail(email: string): Promise<StoredUser | null>;
  saveUser(user: StoredUser): Promise<void>;
  countUsers(): Promise<number>;

  /** Server-side settings (e.g. the session signing key). */
  getSetting(key: string): Promise<string | null>;
  /**
   * Stores `value` unless the key already exists, and returns whichever value
   * is stored. Safe when several serverless instances race on first boot.
   */
  setSettingIfAbsent(key: string, value: string): Promise<string>;

  listBrands(tenantId: string): Promise<Brand[]>;
  saveBrand(tenantId: string, brand: Brand): Promise<void>;
  deleteBrand(tenantId: string, brandId: string): Promise<boolean>;
  listCustomIndicators(tenantId: string): Promise<CustomIndicator[]>;
  saveCustomIndicator(tenantId: string, indicator: CustomIndicator): Promise<void>;
  deleteCustomIndicator(tenantId: string, indicatorId: string): Promise<boolean>;

  listIndicatorOverrides(tenantId: string): Promise<IndicatorOverride[]>;
  saveIndicatorOverride(tenantId: string, override: IndicatorOverride): Promise<void>;
  deleteIndicatorOverride(tenantId: string, indicatorId: string): Promise<boolean>;

  savePhoto(photo: StoredPhoto): Promise<PhotoMetadata>;
  getPhoto(id: string): Promise<StoredPhoto | null>;
  deletePhoto(id: string): Promise<boolean>;
}

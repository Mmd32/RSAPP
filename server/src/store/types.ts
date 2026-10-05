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

  savePhoto(photo: StoredPhoto): Promise<PhotoMetadata>;
  getPhoto(id: string): Promise<StoredPhoto | null>;
  deletePhoto(id: string): Promise<boolean>;
}

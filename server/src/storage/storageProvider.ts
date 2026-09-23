import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface FileMetadata {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
  url: string;
  uploadedBy: string;
  uploadedAt: string;
  tenantId?: string;
  evidenceType?: 'BEFORE' | 'AFTER' | 'DOCUMENT';
}

export interface SignedUploadUrlResult {
  uploadUrl: string;
  downloadUrl: string;
  storageKey: string;
  expiresAt: string;
}

export interface StorageProvider {
  name: string;
  generateUploadUrl(
    fileName: string,
    mimeType: string,
    tenantId: string,
    expiresInSeconds?: number
  ): Promise<SignedUploadUrlResult>;
  generateDownloadUrl(storageKey: string, expiresInSeconds?: number): Promise<string>;
  saveBuffer(
    buffer: Buffer,
    fileName: string,
    mimeType: string,
    tenantId: string
  ): Promise<FileMetadata>;
  deleteFile(storageKey: string): Promise<boolean>;
  validateFile(mimeType: string, sizeBytes: number): { valid: boolean; error?: string };
}

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'application/pdf',
]);

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

/**
 * Local / Hybrid File Storage Provider
 * Supports signed token generation, MIME validation, and local persistence.
 */
export class LocalStorageProvider implements StorageProvider {
  name = 'LocalStorageProvider';
  private baseDir: string;
  private baseUrl: string;
  private secretKey: string;

  constructor(baseDir?: string, baseUrl: string = '/api/storage/files') {
    this.baseDir = baseDir || path.resolve(process.cwd(), 'data/uploads');
    this.baseUrl = baseUrl;
    this.secretKey = process.env.STORAGE_SIGNING_SECRET || 'rsapp-dev-storage-secret-key-32b';
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  validateFile(mimeType: string, sizeBytes: number): { valid: boolean; error?: string } {
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      return {
        valid: false,
        error: `Invalid file type: ${mimeType}. Only JPEG, PNG, WebP, HEIC, and PDF are permitted.`,
      };
    }
    if (sizeBytes > MAX_FILE_SIZE_BYTES) {
      return {
        valid: false,
        error: `File exceeds maximum size of 20MB (got ${Math.round(sizeBytes / 1024 / 1024)}MB).`,
      };
    }
    return { valid: true };
  }

  async generateUploadUrl(
    fileName: string,
    mimeType: string,
    tenantId: string,
    expiresInSeconds = 900
  ): Promise<SignedUploadUrlResult> {
    const ext = path.extname(fileName) || '.jpg';
    const uuid = crypto.randomUUID();
    const storageKey = `${tenantId}/${uuid}${ext}`;
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();

    const signature = crypto
      .createHmac('sha256', this.secretKey)
      .update(`${storageKey}:${expiresAt}`)
      .digest('hex');

    const uploadUrl = `/api/storage/upload?key=${encodeURIComponent(storageKey)}&exp=${expiresAt}&sig=${signature}`;
    const downloadUrl = `${this.baseUrl}/${encodeURIComponent(storageKey)}`;

    return {
      uploadUrl,
      downloadUrl,
      storageKey,
      expiresAt,
    };
  }

  async generateDownloadUrl(storageKey: string, expiresInSeconds = 3600): Promise<string> {
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();
    const signature = crypto
      .createHmac('sha256', this.secretKey)
      .update(`dl:${storageKey}:${expiresAt}`)
      .digest('hex');
    return `${this.baseUrl}/${encodeURIComponent(storageKey)}?exp=${expiresAt}&sig=${signature}`;
  }

  async saveBuffer(
    buffer: Buffer,
    fileName: string,
    mimeType: string,
    tenantId: string
  ): Promise<FileMetadata> {
    const validation = this.validateFile(mimeType, buffer.length);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const ext = path.extname(fileName) || '.jpg';
    const id = crypto.randomUUID();
    const storageKey = `${tenantId}/${id}${ext}`;
    const targetPath = path.join(this.baseDir, storageKey);

    const targetDir = path.dirname(targetPath);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    fs.writeFileSync(targetPath, buffer);

    return {
      id,
      originalName: fileName,
      mimeType,
      sizeBytes: buffer.length,
      storageKey,
      url: `${this.baseUrl}/${encodeURIComponent(storageKey)}`,
      uploadedBy: 'system',
      uploadedAt: new Date().toISOString(),
      tenantId,
    };
  }

  async deleteFile(storageKey: string): Promise<boolean> {
    const targetPath = path.join(this.baseDir, storageKey);
    if (fs.existsSync(targetPath)) {
      fs.unlinkSync(targetPath);
      return true;
    }
    return false;
  }
}

export const defaultStorageProvider = new LocalStorageProvider();

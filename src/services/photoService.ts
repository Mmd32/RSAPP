import { EvidencePhoto } from '../types';
import { apiFetch } from './apiClient';

/**
 * Longest edge after downscaling. A phone photo is 3–5 MB and far larger than
 * any audit needs; 1600px keeps a shelf label or a damaged fitting readable
 * while cutting the file to roughly a fifteenth of its size. That difference
 * decides whether an auditor on mobile data inside a store can work at all.
 */
const MAX_EDGE_PX = 1600;
const ENCODE_QUALITY = 0.75;
const PENDING_QUEUE_KEY = 'rsapp_pending_photos_v1';

export type PhotoUploadState = 'compressing' | 'uploading' | 'uploaded' | 'pending' | 'failed';

/** A photo as the friction sheet tracks it, before and after upload. */
export interface TrackedPhoto extends EvidencePhoto {
  state: PhotoUploadState;
  /** Object URL for immediate preview; revoked once the photo is dropped. */
  localUrl?: string;
  error?: string;
  sizeBytes?: number;
}

interface PendingUpload {
  id: string;
  dataUrl: string;
  mimeType: string;
  visitId?: string;
  indicatorCode?: string;
  caption?: string;
}

/**
 * Downscales and re-encodes an image in the browser before upload.
 * Falls back to the original file if anything goes wrong — a slightly large
 * photo is far better than a lost one.
 */
export async function compressImage(file: File): Promise<{ blob: Blob; mimeType: string }> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE_PX / Math.max(bitmap.width, bitmap.height));

    // Already small enough: re-encoding would only lose quality.
    if (scale === 1 && file.size <= 400 * 1024) {
      bitmap.close?.();
      return { blob: file, mimeType: file.type };
    }

    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas unavailable');
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    // WebP is materially smaller than JPEG at the same visual quality, which
    // matters most on the mobile connection an auditor is actually using.
    // Older browsers silently hand back a PNG instead of the format asked for,
    // so the result is checked rather than trusted.
    const blob =
      (await encodeCanvas(canvas, 'image/webp')) ?? (await encodeCanvas(canvas, 'image/jpeg'));
    if (!blob) throw new Error('encoding failed');

    return { blob, mimeType: blob.type };
  } catch {
    return { blob: file, mimeType: file.type || 'image/jpeg' };
  }
}

/** Encodes a canvas, returning null when the browser substituted another format. */
async function encodeCanvas(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, type, ENCODE_QUALITY)
  );
  return blob && blob.type === type ? blob : null;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      // Strip the "data:<mime>;base64," prefix the API does not want.
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function readQueue(): PendingUpload[] {
  try {
    const raw = localStorage.getItem(PENDING_QUEUE_KEY);
    return raw ? (JSON.parse(raw) as PendingUpload[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(queue: PendingUpload[]) {
  try {
    localStorage.setItem(PENDING_QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // Storage full or blocked: the photo stays only in this session.
  }
}

/**
 * Uploads one photo. On failure the compressed bytes are queued in
 * localStorage so an audit done with no signal still keeps its evidence, and
 * `flushPendingPhotos` sends it once connectivity returns.
 */
export async function uploadPhoto(
  blob: Blob,
  mimeType: string,
  context: { tenantId: string; visitId?: string; indicatorCode?: string; caption?: string }
): Promise<{ url: string; id: string; pending: boolean }> {
  const localId = `photo_local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    const base64 = await blobToBase64(blob);
    const res = await apiFetch('/photos', {
      method: 'POST',
      body: JSON.stringify({
        data: base64,
        mimeType,
        visitId: context.visitId,
        indicatorCode: context.indicatorCode,
      }),
      tenantId: context.tenantId,
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `HTTP ${res.status}`);
    }

    const meta = await res.json();
    return { url: meta.url, id: meta.id, pending: false };
  } catch (err) {
    // Offline or server error: keep the bytes and retry later.
    const dataUrl = await blobToDataUrl(blob);
    writeQueue([
      ...readQueue(),
      {
        id: localId,
        dataUrl,
        mimeType,
        visitId: context.visitId,
        indicatorCode: context.indicatorCode,
        caption: context.caption,
      },
    ]);
    return { url: dataUrl, id: localId, pending: true };
  }
}

/** Number of photos waiting to be uploaded, for showing a status hint. */
export function pendingPhotoCount(): number {
  return readQueue().length;
}

/**
 * Retries every queued photo. Returns a map of local id to final URL so the
 * caller can rewrite the references held in its visit session.
 */
export async function flushPendingPhotos(tenantId: string): Promise<Record<string, string>> {
  const queue = readQueue();
  if (queue.length === 0) return {};

  const resolved: Record<string, string> = {};
  const stillPending: PendingUpload[] = [];

  for (const item of queue) {
    try {
      const base64 = item.dataUrl.slice(item.dataUrl.indexOf(',') + 1);
      const res = await apiFetch('/photos', {
        method: 'POST',
        body: JSON.stringify({
          data: base64,
          mimeType: item.mimeType,
          visitId: item.visitId,
          indicatorCode: item.indicatorCode,
        }),
        tenantId,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const meta = await res.json();
      resolved[item.id] = meta.url;
    } catch {
      stillPending.push(item);
    }
  }

  writeQueue(stillPending);
  return resolved;
}

export function deletePhoto(id: string, tenantId: string): void {
  // Drop it from the offline queue too, in case it never reached the server.
  writeQueue(readQueue().filter((p) => p.id !== id));

  if (id.startsWith('photo_local_')) return;
  apiFetch(`/photos/${id}`, { method: 'DELETE', tenantId }).catch(() => {
    // A leftover row is harmless; the photo is already gone from the report.
  });
}

export function formatBytes(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} بایت`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} کیلوبایت`;
  return `${(bytes / 1024 / 1024).toFixed(1)} مگابایت`;
}

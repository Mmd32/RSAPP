import { VisitSession } from '../types';
import { apiFetch, apiUrl } from './apiClient';

const SYNC_DEBOUNCE_MS = 2500;

/**
 * Syncs questionnaire sessions to the backend.
 *
 * A visit carries its whole indicator set, so one session is hundreds of
 * kilobytes. Posting it on every answer would mean tens of megabytes of upload
 * over a single audit — unworkable on a phone in a store. Writes are therefore
 * coalesced: the latest state is kept and sent once the auditor pauses, and
 * flushed immediately at the points that matter (submit, approve, leaving the
 * page).
 *
 * localStorage remains the immediate, authoritative copy, so a failed or
 * pending sync never loses an answer.
 */
class VisitSyncService {
  private pending: VisitSession | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private inFlight: Promise<void> | null = null;
  private listeners = new Set<(state: 'idle' | 'pending' | 'error') => void>();

  /** Subscribes to sync state so the UI can show whether work is unsaved. */
  onStateChange(listener: (state: 'idle' | 'pending' | 'error') => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(state: 'idle' | 'pending' | 'error') {
    this.listeners.forEach((l) => l(state));
  }

  /** Queues a session; the newest state wins and is sent after a short pause. */
  queue(session: VisitSession, tenantId: string): void {
    this.pending = session;
    this.emit('pending');

    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(tenantId), SYNC_DEBOUNCE_MS);
  }

  /** The server's reason for the last refusal, for the person to read. */
  lastError: string | null = null;

  /**
   * Sends the queued session now. Used on submit, approve and page hide.
   * Resolves true once nothing is left waiting (sent, or nothing queued) and
   * false when the server could not take it. A refusal that may pass (offline,
   * server trouble, expired sign-in) is kept and retried; a final refusal (for
   * example a visit that was already submitted) is reported and dropped.
   *
   * If a send is already in flight, waits for it and then sends whatever is
   * queued. Returning early there used to strand a milestone (e.g. SUBMITTED)
   * that arrived while an ordinary autosave was on the wire.
   */
  async flush(tenantId: string): Promise<boolean> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    while (this.inFlight) await this.inFlight;
    if (!this.pending) return true;

    const session = this.pending;
    this.pending = null;
    let ok = false;

    this.inFlight = (async () => {
      try {
        const res = await apiFetch('/visits', {
          method: 'POST',
          body: JSON.stringify(session),
          tenantId,
        });
        ok = res.ok;
        if (res.ok) {
          this.lastError = null;
          this.retries = 0;
        } else {
          const body = await res.json().catch(() => ({}));
          this.lastError = body?.error || `ذخیره روی سرور انجام نشد (${res.status}).`;
          // Worth another try later: sign-in expired, throttled, or the server had trouble.
          if ((res.status === 401 || res.status === 408 || res.status === 429 || res.status >= 500) && !this.pending) {
            this.pending = session;
            this.scheduleRetry(tenantId);
          }
        }
        this.emit(res.ok ? 'idle' : 'error');
      } catch {
        // Offline: localStorage already holds the answers, so re-queue (unless a
        // newer state arrived meanwhile) and retry shortly.
        this.lastError = 'اتصال به سرور برقرار نیست؛ پاسخ‌ها روی همین دستگاه ذخیره شده‌اند.';
        if (!this.pending) this.pending = session;
        this.scheduleRetry(tenantId);
        this.emit('error');
      }
    })();
    try {
      await this.inFlight;
    } finally {
      this.inFlight = null;
    }
    return ok;
  }

  private retries = 0;
  private scheduleRetry(tenantId: string) {
    if (this.timer) return;
    this.retries += 1;
    const wait = Math.min(60000, 4000 * 2 ** Math.min(this.retries, 4));
    this.timer = setTimeout(() => {
      this.timer = null;
      this.flush(tenantId).catch(() => undefined);
    }, wait);
  }

  /**
   * Best-effort send during page unload, where fetch is unreliable.
   * sendBeacon survives the page going away.
   */
  flushOnUnload(tenantId: string): void {
    if (!this.pending || typeof navigator.sendBeacon !== 'function') return;
    try {
      const blob = new Blob([JSON.stringify(this.pending)], { type: 'application/json' });
      // sendBeacon cannot set headers, so the tenant travels in the query.
      navigator.sendBeacon(`${apiUrl('/visits')}?tenantId=${encodeURIComponent(tenantId)}`, blob);
      this.pending = null;
    } catch {
      // Nothing further to try; localStorage still holds the session.
    }
  }

  hasPendingWork(): boolean {
    return this.pending !== null;
  }
}

export const VisitSync = new VisitSyncService();

/** Loads previously saved questionnaires for the tenant, newest first. */
export async function fetchPastVisits(tenantId: string): Promise<VisitSession[]> {
  const res = await apiFetch(`/visits?tenantId=${encodeURIComponent(tenantId)}`, { tenantId });
  if (!res.ok) {
    throw new Error(`Could not load visits (HTTP ${res.status})`);
  }
  const visits: VisitSession[] = await res.json();
  if (!Array.isArray(visits)) return [];

  return visits.sort(
    (a, b) => new Date(b.startedAt || 0).getTime() - new Date(a.startedAt || 0).getTime()
  );
}

/** Answered-question progress for a session, used by the archive list. */
export function visitProgress(visit: VisitSession): { answered: number; total: number; percent: number } {
  const total = visit.indicators?.length || 0;
  const answered = Object.values(visit.responses || {}).filter(
    (r) => r.answerState !== 'UNANSWERED'
  ).length;
  return {
    answered,
    total,
    percent: total > 0 ? Math.round((answered / total) * 100) : 0,
  };
}

export function visitFrictionCount(visit: VisitSession): number {
  return Object.values(visit.responses || {}).filter((r) => r.answerState === 'FRICTION').length;
}

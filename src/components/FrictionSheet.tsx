import React, { useState, useRef, useEffect } from 'react';
import { Indicator, QuestionResponse, EvidencePhoto } from '../types';
import {
  X,
  Camera,
  Image,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Bookmark,
  Sparkles,
  HelpCircle,
  Loader2,
  CloudOff,
  RotateCw,
} from 'lucide-react';
import {
  compressImage,
  uploadPhoto,
  deletePhoto,
  formatBytes,
  TrackedPhoto,
} from '../services/photoService';
import { PHOTOS_REQUIRED } from '../config/policy';

interface FrictionSheetProps {
  indicator: Indicator;
  currentResponse?: QuestionResponse;
  isOpen: boolean;
  /** Tenant and visit the evidence belongs to, sent with each upload. */
  tenantId: string;
  visitId?: string;
  onClose: () => void;
  onSave: (data: {
    comment: string;
    recommendation: string;
    photos: EvidencePhoto[];
    isFlagged: boolean;
  }) => void;
}

export const FrictionSheet: React.FC<FrictionSheetProps> = ({
  indicator,
  currentResponse,
  isOpen,
  tenantId,
  visitId,
  onClose,
  onSave,
}) => {
  const [comment, setComment] = useState(currentResponse?.comment || '');
  const [recommendation, setRecommendation] = useState(
    currentResponse?.recommendation || ''
  );
  const [photos, setPhotos] = useState<TrackedPhoto[]>(
    () => (currentResponse?.photos || []).map((p) => ({ ...p, state: 'uploaded' as const }))
  );
  const [isFlagged, setIsFlagged] = useState<boolean>(
    currentResponse?.isFlagged || false
  );
  const [photoError, setPhotoError] = useState<string | null>(null);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // Preview URLs are held by the browser until explicitly released.
  useEffect(() => {
    return () => {
      photos.forEach((p) => p.localUrl && URL.revokeObjectURL(p.localUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Compresses and uploads one selected file, tracking its state for the UI. */
  const processFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setPhotoError('فقط فایل تصویری می‌توان افزود.');
      return;
    }

    const id = `photo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const localUrl = URL.createObjectURL(file);

    // Show the thumbnail straight away; the auditor should never wait on the
    // network to see that their photo was taken.
    setPhotos((prev) => [
      ...prev,
      {
        id,
        url: localUrl,
        localUrl,
        caption: `شاهد نقص در ${indicator.subject}`,
        timestamp: new Date().toLocaleTimeString('fa-IR'),
        state: 'compressing',
      },
    ]);
    setPhotoError(null);

    const { blob, mimeType } = await compressImage(file);

    setPhotos((prev) =>
      prev.map((p) => (p.id === id ? { ...p, state: 'uploading', sizeBytes: blob.size } : p))
    );

    const result = await uploadPhoto(blob, mimeType, {
      tenantId,
      visitId,
      indicatorCode: indicator.code,
    });

    setPhotos((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              id: result.pending ? p.id : result.id,
              url: result.url,
              state: result.pending ? 'pending' : 'uploaded',
            }
          : p
      )
    );
  };

  const handleFilesSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    // Reset so picking the same file twice still fires a change event.
    event.target.value = '';
    for (const file of files) {
      await processFile(file);
    }
  };

  const handleRetryPhoto = async (photo: TrackedPhoto) => {
    if (!photo.localUrl) return;
    setPhotos((prev) => prev.map((p) => (p.id === photo.id ? { ...p, state: 'uploading' } : p)));

    try {
      const blob = await fetch(photo.localUrl).then((r) => r.blob());
      const result = await uploadPhoto(blob, blob.type || 'image/jpeg', {
        tenantId,
        visitId,
        indicatorCode: indicator.code,
      });
      setPhotos((prev) =>
        prev.map((p) =>
          p.id === photo.id
            ? {
                ...p,
                id: result.pending ? p.id : result.id,
                url: result.url,
                state: result.pending ? 'pending' : 'uploaded',
              }
            : p
        )
      );
    } catch {
      setPhotos((prev) => prev.map((p) => (p.id === photo.id ? { ...p, state: 'failed' } : p)));
    }
  };

  const handleRemovePhoto = (id: string) => {
    const photo = photos.find((p) => p.id === id);
    if (photo?.localUrl) URL.revokeObjectURL(photo.localUrl);
    deletePhoto(id, tenantId);
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  };

  const handleUpdateCaption = (id: string, caption: string) => {
    setPhotos((prev) =>
      prev.map((p) => (p.id === id ? { ...p, caption } : p))
    );
  };

  // Escape closes the sheet, like any dialog.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const isPhotoBlocked = PHOTOS_REQUIRED && indicator.requiresPhoto && photos.length === 0;

  const handleFinalSave = () => {
    onSave({
      comment,
      recommendation,
      photos,
      isFlagged,
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="bottom-sheet-backdrop" onClick={onClose}>
      <div
        className="bottom-sheet-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`جزئیات اصطکاک ${indicator.code}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="indicator-code-badge">
              {indicator.code}
            </span>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--theme-text-primary)' }}>جزئیات اصطکاک (اختیاری)</h2>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{indicator.subject}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'var(--theme-nav-btn-bg)',
              border: '1px solid var(--theme-nav-btn-border)',
              borderRadius: '50%',
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--theme-text-primary)',
              cursor: 'pointer',
              transition: 'all var(--rs-duration-micro) var(--rs-ease-standard)',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* 2. EVIDENCE CAPTURE (Camera / Gallery / Thumbnails) */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)' }}>
              مستندات و عکس‌های شاهد:
            </label>
            {indicator.requiresPhoto && (
              <span style={{ fontSize: 11, color: 'var(--rs-color-brand-cyan)', fontWeight: 600 }}>
                {PHOTOS_REQUIRED ? '(الزامی)' : '(توصیه‌شده)'}
              </span>
            )}
          </div>

          {/* `capture` opens the rear camera directly on a phone; on desktop
              both inputs fall back to the file picker. */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFilesSelected}
            style={{ display: 'none' }}
          />
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFilesSelected}
            style={{ display: 'none' }}
          />

          <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="btn-secondary"
              style={{ flex: 1, minHeight: 44, justifyContent: 'center' }}
              aria-label="عکاسی با دوربین"
            >
              <Camera size={18} color="var(--rs-color-brand-cyan)" />
              عکاسی با دوربین
            </button>

            <button
              type="button"
              onClick={() => galleryInputRef.current?.click()}
              className="btn-secondary"
              style={{ flex: 1, minHeight: 44, justifyContent: 'center' }}
              aria-label="انتخاب عکس از گالری"
            >
              <Image size={18} color="var(--rs-color-brand-cyan)" />
              انتخاب از گالری
            </button>
          </div>

          {photos.some((p) => p.state === 'pending') && (
            <div className="photo-offline-note" role="status">
              <CloudOff size={15} />
              <span>
                عکس‌ها روی این دستگاه ذخیره شدند و به‌محض وصل شدن اینترنت خودکار ارسال می‌شوند.
              </span>
            </div>
          )}

          {/* Photo requirement blocker alert */}
          {photoError && (
            <div style={{ background: 'rgba(217, 74, 86, 0.15)', border: '1px solid var(--rs-color-error)', borderRadius: 'var(--rs-radius-card)', padding: '8px 12px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--friction-high)' }}>
              <AlertCircle size={16} color="var(--rs-color-error)" />
              <span>{photoError}</span>
            </div>
          )}

          {/* Thumbnails Gallery */}
          {photos.length > 0 && (
            <div className="photo-gallery-grid">
              {photos.map((p) => (
                <div key={p.id} className={`photo-thumb-card state-${p.state}`}>
                  <img src={p.localUrl || p.url} alt={p.caption || 'شاهد نقص'} loading="lazy" />

                  {(p.state === 'compressing' || p.state === 'uploading') && (
                    <div className="photo-thumb-overlay" role="status">
                      <Loader2 size={18} className="photo-spinner" />
                      <span>{p.state === 'compressing' ? 'فشرده‌سازی…' : 'در حال ارسال…'}</span>
                    </div>
                  )}

                  {p.state === 'pending' && (
                    <div className="photo-thumb-badge pending" title="در انتظار ارسال">
                      <CloudOff size={11} />
                      در انتظار
                    </div>
                  )}

                  {p.state === 'failed' && (
                    <button
                      type="button"
                      className="photo-thumb-overlay failed"
                      onClick={() => handleRetryPhoto(p)}
                      aria-label="تلاش مجدد برای ارسال عکس"
                    >
                      <RotateCw size={18} />
                      <span>تلاش مجدد</span>
                    </button>
                  )}

                  {p.state === 'uploaded' && p.sizeBytes && (
                    <div className="photo-thumb-badge size">{formatBytes(p.sizeBytes)}</div>
                  )}

                  <button
                    type="button"
                    onClick={() => handleRemovePhoto(p.id)}
                    className="photo-thumb-delete"
                    aria-label={`حذف عکس ${p.caption || ''}`}
                    title="حذف عکس"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 3. DESCRIPTION / COMMENT */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: 4 }}>
            شرح نقص و مشاهدات ارزیاب (اختیاری):
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="friction-textarea"
            placeholder="توضیح دهید مشکل دقیقاً چه بود؟ در چه مکانی مشاهده شد؟..."
            rows={3}
          />
        </div>

        {/* 4. RECOMMENDATION */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: 4 }}>
            راهکار پیشنهادی برای رفع اصطکاک (اختیاری):
          </label>
          <textarea
            value={recommendation}
            onChange={(e) => setRecommendation(e.target.value)}
            className="friction-textarea"
            placeholder="اقدام اصلاحی، تعویض، تعمیر یا آموزش مورد نیاز..."
            rows={2}
          />
        </div>

        {/* 5. REVIEW LATER CHECKBOX */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, cursor: 'pointer' }} onClick={() => setIsFlagged(!isFlagged)}>
          <input
            type="checkbox"
            checked={isFlagged}
            onChange={() => {}}
            style={{ width: 18, height: 18, accentColor: 'var(--rs-color-warning)' }}
          />
          <span style={{ fontSize: 13, color: 'var(--text-main)', userSelect: 'none' }}>
            نشانه‌گذاری برای بازبینی بعدی
          </span>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 10, paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary"
            style={{ flex: 1, minHeight: 48, justifyContent: 'center' }}
          >
            بستن
          </button>

          <button
            type="button"
            onClick={handleFinalSave}
            className="btn-primary"
            style={{
              flex: 1.5,
              minHeight: 48,
              justifyContent: 'center',
              background: isPhotoBlocked ? 'var(--surface-disabled)' : 'var(--rs-color-action-primary)',
              color: isPhotoBlocked ? 'var(--text-on-disabled)' : '#fff',
              cursor: isPhotoBlocked ? 'not-allowed' : 'pointer',
              boxShadow: 'none',
            }}
          >
            <CheckCircle2 size={18} />
            ذخیرهٔ جزئیات
          </button>
        </div>
      </div>
    </div>
  );
};

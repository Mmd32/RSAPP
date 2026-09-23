import React, { useState } from 'react';
import { Indicator, QuestionResponse, SeverityLevel, EvidencePhoto } from '../types';
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
} from 'lucide-react';

interface FrictionSheetProps {
  indicator: Indicator;
  currentResponse?: QuestionResponse;
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    severity: SeverityLevel;
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
  onClose,
  onSave,
}) => {
  if (!isOpen) return null;

  const [severity, setSeverity] = useState<SeverityLevel>(
    currentResponse?.severity || 'MEDIUM'
  );
  const [comment, setComment] = useState(currentResponse?.comment || '');
  const [recommendation, setRecommendation] = useState(
    currentResponse?.recommendation || ''
  );
  const [photos, setPhotos] = useState<EvidencePhoto[]>(
    currentResponse?.photos || []
  );
  const [isFlagged, setIsFlagged] = useState<boolean>(
    currentResponse?.isFlagged || false
  );
  const [photoError, setPhotoError] = useState<string | null>(null);

  const handleAddPhoto = (source: 'camera' | 'gallery') => {
    const palette = ['#0F766E', '#1D4ED8', '#B91C1C', '#C2410C', '#4C1D95'];
    const color = palette[photos.length % palette.length];
    const sourceLabel = source === 'camera' ? 'دوربین زنده' : 'گالری تصاویر';

    const svgData = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240" fill="${encodeURIComponent(
      color
    )}"><rect width="100%" height="100%"/><text x="50%" y="45%" fill="white" font-size="15" font-weight="bold" font-family="sans-serif" text-anchor="middle">شاهد عینی ${
      photos.length + 1
    } (${indicator.code})</text><text x="50%" y="60%" fill="rgba(255,255,255,0.8)" font-size="12" font-family="sans-serif" text-anchor="middle">${sourceLabel}</text></svg>`;

    const newPhoto: EvidencePhoto = {
      id: 'photo_' + Date.now(),
      url: svgData,
      caption: `شاهد نقص در ${indicator.subject}`,
      timestamp: new Date().toLocaleTimeString('fa-IR'),
    };

    setPhotos((prev) => [...prev, newPhoto]);
    setPhotoError(null);
  };

  const handleRemovePhoto = (id: string) => {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  };

  const handleUpdateCaption = (id: string, caption: string) => {
    setPhotos((prev) =>
      prev.map((p) => (p.id === id ? { ...p, caption } : p))
    );
  };

  const isPhotoBlocked = indicator.requiresPhoto && photos.length === 0;

  const handleFinalSave = () => {
    if (isPhotoBlocked) {
      setPhotoError('ثبت حداقل یک عکس برای این شاخص الزامی است.');
      return;
    }

    onSave({
      severity,
      comment,
      recommendation,
      photos,
      isFlagged,
    });
    onClose();
  };

  const handleSaveDraft = () => {
    onSave({
      severity,
      comment,
      recommendation,
      photos,
      isFlagged,
    });
    onClose();
  };

  return (
    <div className="bottom-sheet-backdrop" onClick={onClose}>
      <div
        className="bottom-sheet-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: '90vh', overflowY: 'auto' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="code-tag" style={{ background: 'rgba(217, 74, 86, 0.15)', color: 'var(--rs-color-error)', padding: '3px 8px', borderRadius: 'var(--rs-radius-control)', fontWeight: 800 }}>
              {indicator.code}
            </span>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--theme-text-primary)' }}>ثبت و تکمیل اصطکاک (Friction)</h2>
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

        {/* 1. SEVERITY SELECTION (4 explicit cards with microcopy) */}
        <div style={{ marginBottom: 18 }}>
          <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: 4 }}>
            سطح شدت اصطکاک (Severity):
          </label>
          <div className="severity-card-grid">
            {/* LOW */}
            <div
              className={`severity-card low ${severity === 'LOW' ? 'selected' : ''}`}
              onClick={() => setSeverity('LOW')}
            >
              <div className="severity-card-title">
                <span style={{ color: severity === 'LOW' ? 'var(--rs-color-brand-cyan)' : 'var(--text-main)' }}>کم (Low)</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-dim)' }}>جریمه ×۱</span>
              </div>
              <p className="severity-card-desc">اثر محدود روی تجربه مشتری</p>
            </div>

            {/* MEDIUM */}
            <div
              className={`severity-card medium ${severity === 'MEDIUM' ? 'selected' : ''}`}
              onClick={() => setSeverity('MEDIUM')}
            >
              <div className="severity-card-title">
                <span style={{ color: severity === 'MEDIUM' ? 'var(--rs-color-warning)' : 'var(--text-main)' }}>متوسط (Medium)</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-dim)' }}>جریمه ×۲</span>
              </div>
              <p className="severity-card-desc">اثر محسوس بر ارزیابی و خرید</p>
            </div>

            {/* HIGH */}
            <div
              className={`severity-card high ${severity === 'HIGH' ? 'selected' : ''}`}
              onClick={() => setSeverity('HIGH')}
            >
              <div className="severity-card-title">
                <span style={{ color: severity === 'HIGH' ? '#EA580C' : 'var(--text-main)' }}>زیاد (High)</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-dim)' }}>جریمه ×۳</span>
              </div>
              <p className="severity-card-desc">مانع مهم تجربه مشتری و نارضایتی</p>
            </div>

            {/* CRITICAL */}
            <div
              className={`severity-card critical ${severity === 'CRITICAL' ? 'selected' : ''}`}
              onClick={() => setSeverity('CRITICAL')}
            >
              <div className="severity-card-title">
                <span style={{ color: severity === 'CRITICAL' ? 'var(--rs-color-error)' : 'var(--text-main)' }}>بحرانی (Critical)</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-dim)' }}>جریمه ×۴</span>
              </div>
              <p className="severity-card-desc">ریسک جدی، توقف تجربه یا نقص ایمنی</p>
            </div>
          </div>
        </div>

        {/* 2. EVIDENCE CAPTURE (Camera / Gallery / Thumbnails) */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)' }}>
              مستندات و عکس‌های شاهد:
            </label>
            {indicator.requiresPhoto && (
              <span style={{ fontSize: 11, color: 'var(--rs-color-error)', fontWeight: 600 }}>
                * ثبت عکس الزامی است
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
            <button
              type="button"
              onClick={() => handleAddPhoto('camera')}
              className="btn-secondary"
              style={{ flex: 1, minHeight: 44, justifyContent: 'center' }}
            >
              <Camera size={18} color="var(--rs-color-brand-cyan)" />
              عکاسی با دوربین
            </button>

            <button
              type="button"
              onClick={() => handleAddPhoto('gallery')}
              className="btn-secondary"
              style={{ flex: 1, minHeight: 44, justifyContent: 'center' }}
            >
              <Image size={18} color="var(--rs-color-brand-cyan)" />
              انتخاب از گالری
            </button>
          </div>

          {/* Photo requirement blocker alert */}
          {photoError && (
            <div style={{ background: 'rgba(217, 74, 86, 0.15)', border: '1px solid var(--rs-color-error)', borderRadius: 'var(--rs-radius-card)', padding: '8px 12px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#FCA5A5' }}>
              <AlertCircle size={16} color="var(--rs-color-error)" />
              <span>{photoError}</span>
            </div>
          )}

          {/* Thumbnails Gallery */}
          {photos.length > 0 && (
            <div className="photo-gallery-grid">
              {photos.map((p) => (
                <div key={p.id} className="photo-thumb-card">
                  <img src={p.url} alt={p.caption || 'شاهد'} />
                  <button
                    type="button"
                    onClick={() => handleRemovePhoto(p.id)}
                    className="photo-thumb-delete"
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
            شرح دقیق نقص و مشاهدات ارزیاب:
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
            نشانه‌گذاری جهت بازبینی مجدد (Flag for Review Later)
          </span>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 10, paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
          <button
            type="button"
            onClick={handleSaveDraft}
            className="btn-secondary"
            style={{ flex: 1, minHeight: 48, justifyContent: 'center' }}
          >
            ذخیره پیش‌نویس
          </button>

          <button
            type="button"
            onClick={handleFinalSave}
            className="btn-primary"
            style={{
              flex: 1.5,
              minHeight: 48,
              justifyContent: 'center',
              background: isPhotoBlocked ? 'var(--rs-color-navy-700)' : 'var(--rs-color-error)',
              cursor: isPhotoBlocked ? 'not-allowed' : 'pointer',
              boxShadow: isPhotoBlocked ? 'none' : '0 4px 16px rgba(217, 74, 86, 0.4)',
            }}
          >
            <CheckCircle2 size={18} />
            تایید و ثبت اصطکاک
          </button>
        </div>
      </div>
    </div>
  );
};

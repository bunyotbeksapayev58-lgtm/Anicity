'use client';

import { useState, useRef } from 'react';
import * as tus from 'tus-js-client';

export default function BunnyVideoUploader({
  onUploadSuccess,
  episodeTitle = '',
  disabled = false,
}) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [bytesUploaded, setBytesUploaded] = useState(0);
  const [bytesTotal, setBytesTotal] = useState(0);
  const [speedText, setSpeedText] = useState('');
  const [errorMessage, setErrorMessage] = useState(null);
  const [successInfo, setSuccessInfo] = useState(null);

  const fileInputRef = useRef(null);
  const uploadInstanceRef = useRef(null);
  const lastTimeRef = useRef(Date.now());
  const lastLoadedRef = useRef(0);

  const formatBytes = (bytes) => {
    if (!bytes || bytes <= 0) return '0 MB';
    const mb = bytes / (1024 * 1024);
    if (mb < 1024) return `${mb.toFixed(1)} MB`;
    return `${(mb / 1024).toFixed(2)} GB`;
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check video type or extension
    const isVideo = file.type.startsWith('video/') || /\.(mp4|mkv|webm|mov|avi|ts|flv)$/i.test(file.name);
    if (!isVideo) {
      setErrorMessage('Iltimos, faqat video fayl tanlang (MP4, MKV, WebM, MOV)');
      e.target.value = '';
      return;
    }

    setSelectedFile(file);
    setErrorMessage(null);
    setSuccessInfo(null);
    setProgress(0);
    setBytesUploaded(0);
    setBytesTotal(file.size);
  };

  const startUpload = async () => {
    if (!selectedFile) {
      setErrorMessage('Iltimos, avval video faylni tanlang');
      return;
    }

    setIsUploading(true);
    setErrorMessage(null);
    setSuccessInfo(null);
    setProgress(0);
    lastTimeRef.current = Date.now();
    lastLoadedRef.current = 0;

    try {
      // 1. Get Presigned Upload Signature from Backend
      const res = await fetch('/api/admin/bunny/upload-signature', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: episodeTitle || selectedFile.name,
        }),
      });

      const creds = await res.json();

      if (!res.ok || creds.error) {
        throw new Error(creds.error || 'Yuklash ruxsatnomasini olishda xatolik yuz berdi');
      }

      // 2. Initialize TUS Resumable Upload directly to Bunny.net
      const upload = new tus.Upload(selectedFile, {
        endpoint: creds.endpoint || 'https://video.bunnycdn.com/tusupload',
        retryDelays: [0, 2000, 5000, 10000],
        chunkSize: 5 * 1024 * 1024, // 5MB bo‘laklar (chunks)
        headers: {
          AuthorizationSignature: creds.signature,
          AuthorizationExpire: String(creds.expirationTime),
          LibraryId: String(creds.libraryId),
          VideoId: creds.videoId,
        },
        metadata: {
          filetype: selectedFile.type || 'video/mp4',
          title: selectedFile.name,
        },
        onError: (err) => {
          setIsUploading(false);
          setErrorMessage(`Yuklashda xatolik: ${err.message || 'Aloqa uzildi'}`);
        },
        onProgress: (bytesSent, total) => {
          const now = Date.now();
          const elapsed = (now - lastTimeRef.current) / 1000;
          if (elapsed > 0.8) {
            const bytesDiff = bytesSent - lastLoadedRef.current;
            const speed = bytesDiff / elapsed;
            setSpeedText(`${(speed / (1024 * 1024)).toFixed(1)} MB/s`);
            lastTimeRef.current = now;
            lastLoadedRef.current = bytesSent;
          }

          const pct = Math.min(100, Math.round((bytesSent / total) * 100));
          setProgress(pct);
          setBytesUploaded(bytesSent);
          setBytesTotal(total);
        },
        onSuccess: () => {
          setIsUploading(false);
          setProgress(100);
          setSuccessInfo({
            videoId: creds.videoId,
            videoUrl: creds.videoUrl,
          });

          if (onUploadSuccess) {
            onUploadSuccess(creds.videoUrl, creds.videoId);
          }
        },
      });

      uploadInstanceRef.current = upload;
      upload.start();
    } catch (err) {
      setIsUploading(false);
      setErrorMessage(err.message || 'Yuklash jarayonini boshlab bo‘lmadi');
    }
  };

  const cancelUpload = () => {
    if (uploadInstanceRef.current) {
      uploadInstanceRef.current.abort();
      setIsUploading(false);
      setErrorMessage('Yuklash to‘xtatildi');
    }
  };

  return (
    <div
      style={{
        marginTop: 10,
        marginBottom: 16,
        padding: '14px 16px',
        borderRadius: 10,
        background: 'linear-gradient(135deg, rgba(234, 88, 12, 0.08) 0%, rgba(249, 115, 22, 0.03) 100%)',
        border: '1px solid rgba(249, 115, 22, 0.25)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>🐰</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#f97316' }}>
            Bunny.net Stream Serveriga To‘g‘ridan-To‘g‘ri Yuklash
          </span>
        </div>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: 4 }}>
          TUS Resumable Fast Upload
        </span>
      </div>

      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 10px 0', lineHeight: 1.4 }}>
        Video faylni kompyuteringizdan tanlang. Video to‘g‘ridan-to‘g‘ri Bunny.net CDN serveriga yuklanadi va HLS (360p–1080p) formatiga avtomatik aylantiriladi.
      </p>

      {/* File Selector and Action */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          ref={fileInputRef}
          type="file"
          accept="video/mp4,video/mkv,video/webm,video/quicktime,video/*"
          onChange={handleFileChange}
          disabled={isUploading || disabled}
          style={{
            fontSize: 12,
            padding: '6px 10px',
            background: 'var(--bg-card, rgba(0,0,0,0.4))',
            border: '1px solid var(--border-color, rgba(255,255,255,0.1))',
            borderRadius: 6,
            color: 'var(--text-main, #fff)',
            flex: '1 1 200px',
          }}
        />

        {!isUploading ? (
          <button
            type="button"
            onClick={startUpload}
            disabled={!selectedFile || disabled}
            className="btn primary sm"
            style={{
              background: '#ea580c',
              borderColor: '#c2410c',
              fontWeight: 600,
              fontSize: 12,
              padding: '8px 14px',
            }}
          >
            ⬆️ Bunny Serveriga Yuklash
          </button>
        ) : (
          <button
            type="button"
            onClick={cancelUpload}
            className="btn ghost sm"
            style={{
              color: '#ef4444',
              borderColor: 'rgba(239, 68, 68, 0.4)',
              fontSize: 12,
              padding: '8px 14px',
            }}
          >
            ⏹ Bekor qilish
          </button>
        )}
      </div>

      {/* Uploading Progress Bar */}
      {isUploading && (
        <div style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4, color: 'var(--text-main, #fff)' }}>
            <span>
              Yuklanmoqda: <b>{progress}%</b> ({formatBytes(bytesUploaded)} / {formatBytes(bytesTotal)})
            </span>
            {speedText && <span style={{ color: '#f97316', fontWeight: 600 }}>⚡ {speedText}</span>}
          </div>
          <div
            style={{
              height: 8,
              width: '100%',
              background: 'rgba(255,255,255,0.1)',
              borderRadius: 4,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${progress}%`,
                background: 'linear-gradient(90deg, #ea580c, #fb923c)',
                transition: 'width 0.2s ease',
              }}
            />
          </div>
        </div>
      )}

      {/* Success Message */}
      {successInfo && (
        <div
          style={{
            marginTop: 10,
            padding: '8px 12px',
            borderRadius: 6,
            background: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            color: '#10b981',
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span>✓</span>
          <div>
            <b>Video muvaffaqiyatli yuklandi!</b> Video identifikatori quyidagi manzilga avtomatik biriktirildi:{' '}
            <code>{successInfo.videoUrl}</code>
          </div>
        </div>
      )}

      {/* Error Message */}
      {errorMessage && (
        <div
          style={{
            marginTop: 10,
            padding: '8px 12px',
            borderRadius: 6,
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#f87171',
            fontSize: 12,
          }}
        >
          ⚠️ {errorMessage}
        </div>
      )}
    </div>
  );
}

'use client';

import { useState, useTransition } from 'react';
import { analyzeVideoSource } from '@/app/actions/assistant-admin';

export default function AssistantVideoAnalyzer() {
  const [url, setUrl] = useState('');
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();

  const submit = (event) => {
    event.preventDefault();
    setError('');
    setReport(null);
    startTransition(async () => {
      const result = await analyzeVideoSource(url);
      if (result?.error) setError(result.error);
      else setReport(result.report);
    });
  };

  return (
    <section className="card admin-pane" style={{ marginTop: 20 }}>
      <h2 className="admin-pane-title">Video manbasini texnik tekshirish</h2>
      <p className="hint">URL turi va formatini tekshiradi. Video ochilishini, davomiyligini yoki sifatini tekshirmaydi; AI tahlili bajarilmaydi.</p>
      <form onSubmit={submit} className="admin-form-styled">
        <div className="field">
          <label htmlFor="assistant-video-url">Video URL</label>
          <input id="assistant-video-url" type="url" value={url} onChange={(event) => setUrl(event.target.value)} required disabled={pending} />
        </div>
        <button className="btn primary" type="submit" disabled={pending}>{pending ? 'Tekshirilmoqda…' : 'URL ni tekshirish'}</button>
      </form>
      {error && <p className="admin-alert-error" role="alert">{error}</p>}
      {report && (
        <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginTop: 18 }}>
          <div><dt>Manba turi</dt><dd>{report.sourceType}</dd></div>
          <div><dt>Host</dt><dd>{report.sourceHost}</dd></div>
          <div><dt>Format</dt><dd>{report.fileFormat || 'aniqlanmadi'}</dd></div>
          <div><dt>Drive file ID</dt><dd>{report.driveFileId || 'mavjud emas'}</dd></div>
          <div><dt>Davomiylik / aniqlik</dt><dd>tekshirilmagan</dd></div>
          <div><dt>Faylga kirish</dt><dd>tekshirilmagan</dd></div>
        </dl>
      )}
    </section>
  );
}

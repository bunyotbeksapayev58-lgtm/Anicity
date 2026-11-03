'use client';

import { useState, useTransition } from 'react';
import {
  appointAssistant,
  removeAssistant,
  revokeAllAssistantPermissions,
  searchAssistantCandidates,
  updateAssistantPermissions,
} from '@/app/actions/assistant-admin';

const GROUPS = [
  { title: 'Anime va video boshqaruvi', permissions: [
    ['anime_view', 'Anime ma’lumotlarini ko‘rish'], ['anime_create', 'Anime yaratish'],
    ['anime_edit', 'Anime tahrirlash'], ['anime_delete', 'Anime o‘chirish'],
    ['video_upload', 'Video manba URL’ini boshqarish (fayl yuklash mavjud emas)'], ['episode_create', 'Qism yaratish'],
    ['episode_edit', 'Qism tahrirlash'], ['episode_delete', 'Qism o‘chirish'],
    ['video_analyze', 'Video manba URL’ini texnik tekshirish'],
  ] },
  { title: 'Boshqa imkoniyatlar', permissions: [
    ['video_review', 'Video tekshiruvi — Tez orada'],
    ['comment_moderate', 'Izoh moderatsiyasi — Tez orada'], ['report_view', 'Shikoyatlar — Tez orada'],
  ] },
];

export default function AssistantAdminManager({ initialAssistants = [], auditLogs = [] }) {
  const [assistants, setAssistants] = useState(initialAssistants);
  const [query, setQuery] = useState('');
  const [candidates, setCandidates] = useState([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();

  const runAction = (operation) => startTransition(async () => {
    setError('');
    setNotice('');
    const result = await operation();
    if (result?.error) setError(result.error);
    else {
      setNotice(result?.message || 'O‘zgarish saqlandi.');
      window.location.reload();
    }
  });

  const doSearch = () => startTransition(async () => {
    setError('');
    const result = await searchAssistantCandidates(query);
    if (result?.error) setError(result.error);
    else setCandidates(result.candidates || []);
  });

  const changePermission = (assistantId, key, enabled) => {
    setAssistants((items) => items.map((assistant) => assistant.id === assistantId
      ? { ...assistant, permissions: { ...assistant.permissions, [key]: enabled } }
      : assistant));
  };

  const savePermissions = (assistant) => {
    const formData = new FormData();
    formData.set('target_user_id', assistant.id);
    formData.set('permissions', JSON.stringify({
      ...assistant.permissions,
      video_review: false,
      comment_moderate: false,
      report_view: false,
    }));
    runAction(() => updateAssistantPermissions(formData));
  };

  return (
    <div className="assistant-admin-manager">
      <header className="card admin-pane">
        <h2 className="admin-pane-title">Assistant adminlar</h2>
        <p className="hint">Faqat asosiy admin tayinlaydi va ruxsatlarni boshqaradi. Barcha yangi ruxsatlar o‘chiq holatda boshlanadi.</p>
        {error && <p className="admin-alert-error" role="alert">{error}</p>}
        {notice && <p className="admin-alert-success" role="status">{notice}</p>}
        <div className="assistant-candidate-search">
          <input className="search-input-pro" value={query} onChange={(event) => setQuery(event.target.value)} maxLength={100} placeholder="Username yoki ism bo‘yicha qidirish" />
          <button className="btn ghost sm" type="button" onClick={doSearch} disabled={pending}>Qidirish</button>
          <select aria-label="Assistantga tayinlanadigan foydalanuvchi" value={selectedUser} onChange={(event) => setSelectedUser(event.target.value)}>
            <option value="">Foydalanuvchini tanlang</option>
            {candidates.map((candidate) => <option key={candidate.id} value={candidate.id}>@{candidate.username}{candidate.display_name ? ` · ${candidate.display_name}` : ''}</option>)}
          </select>
          <button className="btn primary sm" type="button" disabled={!selectedUser || pending} onClick={() => {
            const data = new FormData(); data.set('target_user_id', selectedUser);
            runAction(() => appointAssistant(data));
          }}>Assistant tayinlash</button>
        </div>
        <button className="btn danger sm" type="button" disabled={pending || assistants.length === 0} onClick={() => {
          if (confirm('Barcha assistantlarning barcha ruxsatlarini darhol bekor qilasizmi?')) {
            runAction(() => revokeAllAssistantPermissions());
          }
        }}>Barcha ruxsatlarni bekor qilish</button>
      </header>

      {assistants.map((assistant) => (
        <section className="card admin-pane assistant-admin-card" key={assistant.id}>
          <div className="assistant-admin-card-header">
            <div>
              <h3>@{assistant.username || 'noma’lum'}{assistant.display_name ? ` · ${assistant.display_name}` : ''}</h3>
              <small>Assistant admin · {new Date(assistant.created_at).toLocaleDateString('uz-UZ')}</small>
            </div>
            <button className="btn danger sm" type="button" disabled={pending} onClick={() => {
              if (confirm(`@${assistant.username} assistant maqomini va barcha ruxsatlarini olib tashlaysizmi?`)) {
                const data = new FormData(); data.set('target_user_id', assistant.id);
                runAction(() => removeAssistant(data));
              }
            }}>Assistantni olib tashlash</button>
          </div>
          {GROUPS.map((group) => (
            <fieldset className="assistant-permission-group" key={group.title}>
              <legend>{group.title}</legend>
              <div className="assistant-permission-grid">
                {group.permissions.map(([key, label]) => {
                  const comingSoon = ['video_review', 'comment_moderate', 'report_view'].includes(key);
                  return <label className="assistant-permission-toggle" key={key}>
                    <span><b>{label}</b><small>{key}{comingSoon ? ' · Coming soon' : ''}</small></span>
                    <input type="checkbox" checked={comingSoon ? false : Boolean(assistant.permissions?.[key])} disabled={comingSoon} onChange={(event) => changePermission(assistant.id, key, event.target.checked)} />
                  </label>;
                })}
              </div>
            </fieldset>
          ))}
          <button className="btn primary sm" type="button" disabled={pending} onClick={() => savePermissions(assistant)}>Ruxsatlarni saqlash</button>
        </section>
      ))}

      <section className="card admin-pane">
        <h3 className="admin-pane-title">Assistant amallari jurnali</h3>
        {auditLogs.length ? (
          <div className="table-wrapper-pro"><table className="pro-table">
            <thead><tr><th>Vaqt</th><th>Actor</th><th>Amal</th><th>Maqsad</th><th>Tafsilot</th></tr></thead>
            <tbody>{auditLogs.map((entry) => <tr key={entry.id}>
              <td>{new Date(entry.created_at).toLocaleString('uz-UZ')}</td>
              <td>{entry.actor_username || entry.actor_id || '—'}</td>
              <td>{entry.action_name}</td>
              <td>{entry.target_username || entry.target_user_id || entry.target_record_id || 'Barcha assistantlar'}</td>
              <td><code>{JSON.stringify(entry.details || {})}</code></td>
            </tr>)}</tbody>
          </table></div>
        ) : <p className="hint">Hozircha jurnal yozuvi yo‘q.</p>}
      </section>
    </div>
  );
}

'use client';

import { useState } from 'react';
import Link from 'next/link';
import AdminAnimeForm from './AdminAnimeForm';
import AdminEpisodeManager from './AdminEpisodeManager';
import { deleteAnime } from '@/app/actions/admin';

export default function AdminAnimeSection({ animes = [], initialSubTab = 'form', initialAnimeId = null }) {
  const [activeSubTab, setActiveSubTab] = useState(initialSubTab); // 'form' | 'episodes' | 'list'
  const [selectedAnimeId, setSelectedAnimeId] = useState(initialAnimeId || animes[0]?.id || '');

  const handleAnimeCreated = (newAnime) => {
    setSelectedAnimeId(newAnime.id);
    setActiveSubTab('episodes');
  };

  const handleManageEpisodes = (animeId) => {
    setSelectedAnimeId(animeId);
    setActiveSubTab('episodes');
  };

  return (
    <div className="admin-anime-section-container">
      {/* Sub tabs navigation */}
      <div className="admin-subtabs-nav">
        <button
          type="button"
          className={`subtab-btn ${activeSubTab === 'form' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('form')}
        >
          ➕ 1-Bosqich: Yangi Anime Yuklash
        </button>

        <button
          type="button"
          className={`subtab-btn ${activeSubTab === 'episodes' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('episodes')}
        >
          📺 2-Bosqich: Qismlar Boshqaruvi
        </button>

        <button
          type="button"
          className={`subtab-btn ${activeSubTab === 'list' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('list')}
        >
          📚 Yuklangan Animelar Ro‘yxati ({animes.length})
        </button>
      </div>

      {/* Subtab 1: Form (Stage A) */}
      {activeSubTab === 'form' && (
        <div className="card admin-pane" style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ marginBottom: 16 }}>
            <h2 className="admin-pane-title">🎬 1-Bosqich: Anime Ma’lumotlarini Kiritish</h2>
            <p className="hint">
              Nom, tavsif, janrlar, yosh chegarasi, studiya va kompyuteringizdan rasm fayllarini yuklang.
              Qismlar bu formaga kiritilmaydi — anime saqlangandan so‘ng 2-bosqichda har bir qism alohida qo‘shiladi.
            </p>
          </div>
          <AdminAnimeForm onAnimeCreated={handleAnimeCreated} />
        </div>
      )}

      {/* Subtab 2: Episode Manager (Stage B) */}
      {activeSubTab === 'episodes' && (
        <div className="episodes-tab-wrap">
          <div style={{ marginBottom: 16 }}>
            <h2 className="admin-pane-title">📺 2-Bosqich: Qismlar (Epizodlar) Boshqaruvi</h2>
            <p className="hint">
              Har bir qism uchun fasl raqami, qism raqami, nomi va unga tegishli alohida Google Drive videosini kiriting.
            </p>
          </div>
          <AdminEpisodeManager animes={animes} initialAnimeId={selectedAnimeId} />
        </div>
      )}

      {/* Subtab 3: List of all animes */}
      {activeSubTab === 'list' && (
        <div className="card admin-pane">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <h2 className="admin-pane-title">📚 Yuklangan Barcha Animelar ({animes.length})</h2>
              <p className="hint">Har qanday animening qismlarini boshqarish yoki tahrirlash uchun tegishli tugmani bosing.</p>
            </div>
            <button
              type="button"
              className="btn primary sm"
              onClick={() => setActiveSubTab('form')}
            >
              ➕ Yangi Anime Qo‘shish
            </button>
          </div>

          {animes.length > 0 ? (
            <div className="admin-items-list">
              {animes.map((a) => (
                <div className="li-admin" key={a.id}>
                  <div className="admin-thumb">
                    {a.poster_url ? (
                      <img src={a.poster_url} alt="" />
                    ) : (
                      <div className="thumb-fallback">{(a.title || 'A').charAt(0)}</div>
                    )}
                  </div>
                  <div className="admin-info">
                    <b>{a.title}</b>
                    <p>
                      {a.year || '—'} • {a.status || 'Ongoing'} •{' '}
                      <span style={{ color: 'var(--accent)', fontWeight: 700 }}>
                        {Array.isArray(a.episodes) ? a.episodes.length : 0} ta qism
                      </span>{' '}
                      • {a.release_day ? `📅 ${a.release_day}` : 'Jadvalsiz'}
                    </p>
                  </div>
                  <div className="admin-actions">
                    <button
                      type="button"
                      className="btn primary sm"
                      onClick={() => handleManageEpisodes(a.id)}
                      title="Qismlarni boshqarish"
                    >
                      📺 Qismlar ({Array.isArray(a.episodes) ? a.episodes.length : 0})
                    </button>
                    <Link href={`/anime/${a.id}`} className="btn ghost sm" target="_blank" title="Saytda ko‘rish">
                      👁️
                    </Link>
                    <Link href={`/admin/${a.id}/edit`} className="btn ghost sm" title="Tahrirlash">
                      ✏️
                    </Link>
                    <form action={deleteAnime}>
                      <input type="hidden" name="id" value={a.id} />
                      <button
                        className="btn danger sm"
                        onClick={(e) => {
                          if (!confirm(`“${a.title}” animeni va barcha qismlarini butunlay o‘chirishni tasdiqlaysizmi?`)) {
                            e.preventDefault();
                          }
                        }}
                        title="O‘chirish"
                      >
                        🗑️
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-muted)' }}>
              Bazada hech qanday anime yo‘q. Yuqoridagi 1-bosqich orqali birinchi animeni qo‘shing.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

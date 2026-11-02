'use client';

import { useState } from 'react';
import Link from 'next/link';

const DAYS = [
  { key: 'dushanba', label: 'Dushanba', short: 'Dush' },
  { key: 'seshanba', label: 'Seshanba', short: 'Sesh' },
  { key: 'chorshanba', label: 'Chorshanba', short: 'Chor' },
  { key: 'payshanba', label: 'Payshanba', short: 'Pay' },
  { key: 'juma', label: 'Juma', short: 'Jum' },
  { key: 'shanba', label: 'Shanba', short: 'Shan' },
  { key: 'yakshanba', label: 'Yakshanba', short: 'Yak' },
];

export default function WeeklySchedule({ animes = [] }) {
  // Determine current day of week (0 is Sunday in JS)
  const dayIndex = new Date().getDay();
  const currentDayKey = dayIndex === 0 ? 'yakshanba' : DAYS[dayIndex - 1]?.key || 'dushanba';

  const [activeDay, setActiveDay] = useState(currentDayKey);

  // Filter animes for the selected day (case-insensitive)
  const scheduledAnimes = animes.filter((a) => {
    if (!a.release_day) return false;
    return a.release_day.toLowerCase().trim() === activeDay;
  });

  return (
    <section id="schedule" className="schedule-pro-section">
      <div className="schedule-header">
        <div className="schedule-title-group">
          <span className="schedule-icon">📅</span>
          <div>
            <h2 className="schedule-title">Haftalik Chiqish Jadvali</h2>
            <p className="schedule-subtitle">
              Har kuni Anicity dublyaj jamoasidan yangi qismlar chiqish vaqtlari
            </p>
          </div>
        </div>
      </div>

      {/* Day Tabs */}
      <div className="schedule-tabs-bar">
        {DAYS.map((d) => {
          const isToday = d.key === currentDayKey;
          const isActive = d.key === activeDay;
          const count = animes.filter((a) => a.release_day?.toLowerCase().trim() === d.key).length;

          return (
            <button
              key={d.key}
              type="button"
              className={`schedule-day-btn ${isActive ? 'active' : ''} ${isToday ? 'today' : ''}`}
              onClick={() => setActiveDay(d.key)}
            >
              <span className="day-name">{d.label}</span>
              <span className="day-short">{d.short}</span>
              {isToday && <span className="today-dot" title="Bugun" />}
              {count > 0 && <span className="day-count-badge">{count}</span>}
            </button>
          );
        })}
      </div>

      {/* Schedule Anime Cards Grid */}
      <div className="schedule-content">
        {scheduledAnimes.length > 0 ? (
          <div className="schedule-grid">
            {scheduledAnimes.map((anime) => (
              <Link key={anime.id} href={`/anime/${anime.id}`} className="schedule-card">
                <div className="schedule-poster-wrap">
                  <img
                    src={anime.poster_url || '/placeholder.jpg'}
                    alt={anime.title}
                    className="schedule-poster"
                    loading="lazy"
                  />
                  <span className="schedule-badge-ongoing">Yangi qism</span>
                  <span className="schedule-badge-team">{anime.fandub_team || 'Anicity Dub'}</span>
                </div>
                <div className="schedule-card-info">
                  <h3 className="schedule-anime-title">{anime.title}</h3>
                  <div className="schedule-meta-row">
                    <span className="meta-genre">{anime.genres?.[0] || 'Anime'}</span>
                    <span className="meta-dot">•</span>
                    <span className="meta-studio">{anime.studio || `${anime.year}-yil`}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="schedule-empty-box">
            <span className="empty-clock-icon">🕒</span>
            <h4 className="empty-schedule-title">
              {DAYS.find((d) => d.key === activeDay)?.label} kuniga hozircha premyera rejalashtirilmagan
            </h4>
            <p className="empty-schedule-desc">
              Dublyaj jamoamiz yangi qismlarni tez orada jadvalga kiritadi.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

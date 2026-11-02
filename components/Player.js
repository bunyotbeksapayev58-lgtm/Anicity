'use client';
import { useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';

// Ko'rish holatini saqlaydi: qaysi daqiqada to'xtagan, tugallanganmi
export default function Player({ src, userId, animeId, episodeId, startAt = 0, nextHref }) {
  const videoRef = useRef(null);
  const lastSave = useRef(0);
  const supabase = useRef(null);

  useEffect(() => {
    supabase.current = createClient();
    const v = videoRef.current;
    if (!v) return;
    const onMeta = () => {
      // Oxirgi daqiqaga yaqin bo'lsa boshidan boshlaydi
      if (startAt > 5 && startAt < v.duration - 10) v.currentTime = startAt;
    };
    v.addEventListener('loadedmetadata', onMeta);
    return () => v.removeEventListener('loadedmetadata', onMeta);
  }, [startAt]);

  async function save({ force = false, completed = false } = {}) {
    const v = videoRef.current;
    if (!v || !v.duration || !supabase.current) return;
    const now = Date.now();
    if (!force && now - lastSave.current < 5000) return;
    lastSave.current = now;

    await supabase.current.from('watch_progress').upsert({
      user_id: userId,
      episode_id: episodeId,
      anime_id: animeId,
      position_sec: v.currentTime,
      duration_sec: v.duration,
      completed: completed || v.currentTime / v.duration > 0.92,
      updated_at: new Date().toISOString(),
    });
  }

  return (
    <video
      ref={videoRef}
      src={src}
      controls
      playsInline
      onTimeUpdate={() => save()}
      onPause={() => save({ force: true })}
      onEnded={async () => {
        await save({ force: true, completed: true });
        if (nextHref) window.location.href = nextHref;
      }}
    />
  );
}

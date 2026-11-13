import { createClient } from '@supabase/supabase-js';
import { requireLiveTestConfig } from './live-safety.mjs';

let liveConfig;
try {
  liveConfig = requireLiveTestConfig();
} catch (e) {
  console.log('Skipping live audit: ' + e.message);
  process.exit(0);
}

async function runLiveAudit() {
  const supabase = createClient(
    liveConfig.supabaseUrl,
    liveConfig.anonKey
  );

  const { data: auth, error } = await supabase.auth.signInWithPassword({
    email: liveConfig.userEmail,
    password: liveConfig.userPassword,
  });
  if (error) throw error;

  console.log('✔ Dedicated QA account authenticated successfully');

  // Check animes with episodes
  const { data: animes } = await supabase
    .from('animes')
    .select('id, title, episodes(id, number, title, video_url)')
    .limit(3);

  console.log('\n--- VERIFYING VIDEO URLS IN PRODUCTION DATABASE ---');
  for (const a of animes || []) {
    console.log(`Anime: "${a.title}" (ID: ${a.id})`);
    for (const ep of a.episodes || []) {
      const isDrive = ep.video_url?.includes('drive.google.com');
      const isDirect = /\.(mp4|webm)/i.test(ep.video_url || '');
      console.log(`  - Episode ${ep.number}: ${ep.title || 'Untitled'}`);
      let sourceHost = 'invalid-or-unknown';
      try { sourceHost = new URL(ep.video_url).hostname; } catch {}
      console.log(`    Source host: ${sourceHost}`);
      console.log(`    Type: ${isDrive ? 'Google Drive Embed' : isDirect ? 'Direct HTML5 Video' : 'Other'}`);
    }
  }

  // Check banners
  console.log('\n--- VERIFYING BANNERS IN PRODUCTION DATABASE ---');
  const { data: banners } = await supabase
    .from('banners')
    .select('id, title, subtitle, image_url, video_url, is_active, sort_order');
  console.log(`Found ${banners?.length || 0} banners:`);
  for (const b of banners || []) {
    console.log(`  - Banner: "${b.title}" (Image: ${Boolean(b.image_url)}, Video: ${Boolean(b.video_url)}, Active: ${b.is_active})`);
  }
}

runLiveAudit().catch(console.error);

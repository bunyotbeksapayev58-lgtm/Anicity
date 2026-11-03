import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const envContent = fs.readFileSync('.env.local', 'utf-8');
for (const line of envContent.split('\n')) {
  const [k, ...rest] = line.split('=');
  if (k && rest) process.env[k.trim()] = rest.join('=').trim();
}

async function runLiveAudit() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  const { data: auth, error } = await supabase.auth.signInWithPassword({
    email: 'sapayev1231@gmail.com',
    password: 'sapayev3112',
  });
  if (error) throw error;

  console.log('✔ Admin authenticated successfully: @' + auth.user.email);

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
      console.log(`    URL: ${ep.video_url?.slice(0, 50)}...`);
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

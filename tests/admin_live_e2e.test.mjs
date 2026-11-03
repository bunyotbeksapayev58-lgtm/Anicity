import assert from 'node:assert';
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

// Read from .env.local
const envContent = fs.readFileSync('.env.local', 'utf-8');
for (const line of envContent.split('\n')) {
  const [k, ...rest] = line.split('=');
  if (k && rest) process.env[k.trim()] = rest.join('=').trim();
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  console.log('--- ADMIN LIVE DATABASE & DECOUPLED WORKFLOW TEST ---');

  // 1. Authenticate as Admin
  console.log('1. Signing in with sapayev1231@gmail.com...');
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'sapayev1231@gmail.com',
    password: 'sapayev3112',
  });
  assert.ok(!authError, `Auth failed: ${authError?.message}`);
  assert.strictEqual(authData.user.email, 'sapayev1231@gmail.com');
  console.log('✔ Admin authenticated successfully');

  // 2. Verify Profile Role
  const { data: profile } = await supabase.from('profiles').select('role, username').eq('id', authData.user.id).single();
  assert.ok(profile && (profile.role === 'owner' || profile.role === 'admin'), 'User must be admin or owner');
  console.log(`✔ Verified profile: @${profile.username} (role: ${profile.role})`);

  // 3. Test Stage A: Create Anime without episodes
  console.log('2. Testing Stage A: Create Anime without episodes...');
  const testTitle = `Test Anime E2E ${Date.now()}`;
  const { data: newAnime, error: animeErr } = await supabase
    .from('animes')
    .insert({
      title: testTitle,
      alt_title: 'E2E Alt Title',
      description: 'E2E Decoupled test anime',
      year: 2025,
      status: 'Davom etmoqda',
      age_rating: '16+',
      studio: 'Test Studio',
      genres: ['Action', 'Fantaziya'],
      is_featured: false,
      is_published: true,
      fandub_team: 'Anicity Dub',
    })
    .select('id, title, age_rating, is_featured')
    .single();

  assert.ok(!animeErr, `Anime creation failed: ${animeErr?.message}`);
  assert.strictEqual(newAnime.title, testTitle);
  assert.strictEqual(newAnime.age_rating, '16+');
  console.log(`✔ Anime created without episodes: "${newAnime.title}" (ID: ${newAnime.id})`);

  // 4. Test Stage B: Insert Episode 1 with Google Drive URL
  console.log('3. Testing Stage B: Insert Episode 1 with Google Drive URL...');
  const testDriveId = '11zICyxWSIu_3l5VYxm3VW40AtqXc5Pjl';
  const { data: ep1, error: ep1Err } = await supabase
    .from('episodes')
    .insert({
      anime_id: newAnime.id,
      season_number: 1,
      number: 1,
      title: '1-qism: Sinov',
      video_url: `https://drive.google.com/file/d/${testDriveId}/preview`,
      quality: '1080p',
      is_published: true,
      description: 'E2E episode synopsis',
    })
    .select('id, number, season_number, video_url')
    .single();

  assert.ok(!ep1Err, `Episode 1 creation failed: ${ep1Err?.message}`);
  assert.strictEqual(ep1.number, 1);
  assert.strictEqual(ep1.season_number, 1);
  console.log('✔ Episode 1 created successfully with Google Drive URL');

  // 5. Test Duplicate Episode in same season
  console.log('4. Testing Duplicate Episode rejection within same season...');
  const { error: dupErr } = await supabase
    .from('episodes')
    .insert({
      anime_id: newAnime.id,
      season_number: 1,
      number: 1,
      title: 'Duplicate Episode',
      video_url: `https://drive.google.com/file/d/${testDriveId}/preview`,
    });
  assert.ok(dupErr, 'Duplicate episode must be rejected by database constraint');
  console.log('✔ Duplicate episode in same season was rejected as expected');

  // 6. Test Episode in different season (Season 2, Episode 1 should succeed)
  console.log('5. Testing Episode in different season (Season 2, Ep 1)...');
  const { data: epSeason2, error: s2Err } = await supabase
    .from('episodes')
    .insert({
      anime_id: newAnime.id,
      season_number: 2,
      number: 1,
      title: '2-fasl 1-qism',
      video_url: `https://drive.google.com/file/d/${testDriveId}/preview`,
    })
    .select('id, season_number, number')
    .single();
  assert.ok(!s2Err, `Season 2 Ep 1 creation failed: ${s2Err?.message}`);
  assert.strictEqual(epSeason2.season_number, 2);
  assert.strictEqual(epSeason2.number, 1);
  console.log('✔ Season 2 Episode 1 created successfully');

  // 7. Cleanup
  console.log('6. Cleaning up test anime and associated episodes...');
  const { error: delErr } = await supabase.from('animes').delete().eq('id', newAnime.id);
  assert.ok(!delErr, `Cleanup failed: ${delErr?.message}`);

  // Confirm cascade deletion
  const { data: leftoverEps } = await supabase.from('episodes').select('id').eq('anime_id', newAnime.id);
  assert.strictEqual(leftoverEps?.length || 0, 0, 'Cascade delete must remove all episodes');
  console.log('✔ Cascade delete verified: all episodes deleted with anime');

  // 7. Testing Subscription Plans & Admin Management Flow
  console.log('7. Testing Subscription Plans table retrieval...');
  const { data: plans, error: plansErr } = await supabase
    .from('subscription_plans')
    .select('*')
    .order('sort_order', { ascending: true });
  assert.ok(!plansErr, `Failed to load subscription plans: ${plansErr?.message}`);
  assert.ok(plans && plans.length >= 4, 'Must have at least 4 subscription plans');
  console.log(`✔ Found ${plans.length} subscription plans (including ${plans.map(p => p.slug).join(', ')})`);

  // 8. Testing Subscription Grant & Audit Log Flow
  console.log('8. Testing Admin Manual Grant & Audit Log entry...');
  const testTargetUserId = authData.user.id;
  const targetPlan = plans.find((p) => p.slug === 'vip_1_month') || plans[1];
  assert.ok(targetPlan, 'VIP 1 month plan must exist');

  const startsAt = new Date();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + targetPlan.duration_days);

  // Insert user subscription record
  const { data: userSub, error: subErr } = await supabase
    .from('user_subscriptions')
    .insert({
      user_id: testTargetUserId,
      plan_id: targetPlan.id,
      plan_name: targetPlan.name,
      status: 'active',
      grant_type: 'manual_admin',
      starts_at: startsAt.toISOString(),
      expires_at: expiresAt.toISOString(),
      notes: 'E2E Automated Subscription Grant Test',
    })
    .select('id, plan_name, status')
    .single();
  assert.ok(!subErr, `User subscription insertion failed: ${subErr?.message}`);
  assert.strictEqual(userSub.status, 'active');

  // Insert audit log
  const { data: auditLog, error: auditErr } = await supabase
    .from('subscription_audit_logs')
    .insert({
      admin_id: authData.user.id,
      user_id: testTargetUserId,
      action: 'grant',
      previous_plan: 'free',
      new_plan: 'vip',
      reason: 'E2E Automated Test Grant',
    })
    .select('id, action, reason')
    .single();
  assert.ok(!auditErr, `Audit log insertion failed: ${auditErr?.message}`);
  assert.strictEqual(auditLog.action, 'grant');
  console.log('✔ Subscription grant and audit log entry created successfully');

  // 9. Testing Extend Subscription
  console.log('9. Testing Extend Subscription duration...');
  const newExpiresAt = new Date(expiresAt);
  newExpiresAt.setDate(newExpiresAt.getDate() + 30);
  const { error: extendErr } = await supabase
    .from('user_subscriptions')
    .update({ expires_at: newExpiresAt.toISOString() })
    .eq('id', userSub.id);
  assert.ok(!extendErr, `Subscription extension failed: ${extendErr?.message}`);

  const { error: extendAuditErr } = await supabase
    .from('subscription_audit_logs')
    .insert({
      admin_id: authData.user.id,
      user_id: testTargetUserId,
      action: 'extend',
      previous_plan: 'vip',
      new_plan: 'vip',
      reason: 'E2E Automated Test Extension +30 days',
    });
  assert.ok(!extendAuditErr, `Extension audit log failed: ${extendAuditErr?.message}`);
  console.log('✔ Subscription duration extended +30 days and audited');

  // 10. Clean up test subscription records
  console.log('10. Cleaning up test subscription and audit log records...');
  await supabase.from('user_subscriptions').delete().eq('id', userSub.id);
  await supabase.from('subscription_audit_logs').delete().eq('user_id', testTargetUserId).like('reason', 'E2E Automated Test%');
  console.log('✔ Test subscription data cleaned up successfully');

  console.log('\n=============================================');
  console.log('ALL E2E WORKFLOW CHECKS PASSED PERFECTLY!');
  console.log('=============================================\n');
}

run().catch((err) => {
  console.error('E2E Test Failed:', err);
  process.exit(1);
});

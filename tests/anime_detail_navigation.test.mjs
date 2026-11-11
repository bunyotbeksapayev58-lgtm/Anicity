import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { isUuid, sanitizeSlugPattern, applyAnimeIdentifierFilter } from '../lib/anime-lookup.js';

test('1. UUID Discriminator: Accurately identifies UUIDs and distinguishes them from slugs', () => {
  assert.equal(isUuid('ed7d0df3-a345-451b-8c18-dbb1364fe2a7'), true);
  assert.equal(isUuid('ED7D0DF3-A345-451B-8C18-DBB1364FE2A7'), true);
  assert.equal(isUuid('00000000-0000-0000-0000-000000000000'), true);

  assert.equal(isUuid('code-geass'), false);
  assert.equal(isUuid('code_geass'), false);
  assert.equal(isUuid('Code Geass: Lelouch'), false);
  assert.equal(isUuid(''), false);
  assert.equal(isUuid(null), false);
  assert.equal(isUuid(undefined), false);
  assert.equal(isUuid('ed7d0df3-a345-451b-8c18-dbb1364fe2a'), false); // 35 chars
});

test('2. Slug Sanitization: Transforms slugs into safe PostgREST ilike patterns and rejects empty inputs', () => {
  assert.equal(sanitizeSlugPattern('code-geass'), 'code%geass');
  assert.equal(sanitizeSlugPattern('code_geass'), 'code%geass');
  assert.equal(sanitizeSlugPattern('Code Geass'), 'Code%Geass');
  assert.equal(sanitizeSlugPattern('Lelush-123'), 'Lelush%123');

  // Strip malicious/formatting characters that could break PostgREST .or() commas/parens
  assert.equal(sanitizeSlugPattern('code,geass(test)'), 'codegeasstest');
  assert.equal(sanitizeSlugPattern(';;;---???'), null);
  assert.equal(sanitizeSlugPattern(''), null);
  assert.equal(sanitizeSlugPattern(null), null);
});

test('3. Query Filter Builder: Applies .eq for UUID and .or for slug without throwing syntax errors', () => {
  const calls = [];
  const mockQuery = {
    eq(col, val) {
      calls.push({ method: 'eq', col, val });
      return this;
    },
    or(filter) {
      calls.push({ method: 'or', filter });
      return this;
    },
  };

  // UUID
  applyAnimeIdentifierFilter(mockQuery, 'ed7d0df3-a345-451b-8c18-dbb1364fe2a7');
  assert.deepEqual(calls[0], {
    method: 'eq',
    col: 'id',
    val: 'ed7d0df3-a345-451b-8c18-dbb1364fe2a7',
  });

  // Slug
  applyAnimeIdentifierFilter(mockQuery, 'code-geass');
  assert.deepEqual(calls[1], {
    method: 'or',
    filter: 'title.ilike.%code%geass%,alt_title.ilike.%code%geass%',
  });

  // Malformed / Non-alphanumeric
  applyAnimeIdentifierFilter(mockQuery, ';;;--???');
  assert.deepEqual(calls[2], {
    method: 'eq',
    col: 'id',
    val: '00000000-0000-0000-0000-000000000000',
  });
});

test('4. Anime Details Page Source Inspection: All child queries use canonical anime.id and no column crash', async () => {
  const code = await fs.readFile(path.resolve('app/anime/[id]/page.js'), 'utf8');

  assert.ok(code.includes("import { applyAnimeIdentifierFilter } from '@/lib/anime-lookup'"), 'Must import identifier filter');
  assert.ok(code.includes('applyAnimeIdentifierFilter('), 'Must apply filter to query');
  assert.ok(code.includes('.maybeSingle()'), 'Must use maybeSingle() instead of throwing single()');

  // Must use canonical anime.id for child operations
  assert.ok(code.includes(".eq('anime_id', anime.id)"), 'Favorites and watch_progress must use anime.id');
  assert.ok(code.includes(".neq('id', anime.id)"), 'Related animes must exclude anime.id');
  assert.ok(code.includes('value={anime.id}'), 'Favorite form input must submit canonical anime.id');
});

test('5. Watch Page Source Inspection: No non-existent columns in PostgREST select query', async () => {
  const code = await fs.readFile(path.resolve('app/watch/[animeId]/[num]/page.js'), 'utf8');

  // Verify non-existent columns are NOT in the raw PostgREST .select() query string
  const selectQueryMatch = code.match(/\.select\((['"`])([\s\S]*?)\1\)/);
  assert.ok(selectQueryMatch, 'Select query must exist');
  const selectQueryContent = selectQueryMatch[2];

  assert.ok(!selectQueryContent.includes('is_vip_only'), 'select() query MUST NOT contain is_vip_only');
  assert.ok(!selectQueryContent.includes('requires_vip'), 'select() query MUST NOT contain requires_vip');

  // Verify validatePlaybackAccess receives safe fallbacks and satisfies existing test assertions
  assert.ok(code.includes('requires_vip:'), 'Page must pass requires_vip fallback property to validatePlaybackAccess');
  assert.ok(code.includes('is_vip_only:'), 'Page must pass is_vip_only fallback property to validatePlaybackAccess');
  assert.ok(code.includes('applyAnimeIdentifierFilter('), 'Watch page must also resolve slug or UUID');
});

test('6. Video Token API Source Inspection: Only queries existing database columns', async () => {
  const code = await fs.readFile(path.resolve('app/api/video/token/route.js'), 'utf8');

  // Verify select query on episodes
  const epSelectMatch = code.match(/\.from\('episodes'\)\s*\.select\((['"`])([\s\S]*?)\1\)/);
  assert.ok(epSelectMatch, 'Episodes select query must exist');
  const epSelectContent = epSelectMatch[2];

  assert.ok(!epSelectContent.includes('requires_vip'), 'Episodes select query MUST NOT contain requires_vip');
  assert.ok(!epSelectContent.includes('is_vip_only'), 'Episodes select query MUST NOT contain is_vip_only');
});

test('7. Live Supabase Verification: Code Geass resolves via UUID, slug, and watch page query succeeds', async () => {
  let envConfig = {};
  try {
    const raw = await fs.readFile(path.resolve('.env.local'), 'utf8');
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
      const idx = trimmed.indexOf('=');
      const k = trimmed.slice(0, idx).trim();
      const v = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
      envConfig[k] = v;
    }
  } catch {}

  const url = envConfig.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = envConfig.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey || url.includes('your-project') || anonKey.includes('dummy')) {
    console.log('Skipping live test: Supabase environment variables not present or dummy placeholder');
    return;
  }

  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(url, anonKey);

  // A. Resolve Code Geass by UUID
  const uuidQuery = applyAnimeIdentifierFilter(
    supabase.from('animes').select('id, title, episodes(id, number, title, is_published)'),
    'ed7d0df3-a345-451b-8c18-dbb1364fe2a7'
  );
  const { data: byUuid, error: uuidErr } = await uuidQuery.maybeSingle();
  assert.equal(uuidErr, null, 'UUID query must return null error');
  assert.ok(byUuid, 'Code Geass must be found by UUID');
  assert.equal(byUuid.id, 'ed7d0df3-a345-451b-8c18-dbb1364fe2a7');

  // B. Resolve Code Geass by Slug "code-geass"
  const slugQuery = applyAnimeIdentifierFilter(
    supabase.from('animes').select('id, title, episodes(id, number, title, is_published)'),
    'code-geass'
  );
  const { data: bySlug, error: slugErr } = await slugQuery.maybeSingle();
  assert.equal(slugErr, null, 'Slug query must return null error (no 22P02 exception)');
  assert.ok(bySlug, 'Code Geass must be found by slug "code-geass"');
  assert.equal(bySlug.id, 'ed7d0df3-a345-451b-8c18-dbb1364fe2a7');

  // C. Non-existent slug returns null without error
  const missQuery = applyAnimeIdentifierFilter(
    supabase.from('animes').select('id, title'),
    'non-existent-anime-slug-404'
  );
  const { data: byMiss, error: missErr } = await missQuery.maybeSingle();
  assert.equal(missErr, null, 'Non-existent slug query must not throw error');
  assert.equal(byMiss, null, 'Non-existent slug must return null');

  // D. Watch page query execution (verifies no 42703 column missing error)
  const watchQuery = applyAnimeIdentifierFilter(
    supabase
      .from('animes')
      .select('id, title, alt_title, description, poster_url, banner_url, year, status, studio, genres, rating_avg, episodes(id, season_number, number, title, video_url, thumbnail_url, quality, is_published)'),
    'ed7d0df3-a345-451b-8c18-dbb1364fe2a7'
  );
  const { data: watchData, error: watchErr } = await watchQuery.maybeSingle();
  assert.equal(watchErr, null, 'Watch page query must succeed without 42703 column errors');
  assert.ok(watchData, 'Watch data must be loaded');
  assert.ok(Array.isArray(watchData.episodes), 'Episodes must be loaded');
});


test('8. True HTTP 404 Status Enforcers: Root loading boundary avoided & generateMetadata invokes notFound()', async () => {
  const animeCode = await fs.readFile(path.resolve('app/anime/[id]/page.js'), 'utf8');
  const watchCode = await fs.readFile(path.resolve('app/watch/[animeId]/[num]/page.js'), 'utf8');

  // Verify generateMetadata in anime page calls notFound()
  assert.ok(
    /generateMetadata[\s\S]*?if\s*\(!anime\)\s*notFound\(\)/.test(animeCode),
    'generateMetadata in app/anime/[id]/page.js must call notFound() when anime is missing'
  );

  // Verify generateMetadata in watch page calls notFound()
  assert.ok(
    /generateMetadata[\s\S]*?if\s*\(!anime\)\s*notFound\(\)/.test(watchCode),
    'generateMetadata in app/watch/[animeId]/[num]/page.js must call notFound() when anime is missing'
  );

  // Verify root app/loading.js does not exist (relocated to segment loading to prevent early HTTP 200 streaming)
  let rootLoadingExists = true;
  try {
    await fs.access(path.resolve('app/loading.js'));
  } catch {
    rootLoadingExists = false;
  }
  assert.equal(rootLoadingExists, false, 'Root app/loading.js must not exist to ensure true HTTP 404 headers');
});

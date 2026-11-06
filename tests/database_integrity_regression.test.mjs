import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('1. Database schema and migration integrity checks', () => {
  const migrationsDir = path.resolve('supabase/migrations');
  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql'));

  assert.ok(files.length >= 16, 'At least 16 migration files must exist');

  // Verify core schema (001)
  const coreSql = fs.readFileSync(path.join(migrationsDir, '001_core_schema.sql'), 'utf8');
  assert.match(coreSql, /create table if not exists public\.profiles/i, 'profiles table must be defined');
  assert.match(coreSql, /create table if not exists public\.animes/i, 'animes table must be defined');
  assert.match(coreSql, /create table if not exists public\.episodes/i, 'episodes table must be defined');
  assert.match(coreSql, /create table if not exists public\.favorites/i, 'favorites table must be defined');
  assert.match(coreSql, /create table if not exists public\.watch_progress/i, 'watch_progress table must be defined');

  // Verify RLS enablement (005 & 009)
  const rlsSql = fs.readFileSync(path.join(migrationsDir, '005_rls_policies.sql'), 'utf8');
  assert.match(rlsSql, /alter table public\.profiles enable row level security/i);
  assert.match(rlsSql, /alter table public\.animes enable row level security/i);
  assert.match(rlsSql, /alter table public\.episodes enable row level security/i);

  // Verify subscription system (009)
  const subSql = fs.readFileSync(path.join(migrationsDir, '009_subscriptions_system.sql'), 'utf8');
  assert.match(subSql, /create table if not exists public\.subscription_plans/i);
  assert.match(subSql, /create table if not exists public\.user_subscriptions/i);
  assert.match(subSql, /create table if not exists public\.subscription_transactions/i);
  assert.match(subSql, /create table if not exists public\.subscription_audit_logs/i);

  // Verify security hardening in 015
  const hardenSql = fs.readFileSync(path.join(migrationsDir, '015_assistant_security_audit_fixes.sql'), 'utf8');
  assert.ok(hardenSql.includes('SET search_path = pg_catalog, public, pg_temp;'), 'RPCs must be hardened with explicit search_path');
});

test('2. Foreign key cascade and delete safety in schema', () => {
  const subSql = fs.readFileSync(path.resolve('supabase/migrations/009_subscriptions_system.sql'), 'utf8');
  assert.match(subSql, /references public\.profiles\(id\) on delete cascade/i);
  assert.match(subSql, /references public\.subscription_plans\(id\) on delete set null/i);

  const coreSql = fs.readFileSync(path.resolve('supabase/migrations/001_core_schema.sql'), 'utf8');
  assert.match(coreSql, /references public\.animes\(id\) on delete cascade/i);
});

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migration = await readFile(new URL('../supabase/migrations/012_admin_pagination_atomic_updates.sql', import.meta.url), 'utf8');
assert.match(migration, /pg_advisory_xact_lock\(hashtextextended\(p_user_id::text, 0\)\)/);
assert.match(migration, /status = 'active' AND expires_at > now\(\)/, 'Future-start rows must participate in grant scheduling');

// Deterministic model for the intended DB rule; SQL execution itself requires a dedicated test DB.
function serializedGrantModel(initialRows = []) {
  const rows = [...initialRows];
  let queue = Promise.resolve();
  return {
    rows,
    grant: async (now, durationMs) => {
      const previous = queue;
      let release;
      queue = new Promise((resolve) => { release = resolve; });
      await previous;
      try {
        const expiry = rows
          .filter((row) => row.status === 'active' && row.expiresAt > now)
          .reduce((max, row) => Math.max(max, row.expiresAt), now);
        const startsAt = Math.max(now, expiry);
        const row = { status: 'active', startsAt, expiresAt: startsAt + durationMs };
        rows.push(row);
        return row;
      } finally {
        release();
      }
    },
  };
}

const day = 24 * 60 * 60 * 1000;
const now = Date.parse('2026-01-01T00:00:00.000Z');
const noExisting = serializedGrantModel();
assert.deepEqual(await noExisting.grant(now, 30 * day), { status: 'active', startsAt: now, expiresAt: now + 30 * day });

const active = serializedGrantModel([{ status: 'active', startsAt: now - day, expiresAt: now + 10 * day }]);
assert.equal((await active.grant(now, 30 * day)).startsAt, now + 10 * day);

const future = serializedGrantModel([{ status: 'active', startsAt: now + 20 * day, expiresAt: now + 50 * day }]);
assert.equal((await future.grant(now, 30 * day)).startsAt, now + 50 * day);

const sequential = serializedGrantModel();
const first = await sequential.grant(now, 30 * day);
const second = await sequential.grant(now, 30 * day);
assert.equal(second.startsAt, first.expiresAt);
assert.equal(second.expiresAt, now + 60 * day);

const concurrent = serializedGrantModel();
const [concurrentA, concurrentB] = await Promise.all([
  concurrent.grant(now, 30 * day),
  concurrent.grant(now, 30 * day),
]);
assert.notEqual(concurrentA.startsAt, concurrentB.startsAt);
assert.equal(Math.max(concurrentA.expiresAt, concurrentB.expiresAt), now + 60 * day);

const expired = serializedGrantModel([{ status: 'active', startsAt: now - 50 * day, expiresAt: now - day }]);
assert.equal((await expired.grant(now, 30 * day)).startsAt, now);

console.log('Subscription grant scheduling regressions passed (model + SQL lock assertions; database not executed).');

import assert from 'node:assert/strict';
import { normalizeAdminUserQuery, getAdminUserPageCount } from '../lib/admin-pagination.js';

assert.deepEqual(normalizeAdminUserQuery({}), { page: 1, pageSize: 50, search: '', status: 'all' });
assert.deepEqual(normalizeAdminUserQuery({ usersPage: '4', usersPageSize: '75', usersSearch: '  member ', usersStatus: 'vip' }), {
  page: 4, pageSize: 75, search: 'member', status: 'vip',
});
assert.deepEqual(normalizeAdminUserQuery({ usersPage: '-1', usersPageSize: '500', usersSearch: 'x'.repeat(140), usersStatus: 'unexpected' }), {
  page: 1, pageSize: 100, search: 'x'.repeat(100), status: 'all',
});
assert.equal(getAdminUserPageCount(0, 50), 1);
assert.equal(getAdminUserPageCount(101, 50), 3);
assert.equal(getAdminUserPageCount(250, 100), 3);

console.log('Admin user pagination regression checks passed.');

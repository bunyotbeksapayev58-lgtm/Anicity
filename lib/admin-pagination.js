const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;
const USER_STATUSES = new Set(['all', 'vip', 'free', 'expired']);

function positiveInteger(value, fallback, maximum = Number.MAX_SAFE_INTEGER) {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return fallback;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 1 ? Math.min(parsed, maximum) : fallback;
}

export function normalizeAdminUserQuery(params = {}) {
  const pageValue = typeof params.usersPage === 'string' ? params.usersPage : '';
  const pageSizeValue = typeof params.usersPageSize === 'string' ? params.usersPageSize : '';
  const statusValue = typeof params.usersStatus === 'string' ? params.usersStatus : 'all';
  return {
    page: positiveInteger(pageValue, 1, 2_147_483_647),
    pageSize: positiveInteger(pageSizeValue, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE),
    search: (typeof params.usersSearch === 'string' ? params.usersSearch : '').trim().slice(0, 100),
    status: USER_STATUSES.has(statusValue) ? statusValue : 'all',
  };
}

export function getAdminUserPageCount(totalCount, pageSize) {
  return Math.max(1, Math.ceil(Math.max(0, Number(totalCount) || 0) / pageSize));
}

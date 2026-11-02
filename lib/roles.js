// Rollar: user | moderator | admin | owner (SQL: profiles_role_check)
export const ADMIN_ROLES = ['admin', 'owner'];
export const STAFF_ROLES = ['moderator', 'admin', 'owner'];

export const isAdminRole = (role) => ADMIN_ROLES.includes(role);
export const isStaffRole = (role) => STAFF_ROLES.includes(role);

const MAIN_ADMIN_ROLES = new Set(['admin', 'owner']);

export function canPerformAdminPermission(role, permission, granted) {
  if (MAIN_ADMIN_ROLES.has(role)) return true;
  return role === 'assistant_admin' && Boolean(permission) && granted === true;
}

export function canManageAssistantAdmins(role) {
  return role === 'owner';
}

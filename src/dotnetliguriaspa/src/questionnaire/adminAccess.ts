// UI hint only: the API enforces the FeedbackAdmin policy. Mirrors FeedbackAdminHandler.
export const FEEDBACK_ADMIN_ROLE = 'feedbackadmin';

type Payload = Record<string, unknown> | null | undefined;

function decoded(value: unknown): unknown {
  if (typeof value === 'string') {
    try { return JSON.parse(value); } catch { return value; }
  }
  return value;
}

function roleList(value: unknown, role: string): boolean {
  const roles = decoded(value);
  return Array.isArray(roles) && roles.some(item => item === role);
}

function object(value: unknown): Record<string, unknown> | null {
  const result = decoded(value);
  return result !== null && typeof result === 'object' && !Array.isArray(result)
    ? result as Record<string, unknown> : null;
}

export function hasFeedbackAdmin(payloads: Payload[], role = FEEDBACK_ADMIN_ROLE, claim = FEEDBACK_ADMIN_ROLE): boolean {
  for (const payload of payloads) {
    if (!payload) continue;
    for (const [key, value] of Object.entries(payload)) {
      if (key === claim && (value === true || value === 'true')) return true;
      if (['roles', 'role', 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role', 'roles0', 'roles1', 'roles2'].includes(key)
        && (value === role || roleList(value, role))) return true;
      if (key === 'realm_access' && roleList(object(value)?.roles, role)) return true;
      if (key === 'resource_access' &&
        roleList(object(object(value)?.DotNetLiguriaCore)?.roles, role)) return true;
    }
  }
  return false;
}

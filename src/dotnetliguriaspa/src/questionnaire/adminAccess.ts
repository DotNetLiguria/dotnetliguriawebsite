// UI hint only: the API enforces the FeedbackAdmin policy. Mirrors FeedbackAdminHandler.
export const FEEDBACK_ADMIN_ROLE = 'feedbackadmin';

type Payload = Record<string, unknown> | null | undefined;

function containsRole(value: unknown, role: string, depth = 0): boolean {
  if (depth > 4 || value === null || value === undefined) return false;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        return containsRole(JSON.parse(trimmed), role, depth + 1);
      } catch {
        return false;
      }
    }
    return trimmed.toLowerCase() === role;
  }
  if (Array.isArray(value)) return value.some(v => containsRole(v, role, depth + 1));
  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>)
      .some(v => typeof v !== 'string' && containsRole(v, role, depth + 1));
  }
  return false;
}

export function hasFeedbackAdmin(payloads: Payload[], role = FEEDBACK_ADMIN_ROLE, claim = FEEDBACK_ADMIN_ROLE): boolean {
  for (const payload of payloads) {
    if (!payload) continue;
    for (const [key, value] of Object.entries(payload)) {
      const name = key.toLowerCase();
      if (name === claim && value !== false && value !== 'false' && value !== 0 && value !== '0' && value != null) return true;
      if (['roles', 'role', 'realm_access', 'resource_access', 'roles0', 'roles1', 'roles2'].includes(name)
        && containsRole(value, role)) return true;
    }
  }
  return false;
}

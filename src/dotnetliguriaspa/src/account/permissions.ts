export const PERMISSIONS = [
  'events.read', 'events.manage', 'events.publish', 'events.delete', 'events.homepage.manage', 'events.past.manage',
  'event-assets.read', 'event-assets.manage', 'event-assets.delete',
  'eventbrite.read', 'eventbrite.manage', 'eventbrite.publish',
  'speakers.read', 'speakers.manage', 'speakers.delete', 'speakers.merge',
  'venues.read', 'venues.manage', 'venues.delete', 'board.read', 'board.manage', 'board.delete',
  'site-menu.read', 'site-menu.manage', 'site-menu.delete',
  'questionnaires.read', 'questionnaires.manage', 'questionnaires.publish', 'questionnaires.delete',
  'questionnaire-results.read', 'questionnaire-responses.read', 'questionnaire-responses.export', 'questionnaire-responses.delete',
  'backups.read', 'backups.create', 'backups.restore',
  'maintenance.counters.read', 'maintenance.counters.manage', 'maintenance.speaker-references.repair', 'maintenance.diagnostics.manage',
  'privacy.operations.read', 'privacy.operations.manage', 'privacy.identities.read', 'privacy.notifications.retry',
  'privacy.retention.read', 'privacy.retention.manage', 'notifications.preview', 'notifications.confirm',
  'newsletters.read', 'newsletters.manage', 'newsletters.send',
  'access.users.read', 'access.users.create', 'access.permissions.grant', 'access.permissions.revoke', 'access.audit.read',
] as const;

export type Permission = typeof PERMISSIONS[number];
export type PermissionSource = { permissions: readonly string[] } | null | undefined;
export const hasPermission = (source: PermissionSource, permission: Permission) => source?.permissions.includes(permission) ?? false;
export const hasAnyPermission = (source: PermissionSource, permissions: readonly Permission[]) => permissions.some(permission => hasPermission(source, permission));
export const hasAllPermissions = (source: PermissionSource, permissions: readonly Permission[]) => permissions.every(permission => hasPermission(source, permission));

export const PRIVACY_PERMISSIONS = PERMISSIONS.filter(permission => permission.startsWith('privacy.') || permission.startsWith('notifications.'));
export const RESULTS_PERMISSIONS: Permission[] = ['questionnaire-results.read', 'questionnaire-responses.read', 'questionnaire-responses.export'];
export type ResourceAuthorization = {
  authorization?: { isPast: boolean; allowedActions: string[]; scheduleErrorCode?: string | null };
  eventPeriod?: 'current' | 'past' | 'unknown';
  isPast?: boolean;
  allowedActions?: string[];
  published?: boolean;
};

/** Unknown historical state is not evidence that a mutation is safe. */
export function canPerform(source: PermissionSource, permission: Permission, resource?: ResourceAuthorization) {
  if (!hasPermission(source, permission)) return false;
  if (['events.manage', 'event-assets.manage', 'event-assets.delete'].includes(permission) && resource?.published && !hasPermission(source, 'events.publish')) return false;
  if (resource?.authorization) return (!resource.authorization.isPast || hasPermission(source, 'events.past.manage'))
    && resource.authorization.allowedActions.includes(permission);
  if (resource?.allowedActions) return resource.allowedActions.includes(permission);
  if (!resource) return true;
  return resource.eventPeriod === 'current' || resource.isPast === false || hasPermission(source, 'events.past.manage');
}

export const permissionsDenied = () => window.dispatchEvent(new Event('admin-permissions-denied'));

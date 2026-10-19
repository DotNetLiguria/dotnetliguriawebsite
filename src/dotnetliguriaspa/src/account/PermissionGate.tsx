import React, { useCallback } from 'react';
import { useAccountCapabilities } from './AccountCapabilities';
import { hasPermission, Permission } from './permissions';

export function PermissionGate({ permission, children }: { permission: Permission; children: React.ReactNode }) {
  const { capabilities } = useAccountCapabilities();
  return hasPermission(capabilities, permission) ? <>{children}</> : null;
}

export function useCan() {
  const { capabilities } = useAccountCapabilities();
  return useCallback((permission: Permission) => hasPermission(capabilities, permission), [capabilities]);
}

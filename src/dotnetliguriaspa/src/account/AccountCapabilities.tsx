import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useOidc, useOidcUser, useOidcAccessToken } from '@axa-fr/react-oidc';
import { useAccountRequest } from './accountApi';
import { PERMISSIONS, Permission } from './permissions';
import { clearPrivateBrowserState } from '../questionnaire/drafts';

export type AccountCapabilities = {
  schemaVersion: 1; permissions: Permission[]; canAccessAdmin: boolean;
};
type CapabilityState = { status: 'anonymous' | 'loading' | 'error' | 'revoked'; capabilities: null }
  | { status: 'ready'; capabilities: AccountCapabilities };
type Context = CapabilityState & { retry: () => void; clear: () => void; refresh: () => void };
const anonymous: Context = { status: 'anonymous', capabilities: null, retry: () => undefined, clear: () => undefined, refresh: () => undefined };
export const CapabilityContext = createContext<Context>(anonymous);

function CapabilityLoader({ children }: { children: React.ReactNode }) {
  const request = useAccountRequest();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<CapabilityState>({ status: 'loading', capabilities: null });
  const activeController = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    activeController.current = controller;
    request('account/capabilities', { signal: controller.signal })
      .then(response => response.json())
      .then((value: unknown) => {
        const candidate = value as AccountCapabilities | null;
        if (!candidate || candidate.schemaVersion !== 1 || typeof candidate.canAccessAdmin !== 'boolean' ||
          !Array.isArray(candidate.permissions) || candidate.permissions.some(permission => typeof permission !== 'string'))
          throw new Error('Invalid capabilities');
        const permissions = candidate.permissions.filter(permission => PERMISSIONS.includes(permission));
        if (!controller.signal.aborted) setState({ status: 'ready', capabilities: {
          schemaVersion: 1, permissions, canAccessAdmin: candidate.canAccessAdmin && permissions.some(permission => permission !== 'events.past.manage'),
        } });
      })
      .catch(() => { if (!controller.signal.aborted) setState({ status: 'error', capabilities: null }); });
    return () => controller.abort();
  }, [request, attempt]);
  useEffect(() => {
    const invalidate = () => {
      activeController.current?.abort();
      clearPrivateBrowserState();
      setState({ status: 'loading', capabilities: null });
      setAttempt(value => value + 1);
    };
    window.addEventListener('admin-permissions-denied', invalidate);
    return () => window.removeEventListener('admin-permissions-denied', invalidate);
  }, []);
  return <CapabilityContext.Provider value={{ ...state, refresh: () => setAttempt(value => value + 1), clear: () => {
    activeController.current?.abort();
    setState({ status: 'revoked', capabilities: null });
  }, retry: () => {
    setState({ status: 'loading', capabilities: null });
    setAttempt(value => value + 1);
  } }}>{children}</CapabilityContext.Provider>;
}

export function AccountCapabilitiesProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useOidc();
  const { oidcUser } = useOidcUser();
  const { accessToken } = useOidcAccessToken();
  if (!isAuthenticated) return <CapabilityContext.Provider value={anonymous}>{children}</CapabilityContext.Provider>;
  return <CapabilityLoader key={`${String(oidcUser?.sub ?? '')}:${accessToken ?? ''}`}>{children}</CapabilityLoader>;
}

export const useAccountCapabilities = () => useContext(CapabilityContext);

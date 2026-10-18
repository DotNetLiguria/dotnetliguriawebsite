import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useOidc, useOidcUser } from '@axa-fr/react-oidc';
import { useAccountRequest } from './accountApi';

export type AccountCapabilities = {
  websiteAdmin: boolean; feedbackAdmin: boolean; backupAdmin: boolean; privacyAdmin: boolean; notificationAdmin: boolean;
};
type CapabilityState = { status: 'anonymous' | 'loading' | 'error' | 'revoked'; capabilities: null }
  | { status: 'ready'; capabilities: AccountCapabilities };
type Context = CapabilityState & { retry: () => void; clear: () => void };
const anonymous: Context = { status: 'anonymous', capabilities: null, retry: () => undefined, clear: () => undefined };
const CapabilityContext = createContext<Context>(anonymous);

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
        const keys = ['websiteAdmin', 'feedbackAdmin', 'backupAdmin', 'privacyAdmin', 'notificationAdmin'] as const;
        if (!value || typeof value !== 'object' || keys.some(key => typeof (value as AccountCapabilities)[key] !== 'boolean'))
          throw new Error('Invalid capabilities');
        if (!controller.signal.aborted) setState({ status: 'ready', capabilities: value as AccountCapabilities });
      })
      .catch(() => { if (!controller.signal.aborted) setState({ status: 'error', capabilities: null }); });
    return () => controller.abort();
  }, [request, attempt]);
  return <CapabilityContext.Provider value={{ ...state, clear: () => {
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
  if (!isAuthenticated) return <CapabilityContext.Provider value={anonymous}>{children}</CapabilityContext.Provider>;
  return <CapabilityLoader key={String(oidcUser?.sub ?? '')}>{children}</CapabilityLoader>;
}

export const useAccountCapabilities = () => useContext(CapabilityContext);

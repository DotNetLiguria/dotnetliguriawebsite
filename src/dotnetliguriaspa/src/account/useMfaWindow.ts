import { useEffect, useState } from 'react';
import { useOidcIdToken } from '@axa-fr/react-oidc';

const mfaWindowSeconds = 300;

/** A UI hint only; sensitive operations still enforce recent MFA on the server. */
export function useMfaWindow() {
  const { idTokenPayload: payload } = useOidcIdToken();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const level = typeof payload?.acr === 'string' ? payload.acr : '';
  const authTime = typeof payload?.auth_time === 'number' ? payload.auth_time : Number.NaN;
  const strong = level === 'mfa' || level === 'hwk';
  const remaining = strong && Number.isFinite(authTime) ? Math.floor(authTime + mfaWindowSeconds - now / 1000) : 0;
  return { level, strong, remaining: Math.min(Math.max(remaining, 0), mfaWindowSeconds), active: remaining > 0 };
}

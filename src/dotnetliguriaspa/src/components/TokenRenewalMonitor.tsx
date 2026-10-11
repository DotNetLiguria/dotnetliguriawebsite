import { useEffect, useRef } from 'react';
import { useOidc, useOidcAccessToken } from '@axa-fr/react-oidc';

const renewalWindowInSeconds = 120;

export default function TokenRenewalMonitor() {
    const { isAuthenticated, renewTokens } = useOidc();
    const { accessTokenPayload } = useOidcAccessToken();
    const renewalInProgress = useRef(false);
    const accessTokenExpiration = accessTokenPayload?.exp;

    useEffect(() => {
        if (!isAuthenticated || typeof accessTokenExpiration !== 'number') {
            return;
        }

        const renewIfExpiring = () => {
            if (document.visibilityState !== 'visible'
                || accessTokenExpiration - Date.now() / 1000 > renewalWindowInSeconds
                || renewalInProgress.current) {
                return;
            }

            renewalInProgress.current = true;
            void renewTokens()
                .catch(error => console.error('Unable to renew the OIDC session after resuming the app.', error))
                .finally(() => {
                    renewalInProgress.current = false;
                });
        };

        document.addEventListener('visibilitychange', renewIfExpiring);
        window.addEventListener('focus', renewIfExpiring);

        return () => {
            document.removeEventListener('visibilitychange', renewIfExpiring);
            window.removeEventListener('focus', renewIfExpiring);
        };
    }, [accessTokenExpiration, isAuthenticated, renewTokens]);

    return null;
}

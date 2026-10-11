import { render } from '@testing-library/react';
import { useOidc, useOidcAccessToken } from '@axa-fr/react-oidc';
import TokenRenewalMonitor from './TokenRenewalMonitor';

const nowInSeconds = 1_800_000_000;

beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(nowInSeconds * 1000);
});

afterEach(() => {
    vi.restoreAllMocks();
});

test('renews an expiring session when the user returns to the tab', () => {
    const renewTokens = vi.fn().mockResolvedValue({});
    vi.mocked(useOidc).mockReturnValue({
        isAuthenticated: true,
        login: vi.fn(),
        logout: vi.fn(),
        renewTokens,
    });
    vi.mocked(useOidcAccessToken).mockReturnValue({
        accessToken: null,
        accessTokenPayload: { exp: nowInSeconds + 60 },
    });

    render(<TokenRenewalMonitor />);
    window.dispatchEvent(new Event('focus'));

    expect(renewTokens).toHaveBeenCalledOnce();
});

test('does not renew a session with sufficient token lifetime', () => {
    const renewTokens = vi.fn().mockResolvedValue({});
    vi.mocked(useOidc).mockReturnValue({
        isAuthenticated: true,
        login: vi.fn(),
        logout: vi.fn(),
        renewTokens,
    });
    vi.mocked(useOidcAccessToken).mockReturnValue({
        accessToken: null,
        accessTokenPayload: { exp: nowInSeconds + 121 },
    });

    render(<TokenRenewalMonitor />);
    window.dispatchEvent(new Event('focus'));

    expect(renewTokens).not.toHaveBeenCalled();
});

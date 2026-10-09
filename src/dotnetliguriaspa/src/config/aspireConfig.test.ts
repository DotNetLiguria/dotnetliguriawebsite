import { getOidcPublicSettings } from './oidcConfig';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

test('Aspire browser endpoint keeps API and case-sensitive content bases distinct', async () => {
  vi.stubEnv('VITE_API_BASE_URL', 'https://localhost:5443/api');
  vi.resetModules();
  const { API_BASE_URL, CONTENT_BASE_URL } = await import('./apiConfig');
  expect(API_BASE_URL).toBe('https://localhost:5443/api');
  expect(CONTENT_BASE_URL).toBe('https://localhost:5443/Contents/');
});

test('standalone OIDC defaults are preserved', () => {
  expect(getOidcPublicSettings('', '')).toEqual({
    authority: 'https://hello.vevy.com/realms/DotNetLiguria',
    client_id: 'DotNetLiguriaSpa',
  });
});

test('only explicitly supplied public OIDC settings are exposed', () => {
  expect(getOidcPublicSettings('https://identity.example/realms/local', 'local-spa')).toEqual({
    authority: 'https://identity.example/realms/local',
    client_id: 'local-spa',
  });
});

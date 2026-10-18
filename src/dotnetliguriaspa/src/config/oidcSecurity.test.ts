import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { resolve } from 'node:path';
import { createHash, webcrypto } from 'node:crypto';
import { OidcClient } from '@axa-fr/oidc-client';

afterEach(() => vi.unstubAllGlobals());

function domains(origin = 'https://www.dotnetliguria.net') {
  const source = readFileSync(resolve('public', 'OidcTrustedDomains.js'), 'utf8');
  return runInNewContext(`${source}; trustedDomains.default`, { self: { location: new URL(origin) } }) as {
    oidcDomains: RegExp[];
    accessTokenDomains: RegExp[];
  };
}

test.each([
  'https://dotnetliguria.net/api/Questionnaire',
  'https://www.dotnetliguria.net/api/Questionnaire',
  'https://hello.vevy.com/realms/DotNetLiguria/protocol/openid-connect/userinfo',
])('tokens are allowed only for explicitly approved destinations: %s', url => {
  expect(domains().accessTokenDomains.some(rule => rule.test(url))).toBe(true);
});

test.each([
  'https://test-dotnetliguria.net/api/Questionnaire',
  'https://helloXvevy.com/realms/DotNetLiguria/protocol/openid-connect/userinfo',
  'https://dotnetliguria.net.attacker.invalid/api/',
  'https://dotnetliguria.net@attacker.invalid/api/',
  'https://www.dotnetliguria.net:444/api/',
  'https://beta.dotnetliguria.net/api/',
  'https://www.dotnetliguria.net/Contents/example.pdf',
  'https://www.dotnetliguria.net/apiculture',
  'http://dotnetliguria.net/api/',
  'https://localhost:5443/api/',
])('production never injects a token into %s', url => {
  expect(domains().accessTokenDomains.some(rule => rule.test(url))).toBe(false);
});

test('development API trust is available only to the HTTPS localhost worker', () => {
  const url = 'https://localhost:5443/api/Questionnaire';
  expect(domains('https://localhost:3443').accessTokenDomains.some(rule => rule.test(url))).toBe(true);
  expect(domains('http://localhost:3443').accessTokenDomains.some(rule => rule.test(url))).toBe(false);
});

test('the installed login implementation cannot fall back to plain PKCE', () => {
  const source = readFileSync(resolve('node_modules', '@axa-fr', 'oidc-client', 'src', 'requests.ts'), 'utf8');
  expect(source).toContain("extras.code_challenge_method = 'S256'");
  expect(source).toContain('deriveChallengeAsync(codeVerifier)');
  expect(source).toContain('formBodyExtras.code_verifier = await storage.getCodeVerifierAsync()');
});

test('authorization produces an S256 challenge bound to a fresh verifier even if plain is requested', async () => {
  vi.stubGlobal('crypto', webcrypto);
  const open = vi.fn();
  const noNetwork = vi.fn<typeof fetch>(async () => { throw new Error('Unexpected network request'); });
  const issuer = 'https://identity.example.test/realms/security';
  const client = OidcClient.getOrCreate(() => noNetwork, {
    open, reload: vi.fn(), getCurrentHref: () => 'https://client.example.test/',
    getPath: () => '/', getOrigin: () => 'https://client.example.test',
  })({
    client_id: 'synthetic-spa', redirect_uri: 'https://client.example.test/authentication/callback',
    authority: issuer, scope: 'openid', service_worker_activate: () => false,
    authority_configuration: {
      issuer, authorization_endpoint: `${issuer}/authorize`, token_endpoint: `${issuer}/token`,
      revocation_endpoint: `${issuer}/revoke`,
    },
  }, 'security-regression');
  await client.loginAsync('/q/example', { code_challenge_method: 'plain', code_challenge: 'injected' });
  const redirect = new URL(open.mock.calls[0][0]);
  const verifier = sessionStorage.getItem('oidc.code_verifier.security-regression');
  expect(verifier).toMatch(/^[A-Za-z0-9._~-]{43,128}$/);
  expect(redirect.searchParams.get('code_challenge_method')).toBe('S256');
  expect(redirect.searchParams.get('code_challenge')).toBe(createHash('sha256').update(verifier!).digest('base64url'));
  expect(redirect.searchParams.get('response_type')).toBe('code');
  expect(redirect.searchParams.get('state')).toBeTruthy();
  expect(redirect.searchParams.get('nonce')).toBeTruthy();
  expect(noNetwork).not.toHaveBeenCalled();
});

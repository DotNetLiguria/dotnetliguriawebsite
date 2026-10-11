// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import axios from 'axios';
import { useOidc, useOidcAccessToken } from '@axa-fr/react-oidc';
import { userProfileLocalStorageStore } from './store/userProfileLocalStorageStore';

vi.mock('@axa-fr/react-oidc', () => {
	const user = { sub: 'test-user', name: 'Test User', given_name: 'Test', family_name: 'User', email: 'user@example.test', roles: ['member'] };
	return {
		useOidc: vi.fn(() => ({ isAuthenticated: false, login: vi.fn(), logout: vi.fn(), renewTokens: vi.fn() })),
		useOidcFetch: () => ({ fetch: globalThis.fetch }),
		useOidcUser: () => ({ oidcUser: user, oidcUserLoadingState: 'Loaded' }),
		useOidcIdToken: () => ({ idToken: null, idTokenPayload: {} }),
		useOidcAccessToken: vi.fn(() => ({ accessToken: null, accessTokenPayload: {} })),
	};
});

beforeEach(() => {
	localStorage.clear();
	sessionStorage.clear();
	userProfileLocalStorageStore.setState({ profileSaved: false });
	vi.mocked(useOidc).mockReturnValue({ isAuthenticated: false, login: vi.fn(), logout: vi.fn(), renewTokens: vi.fn() });
	vi.mocked(useOidcAccessToken).mockReturnValue({ accessToken: null, accessTokenPayload: {} });
	vi.stubGlobal('fetch', vi.fn(async () => new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } })));
	axios.defaults.adapter = async () => { throw new Error('Unexpected Axios request: install a test adapter'); };
});

afterEach(() => {
	cleanup();
	vi.useRealTimers();
});

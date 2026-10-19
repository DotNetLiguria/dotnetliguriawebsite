import React from 'react';
import { act } from '@testing-library/react';
import { useOidc, useOidcUser } from '@axa-fr/react-oidc';
import { ADMIN_CAPABILITIES, NO_CAPABILITIES, jsonResponse, mockApi, render, screen } from '../test-utils';
import { AccountCapabilitiesProvider, useAccountCapabilities } from './AccountCapabilities';

function Consumer() {
  const { status, capabilities } = useAccountCapabilities();
  return <output>{status}:{String(capabilities?.canAccessAdmin ?? false)}</output>;
}
const signedIn = () => vi.mocked(useOidc).mockReturnValue({
  isAuthenticated: true, login: vi.fn(), logout: vi.fn(), renewTokens: vi.fn(),
});

test('anonymous capability provider never calls the authenticated endpoint', () => {
  render(<Consumer />, { accountProvider: true });
  expect(screen.getByRole('status')).toHaveTextContent('anonymous:false');
  expect(fetch).not.toHaveBeenCalled();
});

test.each([{}, [], { ...ADMIN_CAPABILITIES, schemaVersion: 2 }, { ...ADMIN_CAPABILITIES, permissions: 'events.read' }])('malformed capability responses never grant access', async value => {
  signedIn(); mockApi({ 'account/capabilities': value });
  render(<Consumer />, { accountProvider: true });
  await screen.findByText('error:false');
});

test('does not reuse capabilities across accounts or accept a late old-account response', async () => {
  signedIn();
  let resolveOld!: (response: Response) => void;
  let calls = 0;
  mockApi({ 'account/capabilities': () => ++calls === 1
    ? new Promise<Response>(resolve => { resolveOld = resolve; }) : jsonResponse(NO_CAPABILITIES) });
  const provider = <AccountCapabilitiesProvider><Consumer /></AccountCapabilitiesProvider>;
  const view = render(provider);
  expect(screen.getByRole('status')).toHaveTextContent('loading:false');
  const original = useOidcUser();
  vi.mocked(useOidcUser).mockReturnValue({ ...original, oidcUser: { ...original.oidcUser!, sub: 'another-account' } });
  view.rerender(<AccountCapabilitiesProvider><Consumer /></AccountCapabilitiesProvider>);
  await screen.findByText('ready:false');
  await act(async () => { resolveOld(jsonResponse(ADMIN_CAPABILITIES)); });
  expect(screen.getByRole('status')).toHaveTextContent('ready:false');
});

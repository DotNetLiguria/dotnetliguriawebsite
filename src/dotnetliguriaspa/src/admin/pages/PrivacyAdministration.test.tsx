import React from 'react';
import userEvent from '@testing-library/user-event';
import { useOidc } from '@axa-fr/react-oidc';
import { ADMIN_CAPABILITIES, NO_CAPABILITIES, jsonResponse, mockApi, render, screen, within } from '../../test-utils';
import PrivacyAdministration from './PrivacyAdministration';

const operation = { id: 'task-1', stage: 'awaiting_manual_identity_removal', notificationStatus: 'failed', notificationAttempts: 2, notificationError: 'smtp_unavailable' };
const controls = () => userEvent.setup({ delay: null, pointerEventsCheck: 0 });
const prepare = (capabilities = ADMIN_CAPABILITIES, extra: Parameters<typeof mockApi>[0] = {}) => {
  vi.mocked(useOidc).mockReturnValue({ isAuthenticated: true, login: vi.fn(), logout: vi.fn(), renewTokens: vi.fn() });
  const defaults = { 'account/capabilities': capabilities, 'privacy/admin/operations': [operation] };
  mockApi({ ...extra, ...Object.fromEntries(Object.entries(defaults).filter(([key]) => !(key in extra))) });
};

test.each([
  NO_CAPABILITIES,
  { ...NO_CAPABILITIES, canAccessAdmin: true, permissions: ['events.read' as const] },
])('accounts without privacy permissions cannot load privacy administration', async capabilities => {
  prepare(capabilities); render(<PrivacyAdministration />, { accountProvider: true });
  await screen.findByRole('heading', { name: 'Accesso non autorizzato' });
  expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes('/privacy/'))).toBe(false);
});

test('notification permission alone within website administration exposes no privacy task detail', async () => {
  prepare({ ...NO_CAPABILITIES, canAccessAdmin: true, permissions: ['notifications.preview'] });
  render(<PrivacyAdministration />, { accountProvider: true });
  await screen.findByRole('heading', { name: 'Prepara avvisi' });
  expect(screen.queryByRole('heading', { name: 'Amministrazione privacy' })).not.toBeInTheDocument();
  expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes('privacy/admin'))).toBe(false);
});

test('a confirmed campaign with no provider never claims messages were sent', async () => {
  prepare({ ...NO_CAPABILITIES, canAccessAdmin: true, permissions: ['notifications.preview', 'notifications.confirm'] }, {
    'notifications/campaigns/preview': { id: 'synthetic-campaign', recipientCount: 2, expiresAt: '2099-01-01' },
    'notifications/campaigns/synthetic-campaign/confirm': () => jsonResponse({ code: 'notification_dispatch_unavailable_no_approved_provider' }, 503),
  });
  render(<PrivacyAdministration />, { accountProvider: true });
  const user = controls();
  await user.click(await screen.findByRole('button', { name: 'Anteprima riepilogo mensile' }));
  await screen.findByText(/2 destinatari idonei/);
  await user.click(screen.getByRole('button', { name: 'Conferma preparazione senza invio' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('nessun messaggio è stato inviato');
});

test('lists only minimal operation data and requires an explicit recent-MFA identity request', async () => {
  prepare({ ...NO_CAPABILITIES, canAccessAdmin: true, permissions: ['privacy.operations.read', 'privacy.operations.manage', 'privacy.identities.read'] }, {
    'operations/task-1/identity': () => jsonResponse({ code: 'recent_mfa_required' }, 403),
  });
  render(<PrivacyAdministration />, { route: '/admin/privacy?task=1#pending', accountProvider: true });
  const card = await screen.findByRole('region', { name: 'Richiesta task-1' });
  expect(within(card).getByText(/Fase: In attesa della rimozione manuale/)).toBeInTheDocument();
  expect(within(card).getByRole('alert')).toHaveTextContent('smtp_unavailable');
  expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes('/identity'))).toBe(false);
  expect(within(card).getByRole('button', { name: 'Verifica identità già rimossa' })).toBeDisabled();
  const user = controls();
  await user.click(within(card).getByRole('button', { name: /Mostra identità/ }));
  await within(card).findByText(/È richiesta una verifica MFA recente/);
  await user.click(screen.getByRole('button', { name: 'Verifica MFA per il recupero' }));
  expect(useOidc().login).toHaveBeenCalledWith('/admin/privacy?task=1#pending', { acr_values: 'mfa', max_age: '0', prompt: 'login' });
  expect(screen.queryByRole('heading', { name: 'Prepara avvisi' })).not.toBeInTheDocument();
});

test('pending resume retains task instead of claiming completion; queued notification is not delivered', async () => {
  prepare(ADMIN_CAPABILITIES, {
    'operations/task-1/resume': () => jsonResponse({ status: 'awaiting_manual_identity_removal' }, 202),
    'operations/task-1/retry-notification': () => jsonResponse({ status: 'queued' }, 202),
  });
  render(<PrivacyAdministration />, { accountProvider: true });
  const card = await screen.findByRole('region', { name: 'Richiesta task-1' });
  const user = controls();
  await user.click(within(card).getByRole('checkbox'));
  await user.click(within(card).getByRole('button', { name: 'Riprova cancellazione automatica' }));
  await within(card).findByText(/Richiesta ancora pendente/);
  expect(screen.getByRole('region', { name: 'Richiesta task-1' })).toBeInTheDocument();
  expect(screen.queryByText('Cancellazione completata e verificata.')).not.toBeInTheDocument();
  await user.click(within(card).getByRole('checkbox'));
  await user.click(within(card).getByRole('button', { name: 'Riprova avviso amministrativo' }));
  await within(card).findByText('Avviso accodato. Non è una conferma di consegna.');
  expect(fetch).toHaveBeenCalledWith(expect.stringContaining('operations/task-1/retry-notification'), expect.objectContaining({
    method: 'POST', headers: { 'X-Confirm-Erasure': 'retry-notification' },
  }));
});

test('verified completion removes both task and previously revealed identity from browser state', async () => {
  let completed = false;
  prepare(ADMIN_CAPABILITIES, {
    'operations/task-1/identity': { issuer: 'https://identity.example.test', subject: 'private-account-reference' },
    'operations/task-1/verify-removal': (_url: string, init?: RequestInit) => {
      expect(init?.headers).toEqual({ 'X-Confirm-Erasure': 'verify-identity-removal' });
      completed = true;
      return jsonResponse({ status: 'completed' });
    },
    'privacy/admin/operations': () => jsonResponse(completed ? [] : [operation]),
  });
  render(<PrivacyAdministration />, { accountProvider: true });
  const card = await screen.findByRole('region', { name: 'Richiesta task-1' });
  const user = controls();
  await user.click(within(card).getByRole('button', { name: /Mostra identità/ }));
  await screen.findByText('private-account-reference');
  await user.click(within(card).getByRole('checkbox'));
  await user.click(within(card).getByRole('button', { name: 'Verifica identità già rimossa' }));
  await screen.findByText('Nessuna richiesta pendente.');
  expect(screen.queryByText('private-account-reference')).not.toBeInTheDocument();
  expect(screen.queryByRole('region', { name: 'Richiesta task-1' })).not.toBeInTheDocument();
});

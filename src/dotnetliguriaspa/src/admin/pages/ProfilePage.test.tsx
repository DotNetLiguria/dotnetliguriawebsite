import React from 'react';
import userEvent from '@testing-library/user-event';
import { useOidc, useOidcAccessToken } from '@axa-fr/react-oidc';
import { jsonResponse, mockApi, render, screen, waitFor } from '../../test-utils';
import ProfilePage from './ProfilePage';

const subscription = { version: 'synthetic-v1', monthlyUpcomingEvents: true, eventAnnouncements: false };
const prepare = (extra: Parameters<typeof mockApi>[0] = {}) => mockApi({
  'privacy/status': { status: 'no_pending_request' },
  'notifications/subscription/': subscription,
  ...extra,
});
const user = () => userEvent.setup({ delay: null, pointerEventsCheck: 0 });

describe('<ProfilePage />', () => {
  test('shows Keycloak-only identity and removes unimplemented extra-profile collection', async () => {
    prepare(); render(<ProfilePage />);
    await screen.findByText('Nessuna richiesta pendente.');
    expect(screen.getByRole('textbox', { name: 'Nome' })).toHaveValue('Test');
    expect(screen.getByRole('textbox', { name: 'Nome' })).toHaveAttribute('readonly');
    expect(screen.getByRole('link', { name: /Apri il tuo account/ })).toHaveAttribute('href', 'https://hello.vevy.com/realms/DotNetLiguria/account');
    expect(screen.queryByRole('textbox', { name: 'Azienda' })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'LinkedIn' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancella definitivamente il mio account' })).toBeDisabled();
  });

  test('withdraws consent without sending email or identity from the browser', async () => {
    let optedIn = true;
    prepare({ 'notifications/subscription/': (_url: string, init?: RequestInit) => {
      if (init?.method === 'PUT') { optedIn = false; return new Response(null, { status: 204 }); }
      return jsonResponse({ ...subscription, monthlyUpcomingEvents: optedIn });
    } });
    render(<ProfilePage />);
    await user().click(await screen.findByRole('button', { name: 'Revoca riepilogo mensile' }));
    await screen.findByText('Iscrizione revocata.');
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('notifications/subscription/'), expect.objectContaining({
      method: 'PUT', body: JSON.stringify({ purpose: 'monthly-upcoming-events', version: 'synthetic-v1', optIn: false }),
    }));
    expect(screen.getByRole('button', { name: 'Iscriviti al riepilogo mensile' })).toBeEnabled();
  });

  test('requests fresh MFA but never deletes just by requesting step-up', async () => {
    prepare(); render(<ProfilePage />);
    await user().click(screen.getByRole('button', { name: 'Verifica MFA per la cancellazione' }));
    const oidc = vi.mocked(useOidc).mock.results.at(-1)!.value;
    expect(oidc.login).toHaveBeenCalledWith(expect.any(String), { acr_values: 'mfa', max_age: '0', prompt: 'login' });
    expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes('/privacy/erase'))).toBe(false);
  });

  test('keeps blocked erasure explicit after the two-part destructive confirmation', async () => {
    prepare({ 'privacy/erase': () => jsonResponse({ code: 'erasure_preflight_blocked' }, 409) });
    render(<ProfilePage />);
    const controls = user();
    await controls.click(screen.getByRole('checkbox', { name: /Ho compreso/ }));
    await controls.type(screen.getByRole('textbox', { name: 'Scrivi ELIMINA per confermare' }), 'ELIMINA');
    await controls.click(screen.getByRole('button', { name: 'Cancella definitivamente il mio account' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Cancellazione bloccata');
    expect(screen.queryByText('Cancellazione completata.')).not.toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('privacy/erase'), expect.objectContaining({
      method: 'POST', headers: { 'X-Confirm-Erasure': 'erase-my-account' },
    }));
  });

  test.each([401, 403])('does not present a failed export (%s) as successful', async status => {
    prepare({ 'privacy/export': () => jsonResponse({}, status) });
    render(<ProfilePage />);
    await user().click(screen.getByRole('button', { name: 'Esporta i miei dati' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(status === 401 ? 'Accedi di nuovo' : 'non autorizzata');
  });

  test('shows pending erasure and unavailable consent services truthfully', async () => {
    mockApi({
      'privacy/status': { status: 'preflight_blocked' },
      'notifications/subscription/': () => jsonResponse({ code: 'identity_admin_not_configured' }, 503),
    });
    render(<ProfilePage />);
    await screen.findByText(/Richiesta non conclusa/);
    await screen.findByRole('alert');
    expect(screen.getByRole('button', { name: 'Iscriviti al riepilogo mensile' })).toBeDisabled();
  });

  test('a confirmed campaign with no provider never claims messages were sent', async () => {
    vi.mocked(useOidcAccessToken).mockReturnValue({
      accessToken: null, accessTokenPayload: { realm_access: { roles: ['notificationadmin'] } },
    });
    prepare({
      'notifications/campaigns/preview': { id: 'synthetic-campaign', recipientCount: 2, expiresAt: '2099-01-01' },
      'notifications/campaigns/synthetic-campaign/confirm': () => jsonResponse({ code: 'notification_dispatch_unavailable_no_approved_provider' }, 503),
    });
    render(<ProfilePage />);
    const controls = user();
    await controls.click(screen.getByRole('button', { name: 'Anteprima riepilogo mensile' }));
    await screen.findByText(/2 destinatari idonei/);
    await controls.click(screen.getByRole('button', { name: 'Conferma preparazione senza invio' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('nessun messaggio è stato inviato'));
  });
});

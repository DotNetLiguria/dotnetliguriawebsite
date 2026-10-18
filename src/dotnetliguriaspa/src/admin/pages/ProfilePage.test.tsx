import React from 'react';
import userEvent from '@testing-library/user-event';
import { useOidc } from '@axa-fr/react-oidc';
import { jsonResponse, mockApi, render, screen, waitFor } from '../../test-utils';
import ProfilePage from './ProfilePage';

const subscription = { version: 'synthetic-v1', monthlyUpcomingEvents: true, eventAnnouncements: false };
const personal = {
  identity: { firstName: 'Nome aggiornato', lastName: 'Cognome aggiornato', email: 'fresh@example.test', emailVerified: true },
  records: [{ kind: 'response', id: 'r1', title: 'Feedback evento', submittedAt: '2026-10-01T12:00:00Z', consentGiven: true, questionnaireVersion: 2 }],
  hasMore: false, warning: 'I dati legacy richiedono una verifica separata.',
};
const consents = {
  current: [{ purpose: 'monthly-upcoming-events', version: 'old-v1', grantedAt: '2025-01-01T12:00:00Z' }],
  history: [], hasMore: false,
};
const defaults = {
  'privacy/status': { status: 'no_pending_request' },
  'notifications/subscription/': subscription,
  'privacy/data': personal,
  'notifications/consents': consents,
};
const prepare = (extra: Parameters<typeof mockApi>[0] = {}) => mockApi({
  ...extra, ...Object.fromEntries(Object.entries(defaults).filter(([key]) => !(key in extra))),
});
const user = () => userEvent.setup({ delay: null, pointerEventsCheck: 0 });
const confirmErasure = async () => {
  const controls = user();
  await controls.click(screen.getByRole('checkbox', { name: /Ho compreso/ }));
  await controls.type(screen.getByRole('textbox', { name: 'Scrivi ELIMINA per confermare' }), 'ELIMINA');
  await controls.click(screen.getByRole('button', { name: 'Cancella definitivamente il mio account' }));
};

describe('<ProfilePage />', () => {
  test('shows fresh server identity and bounded evidence, never token identity or personal localStorage', async () => {
    prepare(); render(<ProfilePage />);
    await screen.findByText('Nessuna richiesta pendente.');
    expect(screen.getByRole('textbox', { name: 'Nome' })).toHaveValue('Nome aggiornato');
    expect(screen.getByRole('textbox', { name: 'Nome' })).toHaveAttribute('readonly');
    expect(screen.getByRole('link', { name: /Modifica account e sicurezza/ })).toHaveAttribute('href', 'https://hello.vevy.com/realms/DotNetLiguria/account');
    expect(screen.getByText('Feedback evento')).toBeInTheDocument();
    expect(screen.getByText(/Consenso questionario: prestato/)).toBeInTheDocument();
    expect(screen.getByText('I dati legacy richiedono una verifica separata.')).toBeInTheDocument();
    expect(screen.getByText(/consenso attuale · versione old-v1/)).toBeInTheDocument();
    expect(screen.getByText('Nessuna modifica registrata nella cronologia futura.')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Azienda' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Amministrazione privacy' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancella definitivamente il mio account' })).toBeDisabled();
    expect(JSON.stringify({ ...localStorage })).not.toContain('fresh@example.test');
    expect(vi.mocked(fetch).mock.calls.every(([, init]) => init?.cache === 'no-store')).toBe(true);
  });

  test('withdraws consent without sending email or identity and reloads evidence, history and personal data', async () => {
    let optedIn = true;
    prepare({ 'notifications/subscription/': (_url: string, init?: RequestInit) => {
      if (init?.method === 'PUT') { optedIn = false; return new Response(null, { status: 204 }); }
      return jsonResponse({ ...subscription, monthlyUpcomingEvents: optedIn });
    } });
    render(<ProfilePage />);
    await user().click(await screen.findByRole('button', { name: 'Revoca riepilogo mensile' }));
    await screen.findByText(/Revoca accettata/);
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('notifications/subscription/'), expect.objectContaining({
      method: 'PUT', body: JSON.stringify({ purpose: 'monthly-upcoming-events', version: 'synthetic-v1', optIn: false }),
    }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Iscriviti al riepilogo mensile' })).toBeEnabled());
    for (const path of ['notifications/consents', 'privacy/data'])
      expect(vi.mocked(fetch).mock.calls.filter(([url]) => String(url).includes(path))).toHaveLength(2);
  });

  test('grants a separate event notice with current version and no additional account attributes', async () => {
    prepare(); render(<ProfilePage />);
    await screen.findByText('Nessuna richiesta pendente.');
    await user().click(screen.getByRole('button', { name: 'Iscriviti agli annunci eventi' }));
    await screen.findByText(/Preferenza accettata/);
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('notifications/subscription/'), expect.objectContaining({
      method: 'PUT', body: JSON.stringify({ purpose: 'event-announcements', version: 'synthetic-v1', optIn: true }),
    }));
  });

  test('requests fresh MFA at current path/query/hash but never deletes just by requesting step-up', async () => {
    prepare(); render(<ProfilePage />, { route: '/area-personale?source=account#cancellazione' });
    await user().click(screen.getByRole('button', { name: 'Verifica MFA per la cancellazione' }));
    expect(useOidc().login).toHaveBeenCalledWith('/area-personale?source=account#cancellazione', { acr_values: 'mfa', max_age: '0', prompt: 'login' });
    expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes('/privacy/erase'))).toBe(false);
  });

  test('keeps blocked erasure explicit after the two-part destructive confirmation', async () => {
    prepare({ 'privacy/erase': () => jsonResponse({ code: 'erasure_preflight_blocked' }, 409) });
    render(<ProfilePage />);
    await confirmErasure();
    expect(await screen.findByRole('alert')).toHaveTextContent('Cancellazione bloccata');
    expect(screen.queryByText('Cancellazione completata.')).not.toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('privacy/erase'), expect.objectContaining({
      method: 'POST', headers: { 'X-Confirm-Erasure': 'erase-my-account' },
    }));
  });

  test.each([
    [200, 'completed', 'Cancellazione completata.'],
    [202, 'awaiting_manual_identity_removal', 'Richiesta accettata.'],
  ])('clears personal state and logs out after %s, without calling pending complete', async (status, outcome, text) => {
    const logout = vi.fn(async () => undefined);
    vi.mocked(useOidc).mockReturnValue({ isAuthenticated: true, login: vi.fn(), logout, renewTokens: vi.fn() });
    prepare({ 'privacy/erase': () => jsonResponse({ status: outcome }, status) });
    localStorage.setItem('profileStore', '{}');
    sessionStorage.setItem('questionnaire-draft:old', 'private draft');
    render(<ProfilePage />);
    await screen.findByText('Feedback evento');
    await confirmErasure();
    await screen.findByText(new RegExp(String(text).replaceAll('.', '\\.')));
    expect(logout).toHaveBeenCalledWith('/');
    expect(localStorage.getItem('profileStore')).toBeNull();
    expect(sessionStorage.getItem('questionnaire-draft:old')).toBeNull();
    expect(screen.queryByRole('textbox', { name: 'Email' })).not.toBeInTheDocument();
    expect(screen.queryByText('Feedback evento')).not.toBeInTheDocument();
    if (status === 202) expect(screen.queryByText('Cancellazione completata.')).not.toBeInTheDocument();
  });

  test('keeps pending outcome non-identifying if logout fails', async () => {
    vi.mocked(useOidc).mockReturnValue({ isAuthenticated: true, login: vi.fn(), logout: vi.fn(async () => { throw new Error('offline'); }), renewTokens: vi.fn() });
    prepare({ 'privacy/erase': () => jsonResponse({ status: 'awaiting_manual_identity_removal' }, 202) });
    render(<ProfilePage />);
    await confirmErasure();
    expect(await screen.findByRole('alert')).toHaveTextContent('chiudi la scheda');
    expect(screen.getByRole('status')).toHaveTextContent('non è ancora completata');
    expect(screen.queryByText(/fresh@example.test/)).not.toBeInTheDocument();
  });

  test.each([401, 403])('does not present a failed export (%s) as successful', async status => {
    prepare({ 'privacy/export': () => jsonResponse({}, status) });
    render(<ProfilePage />);
    await user().click(screen.getByRole('button', { name: 'Esporta i miei dati' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(status === 401 ? 'Accedi di nuovo' : 'non autorizzata');
  });

  test('downloads the existing export endpoint without persisting the personal payload', async () => {
    prepare({ 'privacy/export': { personal: 'synthetic-private-export' } });
    const createObjectURL = vi.fn((blob: Blob) => {
      expect(blob.size).toBeGreaterThan(0);
      return 'blob:synthetic-export';
    });
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', Object.assign(class extends URL {}, { createObjectURL, revokeObjectURL }));
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    render(<ProfilePage />);
    await user().click(screen.getByRole('button', { name: 'Esporta i miei dati' }));
    await screen.findByText(/Esportazione scaricata/);
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:synthetic-export');
    expect(JSON.stringify({ ...localStorage })).not.toContain('synthetic-private-export');
  });

  test('shows independent consent errors without hiding fresh identity and retries only the failed service', async () => {
    let failed = true;
    prepare({ 'notifications/consents': () => failed ? jsonResponse({}, 503) : jsonResponse(consents) });
    render(<ProfilePage />);
    await screen.findByRole('alert');
    expect(screen.getByRole('textbox', { name: 'Nome' })).toHaveValue('Nome aggiornato');
    expect(screen.getByRole('button', { name: 'Revoca riepilogo mensile' })).toBeEnabled();
    failed = false;
    await user().click(screen.getByRole('button', { name: 'Riprova evidenze e cronologia' }));
    await screen.findByText(/consenso attuale · versione old-v1/);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(vi.mocked(fetch).mock.calls.filter(([url]) => String(url).includes('privacy/data'))).toHaveLength(1);
  });

  test('a failed fresh identity read does not fall back to stale OIDC names', async () => {
    prepare({ 'privacy/data': () => jsonResponse({}, 503) });
    render(<ProfilePage />);
    await screen.findByRole('alert');
    expect(screen.queryByRole('textbox', { name: 'Nome' })).not.toBeInTheDocument();
    expect(screen.getByText(/consenso attuale · versione old-v1/)).toBeInTheDocument();
  });

  test('pages records and future history with fixed offsets, keeping current evidence separate', async () => {
    prepare({
      'privacy/data?offset=50': { ...personal, records: [{ ...personal.records[0], id: 'r2', title: 'Seconda pagina' }] },
      'privacy/data?offset=0': { ...personal, hasMore: true },
      'notifications/consents?offset=50': { ...consents, history: [{ id: 'c2', purpose: 'event-announcements', version: 'v2', occurredAt: '2026-10-15T12:00:00Z', action: 'withdraw', status: 'pending' }] },
      'notifications/consents?offset=0': { ...consents, hasMore: true },
    });
    render(<ProfilePage />);
    const controls = user();
    await controls.click(await screen.findByRole('button', { name: 'Carica altri dati' }));
    await screen.findByText('Seconda pagina');
    expect(screen.getByText('Feedback evento')).toBeInTheDocument();
    await controls.click(screen.getByRole('button', { name: 'Carica altra cronologia' }));
    await screen.findByText(/Annunci eventi · Revoca · versione v2/);
    expect(screen.getByText(/Annunci eventi · Revoca · versione v2/)).toHaveTextContent('In attesa');
    expect(screen.getByText(/consenso attuale · versione old-v1/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Carica altra cronologia' })).not.toBeInTheDocument();
  });
});

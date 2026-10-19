import React from 'react';
import userEvent from '@testing-library/user-event';
import { useOidc } from '@axa-fr/react-oidc';
import { jsonResponse, mockApi, render, screen } from '../../test-utils';
import ProfilePage from './ProfilePage';

const personal = {
  identity: { firstName: 'Nome aggiornato', lastName: 'Cognome aggiornato', email: 'fresh@example.test', emailVerified: true },
  records: [{ kind: 'response', id: 'r1', title: 'Feedback evento', submittedAt: '2026-10-01T12:00:00Z', consentGiven: true, questionnaireVersion: 2 }],
  hasMore: false, warning: 'I dati legacy richiedono una verifica separata.',
};
const defaults = {
  'privacy/status': { status: 'no_pending_request' },
  'privacy/data': personal,
  'privacy/profile': personal.identity,
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
    expect(await screen.findByRole('textbox', { name: 'Nome' })).toHaveValue('Nome aggiornato');
    expect(screen.getByRole('textbox', { name: 'Nome' })).toHaveAttribute('readonly');
    expect(screen.getByRole('link', { name: /Modifica account e sicurezza/ })).toHaveAttribute('href', 'https://hello.vevy.com/realms/DotNetLiguria/account');
    expect(screen.getAllByRole('link').filter(link => link.getAttribute('href') === 'https://hello.vevy.com/realms/DotNetLiguria/account')).toHaveLength(1);
    expect(document.body).not.toHaveTextContent(/keycloak/i);
    expect(screen.getByRole('heading', { name: 'Account Identity Provider' })).toBeInTheDocument();

    await user().click(screen.getByRole('tab', { name: 'Dati condivisi' }));
    expect(screen.getByText('Feedback evento')).toBeInTheDocument();
    expect(screen.getByText(/Consenso questionario: prestato/)).toBeInTheDocument();
    expect(screen.getByText('I dati legacy richiedono una verifica separata.')).toBeInTheDocument();

    await user().click(screen.getByRole('tab', { name: 'Consensi' }));
    expect(screen.getByRole('heading', { name: 'Lista dei consensi' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Email per nuovi eventi' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Email per nuovi eventi' })).toBeDisabled();
    expect(screen.getByText(/requisito minimo per fare parte della community/)).toBeInTheDocument();
    expect(screen.queryByText('Consensi attuali e cronologia')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /riepilogo mensile|annunci eventi/i })).not.toBeInTheDocument();

    await user().click(screen.getByRole('tab', { name: 'Privacy' }));
    expect(screen.queryByRole('textbox', { name: 'Azienda' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Amministrazione privacy' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancella definitivamente il mio account' })).toBeDisabled();
    expect(JSON.stringify({ ...localStorage })).not.toContain('fresh@example.test');
    expect(vi.mocked(fetch).mock.calls.every(([, init]) => init?.cache === 'no-store')).toBe(true);
  });

  test('organizes the personal area into accessible tabs, including consents', async () => {
    prepare(); render(<ProfilePage />);
    expect(screen.getByRole('tablist', { name: "Sezioni dell'area personale" })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Account' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('heading', { name: 'Account Identity Provider' })).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Lista dei consensi' })).not.toBeInTheDocument();

    await user().click(screen.getByRole('tab', { name: 'Consensi' }));
    expect(screen.getByRole('tab', { name: 'Consensi' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('heading', { name: 'Lista dei consensi' })).toBeVisible();
  });

  test.each([
    ['Configura app di autenticazione (OTP)', 'CONFIGURE_TOTP'],
    ['Registra chiave di sicurezza', 'webauthn-register'],
  ])('%s starts Identity Provider enrollment and returns to the personal page without API writes', async (name, action) => {
    prepare(); render(<ProfilePage />, { route: '/area-personale' });
    expect(await screen.findByRole('note')).toHaveTextContent('non include una verifica MFA (livello: non indicato)');
    await user().click(screen.getByRole('button', { name }));
    expect(useOidc().login).toHaveBeenCalledWith('/area-personale', { kc_action: action });
    expect(vi.mocked(fetch).mock.calls.every(([, init]) => !init?.method || init.method === 'GET')).toBe(true);
  });

  test('account MFA section requests a step-up sign-in without API writes', async () => {
    prepare(); render(<ProfilePage />, { route: '/area-personale' });
    await user().click(await screen.findByRole('button', { name: 'Verifica MFA ora' }));
    expect(useOidc().login).toHaveBeenCalledWith('/area-personale', { acr_values: 'mfa' });
    expect(vi.mocked(fetch).mock.calls.every(([, init]) => !init?.method || init.method === 'GET')).toBe(true);
  });

  test('requests fresh MFA at current path/query/hash but never deletes just by requesting step-up', async () => {
    prepare(); render(<ProfilePage />, { route: '/area-personale?source=account#cancellazione' });
    await user().click(screen.getByRole('tab', { name: 'Privacy' }));
    await user().click(screen.getByRole('button', { name: 'Verifica MFA per la cancellazione' }));
    expect(useOidc().login).toHaveBeenCalledWith('/area-personale?source=account#cancellazione', { acr_values: 'mfa' });
    expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes('/privacy/erase'))).toBe(false);
  });

  test('keeps blocked erasure explicit after the two-part destructive confirmation', async () => {
    prepare({ 'privacy/erase': () => jsonResponse({ code: 'erasure_preflight_blocked' }, 409) });
    render(<ProfilePage />);
    await user().click(screen.getByRole('tab', { name: 'Privacy' }));
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
    await user().click(screen.getByRole('tab', { name: 'Privacy' }));
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
    await user().click(screen.getByRole('tab', { name: 'Privacy' }));
    await confirmErasure();
    expect(await screen.findByRole('alert')).toHaveTextContent('chiudi la scheda');
    expect(screen.getByRole('status')).toHaveTextContent('non è ancora completata');
    expect(screen.queryByText(/fresh@example.test/)).not.toBeInTheDocument();
  });

  test.each([401, 403])('does not present a failed export (%s) as successful', async status => {
    prepare({ 'privacy/export': () => jsonResponse({}, status) });
    render(<ProfilePage />);
    await user().click(screen.getByRole('tab', { name: 'Privacy' }));
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
    await user().click(screen.getByRole('tab', { name: 'Privacy' }));
    await user().click(screen.getByRole('button', { name: 'Esporta i miei dati' }));
    await screen.findByText(/Esportazione scaricata/);
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:synthetic-export');
    expect(JSON.stringify({ ...localStorage })).not.toContain('synthetic-private-export');
  });

  test('a failed fresh identity read does not fall back to stale OIDC names', async () => {
    prepare({ 'privacy/profile': () => jsonResponse({}, 503) });
    render(<ProfilePage />);
    await screen.findByRole('alert');
    expect(screen.queryByRole('textbox', { name: 'Nome' })).not.toBeInTheDocument();
    await user().click(screen.getByRole('tab', { name: 'Consensi' }));
    expect(screen.getByRole('checkbox', { name: 'Email per nuovi eventi' })).toBeChecked();
  });

  test('forwards only names and keeps email read-only even while editing', async () => {
    prepare({ 'privacy/profile': (_url: string, init?: RequestInit) => init?.method === 'PUT'
      ? jsonResponse({ ...personal.identity, firstName: 'Nuovo nome' })
      : jsonResponse(personal.identity) });
    render(<ProfilePage />);
    const controls = user();
    await controls.click(await screen.findByRole('button', { name: 'Modifica dati personali' }));
    const name = screen.getByRole('textbox', { name: 'Nome' });
    const email = screen.getByRole('textbox', { name: /^Email/ });
    expect(name).not.toHaveAttribute('readonly');
    await controls.clear(name);
    await controls.type(name, 'Nuovo nome');
    expect(email).toHaveAttribute('readonly');
    expect(email).toHaveValue(personal.identity.email);
    expect(screen.getByRole('link', { name: 'Modifica account e sicurezza (nuova scheda)' }))
      .toHaveAttribute('href', 'https://hello.vevy.com/realms/DotNetLiguria/account');
    expect(screen.getByRole('link', { name: 'Modifica account e sicurezza (nuova scheda)' }))
      .toHaveAttribute('rel', 'noopener noreferrer');
    await controls.click(screen.getByRole('button', { name: 'Salva dati personali' }));
    await screen.findByText(/Dati personali salvati nell’Identity Provider/);
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('privacy/profile'), expect.objectContaining({
      method: 'PUT', body: JSON.stringify({ firstName: 'Nuovo nome', lastName: 'Cognome aggiornato' }),
    }));
    expect(screen.getByRole('textbox', { name: 'Nome' })).toHaveValue('Nuovo nome');
    expect(screen.getByRole('textbox', { name: 'Nome' })).toHaveAttribute('readonly');
    expect(screen.getByText('Email verificata.')).toBeInTheDocument();
    expect(JSON.stringify({ ...localStorage, ...sessionStorage })).not.toContain(personal.identity.email);
  });

  test('cancels edits without sending a write or retaining a draft', async () => {
    prepare(); render(<ProfilePage />);
    const controls = user();
    await controls.click(await screen.findByRole('button', { name: 'Modifica dati personali' }));
    await controls.type(screen.getByRole('textbox', { name: 'Nome' }), ' modificato');
    await controls.click(screen.getByRole('button', { name: 'Annulla modifiche' }));
    expect(screen.getByRole('textbox', { name: 'Nome' })).toHaveValue(personal.identity.firstName);
    expect(vi.mocked(fetch).mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(false);
  });

  test('keeps rejected edits in memory and does not claim successful persistence', async () => {
    prepare({ 'privacy/profile': (_url: string, init?: RequestInit) => init?.method === 'PUT'
      ? jsonResponse({ code: 'profile_update_rejected' }, 400) : jsonResponse(personal.identity) });
    render(<ProfilePage />);
    const controls = user();
    await controls.click(await screen.findByRole('button', { name: 'Modifica dati personali' }));
    await controls.type(screen.getByRole('textbox', { name: 'Nome' }), ' modificato');
    await controls.click(screen.getByRole('button', { name: 'Salva dati personali' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Identity Provider ha rifiutato i dati');
    expect(screen.getByRole('textbox', { name: 'Nome' })).toHaveValue('Nome aggiornato modificato');
    expect(screen.queryByText(/Dati personali salvati/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Salva dati personali' })).toBeEnabled();
  });

  test('profile editing is independent of unavailable website records', async () => {
    prepare({ 'privacy/data': () => jsonResponse({}, 503) }); render(<ProfilePage />);
    await user().click(screen.getByRole('tab', { name: 'Dati condivisi' }));
    await screen.findByRole('alert');
    await user().click(screen.getByRole('tab', { name: 'Account' }));
    expect(screen.getByRole('textbox', { name: 'Nome' })).toHaveValue(personal.identity.firstName);
    expect(screen.getByRole('button', { name: 'Modifica dati personali' })).toBeEnabled();
  });

  test('pages personal data records with a fixed offset', async () => {
    prepare({
      'privacy/data?offset=50': { ...personal, records: [{ ...personal.records[0], id: 'r2', title: 'Seconda pagina' }] },
      'privacy/data?offset=0': { ...personal, hasMore: true },
    });
    render(<ProfilePage />);
    const controls = user();
    await controls.click(screen.getByRole('tab', { name: 'Dati condivisi' }));
    await controls.click(await screen.findByRole('button', { name: 'Carica altri dati' }));
    await screen.findByText('Seconda pagina');
    expect(screen.getByText('Feedback evento')).toBeInTheDocument();
  });
});

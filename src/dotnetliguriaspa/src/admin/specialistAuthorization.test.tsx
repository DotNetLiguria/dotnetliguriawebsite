import React from 'react';
import { Route, Routes } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { useOidcIdToken } from '@axa-fr/react-oidc';
import { render, screen, mockApi, jsonResponse, waitFor, fireEvent } from '../test-utils';
import { CapabilityContext } from '../account/AccountCapabilities';
import { Permission } from '../account/permissions';
import DashboardPage from './pages/DashboardPage';
import BackupPage from './pages/BackupPage';
import AccessPage from './pages/AccessPage';
import QuestionnaireResults from '../components/QuestionnaireResults/QuestionnaireResults';
import EventDetailAdminPage from './pages/EventDetailAdminPage';
import { eventFixture, serveEvent } from './pages/eventFixtures';

const withPermissions = (permissions: Permission[], children: React.ReactNode) =>
  <CapabilityContext.Provider value={{
    status: 'ready', capabilities: { schemaVersion: 1, permissions, canAccessAdmin: true },
    retry: vi.fn(), clear: vi.fn(), refresh: vi.fn(),
  }}>{children}</CapabilityContext.Provider>;

const mockSignIn = (payload: Record<string, unknown>) =>
  vi.mocked(useOidcIdToken).mockReturnValue({ idToken: null, idTokenPayload: payload } as unknown as ReturnType<typeof useOidcIdToken>);

beforeEach(() => mockSignIn({ acr: 'mfa', auth_time: Math.floor(Date.now() / 1000) }));

test('privacy-only overview never loads events, speakers, board or venues', async () => {
  mockApi({ 'privacy/admin/operations': [] });
  render(withPermissions(['privacy.operations.read'], <DashboardPage />));
  await screen.findByText('0 richieste da verificare');
  const urls = vi.mocked(fetch).mock.calls.map(([url]) => String(url));
  expect(urls).toHaveLength(1);
  expect(urls[0]).toContain('privacy/admin/operations');
  expect(screen.queryByRole('link', { name: 'Nuovo evento' })).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: /^Eventi$/ })).not.toBeInTheDocument();
});

test('aggregate-only results never request raw responses or questionnaire definitions', async () => {
  mockApi({ '/statistics': { questionnaireId: 'q1', title: 'Feedback', responseCount: 0, firstResponseAt: null, lastResponseAt: null, responsesPerDay: [], questions: [] } });
  render(withPermissions(['questionnaire-results.read'], <Routes><Route path="/admin/questionnaires/:id/results" element={<QuestionnaireResults />} /></Routes>), { route: '/admin/questionnaires/q1/results' });
  await screen.findByRole('heading', { name: 'Risultati: Feedback' });
  const calls = vi.mocked(fetch).mock.calls;
  expect(calls).toHaveLength(1);
  expect(String(calls[0][0])).toContain('/statistics');
  expect(calls[0][1]?.headers).toEqual(expect.objectContaining({ 'X-Admin-Request': 'true' }));
  expect(screen.queryByRole('tab', { name: /^Risposte/ })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Esporta CSV' })).toBeDisabled();
});

test('raw-response-only results do not fetch aggregate statistics', async () => {
  mockApi({ '/responses': [] });
  render(withPermissions(['questionnaire-responses.read'], <Routes><Route path="/admin/questionnaires/:id/results" element={<QuestionnaireResults />} /></Routes>), { route: '/admin/questionnaires/q1/results' });
  await screen.findByRole('tab', { name: 'Risposte (0)' });
  expect(vi.mocked(fetch).mock.calls).toHaveLength(1);
  expect(String(vi.mocked(fetch).mock.calls[0][0])).toContain('/responses');
  expect(screen.queryByRole('tab', { name: 'Riepilogo' })).not.toBeInTheDocument();
});

test('backup readers cannot create or restore snapshots', async () => {
  mockApi({ '/Backup/snapshots': [{ snapshotId: 's1', createdAtUtc: '2026-01-01T10:00:00Z', collectionCount: 1, documentCount: 2, isSafetySnapshot: false }] });
  render(withPermissions(['backups.read'], <BackupPage />));
  await screen.findByRole('heading', { name: 'Backup disponibili' });
  expect(screen.getByRole('button', { name: 'Crea backup' })).toBeDisabled();
  for (const button of screen.getAllByRole('button', { name: /Ripristina il backup/ })) expect(button).toBeDisabled();
  expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/Backup/snapshots'), expect.objectContaining({ headers: { 'X-Admin-Request': 'true' } }));
});

test('event publishers use the dedicated publication route without routine edit permission or unrelated selector reads', async () => {
  const api = serveEvent(eventFixture({ published: false }));
  render(withPermissions(['events.read', 'events.publish'], <Routes><Route path="/admin/workshop/:id" element={<EventDetailAdminPage />} /></Routes>), { route: '/admin/workshop/w1' });
  const toggle = await screen.findByRole('switch', { name: 'Pubblicato' });
  await userEvent.setup({ delay: null }).click(toggle);
  await waitFor(() => expect(api.to('/Workshop/Publication/w1', 'PUT')).toHaveLength(1));
  await waitFor(() => expect(toggle).toBeChecked());
  expect(api.to('/Workshop/Update/')).toHaveLength(0);
  expect(api.to('/Speaker/')).toHaveLength(0);
  expect(api.to('/Venue')).toHaveLength(0);
  expect(api.to('/Questionnaire')).toHaveLength(0);
});

test('access operators see inherited grants but cannot delegate permissions they do not possess or protected targets', async () => {
  mockApi({
    '/admin/access/permissions': { permissions: [{ id: 'events.read', delegable: true }, { id: 'events.delete', delegable: true }, { id: 'access.permissions.grant', delegable: false }] },
    '/admin/access/users?': { users: [{ issuer: 'issuer', subject: 'other', username: 'Utente protetto', enabled: true, protectedTarget: true }], hasMore: false },
    '/admin/access/users/other': { issuer: 'issuer', subject: 'other', directPermissions: [], inheritedPermissions: ['events.read'], effectivePermissions: ['events.read'], protectedTarget: true },
  });

  render(withPermissions(['access.users.read', 'access.permissions.grant', 'events.read'], <AccessPage />));
  const user = userEvent.setup({ delay: null });
  await user.click(await screen.findByRole('button', { name: 'Utente protetto · Protetto' }));
  await screen.findByText('Account proprio o protetto: le modifiche non sono consentite.');
  expect(screen.getByText(/Ereditato \(sola lettura\)/)).toBeInTheDocument();
  for (const checkbox of screen.getAllByRole('checkbox')) expect(checkbox).toBeDisabled();
  expect(vi.mocked(fetch).mock.calls.every(([, init]) => !init?.method || init.method === 'GET')).toBe(true);
});

test('access changes send optimistic concurrency and explicit confirmation, then verify direct grants', async () => {
  let direct: string[] = [];
  mockApi({
    '/admin/access/permissions': { permissions: [{ id: 'events.read', delegable: true }] },
    '/admin/access/users?': { users: [{ issuer: 'issuer', subject: 'other', username: 'Altro utente', enabled: true, protectedTarget: false }], hasMore: false },
    '/admin/access/users/other/permissions/events.read': (_url: string, init?: RequestInit) => {
      expect(init?.method).toBe('POST');
      expect(init?.headers).toEqual(expect.objectContaining({ 'X-Confirm-Access-Change': 'grant' }));
      expect(JSON.parse(String(init?.body))).toEqual({ expectedDirectPermissions: [] });
      direct = ['events.read'];
      return jsonResponse({ issuer: 'issuer', subject: 'other', directPermissions: direct, inheritedPermissions: [], effectivePermissions: direct, changed: true, correlationId: 'verified-change' });
    },
    '/admin/access/users/other': () => jsonResponse({ issuer: 'issuer', subject: 'other', directPermissions: direct, inheritedPermissions: [], effectivePermissions: direct, protectedTarget: false }),
  });
  render(withPermissions(['access.users.read', 'access.permissions.grant', 'events.read'], <AccessPage />));
  const user = userEvent.setup({ delay: null });
  await user.click(await screen.findByRole('button', { name: 'Altro utente' }));
  await user.click(await screen.findByRole('checkbox', { name: 'Permesso diretto events.read' }));
  expect(screen.getByRole('alertdialog')).toHaveTextContent('events.read');
  await user.click(screen.getByRole('button', { name: 'Conferma modifica' }));
  await screen.findByText(/Modifica verificata.*verified-change/);
  expect(screen.getByRole('checkbox', { name: 'Permesso diretto events.read' })).toBeChecked();
  expect(screen.getByRole('checkbox', { name: 'Permesso diretto events.read' })).toBeDisabled();
});

test('access directory defaults to board members, preserves the filter across search and paging, and can show everyone', async () => {
  mockApi({
    '/admin/access/permissions': { permissions: [] },
    '/admin/access/users?': (url: string) => {
      const query = new URL(url).searchParams;
      const first = Number(query.get('first'));
      const filter = query.get('search') ?? '';
      const label = query.get('boardOnly') === 'true' ? 'Board' : 'Utente';
      return jsonResponse({ users: [{ subject: `user-${first}`, username: filter || `${label} ${first}`, enabled: true }], hasMore: first === 0 });
    },
  });
  render(withPermissions(['access.users.read'], <AccessPage />));
  const user = userEvent.setup({ delay: null });
  await screen.findByRole('button', { name: 'Board 0' });
  expect(screen.getByRole('button', { name: 'Solo board' })).toHaveAttribute('aria-pressed', 'true');
  expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/admin/access/users?search=&first=0&max=25&boardOnly=true'), expect.anything());
  await user.click(screen.getByRole('button', { name: 'Successivi' }));
  await screen.findByRole('button', { name: 'Board 25' });
  expect(screen.getByRole('button', { name: 'Successivi' })).toBeDisabled();
  await user.type(screen.getByRole('textbox', { name: 'Cerca utenti' }), 'mario');
  await user.click(screen.getByRole('button', { name: 'Cerca' }));
  await screen.findByRole('button', { name: 'mario' });
  expect(fetch).toHaveBeenCalledWith(expect.stringContaining('search=mario&first=0&max=25&boardOnly=true'), expect.anything());
  await user.click(screen.getByRole('button', { name: 'Mostra tutti' }));
  await screen.findByRole('button', { name: 'Utente 0' });
  expect(screen.getByRole('textbox', { name: 'Cerca utenti' })).toHaveValue('');
  expect(screen.getByRole('button', { name: 'Solo board' })).toHaveAttribute('aria-pressed', 'false');
  expect(fetch).toHaveBeenCalledWith(expect.stringContaining('search=&first=0&max=25&boardOnly=false'), expect.anything());
  await user.click(screen.getByRole('button', { name: 'Successivi' }));
  await screen.findByRole('button', { name: 'Utente 25' });
  await user.click(screen.getByRole('button', { name: 'Solo board' }));
  await screen.findByRole('button', { name: 'Board 0' });
  expect(screen.getByText('Pagina 1')).toBeInTheDocument();
});

test.each([
  ['password only', { acr: 'pwd' }, /MFA non attiva per questo accesso \(livello: pwd\)/, false],
  ['expired MFA', { acr: 'mfa', auth_time: Math.floor(Date.now() / 1000) - 301 }, /MFA scaduta/, false],
  ['recent MFA', { acr: 'mfa', auth_time: Math.floor(Date.now() / 1000) - 60 }, /MFA attiva: verifica valida per altri [34]:\d\d minuti/, true],
] as const)('access page shows the MFA status first and gates changes (%s)', async (_name, payload, expected, enabled) => {
  mockSignIn(payload);
  mockApi({
    '/admin/access/permissions': { permissions: [{ id: 'events.read', delegable: true }] },
    '/admin/access/users?': { users: [{ subject: 'other', username: 'Altro utente', enabled: true }], hasMore: false },
    '/admin/access/users/other': { subject: 'other', directPermissions: [], inheritedPermissions: [], effectivePermissions: [], protectedTarget: false },
  });
  render(withPermissions(['access.users.read', 'access.permissions.grant', 'events.read'], <AccessPage />));
  await userEvent.setup({ delay: null }).click(await screen.findByRole('button', { name: 'Altro utente' }));
  expect(screen.getByRole('note')).toHaveTextContent(expected);
  const headings = screen.getAllByRole('heading', { level: 2 }).map(heading => heading.textContent);
  expect(headings).toEqual(['1. Verifica MFA', '2. Seleziona un utente', '3. Permessi di Altro utente']);
  expect(screen.getByRole('button', { name: 'Verifica MFA' })).toBeEnabled();
  expect(await screen.findByRole('checkbox', { name: 'Permesso diretto events.read' })).toHaveProperty('disabled', !enabled);
  expect(screen.queryByText(/esegui prima la verifica MFA/) !== null).toBe(!enabled);
  expect(screen.queryByRole('link', { name: 'Configura il secondo fattore nell’Area personale' })).not.toBeInTheDocument();
});

test.each([
  [{ acr: 'pwd' }, /MFA non attiva/],
  [{ acr: 'mfa', auth_time: Math.floor(Date.now() / 1000) - 301 }, /MFA scaduta/],
  [{ acr: 'mfa', auth_time: Math.floor(Date.now() / 1000) - 60 }, /MFA attiva: verifica valida/],
])('backup page starts with the shared MFA status (%j)', async (payload, expected) => {
  mockSignIn(payload);
  mockApi({ '/Backup/snapshots': [] });
  render(withPermissions(['backups.read', 'backups.restore'], <BackupPage />));
  await screen.findByRole('heading', { name: 'Nessun backup sul server' });
  expect(screen.getByRole('note')).toHaveTextContent(expected);
  expect(screen.getAllByRole('heading', { level: 2 })[0]).toHaveTextContent('Verifica MFA');
  expect(screen.getByRole('button', { name: 'Verifica MFA' })).toBeEnabled();
  expect(screen.queryByRole('link', { name: /Configura il secondo fattore/ })).not.toBeInTheDocument();
});

test('audit history shows who made each change and the changed user without exposing only identifiers', async () => {
  mockApi({ '/admin/access/audit?': { entries: [
    { at: '2025-01-02T10:00:00Z', action: 'grant', permission: 'events.read', actorSubject: 'actor-id', actorUsername: 'operatore',
      targetSubject: 'target-id', targetUsername: 'editor', outcome: 'verified', correlationId: 'ref-1' },
    { at: '2025-01-02T10:05:00Z', action: 'revoke', permission: 'events.read', actorSubject: 'actor-id', actorUsername: 'operatore',
      targetSubject: 'gone-id', targetUsername: null, outcome: 'intent', correlationId: 'ref-2' },
  ] } });
  render(withPermissions(['access.audit.read'], <AccessPage />));
  const table = await screen.findByRole('table', { name: 'Cronologia modifiche ai permessi' });
  expect(screen.getByRole('columnheader', { name: 'Eseguita da' })).toBeInTheDocument();
  expect(screen.getByRole('columnheader', { name: 'Utente modificato' })).toBeInTheDocument();
  const rows = table.querySelectorAll('tbody tr');
  expect(rows[0]).toHaveTextContent(/operatore.*actor-id.*editor.*target-id.*Concessione.*events\.read.*Verificata.*ref-1/);
  expect(rows[1]).toHaveTextContent(/operatore.*Account non più disponibile.*gone-id.*Revoca.*Richiesta.*ref-2/);
});

test('permission checkboxes cancel without writing and confirm revocation without hiding inherited access', async () => {
  let direct = ['events.read'];
  mockApi({
    '/admin/access/permissions': { permissions: [{ id: 'events.read', delegable: true }, { id: 'events.delete', delegable: true }] },
    '/admin/access/users?': { users: [{ subject: 'other', username: 'Altro utente', enabled: true }], hasMore: false },
    '/admin/access/users/other/permissions/events.read': (_url: string, init?: RequestInit) => {
      expect(init?.method).toBe('DELETE');
      expect(init?.headers).toEqual(expect.objectContaining({ 'X-Confirm-Access-Change': 'revoke' }));
      expect(JSON.parse(String(init?.body))).toEqual({ expectedDirectPermissions: ['events.read'] });
      direct = [];
      return jsonResponse({ changed: true, correlationId: 'revoked' });
    },
    '/admin/access/users/other': () => jsonResponse({ subject: 'other', directPermissions: direct, inheritedPermissions: ['events.read'], effectivePermissions: ['events.read'], protectedTarget: false }),
  });
  render(withPermissions(['access.users.read', 'access.permissions.revoke', 'events.read'], <AccessPage />));
  const user = userEvent.setup({ delay: null });
  await user.click(await screen.findByRole('button', { name: 'Altro utente' }));
  const checkbox = await screen.findByRole('checkbox', { name: 'Permesso diretto events.read' });
  expect(checkbox).toBeChecked();
  expect(screen.getByRole('checkbox', { name: 'Permesso diretto events.delete' })).toBeDisabled();
  await user.click(checkbox);
  await user.click(screen.getByRole('button', { name: 'Annulla' }));
  expect(checkbox).toBeChecked();
  expect(vi.mocked(fetch).mock.calls.every(([, init]) => !init?.method || init.method === 'GET')).toBe(true);
  await user.click(checkbox);
  await user.click(screen.getByRole('button', { name: 'Conferma modifica' }));
  await screen.findByText(/Modifica verificata.*revoked/);
  expect(checkbox).not.toBeChecked();
  expect(screen.getByText('Ereditato (sola lettura)')).toBeInTheDocument();
  expect(screen.getByRole('table')).toHaveTextContent('Sì');
  expect(screen.getByRole('columnheader', { name: 'Effettivo' })).toBeInTheDocument();
  expect(screen.queryByText('Permessi effettivi')).not.toBeInTheDocument();
});

test('audit-only view explains and reloads permission change history without requesting users', async () => {
  mockApi({ '/admin/access/audit?': { entries: [] } });
  render(withPermissions(['access.audit.read'], <AccessPage />));
  await screen.findByText('Nessuna modifica registrata.');
  expect(screen.getByText(/non include le modifiche effettuate direttamente/)).toBeInTheDocument();
  await userEvent.setup({ delay: null }).click(screen.getByRole('button', { name: 'Ricarica cronologia modifiche' }));
  await waitFor(() => expect(vi.mocked(fetch).mock.calls).toHaveLength(2));
  expect(vi.mocked(fetch).mock.calls.every(([url]) => String(url).includes('/admin/access/audit?'))).toBe(true);
});

test.each([
  [403, 'recent_mfa_required', /verifica MFA effettuata negli ultimi 5 minuti/],
  [409, 'access_assignment_changed', /modificati da un altro operatore/],
  [503, 'permission_directory_unavailable', /Identity Provider non è disponibile/],
  [503, 'access_audit_unavailable', /bloccata prima dell’invio/],
  [403, 'protected_access_target', /Questo account è protetto/],
] as const)('failed access change (%s %s) preserves selection and table until a successful reload', async (status, code, explanation) => {
  let failReload = false;
  const invalidated = vi.fn();
  window.addEventListener('admin-permissions-denied', invalidated);
  mockApi({
    '/admin/access/permissions': { permissions: [{ id: 'events.read', delegable: true }] },
    '/admin/access/users?': { users: [{ subject: 'other', username: 'Altro utente', enabled: true }], hasMore: false },
    '/admin/access/users/other/permissions/events.read': () => jsonResponse({ code }, status),
    '/admin/access/users/other': () => failReload
      ? jsonResponse({ code: 'permission_directory_unavailable' }, 503)
      : jsonResponse({ subject: 'other', directPermissions: [], inheritedPermissions: [], effectivePermissions: [], protectedTarget: false }),
  });
  try {
    render(withPermissions(['access.users.read', 'access.permissions.grant', 'events.read'], <AccessPage />));
    const user = userEvent.setup({ delay: null });
    await user.click(await screen.findByRole('button', { name: 'Altro utente' }));
    const checkbox = await screen.findByRole('checkbox', { name: 'Permesso diretto events.read' });
    await waitFor(() => expect(checkbox).toBeEnabled());
    await user.click(checkbox);
    await user.click(screen.getByRole('button', { name: 'Conferma modifica' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(explanation);
    expect(screen.getByRole('alert').parentElement).toHaveAttribute('tabindex', '-1');
    expect(screen.getByRole('alert').parentElement).toHaveClass('sticky');
    expect(screen.getByRole('alert')).toHaveTextContent(code);
    expect(screen.getByRole('button', { name: 'Altro utente' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(checkbox).not.toBeChecked();
    expect(checkbox).toBeDisabled();
    expect(invalidated).not.toHaveBeenCalled();
    failReload = true;
    await user.click(screen.getByRole('button', { name: 'Ricarica accessi selezionati' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('permission_directory_unavailable'));
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(checkbox).toBeDisabled();
    failReload = false;
    await user.click(screen.getByRole('button', { name: 'Ricarica accessi selezionati' }));
    await waitFor(() => expect(checkbox).toBeEnabled());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(vi.mocked(fetch).mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1);
  } finally {
    window.removeEventListener('admin-permissions-denied', invalidated);
  }
});

test('failed post-write verification keeps the table without claiming success or retrying the mutation', async () => {
  let written = false;
  let verificationFails = true;
  mockApi({
    '/admin/access/permissions': { permissions: [{ id: 'events.read', delegable: true }] },
    '/admin/access/users?': { users: [{ subject: 'other', username: 'Altro utente', enabled: true }], hasMore: false },
    '/admin/access/users/other/permissions/events.read': () => {
      written = true;
      return jsonResponse({ changed: true, correlationId: 'uncertain' });
    },
    '/admin/access/users/other': () => written && verificationFails
      ? jsonResponse({ code: 'permission_directory_unavailable' }, 503)
      : jsonResponse({ subject: 'other', directPermissions: written ? ['events.read'] : [], inheritedPermissions: [], effectivePermissions: written ? ['events.read'] : [], protectedTarget: false }),
  });
  render(withPermissions(['access.users.read', 'access.permissions.grant', 'events.read'], <AccessPage />));
  const user = userEvent.setup({ delay: null });
  await user.click(await screen.findByRole('button', { name: 'Altro utente' }));
  const checkbox = await screen.findByRole('checkbox', { name: 'Permesso diretto events.read' });
  await waitFor(() => expect(checkbox).toBeEnabled());
  await user.click(checkbox);
  await user.click(screen.getByRole('button', { name: 'Conferma modifica' }));
  await screen.findByRole('alert');
  expect(screen.queryByText(/Modifica verificata/)).not.toBeInTheDocument();
  expect(checkbox).not.toBeChecked();
  expect(checkbox).toBeDisabled();
  verificationFails = false;
  await user.click(screen.getByRole('button', { name: 'Ricarica accessi selezionati' }));
  await waitFor(() => expect(checkbox).toBeChecked());
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(vi.mocked(fetch).mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1);
});

test('permission confirmation visibly reports progress while the server is responding', async () => {
  let finish: ((response: Response) => void) | undefined;
  const response = new Promise<Response>(resolve => { finish = resolve; });
  mockApi({
    '/admin/access/permissions': { permissions: [{ id: 'events.read', delegable: true }] },
    '/admin/access/users?': { users: [{ subject: 'other', username: 'Altro utente', enabled: true }], hasMore: false },
    '/admin/access/users/other/permissions/events.read': () => response,
    '/admin/access/users/other': { subject: 'other', directPermissions: [], inheritedPermissions: [], effectivePermissions: [], protectedTarget: false },
  });
  render(withPermissions(['access.users.read', 'access.permissions.grant', 'events.read'], <AccessPage />));
  const user = userEvent.setup({ delay: null });
  await user.click(await screen.findByRole('button', { name: 'Altro utente' }));
  const checkbox = await screen.findByRole('checkbox', { name: 'Permesso diretto events.read' });
  await waitFor(() => expect(checkbox).toBeEnabled());
  await user.click(checkbox);
  await user.click(screen.getByRole('button', { name: 'Conferma modifica' }));
  expect(screen.getByRole('alertdialog')).toHaveTextContent('Modifica in corso');
  expect(screen.getByRole('button', { name: 'Verifica in corso…' })).toBeDisabled();
  finish?.(jsonResponse({ code: 'recent_mfa_required' }, 403));
  expect(await screen.findByRole('alert')).toHaveTextContent('recent_mfa_required');
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  expect(screen.getByRole('table')).toBeInTheDocument();
});

test('ticketing operators save local sales times independently of event content editing', async () => {
  const workshop = eventFixture({ published: false });
  const api = serveEvent(workshop, {
    '/Eventbrite/Configuration/w1': (_url: string, init?: RequestInit) => {
      expect(init?.method).toBe('PUT');
      const body = JSON.parse(String(init?.body)) as { salesStart: string | null; salesEnd: string | null; ticketCapacity?: number };
      expect(body).toEqual({ salesStart: '2026-11-01T09:00', salesEnd: '2026-11-02T18:00', ticketCapacity: 42 });
      workshop.eventbriteSalesStart = body.salesStart;
      workshop.eventbriteSalesEnd = body.salesEnd;
      return new Response(null, { status: 204 });
    },
  });
  render(withPermissions(['events.read', 'eventbrite.read', 'eventbrite.manage'], <Routes><Route path="/admin/workshop/:id" element={<EventDetailAdminPage />} /></Routes>), { route: '/admin/workshop/w1#iscrizione' });
  await screen.findByRole('heading', { name: 'Iscrizione e dettagli dei partecipanti' });
  fireEvent.change(screen.getByLabelText('Inizio vendita biglietti Eventbrite'), { target: { value: '2026-11-01T09:00' } });
  fireEvent.change(screen.getByLabelText('Fine vendita biglietti Eventbrite'), { target: { value: '2026-11-02T18:00' } });
  fireEvent.change(screen.getByLabelText('Biglietti gratuiti Eventbrite disponibili'), { target: { value: '42' } });
  expect(screen.getByRole('button', { name: 'Salva iscrizione e agenda' })).toBeDisabled();
  await userEvent.setup({ delay: null }).click(screen.getByRole('button', { name: 'Salva periodo vendite e quantità iniziale Eventbrite' }));
  await waitFor(() => expect(api.to('/Eventbrite/Configuration/w1', 'PUT')).toHaveLength(1));
  await waitFor(() => expect(api.to('/Workshop/Get/w1')).toHaveLength(2));
  expect(api.to('/Workshop/Update/')).toHaveLength(0);
});

test('existing ticket classes omit capacity from configuration and retain the live-verification action', async () => {
  const api = serveEvent(eventFixture({
    published: false, eventbriteEventId: 'provider-event', eventbriteTicketClassId: 'provider-ticket',
    eventbriteTicketCapacity: 20, eventbriteSyncedTicketCapacity: 20,
  }), {
    '/Eventbrite/Configuration/w1': (_url: string, init?: RequestInit) => {
      expect(JSON.parse(String(init?.body))).toEqual({ salesStart: null, salesEnd: null });
      return new Response(null, { status: 204 });
    },
  });
  render(withPermissions(['events.read', 'eventbrite.read', 'eventbrite.manage'], <Routes><Route path="/admin/workshop/:id" element={<EventDetailAdminPage />} /></Routes>), { route: '/admin/workshop/w1#iscrizione' });
  await screen.findByRole('heading', { name: 'Iscrizione e dettagli dei partecipanti' });
  fireEvent.change(screen.getByLabelText('Biglietti gratuiti Eventbrite disponibili'), { target: { value: '42' } });
  expect(screen.getByRole('button', { name: 'Salva capienza biglietti' })).toBeEnabled();
  await userEvent.setup({ delay: null }).click(screen.getByRole('button', { name: 'Salva periodo vendite Eventbrite' }));
  await waitFor(() => expect(api.to('/Eventbrite/Configuration/w1', 'PUT')).toHaveLength(1));
  expect(api.to('/Eventbrite/SetTicketCapacity')).toHaveLength(0);
});

import React from 'react';
import { Route, Routes } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
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

test('access directory lists users immediately, pages without a filter and can clear a search', async () => {
  mockApi({
    '/admin/access/permissions': { permissions: [] },
    '/admin/access/users?': (url: string) => {
      const query = new URL(url).searchParams;
      const first = Number(query.get('first'));
      const filter = query.get('search') ?? '';
      return jsonResponse({ users: [{ subject: `user-${first}`, username: filter || `Utente ${first}`, enabled: true }], hasMore: first === 0 });
    },
  });
  render(withPermissions(['access.users.read'], <AccessPage />));
  const user = userEvent.setup({ delay: null });
  await screen.findByRole('button', { name: 'Utente 0' });
  expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/admin/access/users?search=&first=0&max=25'), expect.anything());
  await user.click(screen.getByRole('button', { name: 'Successivi' }));
  await screen.findByRole('button', { name: 'Utente 25' });
  expect(screen.getByRole('button', { name: 'Successivi' })).toBeDisabled();
  await user.type(screen.getByRole('textbox', { name: 'Cerca utenti' }), 'mario');
  await user.click(screen.getByRole('button', { name: 'Cerca' }));
  await screen.findByRole('button', { name: 'mario' });
  expect(fetch).toHaveBeenCalledWith(expect.stringContaining('search=mario&first=0&max=25'), expect.anything());
  await user.click(screen.getByRole('button', { name: 'Mostra tutti' }));
  await screen.findByRole('button', { name: 'Utente 0' });
  expect(screen.getByRole('textbox', { name: 'Cerca utenti' })).toHaveValue('');
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

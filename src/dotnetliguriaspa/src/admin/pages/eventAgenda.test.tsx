import React from 'react';
import { Route, Routes } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { fireEvent, jsonResponse, render, screen, waitFor, within } from '../../test-utils';
import { AdminToastRegion, adminToasts } from '../toasts';
import EventDetailAdminPage from './EventDetailAdminPage';
import { eventFixture, serveEvent } from './eventFixtures';

// Steps 5-8 of the wizard: the previous AdminWorkshopAgenda tests, with the same payload and call-order
// assertions, the module's lifecycle (re-init on record change, inputs kept across its pages) and the tracks step.

const renderAt = (hash: string) => render(
  <>
    <Routes><Route path="/admin/workshop/:id" element={<EventDetailAdminPage />} /></Routes>
    <AdminToastRegion />
  </>,
  { route: `/admin/workshop/w1${hash}` },
);
const loaded = () => screen.findByRole('heading', { level: 1, name: 'Test Workshop' });
const registration = () => screen.getByRole('region', { name: 'Iscrizione e dettagli dei partecipanti' });
const schedule = () => screen.getByRole('region', { name: 'Orari della track' });
const createForm = () => screen.getByRole('group', { name: 'Crea un talk' });
const poolList = () => screen.getByRole('list', { name: 'Talk nel pool' });
const rowOf = (title: string) => screen.getByRole('heading', { level: 5, name: title }).closest('li') as HTMLElement;
const valuesOf = (inputs: HTMLElement[]) => inputs.map(input => (input as HTMLInputElement).value);
const starts = () => valuesOf(within(schedule()).getAllByLabelText('Ora di inizio'));
const ends = () => valuesOf(within(schedule()).getAllByLabelText('Ora di fine'));
const setTrackCount = (count: number | '') => fireEvent.change(screen.getByRole('spinbutton', { name: 'Numero di track' }), { target: { value: String(count) } });
const twoTalks = () => eventFixture({
  agendaTracks: [{ workshopAgendaTrackId: 'track-1', name: 'Main stage', order: 0 }],
  talks: [
    { workshopTalkId: 'talk-1', title: 'First talk', sessionType: 'talk', speakers: [{ workshopSpeakerId: 'speaker-1', name: 'Ada Lovelace' }] },
    { workshopTalkId: 'talk-2', title: 'Second talk', sessionType: 'talk', speakers: [] },
  ],
});
const ready = () => eventFixture({
  eventbriteTicketCapacity: 25,
  agendaTracks: [{ workshopAgendaTrackId: 'track-1', name: 'Main', order: 0 }],
  agendaItems: [{ workshopAgendaItemId: 'item-1', itemType: 'service', trackId: 'track-1', startTime: '2024-03-15T09:00:00Z', endTime: '2024-03-15T10:00:00Z' }],
});

beforeEach(() => adminToasts.clear());

describe('talk pool, schedule and registration pages', () => {
  test('keeps the talk pool, schedule and registration pages separate, with the previous defaults', async () => {
    serveEvent(eventFixture());
    const { unmount } = renderAt('#talk-pool');
    await loaded();
    expect(createForm()).toBeVisible();
    expect(screen.queryByRole('textbox', { name: 'URL di prenotazione e cancellazione del posto' })).not.toBeInTheDocument();
    unmount();

    serveEvent(eventFixture());
    const second = renderAt('#agenda');
    await loaded();
    expect(screen.getByLabelText('Ora di inizio della track')).toHaveValue('09:00');
    expect(screen.getByRole('spinbutton', { name: 'Durata talk (minuti)' })).toHaveValue(60);
    expect(screen.getByRole('spinbutton', { name: 'Durata pausa (minuti)' })).toHaveValue(5);
    expect(screen.queryByRole('group', { name: 'Crea un talk' })).not.toBeInTheDocument();
    second.unmount();

    serveEvent(eventFixture());
    renderAt('#iscrizione');
    await loaded();
    expect(screen.getByRole('textbox', { name: 'URL di prenotazione e cancellazione del posto' })).toBeVisible();
  });

  test('saves an initial Eventbrite ticket quantity separately from venue spaces', async () => {
    const user = userEvent.setup();
    const api = serveEvent(eventFixture({ location: { name: 'Community Hall', coordinates: '', address: '1 Main Street', maximumSpaces: 120 } }));
    renderAt('#iscrizione');
    await loaded();
    const capacity = screen.getByRole('spinbutton', { name: 'Biglietti gratuiti Eventbrite disponibili' });
    await user.clear(capacity);
    await user.type(capacity, '35');
    fireEvent.change(screen.getByLabelText('Inizio vendita biglietti Eventbrite'), { target: { value: '2024-03-01T09:00' } });
    fireEvent.change(screen.getByLabelText('Fine vendita biglietti Eventbrite'), { target: { value: '2024-03-14T18:00' } });
    await user.click(screen.getByRole('button', { name: 'Salva iscrizione e agenda' }));

    await waitFor(() => expect(api.to('/Workshop/Update/w1', 'PUT')).toHaveLength(1));
    const body = api.lastUpdate()!;
    expect(body.eventbriteTicketCapacity).toBe(35);
    expect(body.eventbriteSalesStart).toBe('2024-03-01T09:00');
    expect(body.eventbriteSalesEnd).toBe('2024-03-14T18:00');
    expect(body.location!.maximumSpaces).toBe(120);
    expect(await screen.findByText("Dettagli dell'evento e agenda salvati.")).toBeInTheDocument();
  });

  test('saves the booking link with the legacy registration pair and the attendee notes', async () => {
    const user = userEvent.setup();
    const api = serveEvent(eventFixture({ externalRegistration: true, externalRegistrationLink: 'https://old.example.test/signup' }));
    renderAt('#iscrizione');
    await loaded();
    const link = screen.getByRole('textbox', { name: 'URL di prenotazione e cancellazione del posto' });
    expect(link).toHaveValue('https://old.example.test/signup');
    await user.clear(link);
    await user.type(link, 'https://booking.example.test/event/1');
    await user.type(screen.getByRole('textbox', { name: 'Note per i partecipanti' }), 'Bring your laptop');
    await user.click(screen.getByRole('button', { name: 'Salva iscrizione e agenda' }));
    await waitFor(() => expect(api.lastUpdate()).toMatchObject({ bookingServiceUrl: 'https://booking.example.test/event/1', externalRegistration: true, externalRegistrationLink: 'https://booking.example.test/event/1', attendeeNotes: 'Bring your laptop' }));
  });

  test('refreshes Eventbrite inventory, displays aggregate counts only and raises the capacity floor to sold plus pending', async () => {
    const user = userEvent.setup();
    const api = serveEvent(eventFixture({ eventbriteEventId: 'event-1', eventbriteEventUrl: 'https://www.eventbrite.it/e/1', eventbriteTicketCapacity: 10, eventbriteSyncedTicketCapacity: 10, eventbriteSyncStatus: 'synced', agendaTracks: [{ workshopAgendaTrackId: 'track-1', name: 'Main', order: 0 }], agendaItems: [{ workshopAgendaItemId: 'item-1', itemType: 'service', trackId: 'track-1', startTime: '2024-03-15T09:00:00Z', endTime: '2024-03-15T10:00:00Z' }] }), {
      '/Eventbrite/TicketSales/': { totalCapacity: 40, sold: 12, pending: 2, remaining: 26, refreshedAt: '2026-10-11T10:00:00Z' },
    });
    renderAt('#iscrizione');
    await loaded();
    expect(registration()).toHaveTextContent('Stato Eventbrite: synced');
    expect(screen.getByRole('link', { name: /Apri l'evento Eventbrite/ })).toHaveAttribute('href', 'https://www.eventbrite.it/e/1');
    expect(screen.queryByRole('button', { name: 'Salva capienza biglietti' })).not.toBeInTheDocument();
    const capacity = screen.getByRole('spinbutton', { name: 'Biglietti gratuiti Eventbrite disponibili' });
    expect(capacity).toHaveAttribute('min', '10');
    await user.click(screen.getByRole('button', { name: 'Aggiorna le vendite dei biglietti' }));
    expect(await screen.findByText(/venduti: 12, in sospeso: 2, capienza totale: 40, rimanenti: 26\./)).toBeInTheDocument();
    expect(await screen.findByText('Vendite live dei biglietti Eventbrite aggiornate.')).toBeInTheDocument();
    expect(api.to('/Eventbrite/TicketSales/w1', 'GET')).toHaveLength(1);
    expect(capacity).toHaveAttribute('min', '14');
  });

  test('shows the stored sync status as it is, with the last error, even before an event id exists', async () => {
    serveEvent(eventFixture({ eventbriteSyncStatus: 'reconciliation-required', eventbriteLastError: 'Eventbrite did not answer' }));
    renderAt('#iscrizione');
    await loaded();
    expect(registration()).toHaveTextContent('Stato Eventbrite: reconciliation-required');
    expect(screen.getByText('Eventbrite did not answer')).toBeInTheDocument();
  });

  test('marks an Eventbrite event as update-pending and clears its last error after every local save, as before', async () => {
    const user = userEvent.setup();
    const api = serveEvent({ ...ready(), eventbriteEventId: 'event-1', eventbriteSyncStatus: 'synced', eventbriteLastError: 'old failure' });
    renderAt('#iscrizione');
    await loaded();
    expect(registration()).toHaveTextContent('Stato Eventbrite: synced');
    expect(screen.getByText('old failure')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Salva iscrizione e agenda' }));
    await waitFor(() => expect(api.to('/Workshop/Update/w1', 'PUT')).toHaveLength(1));
    expect(api.lastUpdate()!.eventbriteSyncStatus).toBe('synced');
    await waitFor(() => expect(registration()).toHaveTextContent('Stato Eventbrite: update-pending'));
    expect(screen.queryByText('old failure')).not.toBeInTheDocument();
    // The next whole-record save carries the pending status, as the previous admin did.
    await user.click(screen.getByRole('button', { name: 'Salva iscrizione e agenda' }));
    await waitFor(() => expect(api.to('/Workshop/Update/w1', 'PUT')).toHaveLength(2));
    expect(api.lastUpdate()!.eventbriteSyncStatus).toBe('update-pending');
  });

  test('starts again from the record whenever it changes, dropping unsaved inputs, as before', async () => {
    const user = userEvent.setup();
    const api = serveEvent(eventFixture());
    renderAt('#iscrizione');
    await loaded();
    await user.type(screen.getByRole('textbox', { name: 'Note per i partecipanti' }), 'Laptop');
    await user.click(screen.getByRole('link', { name: '5. Tracks, raggiunto' }));
    await user.click(screen.getByRole('button', { name: 'Aggiungi' }));
    const dialog = await screen.findByRole('dialog', { name: 'Aggiungi nuova track' });
    await user.type(within(dialog).getByRole('textbox', { name: 'Titolo' }), 'Chiusura');
    fireEvent.change(within(dialog).getByLabelText('Ora di inizio *'), { target: { value: '2024-03-15T11:00' } });
    fireEvent.change(within(dialog).getByLabelText('Ora di fine *'), { target: { value: '2024-03-15T11:30' } });
    await user.click(within(dialog).getByRole('button', { name: 'Salva track' }));
    await waitFor(() => expect(api.to('/Workshop/Update/w1', 'PUT')).toHaveLength(1));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await user.click(screen.getByRole('link', { name: '8. Dettagli di iscrizione, raggiunto' }));
    expect(screen.getByRole('textbox', { name: 'Note per i partecipanti' })).toHaveValue('');
  });

  test('keeps the module inputs while moving between its three pages', async () => {
    const user = userEvent.setup();
    serveEvent(eventFixture());
    renderAt('#iscrizione');
    await loaded();
    await user.type(screen.getByRole('textbox', { name: 'Note per i partecipanti' }), 'Laptop');
    await user.click(screen.getByRole('link', { name: '6. Talk pool, raggiunto' }));
    await user.type(within(createForm()).getByRole('textbox', { name: 'Titolo del talk' }), 'Bozza di talk');
    await user.click(screen.getByRole('button', { name: "Avanti: Track e orari dell'agenda" }));
    await user.click(screen.getByRole('button', { name: 'Avanti: Dettagli di iscrizione' }));
    expect(screen.getByRole('textbox', { name: 'Note per i partecipanti' })).toHaveValue('Laptop');
    await user.click(screen.getByRole('link', { name: '6. Talk pool, raggiunto' }));
    expect(within(createForm()).getByRole('textbox', { name: 'Titolo del talk' })).toHaveValue('Bozza di talk');
  });

  test('runs one whole-record PUT at a time and builds the next one from the latest record', async () => {
    const user = userEvent.setup();
    let release: (() => void) | null = null;
    const pending = new Promise<Response>(resolve => { release = () => resolve(new Response(null, { status: 204 })); });
    let puts = 0;
    const api = serveEvent(eventFixture(), { '/Workshop/Update/': (_url: string, init?: RequestInit) => { if (++puts === 1) return pending; api.store.record = JSON.parse(String(init?.body)); return new Response(null, { status: 204 }); } });
    renderAt('#iscrizione');
    await loaded();
    await user.type(screen.getByRole('textbox', { name: 'Note per i partecipanti' }), 'Laptop');
    await user.click(screen.getByRole('link', { name: "3. Informazioni sull'evento, raggiunto" }));
    await user.type(screen.getByRole('textbox', { name: 'Titolo' }), ' bis');
    await user.click(screen.getByRole('link', { name: '8. Dettagli di iscrizione, raggiunto' }));

    await user.click(screen.getByRole('button', { name: 'Salva iscrizione e agenda' }));
    await waitFor(() => expect(api.to('/Workshop/Update/w1', 'PUT')).toHaveLength(1));
    expect(screen.getByRole('button', { name: 'Salva iscrizione e agenda' })).toBeDisabled();
    release!();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Salva iscrizione e agenda' })).toBeEnabled());
    expect(api.to('/Workshop/Update/w1', 'PUT')).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'Avanti: Materiali' }));
    await user.click(screen.getByRole('button', { name: 'Avanti: Foto' }));
    await user.click(screen.getByRole('button', { name: 'Salva modifiche' }));
    await waitFor(() => expect(api.to('/Workshop/Update/w1', 'PUT')).toHaveLength(2));
    expect(api.lastUpdate()).toMatchObject({ title: 'Test Workshop bis', attendeeNotes: 'Laptop' });
  });

  test('saves local agenda before explicitly syncing Eventbrite', async () => {
    const user = userEvent.setup();
    const record = ready();
    const api = serveEvent(record, { '/Eventbrite/Sync/': () => jsonResponse({ ...record, eventbriteEventId: 'event-1', eventbriteSyncStatus: 'synced' }) });
    renderAt('#iscrizione');
    await loaded();
    expect(screen.queryByText(/Richiesto prima che Eventbrite/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Crea bozza Eventbrite' }));

    await waitFor(() => expect(api.to('/Eventbrite/Sync/w1', 'POST')).toHaveLength(1));
    const saveCall = api.calls.find(call => call.url.includes('/Workshop/Update/'));
    const syncCall = api.calls.find(call => call.url.includes('/Eventbrite/Sync/'));
    expect(saveCall).toBeDefined();
    expect(syncCall).toBeDefined();
    expect(api.calls.indexOf(saveCall!)).toBeLessThan(api.calls.indexOf(syncCall!));
    expect(saveCall!.method).toBe('PUT');
    expect(await screen.findByText('Evento Eventbrite sincronizzato.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sincronizza/Aggiorna Eventbrite' })).toBeInTheDocument();
  });

  test('does not call Eventbrite when the local save is refused, and keeps the sync button off while inputs are missing', async () => {
    const user = userEvent.setup();
    const api = serveEvent(ready());
    renderAt('#iscrizione');
    await loaded();
    fireEvent.change(screen.getByLabelText('Inizio vendita biglietti Eventbrite'), { target: { value: '2024-03-14T18:00' } });
    fireEvent.change(screen.getByLabelText('Fine vendita biglietti Eventbrite'), { target: { value: '2024-03-01T09:00' } });
    expect(screen.getByRole('button', { name: 'Crea bozza Eventbrite' })).toBeDisabled();
    expect(screen.getByText('Richiesto prima che Eventbrite possa essere sincronizzato')).toBeInTheDocument();
    expect(screen.getByText("Fine vendite successiva all'inizio vendite")).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Salva iscrizione e agenda' }));
    expect(await screen.findByText("La vendita dei biglietti Eventbrite deve finire dopo l'inizio.")).toBeInTheDocument();
    expect(api.to('/Workshop/Update/')).toHaveLength(0);
    expect(api.to('/Eventbrite/Sync/')).toHaveLength(0);
  });

  test('saves a higher ticket capacity locally through the dedicated endpoint and publishes after confirmation', async () => {
    const user = userEvent.setup();
    const record = { ...ready(), eventbriteEventId: 'event-1', eventbriteTicketCapacity: 50, eventbriteSyncedTicketCapacity: 40, eventbriteSyncStatus: 'synced' };
    const api = serveEvent(record, {
      '/Eventbrite/SetTicketCapacity/': () => jsonResponse({ ...record, eventbriteSyncStatus: 'update-pending' }),
      '/Eventbrite/Publish/': () => { api.store.record = { ...record, eventbritePublished: true }; return new Response(null, { status: 204 }); },
    });
    renderAt('#iscrizione');
    await loaded();
    await user.click(screen.getByRole('button', { name: 'Salva capienza biglietti' }));
    await waitFor(() => expect(api.to('/Eventbrite/SetTicketCapacity/w1', 'PUT')).toHaveLength(1));
    expect(api.to('/Eventbrite/SetTicketCapacity/w1')[0].body).toEqual({ capacity: 50 });
    expect(await screen.findByText('Capienza biglietti salvata in locale. Usa Sincronizza/Aggiorna Eventbrite per applicarla.')).toBeInTheDocument();
    expect(registration()).toHaveTextContent('Stato Eventbrite: update-pending');

    await user.click(within(registration()).getByRole('button', { name: 'Pubblica su Eventbrite' }));
    expect(api.to('/Eventbrite/Publish/')).toHaveLength(0);
    expect(within(registration()).getByRole('alert')).toHaveTextContent("Pubblicare questo evento su Eventbrite? È separato dalla pubblicazione dell'evento su questo sito.");
    await user.click(within(registration()).getByRole('button', { name: 'OK' }));
    await waitFor(() => expect(api.to('/Eventbrite/Publish/w1', 'POST')).toHaveLength(1));
    expect(await screen.findByText('Evento pubblicato su Eventbrite.')).toBeInTheDocument();
    expect(await within(registration()).findByText('Pubblicato su Eventbrite')).toBeInTheDocument();
    await waitFor(() => expect(within(registration()).queryByRole('button', { name: /Pubblica su Eventbrite/ })).not.toBeInTheDocument());
  });

  test('shows the server detail when an Eventbrite action fails', async () => {
    const user = userEvent.setup();
    serveEvent(ready(), { '/Eventbrite/Sync/': () => jsonResponse({ title: 'Eventbrite synchronization failed', detail: 'Eventbrite rejected the venue' }, 502) });
    renderAt('#iscrizione');
    await loaded();
    await user.click(screen.getByRole('button', { name: 'Crea bozza Eventbrite' }));
    expect(await screen.findByText('Eventbrite rejected the venue')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Crea bozza Eventbrite' })).toBeEnabled();
  });

  test('auto-fills every single-track talk with time-only editable slots and technical gaps', async () => {
    const user = userEvent.setup();
    const api = serveEvent(twoTalks());
    renderAt('#agenda');
    expect(await screen.findByText('First talk')).toBeVisible();
    expect(screen.getByText('Second talk')).toBeVisible();
    expect(screen.getByDisplayValue('Technical gap')).toBeVisible();
    expect(starts()).toEqual(['09:00', '10:00', '10:05']);
    expect(ends()).toEqual(['10:00', '10:05', '11:05']);
    expect(screen.queryByLabelText(/^data/i)).not.toBeInTheDocument();
    expect(await screen.findByText(/Orari delle track riempiti/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Salva agenda' }));
    await waitFor(() => expect(api.to('/Workshop/Update/w1', 'PUT')).toHaveLength(1));
    const body = api.lastUpdate()!;
    expect(body.agendaItems).toHaveLength(3);
    expect(body.agendaItems!.every(item => item.trackId === 'track-1')).toBe(true);
    expect(body.agendaItems![0].startTime).toMatch(/^2024-03-15T09:00:00/);
    expect(body.talks![0].trackId).toBe('track-1');
    expect(await screen.findByText("Dettagli dell'evento e agenda salvati.")).toBeInTheDocument();
  });

  test('fills the schedule only when the schedule page is shown, never from the talk pool', async () => {
    const user = userEvent.setup();
    const api = serveEvent(twoTalks());
    renderAt('#talk-pool');
    await loaded();
    await user.click(screen.getByRole('button', { name: 'Salva talk pool' }));
    await waitFor(() => expect(api.to('/Workshop/Update/w1', 'PUT')).toHaveLength(1));
    expect(api.lastUpdate()!.agendaItems).toEqual([]);
    expect(api.lastUpdate()!.talks!.map(talk => talk.trackId)).toEqual(['track-1', 'track-1']);
    expect(await screen.findByText("Dettagli dell'evento e agenda salvati.")).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: "Avanti: Track e orari dell'agenda" }));
    expect(await screen.findByDisplayValue('Technical gap')).toBeVisible();
    expect(starts()).toEqual(['09:00', '10:00', '10:05']);
  });

  test('requires a track for each talk when multiple tracks are available', async () => {
    const user = userEvent.setup();
    const api = serveEvent(eventFixture({
      agendaTracks: [{ workshopAgendaTrackId: 'track-1', name: 'Room A', order: 0 }, { workshopAgendaTrackId: 'track-2', name: 'Room B', order: 1 }],
      talks: [{ workshopTalkId: 'talk-1', title: 'Unassigned talk', sessionType: 'talk', speakers: [] }],
    }));
    renderAt('#talk-pool');
    await loaded();
    await user.click(screen.getByRole('button', { name: 'Salva talk pool' }));
    expect(await screen.findByText("Assegna ogni talk a una track prima di salvare l'agenda.")).toBeInTheDocument();
    expect(api.to('/Workshop/Update/')).toHaveLength(0);

    // A select is named by its value, then its label.
    await user.click(within(poolList()).getByRole('button', { name: /Track$/ }));
    await user.click(await screen.findByRole('option', { name: 'Room B' }));
    await user.click(screen.getByRole('button', { name: 'Salva talk pool' }));
    await waitFor(() => expect(api.to('/Workshop/Update/w1', 'PUT')).toHaveLength(1));
    expect(api.lastUpdate()!.talks![0].trackId).toBe('track-2');
  });

  test('moves through one schedule page per track and shows only that track sessions', async () => {
    const user = userEvent.setup();
    serveEvent(eventFixture({
      agendaTracks: [{ workshopAgendaTrackId: 'track-1', name: 'Room A', order: 0 }, { workshopAgendaTrackId: 'track-2', name: 'Room B', order: 1 }],
      talks: [
        { workshopTalkId: 'talk-1', title: 'Room A session', trackId: 'track-1', sessionType: 'talk', speakers: [] },
        { workshopTalkId: 'talk-2', title: 'Room B session', trackId: 'track-2', sessionType: 'talk', speakers: [] },
      ],
      agendaItems: [
        { workshopAgendaItemId: 'item-1', itemType: 'talk', talkId: 'talk-1', trackId: 'track-1', startTime: '2024-03-15T09:00:00Z', endTime: '2024-03-15T10:00:00Z' },
        { workshopAgendaItemId: 'item-2', itemType: 'talk', talkId: 'talk-2', trackId: 'track-2', startTime: '2024-03-15T09:00:00Z', endTime: '2024-03-15T10:00:00Z' },
      ],
    }));
    renderAt('#agenda');
    expect(await screen.findByText('Room A session')).toBeVisible();
    expect(screen.queryByText('Room B session')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Room A (1 di 2)' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Track successiva' }));
    expect(screen.getByText('Room B session')).toBeVisible();
    expect(screen.queryByText('Room A session')).not.toBeInTheDocument();
  });

  test('groups each schedule item into title-and-controls and times, with move buttons as the keyboard alternative', async () => {
    const user = userEvent.setup();
    serveEvent(eventFixture({
      agendaTracks: [{ workshopAgendaTrackId: 'track-1', name: 'Main stage', order: 0 }],
      talks: [{ workshopTalkId: 'talk-1', title: 'Opening', trackId: 'track-1', sessionType: 'talk', speakers: [] }],
      agendaItems: [
        { workshopAgendaItemId: 'item-0', itemType: 'talk', talkId: 'talk-1', trackId: 'track-1', startTime: '2024-03-15T11:00:00Z', endTime: '2024-03-15T12:00:00Z', order: 0 },
        { workshopAgendaItemId: 'item-1', itemType: 'service', title: 'Lunch', roomName: 'Dining room', trackId: 'track-1', startTime: '2024-03-15T12:00:00Z', endTime: '2024-03-15T13:00:00Z', order: 1 },
      ],
    }));
    renderAt('#agenda');
    await screen.findByRole('heading', { level: 5, name: 'Lunch' });
    const lunch = rowOf('Lunch');
    expect(within(lunch).getByRole('group', { name: 'Titolo e controlli della voce' })).toBeInTheDocument();
    const times = within(lunch).getByRole('group', { name: 'Orari della voce' });
    expect(within(times).getByLabelText('Ora di inizio')).toHaveValue('12:00');
    expect(within(times).getByLabelText('Ora di fine')).toHaveValue('13:00');
    expect(within(lunch).getByRole('textbox', { name: 'Nome sala' })).toHaveValue('Dining room');
    expect(within(lunch).getByRole('textbox', { name: 'Titolo servizio / intervallo' })).toHaveValue('Lunch');
    expect(within(rowOf('Opening')).queryByRole('textbox', { name: 'Titolo servizio / intervallo' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sposta in alto: Opening' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Sposta in basso: Lunch' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Sposta in basso: Opening' }));
    expect(within(schedule()).getAllByRole('heading', { level: 5 }).map(heading => heading.textContent)).toEqual(['Lunch', 'Opening']);
    expect(starts()).toEqual(['11:00', '12:00']);
    expect(screen.getByRole('button', { name: 'Sposta in alto: Opening' })).toHaveFocus();
    fireEvent.change(within(rowOf('Opening')).getByLabelText('Ora di fine'), { target: { value: '13:30' } });
    await user.click(screen.getByRole('button', { name: 'Rimuovi intervallo' }));
    expect(screen.queryByRole('textbox', { name: 'Titolo servizio / intervallo' })).not.toBeInTheDocument();
    // The suggested title and the empty fallback are the stored values the public agenda recognises.
    expect(screen.getByRole('textbox', { name: 'Titolo intervallo di servizio' })).toHaveValue('Lunch');
    await user.click(screen.getByRole('button', { name: 'Aggiungi intervallo di servizio' }));
    expect(screen.getByRole('textbox', { name: 'Titolo servizio / intervallo' })).toHaveValue('Lunch');
    expect(await screen.findByText(/Intervallo di servizio aggiunto/)).toBeInTheDocument();
    expect(starts()).toEqual(['12:00', '13:30']);
    await user.clear(screen.getByRole('textbox', { name: 'Titolo intervallo di servizio' }));
    await user.click(screen.getByRole('button', { name: 'Aggiungi intervallo di servizio' }));
    expect(valuesOf(screen.getAllByRole('textbox', { name: 'Titolo servizio / intervallo' }))).toEqual(['Lunch', 'Service interval']);
  });

  test('clamps the schedule page when the track count is lowered, clears the new talk track and collapses to one track when the field is cleared', async () => {
    const user = userEvent.setup();
    serveEvent(eventFixture({
      agendaTracks: [{ workshopAgendaTrackId: 'track-1', name: 'Room A', order: 0 }, { workshopAgendaTrackId: 'track-2', name: 'Room B', order: 1 }, { workshopAgendaTrackId: 'track-3', name: 'Room C', order: 2 }],
    }));
    renderAt('#agenda');
    await loaded();
    await user.click(screen.getByRole('button', { name: 'Track successiva' }));
    await user.click(screen.getByRole('button', { name: 'Track successiva' }));
    expect(screen.getByRole('heading', { name: 'Room C (3 di 3)' })).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: '6. Talk pool, raggiunto' }));
    const form = createForm();
    await user.click(within(form).getByRole('button', { name: /Track$/ }));
    await user.click(await screen.findByRole('option', { name: 'Room C' }));
    expect(within(form).getByRole('button', { name: /Track$/ })).toHaveTextContent('Room C');
    setTrackCount(2);
    expect(within(form).getByRole('button', { name: /Track$/ })).not.toHaveTextContent('Room C');
    expect(screen.queryByRole('textbox', { name: 'Nome track 3' })).not.toBeInTheDocument();
    await user.type(within(form).getByRole('textbox', { name: 'Titolo del talk' }), 'Senza track');
    await user.click(within(form).getByRole('button', { name: 'Seleziona uno o più relatori' }));
    await user.click(within(form).getByRole('checkbox', { name: 'Ada Lovelace' }));
    await user.click(within(form).getByRole('button', { name: 'Aggiungi talk al pool' }));
    expect(await screen.findByText('Seleziona una track per questo talk.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: "Avanti: Track e orari dell'agenda" }));
    expect(screen.getByRole('heading', { name: 'Room B (2 di 2)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Track successiva' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Track precedente' })).toBeEnabled();

    // Clearing the field collapses to one track at once, as before.
    await user.click(screen.getByRole('link', { name: '6. Talk pool, raggiunto' }));
    setTrackCount('');
    expect(screen.getByRole('spinbutton', { name: 'Numero di track' })).toHaveValue(1);
    expect(screen.queryByRole('textbox', { name: 'Nome track 2' })).not.toBeInTheDocument();
    expect(screen.getByText('I talk sono assegnati a Room A automaticamente.')).toBeInTheDocument();
  });

  test('refills the schedule from new parameters and refuses to save overlapping items', async () => {
    const user = userEvent.setup();
    const api = serveEvent(twoTalks());
    renderAt('#agenda');
    await screen.findByText('First talk');
    fireEvent.change(screen.getByLabelText('Ora di inizio della track'), { target: { value: '14:00' } });
    await user.clear(screen.getByRole('spinbutton', { name: 'Durata talk (minuti)' }));
    await user.type(screen.getByRole('spinbutton', { name: 'Durata talk (minuti)' }), '30');
    await user.clear(screen.getByRole('spinbutton', { name: 'Durata pausa (minuti)' }));
    await user.type(screen.getByRole('spinbutton', { name: 'Durata pausa (minuti)' }), '10');
    await user.click(screen.getByRole('button', { name: 'Riempi automaticamente gli orari delle track' }));
    expect(starts()).toEqual(['14:00', '14:30', '14:40']);

    fireEvent.change(within(rowOf('Second talk')).getByLabelText('Ora di inizio'), { target: { value: '14:10' } });
    await user.click(screen.getByRole('button', { name: 'Salva agenda' }));
    expect((await screen.findByText(/non possono sovrapporsi/)).closest('[role="alert"]')).toBeInTheDocument();
    expect(api.to('/Workshop/Update/')).toHaveLength(0);
  });

  test('sends only the Sessionize ID to the importer; imported talks replace the list while unsaved tracks stay', async () => {
    const user = userEvent.setup();
    const imported = eventFixture({ talks: [{ workshopTalkId: 'session-1', sessionizeId: 'session-1', title: 'Imported talk', sessionType: 'talk', speakers: [{ sessionizeId: 'sp-1', name: 'Grace Hopper' }] }] });
    const api = serveEvent(eventFixture({ talks: [{ workshopTalkId: 'local-1', title: 'Local talk', sessionType: 'talk', speakers: [] }] }), {
      '/Workshop/ImportSessionize/': () => { api.store.record = imported; return jsonResponse({ importedTalks: 1, importedSpeakers: 1 }); },
    });
    renderAt('#talk-pool');
    await loaded();
    expect(screen.getByDisplayValue('Local talk')).toBeInTheDocument();
    setTrackCount(2);
    await user.clear(screen.getByRole('textbox', { name: 'Nome track 2' }));
    await user.type(screen.getByRole('textbox', { name: 'Nome track 2' }), 'Room B');
    expect(screen.queryByRole('button', { name: 'Importa talk' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Importa da$/ }));
    await user.click(await screen.findByRole('option', { name: 'Sessionize' }));
    expect(screen.getByRole('button', { name: 'Importa talk' })).toBeDisabled();
    await user.type(screen.getByRole('textbox', { name: 'ID Sessionize' }), 'event123');
    await user.click(screen.getByRole('button', { name: 'Importa talk' }));

    await waitFor(() => expect(api.to('/Workshop/ImportSessionize/w1', 'POST')).toHaveLength(1));
    expect(api.to('/Workshop/ImportSessionize/w1')[0].body).toEqual({ sessionizeId: 'event123' });
    await waitFor(() => expect(api.to('/Workshop/Get/').length).toBeGreaterThanOrEqual(2));
    expect(await screen.findByText('Talk importati da Sessionize e schede dei relatori corrispondenti aggiornate.')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Imported talk')).toBeVisible();
    expect(screen.queryByDisplayValue('Local talk')).not.toBeInTheDocument();
    expect(screen.getByText('Grace Hopper')).toBeVisible();
    expect(screen.getByRole('textbox', { name: 'Nome track 2' })).toHaveValue('Room B');
    expect(api.to('/Speaker/Get').length).toBeGreaterThanOrEqual(2);
    expect(api.to('/Workshop/Update/')).toHaveLength(0);

    // The imported talks are part of the record now: the final whole-record save keeps them.
    for (let i = 0; i < 4 && !screen.queryByRole('button', { name: 'Salva modifiche' }); i += 1) {
      await user.click(screen.getByRole('button', { name: /^Avanti/ }));
    }
    await user.click(screen.getByRole('button', { name: 'Salva modifiche' }));
    await waitFor(() => expect(api.to('/Workshop/Update/w1', 'PUT')).toHaveLength(1));
    expect(api.lastUpdate()!.talks!.map(talk => talk.title)).toEqual(['Imported talk']);
  });

  test('creates a talk using a speaker selected from the admin speaker directory', async () => {
    const user = userEvent.setup();
    const api = serveEvent(eventFixture());
    renderAt('#talk-pool');
    await loaded();
    const form = createForm();
    await user.click(within(form).getByRole('button', { name: 'Aggiungi talk al pool' }));
    expect(await screen.findByText('Inserisci un titolo per il talk.')).toBeInTheDocument();
    await user.type(within(form).getByRole('textbox', { name: 'Titolo del talk' }), 'Analytical Engines');
    await user.click(within(form).getByRole('button', { name: 'Aggiungi talk al pool' }));
    expect(await screen.findByText("Seleziona almeno un relatore dall'anagrafica relatori.")).toBeInTheDocument();
    await user.click(within(form).getByRole('button', { name: 'Seleziona uno o più relatori' }));
    await user.type(within(form).getByRole('textbox', { name: 'Seleziona uno o più relatori' }), 'Ada');
    expect(within(form).queryByRole('checkbox', { name: 'Alan Turing' })).not.toBeInTheDocument();
    await user.click(within(form).getByRole('checkbox', { name: 'Ada Lovelace' }));
    await user.click(within(form).getByRole('button', { name: 'Aggiungi talk al pool' }));
    expect(await screen.findByText("Talk aggiunto al pool dell'evento. Salva il talk pool per renderlo definitivo.")).toBeInTheDocument();

    const list = poolList();
    expect(within(list).getByDisplayValue('Analytical Engines')).toBeVisible();
    expect(screen.getByText('I talk sono assegnati a Track 1 automaticamente.')).toBeInTheDocument();
    expect(within(list).getByText('Track 1')).toBeInTheDocument();
    expect(within(list).getByText('Ada Lovelace')).toBeVisible();
    expect(within(form).getByRole('textbox', { name: 'Titolo del talk' })).toHaveValue('');

    await user.click(screen.getByRole('button', { name: 'Salva talk pool' }));
    await waitFor(() => expect(api.lastUpdate()).toBeDefined());
    const talk = api.lastUpdate()!.talks![0];
    expect(talk).toMatchObject({ title: 'Analytical Engines', sessionType: 'talk', speakers: [{ workshopSpeakerId: 'speaker-1', name: 'Ada Lovelace', biography: 'Engineer' }] });
    expect(talk.trackId).toBe(api.lastUpdate()!.agendaTracks![0].workshopAgendaTrackId);
  });

  test('offers Talk, Panel, Introduzione and Altro for a new talk, and Servizio too in the pool', async () => {
    const user = userEvent.setup();
    serveEvent(twoTalks());
    renderAt('#talk-pool');
    await loaded();
    await user.click(within(createForm()).getByRole('button', { name: /Tipo di sessione$/ }));
    let listbox = await screen.findByRole('listbox');
    expect(within(listbox).getAllByRole('option').map(option => option.textContent)).toEqual(['Talk', 'Panel', 'Introduzione', 'Altro']);
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());
    await user.click(within(poolList()).getAllByRole('button', { name: /Tipo di sessione$/ })[0]);
    listbox = await screen.findByRole('listbox');
    expect(within(listbox).getAllByRole('option').map(option => option.textContent)).toEqual(['Talk', 'Panel', 'Introduzione', 'Servizio', 'Altro']);
  });

  test('matches a talk speaker to the directory by id or, without an id, by name', async () => {
    serveEvent(eventFixture({ talks: [
      { workshopTalkId: 'talk-1', title: 'By id', sessionType: 'talk', speakers: [{ workshopSpeakerId: 'speaker-2', name: 'Someone renamed' }] },
      { workshopTalkId: 'talk-2', title: 'By name', sessionType: 'talk', speakers: [{ name: 'Ada Lovelace' }] },
    ] }));
    renderAt('#talk-pool');
    await loaded();
    const list = poolList();
    expect(within(list).getByRole('button', { name: 'Rimuovi Alan Turing' })).toBeInTheDocument();
    expect(within(list).getByRole('button', { name: 'Rimuovi Ada Lovelace' })).toBeInTheDocument();
  });

  test('edits and removes talks inline in the pool', async () => {
    const user = userEvent.setup();
    const api = serveEvent(twoTalks());
    renderAt('#talk-pool');
    await loaded();
    const list = poolList();
    const titles = within(list).getAllByRole('textbox', { name: 'Titolo del talk' });
    await user.type(titles[0], ' (keynote)');
    await user.click(within(list).getAllByRole('button', { name: 'Rimuovi' })[1]);
    expect(within(list).queryByDisplayValue('Second talk')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Salva talk pool' }));
    await waitFor(() => expect(api.lastUpdate()).toBeDefined());
    expect(api.lastUpdate()!.talks!.map(talk => talk.title)).toEqual(['First talk (keynote)']);
  });
});

describe('tracks step', () => {
  const tracks = [
    { workshopTrackId: 'k1', title: 'Registrazione', startTime: '2024-03-15T08:30:00Z', endTime: '2024-03-15T09:00:00Z', level: 0, speakers: [], speakersName: '' },
    { workshopTrackId: 'k2', title: 'Intro a Blazor', startTime: '2024-03-15T09:00:00Z', endTime: '2024-03-15T10:00:00Z', level: 2, speakers: ['speaker-1'], speakersName: 'Ada Lovelace', abstract: 'Componenti.' },
    // Day and month swapped by the old admin: shown as stored, without comment.
    { workshopTrackId: 'k3', title: 'Keynote', startTime: '2024-12-03T09:00:00Z', endTime: '2024-12-03T10:00:00Z', level: 1, speakers: [], speakersName: 'Grace Hopper' },
  ];

  test('lists the tracks with their stored UTC times, level, speakers and abstract, and offers Aggiungi', async () => {
    serveEvent(eventFixture({ tracks }));
    renderAt('#tracks');
    const panel = await screen.findByRole('region', { name: 'Tracks' });
    const rows = within(panel).getAllByRole('listitem');
    expect(rows.map(row => within(row).getByRole('heading', { level: 4 }).textContent)).toEqual(['Registrazione', 'Intro a Blazor', 'Keynote']);
    expect(within(rows[1]).getByText('15/03/2024, 09:00')).toBeInTheDocument();
    expect(within(rows[1]).getByText('15/03/2024, 10:00')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Livello').nextElementSibling).toHaveTextContent('2');
    expect(within(rows[1]).getByText('Relatori').nextElementSibling).toHaveTextContent('Ada Lovelace');
    expect(within(rows[1]).getByText('Abstract').nextElementSibling).toHaveTextContent('Componenti.');
    expect(within(rows[0]).queryByText('Relatori')).not.toBeInTheDocument();
    expect(within(rows[2]).getByText('03/12/2024, 09:00')).toBeInTheDocument();
    expect(screen.queryByText("Data diversa dall'evento")).not.toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: 'Aggiungi' })).toBeEnabled();

    serveEvent(eventFixture());
    renderAt('#tracks');
    expect(await screen.findByText('Nessuna track disponibile. Clicca su «Aggiungi track» per crearne una.')).toBeInTheDocument();
  });

  test('adds, edits and deletes a track: whole-record PUT then a reload, as before', async () => {
    const user = userEvent.setup();
    const api = serveEvent(eventFixture({ tracks: tracks.slice(0, 2) }));
    renderAt('#tracks');
    const panel = await screen.findByRole('region', { name: 'Tracks' });

    await user.click(within(panel).getByRole('button', { name: 'Aggiungi' }));
    let dialog = await screen.findByRole('dialog', { name: 'Aggiungi nuova track' });
    await user.click(within(dialog).getByRole('button', { name: 'Salva track' }));
    expect(await screen.findByText('Compila tutti i campi obbligatori')).toBeInTheDocument();
    expect(api.to('/Workshop/Update/')).toHaveLength(0);
    await user.type(within(dialog).getByRole('textbox', { name: 'Titolo' }), 'Chiusura');
    fireEvent.change(within(dialog).getByLabelText('Ora di inizio *'), { target: { value: '2024-03-15T11:00' } });
    fireEvent.change(within(dialog).getByLabelText('Ora di fine *'), { target: { value: '2024-03-15T11:30' } });
    await user.click(within(dialog).getByRole('checkbox', { name: 'Alan Turing' }));
    await user.click(within(dialog).getByRole('button', { name: 'Salva track' }));
    await waitFor(() => expect(api.lastUpdate()).toBeDefined());
    const added = api.lastUpdate()!.tracks!;
    expect(added).toHaveLength(3);
    expect(added[2]).toMatchObject({ workshopTrackId: '00000000-0000-0000-0000-000000000000', title: 'Chiusura', startTime: '2024-03-15T11:00:00.000Z', endTime: '2024-03-15T11:30:00.000Z', level: 0, speakers: ['speaker-2'], speakersName: 'Alan Turing', image: '' });
    expect(api.lastUpdate()!.title).toBe('Test Workshop');
    expect(await screen.findByText('Track aggiunta')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const putIndex = api.calls.findIndex(call => call.url.includes('/Workshop/Update/'));
    expect(api.calls.slice(putIndex).some(call => call.url.includes('/Workshop/Get/w1') && call.method === 'GET')).toBe(true);

    await user.click(within(panel).getByRole('button', { name: 'Modifica: Intro a Blazor' }));
    dialog = await screen.findByRole('dialog', { name: 'Modifica track' });
    expect(within(dialog).getByLabelText('Ora di inizio *')).toHaveValue('2024-03-15T09:00');
    expect(within(dialog).getByRole('checkbox', { name: 'Ada Lovelace' })).toBeChecked();
    await user.type(within(dialog).getByRole('textbox', { name: 'Titolo' }), ' WebAssembly');
    await user.click(within(dialog).getByRole('button', { name: 'Salva track' }));
    await waitFor(() => expect(api.lastUpdate()!.tracks!.find(track => track.workshopTrackId === 'k2')).toMatchObject({ title: 'Intro a Blazor WebAssembly', speakers: ['speaker-1'], level: 2 }));
    expect(await screen.findByText('Track aggiornata')).toBeInTheDocument();

    await user.click(within(panel).getByRole('button', { name: 'Elimina: Registrazione' }));
    expect(within(panel).getByRole('alert')).toHaveTextContent('Vuoi davvero eliminare questa track?');
    await user.click(within(panel).getByRole('button', { name: 'OK' }));
    await waitFor(() => expect(api.lastUpdate()!.tracks!.map(track => track.workshopTrackId)).toEqual(['k2', '00000000-0000-0000-0000-000000000000']));
    expect(await screen.findByText('Track eliminata')).toBeInTheDocument();
  });
});

import React from 'react';
import { Route, Routes } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { fireEvent, jsonResponse, render, screen, waitFor, within } from '../../test-utils';
import { AdminToastRegion, adminToasts } from '../toasts';
import EventDetailAdminPage from './EventDetailAdminPage';
import { eventFixture, serveEvent } from './eventFixtures';

// Steps 5-8 of the wizard: the previous AdminWorkshopAgenda tests, with the same payload and call-order
// assertions, plus the legacy sessions.

const renderAt = (hash: string) => render(
  <>
    <Routes><Route path="/admin/workshop/:id" element={<EventDetailAdminPage />} /></Routes>
    <AdminToastRegion />
  </>,
  { route: `/admin/workshop/w1${hash}` },
);
const loaded = () => screen.findByRole('heading', { level: 1, name: 'Test Workshop' });
const starts = () => screen.getAllByLabelText(/^Inizio di /).map(input => (input as HTMLInputElement).value);
const ends = () => screen.getAllByLabelText(/^Fine di /).map(input => (input as HTMLInputElement).value);
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

describe('talk list, schedule and registration steps', () => {
  test('keeps the talk list, schedule and registration steps separate, with the previous defaults', async () => {
    serveEvent(eventFixture());
    const { unmount } = renderAt('#talk');
    await loaded();
    expect(screen.getByRole('region', { name: 'Crea un talk' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Link di prenotazione e disdetta' })).not.toBeInTheDocument();
    unmount();

    serveEvent(eventFixture());
    const second = renderAt('#agenda');
    await loaded();
    expect(screen.getByLabelText('Inizio della track')).toHaveValue('09:00');
    expect(screen.getByRole('spinbutton', { name: 'Durata talk (minuti)' })).toHaveValue(60);
    expect(screen.getByRole('spinbutton', { name: 'Pausa tecnica (minuti)' })).toHaveValue(5);
    expect(screen.queryByRole('region', { name: 'Crea un talk' })).not.toBeInTheDocument();
    second.unmount();

    serveEvent(eventFixture());
    renderAt('#iscrizione');
    await loaded();
    expect(screen.getByRole('textbox', { name: 'Link di prenotazione e disdetta' })).toBeVisible();
  });

  test('saves an initial Eventbrite ticket quantity separately from venue spaces', async () => {
    const user = userEvent.setup();
    const api = serveEvent(eventFixture({ location: { name: 'Community Hall', coordinates: '', address: '1 Main Street', maximumSpaces: 120 } }));
    renderAt('#iscrizione');
    await loaded();
    const capacity = screen.getByRole('spinbutton', { name: 'Biglietti gratuiti disponibili su Eventbrite' });
    await user.clear(capacity);
    await user.type(capacity, '35');
    fireEvent.change(screen.getByLabelText('Inizio vendite'), { target: { value: '2024-03-01T09:00' } });
    fireEvent.change(screen.getByLabelText('Fine vendite'), { target: { value: '2024-03-14T18:00' } });
    await user.click(screen.getByRole('button', { name: 'Salva iscrizione e agenda' }));

    await waitFor(() => expect(api.to('/Workshop/Update/w1', 'PUT')).toHaveLength(1));
    const body = api.lastUpdate()!;
    expect(body.eventbriteTicketCapacity).toBe(35);
    expect(body.eventbriteSalesStart).toBe('2024-03-01T09:00');
    expect(body.eventbriteSalesEnd).toBe('2024-03-14T18:00');
    expect(body.location!.maximumSpaces).toBe(120);
    expect(await screen.findByText('Iscrizione e agenda salvate')).toBeInTheDocument();
  });

  test('saves the booking link with the legacy registration pair and the attendee notes', async () => {
    const user = userEvent.setup();
    const api = serveEvent(eventFixture({ externalRegistration: true, externalRegistrationLink: 'https://old.example.test/signup' }));
    renderAt('#iscrizione');
    await loaded();
    const link = screen.getByRole('textbox', { name: 'Link di prenotazione e disdetta' });
    expect(link).toHaveValue('https://old.example.test/signup');
    await user.clear(link);
    await user.type(link, 'https://booking.example.test/event/1');
    await user.type(screen.getByRole('textbox', { name: 'Note per chi partecipa' }), 'Bring your laptop');
    await user.click(screen.getByRole('button', { name: 'Salva iscrizione e agenda' }));
    await waitFor(() => expect(api.lastUpdate()).toMatchObject({ bookingServiceUrl: 'https://booking.example.test/event/1', externalRegistration: true, externalRegistrationLink: 'https://booking.example.test/event/1', attendeeNotes: 'Bring your laptop' }));
  });

  test('refreshes Eventbrite inventory and displays aggregate counts only', async () => {
    const user = userEvent.setup();
    const api = serveEvent(eventFixture({ eventbriteEventId: 'event-1', eventbriteEventUrl: 'https://www.eventbrite.it/e/1', eventbriteTicketCapacity: 40, eventbriteSyncedTicketCapacity: 40, eventbriteSyncStatus: 'synced', agendaTracks: [{ workshopAgendaTrackId: 'track-1', name: 'Main', order: 0 }], agendaItems: [{ workshopAgendaItemId: 'item-1', itemType: 'service', trackId: 'track-1', startTime: '2024-03-15T09:00:00Z', endTime: '2024-03-15T10:00:00Z' }] }), {
      '/Eventbrite/TicketSales/': { totalCapacity: 40, sold: 12, pending: 2, remaining: 26, refreshedAt: '2026-10-11T10:00:00Z' },
    });
    renderAt('#iscrizione');
    await loaded();
    expect(screen.getByText('Bozza sincronizzata')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Apri l'evento su Eventbrite/ })).toHaveAttribute('href', 'https://www.eventbrite.it/e/1');
    expect(screen.queryByRole('button', { name: 'Salva capienza biglietti' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Aggiorna le vendite' }));
    expect(await screen.findByText(/Venduti 12, in sospeso 2, capienza 40, disponibili 26\./)).toBeInTheDocument();
    expect(api.to('/Eventbrite/TicketSales/w1', 'GET')).toHaveLength(1);
  });

  test('saves local agenda before explicitly syncing Eventbrite', async () => {
    const user = userEvent.setup();
    const record = ready();
    const api = serveEvent(record, { '/Eventbrite/Sync/': () => jsonResponse({ ...record, eventbriteEventId: 'event-1', eventbriteSyncStatus: 'synced' }) });
    renderAt('#iscrizione');
    await loaded();
    expect(screen.queryByText(/Prima di sincronizzare/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Crea la bozza su Eventbrite' }));

    await waitFor(() => expect(api.to('/Eventbrite/Sync/w1', 'POST')).toHaveLength(1));
    const saveCall = api.calls.find(call => call.url.includes('/Workshop/Update/'));
    const syncCall = api.calls.find(call => call.url.includes('/Eventbrite/Sync/'));
    expect(saveCall).toBeDefined();
    expect(syncCall).toBeDefined();
    expect(api.calls.indexOf(saveCall!)).toBeLessThan(api.calls.indexOf(syncCall!));
    expect(saveCall!.method).toBe('PUT');
    expect(await screen.findByText('Evento sincronizzato con Eventbrite')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sincronizza con Eventbrite' })).toBeInTheDocument();
  });

  test('does not call Eventbrite when the local save is refused, and keeps the sync button off while inputs are missing', async () => {
    const user = userEvent.setup();
    const api = serveEvent(ready());
    renderAt('#iscrizione');
    await loaded();
    fireEvent.change(screen.getByLabelText('Inizio vendite'), { target: { value: '2024-03-14T18:00' } });
    fireEvent.change(screen.getByLabelText('Fine vendite'), { target: { value: '2024-03-01T09:00' } });
    expect(screen.getByRole('button', { name: 'Crea la bozza su Eventbrite' })).toBeDisabled();
    expect(screen.getByText("Fine vendite successiva all'inizio")).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Salva iscrizione e agenda' }));
    expect(await screen.findByText('La vendita dei biglietti deve finire dopo il suo inizio.')).toBeInTheDocument();
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
    expect(await screen.findByText('Capienza salvata in locale')).toBeInTheDocument();
    expect(screen.getByText('Da sincronizzare')).toBeInTheDocument();

    const eventbrite = screen.getByRole('region', { name: 'Eventbrite' });
    await user.click(within(eventbrite).getByRole('button', { name: 'Pubblica su Eventbrite…' }));
    expect(api.to('/Eventbrite/Publish/')).toHaveLength(0);
    expect(within(eventbrite).getByRole('alert')).toHaveTextContent("Pubblicare l'evento su Eventbrite?");
    await user.click(within(eventbrite).getByRole('button', { name: 'Pubblica' }));
    await waitFor(() => expect(api.to('/Eventbrite/Publish/w1', 'POST')).toHaveLength(1));
    expect(await within(eventbrite).findByText('Pubblicato su Eventbrite')).toBeInTheDocument();
    await waitFor(() => expect(within(eventbrite).queryByRole('button', { name: /Pubblica su Eventbrite/ })).not.toBeInTheDocument());
  });

  test('shows the server detail when an Eventbrite action fails', async () => {
    const user = userEvent.setup();
    serveEvent(ready(), { '/Eventbrite/Sync/': () => jsonResponse({ title: 'Eventbrite synchronization failed', detail: 'Eventbrite rejected the venue' }, 502) });
    renderAt('#iscrizione');
    await loaded();
    await user.click(screen.getByRole('button', { name: 'Crea la bozza su Eventbrite' }));
    expect(await screen.findByText('Sincronizzazione con Eventbrite non riuscita')).toBeInTheDocument();
    expect(screen.getByText('Eventbrite rejected the venue')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Crea la bozza su Eventbrite' })).toBeEnabled();
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

    await user.click(screen.getByRole('button', { name: 'Salva agenda' }));
    await waitFor(() => expect(api.to('/Workshop/Update/w1', 'PUT')).toHaveLength(1));
    const body = api.lastUpdate()!;
    expect(body.agendaItems).toHaveLength(3);
    expect(body.agendaItems!.every(item => item.trackId === 'track-1')).toBe(true);
    expect(body.agendaItems![0].startTime).toMatch(/^2024-03-15T09:00:00/);
    expect(body.talks![0].trackId).toBe('track-1');
    expect(await screen.findByText('Agenda salvata')).toBeInTheDocument();
  });

  test('fills the schedule only when the schedule step is entered, never from the talk list', async () => {
    const user = userEvent.setup();
    const api = serveEvent(twoTalks());
    renderAt('#talk');
    await loaded();
    await user.click(screen.getByRole('button', { name: 'Salva elenco talk' }));
    await waitFor(() => expect(api.to('/Workshop/Update/w1', 'PUT')).toHaveLength(1));
    expect(api.lastUpdate()!.agendaItems).toEqual([]);
    expect(api.lastUpdate()!.talks!.map(talk => talk.trackId)).toEqual(['track-1', 'track-1']);
    expect(await screen.findByText('Elenco talk salvato')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Avanti: Agenda e orari' }));
    expect(await screen.findByDisplayValue('Technical gap')).toBeVisible();
    expect(starts()).toEqual(['09:00', '10:00', '10:05']);
    expect(screen.getByText('Modifiche non salvate', { selector: 'span' })).toBeInTheDocument();
  });

  test('requires a track for each talk when multiple tracks are available', async () => {
    const user = userEvent.setup();
    const api = serveEvent(eventFixture({
      agendaTracks: [{ workshopAgendaTrackId: 'track-1', name: 'Room A', order: 0 }, { workshopAgendaTrackId: 'track-2', name: 'Room B', order: 1 }],
      talks: [{ workshopTalkId: 'talk-1', title: 'Unassigned talk', sessionType: 'talk', speakers: [] }],
    }));
    renderAt('#talk');
    await loaded();
    const list = screen.getByRole('list', { name: "Talk nell'elenco" });
    await user.click(screen.getByRole('button', { name: 'Salva elenco talk' }));
    expect(await screen.findByText("Assegna ogni talk a una track prima di salvare l'agenda.")).toBeInTheDocument();
    expect(api.to('/Workshop/Update/')).toHaveLength(0);

    await user.click(within(list).getByRole('button', { name: /Track/ }));
    await user.click(await screen.findByRole('option', { name: 'Room B' }));
    await user.click(screen.getByRole('button', { name: 'Salva elenco talk' }));
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
    expect(screen.queryByText('Modifiche non salvate')).not.toBeInTheDocument();
  });

  test('keeps schedule times together before compact room and interval fields, with move buttons as the keyboard alternative', async () => {
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
    const times = await screen.findByRole('group', { name: 'Orario di Lunch' });
    expect(within(times).getByLabelText('Inizio di Lunch')).toHaveValue('12:00');
    expect(within(times).getByLabelText('Fine di Lunch')).toHaveValue('13:00');
    expect(screen.getByLabelText('Sala di Lunch')).toHaveValue('Dining room');
    expect(screen.getByLabelText('Titolo della pausa')).toHaveValue('Lunch');
    expect(times.compareDocumentPosition(screen.getByLabelText('Sala di Lunch')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sposta in alto: Opening' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Sposta in basso: Lunch' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Sposta in basso: Opening' }));
    expect(screen.getAllByLabelText(/^Inizio di /).map(input => input.getAttribute('aria-label'))).toEqual(['Inizio di Lunch', 'Inizio di Opening']);
    expect(starts()).toEqual(['11:00', '12:00']);
    expect(screen.getByRole('button', { name: 'Sposta in alto: Opening' })).toHaveFocus();
    fireEvent.change(screen.getByLabelText('Fine di Opening'), { target: { value: '13:30' } });
    await user.click(screen.getByRole('button', { name: 'Rimuovi: Lunch' }));
    expect(screen.queryByLabelText('Titolo della pausa')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Aggiungi pausa' }));
    expect(screen.getByLabelText('Titolo della pausa')).toHaveValue('Pausa');
    expect(starts()).toEqual(['12:00', '13:30']);
  });

  test('refills the schedule from new parameters and refuses to save overlapping items', async () => {
    const user = userEvent.setup();
    const api = serveEvent(twoTalks());
    renderAt('#agenda');
    await screen.findByText('First talk');
    fireEvent.change(screen.getByLabelText('Inizio della track'), { target: { value: '14:00' } });
    await user.clear(screen.getByRole('spinbutton', { name: 'Durata talk (minuti)' }));
    await user.type(screen.getByRole('spinbutton', { name: 'Durata talk (minuti)' }), '30');
    await user.clear(screen.getByRole('spinbutton', { name: 'Pausa tecnica (minuti)' }));
    await user.type(screen.getByRole('spinbutton', { name: 'Pausa tecnica (minuti)' }), '10');
    await user.click(screen.getByRole('button', { name: 'Riempi gli orari' }));
    expect(starts()).toEqual(['14:00', '14:30', '14:40']);

    fireEvent.change(screen.getByLabelText('Inizio di Second talk'), { target: { value: '14:10' } });
    await user.click(screen.getByRole('button', { name: 'Salva agenda' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/non possono sovrapporsi/);
    expect(api.to('/Workshop/Update/')).toHaveLength(0);
  });

  test('sends only the Sessionize ID to the importer; imported talks replace the list while unsaved tracks stay', async () => {
    const user = userEvent.setup();
    const imported = eventFixture({ talks: [{ workshopTalkId: 'session-1', sessionizeId: 'session-1', title: 'Imported talk', sessionType: 'talk', speakers: [{ sessionizeId: 'sp-1', name: 'Grace Hopper' }] }] });
    const api = serveEvent(eventFixture({ talks: [{ workshopTalkId: 'local-1', title: 'Local talk', sessionType: 'talk', speakers: [] }] }), {
      '/Workshop/ImportSessionize/': () => { api.store.record = imported; return jsonResponse({ importedTalks: 1, importedSpeakers: 1 }); },
    });
    renderAt('#talk');
    await loaded();
    expect(screen.getByDisplayValue('Local talk')).toBeInTheDocument();
    await user.clear(screen.getByRole('spinbutton', { name: 'Numero di track' }));
    await user.type(screen.getByRole('spinbutton', { name: 'Numero di track' }), '2');
    await user.clear(screen.getByRole('textbox', { name: 'Nome della track 2' }));
    await user.type(screen.getByRole('textbox', { name: 'Nome della track 2' }), 'Room B');
    const importForm = screen.getByRole('form', { name: 'Importa da Sessionize' });
    expect(within(importForm).getByRole('button', { name: 'Importa talk' })).toBeDisabled();
    await user.type(within(importForm).getByRole('textbox', { name: 'ID evento Sessionize' }), 'event123');
    await user.click(within(importForm).getByRole('button', { name: 'Importa talk' }));

    await waitFor(() => expect(api.to('/Workshop/ImportSessionize/w1', 'POST')).toHaveLength(1));
    expect(api.to('/Workshop/ImportSessionize/w1')[0].body).toEqual({ sessionizeId: 'event123' });
    await waitFor(() => expect(api.to('/Workshop/Get/').length).toBeGreaterThanOrEqual(2));
    expect(await screen.findByText(/Talk importati da Sessionize/)).toBeVisible();
    expect(screen.getByDisplayValue('Imported talk')).toBeVisible();
    expect(screen.queryByDisplayValue('Local talk')).not.toBeInTheDocument();
    expect(screen.getByText('Grace Hopper')).toBeVisible();
    expect(screen.getByRole('textbox', { name: 'Nome della track 2' })).toHaveValue('Room B');
    expect(api.to('/Speaker/Get').length).toBeGreaterThanOrEqual(2);
    expect(api.to('/Workshop/Update/')).toHaveLength(0);
  });

  test('creates a talk using a speaker selected from the admin speaker directory', async () => {
    const user = userEvent.setup();
    const api = serveEvent(eventFixture());
    renderAt('#talk');
    await loaded();
    const form = screen.getByRole('region', { name: 'Crea un talk' });
    await user.click(within(form).getByRole('button', { name: "Aggiungi talk all'elenco" }));
    expect(await screen.findByText('Indica il titolo del talk.')).toBeInTheDocument();
    await user.type(within(form).getByRole('textbox', { name: 'Titolo del talk' }), 'Analytical Engines');
    await user.click(within(form).getByRole('button', { name: "Aggiungi talk all'elenco" }));
    expect(await screen.findByText("Scegli almeno un relatore dall'anagrafica.")).toBeInTheDocument();
    await user.click(within(form).getByRole('button', { name: 'Scegli relatori' }));
    await user.type(within(form).getByRole('textbox', { name: 'Cerca un relatore' }), 'Ada');
    expect(within(form).queryByRole('checkbox', { name: 'Alan Turing' })).not.toBeInTheDocument();
    await user.click(within(form).getByRole('checkbox', { name: 'Ada Lovelace' }));
    await user.click(within(form).getByRole('button', { name: "Aggiungi talk all'elenco" }));

    const list = screen.getByRole('list', { name: "Talk nell'elenco" });
    expect(within(list).getByDisplayValue('Analytical Engines')).toBeVisible();
    expect(screen.getAllByText(/Track 1/).length).toBeGreaterThanOrEqual(2);
    expect(within(list).getByText('Ada Lovelace')).toBeVisible();
    expect(within(form).getByRole('textbox', { name: 'Titolo del talk' })).toHaveValue('');

    await user.click(screen.getByRole('button', { name: 'Salva elenco talk' }));
    await waitFor(() => expect(api.lastUpdate()).toBeDefined());
    const talk = api.lastUpdate()!.talks![0];
    expect(talk).toMatchObject({ title: 'Analytical Engines', sessionType: 'talk', speakers: [{ workshopSpeakerId: 'speaker-1', name: 'Ada Lovelace', biography: 'Engineer' }] });
    expect(talk.trackId).toBe(api.lastUpdate()!.agendaTracks![0].workshopAgendaTrackId);
  });

  test('edits and removes talks inline in the list', async () => {
    const user = userEvent.setup();
    const api = serveEvent(twoTalks());
    renderAt('#talk');
    await loaded();
    const list = screen.getByRole('list', { name: "Talk nell'elenco" });
    const titles = within(list).getAllByRole('textbox', { name: 'Titolo del talk' });
    await user.type(titles[0], ' (keynote)');
    await user.click(within(list).getAllByRole('button', { name: 'Rimuovi' })[1]);
    expect(within(list).queryByDisplayValue('Second talk')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Salva elenco talk' }));
    await waitFor(() => expect(api.lastUpdate()).toBeDefined());
    expect(api.lastUpdate()!.talks!.map(talk => talk.title)).toEqual(['First talk (keynote)']);
  });
});

describe('legacy sessions step', () => {
  const tracks = [
    { workshopTrackId: 'k1', title: 'Registrazione', startTime: '2024-03-15T08:30:00Z', endTime: '2024-03-15T09:00:00Z', level: 0, speakers: [], speakersName: '' },
    { workshopTrackId: 'k2', title: 'Intro a Blazor', startTime: '2024-03-15T09:00:00Z', endTime: '2024-03-15T10:00:00Z', level: 2, speakers: ['speaker-1'], speakersName: 'Ada Lovelace', abstract: 'Componenti.' },
    // Day and month swapped by the old admin: 3 December instead of 12 March.
    { workshopTrackId: 'k3', title: 'Keynote', startTime: '2024-12-03T09:00:00Z', endTime: '2024-12-03T10:00:00Z', level: 1, speakers: [], speakersName: 'Grace Hopper' },
  ];

  test('lists the sessions, flags the ones stored on another day and offers add on every event', async () => {
    serveEvent(eventFixture({ tracks, agendaItems: [{ workshopAgendaItemId: 'i1', itemType: 'service', startTime: '2024-03-15T09:00:00Z', endTime: '2024-03-15T10:00:00Z' }] }));
    renderAt('#sessioni');
    const legacy = await screen.findByRole('region', { name: 'Sessioni in formato storico' });
    const rows = within(legacy).getAllByRole('listitem');
    expect(rows[1]).toHaveTextContent('09:00–10:00');
    expect(rows[1]).toHaveTextContent('Ada Lovelace · Livello 2');
    expect(rows[1]).not.toHaveTextContent('2024');
    expect(within(rows[1]).queryByText("Data diversa dall'evento")).not.toBeInTheDocument();
    expect(rows[2]).toHaveTextContent('3 dicembre 2024');
    expect(within(rows[2]).getByText("Data diversa dall'evento")).toBeInTheDocument();
    expect(within(legacy).getByRole('button', { name: 'Aggiungi sessione' })).toBeEnabled();
  });

  test('adds, edits and deletes a session: whole-record PUT then a reload, as before', async () => {
    const user = userEvent.setup();
    const api = serveEvent(eventFixture({ tracks: tracks.slice(0, 2) }));
    renderAt('#sessioni');
    const legacy = await screen.findByRole('region', { name: 'Sessioni in formato storico' });

    await user.click(within(legacy).getByRole('button', { name: 'Aggiungi sessione' }));
    let dialog = await screen.findByRole('dialog', { name: 'Nuova sessione' });
    await user.click(within(dialog).getByRole('button', { name: 'Salva sessione' }));
    expect(await within(dialog).findByText('Compila titolo, inizio e fine della sessione.')).toBeInTheDocument();
    expect(api.to('/Workshop/Update/')).toHaveLength(0);
    await user.type(within(dialog).getByRole('textbox', { name: 'Titolo' }), 'Chiusura');
    fireEvent.change(within(dialog).getByLabelText('Inizio'), { target: { value: '2024-03-15T11:00' } });
    fireEvent.change(within(dialog).getByLabelText('Fine'), { target: { value: '2024-03-15T11:30' } });
    await user.click(within(dialog).getByRole('checkbox', { name: 'Alan Turing' }));
    await user.click(within(dialog).getByRole('button', { name: 'Salva sessione' }));
    await waitFor(() => expect(api.lastUpdate()).toBeDefined());
    const added = api.lastUpdate()!.tracks!;
    expect(added).toHaveLength(3);
    expect(added[2]).toMatchObject({ workshopTrackId: '00000000-0000-0000-0000-000000000000', title: 'Chiusura', startTime: '2024-03-15T11:00:00.000Z', endTime: '2024-03-15T11:30:00.000Z', level: 0, speakers: ['speaker-2'], speakersName: 'Alan Turing', image: '' });
    expect(api.lastUpdate()!.title).toBe('Test Workshop');
    expect(await screen.findByText('Sessione aggiunta')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const putIndex = api.calls.findIndex(call => call.url.includes('/Workshop/Update/'));
    expect(api.calls.slice(putIndex).some(call => call.url.includes('/Workshop/Get/w1') && call.method === 'GET')).toBe(true);

    await user.click(within(legacy).getByRole('button', { name: 'Modifica: Intro a Blazor' }));
    dialog = await screen.findByRole('dialog', { name: /Modifica sessione/ });
    expect(within(dialog).getByLabelText('Inizio')).toHaveValue('2024-03-15T09:00');
    expect(within(dialog).getByRole('checkbox', { name: 'Ada Lovelace' })).toBeChecked();
    await user.type(within(dialog).getByRole('textbox', { name: 'Titolo' }), ' WebAssembly');
    await user.click(within(dialog).getByRole('button', { name: 'Salva sessione' }));
    await waitFor(() => expect(api.lastUpdate()!.tracks!.find(track => track.workshopTrackId === 'k2')).toMatchObject({ title: 'Intro a Blazor WebAssembly', speakers: ['speaker-1'], level: 2 }));

    await user.click(within(legacy).getByRole('button', { name: 'Elimina: Registrazione' }));
    await user.click(within(legacy).getByRole('button', { name: 'Elimina' }));
    await waitFor(() => expect(api.lastUpdate()!.tracks!.map(track => track.workshopTrackId)).toEqual(['k2', '00000000-0000-0000-0000-000000000000']));
    expect(await screen.findByText('Sessione eliminata')).toBeInTheDocument();
  });
});

import userEvent from '@testing-library/user-event';
import { adminToasts } from '../toasts';
import { fireEvent, jsonResponse, screen, waitFor, within } from '../../test-utils';
import { eventFixture, serveEvent } from './eventFixtures';
import { renderAt, loaded, registration, createForm, ready } from './eventAgendaFixtures';

beforeEach(() => adminToasts.clear());

describe('event registration', () => {
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
    const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
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
    const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
    const api = serveEvent(eventFixture({ externalRegistration: true, externalRegistrationLink: 'https://old.example.test/signup' }));
    renderAt('#iscrizione');
    await loaded();
    const link = screen.getByRole('textbox', { name: 'URL di prenotazione e cancellazione del posto' });
    expect(link).toHaveValue('https://old.example.test/signup');
    fireEvent.change(link, { target: { value: 'https://booking.example.test/event/1' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Note per i partecipanti' }), { target: { value: 'Bring your laptop' } });
    await user.click(screen.getByRole('button', { name: 'Salva iscrizione e agenda' }));
    await waitFor(() => expect(api.lastUpdate()).toMatchObject({ bookingServiceUrl: 'https://booking.example.test/event/1', externalRegistration: true, externalRegistrationLink: 'https://booking.example.test/event/1', attendeeNotes: 'Bring your laptop' }));
  });

  test('refreshes Eventbrite inventory, displays aggregate counts only and raises the capacity floor to sold plus pending', async () => {
    const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
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
    await user.click(screen.getByRole('button', { name: 'Aggiorna le vendite live dei biglietti' }));
    expect(await screen.findByText(/^Biglietti Eventbrite — venduti: 12, in sospeso: 2, capienza totale: 40, rimanenti: 26\. Aggiornato /)).toBeInTheDocument();
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
    const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
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
    const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
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
    const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
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
    const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
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
    const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
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
    const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
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
    const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
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
    const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
    serveEvent(ready(), { '/Eventbrite/Sync/': () => jsonResponse({ title: 'Eventbrite synchronization failed', detail: 'Eventbrite rejected the venue' }, 502) });
    renderAt('#iscrizione');
    await loaded();
    await user.click(screen.getByRole('button', { name: 'Crea bozza Eventbrite' }));
    expect(await screen.findByText('Eventbrite rejected the venue')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Crea bozza Eventbrite' })).toBeEnabled();
  });

  test('words a failed agenda save as the previous reportError: the body as it came, else the fallback with the status', async () => {
    const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
    let answer = () => new Response('', { status: 500 });
    serveEvent(eventFixture(), { '/Workshop/Update/': () => answer() });
    renderAt('#iscrizione');
    await loaded();
    await user.click(screen.getByRole('button', { name: 'Salva iscrizione e agenda' }));
    expect(await screen.findByText("Impossibile salvare l'agenda dell'evento (HTTP 500)")).toBeInTheDocument();
    answer = () => new Response('Workshop locked by another editor', { status: 409, headers: { 'Content-Type': 'text/plain' } });
    await user.click(screen.getByRole('button', { name: 'Salva iscrizione e agenda' }));
    expect(await screen.findByText('Workshop locked by another editor')).toBeInTheDocument();
  });

  test('words failed Eventbrite calls with their own fallbacks', async () => {
    const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
    serveEvent({ ...ready(), eventbriteEventId: 'event-1', eventbriteTicketCapacity: 50, eventbriteSyncedTicketCapacity: 40 }, {
      '/Eventbrite/TicketSales/': () => new Response(null, { status: 502 }),
      '/Eventbrite/SetTicketCapacity/': () => new Response(null, { status: 400 }),
      '/Eventbrite/Publish/': () => new Response(null, { status: 503 }),
    });
    renderAt('#iscrizione');
    await loaded();
    await user.click(screen.getByRole('button', { name: 'Aggiorna le vendite live dei biglietti' }));
    expect(await screen.findByText('Impossibile aggiornare le vendite dei biglietti Eventbrite (HTTP 502)')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Salva capienza biglietti' }));
    expect(await screen.findByText('Impossibile aggiornare la disponibilità dei biglietti Eventbrite (HTTP 400)')).toBeInTheDocument();
    await user.click(within(registration()).getByRole('button', { name: 'Pubblica su Eventbrite' }));
    await user.click(within(registration()).getByRole('button', { name: 'OK' }));
    expect(await screen.findByText('Pubblicazione su Eventbrite non riuscita (HTTP 503)')).toBeInTheDocument();
  });
});

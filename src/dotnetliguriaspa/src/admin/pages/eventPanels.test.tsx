import React from 'react';
import { Route, Routes } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { fireEvent, jsonResponse, render, screen, waitFor, within } from '../../test-utils';
import { AdminToastRegion, adminToasts } from '../toasts';
import { resetPhotoCache } from '../adminApi';
import { contentUrl } from '../../site/siteApi';
import EventDetailAdminPage from './EventDetailAdminPage';
import { eventFixture, serveEvent } from './eventFixtures';

const renderAt = (route: string) => render(
  <>
    <Routes><Route path="/admin/workshop/:id" element={<EventDetailAdminPage />} /></Routes>
    <AdminToastRegion />
  </>,
  { route },
);
const region = (name: string) => screen.getByRole('region', { name });
const files = [
  { workshopFileId: 'f1', workshopId: 'w1', title: 'Slide Blazor', fileName: 'a1.pdf', fullPath: '/workshops/w001/tracks/a1.pdf', fileType: 4 },
  { workshopFileId: 'f2', workshopId: 'w1', title: 'Sala piena', fileName: 'p1.jpg', fullPath: '/workshops/w001/photos/p1.jpg', fileType: 2 },
];
const ready = () => eventFixture({
  eventbriteTicketCapacity: 25,
  agendaTracks: [{ workshopAgendaTrackId: 'track-1', name: 'Main', order: 0 }],
  agendaItems: [{ workshopAgendaItemId: 'item-1', itemType: 'service', trackId: 'track-1', startTime: '2024-03-15T09:00:00Z', endTime: '2024-03-15T10:00:00Z' }],
});

beforeEach(() => { adminToasts.clear(); resetPhotoCache(); });

describe('Materiali e foto', () => {
  test('lists materials and photos from the file endpoint, uploads as multipart and deletes after confirmation', async () => {
    const user = userEvent.setup();
    const api = serveEvent(eventFixture(), {}, { files });
    renderAt('/admin/workshop/w1#materiali');
    const materials = await screen.findByRole('region', { name: 'Slide e materiali' });
    expect(within(materials).getByText('Slide Blazor')).toBeInTheDocument();
    expect(within(materials).getByRole('link', { name: /Apri Slide Blazor/ })).toHaveAttribute('href', contentUrl('/workshops/w001/tracks/a1.pdf'));
    const photos = region("Foto dell'evento");
    expect(within(photos).getByRole('img', { name: 'Sala piena' })).toHaveAttribute('src', contentUrl('/workshops/w001/photos/p1.jpg'));
    expect(api.to('/workshopfile/w1', 'GET')).toHaveLength(1);

    await user.type(within(materials).getByRole('textbox', { name: 'Titolo del materiale' }), 'Demo .NET Aspire');
    const input = materials.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['%PDF'], 'aspire.pdf', { type: 'application/pdf' }), new File(['x'], 'notes.txt', { type: 'text/plain' })] } });
    await waitFor(() => expect(api.to('/workshopfile/Upload', 'POST')).toHaveLength(1));
    const form = api.to('/workshopfile/Upload')[0].form!;
    expect(form.get('workshopId')).toBe('w1');
    expect(form.get('fileType')).toBe('4');
    expect(form.get('title')).toBe('Demo .NET Aspire');
    expect((form.get('file') as File).name).toBe('aspire.pdf');
    expect(await screen.findByText('1 file caricato')).toBeInTheDocument();
    expect(screen.getByText('Non caricati: notes.txt: formato non ammesso.')).toBeInTheDocument();
    await waitFor(() => expect(api.to('/workshopfile/w1', 'GET')).toHaveLength(2));
    expect(within(materials).getByRole('textbox', { name: 'Titolo del materiale' })).toHaveValue('');

    const photoInput = photos.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(photoInput, { target: { files: [new File(['img'], 'gruppo.jpg', { type: 'image/jpeg' })] } });
    await waitFor(() => expect(api.to('/workshopfile/Upload', 'POST')).toHaveLength(2));
    expect(api.to('/workshopfile/Upload')[1].form!.get('fileType')).toBe('2');
    expect(await screen.findByText('1 foto caricata')).toBeInTheDocument();

    await user.click(within(materials).getByRole('button', { name: 'Elimina: Slide Blazor' }));
    expect(within(materials).getByRole('alert')).toHaveTextContent('Eliminare «Slide Blazor»?');
    expect(api.to('/workshopfile/f1', 'DELETE')).toHaveLength(0);
    await user.click(within(materials).getByRole('button', { name: 'Elimina' }));
    await waitFor(() => expect(api.to('/workshopfile/f1', 'DELETE')).toHaveLength(1));
    await waitFor(() => expect(within(materials).queryByText('Slide Blazor')).not.toBeInTheDocument());
    expect(await screen.findByText('File eliminato')).toBeInTheDocument();

    await user.click(within(photos).getByRole('button', { name: 'Elimina: Sala piena' }));
    await user.click(within(photos).getByRole('button', { name: 'Annulla' }));
    expect(api.to('/workshopfile/f2', 'DELETE')).toHaveLength(0);
    expect(within(photos).getByRole('img', { name: 'Sala piena' })).toBeInTheDocument();
  });

  test('reports a failed file load with a retry', async () => {
    const user = userEvent.setup();
    let attempts = 0;
    serveEvent(eventFixture(), { '/workshopfile/w1': () => (++attempts === 1 ? jsonResponse({}, 500) : jsonResponse(files)) });
    renderAt('/admin/workshop/w1#materiali');
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Materiali e foto non sono disponibili (Errore HTTP: 500).');
    await user.click(within(alert).getByRole('button', { name: 'Riprova' }));
    expect(await screen.findByText('Slide Blazor')).toBeInTheDocument();
  });
});

describe('Pubblicazione', () => {
  test('shows the readiness checklist and saves each visibility switch at once', async () => {
    const user = userEvent.setup();
    const api = serveEvent(eventFixture({ description: '', image: '', bookingServiceUrl: '', eventDate: '2099-06-12T10:00:00Z' }));
    renderAt('/admin/workshop/w1#pubblicazione');
    const checklist = await screen.findByRole('region', { name: 'Pronto per il sito?' });
    expect(within(checklist).getByText('Manca la descrizione: compare nella scheda e nella home.')).toBeInTheDocument();
    expect(within(checklist).getByRole('link', { name: 'Scrivi' })).toHaveAttribute('href', '/admin/workshop/w1#panoramica');
    expect(within(checklist).getByRole('link', { name: "Prepara l'agenda" })).toHaveAttribute('href', '/admin/workshop/w1#agenda');
    expect(within(checklist).getByText('Manca il link di prenotazione.')).toBeInTheDocument();
    expect(within(checklist).getAllByText('Da fare:')).toHaveLength(4);

    const visibility = region('Visibilità');
    expect(within(visibility).getByRole('switch', { name: 'Pubblicato' })).toBeChecked();
    await user.click(within(visibility).getByRole('switch', { name: 'Pubblicato' }));
    await waitFor(() => expect(api.lastUpdate()).toMatchObject({ published: false, in_homepage: false, title: 'Test Workshop' }));
    expect(await screen.findByText('Evento in bozza')).toBeInTheDocument();
    await user.click(within(visibility).getByRole('switch', { name: 'In evidenza nella home' }));
    await waitFor(() => expect(api.lastUpdate()).toMatchObject({ published: false, in_homepage: true }));
  });

  test('reverts a visibility switch when the save fails', async () => {
    const user = userEvent.setup();
    serveEvent(eventFixture(), {}, { failUpdate: new Response(null, { status: 500 }) });
    renderAt('/admin/workshop/w1#pubblicazione');
    const visibility = await screen.findByRole('region', { name: 'Visibilità' });
    await user.click(within(visibility).getByRole('switch', { name: 'Feedback aperto' }));
    expect(await screen.findByText('Modifica non riuscita')).toBeInTheDocument();
    expect(within(visibility).getByRole('switch', { name: 'Feedback aperto' })).not.toBeChecked();
  });

  test('saves an initial Eventbrite ticket quantity and sales window separately from venue spaces', async () => {
    const user = userEvent.setup();
    const api = serveEvent(eventFixture({ location: { name: 'Community Hall', coordinates: '', address: '1 Main Street', maximumSpaces: 120 } }));
    renderAt('/admin/workshop/w1#pubblicazione');
    const eventbrite = await screen.findByRole('region', { name: 'Eventbrite' });
    expect(within(eventbrite).getByText('Non creato')).toBeInTheDocument();
    expect(within(eventbrite).getByText('Un numero positivo di biglietti gratuiti')).toBeInTheDocument();
    expect(within(eventbrite).getByRole('button', { name: 'Crea la bozza su Eventbrite' })).toBeDisabled();
    await user.click(within(eventbrite).getByRole('button', { name: 'Modifica: Eventbrite' }));
    const capacity = within(eventbrite).getByRole('spinbutton', { name: 'Biglietti gratuiti disponibili' });
    await user.clear(capacity);
    await user.type(capacity, '35');
    fireEvent.change(within(eventbrite).getByLabelText('Inizio vendite'), { target: { value: '2024-03-14T18:00' } });
    fireEvent.change(within(eventbrite).getByLabelText('Fine vendite'), { target: { value: '2024-03-01T09:00' } });
    await user.click(within(eventbrite).getByRole('button', { name: 'Salva' }));
    expect(await within(eventbrite).findByRole('alert')).toHaveTextContent('La vendita dei biglietti deve finire dopo il suo inizio.');
    expect(api.to('/Workshop/Update/')).toHaveLength(0);
    fireEvent.change(within(eventbrite).getByLabelText('Inizio vendite'), { target: { value: '2024-03-01T09:00' } });
    fireEvent.change(within(eventbrite).getByLabelText('Fine vendite'), { target: { value: '2024-03-14T18:00' } });
    await user.click(within(eventbrite).getByRole('button', { name: 'Salva' }));

    await waitFor(() => expect(api.lastUpdate()).toBeDefined());
    const body = api.lastUpdate()!;
    expect(body.eventbriteTicketCapacity).toBe(35);
    expect(body.eventbriteSalesStart).toBe('2024-03-01T09:00');
    expect(body.eventbriteSalesEnd).toBe('2024-03-14T18:00');
    expect(body.location!.maximumSpaces).toBe(120);
    expect(await within(eventbrite).findByText('35')).toBeInTheDocument();
  });

  test('refreshes Eventbrite inventory and displays aggregate counts only', async () => {
    const user = userEvent.setup();
    const api = serveEvent(eventFixture({ eventbriteEventId: 'event-1', eventbriteEventUrl: 'https://www.eventbrite.it/e/1', eventbriteTicketCapacity: 40, eventbriteSyncedTicketCapacity: 40, eventbriteSyncStatus: 'synced' }), {
      '/Eventbrite/TicketSales/': { totalCapacity: 40, sold: 12, pending: 2, remaining: 26, refreshedAt: '2026-10-11T10:00:00Z' },
    });
    renderAt('/admin/workshop/w1#pubblicazione');
    const eventbrite = await screen.findByRole('region', { name: 'Eventbrite' });
    expect(within(eventbrite).getByText('Bozza sincronizzata')).toBeInTheDocument();
    expect(within(eventbrite).getByText('40 (sincronizzati: 40)')).toBeInTheDocument();
    expect(within(eventbrite).getByRole('link', { name: /Apri su Eventbrite/ })).toHaveAttribute('href', 'https://www.eventbrite.it/e/1');
    expect(within(eventbrite).queryByRole('button', { name: /Applica la capienza/ })).not.toBeInTheDocument();
    await user.click(within(eventbrite).getByRole('button', { name: 'Aggiorna le vendite' }));
    expect(await within(eventbrite).findByText(/Venduti 12, in sospeso 2, capienza 40, disponibili 26\./)).toBeInTheDocument();
    expect(api.to('/Eventbrite/TicketSales/w1', 'GET')).toHaveLength(1);
  });

  test('applies a higher ticket capacity through the dedicated endpoint', async () => {
    const user = userEvent.setup();
    const record = eventFixture({ eventbriteEventId: 'event-1', eventbriteTicketCapacity: 50, eventbriteSyncedTicketCapacity: 40, eventbriteSyncStatus: 'synced' });
    const api = serveEvent(record, { '/Eventbrite/SetTicketCapacity/': () => jsonResponse({ ...record, eventbriteSyncStatus: 'update-pending' }) });
    renderAt('/admin/workshop/w1#pubblicazione');
    const eventbrite = await screen.findByRole('region', { name: 'Eventbrite' });
    await user.click(within(eventbrite).getByRole('button', { name: 'Applica la capienza su Eventbrite' }));
    await waitFor(() => expect(api.to('/Eventbrite/SetTicketCapacity/w1', 'PUT')).toHaveLength(1));
    expect(api.to('/Eventbrite/SetTicketCapacity/w1')[0].body).toEqual({ capacity: 50 });
    expect(await screen.findByText('Capienza salvata')).toBeInTheDocument();
    expect(within(eventbrite).getByText('Da sincronizzare')).toBeInTheDocument();
  });

  test('creates the Eventbrite draft from the saved record, then publishes it after confirmation', async () => {
    const user = userEvent.setup();
    const record = ready();
    const api = serveEvent(record, {
      '/Eventbrite/Sync/': () => jsonResponse({ ...record, eventbriteEventId: 'event-1', eventbriteSyncStatus: 'synced', eventbriteSyncedTicketCapacity: 25 }),
      '/Eventbrite/Publish/': () => { api.store.record = { ...record, eventbriteEventId: 'event-1', eventbriteSyncStatus: 'synced', eventbritePublished: true }; return new Response(null, { status: 204 }); },
    });
    renderAt('/admin/workshop/w1#pubblicazione');
    const eventbrite = await screen.findByRole('region', { name: 'Eventbrite' });
    expect(within(eventbrite).queryByText(/servono:/)).not.toBeInTheDocument();
    await user.click(within(eventbrite).getByRole('button', { name: 'Crea la bozza su Eventbrite' }));
    await waitFor(() => expect(api.to('/Eventbrite/Sync/w1', 'POST')).toHaveLength(1));
    expect(api.to('/Workshop/Update/')).toHaveLength(0);
    expect(await screen.findByText('Evento sincronizzato con Eventbrite')).toBeInTheDocument();
    expect(within(eventbrite).getByRole('button', { name: 'Sincronizza con Eventbrite' })).toBeInTheDocument();

    await user.click(within(eventbrite).getByRole('button', { name: 'Pubblica su Eventbrite…' }));
    expect(api.to('/Eventbrite/Publish/')).toHaveLength(0);
    expect(within(eventbrite).getByRole('alert')).toHaveTextContent("Pubblicare l'evento su Eventbrite?");
    await user.click(within(eventbrite).getByRole('button', { name: 'Pubblica' }));
    await waitFor(() => expect(api.to('/Eventbrite/Publish/w1', 'POST')).toHaveLength(1));
    expect(await within(eventbrite).findByText('Pubblicato su Eventbrite')).toBeInTheDocument();
    expect(within(eventbrite).getByText('Pubblicato')).toBeInTheDocument();
    await waitFor(() => expect(within(eventbrite).queryByRole('button', { name: /Pubblica su Eventbrite/ })).not.toBeInTheDocument());
  });

  test('shows the server detail when an Eventbrite action fails', async () => {
    const user = userEvent.setup();
    serveEvent(ready(), { '/Eventbrite/Sync/': () => jsonResponse({ title: 'Eventbrite synchronization failed', detail: 'Eventbrite rejected the venue' }, 502) });
    renderAt('/admin/workshop/w1#pubblicazione');
    const eventbrite = await screen.findByRole('region', { name: 'Eventbrite' });
    await user.click(within(eventbrite).getByRole('button', { name: 'Crea la bozza su Eventbrite' }));
    expect(await screen.findByText('Sincronizzazione con Eventbrite non riuscita')).toBeInTheDocument();
    expect(screen.getByText('Eventbrite rejected the venue')).toBeInTheDocument();
    expect(within(eventbrite).getByRole('button', { name: 'Crea la bozza su Eventbrite' })).toBeEnabled();
  });
});

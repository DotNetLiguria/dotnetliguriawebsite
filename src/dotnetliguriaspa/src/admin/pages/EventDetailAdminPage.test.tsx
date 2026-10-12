import React from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { fireEvent, jsonResponse, render, screen, waitFor, within } from '../../test-utils';
import { AdminToastRegion, adminToasts } from '../toasts';
import { resetPhotoCache } from '../adminApi';
import EventDetailAdminPage from './EventDetailAdminPage';
import { eventFixture, serveEvent } from './eventFixtures';

const CurrentPath = () => { const { pathname, hash } = useLocation(); return <span data-testid="current-path">{pathname}{hash}</span>; };

const renderAt = (route: string) => render(
  <>
    <Routes>
      <Route path="/admin/workshop/:id" element={<EventDetailAdminPage />} />
      <Route path="/admin/questionnaires/:id/edit" element={<div>Editor aperto</div>} />
    </Routes>
    <AdminToastRegion />
    <CurrentPath />
  </>,
  { route },
);
const card = (title: string) => screen.getByRole('region', { name: title });
const localDay = (iso: string) => { const d = new Date(iso); return [d.getFullYear(), d.getMonth() + 1, d.getDate()]; };

beforeEach(() => { adminToasts.clear(); resetPhotoCache(); });

describe('<EventDetailAdminPage /> header and tabs', () => {
  test('shows blank poster placeholders when the event has no image', async () => {
    serveEvent(eventFixture({ image: '' }));
    renderAt('/admin/workshop/w1');

    await screen.findByRole('heading', { level: 1, name: 'Test Workshop' });
    expect(screen.getAllByRole('img', { name: 'Immagine non disponibile' })).toHaveLength(2);
  });

  test('replaces a broken poster with the blank placeholder', async () => {
    serveEvent(eventFixture());
    renderAt('/admin/workshop/w1');

    await screen.findByRole('heading', { level: 1, name: 'Test Workshop' });
    fireEvent.error(screen.getByAltText('Locandina di Test Workshop'));
    expect(screen.getByRole('img', { name: 'Immagine non disponibile' })).toBeInTheDocument();
  });

  test('shows the event with its badges, the public link and the section from the hash', async () => {
    const user = userEvent.setup();
    serveEvent(eventFixture({ published: false, in_homepage: true, eventDate: '2099-06-12T10:00:00Z', agendaTracks: [{ workshopAgendaTrackId: 't1', name: 'Main', order: 0 }], talks: [{ workshopTalkId: 'k1', title: 'Keynote', sessionType: 'talk', trackId: 't1', speakers: [] }], agendaItems: [{ workshopAgendaItemId: 'i1', itemType: 'talk', talkId: 'k1', trackId: 't1', startTime: '2099-06-12T14:00:00Z', endTime: '2099-06-12T15:00:00Z' }] }));
    renderAt('/admin/workshop/w1#pubblicazione');
    expect(await screen.findByRole('heading', { level: 1, name: 'Test Workshop' })).toBeInTheDocument();
    expect(screen.getByText('In programma')).toBeInTheDocument();
    expect(screen.getByText('In evidenza')).toBeInTheDocument();
    expect(screen.getByText('Bozza')).toBeInTheDocument();
    expect(screen.getByText('14:00–15:00')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Vedi sul sito/ })).toHaveAttribute('href', '/workshop/w1');
    expect(screen.getByRole('link', { name: 'Eventi' })).toHaveAttribute('href', '/admin/workshops/');
    expect(screen.getByRole('link', { name: '6. Pubblicazione, da completare' })).toHaveAttribute('aria-current', 'step');
    expect(screen.getByRole('heading', { level: 2, name: /Pubblicazione$/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Pronto per il sito?' })).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: '2. Agenda, completato' }));
    expect(screen.getByTestId('current-path')).toHaveTextContent('/admin/workshop/w1#agenda');
    expect(screen.getByRole('heading', { name: 'Programma' })).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: /^1\. Informazioni/ }));
    expect(screen.getByTestId('current-path')).toHaveTextContent('/admin/workshop/w1#panoramica');
    expect(card('Descrizione')).toBeInTheDocument();
  });

  test('numbers the steps with their state, keeps every step reachable and never flags the optional ones', async () => {
    const user = userEvent.setup();
    serveEvent(eventFixture({ description: '', tracks: [
      { workshopTrackId: 'k1', title: 'Registrazione', startTime: '2024-03-15T08:30:00Z', endTime: '2024-03-15T09:00:00Z', speakersName: '' },
      { workshopTrackId: 'k2', title: 'Keynote', startTime: '2024-03-15T09:00:00Z', endTime: '2024-03-15T10:00:00Z', speakersName: 'Ada Lovelace' },
    ] }));
    renderAt('/admin/workshop/w1');
    const nav = await screen.findByRole('navigation', { name: "Passaggi dell'evento" });
    const names = within(nav).getAllByRole('link').map(link => link.getAttribute('aria-current') ? `${link.textContent}*` : link.textContent);
    expect(within(nav).getAllByRole('link').map(link => link.getAttribute('href'))).toEqual(['/admin/workshop/w1#panoramica', '/admin/workshop/w1#agenda', '/admin/workshop/w1#relatori', '/admin/workshop/w1#materiali', '/admin/workshop/w1#questionario', '/admin/workshop/w1#pubblicazione']);
    expect(names).toHaveLength(6);
    expect(within(nav).getByRole('link', { name: '1. Informazioni, da completare' })).toHaveAttribute('aria-current', 'step');
    expect(within(nav).getByRole('link', { name: '2. Agenda, completato' })).toHaveTextContent('1 sessione');
    expect(within(nav).getByRole('link', { name: '3. Relatori, completato' })).toHaveTextContent('1 relatore');
    expect(within(nav).getByRole('link', { name: '4. Materiali e foto, facoltativo' })).toHaveTextContent('Facoltativo');
    expect(within(nav).getByRole('link', { name: '5. Questionario, facoltativo' })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: '6. Pubblicazione, completato' })).not.toHaveAttribute('aria-current');
    expect(within(nav).queryByText(/da fare/i)).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /Informazioni$/ })).toBeInTheDocument();

    await user.click(within(nav).getByRole('link', { name: '5. Questionario, facoltativo' }));
    expect(screen.getByTestId('current-path')).toHaveTextContent('#questionario');
    expect(within(nav).getByRole('link', { name: '5. Questionario, facoltativo' })).toHaveAttribute('aria-current', 'step');
    expect(within(nav).getByRole('link', { name: '1. Informazioni, da completare' })).not.toHaveAttribute('aria-current');
  });

  test('Avanti and Indietro walk the steps and move focus to the step heading', async () => {
    const user = userEvent.setup();
    serveEvent(eventFixture());
    renderAt('/admin/workshop/w1');
    await screen.findByRole('heading', { level: 1, name: 'Test Workshop' });
    expect(screen.queryByRole('button', { name: /^Indietro/ })).not.toBeInTheDocument();
    const forward = screen.getByRole('button', { name: 'Avanti: Agenda' });
    expect(forward).toHaveClass('bg-site-green');
    await user.click(forward);
    expect(screen.getByTestId('current-path')).toHaveTextContent('#agenda');
    const agendaHeading = screen.getByRole('heading', { level: 2, name: /Agenda$/ });
    expect(agendaHeading).toHaveFocus();
    // The agenda has its own primary actions: "Avanti" steps back to a secondary button.
    expect(screen.getByRole('button', { name: 'Avanti: Relatori' })).not.toHaveClass('bg-site-green');
    await user.click(screen.getByRole('button', { name: /^Indietro/ }));
    expect(screen.getByTestId('current-path')).toHaveTextContent('#panoramica');
    expect(screen.getByRole('heading', { level: 2, name: /Informazioni$/ })).toHaveFocus();

    await user.click(screen.getByRole('link', { name: /^6\. Pubblicazione/ }));
    expect(screen.queryByRole('button', { name: /^Avanti/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Indietro: Questionario' })).toBeInTheDocument();
  });

  test('on phones shows a compact header with a progress bar and the steps in a menu, without the step row', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    const user = userEvent.setup();
    serveEvent(eventFixture());
    renderAt('/admin/workshop/w1#agenda');
    const nav = await screen.findByRole('navigation', { name: "Passaggi dell'evento" });
    expect(nav).toHaveTextContent('Passo 2 di 6 · Agenda');
    expect(within(nav).getByRole('progressbar', { name: 'Passo 2 di 6' })).toHaveAttribute('aria-valuenow', '2');
    expect(within(nav).queryByRole('link')).not.toBeInTheDocument();
    await user.click(within(nav).getByRole('button', { name: 'Tutti i passaggi' }));
    const menu = await screen.findByRole('menu');
    expect(within(menu).getAllByRole('menuitem')).toHaveLength(6);
    expect(within(menu).getByRole('menuitem', { name: '2. Agenda, da completare, passo attuale' })).toHaveTextContent('Nessuna sessione · passo attuale');
    expect(within(menu).getByRole('menuitem', { name: '4. Materiali e foto, facoltativo' })).toBeInTheDocument();
    await user.click(within(menu).getByRole('menuitem', { name: /6\. Pubblicazione/ }));
    expect(screen.getByTestId('current-path')).toHaveTextContent('#pubblicazione');
    expect(screen.getByRole('navigation', { name: "Passaggi dell'evento" })).toHaveTextContent('Passo 6 di 6 · Pubblicazione');
  });

  test('publishes and features the event from the header menu with the whole record', async () => {
    const user = userEvent.setup();
    const api = serveEvent(eventFixture({ published: false }));
    renderAt('/admin/workshop/w1');
    await screen.findByRole('heading', { level: 1, name: 'Test Workshop' });
    await user.click(screen.getByRole('button', { name: 'Altre azioni' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Pubblica sul sito' }));
    await waitFor(() => expect(api.lastUpdate()).toMatchObject({ published: true, title: 'Test Workshop', location: { name: 'Genova' } }));
    expect(await screen.findByText('Evento pubblicato')).toBeInTheDocument();
    expect(screen.queryByText('Bozza')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Altre azioni' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Metti in evidenza' }));
    await waitFor(() => expect(api.lastUpdate()?.in_homepage).toBe(true));
    expect(await screen.findByText('In evidenza')).toBeInTheDocument();
  });

  test('reports a failed load with a retry and a missing event as not found', async () => {
    const user = userEvent.setup();
    let attempts = 0;
    serveEvent(eventFixture(), { '/Workshop/Get/': () => (++attempts === 1 ? jsonResponse({ detail: 'Mongo down' }, 500) : jsonResponse(eventFixture())) });
    renderAt('/admin/workshop/w1');
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent("L'evento non è disponibile (Mongo down).");
    await user.click(within(alert).getByRole('button', { name: 'Riprova' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Test Workshop' })).toBeInTheDocument();

    serveEvent(eventFixture(), { '/Workshop/Get/': () => new Response(null, { status: 404 }) });
    renderAt('/admin/workshop/missing');
    expect(await screen.findByRole('heading', { name: 'Evento non trovato' })).toBeInTheDocument();
  });
});

describe('<EventDetailAdminPage /> Panoramica', () => {
  test('edits the description card and sends the whole record, keeping the date and the location', async () => {
    const user = userEvent.setup();
    const api = serveEvent(eventFixture({ blogHtml: '<p>old</p>' }));
    renderAt('/admin/workshop/w1');
    await screen.findByRole('heading', { level: 1, name: 'Test Workshop' });
    await user.click(within(card('Descrizione')).getByRole('button', { name: 'Modifica: Descrizione' }));
    const title = within(card('Descrizione')).getByRole('textbox', { name: 'Titolo' });
    await user.clear(title);
    await user.type(title, 'Updated title');
    await user.clear(within(card('Descrizione')).getByRole('textbox', { name: 'Descrizione' }));
    await user.type(within(card('Descrizione')).getByRole('textbox', { name: 'Descrizione' }), 'Updated description');
    await user.type(within(card('Descrizione')).getByRole('textbox', { name: 'Tag' }), 'ai, web');
    await user.click(within(card('Descrizione')).getByRole('button', { name: 'Salva' }));

    await waitFor(() => expect(api.lastUpdate()).toBeDefined());
    const body = api.lastUpdate()!;
    expect(body).toMatchObject({ title: 'Updated title', description: 'Updated description', tags: 'ai, web', blogHtml: '<p>old</p>', published: true, location: { name: 'Genova', maximumSpaces: 150 } });
    expect(localDay(body.eventDate)).toEqual([2024, 3, 15]);
    expect(api.to('/Workshop/Update/')[0].method).toBe('PUT');
    expect(await screen.findByText('Evento aggiornato')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Updated title' })).toBeInTheDocument();
    expect(within(card('Descrizione')).queryByRole('textbox')).not.toBeInTheDocument();
    expect(within(card('Descrizione')).getByText('ai')).toBeInTheDocument();
    expect(within(card('Descrizione')).getByRole('button', { name: 'Modifica: Descrizione' })).toHaveFocus();
  });

  test('keeps the card open and explains when the save fails', async () => {
    const user = userEvent.setup();
    serveEvent(eventFixture(), {}, { failUpdate: jsonResponse({ detail: 'Eventbrite ticket capacity cannot be reduced' }, 400) });
    renderAt('/admin/workshop/w1');
    await screen.findByRole('heading', { level: 1, name: 'Test Workshop' });
    await user.click(screen.getByRole('button', { name: 'Modifica: Note per chi partecipa' }));
    await user.type(within(card('Note per chi partecipa')).getByRole('textbox', { name: 'Note' }), 'Portare il portatile');
    await user.click(within(card('Note per chi partecipa')).getByRole('button', { name: 'Salva' }));
    expect(await screen.findByText('Salvataggio non riuscito')).toBeInTheDocument();
    expect(screen.getByText('Eventbrite ticket capacity cannot be reduced')).toBeInTheDocument();
    expect(within(card('Note per chi partecipa')).getByRole('textbox', { name: 'Note' })).toHaveValue('Portare il portatile');
  });

  test('copies a saved venue into the date and venue card, keeps the fields editable and saves rooms and date', async () => {
    const user = userEvent.setup();
    const api = serveEvent(eventFixture());
    renderAt('/admin/workshop/w1');
    await screen.findByRole('heading', { level: 1, name: 'Test Workshop' });
    expect(within(card('Data e sede')).getByText('Via del Porto 1')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Modifica: Data e sede' }));
    const form = card('Data e sede');
    await user.click(within(form).getByRole('button', { name: /Copia da una sede salvata/ }));
    await user.click(await screen.findByRole('option', { name: /Community Hall/ }));
    expect(within(form).getByRole('textbox', { name: 'Nome della sede' })).toHaveValue('Community Hall');
    expect(within(form).getByRole('textbox', { name: 'Indirizzo' })).toHaveValue('1 Main Street');
    expect(within(form).getByRole('textbox', { name: 'Coordinate' })).toHaveValue('44.4,8.9');
    expect(within(form).getByRole('textbox', { name: 'Link a Google Maps' })).toHaveValue('https://maps.google.com/?q=Community+Hall');
    expect(within(form).getByRole('spinbutton', { name: 'Posti disponibili' })).toHaveValue(120);
    await user.clear(within(form).getByRole('textbox', { name: 'Nome della sede' }));
    await user.type(within(form).getByRole('textbox', { name: 'Nome della sede' }), 'Updated Hall');
    await user.clear(within(form).getByRole('spinbutton', { name: 'Posti disponibili' }));
    await user.type(within(form).getByRole('spinbutton', { name: 'Posti disponibili' }), '150');
    await user.type(within(form).getByRole('textbox', { name: 'Sale' }), 'Auditorium{enter}Room B');
    fireEvent.change(within(form).getByLabelText('Data *'), { target: { value: '2027-06-21' } });
    await user.click(within(form).getByRole('button', { name: 'Salva' }));

    await waitFor(() => expect(api.lastUpdate()).toBeDefined());
    const body = api.lastUpdate()!;
    expect(body.location).toEqual({ name: 'Updated Hall', address: '1 Main Street', coordinates: '44.4,8.9', googleMapsUrl: 'https://maps.google.com/?q=Community+Hall', maximumSpaces: 150, rooms: ['Auditorium', 'Room B'] });
    expect(localDay(body.eventDate)).toEqual([2027, 6, 21]);
    expect(body.title).toBe('Test Workshop');
    expect(await within(card('Data e sede')).findByText('Updated Hall')).toBeInTheDocument();
    expect(within(card('Data e sede')).getByText('Auditorium, Room B')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 }).parentElement).toHaveTextContent('Updated Hall');
  });

  test('saves the booking link with the legacy registration pair and the attendee notes', async () => {
    const user = userEvent.setup();
    const api = serveEvent(eventFixture({ externalRegistration: true, externalRegistrationLink: 'https://old.example.test/signup' }));
    renderAt('/admin/workshop/w1');
    await screen.findByRole('heading', { level: 1, name: 'Test Workshop' });
    expect(within(card('Iscrizione')).getByRole('link', { name: /old\.example\.test/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Modifica: Iscrizione' }));
    const link = within(card('Iscrizione')).getByRole('textbox', { name: 'Link di prenotazione' });
    expect(link).toHaveValue('https://old.example.test/signup');
    await user.clear(link);
    await user.type(link, 'https://booking.example.test/event/1');
    await user.click(within(card('Iscrizione')).getByRole('button', { name: 'Salva' }));
    await waitFor(() => expect(api.lastUpdate()).toMatchObject({ bookingServiceUrl: 'https://booking.example.test/event/1', externalRegistration: true, externalRegistrationLink: 'https://booking.example.test/event/1' }));

    await user.click(await screen.findByRole('button', { name: 'Modifica: Note per chi partecipa' }));
    await user.type(within(card('Note per chi partecipa')).getByRole('textbox', { name: 'Note' }), 'Bring your laptop');
    await user.click(within(card('Note per chi partecipa')).getByRole('button', { name: 'Salva' }));
    await waitFor(() => expect(api.lastUpdate()).toMatchObject({ attendeeNotes: 'Bring your laptop', bookingServiceUrl: 'https://booking.example.test/event/1' }));
    expect(await screen.findByText('Bring your laptop')).toBeInTheDocument();
  });

  test('uploads the poster as multipart data and reloads the event', async () => {
    const api = serveEvent(eventFixture());
    renderAt('/admin/workshop/w1');
    await screen.findByRole('heading', { level: 1, name: 'Test Workshop' });
    const input = card('Locandina').querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['x'], 'virus.exe', { type: 'application/octet-stream' })] } });
    expect(await screen.findByText('Formato non ammesso')).toBeInTheDocument();
    expect(api.to('/workshopfile/uploadworkshopimage')).toHaveLength(0);

    fireEvent.change(input, { target: { files: [new File(['img'], 'poster.png', { type: 'image/png' })] } });
    await waitFor(() => expect(api.to('/workshopfile/uploadworkshopimage', 'POST')).toHaveLength(1));
    const form = api.to('/workshopfile/uploadworkshopimage')[0].form!;
    expect(form.get('workshopId')).toBe('w1');
    expect((form.get('file') as File).name).toBe('poster.png');
    expect(await screen.findByText('Locandina aggiornata')).toBeInTheDocument();
    expect(api.to('/Workshop/Get/').length).toBeGreaterThanOrEqual(2);
    expect((within(card('Locandina')).getByRole('img') as HTMLImageElement).src).toMatch(/\/Contents\/workshops\/w001\/workshop\.png\?t=\d+/);
  });
});

describe('<EventDetailAdminPage /> Relatori and Questionario', () => {
  test('lists the speakers of the agenda, linked to their cards, flagging missing photos and records', async () => {
    serveEvent(eventFixture({ talks: [
      { workshopTalkId: 't1', title: 'A', sessionType: 'talk', speakers: [{ workshopSpeakerId: 'speaker-1', name: 'Ada Lovelace' }, { name: 'Grace Hopper' }] },
      { workshopTalkId: 't2', title: 'B', sessionType: 'talk', speakers: [{ workshopSpeakerId: 'speaker-1', name: 'Ada Lovelace' }] },
    ] }), {}, { photosFound: false });
    renderAt('/admin/workshop/w1#relatori');
    const list = await screen.findByRole('list', { name: "Relatori dell'evento" });
    expect(screen.getByRole('link', { name: '3. Relatori, completato' })).toHaveAttribute('aria-current', 'step');
    expect(screen.getByRole('link', { name: '3. Relatori, completato' })).toHaveTextContent('2 relatori');
    expect(within(list).getByRole('link', { name: /Ada Lovelace/ })).toHaveAttribute('href', '/admin/speakers/speaker-1');
    expect(within(list).getByText('2 sessioni in questo evento')).toBeInTheDocument();
    expect(within(list).getByText('Non in anagrafica')).toBeInTheDocument();
    expect(await within(list).findByText('Senza foto')).toBeInTheDocument();
  });

  test('shows the feedback link with its QR code, lists linked questionnaires and creates one from the event', async () => {
    const user = userEvent.setup();
    const questionnaire = { questionnaireId: 'q1', title: 'Feedback Meetup', status: 'Closed', responseCount: 2, sections: [] };
    const api = serveEvent(eventFixture(), {
      '/Questionnaire/by-workshop/': [questionnaire],
      '/Questionnaire': (_url: string, init?: RequestInit) => jsonResponse(init?.method === 'POST' ? { ...questionnaire, questionnaireId: 'new2', title: 'Nuovo feedback' } : []),
    });
    renderAt('/admin/workshop/w1#questionario');
    expect(await screen.findByRole('link', { name: 'Feedback Meetup' })).toHaveAttribute('href', '/admin/questionnaires/q1/edit');
    expect(screen.getByRole('link', { name: '2 risposte' })).toHaveAttribute('href', '/admin/questionnaires/q1/results');
    expect(screen.getByText('Chiuso')).toBeInTheDocument();
    expect(screen.getByText('http://localhost:3000/feedback/w1')).toBeInTheDocument();
    expect(screen.getByTitle('QR code del feedback di Test Workshop')).toBeInTheDocument();
    expect(api.to('/Questionnaire/by-workshop/w1')).toHaveLength(1);

    await user.click(screen.getByRole('switch', { name: 'Feedback aperto' }));
    await waitFor(() => expect(api.lastUpdate()?.feedbackEnabled).toBe(true));

    await user.click(screen.getByRole('button', { name: 'Crea questionario di feedback' }));
    expect(await screen.findByText('Editor aperto')).toBeInTheDocument();
    expect(api.to('/Questionnaire', 'POST')[0].body).toEqual({ template: 'workshopFeedback', workshopId: 'w1' });
  });
});

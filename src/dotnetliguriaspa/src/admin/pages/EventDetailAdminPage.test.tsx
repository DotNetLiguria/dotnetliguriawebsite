import React from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { fireEvent, jsonResponse, render, screen, waitFor, within } from '../../test-utils';
import { AdminToastRegion, adminToasts } from '../toasts';
import EventDetailAdminPage from './EventDetailAdminPage';
import { eventFixture, serveEvent } from './eventFixtures';

const CurrentPath = () => { const { pathname, hash } = useLocation(); return <span data-testid="current-path">{pathname}{hash}</span>; };

const renderAt = (route: string) => render(
  <>
    <Routes>
      <Route path="/admin/workshop/:id" element={<EventDetailAdminPage />} />
      <Route path="/admin/workshops/" element={<div>Elenco eventi</div>} />
      <Route path="/admin/questionnaires/:id/edit" element={<div>Editor aperto</div>} />
    </Routes>
    <AdminToastRegion />
    <CurrentPath />
  </>,
  { route },
);
const loaded = () => screen.findByRole('heading', { level: 1, name: 'Test Workshop' });
const stepHeading = () => screen.getByRole('heading', { level: 2, name: /^\d+\. / });
const steps = () => screen.getByRole('navigation', { name: "Passaggi dell'evento" });
const localDay = (iso: string) => { const d = new Date(iso); return [d.getFullYear(), d.getMonth() + 1, d.getDate()]; };

beforeEach(() => adminToasts.clear());

describe('<EventDetailAdminPage /> wizard', () => {
  test.each([
    ['', '1. Pubblicazione'], ['#pubblicazione', '1. Pubblicazione'], ['#locandina', '2. Locandina'], ['#sede', '4. Sede'],
    ['#sessioni', '5. Sessioni'], ['#agenda', '7. Agenda e orari'], ['#iscrizione', '8. Iscrizione'], ['#foto', '10. Foto'],
    ['#panoramica', '3. Informazioni'], ['#relatori', '6. Elenco talk'], ['#materiali', '9. Materiali'], ['#questionario', '1. Pubblicazione'], ['?tab=agenda', '7. Agenda e orari'],
  ])('opens the step named by the address %s', async (suffix, heading) => {
    serveEvent(eventFixture());
    renderAt(`/admin/workshop/w1${suffix}`);
    await loaded();
    expect(stepHeading()).toHaveTextContent(heading);
  });

  test('shows the event header with its badges and the public link, without one-click publishing', async () => {
    serveEvent(eventFixture({ published: undefined, in_homepage: true, eventDate: '2099-06-12T10:00:00Z', agendaTracks: [{ workshopAgendaTrackId: 't1', name: 'Main', order: 0 }], talks: [{ workshopTalkId: 'k1', title: 'Keynote', sessionType: 'talk', trackId: 't1', speakers: [] }], agendaItems: [{ workshopAgendaItemId: 'i1', itemType: 'talk', talkId: 'k1', trackId: 't1', startTime: '2099-06-12T14:00:00Z', endTime: '2099-06-12T15:00:00Z' }] }));
    renderAt('/admin/workshop/w1');
    await loaded();
    expect(screen.getByText('In programma')).toBeInTheDocument();
    expect(screen.getByText('In evidenza')).toBeInTheDocument();
    expect(screen.getByText('Bozza')).toBeInTheDocument();
    expect(screen.getByText('14:00–15:00')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Vedi sul sito/ })).toHaveAttribute('href', '/workshop/w1');
    expect(screen.getByRole('link', { name: 'Eventi' })).toHaveAttribute('href', '/admin/workshops/');
    expect(screen.queryByRole('button', { name: 'Altre azioni' })).not.toBeInTheDocument();
    expect(steps()).toBeInTheDocument();
    expect(within(steps()).getAllByRole('listitem')).toHaveLength(10);
  });

  test('shows blank poster placeholders when the event has no image', async () => {
    serveEvent(eventFixture({ image: '' }));
    renderAt('/admin/workshop/w1#locandina');
    await loaded();
    expect(screen.getAllByRole('img', { name: 'Immagine non disponibile' })).toHaveLength(2);
  });

  test('replaces a broken poster with the blank placeholder', async () => {
    serveEvent(eventFixture());
    renderAt('/admin/workshop/w1#locandina');
    await loaded();
    fireEvent.error(screen.getByAltText('Locandina di Test Workshop'));
    expect(screen.getByRole('img', { name: 'Immagine non disponibile' })).toBeInTheDocument();
  });

  test('reaches steps with Avanti, keeps reached steps clickable and later ones not, and moves focus to the heading', async () => {
    const user = userEvent.setup();
    serveEvent(eventFixture());
    renderAt('/admin/workshop/w1#informazioni');
    await loaded();
    expect(within(steps()).getByRole('link', { name: '1. Pubblicazione, raggiunto' })).toHaveAttribute('href', '/admin/workshop/w1#pubblicazione');
    expect(within(steps()).getByRole('link', { name: '3. Informazioni, passo attuale' })).toHaveAttribute('aria-current', 'step');
    expect(within(steps()).queryByRole('link', { name: /4\. Sede/ })).not.toBeInTheDocument();
    expect(within(steps()).getByLabelText('4. Sede, non ancora raggiunto')).toBeInTheDocument();
    expect(within(steps()).getByLabelText('10. Foto, non ancora raggiunto')).toBeInTheDocument();

    expect(screen.getByRole('button', { name: 'Avanti: Sede' })).toHaveClass('bg-site-green');
    await user.click(screen.getByRole('button', { name: 'Avanti: Sede' }));
    expect(screen.getByTestId('current-path')).toHaveTextContent('#sede');
    expect(screen.getByRole('heading', { level: 2, name: '4. Sede' })).toHaveFocus();
    expect(within(steps()).getByRole('link', { name: '3. Informazioni, raggiunto' })).toBeInTheDocument();
    expect(within(steps()).queryByRole('link', { name: /5\. Sessioni/ })).not.toBeInTheDocument();

    await user.click(within(steps()).getByRole('link', { name: '1. Pubblicazione, raggiunto' }));
    expect(screen.getByTestId('current-path')).toHaveTextContent('#pubblicazione');
    expect(within(steps()).getByRole('link', { name: '4. Sede, raggiunto' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Indietro/ })).not.toBeInTheDocument();

    await user.click(within(steps()).getByRole('link', { name: '4. Sede, raggiunto' }));
    await user.click(screen.getByRole('button', { name: 'Indietro: Informazioni' }));
    expect(screen.getByTestId('current-path')).toHaveTextContent('#informazioni');
    expect(screen.getByRole('heading', { level: 2, name: '3. Informazioni' })).toHaveFocus();
  });

  test('"Avanti" steps back to a secondary button on the steps that save by themselves; the last step saves', async () => {
    serveEvent(eventFixture());
    const { unmount } = renderAt('/admin/workshop/w1#talk');
    await loaded();
    expect(screen.getByRole('button', { name: 'Avanti: Agenda e orari' })).not.toHaveClass('bg-site-green');
    unmount();
    serveEvent(eventFixture());
    renderAt('/admin/workshop/w1#foto');
    await loaded();
    expect(screen.queryByRole('button', { name: /^Avanti/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Indietro: Materiali' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Salva modifiche' })).toHaveClass('bg-site-green');
  });

  test('keeps the draft of steps 1, 3 and 4 across steps and saves it once, from the latest record, with Salva modifiche', async () => {
    const user = userEvent.setup();
    const api = serveEvent(eventFixture({ tags: 'dotnet', blogHtml: '<p>keep</p>' }));
    renderAt('/admin/workshop/w1');
    await loaded();
    await user.click(screen.getByRole('switch', { name: 'Pubblicato' }));
    expect(screen.getByRole('switch', { name: 'Pubblicato' })).not.toBeChecked();
    expect(screen.getByText('Modifiche non salvate')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Avanti: Locandina' }));
    await user.click(screen.getByRole('button', { name: 'Avanti: Informazioni' }));
    await user.type(screen.getByRole('textbox', { name: 'Titolo' }), ' aggiornato');
    await user.click(screen.getByRole('button', { name: 'Avanti: Sede' }));
    await user.clear(screen.getByRole('textbox', { name: 'Indirizzo' }));
    await user.type(screen.getByRole('textbox', { name: 'Indirizzo' }), 'Via Nuova 2');
    await user.click(within(steps()).getByRole('link', { name: '3. Informazioni, raggiunto' }));
    expect(screen.getByRole('textbox', { name: 'Titolo' })).toHaveValue('Test Workshop aggiornato');
    await user.click(within(steps()).getByRole('link', { name: '1. Pubblicazione, raggiunto' }));
    expect(screen.getByRole('switch', { name: 'Pubblicato' })).not.toBeChecked();
    expect(api.to('/Workshop/Update/')).toHaveLength(0);

    for (let i = 0; i < 9 && !screen.queryByRole('heading', { level: 2, name: '10. Foto' }); i += 1) {
      await user.click(screen.getByRole('button', { name: /^Avanti/ }));
    }
    expect(stepHeading()).toHaveTextContent('10. Foto');
    expect(api.to('/Workshop/Update/')).toHaveLength(0);
    // The wizard's own button (the unsaved-changes notice offers the same save).
    await user.click(within(screen.getByRole('region', { name: '10. Foto' })).getByRole('button', { name: 'Salva modifiche' }));
    await waitFor(() => expect(api.to('/Workshop/Update/w1', 'PUT')).toHaveLength(1));
    const body = api.lastUpdate()!;
    expect(body).toMatchObject({ published: false, in_homepage: false, feedbackEnabled: false, title: 'Test Workshop aggiornato', description: 'Workshop description', tags: 'dotnet', blogHtml: '<p>keep</p>', location: { name: 'Genova', address: 'Via Nuova 2', coordinates: '44.4056,8.9463', maximumSpaces: 150, rooms: [] } });
    expect(localDay(body.eventDate)).toEqual([2024, 3, 15]);
    expect(await screen.findByText('Modifiche salvate')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Test Workshop aggiornato' })).toBeInTheDocument();
    expect(screen.getByText('Bozza')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('Modifiche non salvate')).not.toBeInTheDocument());
  });

  test('keeps the draft open and explains when Salva modifiche fails', async () => {
    const user = userEvent.setup();
    serveEvent(eventFixture(), {}, { failUpdate: jsonResponse({ detail: 'Eventbrite ticket capacity cannot be reduced' }, 400) });
    renderAt('/admin/workshop/w1#informazioni');
    await loaded();
    await user.type(screen.getByRole('textbox', { name: 'Tag' }), 'ai');
    await user.click(screen.getByRole('button', { name: 'Salva modifiche' }));
    expect(await screen.findByText('Salvataggio non riuscito')).toBeInTheDocument();
    expect(screen.getByText('Eventbrite ticket capacity cannot be reduced')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Tag' })).toHaveValue('ai');
    expect(screen.getByText('Modifiche non salvate')).toBeInTheDocument();
  });

  test('copies a saved venue into the Sede step, keeps the fields editable and splits rooms on new lines only', async () => {
    const user = userEvent.setup();
    const api = serveEvent(eventFixture());
    renderAt('/admin/workshop/w1#sede');
    await loaded();
    await user.click(screen.getByRole('button', { name: /Copia da una sede salvata/ }));
    await user.click(await screen.findByRole('option', { name: /Community Hall/ }));
    expect(screen.getByRole('textbox', { name: 'Nome della sede' })).toHaveValue('Community Hall');
    expect(screen.getByRole('textbox', { name: 'Indirizzo' })).toHaveValue('1 Main Street');
    expect(screen.getByRole('textbox', { name: 'Coordinate' })).toHaveValue('44.4,8.9');
    expect(screen.getByRole('textbox', { name: 'Link a Google Maps' })).toHaveValue('https://maps.google.com/?q=Community+Hall');
    expect(screen.getByRole('spinbutton', { name: 'Posti disponibili' })).toHaveValue(120);
    await user.clear(screen.getByRole('textbox', { name: 'Nome della sede' }));
    await user.type(screen.getByRole('textbox', { name: 'Nome della sede' }), 'Updated Hall');
    await user.type(screen.getByRole('textbox', { name: 'Sale di questo evento' }), 'Auditorium, Room B{enter}Sala C');
    await user.click(screen.getByRole('button', { name: 'Salva modifiche' }));
    await waitFor(() => expect(api.lastUpdate()).toBeDefined());
    expect(api.lastUpdate()!.location).toEqual({ name: 'Updated Hall', address: '1 Main Street', coordinates: '44.4,8.9', googleMapsUrl: 'https://maps.google.com/?q=Community+Hall', maximumSpaces: 120, rooms: ['Auditorium, Room B', 'Sala C'] });
    expect(api.lastUpdate()!.title).toBe('Test Workshop');
  });

  test('does not block the save of a legacy event with incomplete address or coordinates', async () => {
    const user = userEvent.setup();
    const api = serveEvent(eventFixture({ location: { name: 'Online', address: '', coordinates: 'n/d', googleMapsUrl: 'maps' } }));
    renderAt('/admin/workshop/w1#sede');
    await loaded();
    expect(screen.getByRole('textbox', { name: 'Indirizzo' })).toHaveValue('');
    expect(screen.getByRole('textbox', { name: 'Indirizzo' })).not.toBeRequired();
    for (let i = 0; i < 9 && !screen.queryByRole('button', { name: 'Salva modifiche' }); i += 1) {
      await user.click(screen.getByRole('button', { name: /^Avanti/ }));
    }
    await user.click(screen.getByRole('button', { name: 'Salva modifiche' }));
    await waitFor(() => expect(api.lastUpdate()).toMatchObject({ location: { name: 'Online', address: '', coordinates: 'n/d', googleMapsUrl: 'maps', maximumSpaces: 0 } }));
  });

  test('asks before leaving with unsaved changes, in the browser and in the app, but not when switching steps', async () => {
    const user = userEvent.setup();
    serveEvent(eventFixture());
    renderAt('/admin/workshop/w1#informazioni');
    await loaded();
    const clean = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(clean);
    expect(clean.defaultPrevented).toBe(false);

    await user.type(screen.getByRole('textbox', { name: 'Titolo' }), '!');
    const dirty = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(dirty);
    expect(dirty.defaultPrevented).toBe(true);

    await user.click(within(steps()).getByRole('link', { name: '1. Pubblicazione, raggiunto' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByTestId('current-path')).toHaveTextContent('#pubblicazione');

    await user.click(screen.getByRole('link', { name: 'Eventi' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Modifiche non salvate' });
    expect(screen.getByTestId('current-path')).toHaveTextContent('/admin/workshop/w1');
    await user.click(within(dialog).getByRole('button', { name: 'Annulla' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    await user.click(screen.getByRole('link', { name: 'Eventi' }));
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Esci senza salvare' }));
    expect(await screen.findByText('Elenco eventi')).toBeInTheDocument();
  });

  test('step 1 edits the visibility flags in the draft, shows the feedback QR and link, and manages the linked questionnaires', async () => {
    const user = userEvent.setup();
    const questionnaire = { questionnaireId: 'q1', title: 'Feedback Meetup', status: 'Closed', responseCount: 2, sections: [] };
    const api = serveEvent(eventFixture({ feedbackEnabled: true }), {
      '/Questionnaire/by-workshop/': [questionnaire, { ...questionnaire, questionnaireId: 'q2', title: 'Bozza nuova', status: 'Draft', responseCount: 0 }, { ...questionnaire, questionnaireId: 'q3', title: 'Aperto ora', status: 'Published', responseCount: 7 }],
      '/Questionnaire': (_url: string, init?: RequestInit) => jsonResponse(init?.method === 'POST' ? { ...questionnaire, questionnaireId: 'new2', title: 'Nuovo feedback' } : []),
    });
    renderAt('/admin/workshop/w1');
    await loaded();
    expect(screen.getByRole('switch', { name: 'Pubblicato' })).toBeChecked();
    expect(screen.getByRole('switch', { name: 'In evidenza nella home' })).not.toBeChecked();
    expect(screen.getByRole('switch', { name: 'Feedback aperto' })).toBeChecked();
    await user.click(screen.getByRole('switch', { name: 'In evidenza nella home' }));
    expect(api.to('/Workshop/Update/')).toHaveLength(0);
    expect(screen.getByText('http://localhost:3000/feedback/w1')).toBeInTheDocument();
    expect(screen.getByTitle('QR code del feedback di Test Workshop')).toBeInTheDocument();

    expect(await screen.findByRole('link', { name: 'Feedback Meetup' })).toHaveAttribute('href', '/admin/questionnaires/q1/edit');
    expect(screen.getByRole('link', { name: '2 risposte' })).toHaveAttribute('href', '/admin/questionnaires/q1/results');
    expect(screen.getByText('Chiuso')).toBeInTheDocument();
    expect(screen.getByText('Bozza nuova').parentElement).toHaveTextContent('Bozza');
    expect(screen.getByText('Aperto ora').parentElement).toHaveTextContent('Pubblicato');
    expect(api.to('/Questionnaire/by-workshop/w1')).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Crea questionario di feedback' }));
    expect(await screen.findByText('Editor aperto')).toBeInTheDocument();
    expect(api.to('/Questionnaire', 'POST')[0].body).toEqual({ template: 'workshopFeedback', workshopId: 'w1' });
  });

  test('step 2 uploads the poster at once as multipart data and reloads the event', async () => {
    const api = serveEvent(eventFixture());
    renderAt('/admin/workshop/w1#locandina');
    await loaded();
    const input = screen.getByRole('region', { name: 'Locandina' }).querySelector('input[type="file"]') as HTMLInputElement;
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
    expect((screen.getByAltText('Locandina di Test Workshop') as HTMLImageElement).src).toMatch(/\/Contents\/workshops\/w001\/workshop\.png\?t=\d+/);
  });

  test('reports a failed load with a retry and a missing event as not found', async () => {
    const user = userEvent.setup();
    let attempts = 0;
    serveEvent(eventFixture(), { '/Workshop/Get/': () => (++attempts === 1 ? jsonResponse({ detail: 'Mongo down' }, 500) : jsonResponse(eventFixture())) });
    renderAt('/admin/workshop/w1');
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent("L'evento non è disponibile (Mongo down).");
    await user.click(within(alert).getByRole('button', { name: 'Riprova' }));
    expect(await loaded()).toBeInTheDocument();

    serveEvent(eventFixture(), { '/Workshop/Get/': () => new Response(null, { status: 404 }) });
    renderAt('/admin/workshop/missing');
    expect(await screen.findByRole('heading', { name: 'Evento non trovato' })).toBeInTheDocument();
  });

  test('on phones shows the compact header with a progress bar and only the reachable steps in a menu', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    const user = userEvent.setup();
    serveEvent(eventFixture());
    renderAt('/admin/workshop/w1#informazioni');
    await loaded();
    expect(steps()).toHaveTextContent('Passo 3 di 10 · Informazioni');
    expect(within(steps()).getByRole('progressbar', { name: 'Passo 3 di 10' })).toHaveAttribute('aria-valuenow', '3');
    expect(within(steps()).queryByRole('link')).not.toBeInTheDocument();
    await user.click(within(steps()).getByRole('button', { name: 'Passaggi' }));
    const menu = await screen.findByRole('menu');
    expect(within(menu).getAllByRole('menuitem')).toHaveLength(3);
    expect(within(menu).getByRole('menuitem', { name: '3. Informazioni, passo attuale' })).toBeInTheDocument();
    await user.click(within(menu).getByRole('menuitem', { name: '1. Pubblicazione, raggiunto' }));
    expect(screen.getByTestId('current-path')).toHaveTextContent('#pubblicazione');
    expect(steps()).toHaveTextContent('Passo 1 di 10 · Pubblicazione');
  });
});

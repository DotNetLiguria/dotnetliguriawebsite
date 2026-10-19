import React from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { useOidc } from '@axa-fr/react-oidc';
import { ADMIN_CAPABILITIES, NO_CAPABILITIES, fireEvent, jsonResponse, render, screen, waitFor, within } from '../../test-utils';
import { AdminToastRegion, adminToasts } from '../toasts';
import EventDetailAdminPage from './EventDetailAdminPage';
import { eventFixture, serveEvent } from './eventFixtures';

const CurrentPath = () => { const { pathname, hash } = useLocation(); return <span data-testid="current-path">{pathname}{hash}</span>; };

const renderAt = (route: string, accountProvider = false) => render(
  <>
    <Routes>
      <Route path="/admin/workshop/:id" element={<EventDetailAdminPage />} />
      <Route path="/admin/workshops/" element={<div>Elenco eventi</div>} />
      <Route path="/admin/questionnaires/:id/edit" element={<div>Editor aperto</div>} />
    </Routes>
    <AdminToastRegion />
    <CurrentPath />
  </>,
  { route, accountProvider },
);
const setValue = (element: HTMLElement, value: string) => fireEvent.change(element, { target: { value } });
const loaded = () => screen.findByRole('heading', { level: 1, name: 'Modifica evento - Test Workshop' });
const steps = () => screen.getByRole('navigation', { name: "Passaggi dell'evento" });
const currentStep = () => within(steps()).getByRole('link', { current: 'step' });
const localDay = (iso: string) => { const d = new Date(iso); return [d.getFullYear(), d.getMonth() + 1, d.getDate()]; };
/** Presses Avanti until the last step, where "Salva modifiche" lives. */
const goToLastStep = async (user: ReturnType<typeof userEvent.setup>) => {
  for (let i = 0; i < 9 && !screen.queryByRole('button', { name: 'Salva modifiche' }); i += 1) {
    await user.click(screen.getByRole('button', { name: /^Avanti/ }));
  }
};

beforeEach(() => adminToasts.clear());

describe('<EventDetailAdminPage /> wizard', () => {
  test.each([
    ['', '1. Pubblicazione', 'Impostazioni di pubblicazione'], ['#pubblicazione', '1. Pubblicazione', 'Impostazioni di pubblicazione'],
    ['#immagine', "2. Immagine dell'evento", "Immagine dell'evento"], ['#sede', '4. Sede', 'Informazioni sulla sede'], ['#tracks', '5. Tracks', 'Tracks'],
    ['#talk-pool', '6. Talk pool', 'Talk pool'], ['#agenda', "7. Track e orari dell'agenda", 'Orari della track'],
    ['#iscrizione', '8. Dettagli di iscrizione', 'Iscrizione e dettagli dei partecipanti'], ['#foto', '10. Foto', 'Foto'],
    // Hashes used by earlier versions of the card.
    ['#panoramica', "3. Informazioni sull'evento", 'Informazioni'], ['#relatori', '6. Talk pool', 'Talk pool'], ['#materiali', '9. Materiali', 'Materiali'],
    ['#questionario', '1. Pubblicazione', 'Impostazioni di pubblicazione'], ['?tab=agenda', "7. Track e orari dell'agenda", 'Orari della track'],
    ['#locandina', "2. Immagine dell'evento", "Immagine dell'evento"], ['#sessioni', '5. Tracks', 'Tracks'], ['#talk', '6. Talk pool', 'Talk pool'],
  ])('opens the step named by the address %s, its panel title as the heading', async (suffix, step, title) => {
    serveEvent(eventFixture());
    renderAt(`/admin/workshop/w1${suffix}`);
    await loaded();
    expect(currentStep()).toHaveAccessibleName(`${step}, passo attuale`);
    expect(screen.getAllByRole('heading', { level: 2 })[0]).toHaveTextContent(title);
    expect(screen.queryByRole('heading', { level: 2, name: /^\d+\. / })).not.toBeInTheDocument();
  });

  test('shows the previous header only: the back link and "Modifica evento - {title}"', async () => {
    serveEvent(eventFixture({ published: undefined, in_homepage: true, eventDate: '2099-06-12T10:00:00Z' }));
    renderAt('/admin/workshop/w1');
    await loaded();
    expect(screen.getByRole('link', { name: 'Eventi' })).toHaveAttribute('href', '/admin/workshops/');
    for (const added of ['In programma', 'In evidenza', 'Bozza', 'Vedi sul sito']) expect(screen.queryByText(added)).not.toBeInTheDocument();
    // No poster: the only picture on the first step is the feedback QR code.
    expect(document.querySelector('img')).toBeNull();
    expect(screen.queryByRole('img', { name: 'Immagine non disponibile' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Altre azioni' })).not.toBeInTheDocument();
    expect(steps()).toHaveClass('sticky');
    expect(within(steps()).getAllByRole('listitem')).toHaveLength(10);
    expect(within(steps()).getAllByRole('listitem').map(item => item.textContent)).toEqual([
      '1Pubblicazione', "2Immagine dell'evento", "3Informazioni sull'evento", '4Sede', '5Tracks', '6Talk pool', "7Track e orari dell'agenda", '8Dettagli di iscrizione', '9Materiali', '10Foto',
    ]);
  });

  test('shows "Immagine attuale" only when the event has an image', async () => {
    serveEvent(eventFixture({ image: '' }));
    const { unmount } = renderAt('/admin/workshop/w1#immagine');
    await loaded();
    expect(screen.queryByText('Immagine attuale')).not.toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText("Carica l'immagine di copertina dell'evento")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Scegli il file immagine…' })).toHaveAccessibleDescription("Carica l'immagine di copertina dell'evento");
    expect(screen.queryByText(/Trascina/)).not.toBeInTheDocument();
    unmount();

    serveEvent(eventFixture());
    renderAt('/admin/workshop/w1#immagine');
    await loaded();
    expect(screen.getByText('Immagine attuale')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Test Workshop' })).toHaveAttribute('src', expect.stringMatching(/\/Contents\/workshops\/w001\/workshop\.png$/));
  });

  test('replaces a broken current image with the blank placeholder', async () => {
    serveEvent(eventFixture());
    renderAt('/admin/workshop/w1#immagine');
    await loaded();
    fireEvent.error(screen.getByAltText('Test Workshop'));
    expect(screen.getByRole('img', { name: 'Immagine non disponibile' })).toBeInTheDocument();
  });

  test('reaches steps with Avanti, keeps reached steps clickable and later ones not, and moves focus to the step panel title', async () => {
    const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
    serveEvent(eventFixture());
    renderAt('/admin/workshop/w1#informazioni');
    await loaded();
    expect(within(steps()).getByRole('link', { name: '1. Pubblicazione, raggiunto' })).toHaveAttribute('href', '/admin/workshop/w1#pubblicazione');
    expect(within(steps()).getByRole('link', { name: "3. Informazioni sull'evento, passo attuale" })).toHaveAttribute('aria-current', 'step');
    expect(within(steps()).queryByRole('link', { name: /4\. Sede/ })).not.toBeInTheDocument();
    expect(within(steps()).getByLabelText('4. Sede, non ancora raggiunto')).toBeInTheDocument();
    expect(within(steps()).getByLabelText('10. Foto, non ancora raggiunto')).toBeInTheDocument();

    expect(screen.getByRole('button', { name: 'Avanti: Sede' })).toHaveClass('bg-site-green');
    await user.click(screen.getByRole('button', { name: 'Avanti: Sede' }));
    expect(screen.getByTestId('current-path')).toHaveTextContent('#sede');
    expect(screen.getByRole('heading', { level: 2, name: 'Informazioni sulla sede' })).toHaveFocus();
    expect(within(steps()).getByRole('link', { name: "3. Informazioni sull'evento, raggiunto" })).toBeInTheDocument();
    expect(within(steps()).queryByRole('link', { name: /5\. Tracks/ })).not.toBeInTheDocument();

    await user.click(within(steps()).getByRole('link', { name: '1. Pubblicazione, raggiunto' }));
    expect(screen.getByTestId('current-path')).toHaveTextContent('#pubblicazione');
    expect(screen.getByRole('heading', { level: 2, name: 'Impostazioni di pubblicazione' })).toHaveFocus();
    expect(within(steps()).getByRole('link', { name: '4. Sede, raggiunto' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Indietro' })).toBeDisabled();

    await user.click(within(steps()).getByRole('link', { name: '4. Sede, raggiunto' }));
    await user.click(screen.getByRole('button', { name: "Indietro: Informazioni sull'evento" }));
    expect(screen.getByTestId('current-path')).toHaveTextContent('#informazioni');
    expect(screen.getByRole('heading', { level: 2, name: 'Informazioni' })).toHaveFocus();
  });

  test('moves the focus to the visible panel title of the talk pool, schedule and registration steps', async () => {
    const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
    serveEvent(eventFixture());
    renderAt('/admin/workshop/w1#tracks');
    await loaded();
    await user.click(screen.getByRole('button', { name: 'Avanti: Talk pool' }));
    expect(screen.getByRole('heading', { level: 2, name: 'Talk pool' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: "Avanti: Track e orari dell'agenda" }));
    expect(screen.getByRole('heading', { level: 2, name: 'Orari della track' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Avanti: Dettagli di iscrizione' }));
    expect(screen.getByRole('heading', { level: 2, name: 'Iscrizione e dettagli dei partecipanti' })).toHaveFocus();
  });

  test('offers Avanti on every step but the last, where "Salva modifiche" is the only save of the wizard', async () => {
    serveEvent(eventFixture());
    const { unmount } = renderAt('/admin/workshop/w1#talk-pool');
    await loaded();
    expect(screen.getByRole('button', { name: "Avanti: Track e orari dell'agenda" })).toHaveClass('bg-site-green');
    expect(screen.queryByRole('button', { name: 'Salva modifiche' })).not.toBeInTheDocument();
    expect(screen.queryByText('Modifiche non salvate')).not.toBeInTheDocument();
    unmount();
    serveEvent(eventFixture());
    renderAt('/admin/workshop/w1#foto');
    await loaded();
    expect(screen.queryByRole('button', { name: /^Avanti/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Indietro: Materiali' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Salva modifiche' })).toHaveClass('bg-site-green');
  });

  test('keeps the draft of steps 1, 3 and 4 across steps and saves it once, from the latest record, with Salva modifiche', async () => {
    const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
    const api = serveEvent(eventFixture({ tags: 'dotnet', blogHtml: '<p>keep</p>', location: { name: 'Genova', address: 'Via del Porto 1', coordinates: '44.4056,8.9463', maximumSpaces: 150, rooms: ['Aula 1'] } }));
    renderAt('/admin/workshop/w1');
    await loaded();
    await user.click(screen.getByRole('switch', { name: 'Pubblicato' }));
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Pubblicato' })).not.toBeChecked());
    expect(screen.queryByText('Modifiche non salvate')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: "Avanti: Immagine dell'evento" }));
    await user.click(screen.getByRole('button', { name: "Avanti: Informazioni sull'evento" }));
    setValue(screen.getByRole('textbox', { name: 'Titolo' }), 'Test Workshop aggiornato');
    await user.click(screen.getByRole('button', { name: 'Avanti: Sede' }));
    setValue(screen.getByRole('textbox', { name: 'Indirizzo' }), 'Via Nuova 2');
    await user.click(within(steps()).getByRole('link', { name: "3. Informazioni sull'evento, raggiunto" }));
    expect(screen.getByRole('textbox', { name: 'Titolo' })).toHaveValue('Test Workshop aggiornato');
    await user.click(within(steps()).getByRole('link', { name: '1. Pubblicazione, raggiunto' }));
    expect(screen.getByRole('switch', { name: 'Pubblicato' })).not.toBeChecked();
    expect(api.to('/Workshop/Update/')).toHaveLength(0);

    await goToLastStep(user);
    expect(currentStep()).toHaveAccessibleName('10. Foto, passo attuale');
    expect(api.to('/Workshop/Update/')).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: 'Salva modifiche' }));
    await waitFor(() => expect(api.to('/Workshop/Update/w1', 'PUT')).toHaveLength(1));
    const body = api.lastUpdate()!;
    // Fields the wizard does not edit (tags, extended HTML, rooms) travel unchanged, as before.
    expect(body).toMatchObject({ published: false, in_homepage: false, feedbackEnabled: false, title: 'Test Workshop aggiornato', description: 'Workshop description', tags: 'dotnet', blogHtml: '<p>keep</p>', location: { name: 'Genova', address: 'Via Nuova 2', coordinates: '44.4056,8.9463', maximumSpaces: 150, rooms: ['Aula 1'] } });
    expect(localDay(body.eventDate)).toEqual([2024, 3, 15]);
    expect(await screen.findByText('Evento aggiornato correttamente')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Modifica evento - Test Workshop aggiornato' })).toBeInTheDocument();
  });

  test('keeps the draft and shows the server detail when Salva modifiche fails', async () => {
    const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
    serveEvent(eventFixture(), {}, { failUpdate: jsonResponse({ detail: 'Eventbrite ticket capacity cannot be reduced' }, 400) });
    renderAt('/admin/workshop/w1#informazioni');
    await loaded();
    setValue(screen.getByRole('textbox', { name: 'Titolo' }), 'Test Workshop bis');
    await goToLastStep(user);
    await user.click(screen.getByRole('button', { name: 'Salva modifiche' }));
    expect(await screen.findByText('Eventbrite ticket capacity cannot be reduced')).toBeInTheDocument();
    await user.click(within(steps()).getByRole('link', { name: "3. Informazioni sull'evento, raggiunto" }));
    expect(screen.getByRole('textbox', { name: 'Titolo' })).toHaveValue('Test Workshop bis');
  });

  test('words a failed Salva modifiche without a JSON detail as before and keeps Indietro off while it runs', async () => {
    const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
    let release: (() => void) | null = null;
    serveEvent(eventFixture(), { '/Workshop/Update/': () => new Promise<Response>(resolve => { release = () => resolve(new Response('<html>Bad gateway</html>', { status: 502, headers: { 'Content-Type': 'text/html' } })); }) });
    renderAt('/admin/workshop/w1#foto');
    await loaded();
    await user.click(screen.getByRole('button', { name: 'Salva modifiche' }));
    expect(screen.getByRole('button', { name: 'Indietro: Materiali' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Salvataggio…' })).toBeDisabled();
    release!();
    expect(await screen.findByText("Impossibile salvare l'evento (HTTP 502)")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Indietro: Materiali' })).toBeEnabled();
  });

  test('copies a saved venue into the Sede step and keeps the fields editable', async () => {
    const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
    const api = serveEvent(eventFixture());
    renderAt('/admin/workshop/w1#sede');
    await loaded();
    await user.click(screen.getByRole('button', { name: /^Copia dalla sede/ }));
    await user.click(await screen.findByRole('option', { name: 'Community Hall' }));
    expect(screen.getByRole('textbox', { name: 'Nome' })).toHaveValue('Community Hall');
    expect(screen.getByRole('textbox', { name: 'Indirizzo' })).toHaveValue('1 Main Street');
    expect(screen.getByRole('textbox', { name: 'Coordinate' })).toHaveValue('44.4,8.9');
    expect(screen.getByRole('textbox', { name: 'URL di Google Maps' })).toHaveValue('https://maps.google.com/?q=Community+Hall');
    expect(screen.getByRole('textbox', { name: 'URL di Google Maps' })).toHaveAttribute('type', 'url');
    expect(screen.getByRole('spinbutton', { name: 'Posti massimi' })).toHaveValue(120);
    setValue(screen.getByRole('textbox', { name: 'Nome' }), 'Updated Hall');
    // The chosen venue stays selected while moving between steps, as before.
    await user.click(screen.getByRole('button', { name: "Indietro: Informazioni sull'evento" }));
    await user.click(screen.getByRole('button', { name: 'Avanti: Sede' }));
    expect(screen.getByRole('button', { name: /Copia dalla sede$/ })).toHaveTextContent('Community Hall');
    await goToLastStep(user);
    await user.click(screen.getByRole('button', { name: 'Salva modifiche' }));
    await waitFor(() => expect(api.lastUpdate()).toBeDefined());
    expect(api.lastUpdate()!.location).toEqual({ name: 'Updated Hall', address: '1 Main Street', coordinates: '44.4,8.9', googleMapsUrl: 'https://maps.google.com/?q=Community+Hall', maximumSpaces: 120 });
    expect(api.lastUpdate()!.title).toBe('Test Workshop');
  });

  test('reports failed venue and speaker loads as before and leaves "Copia dalla sede" empty', async () => {
    serveEvent(eventFixture(), { '/Venue': () => new Response(null, { status: 500 }), '/Speaker/Get': () => new Response(null, { status: 503 }) });
    renderAt('/admin/workshop/w1#sede');
    await loaded();
    expect(await screen.findByText('Impossibile caricare le sedi (HTTP 500)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Copia dalla sede/ })).toBeDisabled();
    expect(screen.getByText('Nessuna sede disponibile da copiare.')).toBeInTheDocument();
    expect(screen.queryByText('Impossibile caricare i relatori (HTTP 503)')).not.toBeInTheDocument();
    await userEvent.setup({ delay: null }).click(screen.getByRole('button', { name: 'Avanti: Tracks' }));
    expect(await screen.findByText('Impossibile caricare i relatori (HTTP 503)')).toBeInTheDocument();
  });

  test('does not block the save of a legacy event with incomplete address or coordinates', async () => {
    const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
    const api = serveEvent(eventFixture({ location: { name: 'Online', address: '', coordinates: 'n/d', googleMapsUrl: 'maps' } }));
    renderAt('/admin/workshop/w1#sede');
    await loaded();
    expect(screen.getByRole('textbox', { name: 'Indirizzo' })).toHaveValue('');
    expect(screen.getByRole('textbox', { name: 'Indirizzo' })).toBeRequired();
    await goToLastStep(user);
    await user.click(screen.getByRole('button', { name: 'Salva modifiche' }));
    await waitFor(() => expect(api.lastUpdate()).toMatchObject({ location: { name: 'Online', address: '', coordinates: 'n/d', googleMapsUrl: 'maps', maximumSpaces: 0 } }));
  });

  test('never warns when leaving, with or without edits, as before', async () => {
    const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
    serveEvent(eventFixture());
    renderAt('/admin/workshop/w1#informazioni');
    await loaded();
    await user.type(screen.getByRole('textbox', { name: 'Titolo' }), '!');
    const unload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(false);
    await user.click(screen.getByRole('link', { name: 'Eventi' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(await screen.findByText('Elenco eventi')).toBeInTheDocument();
  });

  test('step 1 edits the visibility flags in the draft, shows the feedback QR and link, and manages the linked questionnaires', async () => {
    const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
    vi.mocked(useOidc).mockReturnValue({ isAuthenticated: true, login: vi.fn(), logout: vi.fn(), renewTokens: vi.fn() });
    const questionnaire = { questionnaireId: 'q1', title: 'Feedback Meetup', status: 'Closed', responseCount: 2, sections: [] };
    const api = serveEvent(eventFixture({ feedbackEnabled: true }), {
      'account/capabilities': ADMIN_CAPABILITIES,
      '/Questionnaire/by-workshop/': [questionnaire, { ...questionnaire, questionnaireId: 'q2', title: 'Bozza nuova', status: 'Draft', responseCount: 0 }, { ...questionnaire, questionnaireId: 'q3', title: 'Aperto ora', status: 'Published', responseCount: 7 }],
      '/Questionnaire': (_url: string, init?: RequestInit) => jsonResponse(init?.method === 'POST' ? { ...questionnaire, questionnaireId: 'new2', title: 'Nuovo feedback' } : []),
    });
    renderAt('/admin/workshop/w1', true);
    await loaded();
    expect(screen.getByRole('switch', { name: 'Pubblicato' })).toBeChecked();
    expect(screen.getByRole('switch', { name: 'Mostra in homepage' })).not.toBeChecked();
    expect(screen.getByRole('switch', { name: 'Feedback abilitato' })).toBeChecked();
    await user.click(screen.getByRole('switch', { name: 'Mostra in homepage' }));
    expect(api.to('/Workshop/Update/')).toHaveLength(0);
    expect(screen.getByText('http://localhost:3000/feedback/w1')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'QR code del feedback' }).nextElementSibling!.querySelector('svg')).toHaveAttribute('height', '150');
    expect(screen.queryByTitle(/QR code/)).not.toBeInTheDocument();
    expect(await screen.findByRole('heading', { level: 3, name: 'Questionari collegati' })).toBeInTheDocument();

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

  test('website administrator without feedback capability never loads linked questionnaire data', async () => {
    vi.mocked(useOidc).mockReturnValue({ isAuthenticated: true, login: vi.fn(), logout: vi.fn(), renewTokens: vi.fn() });
    const api = serveEvent(eventFixture(), { 'account/capabilities': { ...NO_CAPABILITIES, canAccessAdmin: true, permissions: ['events.read'] } });
    renderAt('/admin/workshop/w1', true);
    await loaded();
    expect(screen.queryByRole('heading', { name: 'Questionari collegati' })).not.toBeInTheDocument();
    expect(api.to('/Questionnaire')).toHaveLength(0);
  });

  test('step 2 uploads the image at once as multipart data, reloads the event and names the uploaded file', async () => {
    const api = serveEvent(eventFixture());
    renderAt('/admin/workshop/w1#immagine');
    await loaded();
    const input = screen.getByRole('region', { name: "Immagine dell'evento" }).querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).toHaveAttribute('accept', 'image/*');
    fireEvent.change(input, { target: { files: [new File(['img'], 'poster.png', { type: 'image/png' })] } });
    await waitFor(() => expect(api.to('/workshopfile/uploadworkshopimage', 'POST')).toHaveLength(1));
    const form = api.to('/workshopfile/uploadworkshopimage')[0].form!;
    expect(form.get('workshopId')).toBe('w1');
    expect((form.get('file') as File).name).toBe('poster.png');
    expect(await screen.findByText("Immagine dell'evento caricata correttamente")).toBeInTheDocument();
    expect(api.to('/Workshop/Get/').length).toBeGreaterThanOrEqual(2);
    expect((screen.getByAltText('Test Workshop') as HTMLImageElement).src).toMatch(/\/Contents\/workshops\/w001\/workshop\.png\?t=\d+/);
    expect(screen.getByRole('button', { name: 'poster.png' })).toBeInTheDocument();
  });

  test('step 2 reports a failed upload with the previous fixed message', async () => {
    serveEvent(eventFixture(), { '/workshopfile/uploadworkshopimage': () => jsonResponse({ detail: 'Too large' }, 413) });
    renderAt('/admin/workshop/w1#immagine');
    await loaded();
    const input = screen.getByRole('region', { name: "Immagine dell'evento" }).querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['img'], 'poster.png', { type: 'image/png' })] } });
    expect(await screen.findByText("Errore nel caricamento dell'immagine dell'evento")).toBeInTheDocument();
    expect(screen.queryByText('Too large')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Scegli il file immagine…' })).toBeInTheDocument();
  });

  test('keeps the wizard when the reload after an upload fails, as before', async () => {
    let gets = 0;
    const api = serveEvent(eventFixture(), { '/Workshop/Get/': () => (++gets === 1 ? jsonResponse(eventFixture()) : jsonResponse({ detail: 'Mongo down' }, 500)) });
    renderAt('/admin/workshop/w1#immagine');
    await loaded();
    const input = screen.getByRole('region', { name: "Immagine dell'evento" }).querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['img'], 'poster.png', { type: 'image/png' })] } });
    await waitFor(() => expect(api.to('/workshopfile/uploadworkshopimage', 'POST')).toHaveLength(1));
    expect(await screen.findByText("Immagine dell'evento caricata correttamente")).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Modifica evento - Test Workshop' })).toBeInTheDocument();
    expect((screen.getByAltText('Test Workshop') as HTMLImageElement).src).not.toMatch(/\?t=/);
    expect(screen.queryByRole('button', { name: 'Riprova' })).not.toBeInTheDocument();
  });

  test.each([
    ['a server error', () => jsonResponse({ detail: 'Mongo down' }, 500)],
    ['a missing event', () => new Response(null, { status: 404 })],
  ])('reports %s as before: the error message and "Evento non trovato", nothing else', async (_label, answer) => {
    serveEvent(eventFixture(), { '/Workshop/Get/': answer });
    renderAt('/admin/workshop/w1');
    expect(await screen.findByRole('heading', { level: 1, name: 'Evento non trovato' })).toBeInTheDocument();
    expect(await screen.findByText("Errore nel caricamento dei dettagli dell'evento")).toBeInTheDocument();
    expect(screen.queryByText(/Mongo down/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Riprova' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Tutti gli eventi' })).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: "Passaggi dell'evento" })).not.toBeInTheDocument();
  });

  test('offers "Torna su" once the page has scrolled past 300px, as before', async () => {
    const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    serveEvent(eventFixture());
    renderAt('/admin/workshop/w1');
    await loaded();
    expect(screen.queryByRole('button', { name: 'Torna su' })).not.toBeInTheDocument();
    Object.defineProperty(window, 'scrollY', { value: 450, configurable: true });
    fireEvent.scroll(window);
    await user.click(await screen.findByRole('button', { name: 'Torna su' }));
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
    expect(screen.getByRole('heading', { level: 1 })).toHaveFocus();
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
    fireEvent.scroll(window);
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Torna su' })).not.toBeInTheDocument());
  });

  test('on phones shows the compact header with a progress bar and only the reachable steps in a menu', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
    serveEvent(eventFixture());
    renderAt('/admin/workshop/w1#informazioni');
    await loaded();
    expect(steps()).toHaveTextContent("Passo 3 di 10 · Informazioni sull'evento");
    expect(within(steps()).getByRole('progressbar', { name: 'Passo 3 di 10' })).toHaveAttribute('aria-valuenow', '3');
    expect(within(steps()).queryByRole('link')).not.toBeInTheDocument();
    await user.click(within(steps()).getByRole('button', { name: 'Passaggi' }));
    const menu = await screen.findByRole('menu');
    expect(within(menu).getAllByRole('menuitem')).toHaveLength(3);
    expect(within(menu).getByRole('menuitem', { name: "3. Informazioni sull'evento, passo attuale" })).toBeInTheDocument();
    await user.click(within(menu).getByRole('menuitem', { name: '1. Pubblicazione, raggiunto' }));
    expect(screen.getByTestId('current-path')).toHaveTextContent('#pubblicazione');
    expect(steps()).toHaveTextContent('Passo 1 di 10 · Pubblicazione');
  });
});

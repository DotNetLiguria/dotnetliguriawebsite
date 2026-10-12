import React from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { fireEvent, jsonResponse, render, screen, waitFor, within } from '../../test-utils';
import { AdminToastRegion, adminToasts } from '../toasts';
import EventCreatePage from './EventCreatePage';
import { venuesFixture } from './eventFixtures';

const CurrentPath = () => { const { pathname, hash } = useLocation(); return <span data-testid="current-path">{pathname}{hash}</span>; };
const renderPage = () => render(
  <>
    <Routes>
      <Route path="/admin/workshop/create" element={<EventCreatePage />} />
      <Route path="/admin/workshop/:id" element={<div>Scheda evento</div>} />
    </Routes>
    <AdminToastRegion />
    <CurrentPath />
  </>,
  { route: '/admin/workshop/create' },
);

/** Fake API: the venue list (data, or a Response factory for failures) and the answer of POST /Workshop/Post. */
function serve(venues: unknown | (() => Response), created: Response) {
  const calls: { url: string; method: string; body?: unknown }[] = [];
  vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, method: init?.method ?? 'GET', body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined });
    if (url.includes('/Workshop/Post')) return created;
    if (url.includes('/Venue') && init?.method === 'POST') return jsonResponse({ venueId: 'venue-new', ...(init.body ? JSON.parse(String(init.body)) : {}) }, 201);
    if (url.includes('/Venue')) return typeof venues === 'function' ? (venues as () => Response)() : jsonResponse(venues);
    return jsonResponse([]);
  });
  return calls;
}
type User = ReturnType<typeof userEvent.setup>;
/** Replaces a field's value in one input event: typing every character re-renders the whole form and is slow on CI runners. */
const fill = async (user: User, role: 'textbox' | 'spinbutton', name: string, value: string) => {
  const field = screen.getByRole(role, { name });
  await user.clear(field);
  await user.paste(value);
};
const fillBasics = async (user: User) => {
  await fill(user, 'textbox', 'Titolo', 'Agenda Day');
  await fill(user, 'textbox', 'Descrizione', 'Community event');
  fireEvent.change(screen.getByLabelText('Data *'), { target: { value: '2027-06-21' } });
};

beforeEach(() => adminToasts.clear());

describe('<EventCreatePage />', () => {
  test('creates an event with a copied venue snapshot, event rooms, booking and attendee details, then opens its agenda', async () => {
    const user = userEvent.setup();
    const calls = serve(venuesFixture, jsonResponse({ workshopId: '00112233-4455-6677-8899-aabbccddeeff' }, 201));
    renderPage();
    expect(screen.getByRole('heading', { name: 'Nuovo evento' })).toBeInTheDocument();
    await fillBasics(user);
    await user.click(await screen.findByRole('radio', { name: /Community Hall/ }));
    expect(screen.queryByRole('textbox', { name: 'Nome della sede' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: "Dettagli della sede copiati sull'evento" }));
    expect(screen.getByRole('textbox', { name: 'Nome della sede' })).toHaveValue('Community Hall');
    expect(screen.getByRole('textbox', { name: 'Indirizzo' })).toHaveValue('1 Main Street');
    expect(screen.getByRole('textbox', { name: 'Coordinate' })).toHaveValue('44.4,8.9');
    expect(screen.getByRole('textbox', { name: 'Link a Google Maps' })).toHaveValue('https://maps.google.com/?q=Community+Hall');
    expect(screen.getByRole('spinbutton', { name: 'Posti disponibili' })).toHaveValue(120);
    await fill(user, 'textbox', 'Nome della sede', 'Updated Hall');
    await fill(user, 'textbox', 'Indirizzo', '2 Main Street');
    await fill(user, 'textbox', 'Coordinate', '44.5,9.0');
    await fill(user, 'textbox', 'Link a Google Maps', 'https://maps.google.com/?q=Updated+Hall');
    await fill(user, 'spinbutton', 'Posti disponibili', '150');
    await user.type(screen.getByRole('textbox', { name: 'Sale per questo evento' }), 'Auditorium{enter}Room B');
    await fill(user, 'textbox', 'Link di prenotazione', 'https://booking.example.test/event/1');
    await fill(user, 'spinbutton', 'Biglietti gratuiti iniziali su Eventbrite', '50');
    await fill(user, 'textbox', 'Note per chi partecipa', 'Bring your laptop');
    await user.click(screen.getByRole('button', { name: "Crea evento e passa all'agenda" }));

    await waitFor(() => expect(screen.getByTestId('current-path')).toHaveTextContent('/admin/workshop/00112233-4455-6677-8899-aabbccddeeff#agenda'));
    const post = calls.find(call => call.url.includes('/Workshop/Post'))!;
    expect(post.method).toBe('POST');
    expect(post.body).toEqual({
      title: 'Agenda Day',
      description: 'Community event',
      eventDate: '2027-06-21',
      location: { name: 'Updated Hall', address: '2 Main Street', coordinates: '44.5,9.0', googleMapsUrl: 'https://maps.google.com/?q=Updated+Hall', maximumSpaces: 150, rooms: ['Auditorium', 'Room B'] },
      bookingServiceUrl: 'https://booking.example.test/event/1',
      externalRegistration: true,
      externalRegistrationLink: 'https://booking.example.test/event/1',
      eventbriteTicketCapacity: 50,
      attendeeNotes: 'Bring your laptop',
    });
    expect(calls.filter(call => call.url.includes('/Venue') && call.method === 'POST')).toHaveLength(0);
    expect(await screen.findByText('Evento creato')).toBeInTheDocument();
  });

  test('shows the API error detail when workshop creation fails', async () => {
    const user = userEvent.setup();
    serve(venuesFixture, new Response(JSON.stringify({ detail: 'Workshop counter unavailable' }), { status: 503, headers: { 'Content-Type': 'application/problem+json' } }));
    renderPage();
    await fillBasics(user);
    await user.click(await screen.findByRole('radio', { name: /Community Hall/ }));
    await user.click(screen.getByRole('button', { name: "Crea evento e passa all'agenda" }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Workshop counter unavailable');
    expect(screen.getByTestId('current-path')).toHaveTextContent('/admin/workshop/create');
    expect(screen.getByRole('button', { name: "Crea evento e passa all'agenda" })).toBeEnabled();
  });

  test('does not navigate to an undefined workshop when the create response omits its ID', async () => {
    const user = userEvent.setup();
    serve(venuesFixture, jsonResponse({}, 201));
    renderPage();
    await fillBasics(user);
    await user.click(await screen.findByRole('radio', { name: /Community Hall/ }));
    await user.click(screen.getByRole('button', { name: "Crea evento e passa all'agenda" }));
    expect(await screen.findByRole('alert')).toHaveTextContent("L'evento è stato creato, ma il server non ha restituito un identificativo valido.");
    expect(screen.getByTestId('current-path')).toHaveTextContent('/admin/workshop/create');
  });

  test('offers a new venue when none is saved, optionally saving it for the next events', async () => {
    const user = userEvent.setup();
    const calls = serve([], jsonResponse({ WorkshopId: '00112233-4455-6677-8899-aabbccddeeff' }, 201));
    renderPage();
    await waitFor(() => expect(screen.getByRole('radio', { name: 'Nuova sede' })).toBeChecked());
    await fillBasics(user);
    await fill(user, 'textbox', 'Nome della sede', 'Sala Nuova');
    await fill(user, 'textbox', 'Indirizzo', 'Via Roma 1, Genova');
    await user.click(screen.getByRole('switch', { name: 'Salva la sede per i prossimi eventi' }));
    await user.click(screen.getByRole('button', { name: "Crea evento e passa all'agenda" }));
    await waitFor(() => expect(screen.getByTestId('current-path')).toHaveTextContent('/admin/workshop/00112233-4455-6677-8899-aabbccddeeff#agenda'));
    const venuePost = calls.find(call => call.url.includes('/Venue') && call.method === 'POST')!;
    expect(venuePost.body).toEqual({ name: 'Sala Nuova', address: 'Via Roma 1, Genova', coordinates: null, googleMapsUrl: null, maximumSpaces: 0 });
    const post = calls.find(call => call.url.includes('/Workshop/Post'))!;
    expect(post.body).toMatchObject({ location: { name: 'Sala Nuova', address: 'Via Roma 1, Genova', rooms: [] }, eventbriteTicketCapacity: 0, bookingServiceUrl: '', externalRegistration: false });
    expect(calls.indexOf(post)).toBeLessThan(calls.indexOf(venuePost));
  });

  test('asks for the required fields before posting and keeps the venue list failure out of the way', async () => {
    const user = userEvent.setup();
    const calls = serve(() => new Response(null, { status: 500 }), jsonResponse({}, 201));
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent(/Le sedi salvate non sono disponibili/);
    expect(screen.getByRole('radio', { name: 'Nuova sede' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: "Crea evento e passa all'agenda" }));
    expect(await screen.findByText('Il titolo è obbligatorio.')).toBeInTheDocument();
    expect(calls.filter(call => call.url.includes('/Workshop/Post'))).toHaveLength(0);
    expect(within(screen.getByRole('form', { name: 'Nuovo evento' })).getByRole('link', { name: 'Annulla' })).toHaveAttribute('href', '/admin/workshops/');
  });
});

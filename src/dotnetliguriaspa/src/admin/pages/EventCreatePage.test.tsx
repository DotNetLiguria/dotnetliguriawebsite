import React from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { fireEvent, jsonResponse, render, screen, waitFor } from '../../test-utils';
import { AdminToastRegion, adminToasts } from '../toasts';
import EventCreatePage, { MISSING_FIELDS_MESSAGE } from './EventCreatePage';
import { venuesFixture } from './eventFixtures';

type User = ReturnType<typeof userEvent.setup>;
const CurrentPath = () => <span data-testid="current-path">{useLocation().pathname}</span>;
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
    if (url.includes('/Venue')) return typeof venues === 'function' ? (venues as () => Response)() : jsonResponse(venues);
    return jsonResponse([]);
  });
  return calls;
}
const fillBasics = async (user: User) => {
  await user.type(screen.getByRole('textbox', { name: 'Titolo' }), 'Agenda Day');
  await user.type(screen.getByRole('textbox', { name: 'Descrizione' }), 'Community event');
  fireEvent.change(screen.getByLabelText("Data dell'evento"), { target: { value: '2027-06-21' } });
};
const venueSelect = () => screen.getByRole('button', { name: /^Sede/ });
const pickVenue = async (user: User) => {
  await waitFor(() => expect(venueSelect()).toBeEnabled());
  await user.click(venueSelect());
  await user.click(await screen.findByRole('option', { name: 'Community Hall' }));
};
const create = () => screen.getByRole('button', { name: 'Crea' });

beforeEach(() => adminToasts.clear());

describe('<EventCreatePage />', () => {
  test('creates an event with a copied venue snapshot, event rooms, booking and attendee details', async () => {
    const user = userEvent.setup();
    const calls = serve(venuesFixture, jsonResponse({ workshopId: '00112233-4455-6677-8899-aabbccddeeff' }, 201));
    renderPage();
    await fillBasics(user);
    await pickVenue(user);
    expect(screen.getByRole('textbox', { name: 'Nome' })).toHaveValue('Community Hall');
    expect(screen.getByRole('textbox', { name: 'Indirizzo' })).toHaveValue('1 Main Street');
    expect(screen.getByRole('textbox', { name: 'Coordinate' })).toHaveValue('44.4,8.9');
    expect(screen.getByRole('textbox', { name: 'URL di Google Maps' })).toHaveValue('https://maps.google.com/?q=Community+Hall');
    expect(screen.getByRole('spinbutton', { name: 'Posti massimi' })).toHaveValue(120);
    await user.clear(screen.getByRole('textbox', { name: 'Nome' }));
    await user.type(screen.getByRole('textbox', { name: 'Nome' }), 'Updated Hall');
    await user.clear(screen.getByRole('textbox', { name: 'Indirizzo' }));
    await user.type(screen.getByRole('textbox', { name: 'Indirizzo' }), '2 Main Street');
    await user.clear(screen.getByRole('textbox', { name: 'Coordinate' }));
    await user.type(screen.getByRole('textbox', { name: 'Coordinate' }), '44.5,9.0');
    await user.clear(screen.getByRole('textbox', { name: 'URL di Google Maps' }));
    await user.type(screen.getByRole('textbox', { name: 'URL di Google Maps' }), 'https://maps.google.com/?q=Updated+Hall');
    await user.clear(screen.getByRole('spinbutton', { name: 'Posti massimi' }));
    await user.type(screen.getByRole('spinbutton', { name: 'Posti massimi' }), '150');
    await user.clear(screen.getByRole('spinbutton', { name: 'Biglietti gratuiti Eventbrite iniziali' }));
    await user.type(screen.getByRole('spinbutton', { name: 'Biglietti gratuiti Eventbrite iniziali' }), '50');
    await user.type(screen.getByRole('textbox', { name: 'Sale per questo evento' }), 'Auditorium{enter}Room B');
    await user.type(screen.getByRole('textbox', { name: 'URL del servizio di prenotazione e cancellazione del posto' }), 'https://booking.example.test/event/1');
    await user.type(screen.getByRole('textbox', { name: 'Note per i partecipanti' }), 'Bring your laptop');
    await user.click(create());

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByTestId('current-path')).toHaveTextContent('/admin/workshop/00112233-4455-6677-8899-aabbccddeeff'));
    expect(screen.getByText('Scheda evento')).toBeInTheDocument();
    const request = calls[1];
    expect(request.method).toBe('POST');
    expect(request.body).toMatchObject({
      title: 'Agenda Day',
      description: 'Community event',
      eventDate: '2027-06-21',
      location: {
        name: 'Updated Hall',
        address: '2 Main Street',
        coordinates: '44.5,9.0',
        googleMapsUrl: 'https://maps.google.com/?q=Updated+Hall',
        maximumSpaces: 150,
        rooms: ['Auditorium', 'Room B'],
      },
      bookingServiceUrl: 'https://booking.example.test/event/1',
      externalRegistration: true,
      externalRegistrationLink: 'https://booking.example.test/event/1',
      eventbriteTicketCapacity: 50,
      attendeeNotes: 'Bring your laptop',
    });
    expect(calls.some(call => call.url.includes('/Venue') && call.method === 'POST')).toBe(false);
  });

  test('shows the API error detail when workshop creation fails', async () => {
    const user = userEvent.setup();
    serve(venuesFixture, new Response(JSON.stringify({ detail: 'Workshop counter unavailable' }), { status: 503, headers: { 'Content-Type': 'application/problem+json' } }));
    renderPage();
    await fillBasics(user);
    await pickVenue(user);
    await user.click(create());
    expect(await screen.findByText('Workshop counter unavailable')).toBeInTheDocument();
    expect(screen.getByTestId('current-path')).toHaveTextContent('/admin/workshop/create');
    expect(create()).toBeEnabled();
  });

  test('does not navigate to an undefined workshop when the create response omits its ID', async () => {
    const user = userEvent.setup();
    serve(venuesFixture, jsonResponse({}, 201));
    renderPage();
    await fillBasics(user);
    await pickVenue(user);
    await user.click(create());
    expect(await screen.findByText("L'evento è stato creato, ma il server non ha restituito un ID evento valido.")).toBeInTheDocument();
    expect(screen.getByTestId('current-path')).toHaveTextContent('/admin/workshop/create');
  });

  test('without saved venues points to the venues page and refuses the submit with the single message', async () => {
    const user = userEvent.setup();
    const calls = serve([], jsonResponse({}, 201));
    renderPage();
    expect(await screen.findByText(/Aggiungi una sede in/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sedi' })).toHaveAttribute('href', '/admin/venues/');
    expect(venueSelect()).toBeDisabled();
    expect(create()).toBeEnabled();
    await fillBasics(user);
    await user.click(create());
    expect(await screen.findByText(MISSING_FIELDS_MESSAGE)).toBeInTheDocument();
    expect(calls.some(call => call.url.includes('/Workshop/Post'))).toBe(false);
  });

  test.each([
    ['the description', async (user: User) => {
      await user.type(screen.getByRole('textbox', { name: 'Titolo' }), 'Agenda Day');
      fireEvent.change(screen.getByLabelText("Data dell'evento"), { target: { value: '2027-06-21' } });
      await pickVenue(user);
    }],
    ['a chosen venue', async (user: User) => {
      await fillBasics(user);
      await user.type(screen.getByRole('textbox', { name: 'Nome' }), 'Typed by hand');
      await user.type(screen.getByRole('textbox', { name: 'Indirizzo' }), 'Somewhere 1');
    }],
    ['the location address', async (user: User) => {
      await fillBasics(user);
      await pickVenue(user);
      await user.clear(screen.getByRole('textbox', { name: 'Indirizzo' }));
    }],
  ])('does not post without %s and shows the single message, as before', async (_label, prepare) => {
    const user = userEvent.setup();
    const calls = serve(venuesFixture, jsonResponse({ workshopId: '00112233-4455-6677-8899-aabbccddeeff' }, 201));
    renderPage();
    await waitFor(() => expect(venueSelect()).toBeEnabled());
    await prepare(user);
    await user.click(create());
    expect(await screen.findByText(MISSING_FIELDS_MESSAGE)).toBeInTheDocument();
    expect(calls.some(call => call.url.includes('/Workshop/Post'))).toBe(false);
    expect(screen.getByTestId('current-path')).toHaveTextContent('/admin/workshop/create');
  });

  test('reports a failed venue list and keeps the form usable', async () => {
    serve(() => new Response(null, { status: 500 }), jsonResponse({}, 201));
    renderPage();
    expect(await screen.findByText(/Impossibile caricare le sedi/)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Titolo' })).toBeEnabled();
    expect(screen.getByRole('link', { name: 'Annulla' })).toHaveAttribute('href', '/admin/workshops/');
  });
});

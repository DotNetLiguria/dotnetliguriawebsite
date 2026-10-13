import React from 'react';
import { Route, Routes } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { jsonResponse, mockApi, render, screen, waitFor, within } from '../../test-utils';
import { AdminToastRegion, adminToasts } from '../toasts';
import VenuesPage, { mapsHref, parseCoordinates, pastVenuesOf } from './VenuesPage';

// The toast queue is shared by the whole admin: start every test without leftovers.
beforeEach(() => { for (const toast of adminToasts.visibleToasts) adminToasts.close(toast.key); });

const venues = [
  { venueId: 'v1', name: 'Confindustria', address: 'Via Minzoni 2, 19100 La Spezia', coordinates: '44.1025, 9.8241', googleMapsUrl: 'https://maps.app.goo.gl/confindustria', maximumSpaces: 80 },
  { venueId: 'v2', name: 'Ordine Ingegneri Genova', address: 'Piazza della Vittoria 11/10, Genova', coordinates: '', googleMapsUrl: '', maximumSpaces: 0 },
  { venueId: 'v3', name: 'Sala senza indirizzo', address: '', coordinates: '44.4, 8.9', googleMapsUrl: null, maximumSpaces: 0 },
];
const workshops = [
  { workshopId: 'w1', title: 'AI Generativa', eventDate: '2025-06-12T00:00:00+02:00', location: { name: 'Confindustria', address: 'Via Minzoni 2, 19100 La Spezia', coordinates: '44.1025, 9.8241', googleMapsUrl: 'https://maps.app.goo.gl/confindustria', maximumSpaces: 80 } },
  { workshopId: 'w2', title: 'Blazor Day', eventDate: '2024-12-05T00:00:00+01:00', location: { name: 'Ordine Ingegneri Genova', address: '', coordinates: '', googleMapsUrl: '' } },
  { workshopId: 'w3', title: 'Cloud Day', eventDate: '2023-06-10T00:00:00+02:00', location: { name: 'Ordine ingegneri genova', address: 'Piazza della Vittoria 11/10, Genova', coordinates: '44.4056, 8.9463', googleMapsUrl: '' } },
  { workshopId: 'w4', title: 'Community Day', eventDate: '2022-10-01T00:00:00+02:00', location: { name: 'Sala Polivalente', address: '', coordinates: '', googleMapsUrl: '' } },
  { workshopId: 'w5', title: 'Online', eventDate: '2021-03-01T00:00:00+01:00', location: null },
];

const renderAt = (route: string) => render(
  <>
    <Routes><Route path="/admin/venues/" element={<VenuesPage />} /></Routes>
    <AdminToastRegion />
  </>,
  { route },
);

describe('venue helpers', () => {
  test('parse coordinates, build the map link and merge the venues of past events', () => {
    expect(parseCoordinates('44.4056, 8.9463')).toEqual({ lat: 44.4056, lng: 8.9463 });
    expect(parseCoordinates('44.4056;8.9463')).toEqual({ lat: 44.4056, lng: 8.9463 });
    expect(parseCoordinates('nord 44')).toBeNull();
    expect(parseCoordinates('91, 8')).toBeNull();
    expect(mapsHref({ googleMapsUrl: 'https://maps.app.goo.gl/x', coordinates: null })).toBe('https://maps.app.goo.gl/x');
    expect(mapsHref({ googleMapsUrl: 'javascript:alert(1)', coordinates: '44.4, 8.9' })).toBe('https://www.google.com/maps?q=44.4,8.9');
    expect(mapsHref({ googleMapsUrl: '', coordinates: '' })).toBeNull();
    expect(pastVenuesOf(workshops).map(v => [v.name, v.address, v.coordinates, v.events, v.maximumSpaces])).toEqual([
      ['Confindustria', 'Via Minzoni 2, 19100 La Spezia', '44.1025, 9.8241', 1, 80],
      ['Ordine Ingegneri Genova', 'Piazza della Vittoria 11/10, Genova', '44.4056, 8.9463', 2, 0],
      ['Sala Polivalente', '', '', 1, 0],
    ]);
  });
});

describe('<VenuesPage />', () => {
  test('lists venues with map links, flags missing data and filters by search', async () => {
    const user = userEvent.setup({ delay: null });
    mockApi({ '/Venue': venues, '/Workshop/Get': workshops });
    renderAt('/admin/venues/');
    expect(await screen.findByText('3 sedi salvate, 1 senza indirizzo.')).toBeInTheDocument();
    const table = screen.getByRole('table');
    expect(within(table).getByRole('link', { name: 'Confindustria' })).toHaveAttribute('href', '/admin/venues/?sede=v1');
    expect(within(table).getByRole('link', { name: 'Modifica Confindustria' })).toHaveAttribute('href', '/admin/venues/?sede=v1&azione=modifica');
    const maps = within(table).getAllByRole('link', { name: /Apri la mappa/ });
    expect(maps.map(link => link.getAttribute('href'))).toEqual(['https://maps.app.goo.gl/confindustria', 'https://www.google.com/maps?q=44.4,8.9']);
    expect(within(table).getAllByText('Senza indirizzo')).toHaveLength(1);
    expect(within(table).getAllByText('Senza mappa')).toHaveLength(1);
    expect(screen.getByText('3 di 3 sedi')).toBeInTheDocument();

    await user.type(screen.getByRole('searchbox', { name: 'Cerca una sede' }), 'genova');
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(2);
    expect(screen.getByText('1 di 3 sedi')).toBeInTheDocument();
  });

  test('offers to save the venues of past events when none is saved yet', async () => {
    const user = userEvent.setup({ delay: null });
    const posted: Record<string, unknown>[] = [];
    let saved: Record<string, unknown>[] = [];
    mockApi({
      '/Venue': (_url: string, init?: RequestInit) => {
        if (init?.method !== 'POST') return jsonResponse(saved);
        const body = JSON.parse(String(init.body)) as Record<string, unknown>;
        posted.push(body);
        saved = [...saved, { venueId: `new-${posted.length}`, ...body }];
        return jsonResponse(saved[saved.length - 1], 201);
      },
      '/Workshop/Get': workshops,
    });
    renderAt('/admin/venues/');
    expect(await screen.findByRole('heading', { name: 'Nessuna sede salvata' })).toBeInTheDocument();
    const list = await screen.findByRole('list', { name: 'Sedi trovate negli eventi passati' });
    const boxes = within(list).getAllByRole('checkbox');
    expect(boxes).toHaveLength(3);
    expect(boxes.every(box => (box as HTMLInputElement).checked)).toBe(true);
    expect(within(list).getByText("Piazza della Vittoria 11/10, Genova · 2 eventi, l'ultimo a dicembre 2024")).toBeInTheDocument();
    expect(within(list).getByText("Indirizzo da completare · 1 evento, l'ultimo a ottobre 2022")).toBeInTheDocument();
    expect(within(list).getAllByText('Senza indirizzo')).toHaveLength(1);

    await user.click(boxes[2]);
    await user.click(screen.getByRole('button', { name: 'Salva 2 sedi' }));
    await waitFor(() => expect(posted).toEqual([
      { name: 'Confindustria', address: 'Via Minzoni 2, 19100 La Spezia', coordinates: '44.1025, 9.8241', googleMapsUrl: 'https://maps.app.goo.gl/confindustria', maximumSpaces: 80 },
      { name: 'Ordine Ingegneri Genova', address: 'Piazza della Vittoria 11/10, Genova', coordinates: '44.4056, 8.9463', googleMapsUrl: null, maximumSpaces: 0 },
    ]));
    expect(await screen.findByText('2 sedi salvate')).toBeInTheDocument();
    const table = await screen.findByRole('table');
    expect(within(table).getByRole('link', { name: 'Ordine Ingegneri Genova' })).toBeInTheDocument();
  });

  test('opens the venue card from the address, validates coordinates and map link, then saves', async () => {
    const user = userEvent.setup({ delay: null });
    const saved: Record<string, unknown>[] = [];
    mockApi({
      '/Venue/v1': (_url: string, init?: RequestInit) => { saved.push(JSON.parse(String(init?.body))); return new Response(null, { status: 204 }); },
      '/Venue': venues, '/Workshop/Get': workshops,
    });
    renderAt('/admin/venues/?sede=v1');
    const card = await screen.findByRole('dialog', { name: 'Confindustria' });
    expect(within(card).getByRole('link', { name: /Apri la mappa/ })).toHaveAttribute('href', 'https://maps.app.goo.gl/confindustria');
    expect(within(card).getByRole('link', { name: /AI Generativa/ })).toHaveAttribute('href', '/admin/workshop/w1');

    await user.click(within(card).getByRole('button', { name: 'Modifica' }));
    const coordinates = within(card).getByRole('textbox', { name: 'Coordinate' });
    const maps = within(card).getByRole('textbox', { name: 'Link a Google Maps' });
    await user.clear(coordinates);
    await user.type(coordinates, 'nord 44');
    await user.clear(maps);
    await user.type(maps, 'maps.google.com/x');
    await user.click(within(card).getByRole('button', { name: 'Salva' }));
    expect(within(card).getByText(/Usa latitudine e longitudine/)).toBeInTheDocument();
    expect(within(card).getByText(/indirizzo web completo/)).toBeInTheDocument();
    expect(saved).toHaveLength(0);

    await user.clear(coordinates);
    await user.type(coordinates, '44.1025, 9.8241');
    await user.clear(maps);
    await user.click(within(card).getByRole('button', { name: 'Salva' }));
    await waitFor(() => expect(saved).toEqual([expect.objectContaining({ venueId: 'v1', name: 'Confindustria', address: 'Via Minzoni 2, 19100 La Spezia', coordinates: '44.1025, 9.8241', googleMapsUrl: null, maximumSpaces: 80 })]));
    expect(await screen.findByText('Sede aggiornata')).toBeInTheDocument();
  });

  test('requires name and address for a new venue, creates it and opens its card', async () => {
    const user = userEvent.setup({ delay: null });
    const created: Record<string, unknown>[] = [];
    let list = venues;
    mockApi({
      '/Venue': (_url: string, init?: RequestInit) => {
        if (init?.method !== 'POST') return jsonResponse(list);
        const body = JSON.parse(String(init.body)) as Record<string, unknown>;
        created.push(body);
        const venue = { venueId: 'v9', ...body } as typeof venues[number];
        list = [...list, venue];
        return jsonResponse(venue, 201);
      },
      '/Workshop/Get': workshops,
    });
    renderAt('/admin/venues/?sede=nuova');
    const dialog = await screen.findByRole('dialog', { name: 'Nuova sede' });
    await user.click(within(dialog).getByRole('button', { name: 'Salva' }));
    expect(within(dialog).getByText('Il nome è obbligatorio.')).toBeInTheDocument();
    expect(within(dialog).getByText("L'indirizzo è obbligatorio.")).toBeInTheDocument();
    expect(created).toHaveLength(0);

    await user.type(within(dialog).getByRole('textbox', { name: /Nome/ }), 'Sala Nuova');
    await user.type(within(dialog).getByRole('textbox', { name: /Indirizzo/ }), 'Via Roma 1, Genova');
    const seats = within(dialog).getByRole('spinbutton', { name: 'Posti disponibili' });
    await user.clear(seats);
    await user.type(seats, '50');
    await user.click(within(dialog).getByRole('button', { name: 'Salva' }));
    await waitFor(() => expect(created).toEqual([{ name: 'Sala Nuova', address: 'Via Roma 1, Genova', coordinates: null, googleMapsUrl: null, maximumSpaces: 50 }]));
    expect(await screen.findByText('Sede creata')).toBeInTheDocument();
    expect(await screen.findByRole('dialog', { name: 'Sala Nuova' })).toBeInTheDocument();
  });

  test('deletes after an explicit confirmation and reports failures', async () => {
    const user = userEvent.setup({ delay: null });
    let attempts = 0;
    mockApi({
      '/Venue/v2': () => (++attempts === 1 ? new Response(null, { status: 409 }) : new Response(null, { status: 204 })),
      '/Venue': venues, '/Workshop/Get': workshops,
    });
    renderAt('/admin/venues/?sede=v2&azione=elimina');
    const card = await screen.findByRole('dialog', { name: 'Ordine Ingegneri Genova' });
    expect(within(card).getByText('Eliminare Ordine Ingegneri Genova?')).toBeInTheDocument();
    await user.click(within(card).getByRole('button', { name: 'Elimina' }));
    expect(await screen.findByText('Eliminazione non riuscita')).toBeInTheDocument();
    expect(screen.getByText('Errore HTTP: 409')).toBeInTheDocument();
    await user.click(within(card).getByRole('button', { name: 'Elimina' }));
    expect(await screen.findByText('Sede eliminata')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  test('reports a failed load and retries', async () => {
    const user = userEvent.setup({ delay: null });
    let calls = 0;
    mockApi({ '/Venue': () => (++calls === 1 ? new Response('', { status: 500 }) : jsonResponse(venues)), '/Workshop/Get': workshops });
    renderAt('/admin/venues/');
    expect(await screen.findByRole('alert')).toHaveTextContent('Errore HTTP: 500');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Riprova' }));
    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

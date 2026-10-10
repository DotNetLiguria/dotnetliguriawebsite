import React from 'react';
import { Route, Routes } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { fireEvent, jsonResponse, mockApi, render, screen, waitFor, within } from '../../test-utils';
import EventDetailPage from './EventDetailPage';

const ID = '89d23964-f3cd-4ca8-9e65-d15251e0b6a1';
const workshop = (extra: Record<string, unknown> = {}) => ({
  workshopId: ID,
  title: 'AI Generativa: analisi pragmatica',
  description: 'Una giornata sulle novità della AI generativa.',
  eventDate: '2025-06-12T00:00:00+02:00',
  image: '/workshops/workshop040/workshop.png',
  tags: 'AI, MCP',
  externalRegistration: true,
  externalRegistrationLink: 'https://iscrizioni.example.test',
  location: { name: 'Confindustria', address: 'Via Minzoni 2, La Spezia', coordinates: '44.1042,9.8220' },
  tracks: [
    { workshopTrackId: 't1', title: 'Gemini versus ChatGPT', startTime: '2025-12-06T15:00:00Z', endTime: '2025-12-06T15:40:00Z', speakersName: 'Andrea Merlin' },
    { workshopTrackId: 't2', title: 'Ricerca semantica', startTime: '2025-12-06T15:40:00Z', endTime: '2025-12-06T16:20:00Z', speakersName: 'Giampaolo Tucci , Andrea Merlin' },
  ],
  materials: [{ workshopFileId: 'm1', title: 'Slide Gemini', fileName: 'gemini.pdf', fullPath: '/workshops/workshop040/gemini.pdf' }],
  photos: [],
  ...extra,
});

const renderAt = (id = ID) => render(
  <Routes><Route path="/workshop/:id" element={<EventDetailPage />} /></Routes>,
  { route: `/workshop/${id}` },
);

describe('<EventDetailPage />', () => {
  test('presents a past event with programme, speakers, materials and topics, without registration', async () => {
    mockApi({ [`/Workshop/Get/${ID}`]: workshop({ attendeeNotes: 'Porta il portatile.' }), '/Speaker/Get': [{ workshopSpeakerId: 's1', name: 'Andrea Merlin ', profileImageUrl: '/Uploads/speakers/old.jpg' }] });
    renderAt();

    expect(await screen.findByRole('heading', { level: 1, name: 'AI Generativa: analisi pragmatica' })).toBeInTheDocument();
    expect(screen.getAllByText('Concluso').length).toBeGreaterThan(0);
    expect(screen.queryByRole('link', { name: /Iscriviti/ })).not.toBeInTheDocument();
    expect(screen.getAllByText('16:00–17:20').length).toBeGreaterThan(0);

    const speakers = screen.getByRole('region', { name: 'Relatori' });
    expect(within(speakers).getAllByRole('listitem').map(li => li.textContent)).toEqual(['Andrea Merlin2 sessioni', 'Giampaolo Tucci1 sessione']);
    const material = screen.getByRole('link', { name: /Slide Gemini/ });
    expect(material.getAttribute('href')).toMatch(/\/Contents\/workshops\/workshop040\/gemini\.pdf$/);
    expect(within(screen.getByRole('region', { name: 'Argomenti' })).getAllByRole('listitem').map(li => li.textContent)).toEqual(['AI', 'MCP']);
    expect(within(screen.getByRole('main')).getByRole('link', { name: 'Eventi passati' })).toHaveAttribute('href', '/workshops');
    expect(screen.queryByRole('region', { name: 'Note per chi partecipa' })).not.toBeInTheDocument();
  });

  test('shows the agenda with speaker photos and biographies, attendee notes, seat booking and the venue map', async () => {
    const user = userEvent.setup();
    mockApi({
      [`/Workshop/Get/${ID}`]: workshop({
        eventDate: '2099-03-15T00:00:00+01:00',
        agendaTracks: [{ workshopAgendaTrackId: 'a', name: 'Sala grande', order: 0 }, { workshopAgendaTrackId: 'b', name: 'Sala piccola', order: 1 }],
        talks: [{
          workshopTalkId: 'talk-1', title: 'Strumenti utili', abstract: 'Come progettare strumenti utili.', sessionType: 'panel',
          speakers: [{ workshopSpeakerId: 's1', name: 'Ada Lovelace', imageUrl: 'https://images.example.test/ada.jpg', biography: 'Matematica e prima programmatrice.' }],
        }],
        agendaItems: [
          { workshopAgendaItemId: 'i1', itemType: 'talk', talkId: 'talk-1', trackId: 'a', roomName: 'Aula A', startTime: '2099-03-15T10:00:00Z', endTime: '2099-03-15T11:00:00Z' },
          { workshopAgendaItemId: 'i2', itemType: 'break', trackId: 'a', title: 'Technical gap', startTime: '2099-03-15T11:00:00Z', endTime: '2099-03-15T11:05:00Z' },
          { workshopAgendaItemId: 'i3', itemType: 'service', trackId: null, title: 'Service interval', startTime: '2099-03-15T11:05:00Z', endTime: '2099-03-15T11:30:00Z' },
        ],
        location: { name: 'Genova', address: 'Via del Porto 1', coordinates: '44.4056,8.9463', googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=Genova' },
        bookingServiceUrl: 'https://booking.example.test/event/1',
        attendeeNotes: 'Porta il portatile.',
      }),
    });
    renderAt();

    const agenda = await screen.findByRole('region', { name: 'Programma' });
    expect(within(agenda).getAllByRole('heading', { level: 4 }).map(h => h.textContent)).toEqual(['Strumenti utili', 'Pausa']);
    expect(within(agenda).getByText(/Sala grande · Aula A · Panel/)).toBeInTheDocument();
    expect(within(agenda).getByText('Come progettare strumenti utili.')).toBeInTheDocument();
    expect(screen.queryByText('Gemini versus ChatGPT')).not.toBeInTheDocument();
    expect(screen.getByText('1 sessione', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getAllByText('11:00–12:30').length).toBeGreaterThan(0);

    const speakers = screen.getByRole('region', { name: 'Relatori' });
    expect(within(speakers).getByRole('listitem').querySelector('img')).toHaveAttribute('src', 'https://images.example.test/ada.jpg');
    await user.click(within(speakers).getByRole('button', { name: 'Leggi la biografia di Ada Lovelace' }));
    expect(within(speakers).getByText('Matematica e prima programmatrice.')).toBeVisible();

    expect(within(screen.getByRole('region', { name: 'Note per chi partecipa' })).getByText('Porta il portatile.')).toBeInTheDocument();
    for (const link of screen.getAllByRole('link', { name: /Prenota o annulla il posto/ })) {
      expect(link).toHaveAttribute('href', 'https://booking.example.test/event/1');
    }
    expect(screen.queryByRole('link', { name: /Iscriviti all'evento/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Apri la mappa/ })).toHaveAttribute('href', 'https://www.google.com/maps/search/?api=1&query=Genova');
  });

  test('loads the event from the published list when the single lookup answers 404', async () => {
    mockApi({
      [`/Workshop/Get/${ID}`]: () => jsonResponse({ status: 404 }, 404),
      '/Workshop/Get?onlyPublished=true': [workshop({ title: 'Dal fallback', eventDate: '2099-01-10T00:00:00+01:00' })],
    });
    renderAt();
    expect(await screen.findByRole('heading', { level: 1, name: 'Dal fallback' })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /Iscriviti all'evento/ })[0]).toHaveAttribute('href', 'https://iscrizioni.example.test');
  });

  test('says when an event does not exist instead of reporting an error', async () => {
    renderAt('non-esiste');
    expect(await screen.findByRole('heading', { level: 1, name: 'Evento non trovato' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalledWith(expect.stringContaining('/Workshop/Get/non-esiste'), expect.anything());
  });

  test('sanitises the free HTML block and falls back to initials for missing speaker photos', async () => {
    mockApi({
      [`/Workshop/Get/${ID}`]: workshop({ blogHtml: '<p>Testo <strong>sicuro</strong></p><img src="x" onerror="alert(1)"><script>alert(2)</script>' }),
    });
    renderAt();
    const extra = await screen.findByRole('region', { name: 'Approfondimento' });
    expect(within(extra).getByText('sicuro')).toBeInTheDocument();
    expect(extra.innerHTML).not.toMatch(/onerror|<script/i);

    const speakers = screen.getByRole('region', { name: 'Relatori' });
    const photo = within(speakers).getAllByRole('listitem')[1].querySelector('img')!;
    for (let attempt = 0; attempt < 4; attempt++) fireEvent.error(within(speakers).getAllByRole('listitem')[1].querySelector('img') ?? photo);
    await waitFor(() => expect(within(speakers).getAllByRole('listitem')[1].querySelector('img')).toBeNull());
    expect(within(speakers).getByText('GT')).toBeInTheDocument();
  });
});

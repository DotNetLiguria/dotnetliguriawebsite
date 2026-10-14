import React from 'react';
import userEvent from '@testing-library/user-event';
import { jsonResponse, mockApi, render, screen, within } from '../../test-utils';
import { resetPhotoCache } from '../adminApi';
import DashboardPage from './DashboardPage';

const past = {
  workshopId: 'w-past', title: 'AI Generativa', eventDate: '2025-06-12T00:00:00+02:00', published: true,
  description: 'Una giornata sulla AI.', image: '/workshops/w040/workshop.png', location: { name: 'Confindustria' },
  tracks: [
    { workshopTrackId: 't1', title: 'Registrazione', startTime: '2025-06-12T12:00:00Z', endTime: '2025-06-12T12:30:00Z' },
    { workshopTrackId: 't2', title: 'Introduzione', startTime: '2025-06-12T12:30:00Z', endTime: '2025-06-12T13:00:00Z', speakersName: 'Ada Lovelace' },
  ],
  materials: [], photos: [], feedbackEnabled: false,
};
const upcoming = { ...past, workshopId: 'w-next', title: 'Season of AI', eventDate: '2099-05-07T00:00:00+02:00', published: false, bookingServiceUrl: '', tracks: [] };
const speakers = [
  { workshopSpeakerId: 's1', name: 'Ada Lovelace', profileImageUrl: '/Uploads/speakers/ada.jpg' },
  { workshopSpeakerId: 's2', name: 'Angelo Ferrando' },
  { workshopSpeakerId: 's3', name: 'Angelo  Ferrando' },
];
// Only Ada has a photo in /Contents/speakers (the build lists the shipped files; here the list is faked).
vi.mock('virtual:content-photos', () => ({ default: ['speakers/ada_lovelace.jpg'] }));
const contents = (url: string) => (url.includes('speakers/ada_lovelace.jpg')
  ? new Response('', { status: 200, headers: { 'Content-Type': 'image/jpeg' } })
  : new Response('', { status: 404 }));

beforeEach(() => resetPhotoCache());

describe('<DashboardPage />', () => {
  test('without an upcoming event it teaches how to create one and lists what is left after the last event', async () => {
    mockApi({ '/Workshop/Get': [past], '/Speaker/Get': speakers, '/Board/Get': [{}, {}], '/Venue': [], '/Contents/': contents });
    render(<DashboardPage />, { route: '/admin' });

    expect(screen.getByRole('heading', { level: 1, name: 'Ciao, Test' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Nessun evento in programma' })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /Nuovo evento/ })).toHaveLength(1);

    const latest = screen.getByRole('region', { name: /Dopo l'evento/ });
    expect(within(latest).getByRole('link', { name: 'AI Generativa' })).toHaveAttribute('href', '/admin/workshop/w-past');
    expect(within(latest).getByText('1 sessione con 1 relatore')).toBeInTheDocument();
    expect(within(latest).getByRole('link', { name: /Carica materiali/ })).toHaveAttribute('href', '/admin/workshop/w-past#materiali');

    const todo = screen.getByRole('region', { name: 'Da sistemare' });
    expect(await within(todo).findByRole('link', { name: /2 relatori senza foto/ })).toHaveAttribute('href', '/admin/speakers/?filtro=senza-foto');
    expect(within(todo).getByRole('link', { name: /1 relatore doppio/ })).toHaveAttribute('href', '/admin/speakers/s2');
    expect(within(todo).getByRole('link', { name: /Nessuna sede salvata/ })).toHaveAttribute('href', '/admin/venues/');
    expect(within(todo).getByRole('link', { name: /1 evento senza materiali/ })).toBeInTheDocument();

    const archive = screen.getByRole('region', { name: 'In archivio' });
    expect(within(archive).getByRole('link', { name: /Relatori\s*3 · 3 attivi/ })).toHaveAttribute('href', '/admin/speakers/');
    expect(within(archive).getByRole('link', { name: /Board\s*2/ })).toBeInTheDocument();
  });

  test('checks the upcoming event before publication', async () => {
    mockApi({ '/Workshop/Get': [past, upcoming], '/Speaker/Get': [], '/Board/Get': [], '/Venue': [{ venueId: 'v1', name: 'Confindustria' }] });
    render(<DashboardPage />, { route: '/admin' });

    const next = await screen.findByRole('region', { name: 'Prossimo evento' });
    expect(within(next).getByRole('link', { name: 'Season of AI' })).toHaveAttribute('href', '/admin/workshop/w-next');
    expect(within(next).getByText(/Nessuna sessione/)).toBeInTheDocument();
    expect(within(next).getByRole('link', { name: 'Aggiungi il link' })).toHaveAttribute('href', '/admin/workshop/w-next#iscrizione');
    expect(within(next).getByRole('link', { name: "Prepara l'agenda" })).toHaveAttribute('href', '/admin/workshop/w-next#agenda');
    expect(within(next).getByRole('link', { name: 'Pubblica' })).toHaveAttribute('href', '/admin/workshop/w-next#pubblicazione');
    expect(within(next).getByRole('link', { name: 'Pubblica' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Nuovo evento/ })).toHaveAttribute('href', '/admin/workshop/create');

    const archive = screen.getByRole('region', { name: 'In archivio' });
    expect(within(archive).getByRole('link', { name: /Eventi\s*2 · 1 in bozza/ })).toBeInTheDocument();
    const recent = screen.getByRole('region', { name: 'Ultimi eventi' });
    expect(within(recent).getAllByRole('link').filter(l => l.getAttribute('href')?.startsWith('/admin/workshop/')).map(l => l.querySelector('.font-bold')?.textContent)).toEqual(['Season of AI', 'AI Generativa']);
    expect(within(recent).getByText('Bozza')).toBeInTheDocument();
  });

  test('shows a blank poster when the upcoming event has no image', async () => {
    mockApi({ '/Workshop/Get': [{ ...upcoming, image: '' }], '/Speaker/Get': [], '/Board/Get': [], '/Venue': [] });
    render(<DashboardPage />, { route: '/admin' });

    const next = await screen.findByRole('region', { name: 'Prossimo evento' });
    expect(within(next).getByRole('img', { name: 'Immagine non disponibile' })).toBeInTheDocument();
  });

  test('reports a failed load with a retry instead of an empty dashboard', async () => {
    const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
    let calls = 0;
    mockApi({ '/Workshop/Get': () => (++calls === 1 ? jsonResponse({}, 503) : jsonResponse([past])), '/Speaker/Get': [], '/Venue': [] });
    render(<DashboardPage />, { route: '/admin' });
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Gli eventi non sono disponibili (Errore HTTP: 503).');
    await user.click(within(alert).getByRole('button', { name: 'Riprova' }));
    expect(await screen.findByRole('link', { name: 'AI Generativa' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

import React from 'react';
import userEvent from '@testing-library/user-event';
import { jsonResponse, mockApi, render, screen, waitFor, within } from '../../test-utils';
import HomePage from './HomePage';

const event = (id: string, title: string, eventDate: string, extra: Record<string, unknown> = {}) => ({
  workshopId: id, title, eventDate, description: `Descrizione di ${title}`, image: `/workshops/${id}/workshop.png`,
  location: { name: 'Confindustria', address: 'Via Minzoni 2, La Spezia', coordinates: '44.1042,9.8220' },
  tracks: [], ...extra,
});
const notFound = () => jsonResponse({ status: 404 }, 404);

describe('<HomePage />', () => {
  test('features an upcoming event with external registration and the programme in Italian time', async () => {
    const upcoming = event('next', 'Season of AI', '2099-05-07T00:00:00+02:00', {
      externalRegistration: true,
      externalRegistrationLink: 'https://iscrizioni.example.test/season',
      tracks: [
        { workshopTrackId: 't2', title: 'MCP in pratica', startTime: '2099-05-07T13:00:00Z', endTime: '2099-05-07T13:45:00Z', speakersName: 'Andrea Merlin ' },
        { workshopTrackId: 't1', title: 'Introduzione', startTime: '2099-05-07T12:15:00Z', endTime: '2099-05-07T12:45:00Z', speakersName: 'Raffaele Rialdi' },
      ],
    });
    mockApi({ '/Workshop/GetInHomePage/HomePage': upcoming, '/Workshop/Get?onlyPublished=true': [upcoming] });
    render(<HomePage />);

    const evidence = await screen.findByRole('region', { name: 'Season of AI' });
    expect(within(evidence).getByText('In programma')).toBeInTheDocument();
    const sessions = within(evidence).getAllByRole('heading', { level: 4 }).map(h => h.textContent);
    expect(sessions).toEqual(['Introduzione', 'MCP in pratica']);
    expect(within(evidence).getByText('14:15–14:45')).toBeInTheDocument();
    const register = within(evidence).getByRole('link', { name: /Iscriviti all'evento/ });
    expect(register).toHaveAttribute('href', 'https://iscrizioni.example.test/season');
    expect(register).toHaveAttribute('target', '_blank');
    expect(within(evidence).getByRole('link', { name: 'Dettagli e materiali' })).toHaveAttribute('href', '/workshop/next');
  });

  test('without a featured event it shows the preparation state and the latest events, newest first', async () => {
    const list = Array.from({ length: 8 }, (_, i) => event(`e${i}`, `Evento ${i}`, `2024-0${i + 1}-10T00:00:00+02:00`));
    mockApi({ '/Workshop/GetInHomePage/HomePage': notFound, '/Workshop/Get?onlyPublished=true': list });
    render(<HomePage />);

    expect(await screen.findByRole('heading', { name: 'Il prossimo incontro è in preparazione' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: "Rivedi l'ultimo evento" })).toHaveAttribute('href', '#evidence');
    const recent = screen.getByRole('region', { name: 'Eventi recenti' });
    const titles = within(recent).getAllByRole('heading', { level: 3 }).map(h => h.textContent);
    expect(titles).toEqual(['Evento 7', 'Evento 6', 'Evento 5', 'Evento 4', 'Evento 3', 'Evento 2']);
    expect(within(recent).getByRole('link', { name: 'Evento 7' })).toHaveAttribute('href', '/workshop/e7');
    expect(within(recent).getByText("8 eventi nell'archivio, dal 2024 a oggi.")).toBeInTheDocument();
  });

  test('links the open feedback questionnaire of the event on show', async () => {
    const past = event('w1', 'AI Generativa', '2025-06-12T00:00:00+02:00');
    mockApi({
      '/PublicQuestionnaire/by-workshop/w1': { questionnaireId: 'q1', title: 'Feedback', availability: 'Open' },
      '/Workshop/GetInHomePage/HomePage': notFound,
      '/Workshop/Get?onlyPublished=true': [past],
    });
    render(<HomePage />);
    expect(await screen.findByRole('link', { name: /Lascia un commento/ })).toHaveAttribute('href', '/feedback/w1');
    expect(screen.getByText('Ultimo evento')).toBeInTheDocument();
    expect(screen.getAllByText('Concluso').length).toBeGreaterThan(0);
  });

  test('presents the team in board order with expandable biographies and safe links only', async () => {
    const user = userEvent.setup();
    const bio = 'Mi occupo professionalmente di sviluppo software dal 1987 e mi sono specializzato nelle tecnologie Microsoft. '.repeat(3);
    mockApi({
      '/Board/Get?onlyActive=true': [
        { boardId: 'b2', name: 'Seconda Persona', description: 'Consigliere', order: 2, lInkedinUrl: 'javascript:alert(1)' },
        { boardId: 'b1', name: 'Prima Persona', description: 'Presidente', order: 1, fullBio: bio, twitterUrl: 'https://x.example.test/prima' },
      ],
    });
    render(<HomePage />);
    const team = await screen.findByRole('region', { name: 'Il team' });
    await waitFor(() => expect(within(team).getAllByRole('heading', { level: 3 }).map(h => h.textContent)).toEqual(['Prima Persona', 'Seconda Persona']));

    const more = within(team).getByRole('button', { name: 'Leggi di più su Prima Persona' });
    expect(more).toHaveAttribute('aria-expanded', 'false');
    await user.click(more);
    expect(within(team).getByRole('button', { name: 'Mostra meno su Prima Persona' })).toHaveAttribute('aria-expanded', 'true');
    expect(within(team).getByText(bio.trim())).toBeVisible();
    expect(within(team).getByRole('link', { name: /^X/ })).toHaveAttribute('href', 'https://x.example.test/prima');
    expect(within(team).queryByRole('link', { name: /LinkedIn/ })).not.toBeInTheDocument();
  });

  test('marks the sections that have no backend yet', async () => {
    mockApi({ '/Workshop/GetInHomePage/HomePage': notFound });
    render(<HomePage />);
    for (const name of ['Proponi un talk', 'Seguici']) {
      const section = await screen.findByRole('region', { name });
      expect(within(section).getByText('Da completare')).toBeInTheDocument();
    }
  });

  test('lets the visitor retry when the event list cannot be loaded', async () => {
    const user = userEvent.setup();
    let calls = 0;
    mockApi({
      '/Workshop/GetInHomePage/HomePage': notFound,
      '/Workshop/Get?onlyPublished=true': () => (++calls === 1 ? jsonResponse({}, 500) : jsonResponse([event('ok', 'Evento ripreso', '2024-03-10T00:00:00+02:00')])),
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<HomePage />);
    const recent = screen.getByRole('region', { name: 'Eventi recenti' });
    expect(await within(recent).findByText(/L'elenco degli eventi non è disponibile \(Errore HTTP: 500\)/)).toBeInTheDocument();
    await user.click(within(recent).getByRole('button', { name: 'Riprova' }));
    expect(await within(recent).findByRole('link', { name: 'Evento ripreso' })).toHaveAttribute('href', '/workshop/ok');
  });
});

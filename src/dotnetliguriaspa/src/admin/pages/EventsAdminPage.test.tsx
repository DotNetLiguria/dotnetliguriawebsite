import React from 'react';
import userEvent from '@testing-library/user-event';
import { jsonResponse, mockApi, render, screen, within } from '../../test-utils';
import EventsAdminPage from './EventsAdminPage';

const event = (id: string, title: string, eventDate: string, extra: Record<string, unknown> = {}) => ({
  workshopId: id, title, eventDate, published: true, image: `/workshops/${id}/workshop.png`, location: { name: 'Confindustria' },
  tracks: [{ workshopTrackId: `${id}-t`, title: 'Talk', startTime: eventDate, endTime: eventDate, speakersName: 'Andrea Merlin' }],
  materials: [], ...extra,
});
const LIST = [
  event('a', 'Build After Party', '2023-06-23T00:00:00+02:00', { location: { name: 'Imperia' } }),
  event('b', '.NET Conf 2024', '2024-12-18T00:00:00+01:00', { in_homepage: true, materials: [{}, {}] }),
  event('c', 'AI Generativa', '2025-06-12T00:00:00+02:00', { tracks: [] }),
  event('d', 'Bozza futura', '2099-03-01T00:00:00+01:00', { published: false, tracks: [
    { workshopTrackId: 'd1', title: 'Uno', startTime: '2099-03-01T17:00:00Z', endTime: '2099-03-01T17:30:00Z', speakersName: 'Raffaele Rialdi' },
    { workshopTrackId: 'd2', title: 'Due', startTime: '2099-03-01T17:30:00Z', endTime: '2099-03-01T18:00:00Z', speakersName: 'Raffaele Rialdi' },
  ] }),
];
const table = () => screen.getByRole('table');
const titles = () => within(table()).getAllByRole('link').filter(l => l.getAttribute('href')?.startsWith('/admin/workshop/')).map(l => l.textContent);

describe('<EventsAdminPage />', () => {
  test('lists drafts too, newest first, with status badges and links to edit and to the public page', async () => {
    mockApi({ '/Workshop/Get?onlyPublished=false': LIST });
    render(<EventsAdminPage />, { route: '/admin/workshops/' });
    expect(await screen.findByText('4 eventi, dal 2023 a oggi · 1 in bozza.')).toBeInTheDocument();
    expect(titles()).toEqual(['Bozza futura', 'AI Generativa', '.NET Conf 2024', 'Build After Party']);
    const draft = within(table()).getByRole('link', { name: 'Bozza futura' }).closest('tr')!;
    expect(within(draft).getByText('Bozza')).toBeInTheDocument();
    expect(within(draft).getByText('In programma')).toBeInTheDocument();
    expect(within(draft).getByRole('link', { name: /Vedi sul sito: Bozza futura/ })).toHaveAttribute('href', '/workshop/d');
    expect(within(table()).getByRole('link', { name: '.NET Conf 2024' })).toHaveAttribute('href', '/admin/workshop/b');
    expect(screen.getByRole('link', { name: /Nuovo evento/ })).toHaveAttribute('href', '/admin/workshop/create');
    expect(screen.getByText('4 di 4 eventi')).toBeInTheDocument();
  });

  test('searches by title, venue or speaker and filters by year, drafts and featured', async () => {
    const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
    mockApi({ '/Workshop/Get?onlyPublished=false': LIST });
    render(<EventsAdminPage />, { route: '/admin/workshops/' });
    await screen.findByRole('table');

    await user.type(screen.getByRole('searchbox', { name: 'Cerca negli eventi' }), 'imperia');
    expect(titles()).toEqual(['Build After Party']);
    await user.clear(screen.getByRole('searchbox', { name: 'Cerca negli eventi' }));
    await user.type(screen.getByRole('searchbox', { name: 'Cerca negli eventi' }), 'rialdi');
    expect(titles()).toEqual(['Bozza futura']);
    await user.clear(screen.getByRole('searchbox', { name: 'Cerca negli eventi' }));

    await user.click(within(screen.getByRole('radiogroup', { name: 'Anno' })).getByRole('radio', { name: '2024' }));
    expect(titles()).toEqual(['.NET Conf 2024']);
    await user.click(within(screen.getByRole('radiogroup', { name: 'Anno' })).getByRole('radio', { name: 'Tutti' }));
    await user.click(screen.getByRole('button', { name: /Bozze/ }));
    expect(titles()).toEqual(['Bozza futura']);
    await user.click(screen.getByRole('button', { name: /Bozze/ }));
    await user.click(screen.getByRole('button', { name: 'In evidenza' }));
    expect(titles()).toEqual(['.NET Conf 2024']);
    await user.click(screen.getByRole('button', { name: 'In evidenza' }));
    await user.type(screen.getByRole('searchbox', { name: 'Cerca negli eventi' }), 'nessuno');
    await user.click(await screen.findByRole('button', { name: 'Azzera i filtri' }));
    expect(titles()).toHaveLength(4);
  });

  test('sorts by title and by sessions with accessible sort state', async () => {
    const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
    mockApi({ '/Workshop/Get?onlyPublished=false': LIST });
    render(<EventsAdminPage />, { route: '/admin/workshops/' });
    await screen.findByRole('table');
    expect(screen.getByRole('columnheader', { name: /Data/ })).toHaveAttribute('aria-sort', 'descending');
    await user.click(screen.getByRole('button', { name: 'Evento' }));
    expect(screen.getByRole('columnheader', { name: /Evento/ })).toHaveAttribute('aria-sort', 'ascending');
    expect(titles()).toEqual(['.NET Conf 2024', 'AI Generativa', 'Bozza futura', 'Build After Party']);
    await user.click(screen.getByRole('button', { name: 'Sessioni' }));
    expect(titles()[0]).toBe('Bozza futura');
  });

  test('handles a long archive: year select instead of pills, 25 rows at a time, no routine badges', async () => {
    const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
    const archive = Array.from({ length: 40 }, (_, i) => event(`e${i}`, `Evento ${i}`, `${2011 + Math.floor(i / 2.6)}-0${(i % 9) + 1}-10T00:00:00+02:00`));
    mockApi({ '/Workshop/Get?onlyPublished=false': archive });
    render(<EventsAdminPage />, { route: '/admin/workshops/' });
    await screen.findByRole('table');
    expect(screen.queryByRole('radiogroup', { name: 'Anno' })).not.toBeInTheDocument();
    expect(titles()).toHaveLength(25);
    expect(screen.getByText('25 di 40 eventi')).toBeInTheDocument();
    expect(within(table()).queryByText('Concluso')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Mostra altri 15' }));
    expect(titles()).toHaveLength(40);

    await user.click(screen.getByRole('button', { name: /Tutti gli anni/ }));
    await user.click(await screen.findByRole('option', { name: '2011' }));
    expect(titles()).toEqual(['Evento 2', 'Evento 1', 'Evento 0']);
    expect(screen.getByText('3 di 3 (su 40) eventi')).toBeInTheDocument();
  });

  test('reports a failed load with a retry', async () => {
    const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
    let calls = 0;
    mockApi({ '/Workshop/Get?onlyPublished=false': () => (++calls === 1 ? jsonResponse({}, 500) : jsonResponse(LIST)) });
    render(<EventsAdminPage />, { route: '/admin/workshops/' });
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Gli eventi non sono disponibili (Errore HTTP: 500).');
    await user.click(within(alert).getByRole('button', { name: 'Riprova' }));
    expect(await screen.findByRole('table')).toBeInTheDocument();
  });
});

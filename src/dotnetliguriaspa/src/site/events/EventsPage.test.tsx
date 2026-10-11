import React from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { jsonResponse, mockApi, render, screen, within } from '../../test-utils';
import EventsPage from './EventsPage';

const event = (id: string, title: string, eventDate: string) => ({ workshopId: id, title, eventDate, tracks: [], location: { name: 'Genova' } });
const LIST = [
  event('a', 'Build After Party', '2023-06-23T00:00:00+02:00'),
  event('b', '.NET Conf 2024', '2024-12-18T00:00:00+01:00'),
  event('c', 'AI Generativa', '2025-06-12T00:00:00+02:00'),
  event('d', 'IA dietro le quinte', '2024-11-08T00:00:00+01:00'),
];

function Search() {
  return <output aria-label="query">{useLocation().search}</output>;
}

const renderAt = (route = '/workshops') => render(
  <Routes><Route path="/workshops" element={<><EventsPage /><Search /></>} /></Routes>,
  { route },
);
const yearHeadings = () => screen.getAllByRole('heading', { level: 2 }).map(h => h.textContent);

describe('<EventsPage />', () => {
  test('groups the archive by year, newest first, and filters through a shareable year parameter', async () => {
    const user = userEvent.setup();
    mockApi({ '/Workshop/Get?onlyPublished=true': LIST });
    renderAt();

    expect(await screen.findByText(/4 incontri dal 2023 a oggi/)).toBeInTheDocument();
    expect(yearHeadings()).toEqual(['2025', '2024', '2023']);
    const year2024 = screen.getByRole('region', { name: '2024' });
    expect(within(year2024).getAllByRole('heading', { level: 3 }).map(h => h.textContent)).toEqual(['.NET Conf 2024', 'IA dietro le quinte']);

    const filter = screen.getByRole('radiogroup', { name: 'Filtra per anno' });
    expect(within(filter).getAllByRole('radio').map(r => r.textContent)).toEqual(['Tutti gli anni', '2025', '2024', '2023']);
    expect(document.title).toBe('Eventi passati · DotNetLiguria');
    expect(document.head.querySelector('meta[name="description"]')).toHaveAttribute('content', expect.stringContaining('dal 2023'));
    expect(document.head.querySelector('link[rel="canonical"]')).toHaveAttribute('href', `${window.location.origin}/workshops`);

    await user.click(within(filter).getByRole('radio', { name: '2023' }));
    expect(yearHeadings()).toEqual(['2023']);
    expect(screen.getByRole('link', { name: 'Build After Party' })).toHaveAttribute('href', '/workshop/a');
    expect(screen.getByLabelText('query')).toHaveTextContent('?anno=2023');
    // The year is a page of its own: title and canonical follow it.
    expect(document.title).toBe('Eventi 2023 · DotNetLiguria');
    expect(document.head.querySelector('link[rel="canonical"]')).toHaveAttribute('href', `${window.location.origin}/workshops?anno=2023`);

    await user.click(within(filter).getByRole('radio', { name: 'Tutti gli anni' }));
    expect(yearHeadings()).toEqual(['2025', '2024', '2023']);
  });

  test('opens directly on the year in the address and ignores unknown years', async () => {
    mockApi({ '/Workshop/Get?onlyPublished=true': LIST });
    const { unmount } = renderAt('/workshops?anno=2024');
    expect(await screen.findByRole('region', { name: '2024' })).toBeInTheDocument();
    expect(yearHeadings()).toEqual(['2024']);
    unmount();

    renderAt('/workshops?anno=1999');
    expect(await screen.findByRole('region', { name: '2025' })).toBeInTheDocument();
    expect(yearHeadings()).toEqual(['2025', '2024', '2023']);
    // An unknown year is not a page: the canonical goes back to the archive.
    expect(document.head.querySelector('link[rel="canonical"]')).toHaveAttribute('href', `${window.location.origin}/workshops`);
  });

  test('reports failures with a retry and shows an empty archive plainly', async () => {
    const user = userEvent.setup();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    let calls = 0;
    mockApi({ '/Workshop/Get?onlyPublished=true': () => (++calls === 1 ? jsonResponse({}, 503) : jsonResponse([])) });
    renderAt();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Errore HTTP: 503');
    await user.click(within(alert).getByRole('button', { name: 'Riprova' }));
    expect(await screen.findByText('Nessun evento trovato.')).toBeInTheDocument();
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
  });
});

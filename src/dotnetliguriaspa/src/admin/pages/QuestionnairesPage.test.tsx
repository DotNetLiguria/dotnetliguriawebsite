import React from 'react';
import { Route, Routes } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { jsonResponse, mockApi, render, screen, waitFor, within } from '../../test-utils';
import { AdminToastRegion, adminToasts } from '../toasts';
import QuestionnairesPage from './QuestionnairesPage';
import type { QuestionnaireSummary } from '../../questionnaire/types';

// The toast queue is shared by the whole admin: start every test without leftovers.
beforeEach(() => { for (const toast of adminToasts.visibleToasts) adminToasts.close(toast.key); });

const summaries: QuestionnaireSummary[] = [
  { questionnaireId: 'q1', title: 'Feedback Meetup', status: 'Published', workshopId: 'w1', workshopTitle: 'Meetup Genova', responseCount: 4, updatedAt: '2024-05-01T10:00:00Z', origin: 'Web' },
  { questionnaireId: 'q2', title: 'Sondaggio soci', status: 'Draft', workshopId: null, workshopTitle: null, responseCount: 0, updatedAt: '2024-06-01T10:00:00Z', origin: 'Web', opensAt: '2024-06-10T08:00:00Z' },
  { questionnaireId: 'q3', title: 'Feedback 2023', status: 'Archived', workshopId: 'w0', workshopTitle: 'Meetup 2023', responseCount: 12, updatedAt: '2023-05-01T10:00:00Z', origin: 'LegacySqlServer' },
];
const workshops = [
  { workshopId: 'w1', title: 'Meetup Genova', eventDate: '2024-05-01T18:00:00Z' },
  { workshopId: 'w0', title: 'Meetup 2023', eventDate: '2023-05-01T18:00:00Z' },
];

const renderAt = (route: string) => render(
  <>
    <Routes>
      <Route path="/admin/questionnaires" element={<QuestionnairesPage />} />
      <Route path="/admin/questionnaires/:id/edit" element={<div>Editor aperto</div>} />
    </Routes>
    <AdminToastRegion />
  </>,
  { route },
);
const rowTitles = () => within(screen.getByRole('table')).getAllByRole('row').slice(1).map(row => within(row).getAllByRole('link')[0].textContent);

describe('<QuestionnairesPage />', () => {
  test('lists questionnaires with their links, filters by status and search', async () => {
    const user = userEvent.setup();
    mockApi({ '/Questionnaire': summaries, '/Workshop/Get': workshops });
    renderAt('/admin/questionnaires');
    expect(await screen.findByText('3 questionari, 1 pubblicato.')).toBeInTheDocument();
    expect(rowTitles()).toEqual(['Sondaggio soci', 'Feedback Meetup', 'Feedback 2023']);
    const table = screen.getByRole('table');
    expect(within(table).getByRole('link', { name: 'Feedback Meetup' })).toHaveAttribute('href', '/admin/questionnaires/q1/edit');
    expect(within(table).getByRole('link', { name: 'Modifica Feedback Meetup' })).toHaveAttribute('href', '/admin/questionnaires/q1/edit');
    expect(within(table).getByRole('link', { name: 'Risultati di Feedback Meetup' })).toHaveAttribute('href', '/admin/questionnaires/q1/results');
    expect(within(table).getByRole('link', { name: '4' })).toHaveAttribute('href', '/admin/questionnaires/q1/results');
    expect(within(table).getByText('Bozza')).toBeInTheDocument();
    expect(within(table).getByText('Archiviato')).toBeInTheDocument();
    expect(within(table).queryByText('Pubblicato')).not.toBeInTheDocument();
    expect(within(table).getByText(/Aperto dal 10\/06\/24/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^Bozza/ }));
    expect(rowTitles()).toEqual(['Sondaggio soci']);
    expect(screen.getByText('1 di 3 questionari')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Tutti' }));
    await user.type(screen.getByRole('searchbox', { name: 'Cerca un questionario' }), '2023');
    expect(rowTitles()).toEqual(['Feedback 2023']);
  });

  test('creates a workshop feedback questionnaire from the dialog and opens the designer', async () => {
    const user = userEvent.setup();
    const created: unknown[] = [];
    mockApi({
      '/Questionnaire': (_url: string, init?: RequestInit) => {
        if (init?.method !== 'POST') return jsonResponse(summaries);
        created.push(JSON.parse(String(init.body)));
        return jsonResponse({ questionnaireId: 'new1', title: 'Feedback Meetup Genova' });
      },
      '/Workshop/Get': workshops,
    });
    renderAt('/admin/questionnaires');
    await user.click(await screen.findByRole('link', { name: 'Nuovo questionario' }));
    const dialog = await screen.findByRole('dialog', { name: 'Nuovo questionario' });
    const create = within(dialog).getByRole('button', { name: 'Crea e modifica' });
    expect(create).toBeDisabled();
    await user.type(within(dialog).getByRole('combobox', { name: 'Evento' }), 'Genova');
    expect(screen.queryByRole('option', { name: /Meetup 2023/ })).not.toBeInTheDocument();
    await user.click(await screen.findByRole('option', { name: /Meetup Genova/ }));
    expect(create).toBeEnabled();
    await user.click(create);
    expect(await screen.findByText('Editor aperto')).toBeInTheDocument();
    expect(created).toEqual([{ template: 'workshopFeedback', title: null, workshopId: 'w1' }]);
  });

  test('a blank questionnaire does not require an event', async () => {
    const user = userEvent.setup();
    const created: unknown[] = [];
    mockApi({
      '/Questionnaire': (_url: string, init?: RequestInit) => {
        if (init?.method !== 'POST') return jsonResponse([]);
        created.push(JSON.parse(String(init.body)));
        return jsonResponse({ questionnaireId: 'new2', title: 'Sondaggio soci' });
      },
    });
    renderAt('/admin/questionnaires?nuovo=1');
    const dialog = await screen.findByRole('dialog', { name: 'Nuovo questionario' });
    await user.click(within(dialog).getByRole('radio', { name: /Questionario vuoto/ }));
    await user.type(within(dialog).getByRole('textbox', { name: 'Titolo' }), ' Sondaggio soci ');
    await user.click(within(dialog).getByRole('button', { name: 'Crea e modifica' }));
    expect(await screen.findByText('Editor aperto')).toBeInTheDocument();
    expect(created).toEqual([{ template: 'blank', title: 'Sondaggio soci', workshopId: null }]);
  });

  test('duplicates from the row menu and opens the copy', async () => {
    const user = userEvent.setup();
    const calls: string[] = [];
    mockApi({
      '/Questionnaire/q1/duplicate': (_url: string, init?: RequestInit) => { calls.push(init?.method ?? 'GET'); return jsonResponse({ questionnaireId: 'copy1', title: 'Feedback Meetup (copia)' }); },
      '/Questionnaire': summaries, '/Workshop/Get': workshops,
    });
    renderAt('/admin/questionnaires');
    const table = await screen.findByRole('table');
    await user.click(within(table).getByRole('button', { name: 'Altre azioni per Feedback Meetup' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Duplica' }));
    expect(await screen.findByText('Editor aperto')).toBeInTheDocument();
    expect(calls).toEqual(['POST']);
  });

  test('archives and deletes with confirmation; deletion is blocked when there are responses', async () => {
    const user = userEvent.setup();
    const calls: { url: string; method: string }[] = [];
    let list = summaries;
    mockApi({
      '/Questionnaire/q1/archive': (url: string, init?: RequestInit) => {
        calls.push({ url, method: init?.method ?? 'GET' });
        list = list.map(q => (q.questionnaireId === 'q1' ? { ...q, status: 'Archived' as const } : q));
        return jsonResponse({ ...summaries[0], status: 'Archived' });
      },
      '/Questionnaire/q2': (url: string, init?: RequestInit) => {
        calls.push({ url, method: init?.method ?? 'GET' });
        list = list.filter(q => q.questionnaireId !== 'q2');
        return new Response(null, { status: 204 });
      },
      '/Questionnaire': () => jsonResponse(list),
      '/Workshop/Get': workshops,
    });
    renderAt('/admin/questionnaires');
    const table = await screen.findByRole('table');

    await user.click(within(table).getByRole('button', { name: 'Altre azioni per Feedback Meetup' }));
    const menu = await screen.findByRole('menu');
    expect(within(menu).getByRole('menuitem', { name: 'Elimina… (ha risposte)' })).toHaveAttribute('aria-disabled', 'true');
    await user.click(within(menu).getByRole('menuitem', { name: 'Archivia' }));
    expect(await screen.findByText('Questionario archiviato')).toBeInTheDocument();
    expect(calls).toEqual([{ url: expect.stringContaining('/Questionnaire/q1/archive'), method: 'POST' }]);
    await waitFor(() => expect(within(screen.getByRole('table')).getAllByText('Archiviato')).toHaveLength(2));

    await user.click(within(screen.getByRole('table')).getByRole('button', { name: 'Altre azioni per Sondaggio soci' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Elimina…' }));
    const confirmation = await screen.findByRole('alertdialog', { name: 'Eliminare il questionario?' });
    expect(confirmation).toHaveTextContent('«Sondaggio soci» verrà eliminato definitivamente');
    expect(calls).toHaveLength(1);
    await user.click(within(confirmation).getByRole('button', { name: 'Elimina' }));
    expect(await screen.findByText('Questionario eliminato')).toBeInTheDocument();
    expect(calls[1]).toEqual({ url: expect.stringMatching(/\/Questionnaire\/q2$/), method: 'DELETE' });
    await waitFor(() => expect(rowTitles()).toEqual(['Feedback Meetup', 'Feedback 2023']));
  });

  test('shows the permission message when the role is missing and retries', async () => {
    const user = userEvent.setup();
    let calls = 0;
    mockApi({ '/Questionnaire': () => (++calls === 1 ? new Response('', { status: 403 }) : jsonResponse(summaries)), '/Workshop/Get': workshops });
    renderAt('/admin/questionnaires');
    expect(await screen.findByRole('alert')).toHaveTextContent(/ruolo feedbackadmin/);
    await user.click(screen.getByRole('button', { name: 'Riprova' }));
    expect(await screen.findByRole('table')).toBeInTheDocument();
  });
});

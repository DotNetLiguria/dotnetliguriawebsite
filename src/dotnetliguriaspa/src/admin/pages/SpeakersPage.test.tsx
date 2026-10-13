import React from 'react';
import { Route, Routes } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { jsonResponse, mockApi, render, screen, waitFor, within } from '../../test-utils';
import { resetPhotoCache } from '../adminApi';
import { AdminToastRegion } from '../toasts';
import SpeakersPage from './SpeakersPage';

const workshops = [
  { workshopId: 'w1', title: 'AI Generativa', eventDate: '2025-06-12T00:00:00+02:00', tracks: [
    { workshopTrackId: 't1', title: 'Gemini contro ChatGPT', startTime: '2025-06-12T12:00:00Z', endTime: '2025-06-12T12:40:00Z', speakersName: 'Andrea Merlin' },
    { workshopTrackId: 't2', title: 'Ricerca semantica', startTime: '2025-06-12T12:40:00Z', endTime: '2025-06-12T13:20:00Z', speakersName: 'Andrea Merlin, Giampaolo Tucci' },
  ] },
];
const speakers = [
  { workshopSpeakerId: 's-tucci', name: 'Giampaolo Tucci', email: 'gt@example.test', description: 'Architetto software.', isActive: true },
  { workshopSpeakerId: 's-merlin', name: 'Andrea Merlin', isActive: true, profileImageUrl: '/Uploads/x.jpg' },
  { workshopSpeakerId: 's-dup1', name: 'Angelo Ferrando', isActive: true },
  { workshopSpeakerId: 's-dup2', name: 'Angelo Ferrando', isActive: false },
];
const contents = (url: string) => (url.includes('speakers/andrea_merlin.jpg')
  ? new Response('', { status: 200, headers: { 'Content-Type': 'image/jpeg' } })
  : new Response('', { status: 404 }));

const renderAt = (route: string) => render(
  <>
    <Routes>
      <Route path="/admin/speakers/" element={<SpeakersPage />} />
      <Route path="/admin/speakers/:id" element={<SpeakersPage />} />
    </Routes>
    <AdminToastRegion />
  </>,
  { route },
);
const rowNames = () => within(screen.getByRole('list', { name: 'Elenco relatori' })).getAllByRole('link').map(l => l.querySelector('span.block.font-bold')?.textContent);

beforeEach(() => resetPhotoCache());

describe('<SpeakersPage />', () => {
  test('lists speakers by number of talks and flags missing photos and duplicates', async () => {
    const user = userEvent.setup({ delay: null });
    mockApi({ '/Speaker/Get': speakers, '/Workshop/Get': workshops, '/Contents/': contents });
    renderAt('/admin/speakers/');
    expect(await screen.findByText('4 relatori, 1 con foto.')).toBeInTheDocument();
    expect(rowNames()).toEqual(['Andrea Merlin', 'Giampaolo Tucci', 'Angelo Ferrando', 'Angelo Ferrando']);
    expect(screen.getAllByText('Doppione?')).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: /Senza foto/ }));
    expect(rowNames()).toEqual(['Giampaolo Tucci', 'Angelo Ferrando', 'Angelo Ferrando']);
    await user.type(screen.getByRole('searchbox', { name: 'Cerca un relatore' }), 'tucci');
    expect(rowNames()).toEqual(['Giampaolo Tucci']);
  });

  test('reconciles duplicate records only after confirmation and reloads the list', async () => {
    const user = userEvent.setup({ delay: null });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    let reconciled = false;
    let reconcileCalls = 0;
    mockApi({
      '/Speaker/ReconcileDuplicates': () => { reconcileCalls += 1; reconciled = true; return jsonResponse({ removedSpeakers: 1 }); },
      '/Speaker/Get': () => reconciled ? jsonResponse(speakers.filter(speaker => speaker.workshopSpeakerId !== 's-dup2')) : jsonResponse(speakers),
      '/Workshop/Get': workshops,
      '/Contents/': contents,
    });
    renderAt('/admin/speakers/');
    await screen.findByText('4 relatori, 1 con foto.');

    await user.click(screen.getByRole('button', { name: 'Unisci doppioni' }));
    expect(reconcileCalls).toBe(0);
    await user.click(screen.getByRole('button', { name: 'Unisci doppioni' }));
    await waitFor(() => expect(reconcileCalls).toBe(1));
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(await screen.findByText('1 schede rimosse.')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('3 relatori, 1 con foto.')).toBeInTheDocument());
    expect(screen.queryByText('Doppione?')).not.toBeInTheDocument();
    confirm.mockRestore();
  });

  test('opens the speaker card as a dialog from its address and saves edits', async () => {
    const user = userEvent.setup({ delay: null });
    const saved: unknown[] = [];
    mockApi({
      '/Speaker/Update/s-tucci': (_url: string, init?: RequestInit) => { saved.push(JSON.parse(String(init?.body))); return new Response(null, { status: 204 }); },
      '/Speaker/Get': speakers, '/Workshop/Get': workshops, '/Contents/': contents,
    });
    renderAt('/admin/speakers/s-tucci');
    const card = await screen.findByRole('dialog', { name: 'Giampaolo Tucci' });
    expect(within(card).getByText('Architetto software.')).toBeInTheDocument();
    expect(within(card).getByRole('link', { name: /Ricerca semantica/ })).toHaveAttribute('href', '/admin/workshop/w1');
    expect(await within(card).findByText('Manca la foto')).toBeInTheDocument();

    await user.click(within(card).getByRole('button', { name: 'Modifica' }));
    const bio = within(card).getByRole('textbox', { name: 'Biografia' });
    await user.clear(bio);
    await user.type(bio, 'Architetto e speaker.');
    await user.click(within(card).getByRole('button', { name: 'Salva' }));
    await waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0]).toMatchObject({ workshopSpeakerId: 's-tucci', name: 'Giampaolo Tucci', email: 'gt@example.test', description: 'Architetto e speaker.', isActive: true });
    expect(await screen.findByText('Relatore aggiornato')).toBeInTheDocument();
  });

  test('sorts by name on request and toggles the active state with one click', async () => {
    const user = userEvent.setup({ delay: null });
    const saved: unknown[] = [];
    mockApi({
      '/Speaker/Update/s-merlin': (_url: string, init?: RequestInit) => { saved.push(JSON.parse(String(init?.body))); return new Response(null, { status: 204 }); },
      '/Speaker/Get': speakers, '/Workshop/Get': workshops, '/Contents/': contents,
    });
    renderAt('/admin/speakers/');
    await screen.findByText('4 relatori, 1 con foto.');
    await user.click(within(screen.getByRole('radiogroup', { name: 'Ordina per' })).getByRole('radio', { name: 'Nome' }));
    expect(rowNames()).toEqual(['Andrea Merlin', 'Angelo Ferrando', 'Angelo Ferrando', 'Giampaolo Tucci']);

    await user.click(screen.getAllByRole('link', { name: /Andrea Merlin/ })[0]);
    const card = await screen.findByRole('dialog', { name: 'Andrea Merlin' });
    const active = within(card).getByRole('switch', { name: 'Attivo' });
    expect(active).toBeChecked();
    await user.click(active);
    await waitFor(() => expect(saved).toEqual([expect.objectContaining({ workshopSpeakerId: 's-merlin', isActive: false })]));
    expect(await screen.findByText('Relatore disattivato')).toBeInTheDocument();
  });

  test('keeps the card status in sync after the Attivo field is changed from the edit form', async () => {
    const user = userEvent.setup({ delay: null });
    let saved = false;
    mockApi({
      '/Speaker/Update/s-tucci': () => { saved = true; return new Response(null, { status: 204 }); },
      '/Speaker/Get': () => jsonResponse(speakers.map(s => (s.workshopSpeakerId === 's-tucci' && saved ? { ...s, isActive: false } : s))),
      '/Workshop/Get': workshops, '/Contents/': contents,
    });
    renderAt('/admin/speakers/s-tucci');
    const card = await screen.findByRole('dialog', { name: 'Giampaolo Tucci' });
    expect(within(card).getByRole('switch', { name: 'Attivo' })).toBeChecked();
    await user.click(within(card).getByRole('button', { name: 'Modifica' }));
    await user.click(within(card).getByRole('switch', { name: 'Attivo' }));
    await user.click(within(card).getByRole('button', { name: 'Salva' }));
    await waitFor(() => expect(within(card).getByRole('switch', { name: 'Attivo' })).not.toBeChecked());
    expect(within(card).getByText('Non attivo')).toBeInTheDocument();
  });

  test('requires a name for a new speaker and creates it', async () => {
    const user = userEvent.setup({ delay: null });
    const created: unknown[] = [];
    mockApi({
      '/Speaker/Post': (_url: string, init?: RequestInit) => { created.push(JSON.parse(String(init?.body))); return jsonResponse({ workshopSpeakerId: 's-new', name: 'Grace Hopper' }, 201); },
      '/Speaker/Get': speakers, '/Workshop/Get': workshops,
    });
    renderAt('/admin/speakers/new');
    const dialog = await screen.findByRole('dialog', { name: 'Nuovo relatore' });
    await user.click(within(dialog).getByRole('button', { name: 'Salva' }));
    expect(within(dialog).getByText('Il nome è obbligatorio.')).toBeInTheDocument();
    expect(created).toHaveLength(0);
    await user.type(within(dialog).getByRole('textbox', { name: /Nome/ }), 'Grace Hopper');
    await user.click(within(dialog).getByRole('button', { name: 'Salva' }));
    await waitFor(() => expect(created).toEqual([expect.objectContaining({ name: 'Grace Hopper', isActive: true })]));
    expect(await screen.findByText('Relatore creato')).toBeInTheDocument();
  });

  test('deletes after an explicit confirmation and reports failures', async () => {
    const user = userEvent.setup({ delay: null });
    let attempts = 0;
    mockApi({
      '/Speaker/Delete/s-dup2': () => (++attempts === 1 ? new Response(null, { status: 404 }) : new Response(null, { status: 204 })),
      '/Speaker/Get': speakers, '/Workshop/Get': workshops,
    });
    renderAt('/admin/speakers/s-dup2');
    const card = await screen.findByRole('dialog', { name: 'Angelo Ferrando' });
    expect(within(card).getByText('Possibile doppione')).toBeInTheDocument();
    await user.click(within(card).getByRole('button', { name: /Elimina/ }));
    expect(within(card).getByText('Eliminare Angelo Ferrando?')).toBeInTheDocument();
    await user.click(within(card).getByRole('button', { name: 'Elimina' }));
    expect(await screen.findByText('Eliminazione non riuscita')).toBeInTheDocument();
    expect(screen.getByText('Errore HTTP: 404')).toBeInTheDocument();
    await user.click(within(card).getByRole('button', { name: 'Elimina' }));
    expect(await screen.findByText('Relatore eliminato')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});

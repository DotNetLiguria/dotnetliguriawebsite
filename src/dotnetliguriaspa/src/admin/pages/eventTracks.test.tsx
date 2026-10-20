import userEvent from '@testing-library/user-event';
import { adminToasts } from '../toasts';
import { fireEvent, jsonResponse, screen, waitFor, within } from '../../test-utils';
import { eventFixture, serveEvent } from './eventFixtures';
import { renderAt } from './eventAgendaFixtures';

beforeEach(() => adminToasts.clear());

describe('tracks step', () => {
  const tracks = [
    { workshopTrackId: 'k1', title: 'Registrazione', startTime: '2024-03-15T08:30:00Z', endTime: '2024-03-15T09:00:00Z', level: 0, speakers: [], speakersName: '' },
    { workshopTrackId: 'k2', title: 'Intro a Blazor', startTime: '2024-03-15T09:00:00Z', endTime: '2024-03-15T10:00:00Z', level: 2, speakers: ['speaker-1'], speakersName: 'Ada Lovelace', abstract: 'Componenti.' },
    // Day and month swapped by the old admin: shown as stored, without comment.
    { workshopTrackId: 'k3', title: 'Keynote', startTime: '2024-12-03T09:00:00Z', endTime: '2024-12-03T10:00:00Z', level: 1, speakers: [], speakersName: 'Grace Hopper' },
  ];

  test('lists the tracks as the previous accordion: summary rows, one open at a time with stored UTC times, level, speakers and abstract', async () => {
    const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
    serveEvent(eventFixture({ tracks }));
    renderAt('#tracks');
    const panel = await screen.findByRole('region', { name: 'Tracks' });
    const triggers = within(panel).getAllByRole('heading', { level: 3 }).map(heading => within(heading).getByRole('button'));
    expect(triggers.map(trigger => trigger.textContent)).toEqual(['Registrazione', 'Intro a Blazor', 'Keynote']);
    expect(triggers.every(trigger => trigger.getAttribute('aria-expanded') === 'false')).toBe(true);
    within(panel).getAllByText('Livello').forEach(term => expect(term).not.toBeVisible());
    const rowOfTrack = (title: string) => within(panel).getByRole('button', { name: title }).closest('.group') as HTMLElement;

    await user.click(triggers[1]);
    expect(triggers[1]).toHaveAttribute('aria-expanded', 'true');
    const second = rowOfTrack('Intro a Blazor');
    expect(within(second).getByText('15/03/2024, 09:00')).toBeVisible();
    expect(within(second).getByText('15/03/2024, 10:00')).toBeVisible();
    expect(within(second).getByText('Livello').nextElementSibling).toHaveTextContent('2');
    expect(within(second).getByText('Relatori').nextElementSibling).toHaveTextContent('Ada Lovelace');
    expect(within(second).getByText('Abstract').nextElementSibling).toHaveTextContent('Componenti.');
    expect(within(rowOfTrack('Registrazione')).queryByText('Relatori')).not.toBeInTheDocument();

    await user.click(triggers[2]);
    expect(triggers[1]).toHaveAttribute('aria-expanded', 'false');
    expect(within(rowOfTrack('Keynote')).getByText('03/12/2024, 09:00')).toBeVisible();
    expect(screen.queryByText("Data diversa dall'evento")).not.toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: 'Aggiungi' })).toBeEnabled();

    serveEvent(eventFixture());
    renderAt('#tracks');
    expect(await screen.findByText('Nessuna track disponibile. Clicca su «Aggiungi track» per crearne una.')).toBeInTheDocument();
  });

  test('adds, edits and deletes a track: whole-record PUT then a reload, as before', async () => {
    const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
    const api = serveEvent(eventFixture({ tracks: tracks.slice(0, 2) }));
    renderAt('#tracks');
    const panel = await screen.findByRole('region', { name: 'Tracks' });

    await user.click(within(panel).getByRole('button', { name: 'Aggiungi' }));
    let dialog = await screen.findByRole('dialog', { name: 'Aggiungi nuova track' });
    await user.click(within(dialog).getByRole('button', { name: 'Salva track' }));
    expect(await screen.findByText('Compila tutti i campi obbligatori')).toBeInTheDocument();
    expect(api.to('/Workshop/Update/')).toHaveLength(0);
    await user.type(within(dialog).getByRole('textbox', { name: 'Titolo' }), 'Chiusura');
    fireEvent.change(within(dialog).getByLabelText('Ora di inizio *'), { target: { value: '2024-03-15T11:00' } });
    fireEvent.change(within(dialog).getByLabelText('Ora di fine *'), { target: { value: '2024-03-15T11:30' } });
    await user.click(within(dialog).getByRole('checkbox', { name: 'Alan Turing' }));
    await user.click(within(dialog).getByRole('button', { name: 'Salva track' }));
    await waitFor(() => expect(api.lastUpdate()).toBeDefined());
    const added = api.lastUpdate()!.tracks!;
    expect(added).toHaveLength(3);
    expect(added[2]).toMatchObject({ workshopTrackId: '00000000-0000-0000-0000-000000000000', title: 'Chiusura', startTime: '2024-03-15T11:00:00.000Z', endTime: '2024-03-15T11:30:00.000Z', level: 0, speakers: ['speaker-2'], speakersName: 'Alan Turing', image: '' });
    expect(api.lastUpdate()!.title).toBe('Test Workshop');
    expect(await screen.findByText('Track aggiunta correttamente')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const putIndex = api.calls.findIndex(call => call.url.includes('/Workshop/Update/'));
    expect(api.calls.slice(putIndex).some(call => call.url.includes('/Workshop/Get/w1') && call.method === 'GET')).toBe(true);

    await user.click(within(panel).getByRole('button', { name: 'Modifica: Intro a Blazor' }));
    dialog = await screen.findByRole('dialog', { name: 'Modifica track' });
    expect(within(dialog).getByLabelText('Ora di inizio *')).toHaveValue('2024-03-15T09:00');
    expect(within(dialog).getByRole('checkbox', { name: 'Ada Lovelace' })).toBeChecked();
    await user.type(within(dialog).getByRole('textbox', { name: 'Titolo' }), ' WebAssembly');
    await user.click(within(dialog).getByRole('button', { name: 'Salva track' }));
    await waitFor(() => expect(api.lastUpdate()!.tracks!.find(track => track.workshopTrackId === 'k2')).toMatchObject({ title: 'Intro a Blazor WebAssembly', speakers: ['speaker-1'], level: 2 }));
    expect(await screen.findByText('Track aggiornata correttamente')).toBeInTheDocument();

    await user.click(within(panel).getByRole('button', { name: 'Elimina: Registrazione' }));
    expect(within(panel).getByRole('alert')).toHaveTextContent('Vuoi davvero eliminare questa track?');
    await user.click(within(panel).getByRole('button', { name: 'OK' }));
    await waitFor(() => expect(api.lastUpdate()!.tracks!.map(track => track.workshopTrackId)).toEqual(['k2', '00000000-0000-0000-0000-000000000000']));
    expect(await screen.findByText('Track eliminata correttamente')).toBeInTheDocument();
  });

  test('reports a failed track save with the previous fixed message, whatever the server says', async () => {
    const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
    serveEvent(eventFixture({ tracks: tracks.slice(0, 1) }), { '/Workshop/Update/': () => jsonResponse({ detail: 'Mongo down' }, 500) });
    renderAt('#tracks');
    const panel = await screen.findByRole('region', { name: 'Tracks' });
    await user.click(within(panel).getByRole('button', { name: 'Aggiungi' }));
    let dialog = await screen.findByRole('dialog', { name: 'Aggiungi nuova track' });
    await user.type(within(dialog).getByRole('textbox', { name: 'Titolo' }), 'Chiusura');
    fireEvent.change(within(dialog).getByLabelText('Ora di inizio *'), { target: { value: '2024-03-15T11:00' } });
    fireEvent.change(within(dialog).getByLabelText('Ora di fine *'), { target: { value: '2024-03-15T11:30' } });
    await user.click(within(dialog).getByRole('button', { name: 'Salva track' }));
    expect(await screen.findByText("Errore nell'aggiunta della track")).toBeInTheDocument();
    expect(screen.queryByText('Mongo down')).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Annulla' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    await user.click(within(panel).getByRole('button', { name: 'Modifica: Registrazione' }));
    dialog = await screen.findByRole('dialog', { name: 'Modifica track' });
    await user.click(within(dialog).getByRole('button', { name: 'Salva track' }));
    expect(await screen.findByText("Errore nell'aggiornamento della track")).toBeInTheDocument();
  });
});

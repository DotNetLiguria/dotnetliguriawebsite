import userEvent from '@testing-library/user-event';
import { adminToasts } from '../toasts';
import { fireEvent, screen, waitFor, within } from '../../test-utils';
import { eventFixture, serveEvent } from './eventFixtures';
import { renderAt, loaded, schedule, createForm, poolList, rowOf, valuesOf, starts, ends, twoTalks } from './eventAgendaFixtures';

beforeEach(() => adminToasts.clear());

describe('event schedule', () => {
  const setTrackCount = (count: number | '') => fireEvent.change(screen.getByRole('spinbutton', { name: 'Numero di track' }), { target: { value: String(count) } });

  test('auto-fills every single-track talk with time-only editable slots and technical gaps', async () => {
    const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
    const api = serveEvent(twoTalks());
    renderAt('#agenda');
    expect(await screen.findByText('First talk')).toBeVisible();
    expect(screen.getByText('Second talk')).toBeVisible();
    expect(screen.getByDisplayValue('Technical gap')).toBeVisible();
    expect(starts()).toEqual(['09:00', '10:00', '10:05']);
    expect(ends()).toEqual(['10:00', '10:05', '11:05']);
    expect(screen.queryByLabelText(/^data/i)).not.toBeInTheDocument();
    expect(await screen.findByText(/Orari delle track riempiti/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Salva agenda' }));
    await waitFor(() => expect(api.to('/Workshop/Update/w1', 'PUT')).toHaveLength(1));
    const body = api.lastUpdate()!;
    expect(body.agendaItems).toHaveLength(3);
    expect(body.agendaItems!.every(item => item.trackId === 'track-1')).toBe(true);
    expect(body.agendaItems![0].startTime).toMatch(/^2024-03-15T09:00:00/);
    expect(body.talks![0].trackId).toBe('track-1');
    expect(await screen.findByText("Dettagli dell'evento e agenda salvati.")).toBeInTheDocument();
  });

  test('fills the schedule only when the schedule page is shown, never from the talk pool', async () => {
    const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
    const api = serveEvent(twoTalks());
    renderAt('#talk-pool');
    await loaded();
    await user.click(screen.getByRole('button', { name: 'Salva talk pool' }));
    await waitFor(() => expect(api.to('/Workshop/Update/w1', 'PUT')).toHaveLength(1));
    expect(api.lastUpdate()!.agendaItems).toEqual([]);
    expect(api.lastUpdate()!.talks!.map(talk => talk.trackId)).toEqual(['track-1', 'track-1']);
    expect(await screen.findByText("Dettagli dell'evento e agenda salvati.")).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: "Avanti: Track e orari dell'agenda" }));
    expect(await screen.findByDisplayValue('Technical gap')).toBeVisible();
    expect(starts()).toEqual(['09:00', '10:00', '10:05']);
  });

  test('requires a track for each talk when multiple tracks are available', async () => {
    const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
    const api = serveEvent(eventFixture({
      agendaTracks: [{ workshopAgendaTrackId: 'track-1', name: 'Room A', order: 0 }, { workshopAgendaTrackId: 'track-2', name: 'Room B', order: 1 }],
      talks: [{ workshopTalkId: 'talk-1', title: 'Unassigned talk', sessionType: 'talk', speakers: [] }],
    }));
    renderAt('#talk-pool');
    await loaded();
    await user.click(screen.getByRole('button', { name: 'Salva talk pool' }));
    expect(await screen.findByText("Assegna ogni talk a una track prima di salvare l'agenda.")).toBeInTheDocument();
    expect(api.to('/Workshop/Update/')).toHaveLength(0);

    // A select is named by its value, then its label.
    await user.click(within(poolList()).getByRole('button', { name: /Track$/ }));
    expect((await screen.findAllByRole('option')).map(option => option.textContent)).toEqual(['Seleziona una track', 'Room A', 'Room B']);
    await user.click(screen.getByRole('option', { name: 'Room B' }));
    await user.click(screen.getByRole('button', { name: 'Salva talk pool' }));
    await waitFor(() => expect(api.to('/Workshop/Update/w1', 'PUT')).toHaveLength(1));
    expect(api.lastUpdate()!.talks![0].trackId).toBe('track-2');

    // "Seleziona una track" leaves the talk without a track again, so the next save is refused, as before.
    await user.click(within(poolList()).getByRole('button', { name: /Track$/ }));
    await user.click(await screen.findByRole('option', { name: 'Seleziona una track' }));
    expect(within(poolList()).getByRole('button', { name: /Track$/ })).not.toHaveTextContent('Room B');
    await user.click(screen.getByRole('button', { name: 'Salva talk pool' }));
    expect(await screen.findAllByText("Assegna ogni talk a una track prima di salvare l'agenda.")).toHaveLength(2);
    expect(api.to('/Workshop/Update/w1', 'PUT')).toHaveLength(1);
  });

  test('moves through one schedule page per track and shows only that track sessions', async () => {
    const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
    serveEvent(eventFixture({
      agendaTracks: [{ workshopAgendaTrackId: 'track-1', name: 'Room A', order: 0 }, { workshopAgendaTrackId: 'track-2', name: 'Room B', order: 1 }],
      talks: [
        { workshopTalkId: 'talk-1', title: 'Room A session', trackId: 'track-1', sessionType: 'talk', speakers: [] },
        { workshopTalkId: 'talk-2', title: 'Room B session', trackId: 'track-2', sessionType: 'talk', speakers: [] },
      ],
      agendaItems: [
        { workshopAgendaItemId: 'item-1', itemType: 'talk', talkId: 'talk-1', trackId: 'track-1', startTime: '2024-03-15T09:00:00Z', endTime: '2024-03-15T10:00:00Z' },
        { workshopAgendaItemId: 'item-2', itemType: 'talk', talkId: 'talk-2', trackId: 'track-2', startTime: '2024-03-15T09:00:00Z', endTime: '2024-03-15T10:00:00Z' },
      ],
    }));
    renderAt('#agenda');
    expect(await screen.findByText('Room A session')).toBeVisible();
    expect(screen.queryByText('Room B session')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Room A (1 di 2)' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Track successiva' }));
    expect(screen.getByText('Room B session')).toBeVisible();
    expect(screen.queryByText('Room A session')).not.toBeInTheDocument();
  });

  test('groups each schedule item into title-and-controls and times, with move buttons as the keyboard alternative', async () => {
    const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
    serveEvent(eventFixture({
      agendaTracks: [{ workshopAgendaTrackId: 'track-1', name: 'Main stage', order: 0 }],
      talks: [{ workshopTalkId: 'talk-1', title: 'Opening', trackId: 'track-1', sessionType: 'talk', speakers: [] }],
      agendaItems: [
        { workshopAgendaItemId: 'item-0', itemType: 'talk', talkId: 'talk-1', trackId: 'track-1', startTime: '2024-03-15T11:00:00Z', endTime: '2024-03-15T12:00:00Z', order: 0 },
        { workshopAgendaItemId: 'item-1', itemType: 'service', title: 'Lunch', roomName: 'Dining room', trackId: 'track-1', startTime: '2024-03-15T12:00:00Z', endTime: '2024-03-15T13:00:00Z', order: 1 },
      ],
    }));
    renderAt('#agenda');
    await screen.findByRole('heading', { level: 4, name: 'Lunch' });
    const lunch = rowOf('Lunch');
    expect(within(lunch).getByRole('group', { name: 'Titolo e controlli della voce' })).toBeInTheDocument();
    const times = within(lunch).getByRole('group', { name: 'Orari della voce' });
    expect(within(times).getByLabelText('Ora di inizio')).toHaveValue('12:00');
    expect(within(times).getByLabelText('Ora di fine')).toHaveValue('13:00');
    expect(within(lunch).getByRole('textbox', { name: 'Nome sala' })).toHaveValue('Dining room');
    expect(within(lunch).getByRole('textbox', { name: 'Titolo servizio / intervallo' })).toHaveValue('Lunch');
    expect(within(rowOf('Opening')).queryByRole('textbox', { name: 'Titolo servizio / intervallo' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sposta in alto: Opening' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Sposta in basso: Lunch' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Sposta in basso: Opening' }));
    expect(within(schedule()).getAllByRole('heading', { level: 4 }).map(heading => heading.textContent)).toEqual(['Lunch', 'Opening']);
    expect(starts()).toEqual(['11:00', '12:00']);
    expect(screen.getByRole('button', { name: 'Sposta in alto: Opening' })).toHaveFocus();
    fireEvent.change(within(rowOf('Opening')).getByLabelText('Ora di fine'), { target: { value: '13:30' } });
    await user.click(screen.getByRole('button', { name: 'Rimuovi intervallo' }));
    expect(screen.queryByRole('textbox', { name: 'Titolo servizio / intervallo' })).not.toBeInTheDocument();
    // The suggested title and the empty fallback are the stored values the public agenda recognises.
    expect(screen.getByRole('textbox', { name: 'Titolo intervallo di servizio' })).toHaveValue('Lunch');
    await user.click(screen.getByRole('button', { name: 'Aggiungi intervallo di servizio' }));
    expect(screen.getByRole('textbox', { name: 'Titolo servizio / intervallo' })).toHaveValue('Lunch');
    expect(await screen.findByText(/Intervallo di servizio aggiunto/)).toBeInTheDocument();
    expect(starts()).toEqual(['12:00', '13:30']);
    await user.clear(screen.getByRole('textbox', { name: 'Titolo intervallo di servizio' }));
    await user.click(screen.getByRole('button', { name: 'Aggiungi intervallo di servizio' }));
    expect(valuesOf(screen.getAllByRole('textbox', { name: 'Titolo servizio / intervallo' }))).toEqual(['Lunch', 'Service interval']);
  });

  test('clamps the schedule page when the track count is lowered, clears the new talk track and collapses to one track when the field is cleared', async () => {
    const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
    serveEvent(eventFixture({
      agendaTracks: [{ workshopAgendaTrackId: 'track-1', name: 'Room A', order: 0 }, { workshopAgendaTrackId: 'track-2', name: 'Room B', order: 1 }, { workshopAgendaTrackId: 'track-3', name: 'Room C', order: 2 }],
    }));
    renderAt('#agenda');
    await loaded();
    await user.click(screen.getByRole('button', { name: 'Track successiva' }));
    await user.click(screen.getByRole('button', { name: 'Track successiva' }));
    expect(screen.getByRole('heading', { name: 'Room C (3 di 3)' })).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: '6. Talk pool, raggiunto' }));
    const form = createForm();
    await user.click(within(form).getByRole('button', { name: /Track$/ }));
    await user.click(await screen.findByRole('option', { name: 'Room C' }));
    expect(within(form).getByRole('button', { name: /Track$/ })).toHaveTextContent('Room C');
    setTrackCount(2);
    expect(within(form).getByRole('button', { name: /Track$/ })).not.toHaveTextContent('Room C');
    expect(screen.queryByRole('textbox', { name: 'Nome track 3' })).not.toBeInTheDocument();
    await user.type(within(form).getByRole('textbox', { name: 'Titolo del talk' }), 'Senza track');
    await user.click(within(form).getByRole('button', { name: 'Seleziona uno o più relatori' }));
    await user.click(within(form).getByRole('checkbox', { name: 'Ada Lovelace' }));
    await user.click(within(form).getByRole('button', { name: 'Aggiungi talk al pool' }));
    expect(await screen.findByText('Seleziona una track per questo talk.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: "Avanti: Track e orari dell'agenda" }));
    expect(screen.getByRole('heading', { name: 'Room B (2 di 2)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Track successiva' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Track precedente' })).toBeEnabled();

    // Clearing the field collapses to one track at once, as before.
    await user.click(screen.getByRole('link', { name: '6. Talk pool, raggiunto' }));
    setTrackCount('');
    expect(screen.getByRole('spinbutton', { name: 'Numero di track' })).toHaveValue(1);
    expect(screen.queryByRole('textbox', { name: 'Nome track 2' })).not.toBeInTheDocument();
    expect(screen.getByText('I talk sono assegnati a Room A automaticamente.')).toBeInTheDocument();
  });

  test('refills the schedule from new parameters and refuses to save overlapping items', async () => {
    const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
    const api = serveEvent(twoTalks());
    renderAt('#agenda');
    await screen.findByText('First talk');
    fireEvent.change(screen.getByLabelText('Ora di inizio della track'), { target: { value: '14:00' } });
    await user.clear(screen.getByRole('spinbutton', { name: 'Durata talk (minuti)' }));
    await user.type(screen.getByRole('spinbutton', { name: 'Durata talk (minuti)' }), '30');
    await user.clear(screen.getByRole('spinbutton', { name: 'Durata pausa (minuti)' }));
    await user.type(screen.getByRole('spinbutton', { name: 'Durata pausa (minuti)' }), '10');
    await user.click(screen.getByRole('button', { name: 'Riempi automaticamente gli orari delle track' }));
    expect(starts()).toEqual(['14:00', '14:30', '14:40']);

    fireEvent.change(within(rowOf('Second talk')).getByLabelText('Ora di inizio'), { target: { value: '14:10' } });
    await user.click(screen.getByRole('button', { name: 'Salva agenda' }));
    expect((await screen.findByText(/non possono sovrapporsi/)).closest('[role="alert"]')).toBeInTheDocument();
    expect(api.to('/Workshop/Update/')).toHaveLength(0);
  });

  test('keeps a cleared time as it is, so the agenda cannot be saved until it is set again, as before', async () => {
    const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
    const api = serveEvent(twoTalks());
    renderAt('#agenda');
    await screen.findByText('First talk');
    fireEvent.change(within(rowOf('Second talk')).getByLabelText('Ora di fine'), { target: { value: '' } });
    expect(within(rowOf('Second talk')).getByLabelText('Ora di fine')).toHaveValue('');
    await user.click(screen.getByRole('button', { name: 'Salva agenda' }));
    expect(await screen.findByText("Ogni voce dell'agenda deve avere un orario di fine valido successivo all'inizio.")).toBeInTheDocument();
    expect(api.to('/Workshop/Update/')).toHaveLength(0);
    fireEvent.change(within(rowOf('Second talk')).getByLabelText('Ora di fine'), { target: { value: '11:05' } });
    await user.click(screen.getByRole('button', { name: 'Salva agenda' }));
    await waitFor(() => expect(api.to('/Workshop/Update/w1', 'PUT')).toHaveLength(1));
  });
});

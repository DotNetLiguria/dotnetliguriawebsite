import React from 'react';
import { Route, Routes } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { fireEvent, jsonResponse, render, screen, waitFor, within } from '../../test-utils';
import { AdminToastRegion, adminToasts } from '../toasts';
import { resetPhotoCache } from '../adminApi';
import EventDetailAdminPage from './EventDetailAdminPage';
import { eventFixture, serveEvent } from './eventFixtures';

const renderAgenda = () => render(
  <>
    <Routes><Route path="/admin/workshop/:id" element={<EventDetailAdminPage />} /></Routes>
    <AdminToastRegion />
  </>,
  { route: '/admin/workshop/w1#agenda' },
);
const programme = () => screen.getByRole('region', { name: 'Programma' });
const starts = () => within(programme()).getAllByLabelText(/^Inizio di /).map(input => (input as HTMLInputElement).value);
const ends = () => within(programme()).getAllByLabelText(/^Fine di /).map(input => (input as HTMLInputElement).value);
const saveAgenda = () => screen.getByRole('button', { name: 'Salva agenda' });

beforeEach(() => { adminToasts.clear(); resetPhotoCache(); });

describe('agenda tab', () => {
  test('auto-fills every single-track talk with time-only editable slots and technical gaps, then saves the agenda', async () => {
    const user = userEvent.setup();
    const api = serveEvent(eventFixture({
      agendaTracks: [{ workshopAgendaTrackId: 'track-1', name: 'Main stage', order: 0 }],
      talks: [
        { workshopTalkId: 'talk-1', title: 'First talk', sessionType: 'talk', speakers: [{ workshopSpeakerId: 'speaker-1', name: 'Ada Lovelace' }] },
        { workshopTalkId: 'talk-2', title: 'Second talk', sessionType: 'talk', speakers: [] },
      ],
    }));
    renderAgenda();
    expect(await screen.findByText('First talk')).toBeVisible();
    expect(screen.getByText('Second talk')).toBeVisible();
    expect(screen.getByDisplayValue('Technical gap')).toBeVisible();
    expect(starts()).toEqual(['09:00', '10:00', '10:05']);
    expect(ends()).toEqual(['10:00', '10:05', '11:05']);
    expect(screen.queryByLabelText(/data/i)).not.toBeInTheDocument();
    expect(screen.getByText('Modifiche non salvate')).toBeInTheDocument();

    await user.click(saveAgenda());
    await waitFor(() => expect(api.lastUpdate()).toBeDefined());
    const body = api.lastUpdate()!;
    expect(api.to('/Workshop/Update/w1', 'PUT')).toHaveLength(1);
    expect(body.agendaItems).toHaveLength(3);
    expect(body.agendaItems!.every(item => item.trackId === 'track-1')).toBe(true);
    expect(body.agendaItems![0].startTime).toMatch(/^2024-03-15T09:00:00/);
    expect(body.agendaTracks).toEqual([{ workshopAgendaTrackId: 'track-1', name: 'Main stage', order: 0 }]);
    expect(body.talks![0].trackId).toBe('track-1');
    expect(body.location!.maximumSpaces).toBe(150);
    expect(await screen.findByText('Agenda salvata')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('Modifiche non salvate')).not.toBeInTheDocument());
  });

  test('requires a track for each talk when multiple tracks are available, then places the talk', async () => {
    const user = userEvent.setup();
    const api = serveEvent(eventFixture({
      agendaTracks: [{ workshopAgendaTrackId: 'track-1', name: 'Room A', order: 0 }, { workshopAgendaTrackId: 'track-2', name: 'Room B', order: 1 }],
      talks: [{ workshopTalkId: 'talk-1', title: 'Unassigned talk', sessionType: 'talk', speakers: [] }],
    }));
    renderAgenda();
    const pool = await screen.findByRole('region', { name: 'Talk da collocare' });
    expect(within(pool).getByText('Unassigned talk')).toBeInTheDocument();
    expect(screen.getByText('Talk senza track')).toBeInTheDocument();
    expect(saveAgenda()).toBeDisabled();

    await user.click(within(pool).getByRole('button', { name: /Track di Unassigned talk/ }));
    await user.click(await screen.findByRole('option', { name: 'Room B' }));
    await waitFor(() => expect(within(pool).queryByText('Unassigned talk')).not.toBeInTheDocument());
    await user.click(within(screen.getByRole('radiogroup', { name: 'Track' })).getByRole('radio', { name: 'Room B' }));
    expect(within(programme()).getByText('Unassigned talk')).toBeVisible();

    await user.click(saveAgenda());
    await waitFor(() => expect(api.lastUpdate()).toBeDefined());
    expect(api.lastUpdate()!.talks![0].trackId).toBe('track-2');
    expect(api.lastUpdate()!.agendaItems![0]).toMatchObject({ itemType: 'talk', talkId: 'talk-1', trackId: 'track-2' });
  });

  test('moves through one schedule page per track and shows only that track sessions', async () => {
    const user = userEvent.setup();
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
    renderAgenda();
    expect(await within(await screen.findByRole('region', { name: 'Programma' })).findByText('Room A session')).toBeVisible();
    expect(within(programme()).queryByText('Room B session')).not.toBeInTheDocument();
    expect(screen.queryByText('Modifiche non salvate')).not.toBeInTheDocument();
    await user.click(within(screen.getByRole('radiogroup', { name: 'Track' })).getByRole('radio', { name: 'Room B' }));
    expect(within(programme()).getByText('Room B session')).toBeVisible();
    expect(within(programme()).queryByText('Room A session')).not.toBeInTheDocument();
  });

  test('keeps schedule times together before the room and interval fields, with move buttons as the keyboard alternative', async () => {
    const user = userEvent.setup();
    serveEvent(eventFixture({
      agendaTracks: [{ workshopAgendaTrackId: 'track-1', name: 'Main stage', order: 0 }],
      talks: [{ workshopTalkId: 'talk-1', title: 'Opening', trackId: 'track-1', sessionType: 'talk', speakers: [] }],
      agendaItems: [
        { workshopAgendaItemId: 'item-0', itemType: 'talk', talkId: 'talk-1', trackId: 'track-1', startTime: '2024-03-15T11:00:00Z', endTime: '2024-03-15T12:00:00Z', order: 0 },
        { workshopAgendaItemId: 'item-1', itemType: 'service', title: 'Lunch', roomName: 'Dining room', trackId: 'track-1', startTime: '2024-03-15T12:00:00Z', endTime: '2024-03-15T13:00:00Z', order: 1 },
      ],
    }));
    renderAgenda();
    const times = await screen.findByRole('group', { name: 'Orario di Lunch' });
    expect(within(times).getByLabelText('Inizio di Lunch')).toHaveValue('12:00');
    expect(within(times).getByLabelText('Fine di Lunch')).toHaveValue('13:00');
    expect(screen.getByLabelText('Sala di Lunch')).toHaveValue('Dining room');
    expect(screen.getByLabelText('Titolo della pausa')).toHaveValue('Lunch');
    expect(times.compareDocumentPosition(screen.getByLabelText('Sala di Lunch')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sposta in alto: Opening' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Sposta in basso: Lunch' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Sposta in basso: Opening' }));
    expect(starts()).toEqual(['11:00', '12:00']);
    expect(within(programme()).getAllByLabelText(/^Inizio di /).map(input => input.getAttribute('aria-label'))).toEqual(['Inizio di Lunch', 'Inizio di Opening']);
    expect(screen.getByRole('button', { name: 'Sposta in alto: Opening' })).toHaveFocus();

    fireEvent.change(screen.getByLabelText('Fine di Opening'), { target: { value: '13:30' } });
    expect(screen.getByLabelText('Fine di Opening')).toHaveValue('13:30');
    await user.click(screen.getByRole('button', { name: 'Rimuovi: Lunch' }));
    expect(screen.queryByLabelText('Titolo della pausa')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Aggiungi pausa' }));
    await user.click(screen.getByRole('button', { name: 'Aggiungi' }));
    expect(screen.getByLabelText('Titolo della pausa')).toHaveValue('Pausa');
    expect(starts()).toEqual(['12:00', '13:30']);
  });

  test('refills the schedule from new parameters and refuses to save overlapping items', async () => {
    const user = userEvent.setup();
    const api = serveEvent(eventFixture({
      agendaTracks: [{ workshopAgendaTrackId: 'track-1', name: 'Main stage', order: 0 }],
      talks: [{ workshopTalkId: 'talk-1', title: 'First talk', trackId: 'track-1', sessionType: 'talk', speakers: [] }, { workshopTalkId: 'talk-2', title: 'Second talk', trackId: 'track-1', sessionType: 'talk', speakers: [] }],
    }));
    renderAgenda();
    await screen.findByText('First talk');
    await user.click(screen.getByRole('button', { name: 'Riempi gli orari' }));
    const form = screen.getByRole('form', { name: 'Riempi gli orari' });
    fireEvent.change(within(form).getByLabelText('Inizio *'), { target: { value: '14:00' } });
    await user.clear(within(form).getByRole('spinbutton', { name: 'Durata talk (minuti)' }));
    await user.type(within(form).getByRole('spinbutton', { name: 'Durata talk (minuti)' }), '30');
    await user.clear(within(form).getByRole('spinbutton', { name: 'Pausa tecnica (minuti)' }));
    await user.type(within(form).getByRole('spinbutton', { name: 'Pausa tecnica (minuti)' }), '10');
    await user.click(within(form).getByRole('button', { name: 'Riempi' }));
    expect(starts()).toEqual(['14:00', '14:30', '14:40']);
    expect(await screen.findByText('Orari riempiti')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Inizio di Second talk'), { target: { value: '14:10' } });
    await user.click(saveAgenda());
    expect(await within(programme()).findByRole('alert')).toHaveTextContent(/non possono sovrapporsi/);
    expect(api.to('/Workshop/Update/')).toHaveLength(0);
  });

  test('sends only the Sessionize ID to the importer and shows the imported talks', async () => {
    const user = userEvent.setup();
    const imported = eventFixture({
      agendaTracks: [{ workshopAgendaTrackId: 'track-1', name: 'Main stage', order: 0 }],
      talks: [{ workshopTalkId: 'session-1', sessionizeId: 'session-1', title: 'Imported talk', sessionType: 'talk', speakers: [{ sessionizeId: 'sp-1', name: 'Grace Hopper' }] }],
    });
    const api = serveEvent(eventFixture(), {
      '/Workshop/ImportSessionize/': () => { api.store.record = imported; return jsonResponse({ importedTalks: 1, importedSpeakers: 1 }); },
    });
    renderAgenda();
    await screen.findByRole('heading', { name: 'Programma' });
    const importForm = screen.getByRole('form', { name: 'Importa da Sessionize' });
    expect(within(importForm).getByRole('button', { name: 'Importa talk' })).toBeDisabled();
    await user.type(within(importForm).getByRole('textbox', { name: 'ID evento Sessionize' }), 'event123');
    await user.click(within(importForm).getByRole('button', { name: 'Importa talk' }));

    await waitFor(() => expect(api.to('/Workshop/ImportSessionize/w1', 'POST')).toHaveLength(1));
    expect(api.to('/Workshop/ImportSessionize/w1')[0].body).toEqual({ sessionizeId: 'event123' });
    expect(await screen.findByText('Talk importati da Sessionize')).toBeInTheDocument();
    expect(await within(programme()).findByText('Imported talk')).toBeVisible();
    expect(within(programme()).getByText('Grace Hopper')).toBeVisible();
    expect(api.to('/Speaker/Get').length).toBeGreaterThanOrEqual(2);
  });

  test('creates a talk with a speaker from the directory, edits it and removes it', async () => {
    const user = userEvent.setup();
    const api = serveEvent(eventFixture());
    renderAgenda();
    await user.click(await screen.findByRole('button', { name: 'Aggiungi talk' }));
    let dialog = await screen.findByRole('dialog', { name: 'Nuovo talk' });
    await user.type(within(dialog).getByRole('textbox', { name: 'Titolo' }), 'Analytical Engines');
    await user.click(within(dialog).getByRole('button', { name: 'Aggiungi' }));
    expect(await within(dialog).findByText("Scegli almeno un relatore dall'anagrafica.")).toBeInTheDocument();
    await user.type(within(dialog).getByRole('textbox', { name: 'Cerca un relatore' }), 'Ada');
    expect(within(dialog).queryByRole('checkbox', { name: 'Alan Turing' })).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole('checkbox', { name: 'Ada Lovelace' }));
    expect(within(dialog).getByRole('list', { name: 'Relatori scelti' })).toHaveTextContent('Ada Lovelace');
    await user.click(within(dialog).getByRole('button', { name: 'Aggiungi' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(within(programme()).getByText('Analytical Engines')).toBeVisible();
    expect(within(programme()).getByText('Ada Lovelace')).toBeVisible();
    expect(starts()).toEqual(['09:00']);

    await user.click(saveAgenda());
    await waitFor(() => expect(api.lastUpdate()).toBeDefined());
    const talk = api.lastUpdate()!.talks![0];
    expect(talk).toMatchObject({ title: 'Analytical Engines', sessionType: 'talk', speakers: [{ workshopSpeakerId: 'speaker-1', name: 'Ada Lovelace', biography: 'Engineer' }] });
    expect(talk.trackId).toBe(api.lastUpdate()!.agendaTracks![0].workshopAgendaTrackId);

    await user.click(within(programme()).getByRole('button', { name: 'Modifica: Analytical Engines' }));
    dialog = await screen.findByRole('dialog', { name: /Modifica talk/ });
    await user.click(within(dialog).getByRole('button', { name: 'Rimuovi talk…' }));
    await user.click(within(dialog).getByRole('button', { name: 'Rimuovi' }));
    await waitFor(() => expect(within(programme()).queryByText('Analytical Engines')).not.toBeInTheDocument());
    expect(screen.getByText('Modifiche non salvate')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Annulla modifiche' }));
    expect(within(programme()).getByText('Analytical Engines')).toBeVisible();
  });

  test('manages parallel tracks from the dialog', async () => {
    const user = userEvent.setup();
    serveEvent(eventFixture({ talks: [{ workshopTalkId: 'talk-1', title: 'Solo talk', sessionType: 'talk', speakers: [] }] }));
    renderAgenda();
    await screen.findByText('Solo talk');
    await user.click(screen.getByRole('button', { name: 'Track' }));
    const dialog = await screen.findByRole('dialog', { name: 'Track parallele' });
    await user.clear(within(dialog).getByRole('spinbutton', { name: 'Numero di track' }));
    await user.type(within(dialog).getByRole('spinbutton', { name: 'Numero di track' }), '2');
    await user.clear(within(dialog).getByRole('textbox', { name: 'Nome della track 2' }));
    await user.type(within(dialog).getByRole('textbox', { name: 'Nome della track 2' }), 'Sala B');
    await user.click(within(dialog).getByRole('button', { name: 'Fatto' }));
    expect(within(screen.getByRole('radiogroup', { name: 'Track' })).getByRole('radio', { name: 'Sala B' })).toBeInTheDocument();
    expect(screen.getByText('2 track parallele · orari sul giorno dell\'evento')).toBeInTheDocument();
  });

  test('keeps the legacy tracks editable: add, edit and delete send the whole record and reload it', async () => {
    const user = userEvent.setup();
    const api = serveEvent(eventFixture({ tracks: [
      { workshopTrackId: 'k1', title: 'Registrazione', startTime: '2024-03-15T08:30:00Z', endTime: '2024-03-15T09:00:00Z', level: 0, speakers: [], speakersName: '' },
      { workshopTrackId: 'k2', title: 'Intro a Blazor', startTime: '2024-03-15T09:00:00Z', endTime: '2024-03-15T10:00:00Z', level: 2, speakers: ['speaker-1'], speakersName: 'Ada Lovelace', abstract: 'Componenti.' },
    ] }));
    renderAgenda();
    const legacy = await screen.findByRole('region', { name: 'Sessioni in formato storico' });
    expect(within(legacy).getByText('Intro a Blazor')).toBeInTheDocument();
    expect(within(legacy).getByText('Ada Lovelace · Livello 2')).toBeInTheDocument();
    expect(within(legacy).getByText('15/03/2024, 09:00–10:00')).toBeInTheDocument();

    await user.click(within(legacy).getByRole('button', { name: 'Aggiungi sessione' }));
    let dialog = await screen.findByRole('dialog', { name: 'Nuova sessione' });
    await user.type(within(dialog).getByRole('textbox', { name: 'Titolo' }), 'Chiusura');
    fireEvent.change(within(dialog).getByLabelText('Inizio *'), { target: { value: '2024-03-15T11:00' } });
    fireEvent.change(within(dialog).getByLabelText('Fine *'), { target: { value: '2024-03-15T10:00' } });
    await user.click(within(dialog).getByRole('button', { name: 'Salva' }));
    expect(await within(dialog).findByText('La sessione deve finire dopo il suo inizio.')).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText('Fine *'), { target: { value: '2024-03-15T11:30' } });
    await user.click(within(dialog).getByRole('checkbox', { name: 'Alan Turing' }));
    await user.click(within(dialog).getByRole('button', { name: 'Salva' }));
    await waitFor(() => expect(api.lastUpdate()).toBeDefined());
    const added = api.lastUpdate()!.tracks!;
    expect(added).toHaveLength(3);
    expect(added[2]).toMatchObject({ workshopTrackId: '00000000-0000-0000-0000-000000000000', title: 'Chiusura', startTime: '2024-03-15T11:00:00.000Z', endTime: '2024-03-15T11:30:00.000Z', level: 0, speakers: ['speaker-2'], speakersName: 'Alan Turing', image: '' });
    expect(await screen.findByText('Sessione aggiunta')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(api.to('/Workshop/Get/').length).toBeGreaterThanOrEqual(2);

    await user.click(within(legacy).getByRole('button', { name: 'Modifica: Intro a Blazor' }));
    dialog = await screen.findByRole('dialog', { name: /Modifica sessione/ });
    expect(within(dialog).getByLabelText('Inizio *')).toHaveValue('2024-03-15T09:00');
    expect(within(dialog).getByRole('checkbox', { name: 'Ada Lovelace' })).toBeChecked();
    await user.type(within(dialog).getByRole('textbox', { name: 'Titolo' }), ' WebAssembly');
    await user.click(within(dialog).getByRole('button', { name: 'Salva' }));
    await waitFor(() => expect(api.lastUpdate()!.tracks!.find(track => track.workshopTrackId === 'k2')).toMatchObject({ title: 'Intro a Blazor WebAssembly', speakers: ['speaker-1'], level: 2 }));

    await user.click(within(legacy).getByRole('button', { name: 'Elimina: Registrazione' }));
    await user.click(within(legacy).getByRole('button', { name: 'Elimina' }));
    await waitFor(() => expect(api.lastUpdate()!.tracks!.map(track => track.workshopTrackId)).toEqual(['k2', '00000000-0000-0000-0000-000000000000']));
    expect(await screen.findByText('Sessione eliminata')).toBeInTheDocument();
  });

  test('blocks the import while the agenda has unsaved changes', async () => {
    const user = userEvent.setup();
    serveEvent(eventFixture({ talks: [{ workshopTalkId: 'talk-1', title: 'First talk', sessionType: 'talk', speakers: [] }] }));
    renderAgenda();
    await screen.findByText('First talk');
    const importForm = screen.getByRole('form', { name: 'Importa da Sessionize' });
    await user.type(within(importForm).getByRole('textbox', { name: 'ID evento Sessionize' }), 'abc');
    expect(within(importForm).getByRole('button', { name: 'Importa talk' })).toBeDisabled();
    expect(within(importForm).getByText(/Salva l'agenda prima di importare/)).toBeInTheDocument();
  });
});

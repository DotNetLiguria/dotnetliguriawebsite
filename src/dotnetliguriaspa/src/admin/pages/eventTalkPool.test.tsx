import userEvent from '@testing-library/user-event';
import { adminToasts } from '../toasts';
import { fireEvent, jsonResponse, screen, waitFor, within } from '../../test-utils';
import { eventFixture, serveEvent, speakersFixture } from './eventFixtures';
import { renderAt, loaded, createForm, poolList, twoTalks } from './eventAgendaFixtures';

beforeEach(() => adminToasts.clear());

describe('event talk pool', () => {
  const setTrackCount = (count: number | '') => fireEvent.change(screen.getByRole('spinbutton', { name: 'Numero di track' }), { target: { value: String(count) } });

  test('previews and imports Sessionize talks; imported talks replace the list while unsaved tracks stay', async () => {
    const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
    const grace = { workshopSpeakerId: 'speaker-3', sessionizeId: 'sp-1', name: 'Grace Hopper', isActive: true };
    const imported = eventFixture({ talks: [{ workshopTalkId: 'session-1', sessionizeId: 'session-1', title: 'Imported talk', sessionType: 'talk', speakers: [{ workshopSpeakerId: 'speaker-3', sessionizeId: 'sp-1', name: 'Grace Hopper' }] }] });
    let imports = 0;
    const api = serveEvent(eventFixture({ talks: [{ workshopTalkId: 'local-1', title: 'Local talk', sessionType: 'talk', speakers: [] }] }), {
      '/Workshop/PreviewSessionize/': () => jsonResponse([]),
      '/Workshop/ImportSessionize/': () => { imports += 1; api.store.record = imported; return jsonResponse({ importedTalks: 1, importedSpeakers: 1 }); },
      // The importer adds the matching speaker records: the speakers are read again afterwards.
      '/Speaker/Get': () => jsonResponse(imports ? [...speakersFixture, grace] : speakersFixture),
    });
    renderAt('#talk-pool');
    await loaded();
    expect(screen.getByDisplayValue('Local talk')).toBeInTheDocument();
    setTrackCount(2);
    fireEvent.change(screen.getByRole('textbox', { name: 'Nome track 2' }), { target: { value: 'Room B' } });
    expect(screen.queryByRole('button', { name: 'Importa talk' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Importa da$/ }));
    await user.click(await screen.findByRole('option', { name: 'Sessionize' }));
    expect(screen.getByRole('button', { name: 'Importa talk' })).toBeDisabled();
    fireEvent.change(screen.getByRole('textbox', { name: 'ID Sessionize' }), { target: { value: 'event123' } });
    await user.click(screen.getByRole('button', { name: 'Importa talk' }));

    await waitFor(() => expect(api.to('/Workshop/PreviewSessionize/w1', 'POST')).toHaveLength(1));
    await waitFor(() => expect(api.to('/Workshop/ImportSessionize/w1', 'POST')).toHaveLength(1));
    expect(api.to('/Workshop/ImportSessionize/w1')[0].body).toEqual({ sessionizeId: 'event123', speakerOverwriteDecisions: {} });
    await waitFor(() => expect(api.to('/Workshop/Get/').length).toBeGreaterThanOrEqual(2));
    expect(await screen.findByText('Talk importati da Sessionize e schede dei relatori corrispondenti aggiornate.')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Imported talk')).toBeVisible();
    expect(screen.queryByDisplayValue('Local talk')).not.toBeInTheDocument();
    expect(within(poolList()).getByRole('button', { name: 'Rimuovi Grace Hopper' })).toBeVisible();
    expect(screen.getByRole('textbox', { name: 'Nome track 2' })).toHaveValue('Room B');
    expect(api.to('/Speaker/Get')).toHaveLength(2);
    expect(api.to('/Workshop/Update/')).toHaveLength(0);

    // The imported talks are part of the record now: the final whole-record save keeps them.
    for (let i = 0; i < 4 && !screen.queryByRole('button', { name: 'Salva modifiche' }); i += 1) {
      await user.click(screen.getByRole('button', { name: /^Avanti/ }));
    }
    await user.click(screen.getByRole('button', { name: 'Salva modifiche' }));
    await waitFor(() => expect(api.to('/Workshop/Update/w1', 'PUT')).toHaveLength(1));
    expect(api.lastUpdate()!.talks!.map(talk => talk.title)).toEqual(['Imported talk']);
  }, 10000);

  test('asks separately about each speaker collision and sends the selected decisions', async () => {
    const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(true).mockReturnValueOnce(false);
    const api = serveEvent(eventFixture(), {
      '/Workshop/PreviewSessionize/': () => jsonResponse([
        { sessionizeId: 'session-a', importedName: 'Ada Lovelace', existingName: 'Ada Lovelace' },
        { sessionizeId: 'session-b', importedName: 'Grace Hopper', existingName: 'Grace Hopper' },
      ]),
      '/Workshop/ImportSessionize/': () => jsonResponse({ importedTalks: 1, importedSpeakers: 2 }),
    });
    renderAt('#talk-pool');
    await loaded();
    await user.click(screen.getByRole('button', { name: /Importa da$/ }));
    await user.click(await screen.findByRole('option', { name: 'Sessionize' }));
    await user.type(screen.getByRole('textbox', { name: 'ID Sessionize' }), 'event123');
    await user.click(screen.getByRole('button', { name: 'Importa talk' }));

    await waitFor(() => expect(api.to('/Workshop/ImportSessionize/w1', 'POST')).toHaveLength(1));
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(confirm.mock.calls[0][0]).toContain('Ada Lovelace');
    expect(confirm.mock.calls[1][0]).toContain('Grace Hopper');
    expect(api.to('/Workshop/ImportSessionize/w1')[0].body).toEqual({
      sessionizeId: 'event123',
      speakerOverwriteDecisions: { 'session-a': true, 'session-b': false },
    });
    confirm.mockRestore();
  });

  test('reports a failed speaker reload after the import with the previous message, keeping the imported talks', async () => {
    const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
    let speakerCalls = 0;
    const imported = eventFixture({ talks: [{ workshopTalkId: 'session-1', title: 'Imported talk', sessionType: 'talk', speakers: [] }] });
    const api = serveEvent(eventFixture(), {
      '/Workshop/PreviewSessionize/': () => jsonResponse([]),
      '/Workshop/ImportSessionize/': () => { api.store.record = imported; return jsonResponse({}); },
      '/Speaker/Get': () => (++speakerCalls === 1 ? jsonResponse([]) : new Response(null, { status: 500 })),
    });
    renderAt('#talk-pool');
    await loaded();
    await user.click(screen.getByRole('button', { name: /Importa da$/ }));
    await user.click(await screen.findByRole('option', { name: 'Sessionize' }));
    await user.type(screen.getByRole('textbox', { name: 'ID Sessionize' }), 'event123');
    await user.click(screen.getByRole('button', { name: 'Importa talk' }));
    expect(await screen.findByText('Impossibile ricaricare i relatori importati (HTTP 500)')).toBeInTheDocument();
    expect(screen.queryByText(/Talk importati da Sessionize/)).not.toBeInTheDocument();
    expect(screen.getByDisplayValue('Imported talk')).toBeVisible();
  });

  test('words a refused Sessionize import with the server detail, else its fallback', async () => {
    const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
    serveEvent(eventFixture(), {
      '/Workshop/PreviewSessionize/': () => jsonResponse([]),
      '/Workshop/ImportSessionize/': () => new Response(null, { status: 502 }),
    });
    renderAt('#talk-pool');
    await loaded();
    await user.click(screen.getByRole('button', { name: /Importa da$/ }));
    await user.click(await screen.findByRole('option', { name: 'Sessionize' }));
    await user.type(screen.getByRole('textbox', { name: 'ID Sessionize' }), 'event123');
    await user.click(screen.getByRole('button', { name: 'Importa talk' }));
    expect(await screen.findByText('Importazione da Sessionize non riuscita (HTTP 502)')).toBeInTheDocument();
  });

  test('lists the directory speakers in the order the API returns them, as the previous autocomplete', async () => {
    const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
    serveEvent(eventFixture(), {}, { speakers: [
      { workshopSpeakerId: 's-z', name: 'Zoe Zanetti', isActive: true },
      { workshopSpeakerId: 's-a', name: 'Anna Bianchi', isActive: true },
      { workshopSpeakerId: 's-m', name: 'Marco Rossi', isActive: true },
    ] });
    renderAt('#talk-pool');
    await loaded();
    await user.click(within(createForm()).getByRole('button', { name: 'Seleziona uno o più relatori' }));
    expect(within(createForm()).getAllByRole('checkbox').map(box => box.closest('label')?.textContent)).toEqual(['Zoe Zanetti', 'Anna Bianchi', 'Marco Rossi']);
  });

  test('creates a talk using a speaker selected from the admin speaker directory', async () => {
    const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
    const api = serveEvent(eventFixture());
    renderAt('#talk-pool');
    await loaded();
    const form = createForm();
    await user.click(within(form).getByRole('button', { name: 'Aggiungi talk al pool' }));
    expect(await screen.findByText('Inserisci un titolo per il talk.')).toBeInTheDocument();
    await user.type(within(form).getByRole('textbox', { name: 'Titolo del talk' }), 'Analytical Engines');
    await user.click(within(form).getByRole('button', { name: 'Aggiungi talk al pool' }));
    expect(await screen.findByText("Seleziona almeno un relatore dall'anagrafica relatori.")).toBeInTheDocument();
    await user.click(within(form).getByRole('button', { name: 'Seleziona uno o più relatori' }));
    await user.type(within(form).getByRole('textbox', { name: 'Seleziona uno o più relatori' }), 'Ada');
    expect(within(form).queryByRole('checkbox', { name: 'Alan Turing' })).not.toBeInTheDocument();
    await user.click(within(form).getByRole('checkbox', { name: 'Ada Lovelace' }));
    await user.click(within(form).getByRole('button', { name: 'Aggiungi talk al pool' }));
    expect(await screen.findByText("Talk aggiunto al pool dell'evento. Salva il talk pool per renderlo definitivo.")).toBeInTheDocument();

    const list = poolList();
    expect(within(list).getByDisplayValue('Analytical Engines')).toBeVisible();
    expect(screen.getByText('I talk sono assegnati a Track 1 automaticamente.')).toBeInTheDocument();
    expect(within(list).getByText('Track 1')).toBeInTheDocument();
    expect(within(list).getByText('Ada Lovelace')).toBeVisible();
    expect(within(form).getByRole('textbox', { name: 'Titolo del talk' })).toHaveValue('');

    await user.click(screen.getByRole('button', { name: 'Salva talk pool' }));
    await waitFor(() => expect(api.lastUpdate()).toBeDefined());
    const talk = api.lastUpdate()!.talks![0];
    expect(talk).toMatchObject({ title: 'Analytical Engines', sessionType: 'talk', speakers: [{ workshopSpeakerId: 'speaker-1', name: 'Ada Lovelace', biography: 'Engineer' }] });
    expect(talk.trackId).toBe(api.lastUpdate()!.agendaTracks![0].workshopAgendaTrackId);
  });

  test('offers Talk, Panel, Introduzione and Altro for a new talk, and Servizio too in the pool', async () => {
    const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
    serveEvent(twoTalks());
    renderAt('#talk-pool');
    await loaded();
    await user.click(within(createForm()).getByRole('button', { name: /Tipo di sessione$/ }));
    let listbox = await screen.findByRole('listbox');
    expect(within(listbox).getAllByRole('option').map(option => option.textContent)).toEqual(['Talk', 'Panel', 'Introduzione', 'Altro']);
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());
    await user.click(within(poolList()).getAllByRole('button', { name: /Tipo di sessione$/ })[0]);
    listbox = await screen.findByRole('listbox');
    expect(within(listbox).getAllByRole('option').map(option => option.textContent)).toEqual(['Talk', 'Panel', 'Introduzione', 'Servizio', 'Altro']);
  });

  test('matches a talk speaker to the directory by id or, without an id, by name, and shows only those, as before', async () => {
    const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
    const api = serveEvent(eventFixture({ talks: [
      { workshopTalkId: 'talk-1', title: 'By id', sessionType: 'talk', speakers: [{ workshopSpeakerId: 'speaker-2', name: 'Someone renamed' }, { workshopSpeakerId: 'gone', name: 'Not in the directory' }] },
      { workshopTalkId: 'talk-2', title: 'By name', sessionType: 'talk', speakers: [{ name: 'Ada Lovelace' }] },
    ] }));
    renderAt('#talk-pool');
    await loaded();
    const list = poolList();
    expect(within(list).getByRole('button', { name: 'Rimuovi Alan Turing' })).toBeInTheDocument();
    expect(within(list).getByRole('button', { name: 'Rimuovi Ada Lovelace' })).toBeInTheDocument();
    expect(within(list).queryByText('Not in the directory')).not.toBeInTheDocument();
    // Choosing speakers replaces the talk's list with the chosen directory speakers.
    await user.click(within(list).getByRole('button', { name: 'Rimuovi Alan Turing' }));
    await user.click(screen.getByRole('button', { name: 'Salva talk pool' }));
    await waitFor(() => expect(api.lastUpdate()).toBeDefined());
    expect(api.lastUpdate()!.talks![0].speakers).toEqual([]);
  });

  test('edits and removes talks inline in the pool', async () => {
    const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
    const api = serveEvent(twoTalks());
    renderAt('#talk-pool');
    await loaded();
    const list = poolList();
    const titles = within(list).getAllByRole('textbox', { name: 'Titolo del talk' });
    await user.type(titles[0], ' (keynote)');
    await user.click(within(list).getAllByRole('button', { name: 'Rimuovi' })[1]);
    expect(within(list).queryByDisplayValue('Second talk')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Salva talk pool' }));
    await waitFor(() => expect(api.lastUpdate()).toBeDefined());
    expect(api.lastUpdate()!.talks!.map(talk => talk.title)).toEqual(['First talk (keynote)']);
  });
});

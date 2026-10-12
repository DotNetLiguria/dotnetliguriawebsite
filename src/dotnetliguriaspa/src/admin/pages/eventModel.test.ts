import { describe, expect, it } from 'vitest';
import { eventFixture } from './eventFixtures';
import {
  AgendaDraftState, addServiceInterval, adoptTalks, agendaProblem, agendaSaveBody, autoFillSchedule, buildFormUpdate, buildWorkshopUpdate,
  coreValuesOf, dateInputValue, eventbriteIssues, eventbriteStatusLabel, hasAllowedExtension, initAgenda, isPublished, moveItem, onEventDay,
  parseRooms, problemDetail, registrationOf, setTrackCount, stepFromLocation, toClockTime, toStoredTime, unscheduledTalks, afterSave,
} from './eventModel';

const draft = (overrides: Partial<AgendaDraftState> = {}): AgendaDraftState => ({
  tracks: [{ workshopAgendaTrackId: 'track-1', name: 'Main stage', order: 0 }],
  talks: [
    { workshopTalkId: 'talk-1', title: 'First talk', sessionType: 'talk', trackId: 'track-1', speakers: [{ workshopSpeakerId: 'speaker-1', name: 'Ada' }] },
    { workshopTalkId: 'talk-2', title: 'Second talk', sessionType: 'talk', trackId: 'track-1', speakers: [] },
  ],
  items: [],
  bookingServiceUrl: '', eventbriteTicketCapacity: 0, eventbriteSalesStart: '', eventbriteSalesEnd: '', attendeeNotes: '',
  ...overrides,
});

describe('buildWorkshopUpdate', () => {
  it('updates edited fields while preserving the rest of the workshop data', () => {
    const original = eventFixture({
      location: { name: 'Community Hall', address: '1 Main Street', coordinates: '44.4,8.9', googleMapsUrl: 'https://maps.example.test/hall', maximumSpaces: 120, rooms: ['Auditorium', 'Room B'] },
      talks: [{ workshopTalkId: 'talk-1', title: 'Opening', sessionType: 'Talk', speakers: [] }],
      feedbackEnabled: true,
    });
    const legacy = { ...original, imageThumbnail: '/workshops/workshop001/workshop_thumb.png', legacyWorkshopField: 'keep me' };

    const updated = buildWorkshopUpdate(legacy, {
      published: true, inHomepage: false, feedbackEnabled: false, title: 'Updated title', description: 'Updated description', eventDate: '2027-06-21',
      locationName: 'New Hall', coordinates: '44.5,9.0', address: '2 Main Street', googleMapsUrl: 'https://maps.example.test/new-hall', maximumSpaces: '150',
    });

    expect(updated).toMatchObject({
      title: 'Updated title', description: 'Updated description', published: true, feedbackEnabled: false,
      imageThumbnail: '/workshops/workshop001/workshop_thumb.png', legacyWorkshopField: 'keep me', talks: original.talks,
      location: { name: 'New Hall', address: '2 Main Street', coordinates: '44.5,9.0', googleMapsUrl: 'https://maps.example.test/new-hall', maximumSpaces: 150, rooms: ['Auditorium', 'Room B'] },
    });
    const saved = new Date(updated.eventDate);
    expect([saved.getFullYear(), saved.getMonth(), saved.getDate()]).toEqual([2027, 5, 21]);
  });

  it('reads the current values, treats only `published === true` as published and keeps an empty date as it was', () => {
    expect(coreValuesOf(eventFixture()).eventDate).toBe('2024-03-15');
    expect(coreValuesOf(eventFixture({ published: undefined })).published).toBe(false);
    expect(isPublished(eventFixture({ published: false }))).toBe(false);
    expect(isPublished(eventFixture())).toBe(true);
    expect(buildWorkshopUpdate(eventFixture(), { ...coreValuesOf(eventFixture()), eventDate: '' }).eventDate).toBe('2024-03-15T10:00:00Z');
  });

  it('builds the "Salva modifiche" body with tags, extended HTML and rooms split on new lines only', () => {
    const body = buildFormUpdate(eventFixture(), { ...coreValuesOf(eventFixture()), title: 'T', tags: 'ai, web', blogHtml: '<p>x</p>', rooms: 'Auditorium, Room B\nSala C\n' });
    expect(body).toMatchObject({ title: 'T', tags: 'ai, web', blogHtml: '<p>x</p>', location: { name: 'Genova', rooms: ['Auditorium, Room B', 'Sala C'] } });
    expect(parseRooms('A\r\nB\n\n C ')).toEqual(['A', 'B', 'C']);
    expect(afterSave(eventFixture({ eventbriteEventId: 'ev', eventbriteSyncStatus: 'synced', eventbriteLastError: 'boom' }))).toMatchObject({ eventbriteSyncStatus: 'update-pending', eventbriteLastError: undefined });
    expect(afterSave(eventFixture({ eventbriteSyncStatus: 'x' })).eventbriteSyncStatus).toBe('x');
  });
});

describe('helpers', () => {
  it('reads dates and times the way the editor stores them', () => {
    expect(dateInputValue('2024-03-15T10:00:00Z')).toBe('2024-03-15');
    expect(dateInputValue('nonsense')).toBe('');
    expect(toClockTime('2024-03-15T09:05:00.000Z')).toBe('09:05');
    expect(toStoredTime('10:30', undefined, '2024-03-15T10:00:00Z')).toBe('2024-03-15T10:30:00.000Z');
    expect(toStoredTime('10:30', '2024-03-16T08:00:00Z', '2024-03-15T10:00:00Z')).toBe('2024-03-16T10:30:00.000Z');
    expect(hasAllowedExtension('slides.PDF', ['.pdf'])).toBe(true);
    expect(hasAllowedExtension('virus.exe', ['.pdf'])).toBe(false);
    expect(problemDetail(JSON.stringify({ title: 'T', detail: 'Workshop counter unavailable' }))).toBe('Workshop counter unavailable');
    expect(problemDetail(JSON.stringify({ message: 'Sessione scaduta' }))).toBe('Sessione scaduta');
    expect(problemDetail('<html>')).toBeNull();
    expect(onEventDay({ startTime: '2024-03-15T09:00:00Z' }, eventFixture())).toBe(true);
    expect(onEventDay({ startTime: '2024-12-03T09:00:00Z' }, eventFixture())).toBe(false);
    expect(onEventDay({ startTime: '2024-03-15T09:00:00Z' }, { eventDate: '2024-03-15T00:00:00+01:00' })).toBe(true);
  });

  it('maps the URL to a step, including the hashes of the previous six-section card', () => {
    expect(stepFromLocation('', '')).toBe('pubblicazione');
    expect(stepFromLocation('#agenda', '')).toBe('agenda');
    expect(stepFromLocation('#iscrizione', '')).toBe('iscrizione');
    expect(stepFromLocation('', '?tab=foto')).toBe('foto');
    expect(stepFromLocation('#panoramica', '')).toBe('informazioni');
    expect(stepFromLocation('#relatori', '')).toBe('talk');
    expect(stepFromLocation('#questionario', '')).toBe('pubblicazione');
    expect(stepFromLocation('#materiali', '')).toBe('materiali');
    expect(stepFromLocation('#sconosciuto', '')).toBe('pubblicazione');
  });

  it('names the Eventbrite status and lists what Eventbrite still needs from the record and the module state', () => {
    expect(eventbriteIssues(eventFixture(), draft({ talks: [] }))).toEqual(['Un numero positivo di biglietti gratuiti', 'Almeno una voce in agenda']);
    const ready = draft({ eventbriteTicketCapacity: 25, items: [{ workshopAgendaItemId: 'i1', itemType: 'service', trackId: 'track-1', startTime: '2024-03-15T09:00:00Z', endTime: '2024-03-15T10:00:00Z' }] });
    expect(eventbriteIssues(eventFixture(), ready)).toEqual([]);
    expect(eventbriteIssues(eventFixture({ description: '' }), { ...ready, eventbriteSalesStart: '2024-03-14T18:00', eventbriteSalesEnd: '2024-03-01T09:00' })).toEqual(["Descrizione dell'evento", "Fine vendite successiva all'inizio"]);
    expect(eventbriteStatusLabel(eventFixture())).toBe('Non creato');
    expect(eventbriteStatusLabel(eventFixture({ eventbriteEventId: 'e' }))).toBe('Bozza');
    expect(eventbriteStatusLabel(eventFixture({ eventbriteEventId: 'e', eventbriteSyncStatus: 'synced' }))).toBe('Bozza sincronizzata');
    expect(eventbriteStatusLabel(eventFixture({ eventbriteEventId: 'e', eventbriteSyncStatus: 'update-pending' }))).toBe('Da sincronizzare');
    expect(eventbriteStatusLabel(eventFixture({ eventbriteEventId: 'e', eventbritePublished: true }))).toBe('Pubblicato');
    // Backend statuses recorded before an event id exists are shown with their meaning, raw when unknown.
    expect(eventbriteStatusLabel(eventFixture({ eventbriteSyncStatus: 'creating-event' }))).toBe("Creazione dell'evento in corso");
    expect(eventbriteStatusLabel(eventFixture({ eventbriteSyncStatus: 'event-created' }))).toBe('Evento creato, biglietto da creare');
    expect(eventbriteStatusLabel(eventFixture({ eventbriteSyncStatus: 'creating-ticket' }))).toBe('Creazione del biglietto in corso');
    expect(eventbriteStatusLabel(eventFixture({ eventbriteSyncStatus: 'reconciliation-required' }))).toMatch(/^Da riconciliare/);
    expect(eventbriteStatusLabel(eventFixture({ eventbriteSyncStatus: 'failed' }))).toBe('Sincronizzazione fallita');
    expect(eventbriteStatusLabel(eventFixture({ eventbriteSyncStatus: 'something-new' }))).toBe('something-new');
  });
});

describe('talk pool, schedule and registration', () => {
  it('starts from the record with a default track, talks and items on valid tracks, and the registration seeds', () => {
    const state = initAgenda(eventFixture({
      externalRegistration: true, externalRegistrationLink: 'https://old.example.test/signup', eventbriteTicketCapacity: 12, attendeeNotes: 'Laptop',
      talks: [{ workshopTalkId: 'talk-1', title: 'A', sessionType: 'talk', trackId: 'ghost', speakers: [] }],
      agendaItems: [
        { workshopAgendaItemId: 'i2', itemType: 'service', title: 'Lunch', startTime: '2024-03-15T12:00:00Z', endTime: '2024-03-15T13:00:00Z' },
        { workshopAgendaItemId: 'i1', itemType: 'talk', talkId: 'talk-1', startTime: '2024-03-15T09:00:00Z', endTime: '2024-03-15T10:00:00Z' },
      ],
    }));
    expect(state.tracks).toHaveLength(1);
    expect(state.tracks[0].name).toBe('Track 1');
    expect(state.talks[0].trackId).toBe(state.tracks[0].workshopAgendaTrackId);
    expect(state.items.map(item => [item.workshopAgendaItemId, item.order])).toEqual([['i1', 0], ['i2', 1]]);
    expect(state.scheduleStart).toBe('09:00');
    expect(state).toMatchObject({ bookingServiceUrl: 'https://old.example.test/signup', eventbriteTicketCapacity: 12, eventbriteSalesStart: '', attendeeNotes: 'Laptop' });
    // With an Eventbrite event the legacy registration link is not reused as booking link.
    expect(registrationOf(eventFixture({ externalRegistrationLink: 'https://old', eventbriteEventId: 'ev' })).bookingServiceUrl).toBe('');
    expect(adoptTalks([{ workshopTalkId: 't', title: 'x', sessionType: 'talk', speakers: [] }], state.tracks)[0].trackId).toBe(state.tracks[0].workshopAgendaTrackId);
    expect(adoptTalks([{ workshopTalkId: 't', title: 'x', sessionType: 'talk', speakers: [], trackId: 'k' }], [...state.tracks, { workshopAgendaTrackId: 'b', name: 'B', order: 1 }])[0].trackId).toBe('k');
  });

  it('adds and removes tracks, moving the talks of removed tracks to the first one', () => {
    const two = setTrackCount(draft(), 2);
    expect(two.tracks.map(track => track.name)).toEqual(['Main stage', 'Track 2']);
    const moved = { ...two, talks: two.talks.map(talk => ({ ...talk, trackId: two.tracks[1].workshopAgendaTrackId })) };
    const one = setTrackCount(moved, 0);
    expect(one.tracks).toHaveLength(1);
    expect(one.talks.every(talk => talk.trackId === 'track-1')).toBe(true);
    expect(one.bookingServiceUrl).toBe('');
  });

  it('fills every talk from the start time with technical gaps, keeps intervals and rejects bad input', () => {
    const filled = autoFillSchedule(draft(), { start: '09:00', duration: '60', gap: '5' }, '2024-03-15T10:00:00Z');
    if ('error' in filled) throw new Error(filled.error);
    expect(filled.items.map(item => [item.itemType, toClockTime(item.startTime), toClockTime(item.endTime)])).toEqual([
      ['talk', '09:00', '10:00'], ['break', '10:00', '10:05'], ['talk', '10:05', '11:05'],
    ]);
    expect(filled.items[0].startTime).toBe('2024-03-15T09:00:00.000Z');
    expect(filled.items[1].title).toBe('Technical gap');

    const withLunch = addServiceInterval(draft({ items: filled.items }), 'track-1', { title: 'Pranzo', room: 'Sala B', gap: '5', scheduleStart: '09:00', eventDate: '2024-03-15T10:00:00Z' });
    expect(withLunch.items.at(-1)).toMatchObject({ itemType: 'service', title: 'Pranzo', roomName: 'Sala B', startTime: '2024-03-15T11:05:00.000Z', endTime: '2024-03-15T11:10:00.000Z', order: 3 });
    // An empty title falls back to the stored default the public agenda recognises, as before.
    expect(addServiceInterval(draft(), 'track-1', { title: '  ', room: '', gap: '5', scheduleStart: '09:00', eventDate: '2024-03-15T10:00:00Z' }).items[0]).toMatchObject({ title: 'Service interval', startTime: '2024-03-15T09:00:00.000Z', endTime: '2024-03-15T09:05:00.000Z' });
    const refilled = autoFillSchedule(withLunch, { start: '14:00', duration: '30', gap: '10' }, '2024-03-15T10:00:00Z');
    if ('error' in refilled) throw new Error(refilled.error);
    expect(refilled.items.map(item => [item.title ?? item.itemType, toClockTime(item.startTime)])).toEqual([['talk', '14:00'], ['Technical gap', '14:30'], ['talk', '14:40'], ['Pranzo', '15:10']]);

    expect(autoFillSchedule(draft(), { start: '09:00', duration: '0', gap: '5' })).toEqual({ error: 'Indica un orario di inizio valido e durate positive per talk e pause.' });
    const unassigned = draft({ talks: [{ ...draft().talks[0], trackId: null }] });
    expect(autoFillSchedule(unassigned, { start: '09:00', duration: '60', gap: '5' })).toEqual({ error: 'Assegna ogni talk a una track prima di riempire gli orari.' });
    expect(unscheduledTalks(draft())).toHaveLength(2);
    expect(unscheduledTalks(draft({ items: filled.items }))).toHaveLength(0);
  });

  it('moves an item keeping the time slots', () => {
    const filled = autoFillSchedule(draft(), { start: '09:00', duration: '60', gap: '5' }, '2024-03-15T10:00:00Z');
    if ('error' in filled) throw new Error(filled.error);
    const state = draft({ items: filled.items });
    const moved = moveItem(state, 'track-1', filled.items[0].workshopAgendaItemId, 1);
    const byOrder = [...moved.items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    expect(byOrder.map(item => [item.itemType, toClockTime(item.startTime)])).toEqual([['break', '09:00'], ['talk', '10:00'], ['talk', '10:05']]);
    expect(moveItem(state, 'track-1', filled.items[0].workshopAgendaItemId, -1)).toBe(state);
  });

  it('checks a save the way each page did: items and overlaps only outside the registration page', () => {
    const filled = autoFillSchedule(draft(), { start: '09:00', duration: '60', gap: '5' }, '2024-03-15T10:00:00Z');
    if ('error' in filled) throw new Error(filled.error);
    const state = draft({ items: filled.items });
    expect(agendaProblem(state, 'schedule')).toBeNull();
    expect(agendaProblem(draft({ ...state, eventbriteSalesStart: '2024-03-14T18:00', eventbriteSalesEnd: '2024-03-01T09:00' }), 'registration')).toBe('La vendita dei biglietti deve finire dopo il suo inizio.');
    expect(agendaProblem({ ...state, talks: [{ ...state.talks[0], trackId: null }, state.talks[1]] }, 'registration')).toBe("Assegna ogni talk a una track prima di salvare l'agenda.");
    const backwards = { ...state, items: [{ ...filled.items[0], endTime: filled.items[0].startTime }] };
    expect(agendaProblem(backwards, 'talks')).toBe("Ogni voce dell'agenda deve finire dopo il suo inizio.");
    expect(agendaProblem(backwards, 'registration')).toBeNull();
    const overlapping = { ...state, items: filled.items.map(item => ({ ...item, startTime: '2024-03-15T09:00:00.000Z', endTime: '2024-03-15T10:00:00.000Z' })) };
    expect(agendaProblem(overlapping, 'schedule')).toMatch(/non possono sovrapporsi/);
    expect(agendaProblem(overlapping, 'registration')).toBeNull();
    const parallel = setTrackCount(state, 2);
    const second = parallel.tracks[1].workshopAgendaTrackId;
    const items = parallel.items.filter(item => item.itemType === 'talk').map((item, index) => ({ ...item, trackId: index ? second : 'track-1', startTime: '2024-03-15T09:00:00.000Z', endTime: '2024-03-15T10:00:00.000Z', roomName: '' }));
    const talks = parallel.talks.map((talk, index) => ({ ...talk, trackId: index ? second : 'track-1' }));
    expect(agendaProblem({ ...parallel, talks, items }, 'schedule')).toBeNull();
    expect(agendaProblem({ ...parallel, talks, items: items.map(item => ({ ...item, roomName: 'Aula 1' })) }, 'schedule')).toMatch(/sovrapporsi/);
    const sameSpeaker = talks.map(talk => ({ ...talk, speakers: [{ workshopSpeakerId: 'speaker-1', name: 'Ada' }] }));
    expect(agendaProblem({ ...parallel, talks: sameSpeaker, items }, 'schedule')).toMatch(/stesso relatore/);
  });

  it('builds the module save body with the registration pair, as the previous save did', () => {
    const state = draft({ bookingServiceUrl: 'https://b', eventbriteTicketCapacity: 35, eventbriteSalesStart: '2024-03-01T09:00', eventbriteSalesEnd: '2024-03-14T18:00', attendeeNotes: 'Laptop' });
    expect(agendaSaveBody(eventFixture({ title: 'Keep' }), state)).toMatchObject({
      title: 'Keep', bookingServiceUrl: 'https://b', externalRegistration: true, externalRegistrationLink: 'https://b', eventbriteTicketCapacity: 35,
      eventbriteSalesStart: '2024-03-01T09:00', eventbriteSalesEnd: '2024-03-14T18:00', attendeeNotes: 'Laptop', talks: state.talks, agendaTracks: state.tracks, agendaItems: [],
    });
    expect(agendaSaveBody(eventFixture(), draft()).externalRegistration).toBe(false);
  });
});

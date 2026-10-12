import { describe, expect, it } from 'vitest';
import { eventFixture, speakersFixture } from './eventFixtures';
import {
  AgendaState, addServiceInterval, agendaProblem, agendaSaveBody, autoFillSchedule, buildWorkshopUpdate, coreValuesOf, dateInputValue,
  eventSpeakers, eventbriteIssues, eventbriteStatusLabel, hasAllowedExtension, hasOnlyLegacyProgramme, initAgenda, moveItem, onEventDay,
  parseRooms, problemDetail, setTrackCount, stepStatuses, toClockTime, toStoredTime, unscheduledTalks, withBookingUrl, afterSave,
} from './eventModel';

const twoTalks: AgendaState = {
  tracks: [{ workshopAgendaTrackId: 'track-1', name: 'Main stage', order: 0 }],
  talks: [
    { workshopTalkId: 'talk-1', title: 'First talk', sessionType: 'talk', trackId: 'track-1', speakers: [{ workshopSpeakerId: 'speaker-1', name: 'Ada' }] },
    { workshopTalkId: 'talk-2', title: 'Second talk', sessionType: 'talk', trackId: 'track-1', speakers: [] },
  ],
  items: [],
};

describe('buildWorkshopUpdate', () => {
  it('updates edited fields while preserving the rest of the workshop data', () => {
    const original = eventFixture({
      location: { name: 'Community Hall', address: '1 Main Street', coordinates: '44.4,8.9', googleMapsUrl: 'https://maps.example.test/hall', maximumSpaces: 120, rooms: ['Auditorium', 'Room B'] },
      talks: [{ workshopTalkId: 'talk-1', title: 'Opening', sessionType: 'Talk', speakers: [] }],
      feedbackEnabled: true,
    });
    const legacy = { ...original, imageThumbnail: '/workshops/workshop001/workshop_thumb.png', legacyWorkshopField: 'keep me' };

    const updated = buildWorkshopUpdate(legacy, {
      ...coreValuesOf(legacy),
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
    expect(coreValuesOf(original).eventDate).toBe('2024-03-15');
  });

  it('keeps the booking link and the legacy registration pair together, and marks an Eventbrite event as pending', () => {
    const body = withBookingUrl(eventFixture(), 'https://booking.example.test/1');
    expect(body).toMatchObject({ bookingServiceUrl: 'https://booking.example.test/1', externalRegistration: true, externalRegistrationLink: 'https://booking.example.test/1' });
    expect(withBookingUrl(eventFixture(), '').externalRegistration).toBe(false);
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
    expect(parseRooms('Auditorium\nRoom B, Room C\n')).toEqual(['Auditorium', 'Room B', 'Room C']);
    expect(hasAllowedExtension('slides.PDF', ['.pdf'])).toBe(true);
    expect(hasAllowedExtension('virus.exe', ['.pdf'])).toBe(false);
    expect(problemDetail(JSON.stringify({ title: 'T', detail: 'Workshop counter unavailable' }))).toBe('Workshop counter unavailable');
    expect(problemDetail(JSON.stringify({ message: 'Sessione scaduta' }))).toBe('Sessione scaduta');
    expect(problemDetail('<html>')).toBeNull();
  });

  it('lists the event speakers from the agenda or the legacy tracks, matched to the directory', () => {
    const fromTalks = eventSpeakers(eventFixture({ talks: [
      { workshopTalkId: 't1', title: 'A', sessionType: 'talk', speakers: [{ workshopSpeakerId: 'speaker-1', name: 'Ada Lovelace' }, { name: 'Grace Hopper' }] },
      { workshopTalkId: 't2', title: 'B', sessionType: 'talk', speakers: [{ name: 'ada lovelace' }] },
    ] }), speakersFixture);
    expect(fromTalks.map(entry => [entry.name, entry.sessions, entry.speaker?.workshopSpeakerId ?? null])).toEqual([['Ada Lovelace', 2, 'speaker-1'], ['Grace Hopper', 1, null]]);
    const fromTracks = eventSpeakers(eventFixture({ tracks: [
      { workshopTrackId: 'k1', title: 'Legacy', startTime: '2024-03-15T09:00:00Z', endTime: '2024-03-15T10:00:00Z', speakers: ['speaker-2'], speakersName: 'Alan Turing' },
      { workshopTrackId: 'k2', title: 'Legacy 2', startTime: '2024-03-15T10:00:00Z', endTime: '2024-03-15T11:00:00Z', speakersName: 'Alan Turing, Someone Else' },
    ] }), speakersFixture);
    expect(fromTracks.map(entry => [entry.name, entry.sessions])).toEqual([['Alan Turing', 2], ['Someone Else', 1]]);
  });

  it('explains what Eventbrite still needs and names its status', () => {
    expect(eventbriteIssues(eventFixture())).toEqual(['Un numero positivo di biglietti gratuiti', 'Almeno una track in agenda', 'Almeno una voce in agenda']);
    const ready = eventFixture({ eventbriteTicketCapacity: 25, agendaTracks: [{ workshopAgendaTrackId: 'track-1', name: 'Main', order: 0 }], agendaItems: [{ workshopAgendaItemId: 'i1', itemType: 'service', trackId: 'track-1', startTime: '2024-03-15T09:00:00Z', endTime: '2024-03-15T10:00:00Z' }] });
    expect(eventbriteIssues(ready)).toEqual([]);
    expect(eventbriteIssues({ ...ready, eventbriteSalesStart: '2024-03-14T18:00', eventbriteSalesEnd: '2024-03-01T09:00' })).toEqual(["Fine vendite successiva all'inizio"]);
    expect(eventbriteStatusLabel(eventFixture())).toBe('Non creato');
    expect(eventbriteStatusLabel(eventFixture({ eventbriteEventId: 'e', eventbriteSyncStatus: 'synced' }))).toBe('Bozza sincronizzata');
    expect(eventbriteStatusLabel(eventFixture({ eventbriteEventId: 'e', eventbriteSyncStatus: 'update-pending' }))).toBe('Da sincronizzare');
    expect(eventbriteStatusLabel(eventFixture({ eventbriteEventId: 'e', eventbritePublished: true }))).toBe('Pubblicato');
  });
});

describe('steps', () => {
  const legacyTrack = { workshopTrackId: 'k1', title: 'Keynote', startTime: '2024-03-15T09:00:00Z', endTime: '2024-03-15T10:00:00Z', speakersName: 'Ada' };

  it('tells done, to do and optional steps apart from the saved record', () => {
    const complete = stepStatuses(eventFixture({ tracks: [legacyTrack], materials: [{ workshopFileId: 'f1' }], feedbackEnabled: true }), 1);
    expect(complete.map(step => [step.id, step.state, step.detail])).toEqual([
      ['panoramica', 'done', 'Completo'], ['agenda', 'done', '1 sessione'], ['relatori', 'done', '1 relatore'],
      ['materiali', 'done', '1 file'], ['questionario', 'done', 'Feedback aperto'], ['pubblicazione', 'done', 'Pubblicato'],
    ]);
    const fresh = stepStatuses(eventFixture({ description: '', image: '', published: false, eventDate: '2099-06-12T10:00:00Z' }), 0, new Date('2026-10-12T10:00:00Z'));
    expect(fresh.map(step => [step.id, step.state, step.detail])).toEqual([
      ['panoramica', 'todo', '3 elementi da completare'], ['agenda', 'todo', 'Nessuna sessione'], ['relatori', 'todo', 'Nessun relatore'],
      ['materiali', 'optional', 'Facoltativo'], ['questionario', 'optional', 'Facoltativo'], ['pubblicazione', 'todo', 'In bozza'],
    ]);
    // A past event no longer needs a booking link.
    expect(stepStatuses(eventFixture({ bookingServiceUrl: '' }), 0, new Date('2026-10-12T10:00:00Z'))[0].state).toBe('done');
    expect(stepStatuses(eventFixture({ bookingServiceUrl: '', eventDate: '2099-06-12T10:00:00Z' }), 0, new Date('2026-10-12T10:00:00Z'))[0].detail).toBe('1 elemento da completare');
  });

  it('recognises events that only have the historic programme and tracks stored on another day', () => {
    expect(hasOnlyLegacyProgramme(eventFixture({ tracks: [legacyTrack] }))).toBe(true);
    expect(hasOnlyLegacyProgramme(eventFixture())).toBe(false);
    expect(hasOnlyLegacyProgramme(eventFixture({ tracks: [legacyTrack], talks: [{ workshopTalkId: 't', title: 'x', sessionType: 'talk', speakers: [] }] }))).toBe(false);
    expect(onEventDay(legacyTrack, eventFixture())).toBe(true);
    expect(onEventDay({ startTime: '2024-12-03T09:00:00Z' }, eventFixture())).toBe(false);
    expect(onEventDay(legacyTrack, { eventDate: '2024-03-15T00:00:00+01:00' })).toBe(true);
  });
});

describe('agenda builder', () => {
  it('starts from a default track, attaches talks and items to valid tracks and numbers the items', () => {
    const state = initAgenda(eventFixture({
      talks: [{ workshopTalkId: 'talk-1', title: 'A', sessionType: 'talk', trackId: 'ghost', speakers: [] }],
      agendaItems: [
        { workshopAgendaItemId: 'i2', itemType: 'service', title: 'Lunch', startTime: '2024-03-15T12:00:00Z', endTime: '2024-03-15T13:00:00Z' },
        { workshopAgendaItemId: 'i1', itemType: 'talk', talkId: 'talk-1', startTime: '2024-03-15T09:00:00Z', endTime: '2024-03-15T10:00:00Z' },
      ],
    }));
    expect(state.tracks).toHaveLength(1);
    expect(state.tracks[0].name).toBe('Track 1');
    expect(state.talks[0].trackId).toBe(state.tracks[0].workshopAgendaTrackId);
    expect(state.items.map(item => [item.workshopAgendaItemId, item.order, item.trackId])).toEqual([['i1', 0, state.tracks[0].workshopAgendaTrackId], ['i2', 1, state.tracks[0].workshopAgendaTrackId]]);
    expect(state.scheduleStart).toBe('09:00');
    expect(initAgenda(eventFixture()).scheduleStart).toBe('09:00');
  });

  it('adds and removes tracks, moving the talks of removed tracks to the first one', () => {
    const two = setTrackCount(twoTalks, 2);
    expect(two.tracks.map(track => track.name)).toEqual(['Main stage', 'Track 2']);
    const moved = { ...two, talks: two.talks.map(talk => ({ ...talk, trackId: two.tracks[1].workshopAgendaTrackId })) };
    const one = setTrackCount(moved, 0);
    expect(one.tracks).toHaveLength(1);
    expect(one.talks.every(talk => talk.trackId === 'track-1')).toBe(true);
  });

  it('fills every talk from the start time with technical gaps, keeps intervals and rejects bad input', () => {
    const filled = autoFillSchedule(twoTalks, { start: '09:00', duration: '60', gap: '5' }, '2024-03-15T10:00:00Z');
    if ('error' in filled) throw new Error(filled.error);
    expect(filled.items.map(item => [item.itemType, toClockTime(item.startTime), toClockTime(item.endTime)])).toEqual([
      ['talk', '09:00', '10:00'], ['break', '10:00', '10:05'], ['talk', '10:05', '11:05'],
    ]);
    expect(filled.items[0].startTime).toBe('2024-03-15T09:00:00.000Z');
    expect(filled.items[1].title).toBe('Technical gap');

    const withLunch = addServiceInterval({ ...twoTalks, items: filled.items }, 'track-1', { title: 'Pranzo', room: 'Sala B', gap: '5', scheduleStart: '09:00', eventDate: '2024-03-15T10:00:00Z' });
    expect(withLunch.items.at(-1)).toMatchObject({ itemType: 'service', title: 'Pranzo', roomName: 'Sala B', startTime: '2024-03-15T11:05:00.000Z', endTime: '2024-03-15T11:10:00.000Z', order: 3 });
    const refilled = autoFillSchedule(withLunch, { start: '14:00', duration: '30', gap: '10' }, '2024-03-15T10:00:00Z');
    if ('error' in refilled) throw new Error(refilled.error);
    expect(refilled.items.map(item => [item.title ?? item.itemType, toClockTime(item.startTime)])).toEqual([['talk', '14:00'], ['Technical gap', '14:30'], ['talk', '14:40'], ['Pranzo', '15:10']]);

    expect(autoFillSchedule(twoTalks, { start: '09:00', duration: '0', gap: '5' })).toEqual({ error: 'Indica un orario di inizio valido e durate positive per talk e pause.' });
    const unassigned = { ...twoTalks, talks: [{ ...twoTalks.talks[0], trackId: null }] };
    expect(autoFillSchedule(unassigned, { start: '09:00', duration: '60', gap: '5' })).toEqual({ error: 'Assegna ogni talk a una track prima di riempire gli orari.' });
    expect(unscheduledTalks(twoTalks)).toHaveLength(2);
    expect(unscheduledTalks({ ...twoTalks, items: filled.items })).toHaveLength(0);
  });

  it('moves an item keeping the time slots and detects overlaps and unassigned talks before saving', () => {
    const filled = autoFillSchedule(twoTalks, { start: '09:00', duration: '60', gap: '5' }, '2024-03-15T10:00:00Z');
    if ('error' in filled) throw new Error(filled.error);
    const state = { ...twoTalks, items: filled.items };
    const moved = moveItem(state, 'track-1', filled.items[0].workshopAgendaItemId, 1);
    const byOrder = [...moved.items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    expect(byOrder.map(item => [item.itemType, toClockTime(item.startTime)])).toEqual([['break', '09:00'], ['talk', '10:00'], ['talk', '10:05']]);
    expect(moveItem(state, 'track-1', filled.items[0].workshopAgendaItemId, -1)).toBe(state);

    expect(agendaProblem(state)).toBeNull();
    expect(agendaProblem({ ...state, talks: [{ ...state.talks[0], trackId: null }, state.talks[1]] })).toBe("Assegna ogni talk a una track prima di salvare l'agenda.");
    const backwards = { ...state, items: [{ ...filled.items[0], endTime: filled.items[0].startTime }] };
    expect(agendaProblem(backwards)).toBe("Ogni voce dell'agenda deve finire dopo il suo inizio.");
    const overlapping = { ...state, items: filled.items.map(item => ({ ...item, startTime: '2024-03-15T09:00:00.000Z', endTime: '2024-03-15T10:00:00.000Z' })) };
    expect(agendaProblem(overlapping)).toMatch(/non possono sovrapporsi/);
    // Parallel tracks may overlap unless they share a room or a speaker.
    const parallel = setTrackCount(state, 2);
    const second = parallel.tracks[1].workshopAgendaTrackId;
    const items = parallel.items.filter(item => item.itemType === 'talk').map((item, index) => ({ ...item, trackId: index ? second : 'track-1', startTime: '2024-03-15T09:00:00.000Z', endTime: '2024-03-15T10:00:00.000Z', roomName: '' }));
    const talks = parallel.talks.map((talk, index) => ({ ...talk, trackId: index ? second : 'track-1' }));
    expect(agendaProblem({ ...parallel, talks, items })).toBeNull();
    expect(agendaProblem({ ...parallel, talks, items: items.map(item => ({ ...item, roomName: 'Aula 1' })) })).toMatch(/sovrapporsi/);
    const sameSpeaker = talks.map(talk => ({ ...talk, speakers: [{ workshopSpeakerId: 'speaker-1', name: 'Ada' }] }));
    expect(agendaProblem({ ...parallel, talks: sameSpeaker, items })).toMatch(/stesso relatore/);

    const body = agendaSaveBody(eventFixture({ bookingServiceUrl: 'https://b' }), state);
    expect(body).toMatchObject({ bookingServiceUrl: 'https://b', talks: state.talks, agendaTracks: state.tracks, agendaItems: state.items });
  });
});

import { SiteWorkshop } from '../siteApi';
import { programme, programmeSpan, programmeSpeakers, sessionCount, sessionsLabel } from './programme';

const base = (extra: Partial<SiteWorkshop>): SiteWorkshop => ({ workshopId: 'w', title: 'Evento', eventDate: '2099-03-15T00:00:00+01:00', ...extra });

const agendaWorkshop = base({
  tracks: [{ workshopTrackId: 'old', title: 'Programma storico', startTime: '2099-03-15T08:00:00Z', endTime: '2099-03-15T09:00:00Z' }],
  agendaTracks: [{ workshopAgendaTrackId: 'a', name: 'Sala grande', order: 0 }, { workshopAgendaTrackId: 'b', name: 'Sala piccola', order: 1 }],
  talks: [
    { workshopTalkId: 't1', title: 'Strumenti utili', abstract: 'Come progettarli.', sessionType: 'panel', speakers: [{ name: 'Ada Lovelace', imageUrl: 'https://img.example.test/ada.jpg', biography: 'Matematica.' }] },
    { workshopTalkId: 't2', title: 'Seconda sessione', sessionType: 'talk', speakers: [{ name: 'Ada Lovelace' }, { name: 'Alan Turing' }] },
  ],
  agendaItems: [
    { workshopAgendaItemId: 'i3', itemType: 'talk', talkId: 't2', trackId: 'b', startTime: '2099-03-15T11:05:00Z', endTime: '2099-03-15T12:00:00Z' },
    { workshopAgendaItemId: 'i2', itemType: 'break', trackId: 'a', title: 'Technical gap', startTime: '2099-03-15T11:00:00Z', endTime: '2099-03-15T11:05:00Z' },
    { workshopAgendaItemId: 'i1', itemType: 'talk', talkId: 't1', trackId: 'a', roomName: 'Aula A', startTime: '2099-03-15T10:00:00Z', endTime: '2099-03-15T11:00:00Z' },
    { workshopAgendaItemId: 'i4', itemType: 'service', trackId: null, title: 'Service interval', startTime: '2099-03-15T12:00:00Z', endTime: '2099-03-15T12:30:00Z' },
    { workshopAgendaItemId: 'i5', itemType: 'service', trackId: null, title: 'Pranzo a buffet', startTime: '2099-03-15T12:30:00Z', endTime: '2099-03-15T13:30:00Z' },
  ],
});

describe('programme', () => {
  test('prefers the agenda to the legacy tracks, in time order, without changeovers and with Italian break titles', () => {
    const entries = programme(agendaWorkshop);
    expect(entries.map(entry => entry.title)).toEqual(['Strumenti utili', 'Seconda sessione', 'Pausa', 'Pranzo a buffet']);
    expect(entries[0]).toMatchObject({ logistics: false, abstract: 'Come progettarli.', details: ['Sala grande', 'Aula A', 'Panel'] });
    expect(entries[1].details).toEqual(['Sala piccola']);
    expect(entries[2]).toMatchObject({ logistics: true, details: ['Tutte le track'], speakers: [] });
  });

  test('omits the track name when the agenda has a single track', () => {
    const entries = programme({ ...agendaWorkshop, agendaTracks: [{ workshopAgendaTrackId: 'a', name: 'Sala grande' }] });
    expect(entries[0].details).toEqual(['Aula A', 'Panel']);
  });

  test('summarises time span, sessions and speakers', () => {
    const entries = programme(agendaWorkshop);
    expect(programmeSpan(entries)).toEqual({ start: '2099-03-15T10:00:00Z', end: '2099-03-15T13:30:00Z' });
    expect(sessionCount(entries)).toBe(2);
    expect(programmeSpeakers(entries)).toEqual([
      { name: 'Ada Lovelace', imageUrl: 'https://img.example.test/ada.jpg', biography: 'Matematica.', sessions: 2 },
      { name: 'Alan Turing', imageUrl: undefined, biography: '', sessions: 1 },
    ]);
    expect([sessionsLabel(1), sessionsLabel(3)]).toEqual(['1 sessione', '3 sessioni']);
    expect(programmeSpan([])).toBeNull();
  });

  test('falls back to the legacy tracks, recognising logistics and splitting speaker names', () => {
    const entries = programme(base({
      agendaItems: [],
      tracks: [
        { workshopTrackId: 'b', title: 'Talk', startTime: '2024-05-07T12:30:00Z', endTime: '2024-05-07T13:15:00Z', speakersName: 'Andrea Merlin , Raffaele Rialdi' },
        { workshopTrackId: 'a', title: 'Registrazione', startTime: '2024-05-07T12:00:00Z', endTime: '2024-05-07T12:30:00Z' },
      ],
    }));
    expect(entries.map(entry => [entry.title, entry.logistics])).toEqual([['Registrazione', true], ['Talk', false]]);
    expect(entries[1].speakers.map(speaker => speaker.name)).toEqual(['Andrea Merlin', 'Raffaele Rialdi']);
  });
});

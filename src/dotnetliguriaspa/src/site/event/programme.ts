import { SiteWorkshop } from '../siteApi';
import { clean } from '../format';

export interface ProgrammeSpeaker {
  name: string;
  workshopSpeakerId?: string | null;
  imageUrl?: string | null;
  photoFallbackDisabled?: boolean;
  biography?: string;
}

/** One line of the event timeline, from the agenda or from the legacy tracks. */
export interface ProgrammeEntry {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  /** Registration, breaks and other logistics are shown quieter than sessions. */
  logistics: boolean;
  /** Track, room and session type, when they tell the visitor something. */
  details: string[];
  abstract: string;
  speakers: ProgrammeSpeaker[];
}

const LOGISTICS = /^(registrazione|q\s*&\s*a|saluto|saluti|pausa|chiusura)/i;
// Session types with an Italian label; keys are lower case without punctuation ("Lightning talk" → lightningtalk).
const SESSION_TYPE: Record<string, string> = {
  panel: 'Panel', intro: 'Introduzione', introduction: 'Introduzione', workshop: 'Workshop', keynote: 'Keynote',
  demo: 'Demo', lightning: 'Lightning talk', lightningtalk: 'Lightning talk', qa: 'Domande e risposte', qanda: 'Domande e risposte',
};
// The default type and the generic ones say nothing to the visitor.
const SILENT_TYPES = new Set(['', 'talk', 'other', 'service']);

/** Label of a session type: the Italian name when known, otherwise the stored value with an initial capital. */
export function sessionTypeLabel(type?: string | null): string | undefined {
  const text = clean(type);
  const key = text.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (SILENT_TYPES.has(key)) return undefined;
  return SESSION_TYPE[key] ?? `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
}
// Titles the agenda editor fills in by itself.
const CHANGEOVER = 'technical gap';
const DEFAULT_BREAK = new Set(['service interval', 'interval', 'service break', 'break']);

const byTime = (a: { startTime: string }, b: { startTime: string }) =>
  new Date(a.startTime).getTime() - new Date(b.startTime).getTime();

function fromAgenda(workshop: SiteWorkshop): ProgrammeEntry[] {
  const tracks = workshop.agendaTracks ?? [];
  const talks = new Map((workshop.talks ?? []).map(talk => [talk.workshopTalkId, talk]));
  const items = [...(workshop.agendaItems ?? [])].sort((a, b) => byTime(a, b) || (a.order ?? 0) - (b.order ?? 0));
  const entries: ProgrammeEntry[] = [];
  for (const item of items) {
    const talk = item.talkId ? talks.get(item.talkId) : undefined;
    const isTalk = (item.itemType ?? 'talk') === 'talk' && !!talk;
    const ownTitle = clean(item.title);
    if (!isTalk && ownTitle.toLowerCase() === CHANGEOVER) continue;

    const details: string[] = [];
    if (tracks.length > 1) {
      details.push(clean(tracks.find(track => track.workshopAgendaTrackId === item.trackId)?.name) || 'Tutte le track');
    }
    if (clean(item.roomName)) details.push(clean(item.roomName));
    const type = isTalk ? sessionTypeLabel(talk!.sessionType) : undefined;
    if (type) details.push(type);

    entries.push({
      id: item.workshopAgendaItemId,
      title: isTalk ? clean(talk!.title) : !ownTitle || DEFAULT_BREAK.has(ownTitle.toLowerCase()) ? 'Pausa' : ownTitle,
      startTime: item.startTime,
      endTime: item.endTime,
      logistics: !isTalk || clean(talk!.sessionType).toLowerCase() === 'service',
      details,
      abstract: isTalk ? clean(talk!.abstract) : '',
      speakers: isTalk
        ? (talk!.speakers ?? [])
          .filter(speaker => clean(speaker.name))
          .map(speaker => ({ name: clean(speaker.name), workshopSpeakerId: speaker.workshopSpeakerId, imageUrl: speaker.imageUrl, photoFallbackDisabled: speaker.photoFallbackDisabled, biography: clean(speaker.biography) }))
        : [],
    });
  }
  return entries;
}

function fromTracks(workshop: SiteWorkshop): ProgrammeEntry[] {
  return [...(workshop.tracks ?? [])].sort(byTime).map(track => ({
    id: track.workshopTrackId,
    title: clean(track.title),
    startTime: track.startTime,
    endTime: track.endTime,
    logistics: LOGISTICS.test(clean(track.title)),
    details: [],
    abstract: clean(track.abstract),
    speakers: clean(track.speakersName).split(/\s*,\s*/).filter(Boolean).map(name => ({ name })),
  }));
}

/** The event timeline: the agenda when one has been built, otherwise the legacy tracks. */
export const programme = (workshop: SiteWorkshop): ProgrammeEntry[] =>
  (workshop.agendaItems?.length ? fromAgenda(workshop) : fromTracks(workshop));

/** First start and last end of the timeline, or null when there is no programme. */
export function programmeSpan(entries: ProgrammeEntry[]) {
  if (entries.length === 0) return null;
  const start = entries.reduce((first, entry) => (byTime(entry, first) < 0 ? entry : first)).startTime;
  const end = entries.reduce((last, entry) => (new Date(entry.endTime) > new Date(last.endTime) ? entry : last)).endTime;
  return { start, end };
}

export const sessionCount = (entries: ProgrammeEntry[]) => entries.filter(entry => !entry.logistics).length;

export const sessionsLabel = (count: number) => `${count} ${count === 1 ? 'sessione' : 'sessioni'}`;

/** Number of parallel tracks of the agenda (0 for the legacy single-track programme). */
export const trackCount = (workshop: SiteWorkshop) => (workshop.agendaItems?.length ? (workshop.agendaTracks ?? []).length : 0);

export const tracksLabel = (count: number) => `${count} track parallele`;

/** Speakers in programme order, without duplicates, with how many sessions each one holds. */
export function programmeSpeakers(entries: ProgrammeEntry[]) {
  const speakers = new Map<string, ProgrammeSpeaker & { sessions: number }>();
  for (const entry of entries) {
    for (const speaker of entry.speakers) {
      const known = speakers.get(speaker.name);
      if (known) {
        known.sessions += 1;
        if (speaker.photoFallbackDisabled) {
          known.imageUrl = speaker.imageUrl;
          known.photoFallbackDisabled = true;
        } else if (!known.photoFallbackDisabled) known.imageUrl ??= speaker.imageUrl;
        known.biography ||= speaker.biography;
      } else {
        speakers.set(speaker.name, { ...speaker, sessions: 1 });
      }
    }
  }
  return [...speakers.values()];
}

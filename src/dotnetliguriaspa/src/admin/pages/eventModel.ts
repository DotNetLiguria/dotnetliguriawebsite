import { AdminWorkshop, clean, nameKey } from '../adminApi';
import type { VenueModel } from '../../models/VenueModel';

// Event record as serialized by DotNetLiguriaCore (dates are ISO strings on the wire) and the pure rules of the
// event admin: the whole-record update bodies, the agenda builder and the readiness checks. No React here.

export interface EventTalkSpeaker {
  workshopSpeakerId?: string | null;
  sessionizeId?: string | null;
  name?: string | null;
  imageUrl?: string | null;
  biography?: string | null;
}

export interface EventTalk {
  workshopTalkId: string;
  sessionizeId?: string | null;
  trackId?: string | null;
  title?: string | null;
  abstract?: string | null;
  sessionType?: string | null;
  speakers: EventTalkSpeaker[];
}

export interface AgendaTrack {
  workshopAgendaTrackId: string;
  name?: string | null;
  order: number;
}

export type AgendaItemType = 'talk' | 'break' | 'service';

export interface AgendaItem {
  workshopAgendaItemId: string;
  itemType?: AgendaItemType | null;
  talkId?: string | null;
  trackId?: string | null;
  order?: number;
  title?: string | null;
  roomName?: string | null;
  startTime: string;
  endTime: string;
}

/** Programme format of the events before the agenda builder (still shown by the site when no agenda exists). */
export interface LegacyTrack {
  workshopTrackId: string;
  title: string;
  image?: string | null;
  startTime: string;
  endTime: string;
  abstract?: string | null;
  level?: number;
  speakers?: string[] | null;
  speakersName?: string | null;
  speakersDetails?: string[];
}

export interface EventLocation {
  name?: string | null;
  address?: string | null;
  coordinates?: string | null;
  googleMapsUrl?: string | null;
  maximumSpaces?: number;
  rooms?: string[];
}

export interface EventFile {
  workshopFileId: string;
  workshopId?: string;
  title?: string | null;
  fileName?: string | null;
  fullPath?: string | null;
  fileType?: number | null;
}

export interface EventRecord extends AdminWorkshop {
  location?: EventLocation | null;
  tracks?: LegacyTrack[] | null;
  talks?: EventTalk[] | null;
  agendaTracks?: AgendaTrack[] | null;
  agendaItems?: AgendaItem[] | null;
  materials?: EventFile[] | null;
  photos?: EventFile[] | null;
  eventbriteTicketCapacity?: number;
  eventbriteSyncedTicketCapacity?: number;
  eventbriteSalesStart?: string | null;
  eventbriteSalesEnd?: string | null;
  eventbriteEventId?: string | null;
  eventbriteEventUrl?: string | null;
  eventbriteSyncStatus?: string | null;
  eventbriteLastError?: string | null;
  eventbriteLastSyncedAt?: string | null;
  eventbritePublished?: boolean;
}

export interface EventSpeaker {
  workshopSpeakerId: string;
  name: string;
  profileImageUrl?: string | null;
  description?: string | null;
  isActive?: boolean;
  sessionizeId?: string | null;
}

// ---------- File kinds (WorkshopFileTypeEnum) ----------

export const FILE_TYPE = { image: 1, photo: 2, material: 4 } as const;
export const MATERIAL_EXTENSIONS = ['.pdf', '.docx', '.pptx', '.xlsx'];
export const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];

export const hasAllowedExtension = (fileName: string, allowed: string[]) => {
  const dot = fileName.lastIndexOf('.');
  return dot >= 0 && allowed.includes(fileName.slice(dot).toLowerCase());
};

// ---------- Small helpers ----------

export const GUID = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
export const isGuid = (value: unknown): value is string => typeof value === 'string' && GUID.test(value);

export const createId = () => crypto.randomUUID();

/** yyyy-mm-dd (UTC) for a date input, like the previous admin did. */
export const dateInputValue = (value?: string | Date | null) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
};

/** "HH:MM" of a stored time, read as UTC: agenda times are wall-clock values stored with a Z suffix. */
export const toClockTime = (value?: Date | string | null) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (part: number) => part.toString().padStart(2, '0');
  return `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
};

/** Stored value for a "HH:MM" clock time: on the day of the existing value, else on the event day. */
export const toStoredTime = (clockTime: string, existingValue: Date | string | undefined | null, eventDate: Date | string | undefined | null) => {
  const datePart = existingValue ? dateInputValue(existingValue) : eventDate ? dateInputValue(eventDate) : '2000-01-01';
  return `${datePart || '2000-01-01'}T${clockTime}:00.000Z`;
};

/** "dd/mm/yyyy, HH:MM" of a legacy track time, in UTC as the previous admin showed it. */
export const legacyDateTime = new Intl.DateTimeFormat('it-IT', { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });

/** "yyyy-mm-ddTHH:MM" (UTC) for a datetime-local input of a legacy track. */
export const legacyInputValue = (value?: string | Date | null) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 16);
};

export const parseRooms = (text: string) => text.split(/\r?\n|,/).map(room => room.trim()).filter(Boolean);
export const roomsText = (rooms?: string[] | null) => (rooms ?? []).join('\n');

export const isHttpUrl = (text: string) => {
  try {
    const url = new URL(text);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
};

/** Detail of an ASP.NET ProblemDetails (or {message}) body, when the response carries one. */
export function problemDetail(text: string): string | null {
  try {
    const problem: unknown = JSON.parse(text);
    if (typeof problem === 'object' && problem !== null) {
      for (const key of ['detail', 'message', 'title'] as const) {
        const value = (problem as Record<string, unknown>)[key];
        if (typeof value === 'string' && value.trim()) return value;
      }
    }
  } catch { /* not JSON */ }
  return null;
}

// ---------- Whole-record update bodies ----------

export interface EventCoreValues {
  published: boolean;
  inHomepage: boolean;
  feedbackEnabled: boolean;
  title: string;
  description: string;
  eventDate: string;
  locationName: string;
  coordinates: string;
  address: string;
  googleMapsUrl: string;
  maximumSpaces: string;
}

/** The current values of the record, to pass unchanged alongside the ones a card edits. */
export const coreValuesOf = (workshop: EventRecord): EventCoreValues => ({
  published: Boolean(workshop.published),
  inHomepage: Boolean(workshop.in_homepage),
  feedbackEnabled: Boolean(workshop.feedbackEnabled),
  title: workshop.title ?? '',
  description: workshop.description ?? '',
  eventDate: dateInputValue(workshop.eventDate),
  locationName: workshop.location?.name ?? '',
  coordinates: workshop.location?.coordinates ?? '',
  address: workshop.location?.address ?? '',
  googleMapsUrl: workshop.location?.googleMapsUrl ?? '',
  maximumSpaces: workshop.location?.maximumSpaces?.toString() ?? '',
});

/**
 * PUT body for the event's own fields: everything else in the record is preserved as it came from the API.
 * The date is saved at local noon so the calendar day survives the UTC round trip.
 */
export function buildWorkshopUpdate<T extends EventRecord>(workshop: T, values: EventCoreValues): T {
  return {
    ...workshop,
    published: values.published,
    in_homepage: values.inHomepage,
    feedbackEnabled: values.feedbackEnabled,
    title: values.title,
    eventDate: values.eventDate ? new Date(`${values.eventDate}T12:00:00`).toISOString() : workshop.eventDate,
    description: values.description,
    location: {
      ...workshop.location,
      name: values.locationName,
      coordinates: values.coordinates,
      address: values.address,
      googleMapsUrl: values.googleMapsUrl,
      maximumSpaces: Number.parseInt(values.maximumSpaces, 10) || 0,
    },
  } as T;
}

/** Location copied from a saved venue (the snapshot stays editable on the event). */
export const locationFromVenue = (venue: VenueModel): EventLocation => ({
  name: venue.name,
  address: venue.address ?? '',
  coordinates: venue.coordinates ?? '',
  googleMapsUrl: venue.googleMapsUrl ?? '',
  maximumSpaces: venue.maximumSpaces,
});

/** Seat booking link as the previous admin seeded it: the legacy registration link when no Eventbrite event exists. */
export const bookingUrlOf = (workshop: EventRecord) =>
  workshop.bookingServiceUrl ?? (workshop.eventbriteEventId ? '' : workshop.externalRegistrationLink ?? '');

/** Registration fields saved together: the booking link also drives the legacy external-registration pair. */
export const withBookingUrl = <T extends EventRecord>(workshop: T, bookingServiceUrl: string): T => ({
  ...workshop,
  bookingServiceUrl,
  externalRegistration: Boolean(bookingServiceUrl),
  externalRegistrationLink: bookingServiceUrl,
});

/** After a successful save: an Eventbrite event is now out of date until the next sync. */
export const afterSave = <T extends EventRecord>(saved: T): T => ({
  ...saved,
  eventbriteSyncStatus: saved.eventbriteEventId ? 'update-pending' : saved.eventbriteSyncStatus,
  eventbriteLastError: saved.eventbriteEventId ? undefined : saved.eventbriteLastError,
});

// ---------- Agenda builder ----------

export interface AgendaState {
  talks: EventTalk[];
  tracks: AgendaTrack[];
  items: AgendaItem[];
}

export const itemOrder = (first: AgendaItem, second: AgendaItem) =>
  (first.order ?? Number.MAX_SAFE_INTEGER) - (second.order ?? Number.MAX_SAFE_INTEGER) ||
  new Date(first.startTime).getTime() - new Date(second.startTime).getTime();

export const trackItems = (state: AgendaState, trackId: string) =>
  state.items.filter(item => item.trackId === trackId).sort(itemOrder);

export const CHANGEOVER_TITLE = 'Technical gap';
export const DEFAULT_TRACK_NAME = 'Track 1';
export const DEFAULT_INTERVAL_TITLE = 'Pausa';

/** The agenda as the editor starts from it: one default track, talks and items attached to valid tracks, items numbered. */
export function initAgenda(workshop: EventRecord): AgendaState & { scheduleStart: string } {
  const initialTracks: AgendaTrack[] = workshop.agendaTracks?.length
    ? workshop.agendaTracks.map(track => ({ ...track }))
    : [{ workshopAgendaTrackId: createId(), name: DEFAULT_TRACK_NAME, order: 0 }];
  const trackIds = new Set(initialTracks.map(track => track.workshopAgendaTrackId));
  const defaultTrackId = initialTracks[0].workshopAgendaTrackId;
  const sourceItems = workshop.agendaItems ?? [];
  const talks = (workshop.talks ?? []).map(talk => {
    const agendaTrackId = sourceItems.find(item => item.talkId === talk.workshopTalkId)?.trackId;
    const assignedTrackId = talk.trackId && trackIds.has(talk.trackId)
      ? talk.trackId
      : agendaTrackId && trackIds.has(agendaTrackId) ? agendaTrackId : null;
    return { ...talk, speakers: talk.speakers ?? [], trackId: initialTracks.length === 1 ? defaultTrackId : assignedTrackId };
  });
  const items = sourceItems
    .map(item => ({
      ...item,
      trackId: initialTracks.length === 1
        ? defaultTrackId
        : workshop.talks?.find(talk => talk.workshopTalkId === item.talkId)?.trackId ?? item.trackId,
    }))
    .sort(itemOrder)
    .map((item, order) => ({ ...item, order }));
  return { talks, tracks: initialTracks, items, scheduleStart: items.length ? toClockTime(items[0].startTime) : '09:00' };
}

/** Keeps `count` tracks (at least one), naming the new ones; talks and items of removed tracks fall back to the first. */
export function setTrackCount(state: AgendaState, count: number): AgendaState {
  const safeCount = Math.max(1, Math.trunc(count) || 1);
  const next = state.tracks.slice(0, safeCount);
  while (next.length < safeCount) next.push({ workshopAgendaTrackId: createId(), name: `Track ${next.length + 1}`, order: next.length });
  const tracks = next.map((track, order) => ({ ...track, order }));
  const validIds = new Set(tracks.map(track => track.workshopAgendaTrackId));
  const fallbackId = tracks[0].workshopAgendaTrackId;
  return {
    tracks,
    talks: state.talks.map(talk => (validIds.has(talk.trackId ?? '') ? talk : { ...talk, trackId: fallbackId })),
    items: state.items.map(item => (validIds.has(item.trackId ?? '') ? item : { ...item, trackId: fallbackId })),
  };
}

export const renameTrack = (state: AgendaState, trackId: string, name: string): AgendaState => ({
  ...state,
  tracks: state.tracks.map(track => (track.workshopAgendaTrackId === trackId ? { ...track, name } : track)),
});

export const hasTrack = (state: AgendaState, trackId?: string | null) =>
  !!trackId && state.tracks.some(track => track.workshopAgendaTrackId === trackId);

export const unscheduledTalks = (state: AgendaState) =>
  state.talks.filter(talk => !state.items.some(item => item.itemType === 'talk' && item.talkId === talk.workshopTalkId));

export const upsertTalk = (state: AgendaState, talk: EventTalk): AgendaState => ({
  ...state,
  talks: state.talks.some(value => value.workshopTalkId === talk.workshopTalkId)
    ? state.talks.map(value => (value.workshopTalkId === talk.workshopTalkId ? talk : value))
    : [...state.talks, talk],
  items: state.items.map(item => (item.talkId === talk.workshopTalkId ? { ...item, trackId: talk.trackId ?? null } : item)),
});

export const removeTalk = (state: AgendaState, talkId: string): AgendaState => ({
  ...state,
  talks: state.talks.filter(talk => talk.workshopTalkId !== talkId),
  items: state.items.filter(item => item.talkId !== talkId),
});

export const assignTalkTrack = (state: AgendaState, talkId: string, trackId: string | null): AgendaState => ({
  ...state,
  talks: state.talks.map(talk => (talk.workshopTalkId === talkId ? { ...talk, trackId } : talk)),
  items: state.items.map(item => (item.talkId === talkId ? { ...item, trackId } : item)),
});

export const updateItem = (state: AgendaState, itemId: string, update: Partial<AgendaItem>): AgendaState => ({
  ...state,
  items: state.items.map(item => (item.workshopAgendaItemId === itemId ? { ...item, ...update } : item)),
});

export const removeItem = (state: AgendaState, itemId: string): AgendaState => ({
  ...state,
  items: state.items.filter(item => item.workshopAgendaItemId !== itemId),
});

export interface ScheduleParams { start: string; duration: string; gap: string }

const clockAt = (minutes: number) => {
  const normalized = ((minutes % (24 * 60)) + 24 * 60) % (24 * 60);
  return `${Math.floor(normalized / 60).toString().padStart(2, '0')}:${(normalized % 60).toString().padStart(2, '0')}`;
};

/**
 * Fills every track from the start time: each talk lasts `duration` minutes, followed by a technical gap of `gap`
 * minutes; existing intervals keep their position and length, old technical gaps are rebuilt.
 * Returns the new items, or an Italian message when the parameters or the talk assignments are not usable.
 */
export function autoFillSchedule(state: AgendaState, params: ScheduleParams, eventDate?: string | Date | null): { items: AgendaItem[] } | { error: string } {
  const duration = Number(params.duration);
  const gap = Number(params.gap);
  const [startHour, startMinute] = params.start.split(':').map(Number);
  if (!Number.isFinite(startHour) || !Number.isFinite(startMinute) ||
    !Number.isInteger(duration) || duration < 1 || !Number.isInteger(gap) || gap < 1) {
    return { error: 'Indica un orario di inizio valido e durate positive per talk e pause.' };
  }
  if (state.talks.some(talk => !hasTrack(state, talk.trackId))) {
    return { error: 'Assegna ogni talk a una track prima di riempire gli orari.' };
  }

  const nextItems: AgendaItem[] = [];
  const startAt = startHour * 60 + startMinute;
  const day = dateInputValue(eventDate) || '2000-01-01';
  const stamp = (clock: string) => `${day}T${clock}:00.000Z`;

  for (const track of state.tracks) {
    const trackId = track.workshopAgendaTrackId;
    const current = trackItems(state, trackId);
    const existingTalkItems = new Map(current.filter(item => item.itemType === 'talk' && item.talkId).map(item => [item.talkId as string, item]));
    const oldGaps = new Set(current.filter(item => item.itemType === 'break' && item.title === CHANGEOVER_TITLE).map(item => item.workshopAgendaItemId));
    const sequence: Array<{ kind: 'talk'; talk: EventTalk; item?: AgendaItem } | { kind: 'interval'; item: AgendaItem }> = [];
    const seen = new Set<string>();
    for (const item of current) {
      if (oldGaps.has(item.workshopAgendaItemId)) continue;
      if (item.itemType === 'talk' && item.talkId) {
        const talk = state.talks.find(value => value.workshopTalkId === item.talkId);
        if (talk && !seen.has(talk.workshopTalkId)) {
          sequence.push({ kind: 'talk', talk, item });
          seen.add(talk.workshopTalkId);
        }
      } else {
        sequence.push({ kind: 'interval', item });
      }
    }
    for (const talk of state.talks) {
      if (talk.trackId === trackId && !seen.has(talk.workshopTalkId)) sequence.push({ kind: 'talk', talk, item: existingTalkItems.get(talk.workshopTalkId) });
    }

    let cursor = startAt;
    let talksLeft = sequence.filter(entry => entry.kind === 'talk').length;
    const position = () => nextItems.filter(item => item.trackId === trackId).length;
    for (const entry of sequence) {
      if (entry.kind === 'talk') {
        nextItems.push({
          ...(entry.item ?? {}),
          workshopAgendaItemId: entry.item?.workshopAgendaItemId ?? createId(),
          itemType: 'talk',
          talkId: entry.talk.workshopTalkId,
          trackId,
          startTime: stamp(clockAt(cursor)),
          endTime: stamp(clockAt(cursor + duration)),
          order: position(),
        });
        cursor += duration;
        talksLeft -= 1;
        if (talksLeft > 0) {
          nextItems.push({
            workshopAgendaItemId: createId(),
            itemType: 'break',
            trackId,
            title: CHANGEOVER_TITLE,
            startTime: stamp(clockAt(cursor)),
            endTime: stamp(clockAt(cursor + gap)),
            order: position(),
          });
          cursor += gap;
        }
      } else {
        const length = Math.max(1, Math.round((new Date(entry.item.endTime).getTime() - new Date(entry.item.startTime).getTime()) / 60000) || gap);
        nextItems.push({ ...entry.item, trackId, startTime: stamp(clockAt(cursor)), endTime: stamp(clockAt(cursor + length)), order: position() });
        cursor += length;
      }
    }
  }
  return { items: nextItems };
}

/** A service interval appended after the last item of the track (or at the schedule start). */
export function addServiceInterval(state: AgendaState, trackId: string, options: { title: string; room: string; gap: string; scheduleStart: string; eventDate?: string | Date | null }): AgendaState {
  const current = trackItems(state, trackId);
  const previousEnd = current.length > 0
    ? new Date(current[current.length - 1].endTime)
    : new Date(toStoredTime(options.scheduleStart || '09:00', undefined, options.eventDate));
  const duration = Math.max(1, Number(options.gap) || 5);
  const startTime = new Date(previousEnd);
  const endTime = new Date(startTime.getTime() + duration * 60000);
  return {
    ...state,
    items: [...state.items, {
      workshopAgendaItemId: createId(),
      itemType: 'service',
      trackId,
      title: options.title.trim() || DEFAULT_INTERVAL_TITLE,
      roomName: options.room,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      order: current.length,
    }],
  };
}

/** Swaps the item with its neighbour in the track; the two keep their time slots, so the schedule stays continuous. */
export function moveItem(state: AgendaState, trackId: string, itemId: string, direction: -1 | 1): AgendaState {
  const current = trackItems(state, trackId);
  const index = current.findIndex(item => item.workshopAgendaItemId === itemId);
  const nextIndex = index + direction;
  if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return state;
  const updated = [...current];
  const first = updated[index];
  const second = updated[nextIndex];
  updated[index] = { ...second, startTime: first.startTime, endTime: first.endTime, order: index };
  updated[nextIndex] = { ...first, startTime: second.startTime, endTime: second.endTime, order: nextIndex };
  const changed = new Map(updated.map(item => [item.workshopAgendaItemId, item]));
  return { ...state, items: state.items.map(item => changed.get(item.workshopAgendaItemId) ?? item) };
}

const speakerKey = (speaker: EventTalkSpeaker) =>
  speaker.workshopSpeakerId ?? speaker.sessionizeId ?? clean(speaker.name).toLocaleLowerCase();

/** Why the agenda cannot be saved yet, in Italian, or null. */
export function agendaProblem(state: AgendaState): string | null {
  if (state.talks.some(talk => !hasTrack(state, talk.trackId)) ||
    state.items.some(item => item.itemType === 'talk' && !hasTrack(state, item.trackId))) {
    return 'Assegna ogni talk a una track prima di salvare l\'agenda.';
  }
  for (const item of state.items) {
    const start = new Date(item.startTime).getTime();
    const end = new Date(item.endTime).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      return 'Ogni voce dell\'agenda deve finire dopo il suo inizio.';
    }
  }
  const talkOf = (item: AgendaItem) => state.talks.find(talk => talk.workshopTalkId === item.talkId);
  for (let i = 0; i < state.items.length; i += 1) {
    for (let j = i + 1; j < state.items.length; j += 1) {
      const first = state.items[i];
      const second = state.items[j];
      const overlaps = new Date(first.startTime) < new Date(second.endTime) && new Date(second.startTime) < new Date(first.endTime);
      if (!overlaps) continue;
      const sharesTrack = Boolean(first.trackId && first.trackId === second.trackId);
      const eventWide = !first.trackId || !second.trackId;
      const firstRoom = first.roomName?.trim().toLocaleLowerCase();
      const sharesRoom = Boolean(firstRoom && firstRoom === second.roomName?.trim().toLocaleLowerCase());
      const firstSpeakers = new Set((talkOf(first)?.speakers ?? []).map(speakerKey));
      const sharesSpeaker = (talkOf(second)?.speakers ?? []).some(speaker => firstSpeakers.has(speakerKey(speaker)));
      if (sharesTrack || eventWide || sharesRoom || sharesSpeaker) {
        return 'Le voci dell\'agenda non possono sovrapporsi nella stessa track o sala, con una pausa comune, né impegnare due volte lo stesso relatore.';
      }
    }
  }
  return null;
}

/** PUT body of the agenda: the saved record plus talks, tracks and items. */
export const agendaSaveBody = <T extends EventRecord>(workshop: T, state: AgendaState): T => ({
  ...workshop,
  talks: state.talks,
  agendaTracks: state.tracks,
  agendaItems: state.items,
});

/** Serialized view of the editable part of the agenda, to tell unsaved changes apart. */
export const agendaSnapshot = (state: AgendaState) => JSON.stringify([state.talks, state.tracks, state.items]);

// ---------- Eventbrite ----------

export const salesWindowProblem = (start: string, end: string) =>
  (start && end && start >= end ? 'La vendita dei biglietti deve finire dopo il suo inizio.' : null);

/** What Eventbrite needs before a draft can be created or updated, from the saved record. */
export function eventbriteIssues(workshop: EventRecord): string[] {
  const items = workshop.agendaItems ?? [];
  const badTimes = items.some(item => !Number.isFinite(new Date(item.startTime).getTime()) ||
    !Number.isFinite(new Date(item.endTime).getTime()) || new Date(item.endTime) <= new Date(item.startTime));
  return [
    !clean(workshop.title) && 'Titolo dell\'evento',
    !clean(workshop.description) && 'Descrizione dell\'evento',
    !workshop.eventDate && 'Data dell\'evento',
    !clean(workshop.location?.name) && 'Nome della sede',
    !clean(workshop.location?.address) && 'Indirizzo della sede',
    (workshop.eventbriteTicketCapacity ?? 0) <= 0 && 'Un numero positivo di biglietti gratuiti',
    (workshop.agendaTracks ?? []).length === 0 && 'Almeno una track in agenda',
    items.length === 0 && 'Almeno una voce in agenda',
    badTimes && 'Orari validi per ogni voce dell\'agenda',
    !!salesWindowProblem(workshop.eventbriteSalesStart ?? '', workshop.eventbriteSalesEnd ?? '') && 'Fine vendite successiva all\'inizio',
  ].filter((issue): issue is string => Boolean(issue));
}

export const eventbriteStatusLabel = (workshop: EventRecord) => {
  if (!workshop.eventbriteEventId) return 'Non creato';
  if (workshop.eventbritePublished) return 'Pubblicato';
  switch (workshop.eventbriteSyncStatus) {
    case 'synced': return 'Bozza sincronizzata';
    case 'update-pending': return 'Da sincronizzare';
    default: return workshop.eventbriteSyncStatus || 'Bozza';
  }
};

// ---------- Readiness and speakers ----------

export const registrationOf = (workshop: EventRecord) =>
  clean(workshop.bookingServiceUrl) || (workshop.externalRegistration ? clean(workshop.externalRegistrationLink) : '');

export interface EventSpeakerEntry {
  key: string;
  name: string;
  sessions: number;
  speaker: EventSpeaker | null;
}

/** Speakers of the event (agenda talks, or legacy tracks), matched to the directory by id or by name. */
export function eventSpeakers(workshop: EventRecord, directory: EventSpeaker[]): EventSpeakerEntry[] {
  const byId = new Map(directory.map(speaker => [speaker.workshopSpeakerId, speaker]));
  const byName = new Map(directory.map(speaker => [nameKey(speaker.name), speaker]));
  const entries = new Map<string, EventSpeakerEntry>();
  const add = (name: string, speaker: EventSpeaker | null) => {
    const key = speaker?.workshopSpeakerId ?? nameKey(name);
    if (!key) return;
    const entry = entries.get(key);
    if (entry) entry.sessions += 1;
    else entries.set(key, { key, name: speaker ? clean(speaker.name) : clean(name), sessions: 1, speaker });
  };
  if (workshop.talks?.length) {
    for (const talk of workshop.talks) {
      for (const speaker of talk.speakers ?? []) {
        const match = (speaker.workshopSpeakerId && byId.get(speaker.workshopSpeakerId)) || byName.get(nameKey(speaker.name)) || null;
        add(clean(speaker.name), match);
      }
    }
  } else {
    for (const track of workshop.tracks ?? []) {
      const ids = track.speakers ?? [];
      if (ids.length) for (const id of ids) { const match = byId.get(id); if (match) add(match.name, match); }
      else for (const name of clean(track.speakersName).split(/\s*,\s*/).filter(Boolean)) add(name, byName.get(nameKey(name)) ?? null);
    }
  }
  return [...entries.values()];
}

/** Talk speaker entries built from directory records (what the agenda stores on each talk). */
export const talkSpeakersFrom = (speakers: EventSpeaker[]): EventTalkSpeaker[] =>
  speakers.map(speaker => ({ workshopSpeakerId: speaker.workshopSpeakerId, name: speaker.name, imageUrl: speaker.profileImageUrl ?? undefined, biography: speaker.description ?? undefined }));

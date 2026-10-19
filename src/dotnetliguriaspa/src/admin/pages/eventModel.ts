import { AdminWorkshop, clean } from '../adminApi';
import type { VenueModel } from '../../models/VenueModel';

// Event record as serialized by DotNetLiguriaCore (dates are ISO strings on the wire) and the pure rules of the
// event wizard, ported from the previous admin (AdminWorkshopDetail, AdminWorkshopAgenda, workshopUpdate):
// the whole-record update body, the talk pool / schedule / registration state and its validations. No React here.

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
  eventbriteTicketClassId?: string | null;
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

/** Published means exactly `true`: an unset flag is a draft, as the previous admin read it (`|| false`). */
export const isPublished = (workshop: Pick<EventRecord, 'published'>) => workshop.published === true;

// ---------- File kinds (WorkshopFileTypeEnum) ----------

export const FILE_TYPE = { image: 1, photo: 2, material: 4 } as const;

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

/**
 * Stored value for a "HH:MM" clock time: on the day of the existing value, else on the event day. A cleared
 * input ('') gives a value that is not a date, so the save refuses it until a time is set again.
 */
export const toStoredTime = (clockTime: string, existingValue: Date | string | undefined | null, eventDate: Date | string | undefined | null) => {
  const datePart = dateInputValue(existingValue) || dateInputValue(eventDate) || '2000-01-01';
  return `${datePart}T${clockTime}:00.000Z`;
};

/** "yyyy-mm-ddTHH:MM" (UTC) for a datetime-local input of a legacy track. */
export const legacyInputValue = (value?: string | Date | null) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 16);
};

/** Rooms are typed one per line, as in the previous admin. */
export const parseRooms = (text: string) => text.split(/\r?\n/).map(room => room.trim()).filter(Boolean);

// ---------- Failed calls, worded as the previous admin did ----------

/** A failed API call: its status and its body, so each action can word the failure the way it did before. */
export class EventApiError extends Error {
  readonly status: number;
  readonly contentType: string;
  readonly body: string;

  constructor(status: number, contentType = '', body = '') {
    super(`HTTP ${status}`);
    this.name = 'EventApiError';
    this.status = status;
    this.contentType = contentType;
    this.body = body;
  }
}

const jsonObject = (text: string): Record<string, unknown> | null => {
  try {
    const value: unknown = JSON.parse(text);
    return typeof value === 'object' && value !== null ? value as Record<string, unknown> : null;
  } catch {
    return null;
  }
};

/** The previous loads of venues and speakers: "<fallback> (HTTP n)"; any other error says itself. */
export function statusMessage(error: unknown, fallback: string, otherwise = fallback): string {
  if (error instanceof EventApiError) return `${fallback} (HTTP ${error.status})`;
  return error instanceof Error ? error.message : otherwise;
}

/**
 * The previous detail page's getResponseErrorMessage: a JSON body's detail, message or title, else
 * "<fallback> (HTTP n)"; any other error says itself.
 */
export function problemMessage(error: unknown, fallback: string, otherwise = fallback): string {
  if (error instanceof EventApiError) {
    if (error.contentType.toLowerCase().includes('json')) {
      const problem = jsonObject(error.body);
      for (const key of ['detail', 'message', 'title']) {
        const value = problem?.[key];
        if (typeof value === 'string') return value;
      }
    }
    return `${fallback} (HTTP ${error.status})`;
  }
  return error instanceof Error ? error.message : otherwise;
}

/**
 * The previous agenda and creation pages' reportError: the body's ProblemDetails detail, else the body as it
 * came, else "<fallback> (HTTP n)"; any other error says itself.
 */
export function detailMessage(error: unknown, fallback: string, otherwise = fallback): string {
  if (error instanceof EventApiError) {
    const detail = jsonObject(error.body)?.detail;
    return (typeof detail === 'string' ? detail : error.body) || `${fallback} (HTTP ${error.status})`;
  }
  return error instanceof Error ? error.message : otherwise;
}

// ---------- Whole-record update (steps 1, 3 and 4, saved together at the end) ----------

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

/** The current values of the record, to pass unchanged alongside the edited ones. */
export const coreValuesOf = (workshop: EventRecord): EventCoreValues => ({
  published: isPublished(workshop),
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

/** After a successful save: an Eventbrite event is now out of date until the next sync. */
export const afterSave = <T extends EventRecord>(saved: T): T => ({
  ...saved,
  eventbriteSyncStatus: saved.eventbriteEventId ? 'update-pending' : saved.eventbriteSyncStatus,
  eventbriteLastError: saved.eventbriteEventId ? undefined : saved.eventbriteLastError,
});

// ---------- Steps (the previous wizard, same order) ----------

export type StepId = 'pubblicazione' | 'immagine' | 'informazioni' | 'sede' | 'tracks' | 'talk-pool' | 'agenda' | 'iscrizione' | 'materiali' | 'foto';

export interface StepDefinition {
  id: StepId;
  label: string;
}

/** The previous wizard's steps (workshopSteps), same order, names translated literally. */
export const STEPS: StepDefinition[] = [
  { id: 'pubblicazione', label: 'Pubblicazione' },
  { id: 'immagine', label: "Immagine dell'evento" },
  { id: 'informazioni', label: "Informazioni sull'evento" },
  { id: 'sede', label: 'Sede' },
  { id: 'tracks', label: 'Tracks' },
  { id: 'talk-pool', label: 'Talk pool' },
  { id: 'agenda', label: "Track e orari dell'agenda" },
  { id: 'iscrizione', label: 'Dettagli di iscrizione' },
  { id: 'materiali', label: 'Materiali' },
  { id: 'foto', label: 'Foto' },
];

/** Hashes used by earlier versions of the card keep opening the right step. */
const STEP_ALIASES: Record<string, StepId> = {
  panoramica: 'informazioni', relatori: 'talk-pool', questionario: 'pubblicazione', 'materiali-e-foto': 'materiali',
  locandina: 'immagine', sessioni: 'tracks', talk: 'talk-pool',
};

export const stepIndexOf = (id: StepId) => STEPS.findIndex(step => step.id === id);

/** The step named by the URL (#agenda, ?tab=agenda, or an old alias), the first one otherwise. */
export function stepFromLocation(hash: string, search: string): StepId {
  const wanted = (hash.replace(/^#/, '') || new URLSearchParams(search).get('tab') || '').toLowerCase();
  return STEPS.find(step => step.id === wanted)?.id ?? STEP_ALIASES[wanted] ?? STEPS[0].id;
}

// ---------- Talk pool, schedule and registration (the previous AdminWorkshopAgenda) ----------

export interface AgendaState {
  talks: EventTalk[];
  tracks: AgendaTrack[];
  items: AgendaItem[];
}

export interface RegistrationState {
  bookingServiceUrl: string;
  eventbriteTicketCapacity: number;
  eventbriteSalesStart: string;
  eventbriteSalesEnd: string;
  attendeeNotes: string;
}

export interface AgendaDraftState extends AgendaState, RegistrationState {}

/** Which page of the module is saving: the checks differ, as they did. */
export type AgendaPage = 'talks' | 'schedule' | 'registration';

export const itemOrder = (first: AgendaItem, second: AgendaItem) =>
  (first.order ?? Number.MAX_SAFE_INTEGER) - (second.order ?? Number.MAX_SAFE_INTEGER) ||
  new Date(first.startTime).getTime() - new Date(second.startTime).getTime();

export const trackItems = (state: AgendaState, trackId: string) =>
  state.items.filter(item => item.trackId === trackId).sort(itemOrder);

// Stored titles the public agenda recognises (programme.ts): keep them as the previous admin wrote them.
export const CHANGEOVER_TITLE = 'Technical gap';
export const DEFAULT_TRACK_NAME = 'Track 1';
export const DEFAULT_INTERVAL_TITLE = 'Service interval';
export const SUGGESTED_INTERVAL_TITLE = 'Lunch';

/** Seat booking link as the previous admin seeded it: the legacy registration link when no Eventbrite event exists. */
export const bookingUrlOf = (workshop: EventRecord) =>
  workshop.bookingServiceUrl ?? (workshop.eventbriteEventId ? '' : workshop.externalRegistrationLink ?? '');

export const registrationOf = (workshop: EventRecord): RegistrationState => ({
  bookingServiceUrl: bookingUrlOf(workshop),
  eventbriteTicketCapacity: workshop.eventbriteTicketCapacity ?? 0,
  eventbriteSalesStart: workshop.eventbriteSalesStart ?? '',
  eventbriteSalesEnd: workshop.eventbriteSalesEnd ?? '',
  attendeeNotes: workshop.attendeeNotes ?? '',
});

/** Talks as the module adopts them from the record: on a single track every talk goes there. */
export const adoptTalks = (talks: EventTalk[] | null | undefined, tracks: AgendaTrack[]) =>
  (talks ?? []).map(talk => ({
    ...talk,
    speakers: talk.speakers ?? [],
    trackId: tracks.length === 1 ? tracks[0].workshopAgendaTrackId : talk.trackId ?? null,
  }));

/** The module as it starts from the record: one default track, talks and items attached to valid tracks, items numbered. */
export function initAgenda(workshop: EventRecord): AgendaDraftState & { scheduleStart: string } {
  const tracks: AgendaTrack[] = workshop.agendaTracks?.length
    ? workshop.agendaTracks.map(track => ({ ...track }))
    : [{ workshopAgendaTrackId: createId(), name: DEFAULT_TRACK_NAME, order: 0 }];
  const trackIds = new Set(tracks.map(track => track.workshopAgendaTrackId));
  const defaultTrackId = tracks[0].workshopAgendaTrackId;
  const sourceItems = workshop.agendaItems ?? [];
  const talks = (workshop.talks ?? []).map(talk => {
    const agendaTrackId = sourceItems.find(item => item.talkId === talk.workshopTalkId)?.trackId;
    const assignedTrackId = talk.trackId && trackIds.has(talk.trackId)
      ? talk.trackId
      : agendaTrackId && trackIds.has(agendaTrackId) ? agendaTrackId : null;
    return { ...talk, speakers: talk.speakers ?? [], trackId: tracks.length === 1 ? defaultTrackId : assignedTrackId };
  });
  const items = sourceItems
    .map(item => ({
      ...item,
      trackId: tracks.length === 1
        ? defaultTrackId
        : workshop.talks?.find(talk => talk.workshopTalkId === item.talkId)?.trackId ?? item.trackId,
    }))
    .sort(itemOrder)
    .map((item, order) => ({ ...item, order }));
  return { talks, tracks, items, ...registrationOf(workshop), scheduleStart: items.length ? toClockTime(items[0].startTime) : '09:00' };
}

/** Keeps `count` tracks (at least one), naming the new ones; talks and items of removed tracks fall back to the first. */
export function setTrackCount<S extends AgendaState>(state: S, count: number): S {
  const safeCount = Math.max(1, Math.trunc(count) || 1);
  const next = state.tracks.slice(0, safeCount);
  while (next.length < safeCount) next.push({ workshopAgendaTrackId: createId(), name: `Track ${next.length + 1}`, order: next.length });
  const tracks = next.map((track, order) => ({ ...track, order }));
  const validIds = new Set(tracks.map(track => track.workshopAgendaTrackId));
  const fallbackId = tracks[0].workshopAgendaTrackId;
  return {
    ...state,
    tracks,
    talks: state.talks.map(talk => (validIds.has(talk.trackId ?? '') ? talk : { ...talk, trackId: fallbackId })),
    items: state.items.map(item => (validIds.has(item.trackId ?? '') ? item : { ...item, trackId: fallbackId })),
  };
}

export const renameTrack = <S extends AgendaState>(state: S, trackId: string, name: string): S => ({
  ...state,
  tracks: state.tracks.map(track => (track.workshopAgendaTrackId === trackId ? { ...track, name } : track)),
});

export const hasTrack = (state: AgendaState, trackId?: string | null) =>
  !!trackId && state.tracks.some(track => track.workshopAgendaTrackId === trackId);

export const unscheduledTalks = (state: AgendaState) =>
  state.talks.filter(talk => !state.items.some(item => item.itemType === 'talk' && item.talkId === talk.workshopTalkId));

export const updateTalk = <S extends AgendaState>(state: S, talkId: string, patch: Partial<EventTalk>): S => ({
  ...state,
  talks: state.talks.map(talk => (talk.workshopTalkId === talkId ? { ...talk, ...patch } : talk)),
});

export const removeTalk = <S extends AgendaState>(state: S, talkId: string): S => ({
  ...state,
  talks: state.talks.filter(talk => talk.workshopTalkId !== talkId),
  items: state.items.filter(item => item.talkId !== talkId),
});

export const assignTalkTrack = <S extends AgendaState>(state: S, talkId: string, trackId: string | null): S => ({
  ...state,
  talks: state.talks.map(talk => (talk.workshopTalkId === talkId ? { ...talk, trackId } : talk)),
  items: state.items.map(item => (item.talkId === talkId ? { ...item, trackId } : item)),
});

export const updateItem = <S extends AgendaState>(state: S, itemId: string, update: Partial<AgendaItem>): S => ({
  ...state,
  items: state.items.map(item => (item.workshopAgendaItemId === itemId ? { ...item, ...update } : item)),
});

export const removeItem = <S extends AgendaState>(state: S, itemId: string): S => ({
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
    return { error: 'Inserisci un orario di inizio valido e durate positive per sessioni e pause.' };
  }
  if (state.talks.some(talk => !hasTrack(state, talk.trackId))) {
    return { error: 'Assegna ogni talk a una track prima di generare gli orari.' };
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
export function addServiceInterval<S extends AgendaState>(state: S, trackId: string, options: { title: string; room: string; gap: string; scheduleStart: string; eventDate?: string | Date | null }): S {
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
export function moveItem<S extends AgendaState>(state: S, trackId: string, itemId: string, direction: -1 | 1): S {
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

export const salesWindowProblem = (start: string, end: string) =>
  (start && end && start >= end ? "La vendita dei biglietti Eventbrite deve finire dopo l'inizio." : null);

/** Why the module cannot be saved from this page yet, in Italian, or null: the same checks as the previous save. */
export function agendaProblem(state: AgendaDraftState, page: AgendaPage): string | null {
  const windowProblem = salesWindowProblem(state.eventbriteSalesStart, state.eventbriteSalesEnd);
  if (windowProblem) return windowProblem;
  const unassigned = 'Assegna ogni talk a una track prima di salvare l\'agenda.';
  if (page !== 'registration' && state.items.some(item => item.itemType === 'talk' && !hasTrack(state, item.trackId))) return unassigned;
  if (state.talks.some(talk => !hasTrack(state, talk.trackId))) return unassigned;
  if (page === 'registration') return null;
  for (const item of state.items) {
    const start = new Date(item.startTime).getTime();
    const end = new Date(item.endTime).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      return 'Ogni voce dell\'agenda deve avere un orario di fine valido successivo all\'inizio.';
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
        return 'Le voci dell\'agenda non possono sovrapporsi nella stessa track, sala o pausa comune, né programmare due volte lo stesso relatore.';
      }
    }
  }
  return null;
}

/** PUT body of the module: the saved record plus registration fields, talks, tracks and items, as before. */
export const agendaSaveBody = <T extends EventRecord>(workshop: T, state: AgendaDraftState): T => ({
  ...workshop,
  bookingServiceUrl: state.bookingServiceUrl,
  eventbriteTicketCapacity: state.eventbriteTicketCapacity,
  eventbriteSalesStart: state.eventbriteSalesStart,
  eventbriteSalesEnd: state.eventbriteSalesEnd,
  externalRegistration: Boolean(state.bookingServiceUrl),
  externalRegistrationLink: state.bookingServiceUrl,
  attendeeNotes: state.attendeeNotes,
  talks: state.talks,
  agendaTracks: state.tracks,
  agendaItems: state.items,
});

// ---------- Eventbrite ----------

/** What Eventbrite needs before a draft can be created or updated, from the record and the module's current values. */
export function eventbriteIssues(workshop: EventRecord, state: AgendaDraftState): string[] {
  const badTimes = state.items.some(item => !Number.isFinite(new Date(item.startTime).getTime()) ||
    !Number.isFinite(new Date(item.endTime).getTime()) || new Date(item.endTime) <= new Date(item.startTime));
  return [
    !clean(workshop.title) && 'Titolo dell\'evento',
    !clean(workshop.description) && 'Descrizione dell\'evento',
    !workshop.eventDate && 'Data dell\'evento',
    !clean(workshop.location?.name) && 'Nome della sede',
    !clean(workshop.location?.address) && 'Indirizzo della sede',
    state.eventbriteTicketCapacity <= 0 && 'Capienza positiva di biglietti gratuiti',
    state.tracks.length === 0 && 'Almeno una track in agenda',
    state.items.length === 0 && 'Almeno una voce in agenda pianificata',
    badTimes && 'Orari di inizio e fine validi per ogni voce dell\'agenda',
    !!salesWindowProblem(state.eventbriteSalesStart, state.eventbriteSalesEnd) && 'Fine vendite successiva all\'inizio vendite',
  ].filter((issue): issue is string => Boolean(issue));
}

/** The stored sync status as the previous admin showed it (raw), "Non creato" when there is none. */
export const eventbriteStatusLabel = (workshop: EventRecord) => clean(workshop.eventbriteSyncStatus) || 'Non creato';

/** Talk speaker entries built from directory records (what the module stores on each talk). */
export const talkSpeakersFrom = (speakers: EventSpeaker[]): EventTalkSpeaker[] =>
  speakers.map(speaker => ({ workshopSpeakerId: speaker.workshopSpeakerId, name: speaker.name, imageUrl: speaker.profileImageUrl ?? undefined, biography: speaker.description ?? undefined }));

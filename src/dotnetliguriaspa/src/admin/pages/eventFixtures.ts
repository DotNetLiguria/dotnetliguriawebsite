import { jsonResponse } from '../../test-utils';
import type { VenueModel } from '../../models/VenueModel';
import type { EventFile, EventRecord, EventSpeaker } from './eventModel';
import { PERMISSIONS } from '../../account/permissions';

// Test data and a recording fake API for the event screens (not a test file itself).

export const eventFixture = (overrides: Partial<EventRecord> = {}): EventRecord => ({
  workshopId: 'w1', title: 'Test Workshop', description: 'Workshop description', eventDate: '2024-03-15T10:00:00Z',
  image: '/workshops/w001/workshop.png', blogHtml: '', tags: '', published: true, in_homepage: false, feedbackEnabled: false,
  isExternalEvent: false, externalRegistration: false, externalRegistrationLink: '',
  location: { name: 'Genova', address: 'Via del Porto 1', coordinates: '44.4056,8.9463', maximumSpaces: 150 },
  tracks: [], talks: [], agendaTracks: [], agendaItems: [], materials: [], photos: [],
  authorization: { isPast: false, allowedActions: [...PERMISSIONS] },
  ...overrides,
});

export const speakersFixture: EventSpeaker[] = [
  { workshopSpeakerId: 'speaker-1', name: 'Ada Lovelace', profileImageUrl: '', description: 'Engineer', isActive: true },
  { workshopSpeakerId: 'speaker-2', name: 'Alan Turing', profileImageUrl: '', description: 'Mathematician', isActive: true },
];

export const venuesFixture: VenueModel[] = [
  { venueId: 'venue-1', name: 'Community Hall', address: '1 Main Street', coordinates: '44.4,8.9', googleMapsUrl: 'https://maps.google.com/?q=Community+Hall', maximumSpaces: 120 },
];

export interface ApiCall { url: string; method: string; body?: unknown; form?: FormData }
type Answer = unknown | ((url: string, init?: RequestInit) => Response | Promise<Response>);

/**
 * Fake API around one event: records every call, keeps the record written by PUT /Workshop/Update, serves it
 * back on GET /Workshop/Get, and answers the speaker, venue and file endpoints. `routes` go first (most specific).
 */
export function serveEvent(initial: EventRecord, routes: Record<string, Answer> = {}, options: {
  speakers?: EventSpeaker[]; venues?: VenueModel[]; files?: EventFile[]; photosFound?: boolean; failUpdate?: Response;
} = {}) {
  const store = { record: initial, files: [...(options.files ?? [])] };
  const calls: ApiCall[] = [];
  const defaults: Record<string, Answer> = {
    '/Workshop/Publication/': (_url: string, init?: RequestInit) => {
      store.record = { ...store.record, published: (JSON.parse(String(init?.body)) as { published: boolean }).published };
      return new Response(null, { status: 204 });
    },
    '/Workshop/Homepage/': (_url: string, init?: RequestInit) => {
      store.record = { ...store.record, in_homepage: (JSON.parse(String(init?.body)) as { selected: boolean }).selected };
      return new Response(null, { status: 204 });
    },
    '/Workshop/Update/': (_url: string, init?: RequestInit) => {
      if (options.failUpdate) return options.failUpdate;
      store.record = JSON.parse(String(init?.body)) as EventRecord;
      return new Response(null, { status: 204 });
    },
    '/Workshop/Get/': () => jsonResponse(store.record),
    '/Speaker/Get': () => jsonResponse(options.speakers ?? speakersFixture),
    '/Venue': () => jsonResponse(options.venues ?? venuesFixture),
    '/workshopfile/': (url: string, init?: RequestInit) => {
      if (init?.method === 'POST') return jsonResponse({ fileName: 'saved', workshopId: store.record.workshopId });
      if (init?.method === 'DELETE') {
        store.files = store.files.filter(file => !url.endsWith(`/${file.workshopFileId}`));
        return new Response(null, { status: 204 });
      }
      return jsonResponse(store.files);
    },
    '/Contents/': (_url: string, init?: RequestInit) => (init?.method === 'HEAD'
      ? new Response(null, { status: options.photosFound === false ? 404 : 200, headers: { 'Content-Type': 'image/jpeg' } })
      : jsonResponse([])),
  };
  // Custom routes win, in their own order; a custom pattern replaces the default one with the same key.
  const table = [...Object.entries(routes), ...Object.entries(defaults).filter(([pattern]) => !(pattern in routes))];
  vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const call: ApiCall = { url, method: init?.method ?? 'GET' };
    if (init?.body instanceof FormData) call.form = init.body;
    else if (typeof init?.body === 'string') call.body = JSON.parse(init.body);
    calls.push(call);
    for (const [pattern, answer] of table) {
      if (!url.includes(pattern)) continue;
      return typeof answer === 'function' ? (answer as (url: string, init?: RequestInit) => Response | Promise<Response>)(url, init) : jsonResponse(answer);
    }
    return jsonResponse([]);
  });
  return {
    calls,
    store,
    /** Calls to one endpoint, most recent last. */
    to: (pattern: string, method?: string) => calls.filter(call => call.url.includes(pattern) && (!method || call.method === method)),
    /** JSON body of the last PUT /Workshop/Update. */
    lastUpdate: () => calls.filter(call => call.url.includes('/Workshop/Update/')).at(-1)?.body as EventRecord | undefined,
  };
}

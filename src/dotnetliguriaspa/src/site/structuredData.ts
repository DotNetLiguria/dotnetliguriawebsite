import { SiteWorkshop, contentUrl } from './siteApi';
import { clean, dayKey, formatTime } from './format';
import { programme, programmeSpan, programmeSpeakers } from './event/programme';
import { registrationLink } from './event/EventInfoCard';
import { DEFAULT_DESCRIPTION, DEFAULT_IMAGE_PATH, SITE_NAME, absoluteUrl } from './seo';

// schema.org descriptions of the community and of its events, built only from data the API provides.

const SCHEMA = 'https://schema.org';

type JsonObject = Record<string, unknown>;

const prune = <T extends JsonObject>(data: T): T =>
  Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined && value !== '')) as T;

export function organizationJsonLd(origin: string) {
  return {
    '@context': SCHEMA,
    '@type': 'Organization',
    name: SITE_NAME,
    alternateName: 'DotNet Liguria',
    url: absoluteUrl('/', origin),
    logo: absoluteUrl(DEFAULT_IMAGE_PATH, origin),
    description: DEFAULT_DESCRIPTION,
    foundingDate: '2011',
  };
}

/** UTC offset of Europe/Rome at the given instant, as "+02:00" (events are held in Italy). */
export function romeOffset(value: string | Date) {
  const instant = new Date(value);
  const asRome = new Date(instant.toLocaleString('en-US', { timeZone: 'Europe/Rome' }));
  const asUtc = new Date(instant.toLocaleString('en-US', { timeZone: 'UTC' }));
  const minutes = Math.round((asRome.getTime() - asUtc.getTime()) / 60000);
  const sign = minutes < 0 ? '-' : '+';
  const pad = (n: number) => String(Math.trunc(Math.abs(n))).padStart(2, '0');
  return `${sign}${pad(minutes / 60)}:${pad(minutes % 60)}`;
}

/** "Via Minzoni 2,19100 La Spezia" → street, postal code and locality when the Italian CAP is present. */
export function postalAddress(address: string) {
  const text = clean(address);
  const match = text.match(/^(.*?)[,\s]*\b(\d{5})\b[\s,]*(.*)$/);
  return prune({
    '@type': 'PostalAddress',
    streetAddress: match ? clean(match[1]).replace(/,$/, '') : text,
    postalCode: match?.[2],
    addressLocality: match ? clean(match[3]) : undefined,
    addressCountry: 'IT',
  });
}

/**
 * schema.org Event for an event page. Session times come from the programme and are expressed on the
 * event's calendar day in Rome time; without a programme only the day is known.
 */
export function eventJsonLd(workshop: SiteWorkshop, origin: string, pageUrl: string) {
  const entries = programme(workshop);
  const span = programmeSpan(entries);
  const day = dayKey(workshop.eventDate);
  const offset = romeOffset(workshop.eventDate);
  const at = (time: string) => `${day}T${formatTime(time)}:00${offset}`;

  const place = clean(workshop.location?.name);
  const address = clean(workshop.location?.address);
  const [latitude, longitude] = (workshop.location?.coordinates ?? '').split(',').map(part => Number(part.trim()));
  const hasGeo = !!workshop.location?.coordinates && Number.isFinite(latitude) && Number.isFinite(longitude);
  const image = contentUrl(workshop.image);
  const registration = registrationLink(workshop);
  const speakers = programmeSpeakers(entries);

  return prune({
    '@context': SCHEMA,
    '@type': 'Event',
    name: clean(workshop.title),
    description: clean(workshop.description) || undefined,
    startDate: span ? at(span.start) : day,
    endDate: span ? at(span.end) : undefined,
    eventStatus: `${SCHEMA}/EventScheduled`,
    eventAttendanceMode: `${SCHEMA}/OfflineEventAttendanceMode`,
    url: pageUrl,
    image: image ? absoluteUrl(image, origin) : undefined,
    location: place || address
      ? prune({
        '@type': 'Place',
        name: place || undefined,
        address: address ? postalAddress(address) : undefined,
        geo: hasGeo ? { '@type': 'GeoCoordinates', latitude, longitude } : undefined,
      })
      : undefined,
    organizer: { '@type': 'Organization', name: SITE_NAME, url: absoluteUrl('/', origin) },
    performer: speakers.length > 0 ? speakers.map(speaker => ({ '@type': 'Person', name: speaker.name })) : undefined,
    offers: registration ? { '@type': 'Offer', url: registration.href } : undefined,
  });
}

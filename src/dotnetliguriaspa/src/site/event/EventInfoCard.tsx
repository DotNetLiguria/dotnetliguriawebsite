import React from 'react';
import { Link } from 'react-router-dom';
import { SiteWorkshop } from '../siteApi';
import { clean, eventPhase, formatTimeRange, formatWeekday } from '../format';
import { ExternalLink, Icon } from '../icons';
import { OutlineAction, PrimaryAction } from '../ui';
import { programme, programmeSpan } from './programme';

const isWebUrl = (value?: string | null): value is string => !!value && /^https?:\/\//i.test(value);

export const mapUrl = (workshop: SiteWorkshop) => {
  // The venue's own map link wins; an embed URL is meant for iframes, not for visitors.
  const own = workshop.location?.googleMapsUrl?.trim();
  if (isWebUrl(own) && !own.includes('/maps/embed')) return own;
  const [lat, lon] = (workshop.location?.coordinates ?? '').split(',').map(part => part.trim());
  if (lat && lon && !Number.isNaN(Number(lat)) && !Number.isNaN(Number(lon))) {
    return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=17/${lat}/${lon}`;
  }
  const query = clean(workshop.location?.address) || clean(workshop.location?.name);
  return query ? `https://www.openstreetmap.org/search?query=${encodeURIComponent(query)}` : null;
};

/**
 * Where to sign up, only while the event has not happened yet: the seat booking service when there is one
 * (it also handles cancellations), otherwise the external registration page.
 */
export const registrationLink = (workshop: SiteWorkshop) => {
  if (eventPhase(workshop.eventDate) === 'done') return null;
  const booking = workshop.bookingServiceUrl?.trim();
  if (isWebUrl(booking)) return { href: booking, label: 'Prenota o annulla il posto' };
  const external = workshop.externalRegistrationLink?.trim();
  if (workshop.externalRegistration && isWebUrl(external)) return { href: external, label: "Iscriviti all'evento" };
  return null;
};

function Row({ icon, label, children }: { icon: 'calendar' | 'clock' | 'pin'; label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-cyan-700"><Icon name={icon} className="size-4" />{label}</dt>
      <dd className="mt-1 text-lg font-semibold">{children}</dd>
    </div>
  );
}

/** Date, time, venue and the event's actions, shown beside the programme. */
export default function EventInfoCard({ workshop, commentsOpen, detailsLink = true, backLink = false }: {
  workshop: SiteWorkshop;
  commentsOpen: boolean;
  detailsLink?: boolean;
  backLink?: boolean;
}) {
  const span = programmeSpan(programme(workshop));
  const place = clean(workshop.location?.name);
  const address = clean(workshop.location?.address);
  const map = mapUrl(workshop);
  const registration = registrationLink(workshop);

  return (
    <aside className="self-start rounded-3xl bg-cyan-50 p-7 lg:sticky lg:top-28" aria-label="Informazioni sull'evento">
      <dl className="space-y-5">
        <Row icon="calendar" label="Data">{formatWeekday(workshop.eventDate)}</Row>
        {span && <Row icon="clock" label="Orario">{formatTimeRange(span.start, span.end)}</Row>}
        {place && (
          <Row icon="pin" label="Sede">
            {place}
            {address && <span className="block text-base font-normal text-muted">{address}</span>}
          </Row>
        )}
      </dl>
      <div className="mt-7 flex flex-col gap-3">
        {registration && <PrimaryAction href={registration.href} external>{registration.label}</PrimaryAction>}
        {detailsLink && <OutlineAction to={`/workshop/${workshop.workshopId}`}>Dettagli e materiali</OutlineAction>}
        {map && <ExternalLink href={map} className="min-h-11 self-start font-bold text-cyan-700 underline decoration-2 underline-offset-4">Apri la mappa</ExternalLink>}
        {backLink && (
          <Link to="/workshops" className="inline-flex min-h-11 items-center gap-2 self-start font-bold text-cyan-700 underline decoration-2 underline-offset-4">
            <Icon name="arrow" className="size-4 rotate-180" />Tutti gli eventi
          </Link>
        )}
      </div>
      {commentsOpen && (
        <div className="mt-7 rounded-2xl bg-white p-5">
          <p className="flex items-center gap-2 font-bold"><Icon name="comment" className="size-5 text-basil-700" />Com'è andato l'evento?</p>
          <p className="mt-1 text-base text-navy/85">Valuta i talk e suggerisci i temi del prossimo incontro.</p>
          <Link to={`/feedback/${workshop.workshopId}`} className="mt-3 inline-flex min-h-11 items-center gap-1 font-bold text-cyan-700 underline decoration-2 underline-offset-4">
            Lascia un commento<Icon name="arrow" className="size-4" />
          </Link>
        </div>
      )}
    </aside>
  );
}

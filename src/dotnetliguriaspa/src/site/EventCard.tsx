import React from 'react';
import { Link } from 'react-router-dom';
import { SiteWorkshop, contentUrl } from './siteApi';
import { clean, eventPhase, formatDayMonth, formatWeekday } from './format';
import { Icon } from './icons';
import { Badge } from './ui';
import { programme, sessionCount, sessionsLabel } from './event/programme';

const PHASE_BADGE = {
  done: { tone: 'done', label: 'Concluso' },
  today: { tone: 'today', label: 'Oggi' },
  planned: { tone: 'planned', label: 'In programma' },
} as const;

/** Event card: poster, date badge, status, title (whole card is the link), date and venue. */
export default function EventCard({ workshop, large = false }: { workshop: SiteWorkshop; large?: boolean }) {
  const image = contentUrl(workshop.image);
  const place = clean(workshop.location?.name);
  const sessions = sessionCount(programme(workshop));
  const phase = PHASE_BADGE[eventPhase(workshop.eventDate)];
  const { day, month } = formatDayMonth(workshop.eventDate);

  return (
    <article className={`group relative flex w-full flex-col overflow-hidden rounded-3xl bg-white shadow-card transition ${large ? '' : 'hover:-translate-y-1 hover:shadow-lift'}`}>
      <div className="relative aspect-video overflow-hidden bg-navy">
        {image && (
          <img
            src={image}
            alt=""
            loading={large ? 'eager' : 'lazy'}
            className={`size-full object-cover transition duration-500 ${large ? '' : 'group-hover:scale-[1.03]'}`}
          />
        )}
      </div>
      <div className="relative flex flex-1 flex-col gap-3 p-6 pt-10">
        <div className="absolute -top-8 left-6 flex flex-col items-center rounded-2xl bg-white px-3 py-2 leading-none shadow-card" aria-hidden="true">
          <span className="text-2xl font-bold text-navy">{day}</span>
          <span className="text-sm font-bold uppercase text-cyan-700">{month}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={phase.tone}>{phase.label}</Badge>
          {sessions > 0 && <span className="text-sm font-semibold text-muted">{sessionsLabel(sessions)}</span>}
        </div>
        <h3 className={`${large ? 'text-2xl sm:text-3xl' : 'text-xl'} font-bold leading-tight text-navy`}>
          <Link to={`/workshop/${workshop.workshopId}`} className="text-navy no-underline after:absolute after:inset-0 hover:underline">
            {clean(workshop.title)}
          </Link>
        </h3>
        <p className="mt-auto flex flex-col gap-1 text-base text-muted">
          <span className="inline-flex items-center gap-2"><Icon name="calendar" className="size-4 text-cyan-700" />{formatWeekday(workshop.eventDate)}</span>
          {place && <span className="inline-flex items-center gap-2"><Icon name="pin" className="size-4 text-cyan-700" />{place}</span>}
        </p>
      </div>
    </article>
  );
}

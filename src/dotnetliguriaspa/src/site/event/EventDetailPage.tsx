import React, { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button } from 'react-aria-components';
import DOMPurify from 'dompurify';
import SiteLayout from '../SiteLayout';
import ScrollTopButton from '../ScrollTopButton';
import SpeakerAvatar from '../SpeakerAvatar';
import { ExternalLink, Icon } from '../icons';
import { Badge, LogoArc, PrimaryAction } from '../ui';
import { API_BASE_URL } from '../../config/apiConfig';
import { SiteFile, contentUrl, getSpeakers, getWorkshop } from '../siteApi';
import { clean, eventPhase, formatTimeRange, formatWeekday } from '../format';
import { useLoad } from '../useLoad';
import { publicQuestionnaireApi } from '../../questionnaire/api';
import EventProgramme, { sortedTracks, speakerNames } from './EventProgramme';
import EventInfoCard, { registrationLink } from './EventInfoCard';

const PHASE = {
  done: { tone: 'done', label: 'Concluso' },
  today: { tone: 'today', label: 'Oggi' },
  planned: { tone: 'planned', label: 'In programma' },
} as const;

/** Files may be stored as absolute URLs, /Contents paths or paths relative to /Contents. */
const fileUrl = (file: SiteFile) => {
  const path = file.fullPath ?? '';
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path;
  if (/^\/?contents\//i.test(path)) return `${API_BASE_URL.replace(/\/api\/?$/, '')}/${path.replace(/^\/+/, '')}`;
  return contentUrl(path);
};

const extension = (file: SiteFile) => (file.fileName ?? file.fullPath ?? '').split('.').pop()?.toUpperCase() ?? '';

function SectionHeading({ id, children }: { id: string; children: React.ReactNode }) {
  return <h2 id={id} className="text-3xl font-bold leading-tight">{children}</h2>;
}

const backLink = (
  <Link to="/workshops" className="inline-flex min-h-11 items-center gap-2 font-semibold text-cyan-200 no-underline hover:text-white hover:underline">
    <Icon name="arrow" className="size-4 rotate-180" />Eventi passati
  </Link>
);

export default function EventDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const [load, retry] = useLoad(signal => getWorkshop(id, signal), id);
  const [speakers] = useLoad(signal => getSpeakers(signal).catch(() => []));
  const [questionnaire] = useLoad(
    signal => publicQuestionnaireApi.byWorkshop(id, (input, init) => fetch(input, { ...init, signal })).catch(() => null),
    id,
  );

  const workshop = load.state === 'ready' ? load.data : null;
  const photoByName = useMemo(() => {
    const map = new Map<string, string | null | undefined>();
    if (speakers.state === 'ready') for (const s of speakers.data) map.set(clean(s.name).toLowerCase(), s.profileImageUrl);
    return map;
  }, [speakers]);
  const safeHtml = useMemo(() => (workshop?.blogHtml ? DOMPurify.sanitize(workshop.blogHtml, { USE_PROFILES: { html: true } }) : ''), [workshop]);

  if (load.state !== 'ready' || !workshop) {
    return (
      <SiteLayout>
        <section className="on-navy relative isolate overflow-hidden bg-navy text-white">
          <LogoArc className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-[75%] w-full" />
          <div className="mx-auto max-w-7xl px-4 pb-20 pt-10 sm:px-6">
            {backLink}
            {load.state === 'loading' && <p className="mt-8 text-xl text-cyan-50/90" role="status">Caricamento dell'evento…</p>}
            {load.state === 'ready' && (
              <>
                <h1 className="mt-6 text-5xl font-bold">Evento non trovato</h1>
                <p className="mt-4 max-w-xl text-xl text-cyan-50/90">L'evento che cerchi non esiste o non è più pubblicato. Puoi cercarlo nell'elenco degli eventi passati.</p>
              </>
            )}
            {load.state === 'error' && (
              <div role="alert" className="mt-8 max-w-2xl rounded-3xl bg-white p-8 text-navy">
                <h1 className="text-3xl font-bold">Non riusciamo a caricare l'evento</h1>
                <p className="mt-2 text-muted">{load.message}. Riprova tra qualche istante.</p>
                <Button
                  onPress={retry}
                  className="mt-5 inline-flex min-h-12 cursor-pointer items-center rounded-full border-2 border-navy px-6 font-bold text-navy outline-none data-[hovered]:bg-navy data-[hovered]:text-white data-[focus-visible]:outline-3 data-[focus-visible]:outline-offset-3 data-[focus-visible]:outline-cyan-700"
                >
                  Riprova
                </Button>
              </div>
            )}
          </div>
        </section>
      </SiteLayout>
    );
  }

  const phase = PHASE[eventPhase(workshop.eventDate)];
  const tracks = sortedTracks(workshop);
  const names = speakerNames(workshop);
  const image = contentUrl(workshop.image);
  const registration = registrationLink(workshop);
  const commentsOpen = questionnaire.state === 'ready' && questionnaire.data?.availability === 'Open';
  const materials = (workshop.materials ?? []).filter(file => fileUrl(file));
  const photos = (workshop.photos ?? []).filter(file => fileUrl(file));
  const tags = clean(workshop.tags).split(',').map(tag => tag.trim()).filter(Boolean);
  const place = clean(workshop.location?.name);

  return (
    <SiteLayout>
      <section className="on-navy relative isolate overflow-hidden bg-navy text-white" aria-labelledby="event-title">
        <LogoArc className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-[62%] w-full" />
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 pb-20 pt-10 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pb-28">
          <div>
            {backLink}
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Badge tone={phase.tone}>{phase.label}</Badge>
              {tracks.length > 0 && <span className="font-semibold text-cyan-50/90">{tracks.length} sessioni</span>}
            </div>
            <h1 id="event-title" className="mt-4 text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">{clean(workshop.title)}</h1>
            <p className="mt-6 flex flex-col gap-2 text-lg text-cyan-50/90">
              <span className="inline-flex items-center gap-2"><Icon name="calendar" className="size-5 text-cyan-200" />{formatWeekday(workshop.eventDate)}</span>
              {tracks.length > 0 && (
                <span className="inline-flex items-center gap-2"><Icon name="clock" className="size-5 text-cyan-200" />{formatTimeRange(tracks[0].startTime, tracks[tracks.length - 1].endTime)}</span>
              )}
              {place && <span className="inline-flex items-center gap-2"><Icon name="pin" className="size-5 text-cyan-200" />{place}</span>}
            </p>
            {registration && <div className="mt-8"><PrimaryAction href={registration} external>Iscriviti all'evento</PrimaryAction></div>}
          </div>
          {image && (
            <div className="overflow-hidden rounded-3xl bg-navy-950 shadow-card">
              <img src={image} alt={`Locandina: ${clean(workshop.title)}`} className="aspect-video w-full object-cover" />
            </div>
          )}
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:py-24">
        <div className="min-w-0 space-y-16">
          {clean(workshop.description) && (
            <section aria-labelledby="descrizione">
              <SectionHeading id="descrizione">Descrizione</SectionHeading>
              <p className="mt-5 max-w-[65ch] text-xl leading-relaxed text-navy/85">{clean(workshop.description)}</p>
            </section>
          )}

          {safeHtml && (
            <section aria-labelledby="approfondimento">
              <SectionHeading id="approfondimento">Approfondimento</SectionHeading>
              <div
                className="mt-5 max-w-[65ch] text-lg leading-relaxed text-navy/85 [&_a]:font-bold [&_a]:text-cyan-700 [&_a]:underline [&_h2]:mt-8 [&_h2]:text-2xl [&_h2]:font-bold [&_h3]:mt-6 [&_h3]:text-xl [&_h3]:font-bold [&_img]:my-6 [&_img]:rounded-2xl [&_li]:mt-1 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:mt-4 [&_ul]:list-disc [&_ul]:pl-6"
                // Sanitized with DOMPurify: scripts, event handlers and dangerous URLs are removed.
                dangerouslySetInnerHTML={{ __html: safeHtml }}
              />
            </section>
          )}

          <section aria-labelledby="programma">
            <SectionHeading id="programma">Programma</SectionHeading>
            <EventProgramme workshop={workshop} />
          </section>

          {names.length > 0 && (
            <section aria-labelledby="relatori">
              <SectionHeading id="relatori">Relatori</SectionHeading>
              <ul className="mt-8 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {names.map(name => {
                  const sessions = tracks.filter(track => clean(track.speakersName).split(/\s*,\s*/).includes(name)).length;
                  return (
                    <li key={name} className="flex items-center gap-4 rounded-3xl bg-white p-4 shadow-card">
                      <SpeakerAvatar name={name} profileImageUrl={photoByName.get(name.toLowerCase())} />
                      <div className="min-w-0">
                        <p className="text-lg font-bold leading-tight">{name}</p>
                        <p className="text-base text-muted">{sessions} {sessions === 1 ? 'sessione' : 'sessioni'}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {materials.length > 0 && (
            <section aria-labelledby="materiali">
              <SectionHeading id="materiali">Materiali</SectionHeading>
              <ul className="mt-6 divide-y divide-line rounded-3xl bg-white shadow-card">
                {materials.map(file => (
                  <li key={file.workshopFileId}>
                    <ExternalLink href={fileUrl(file)!} className="flex min-h-14 w-full items-center gap-3 px-6 py-3 font-bold text-navy no-underline hover:bg-cyan-50 hover:underline">
                      <span className="rounded-lg bg-cyan-50 px-2 py-1 text-xs font-bold text-cyan-700">{extension(file) || 'FILE'}</span>
                      <span className="min-w-0 flex-1">{clean(file.title) || clean(file.fileName)}</span>
                    </ExternalLink>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {photos.length > 0 && (
            <section aria-labelledby="foto">
              <SectionHeading id="foto">Foto dell'evento</SectionHeading>
              <ul className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
                {photos.map((file, index) => (
                  <li key={file.workshopFileId}>
                    <a href={fileUrl(file)!} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-2xl shadow-card">
                      <img src={fileUrl(file)!} alt={clean(file.title) || `Foto ${index + 1} dell'evento`} loading="lazy" className="aspect-[4/3] w-full object-cover transition duration-500 hover:scale-[1.03]" />
                      <span className="sr-only"> (si apre in una nuova scheda)</span>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {tags.length > 0 && (
            <section aria-labelledby="argomenti">
              <SectionHeading id="argomenti">Argomenti</SectionHeading>
              <ul className="mt-5 flex flex-wrap gap-2">
                {tags.map(tag => <li key={tag} className="rounded-full bg-basil-50 px-4 py-1.5 font-bold text-basil-700">{tag}</li>)}
              </ul>
            </section>
          )}
        </div>

        <EventInfoCard workshop={workshop} commentsOpen={commentsOpen} detailsLink={false} backLink />
      </div>
      <ScrollTopButton />
    </SiteLayout>
  );
}

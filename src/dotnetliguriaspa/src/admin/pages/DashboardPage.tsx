import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useOidcUser } from '@axa-fr/react-oidc';
import { AdminIcon, AdminIconName } from '../icons';
import { Badge, EmptyState, LoadError, PageHeader, Panel, btn, linkFocus } from '../ui';
import { AdminSpeaker, AdminVenue, AdminWorkshop, AdminLoad, clean, nameKey, useAdminLoad, useSpeakerPhotos } from '../adminApi';
import { contentUrl } from '../../site/siteApi';
import { dayKey, formatDate, formatWeekday } from '../../site/format';
import { programme, sessionCount, sessionsLabel } from '../../site/event/programme';
import EventPoster from '../EventPoster';
import { useAccountCapabilities } from '../../account/AccountCapabilities';
import { ErasureOperation } from '../../account/accountApi';
import { useAccountResource } from '../../account/useAccountResource';
import { hasPermission, canPerform } from '../../account/permissions';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function CheckRow({ done, title, detail, action }: { done: boolean; title: string; detail: string; action?: React.ReactNode }) {
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3.5">
      <span className={`grid size-8 shrink-0 place-items-center rounded-full ${done ? 'bg-basil-50 text-basil-700' : 'bg-[#fff4e5] text-[#8a4b00]'}`}>
        <AdminIcon name={done ? 'check' : 'todo'} />
        <span className="sr-only">{done ? 'Fatto:' : 'Da fare:'}</span>
      </span>
      <span className="min-w-0 flex-1"><span className="block font-bold">{title}</span><span className="block text-muted">{detail}</span></span>
      {action}
    </li>
  );
}

function TodoRow({ to, icon, title, detail }: { to: string; icon: AdminIconName; title: string; detail: string }) {
  return (
    <li>
      <Link to={to} className={`flex items-center gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-cyan-50 ${linkFocus}`}>
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#fff4e5] text-[#8a4b00]"><AdminIcon name={icon} /></span>
        <span className="min-w-0 flex-1"><span className="block font-bold">{title}</span><span className="block text-sm text-muted">{detail}</span></span>
        <AdminIcon name="arrow" className="size-5 text-muted" />
      </Link>
    </li>
  );
}

const registrationOf = (w: AdminWorkshop) => clean(w.bookingServiceUrl) || (w.externalRegistration ? clean(w.externalRegistrationLink) : '');
const eventLink = (w: AdminWorkshop) => `/admin/workshop/${w.workshopId}`;

function EventHeader({ workshop, label }: { workshop: AdminWorkshop; label: React.ReactNode }) {
  const poster = contentUrl(workshop.image);
  return (
    <div className="flex flex-wrap items-start gap-4 border-b border-line p-5 sm:p-6">
      <EventPoster src={poster} className="hidden aspect-video w-36 rounded-xl object-cover sm:block" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">{label}<span className="text-muted">{formatWeekday(workshop.eventDate)}</span></div>
        <h2 className="mt-1.5 text-xl font-bold leading-snug"><Link to={eventLink(workshop)} className={`rounded hover:underline ${linkFocus}`}>{clean(workshop.title)}</Link></h2>
      </div>
    </div>
  );
}

function NextEvent({ workshop }: { workshop: AdminWorkshop }) {
  const { capabilities } = useAccountCapabilities();
  const entries = programme(workshop);
  const sessions = sessionCount(entries);
  const to = eventLink(workshop);
  const fix = (label: string, step: string) => canPerform(capabilities, step === 'pubblicazione' ? 'events.publish' : step === 'immagine' ? 'event-assets.manage' : 'events.manage', workshop)
    ? <Link to={`${to}#${step}`} className={btn.ghost}>{label}</Link> : undefined;
  return (
    <Panel labelledBy="next-event">
      <EventHeader workshop={workshop} label={<Badge kind="planned">In programma</Badge>} />
      <p id="next-event" className="sr-only">Prossimo evento</p>
      <ul className="divide-y divide-line px-5 sm:px-6">
        <CheckRow done={!!clean(workshop.description)} title="Descrizione" detail={clean(workshop.description) ? 'Presente' : 'Manca: compare nella scheda e nella home.'} action={clean(workshop.description) ? undefined : fix('Scrivi', 'informazioni')} />
        <CheckRow done={!!clean(workshop.location?.name)} title="Data e sede" detail={clean(workshop.location?.name) ? `${formatDate(workshop.eventDate)} · ${clean(workshop.location?.name)}` : 'Manca la sede.'} action={clean(workshop.location?.name) ? undefined : fix('Scegli la sede', 'sede')} />
        <CheckRow done={sessions > 0} title="Agenda" detail={sessions ? sessionsLabel(sessions) : 'Nessuna sessione: importa i talk da Sessionize o aggiungili.'} action={sessions ? undefined : fix("Prepara l'agenda", 'agenda')} />
        <CheckRow done={!!workshop.image} title="Locandina" detail={workshop.image ? 'Caricata' : 'Manca la locandina.'} action={workshop.image ? undefined : fix('Carica', 'immagine')} />
        <CheckRow done={!!registrationOf(workshop)} title="Iscrizione" detail={registrationOf(workshop) ? 'Link di prenotazione presente' : 'Manca il link di prenotazione.'} action={registrationOf(workshop) ? undefined : fix('Aggiungi il link', 'iscrizione')} />
        <CheckRow done={workshop.published === true} title="Pubblicazione" detail={workshop.published === true ? 'Visibile sul sito' : 'In bozza: non è ancora sul sito.'} action={workshop.published === true ? undefined : fix('Pubblica', 'pubblicazione')} />
      </ul>
    </Panel>
  );
}

function LatestEvent({ workshop }: { workshop: AdminWorkshop }) {
  const { capabilities } = useAccountCapabilities();
  const entries = programme(workshop);
  const sessions = sessionCount(entries);
  const speakers = new Set(entries.flatMap(e => e.speakers.map(s => s.name))).size;
  const materials = workshop.materials?.length ?? 0;
  const photos = workshop.photos?.length ?? 0;
  const to = eventLink(workshop);
  return (
    <Panel labelledBy="latest-event">
      <EventHeader workshop={workshop} label={<Badge kind="done">Concluso</Badge>} />
      <p id="latest-event" className="px-5 pt-3 text-muted sm:px-6">Dopo l'evento: cosa resta da fare.</p>
      <ul className="divide-y divide-line px-5 sm:px-6">
        <CheckRow done={sessions > 0} title="Agenda" detail={sessions ? `${sessionsLabel(sessions)} con ${plural(speakers, 'relatore', 'relatori')}` : 'Nessuna sessione'} />
        <CheckRow done={materials > 0} title="Slide e materiali" detail={materials ? plural(materials, 'file caricato', 'file caricati') : 'Nessun materiale caricato: chi ha partecipato li cerca qui.'} action={materials || !canPerform(capabilities, 'event-assets.manage', workshop) ? undefined : <Link to={`${to}#materiali`} className={btn.secondary}><AdminIcon name="upload" />Carica materiali</Link>} />
        <CheckRow done={photos > 0} title="Foto dell'evento" detail={photos ? plural(photos, 'foto', 'foto') : 'Nessuna foto.'} action={photos || !canPerform(capabilities, 'event-assets.manage', workshop) ? undefined : <Link to={`${to}#foto`} className={btn.ghost}>Carica foto</Link>} />
        {hasPermission(capabilities, 'questionnaires.read') && <CheckRow done={!!workshop.feedbackEnabled} title="Questionario di feedback" detail={workshop.feedbackEnabled ? 'Aperto' : 'Non attivo.'} action={canPerform(capabilities, 'questionnaires.manage', workshop) ? <Link to="/admin/questionnaires" className={btn.ghost}>Crea questionario</Link> : undefined} />}
      </ul>
    </Panel>
  );
}

function Skeleton({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-2xl border border-line bg-white motion-reduce:animate-none ${className}`} aria-hidden="true" />;
}

const dataOf = <T,>(load: AdminLoad<T>) => (load.state === 'ready' ? load.data : null);

export default function DashboardPage() {
  const { oidcUser } = useOidcUser();
  const { capabilities } = useAccountCapabilities();
  const [workshopsLoad, reloadWorkshops] = useAdminLoad<AdminWorkshop[]>('/Workshop/Get?onlyPublished=false', hasPermission(capabilities, 'events.read'));
  const [speakersLoad, reloadSpeakers] = useAdminLoad<AdminSpeaker[]>('/Speaker/Get', hasPermission(capabilities, 'speakers.read'));
  const [boardLoad] = useAdminLoad<unknown[]>('/Board/Get', hasPermission(capabilities, 'board.read'));
  const [venuesLoad] = useAdminLoad<AdminVenue[]>('/Venue', hasPermission(capabilities, 'venues.read'));
  const workshops = hasPermission(capabilities, 'events.read') ? dataOf(workshopsLoad) : null;
  const speakers = hasPermission(capabilities, 'speakers.read') ? dataOf(speakersLoad) : null;
  const photos = useSpeakerPhotos(speakers);

  const { next, latest, firstYear, withoutMaterials, recent, drafts } = useMemo(() => {
    const today = dayKey(new Date().toISOString());
    const sorted = [...(workshops ?? [])].sort((a, b) => a.eventDate.localeCompare(b.eventDate));
    const past = sorted.filter(w => dayKey(w.eventDate) < today);
    return {
      next: sorted.find(w => dayKey(w.eventDate) >= today) ?? null,
      latest: past[past.length - 1] ?? null,
      firstYear: sorted.length ? new Date(sorted[0].eventDate).getFullYear() : null,
      withoutMaterials: past.filter(w => w.published === true && !(w.materials?.length)).length,
      recent: [...sorted].reverse().slice(0, 5),
      drafts: sorted.filter(w => w.published !== true).length,
    };
  }, [workshops]);

  const duplicates = useMemo(() => {
    const groups = new Map<string, AdminSpeaker[]>();
    for (const s of speakers ?? []) groups.set(nameKey(s.name), [...(groups.get(nameKey(s.name)) ?? []), s]);
    return [...groups.values()].filter(g => g.length > 1);
  }, [speakers]);
  const missingPhotos = photos ? [...photos.values()].filter(p => !p).length : null;
  const venues = hasPermission(capabilities, 'venues.read') ? dataOf(venuesLoad) : null;

  const first = clean(oidcUser?.given_name as string | undefined) || clean(oidcUser?.name as string | undefined).split(' ')[0];
  const todos = [
    missingPhotos ? <TodoRow key="photos" to="/admin/speakers/?filtro=senza-foto" icon="image" title={plural(missingPhotos, 'relatore senza foto', 'relatori senza foto')} detail="Sul sito compaiono con le iniziali." /> : null,
    duplicates.length ? <TodoRow key="dupes" to={`/admin/speakers/${duplicates[0][0].workshopSpeakerId}`} icon="users" title={plural(duplicates.length, 'relatore doppio', 'relatori doppi')} detail={`${duplicates.map(g => clean(g[0].name)).join(', ')}: più schede con lo stesso nome.`} /> : null,
    venues && venues.length === 0 ? <TodoRow key="venues" to="/admin/venues/" icon="pin" title="Nessuna sede salvata" detail="Le sedi salvate si scelgono con un clic quando crei un evento." /> : null,
    withoutMaterials ? <TodoRow key="materials" to="/admin/workshops/" icon="file" title={plural(withoutMaterials, 'evento senza materiali', 'eventi senza materiali')} detail="Slide e demo dei talk non sono ancora online." /> : null,
  ].filter(Boolean);

  return (
    <>
      <PageHeader
        title={first ? `Ciao, ${first}` : 'Panoramica'}
        description="Il prossimo evento, quello appena concluso e le cose da sistemare."
        actions={next && hasPermission(capabilities, 'events.manage') ? <Link to="/admin/workshop/create" className={btn.primary}><AdminIcon name="plus" />Nuovo evento</Link> : undefined}
      />
      {workshopsLoad.state === 'error' && <div className="mt-6"><LoadError message={`Gli eventi non sono disponibili (${workshopsLoad.message}).`} onRetry={reloadWorkshops} /></div>}
      {speakersLoad.state === 'error' && <div className="mt-6"><LoadError message={`I relatori non sono disponibili (${speakersLoad.message}).`} onRetry={reloadSpeakers} /></div>}

      <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          {workshopsLoad.state === 'loading' && <><Skeleton className="h-56" /><Skeleton className="h-72" /></>}
          {workshops && (next ? <NextEvent workshop={next} /> : (
            <Panel labelledBy="no-next">
              <EmptyState
                icon="calendar"
                title="Nessun evento in programma"
                actions={hasPermission(capabilities, 'events.manage') ? <Link to="/admin/workshop/create" className={btn.primary}><AdminIcon name="plus" />Nuovo evento</Link> : undefined}
              >
                <p id="no-next">Titolo, data e sede bastano per creare il prossimo incontro. L'agenda la completi dopo, anche importando i talk da Sessionize. Qui vedrai cosa manca prima di pubblicarlo.</p>
              </EmptyState>
            </Panel>
          ))}
          {latest && <LatestEvent workshop={latest} />}
        </div>

        <div className="space-y-6">
          <PrivacyTasks />
          <Panel labelledBy="todo-title">
            <div className="flex items-center justify-between px-5 pt-5 sm:px-6">
              <h2 id="todo-title" className="text-lg font-bold">Da sistemare</h2>
              {todos.length > 0 && <Badge kind="warn">{todos.length}</Badge>}
            </div>
            {photos === null && speakers && <p className="px-5 pt-2 text-sm text-muted sm:px-6" role="status">Verifica delle foto dei relatori…</p>}
            {todos.length ? <ul className="p-2 sm:p-3">{todos}</ul> : workshops && speakers && photos !== null && <p className="px-5 pt-2 pb-5 text-muted sm:px-6">Niente da sistemare.</p>}
          </Panel>
          <Panel labelledBy="archive-title">
            <h2 id="archive-title" className="px-5 pt-5 text-lg font-bold sm:px-6">In archivio</h2>
            <ul className="grid grid-cols-2 gap-1 p-4 pt-2 sm:px-5">
              {([
                ['Eventi', workshops ? `${workshops.length}${drafts ? ` · ${drafts} in bozza` : ''}` : undefined, '/admin/workshops/'],
                ['Relatori', speakers ? `${speakers.length} · ${speakers.filter(s => s.isActive !== false).length} attivi` : undefined, '/admin/speakers/'],
                ['Board', dataOf(boardLoad)?.length, '/admin/board/'],
                ['Dal', firstYear ?? undefined, '/admin/workshops/'],
              ] as const).filter(([label]) => hasPermission(capabilities, label === 'Relatori' ? 'speakers.read' : label === 'Board' ? 'board.read' : 'events.read')).map(([label, value, to]) => (
                <li key={label}>
                  <Link to={to} className={`block rounded-xl px-3 py-2.5 hover:bg-cyan-50 ${linkFocus}`}>
                    <span className="block text-sm font-semibold text-muted">{label}</span>
                    <span className="block text-xl font-bold tabular-nums">{value ?? '—'}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
          {recent.length > 0 && (
            <Panel labelledBy="recent-title">
              <div className="flex items-center justify-between px-5 pt-5 sm:px-6">
                <h2 id="recent-title" className="text-lg font-bold">Ultimi eventi</h2>
                <Link to="/admin/workshops/" className={`text-sm font-bold text-cyan-700 underline ${linkFocus}`}>Tutti gli eventi</Link>
              </div>
              <ul className="p-2 sm:p-3">
                {recent.map(w => (
                  <li key={w.workshopId}>
                    <Link to={eventLink(w)} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-cyan-50 ${linkFocus}`}>
                      <span className="min-w-0 flex-1"><span className="block truncate font-bold">{clean(w.title)}</span><span className="block text-sm text-muted">{formatDate(w.eventDate)}</span></span>
                      {w.published !== true && <Badge kind="warn">Bozza</Badge>}
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}

function PrivacyTasks() {
  const { capabilities } = useAccountCapabilities();
  if (!hasPermission(capabilities, 'privacy.operations.read')) return null;
  return <PendingPrivacyTasks />;
}

function PendingPrivacyTasks() {
  const pending = useAccountResource<ErasureOperation[]>('privacy/admin/operations');
  return <Panel labelledBy="pending-privacy" className="space-y-3 p-5">
    <h2 id="pending-privacy" className="text-lg font-bold">Richieste privacy pendenti</h2>
    {pending.loading && <p role="status">Caricamento richieste privacy…</p>}
    {pending.error && <><p role="alert">Conteggio richieste non disponibile: {pending.error}</p>
      <button className={btn.secondary} onClick={pending.reload}>Riprova richieste privacy</button></>}
    {pending.data && <Link to="/admin/privacy" className={btn.secondary}>{plural(pending.data.length, 'richiesta da verificare', 'richieste da verificare')}</Link>}
  </Panel>;
}

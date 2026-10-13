import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { AdminIcon } from '../icons';
import { Badge, EmptyState, LoadError, btn, linkFocus } from '../ui';
import { clean, useAdminLoad } from '../adminApi';
import { notify } from '../toasts';
import { contentUrl } from '../../site/siteApi';
import { dayKey, formatWeekday } from '../../site/format';
import { programme, programmeSpan } from '../../site/event/programme';
import EventPoster from '../EventPoster';
import { Skeleton } from './listUi';
import { EventApiError, EventIcon, EventPage, errorText, useEventApi } from './eventKit';
import { EventCoreValues, EventRecord, EventSpeaker, STEPS, StepId, afterSave, buildWorkshopUpdate, coreValuesOf, isPublished, stepFromLocation, stepIndexOf, toClockTime } from './eventModel';
import { StepNav, Stepper } from './eventStepper';
import { AgendaModule, TracksStep } from './eventAgenda';
import { ImageStep, InfoStep, LocationStep, MaterialsStep, PhotosStep, PublicationStep } from './eventPanels';

// Event wizard: /admin/workshop/:id, the ten steps of the previous AdminWorkshopDetail in the same order, the
// step in the URL hash. Steps 1, 3 and 4 edit the fields the previous page tracked as dirty; "Salva modifiche"
// on the last step sends one whole-record PUT built from the latest record (buildWorkshopUpdate). The talk pool,
// schedule and registration module stays mounted for the whole wizard, as before.

type RecordLoad = { state: 'loading' } | { state: 'ready' } | { state: 'error'; message: string; status?: number };

export default function EventDetailAdminPage() {
  const { id = '' } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const api = useEventApi();
  const [load, setLoad] = useState<RecordLoad>({ state: 'loading' });
  const [workshop, setWorkshop] = useState<EventRecord | null>(null);
  const workshopRef = useRef<EventRecord | null>(null);
  const commit = useCallback((next: EventRecord | null) => { workshopRef.current = next; setWorkshop(next); }, []);
  /** handleRelatedWorkshopSaved: a record coming back after a change is pending for Eventbrite until synced. */
  const replace = useCallback((next: EventRecord) => commit(afterSave({ ...next, workshopId: next.workshopId || id })), [commit, id]);
  const [draft, setDraft] = useState<Partial<EventCoreValues>>({});
  const [saving, setSaving] = useState(false);
  const [imageStamp, setImageStamp] = useState(0);
  const [speakersLoad, reloadSpeakers] = useAdminLoad<EventSpeaker[]>('/Speaker/Get?onlyActive=true');
  const speakers = useMemo(() => (speakersLoad.state === 'ready' ? speakersLoad.data : []), [speakersLoad]);

  const fetchWorkshop = useCallback(async () => {
    try {
      const data = await api<EventRecord>(`/Workshop/Get/${encodeURIComponent(id)}`);
      commit({ ...data, workshopId: data.workshopId || id });
      setLoad({ state: 'ready' });
    } catch (error) {
      setLoad({ state: 'error', message: errorText(error), status: error instanceof EventApiError ? error.status : undefined });
    }
  }, [api, commit, id]);
  useEffect(() => {
    setLoad({ state: 'loading' });
    commit(null);
    setDraft({});
    void fetchWorkshop();
  }, [commit, fetchWorkshop]);
  // Reading the record again after a change: a failure is ignored, as before.
  const refresh = useCallback(async () => {
    try {
      replace(await api<EventRecord>(`/Workshop/Get/${encodeURIComponent(id)}`));
    } catch { /* keep the record we have */ }
  }, [api, id, replace]);

  // Steps: the hash names the current one; everything up to the furthest step reached stays reachable.
  const step = stepFromLocation(location.hash, location.search);
  const stepIndex = stepIndexOf(step);
  const [reached, setReached] = useState(stepIndex);
  useEffect(() => { setReached(value => Math.max(value, stepIndex)); }, [stepIndex]);
  const hrefFor = useCallback((next: StepId) => `${location.pathname}#${next}`, [location.pathname]);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const focusHeading = useRef(false);
  useEffect(() => {
    if (!focusHeading.current) return;
    focusHeading.current = false;
    headingRef.current?.focus();
  }, [step]);
  const goTo = (next: StepId, moveFocus = false) => {
    focusHeading.current = moveFocus;
    navigate({ pathname: location.pathname, hash: `#${next}` }, { replace: true });
  };

  // One whole-record PUT at a time, always built from the latest record.
  const save = useCallback(async (build: (latest: EventRecord) => EventRecord, toast: { title: string; description?: string }) => {
    const latest = workshopRef.current;
    if (!latest) return false;
    const body = build(latest);
    setSaving(true);
    try {
      await api(`/Workshop/Update/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(body) });
      replace(body);
      notify(toast.title, { description: toast.description });
      return true;
    } catch (error) {
      notify(errorText(error), { kind: 'error' });
      return false;
    } finally {
      setSaving(false);
    }
  }, [api, id, replace]);

  const values: EventCoreValues | null = workshop ? { ...coreValuesOf(workshop), ...draft } : null;
  const edit = useCallback((patch: Partial<EventCoreValues>) => setDraft(current => ({ ...current, ...patch })), []);

  /** "Salva modifiche": the dirty fields over the latest record, one PUT (the previous handleSaveWorkshop). */
  const saveChanges = async () => {
    if (saving) return;
    const ok = await save(latest => buildWorkshopUpdate(latest, { ...coreValuesOf(latest), ...draft }), { title: 'Evento aggiornato' });
    if (ok) setDraft({});
  };

  const page: EventPage | null = workshop && values ? {
    workshop, speakers, api, save, saving, values, edit, replace, refresh, reloadSpeakers,
    current: () => workshopRef.current ?? workshop,
    commitRecord: commit,
  } : null;

  if (load.state === 'error') {
    return (
      <>
        <Link to="/admin/workshops/" className={`mb-2 inline-flex min-h-11 items-center gap-2 rounded-full font-semibold text-cyan-700 hover:underline ${linkFocus}`}><AdminIcon name="back" />Eventi</Link>
        {load.status === 404
          ? <EmptyState icon="calendar" title="Evento non trovato" actions={<Link to="/admin/workshops/" className={btn.secondary}>Tutti gli eventi</Link>} />
          : <LoadError message={`Errore nel caricamento dei dettagli dell'evento (${load.message}).`} onRetry={() => { setLoad({ state: 'loading' }); void fetchWorkshop(); }} />}
      </>
    );
  }
  if (!page || !workshop) {
    return (
      <>
        <Link to="/admin/workshops/" className={`mb-2 inline-flex min-h-11 items-center gap-2 rounded-full font-semibold text-cyan-700 hover:underline ${linkFocus}`}><AdminIcon name="back" />Eventi</Link>
        <p role="status" className="sr-only">Caricamento…</p>
        <Skeleton className="mt-2 h-40" />
        <Skeleton className="mt-5 h-96" />
      </>
    );
  }

  const title = clean(workshop.title);
  const span = programmeSpan(programme(workshop));
  const upcoming = dayKey(workshop.eventDate) >= dayKey(new Date().toISOString());
  const poster = contentUrl(workshop.image);
  const place = clean(workshop.location?.name);
  const definition = STEPS[stepIndex];
  const modulePage = step === 'talk-pool' ? 'talks' : step === 'agenda' ? 'schedule' : step === 'iscrizione' ? 'registration' : null;

  const content = (): React.ReactNode => {
    switch (step) {
      case 'immagine': return <ImageStep page={page} stamp={imageStamp} onUploaded={() => setImageStamp(Date.now())} />;
      case 'informazioni': return <InfoStep page={page} />;
      case 'sede': return <LocationStep page={page} />;
      case 'tracks': return <TracksStep page={page} />;
      case 'materiali': return <MaterialsStep page={page} />;
      case 'foto': return <PhotosStep page={page} />;
      case 'talk-pool': case 'agenda': case 'iscrizione': return null;
      default: return <PublicationStep page={page} />;
    }
  };
  const body = content();

  return (
    <>
      <Link to="/admin/workshops/" className={`mb-2 inline-flex min-h-11 items-center gap-2 rounded-full font-semibold text-cyan-700 hover:underline ${linkFocus}`}><AdminIcon name="back" />Eventi</Link>
      <div className="flex flex-wrap items-start gap-5">
        <EventPoster src={imageStamp && poster ? `${poster}?t=${imageStamp}` : poster} className="aspect-video w-full max-w-56 rounded-2xl object-cover sm:w-56" />
        <div className="min-w-64 flex-1">
          <div className="flex flex-wrap gap-2">
            {upcoming && <Badge kind="planned">In programma</Badge>}
            {workshop.in_homepage && <Badge kind="ok">In evidenza</Badge>}
            {!isPublished(workshop) && <Badge kind="warn">Bozza</Badge>}
          </div>
          <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight text-balance">{title}</h1>
          <p className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-muted">
            <span className="inline-flex items-center gap-1.5"><AdminIcon name="calendar" />{formatWeekday(workshop.eventDate)}</span>
            {span && <span className="inline-flex items-center gap-1.5"><EventIcon name="clock" />{toClockTime(span.start)}–{toClockTime(span.end)}</span>}
            {place && <span className="inline-flex items-center gap-1.5"><AdminIcon name="pin" />{place}</span>}
          </p>
        </div>
        <a href={`/workshop/${workshop.workshopId}`} target="_blank" rel="noopener noreferrer" className={btn.secondary}>
          <AdminIcon name="external" />Vedi sul sito<span className="sr-only"> (si apre in una nuova scheda)</span>
        </a>
      </div>

      <Stepper current={step} reached={reached} hrefFor={hrefFor} onSelect={next => goTo(next)} />

      <section aria-labelledby="step-heading" className="mt-6">
        <h2 id="step-heading" ref={headingRef} tabIndex={-1} className="text-2xl font-bold leading-tight outline-none">
          <span className="text-muted">{stepIndex + 1}.</span> {definition.label}
        </h2>
        {body && <div className="mt-5">{body}</div>}
        {/* The module keeps its inputs across the steps: mounted always, shown on steps 6 to 8. */}
        <div hidden={modulePage === null} className="mt-5">
          <AgendaModule page={page} activePage={modulePage} />
        </div>
        <StepNav current={step} busy={saving} onMove={next => goTo(next, true)} onSave={() => void saveChanges()} />
      </section>
    </>
  );
}

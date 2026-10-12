import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Button } from 'react-aria-components';
import { AdminIcon } from '../icons';
import { Badge, EmptyState, LoadError, btn, linkFocus } from '../ui';
import { clean, useAdminLoad } from '../adminApi';
import { notify } from '../toasts';
import { contentUrl } from '../../site/siteApi';
import { dayKey, formatWeekday } from '../../site/format';
import { programme, programmeSpan } from '../../site/event/programme';
import EventPoster from '../EventPoster';
import { ConfirmDialog, Notice, Skeleton } from './listUi';
import { EventApiError, EventPage, EventIcon, errorText, useEventApi, useUnsavedGuard } from './eventKit';
import {
  EventFormValues, EventRecord, EventSpeaker, STEPS, StepId, afterSave, buildFormUpdate, formValuesOf, isPublished, stepFromLocation,
  stepIndexOf, toClockTime,
} from './eventModel';
import { StepNav, Stepper } from './eventStepper';
import { RegistrationStep, ScheduleStep, SessionsStep, TalkListStep, useAgendaDraft } from './eventAgenda';
import { InfoStep, MaterialsStep, PhotosStep, PosterStep, PublicationStep, VenueStep } from './eventPanels';

// Event wizard: /admin/workshop/:id, the ten steps of the previous admin in the same order, the step in the
// URL hash (#agenda, #iscrizione…). Steps 1, 3 and 4 edit one draft that "Salva modifiche" (last step) sends
// as a whole-record PUT built from the latest record; talks, schedule and registration keep their own saves;
// legacy sessions and uploads save at once.

type RecordLoad = { state: 'loading' } | { state: 'ready' } | { state: 'error'; message: string; status?: number };

export default function EventDetailAdminPage() {
  const { id = '' } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const api = useEventApi();
  const [load, setLoad] = useState<RecordLoad>({ state: 'loading' });
  const [workshop, setWorkshop] = useState<EventRecord | null>(null);
  const [draft, setDraft] = useState<Partial<EventFormValues>>({});
  const [saving, setSaving] = useState(false);
  const [posterStamp, setPosterStamp] = useState(0);
  const [speakersLoad, reloadSpeakers] = useAdminLoad<EventSpeaker[]>('/Speaker/Get?onlyActive=true');
  const speakers = useMemo(() => (speakersLoad.state === 'ready' ? speakersLoad.data : []), [speakersLoad]);

  const fetchWorkshop = useCallback(async () => {
    try {
      const data = await api<EventRecord>(`/Workshop/Get/${encodeURIComponent(id)}`);
      setWorkshop({ ...data, workshopId: data.workshopId || id });
      setLoad({ state: 'ready' });
    } catch (error) {
      setLoad({ state: 'error', message: errorText(error), status: error instanceof EventApiError ? error.status : undefined });
    }
  }, [api, id]);
  useEffect(() => {
    setLoad({ state: 'loading' });
    setWorkshop(null);
    setDraft({});
    void fetchWorkshop();
  }, [fetchWorkshop]);

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

  const save = useCallback(async (body: EventRecord, toast: { title: string; description?: string }) => {
    try {
      await api(`/Workshop/Update/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(body) });
      setWorkshop(afterSave(body));
      notify(toast.title, { description: toast.description });
      return true;
    } catch (error) {
      notify('Salvataggio non riuscito', { description: errorText(error), kind: 'error' });
      return false;
    }
  }, [api, id]);

  const values: EventFormValues | null = workshop ? { ...formValuesOf(workshop), ...draft } : null;
  const edit = useCallback((patch: Partial<EventFormValues>) => setDraft(current => ({ ...current, ...patch })), []);
  const draftDirty = Object.keys(draft).length > 0;

  /** "Salva modifiche": one PUT with the latest record and the edited values of steps 1, 3 and 4. */
  const saveChanges = async () => {
    if (!workshop || !values) return;
    setSaving(true);
    const ok = await save(buildFormUpdate(workshop, values), { title: 'Modifiche salvate', description: clean(values.title) });
    if (ok) setDraft({});
    setSaving(false);
  };

  const page: EventPage | null = workshop && values ? {
    workshop, speakers, api, save, values, edit,
    replace: setWorkshop,
    reload: fetchWorkshop,
    reloadSpeakers,
  } : null;
  const agenda = useAgendaDraft(workshop);
  const dirty = draftDirty || !!agenda?.dirty;

  // Leaving with unsaved changes: the browser asks on reload/close; in-app links are held for a confirmation.
  const [leaveTo, setLeaveTo] = useState<string | null>(null);
  useUnsavedGuard(dirty, setLeaveTo, location);

  if (load.state === 'error') {
    return (
      <>
        <Link to="/admin/workshops/" className={`mb-2 inline-flex min-h-11 items-center gap-2 rounded-full font-semibold text-cyan-700 hover:underline ${linkFocus}`}><AdminIcon name="back" />Eventi</Link>
        {load.status === 404
          ? <EmptyState icon="calendar" title="Evento non trovato" actions={<Link to="/admin/workshops/" className={btn.secondary}>Tutti gli eventi</Link>}><p>La scheda non esiste più o il link non è corretto.</p></EmptyState>
          : <LoadError message={`L'evento non è disponibile (${load.message}).`} onRetry={() => { setLoad({ state: 'loading' }); void fetchWorkshop(); }} />}
      </>
    );
  }
  if (!page || !workshop || !agenda) {
    return (
      <>
        <Link to="/admin/workshops/" className={`mb-2 inline-flex min-h-11 items-center gap-2 rounded-full font-semibold text-cyan-700 hover:underline ${linkFocus}`}><AdminIcon name="back" />Eventi</Link>
        <p role="status" className="sr-only">Caricamento dell'evento…</p>
        <Skeleton className="mt-2 h-40" />
        <Skeleton className="mt-5 h-96" />
      </>
    );
  }

  const title = clean(workshop.title) || 'Evento senza titolo';
  const span = programmeSpan(programme(workshop));
  const upcoming = dayKey(workshop.eventDate) >= dayKey(new Date().toISOString());
  const poster = contentUrl(workshop.image);
  const place = clean(workshop.location?.name);
  const definition = STEPS[stepIndex];

  const content = () => {
    switch (step) {
      case 'locandina': return <PosterStep page={page} stamp={posterStamp} onUploaded={() => setPosterStamp(Date.now())} />;
      case 'informazioni': return <InfoStep page={page} />;
      case 'sede': return <VenueStep page={page} />;
      case 'sessioni': return <SessionsStep page={page} />;
      case 'talk': return <TalkListStep page={page} draft={agenda} />;
      case 'agenda': return <ScheduleStep page={page} draft={agenda} />;
      case 'iscrizione': return <RegistrationStep page={page} draft={agenda} />;
      case 'materiali': return <MaterialsStep page={page} />;
      case 'foto': return <PhotosStep page={page} />;
      default: return <PublicationStep page={page} />;
    }
  };

  return (
    <>
      <Link to="/admin/workshops/" className={`mb-2 inline-flex min-h-11 items-center gap-2 rounded-full font-semibold text-cyan-700 hover:underline ${linkFocus}`}><AdminIcon name="back" />Eventi</Link>
      <div className="flex flex-wrap items-start gap-5">
        <EventPoster src={posterStamp && poster ? `${poster}?t=${posterStamp}` : poster} className="aspect-video w-full max-w-56 rounded-2xl object-cover sm:w-56" />
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

      {dirty && (
        <div className="mt-5">
          <Notice tone="warn" title="Modifiche non salvate">
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-2">
              {draftDirty && <span>Pubblicazione, informazioni e sede si salvano con «Salva modifiche».</span>}
              {agenda.dirty && <span>Elenco talk, agenda e iscrizione si salvano dal loro passo.</span>}
              {draftDirty && <Button onPress={() => void saveChanges()} isDisabled={saving} className={btn.secondary}>{saving ? 'Salvataggio…' : 'Salva modifiche'}</Button>}
              {agenda.dirty && step !== 'talk' && step !== 'agenda' && step !== 'iscrizione' && <Button onPress={() => goTo('agenda', true)} className={btn.ghost}>Vai all'agenda</Button>}
            </div>
          </Notice>
        </div>
      )}

      <section aria-labelledby="step-heading" className="mt-6">
        <h2 id="step-heading" ref={headingRef} tabIndex={-1} className="text-2xl font-bold leading-tight outline-none">
          <span className="text-muted">{stepIndex + 1}.</span> {definition.label}
        </h2>
        <p className="mt-1 max-w-[65ch] text-muted">{definition.description}</p>
        <div className="mt-5">{content()}</div>
        <StepNav current={step} busy={saving} onMove={next => goTo(next, true)} onSave={() => void saveChanges()} />
      </section>

      <ConfirmDialog
        isOpen={leaveTo !== null}
        onOpenChange={open => { if (!open) setLeaveTo(null); }}
        title="Modifiche non salvate"
        confirmLabel="Esci senza salvare"
        onConfirm={() => { const target = leaveTo; setLeaveTo(null); setDraft({}); if (target) navigate(target); }}
      >
        <p>Se esci ora, le modifiche non salvate di questo evento vanno perse.</p>
      </ConfirmDialog>
    </>
  );
}

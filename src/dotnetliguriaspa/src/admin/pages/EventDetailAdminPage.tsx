import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { AdminIcon } from '../icons';
import { linkFocus } from '../ui';
import { clean } from '../adminApi';
import { notify } from '../toasts';
import type { VenueModel } from '../../models/VenueModel';
import { Skeleton } from './listUi';
import { EventPage, useEventApi } from './eventKit';
import { EventCoreValues, EventRecord, EventSpeaker, StepId, afterSave, buildWorkshopUpdate, coreValuesOf, problemMessage, statusMessage, stepFromLocation, stepIndexOf } from './eventModel';
import { ScrollTopButton, StepNav, Stepper } from './eventStepper';
import { AgendaModule, TracksStep } from './eventAgenda';
import { ImageStep, InfoStep, LocationStep, MaterialsStep, PhotosStep, PublicationStep } from './eventPanels';
import { useAccountCapabilities } from '../../account/AccountCapabilities';
import { canPerform, hasPermission } from '../../account/permissions';

// Event wizard: /admin/workshop/:id, the previous AdminWorkshopDetail ("Workshop Edit - {title}") with its ten
// steps in the same order, the step in the URL hash. Steps 1, 3 and 4 edit the fields the previous page tracked
// as dirty; "Salva modifiche" on the last step sends one whole-record PUT built from the latest record
// (buildWorkshopUpdate). The talk pool, schedule and registration module stays mounted for the whole wizard.

type RecordLoad = 'loading' | 'ready' | 'failed';

export default function EventDetailAdminPage() {
  const { capabilities } = useAccountCapabilities();
  const { id = '' } = useParams<{ id: string }>();
  const location = useLocation();
  const step = stepFromLocation(location.hash, location.search);
  const navigate = useNavigate();
  const api = useEventApi();
  const [load, setLoad] = useState<RecordLoad>('loading');
  const [workshop, setWorkshop] = useState<EventRecord | null>(null);
  const workshopRef = useRef<EventRecord | null>(null);
  const commit = useCallback((next: EventRecord | null) => { workshopRef.current = next; setWorkshop(next); }, []);
  /** handleRelatedWorkshopSaved: a record coming back after a change is pending for Eventbrite until synced. */
  const replace = useCallback((next: EventRecord) => commit(afterSave({ ...next, workshopId: next.workshopId || id })), [commit, id]);
  const [draft, setDraft] = useState<Partial<EventCoreValues>>({});
  const [saving, setSaving] = useState(false);
  const [savingChanges, setSavingChanges] = useState(false);
  const [imageStamp, setImageStamp] = useState(0);
  const [speakers, setSpeakers] = useState<EventSpeaker[]>([]);
  const [venues, setVenues] = useState<VenueModel[]>([]);
  /** "Copia dalla sede": the venue chosen stays selected while moving between steps, as before. */
  const [venueId, setVenueId] = useState<string | null>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  // As before: a failed load says "Errore nel caricamento dei dettagli dell'evento" and the page "Evento non trovato".
  useEffect(() => {
    let alive = true;
    setLoad('loading');
    commit(null);
    setDraft({});
    api<EventRecord>(`/Workshop/Get/${encodeURIComponent(id)}`)
      .then(data => {
        if (!alive) return;
        commit({ ...data, workshopId: data.workshopId || id });
        setLoad('ready');
      })
      .catch(() => {
        if (!alive) return;
        setLoad('failed');
        notify("Errore nel caricamento dei dettagli dell'evento", { kind: 'error' });
      });
    return () => { alive = false; };
  }, [api, commit, id]);

  // The speakers (tracks and talk pool) and the venues ("Copia dalla sede") load with the page, as before; a
  // failure is reported and leaves the list empty.
  useEffect(() => {
    let alive = true;
    if (['tracks', 'talk-pool'].includes(step) && hasPermission(capabilities, 'speakers.read')) api<EventSpeaker[]>('/Speaker/Get?onlyActive=true')
      .then(data => { if (alive) setSpeakers(data ?? []); })
      .catch((error: unknown) => { if (alive) notify(statusMessage(error, 'Impossibile caricare i relatori'), { kind: 'error' }); });
    if (step === 'sede' && hasPermission(capabilities, 'venues.read')) api<VenueModel[]>('/Venue')
      .then(data => { if (alive) setVenues(data ?? []); })
      .catch((error: unknown) => { if (alive) notify(statusMessage(error, 'Impossibile caricare le sedi', 'Errore nel caricamento delle sedi'), { kind: 'error' }); });
    return () => { alive = false; };
  }, [api, capabilities, step]);

  // Reading the record again after a change: a failure is ignored, as before.
  const refresh = useCallback(async () => {
    try {
      replace(await api<EventRecord>(`/Workshop/Get/${encodeURIComponent(id)}`));
      return true;
    } catch {
      return false;
    }
  }, [api, id, replace]);

  // Steps: the hash names the current one; everything up to the furthest step reached stays reachable.
  const stepIndex = stepIndexOf(step);
  const [reached, setReached] = useState(stepIndex);
  useEffect(() => { setReached(value => Math.max(value, stepIndex)); }, [stepIndex]);
  const hrefFor = useCallback((next: StepId) => `${location.pathname}#${next}`, [location.pathname]);
  const goTo = (next: StepId) => navigate({ pathname: location.pathname, hash: `#${next}` }, { replace: true });
  // Opening another step (Avanti, Indietro, the stepper) moves the focus to the step's first panel title.
  const stepArea = useRef<HTMLDivElement>(null);
  const shownStep = useRef(step);
  useEffect(() => {
    if (shownStep.current === step) return;
    shownStep.current = step;
    const heading = Array.from(stepArea.current?.querySelectorAll('h2') ?? []).find(element => !element.closest('[hidden]'));
    heading?.focus();
  }, [step]);

  // One whole-record PUT at a time, always built from the latest record.
  const save = useCallback<EventPage['save']>(async (build, messages) => {
    const latest = workshopRef.current;
    if (!latest || !canPerform(capabilities, 'events.manage', latest)) return false;
    const body = build(latest);
    const changes = Object.keys(body).filter(key => !['authorization', 'eventbriteSyncStatus'].includes(key)
      && JSON.stringify(body[key as keyof EventRecord]) !== JSON.stringify(latest[key as keyof EventRecord]));
    const needed = changes.map(key => key === 'published' ? 'events.publish' : key === 'in_homepage' ? 'events.homepage.manage'
      : key === 'feedbackEnabled' ? 'questionnaires.publish' : key === 'image' ? 'event-assets.manage'
        : key.startsWith('eventbrite') ? 'eventbrite.manage' : 'events.manage');
    if (needed.some(permission => !canPerform(capabilities, permission, latest))) {
      notify('Salvataggio non autorizzato: manca il permesso per una modifica o per un evento passato.', { kind: 'error' });
      return false;
    }
    setSaving(true);
    try {
      await api(`/Workshop/Update/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(body) });
      replace(body);
      notify(messages.success);
      return true;
    } catch (error) {
      notify(messages.failure(error), { kind: 'error' });
      return false;
    } finally {
      setSaving(false);
    }
  }, [api, id, replace, capabilities]);

  const values: EventCoreValues | null = workshop ? { ...coreValuesOf(workshop), ...draft } : null;
  const edit = useCallback((patch: Partial<EventCoreValues>) => setDraft(current => ({ ...current, ...patch })), []);

  /** "Salva modifiche": the dirty fields over the latest record, one PUT (the previous handleSaveWorkshop). */
  const saveChanges = async () => {
    if (saving) return;
    setSavingChanges(true);
    const ok = await save(latest => buildWorkshopUpdate(latest, { ...coreValuesOf(latest), ...draft }), {
      success: 'Evento aggiornato correttamente',
      failure: error => problemMessage(error, "Impossibile salvare l'evento", "Errore nell'aggiornamento dell'evento"),
    });
    setSavingChanges(false);
    if (ok) setDraft({});
  };

  if (load === 'failed') return <h1 className="text-2xl font-bold text-[#b42318]">Evento non trovato</h1>;
  if (!workshop || !values) {
    return (
      <>
        <p role="status" className="sr-only">Caricamento…</p>
        <Skeleton className="h-20 max-w-xl" />
        <Skeleton className="mt-6 h-24" />
        <Skeleton className="mt-6 h-96" />
      </>
    );
  }

  const page: EventPage = {
    workshop, speakers, setSpeakers, api, save, saving, values, edit, replace, refresh,
    current: () => workshopRef.current ?? workshop,
    commitRecord: commit,
  };
  const modulePage = step === 'talk-pool' ? 'talks' : step === 'agenda' ? 'schedule' : step === 'iscrizione' ? 'registration' : null;
  const required = step === 'immagine' || step === 'materiali' || step === 'foto' ? 'event-assets.manage' : 'events.manage';
  const editable = canPerform(capabilities, required, workshop);
  const assetsReadable = hasPermission(capabilities, 'event-assets.read');

  const content = (): React.ReactNode => {
    switch (step) {
      case 'immagine': return <ImageStep page={page} stamp={imageStamp} onUploaded={() => setImageStamp(Date.now())} />;
      case 'informazioni': return <InfoStep page={page} />;
      case 'sede': return <LocationStep page={page} venues={venues} venueId={venueId} onVenue={setVenueId} />;
      case 'tracks': return <TracksStep page={page} />;
      case 'materiali': return assetsReadable ? <MaterialsStep page={page} /> : <p>Per visualizzare i materiali serve il permesso di lettura degli allegati.</p>;
      case 'foto': return assetsReadable ? <PhotosStep page={page} /> : <p>Per visualizzare le foto serve il permesso di lettura degli allegati.</p>;
      case 'talk-pool': case 'agenda': case 'iscrizione': return null;
      default: return <PublicationStep page={page} />;
    }
  };

  return (
    <>
      <Link to="/admin/workshops/" className={`mb-2 inline-flex min-h-11 items-center gap-2 rounded-full font-semibold text-cyan-700 hover:underline ${linkFocus}`}><AdminIcon name="back" />Eventi</Link>
      <h1 ref={titleRef} tabIndex={-1} className="text-3xl font-bold leading-tight tracking-tight text-balance outline-none">Modifica evento - {clean(workshop.title)}</h1>
      <p className="mt-2">{workshop.authorization ? workshop.authorization.isPast ? 'Evento passato' : 'Evento corrente' : 'Periodo dell’evento non verificato dal server'}</p>
      {!editable && step !== 'pubblicazione' && <p role="status">Sola lettura: manca il permesso per questa azione o per la gestione degli eventi passati.</p>}

      <Stepper current={step} reached={reached} hrefFor={hrefFor} onSelect={goTo} />

      <div ref={stepArea} className="mt-6">
        <fieldset disabled={!editable && !['pubblicazione', 'materiali', 'foto'].includes(step)} className="min-w-0 border-0 p-0">{content()}</fieldset>
        {/* The module keeps its inputs across the steps: mounted always, shown on steps 6 to 8. */}
        <div hidden={modulePage === null}>
          <AgendaModule page={page} activePage={modulePage} />
        </div>
        <StepNav current={step} busy={savingChanges} canSave={canPerform(capabilities, 'events.manage', workshop)} onMove={goTo} onSave={() => void saveChanges()} />
      </div>
      <ScrollTopButton onTop={() => titleRef.current?.focus({ preventScroll: true })} />
    </>
  );
}

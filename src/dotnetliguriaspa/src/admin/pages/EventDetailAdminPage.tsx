import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { AdminIcon } from '../icons';
import { Badge, EmptyState, LoadError, TextAreaInput, TextInput, btn, linkFocus } from '../ui';
import { clean, useAdminLoad } from '../adminApi';
import { notify } from '../toasts';
import { contentUrl } from '../../site/siteApi';
import { dayKey, formatWeekday } from '../../site/format';
import { programme, programmeSpan } from '../../site/event/programme';
import type { VenueModel } from '../../models/VenueModel';
import EventPoster from '../EventPoster';
import { ExternalLink, RowMenu, Skeleton } from './listUi';
import { isHttpUrl as isWebUrl, mapsHref, parseCoordinates } from './VenuesPage';
import {
  CardForm, Dropzone, EditCard, EventApiError, EventIcon, EventPage, Facts, Missing, SelectInput, errorText, useEventApi,
} from './eventKit';
import {
  EventRecord, EventSpeaker, IMAGE_EXTENSIONS, STEPS, StepId, afterSave, bookingUrlOf, buildWorkshopUpdate, coreValuesOf, dateInputValue,
  eventSpeakers, hasAllowedExtension, locationFromVenue, parseRooms, roomsText, stepStatuses, toClockTime, withBookingUrl,
} from './eventModel';
import { StepNav, Stepper } from './eventStepper';
import { AgendaPanel, useAgendaDraft } from './eventAgenda';
import { FilesPanel, PublishPanel, QuestionnairePanel, SpeakersPanel } from './eventPanels';

// Event card: /admin/workshop/:id with the step in the hash (#agenda, #pubblicazione…), so links from the
// dashboard and the lists land on the right step. Every section is a read-only card with its own pencil;
// saves send the whole record (PUT /Workshop/Update/{id}) exactly as the previous admin did.

const stepOf = (hash: string, search: string): StepId => {
  const wanted = hash.replace(/^#/, '') || new URLSearchParams(search).get('tab') || '';
  return (STEPS.find(step => step.id === wanted)?.id ?? 'panoramica');
};

type RecordLoad = { state: 'loading' } | { state: 'ready' } | { state: 'error'; message: string; status?: number };

/** Keeps the saved text when a field is left empty and was already empty, so an untouched null stays null. */
const textOr = (value: string, previous?: string | null) => (value.trim() ? value : previous ? '' : previous ?? '');

// ---------- Panoramica cards ----------

function DescriptionCard({ page }: { page: EventPage }) {
  const { workshop } = page;
  const tags = clean(workshop.tags).split(',').map(tag => tag.trim()).filter(Boolean);
  const html = (workshop.blogHtml ?? '').trim();
  return (
    <EditCard id="descrizione" title="Descrizione" form={close => <DescriptionForm page={page} onDone={close} />}>
      {clean(workshop.description)
        ? <p className="max-w-[65ch] leading-relaxed whitespace-pre-line">{workshop.description}</p>
        : <p><Missing>Nessuna descrizione.</Missing> <span className="text-sm text-muted">Compare nella scheda dell'evento e nella home.</span></p>}
      {tags.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Tag">
          {tags.map(tag => <li key={tag} className="rounded-full bg-basil-50 px-3 py-0.5 text-sm font-bold text-basil-700">{tag}</li>)}
        </ul>
      )}
      {html && <p className="mt-3 text-sm text-muted">Contenuto HTML esteso: {html.length} caratteri, mostrato sotto la descrizione.</p>}
    </EditCard>
  );
}

function DescriptionForm({ page, onDone }: { page: EventPage; onDone: () => void }) {
  const { workshop } = page;
  const [draft, setDraft] = useState({ title: workshop.title ?? '', description: workshop.description ?? '', tags: workshop.tags ?? '', blogHtml: workshop.blogHtml ?? '' });
  const set = <K extends keyof typeof draft>(key: K) => (value: string) => setDraft(d => ({ ...d, [key]: value }));
  const save = async () => {
    const body: EventRecord = {
      ...buildWorkshopUpdate(workshop, { ...coreValuesOf(workshop), title: clean(draft.title), description: draft.description }),
      tags: textOr(clean(draft.tags), workshop.tags),
      blogHtml: textOr(draft.blogHtml, workshop.blogHtml),
    };
    const ok = await page.save(body, { title: 'Evento aggiornato', description: 'Descrizione' });
    if (ok) onDone();
    return ok;
  };
  return (
    <CardForm onSave={save} onCancel={onDone}>
      <TextInput label="Titolo" isRequired autoFocus value={draft.title} onChange={set('title')} validate={value => (clean(value) ? null : 'Il titolo è obbligatorio.')} />
      <TextAreaInput label="Descrizione" rows={5} value={draft.description} onChange={set('description')} description="Due o tre righe: compaiono nella scheda dell'evento e nella home." />
      <TextInput label="Tag" value={draft.tags} onChange={set('tags')} placeholder="dotnet, ai, cloud" description="Separati da virgola: compaiono nella scheda dell'evento." />
      <TextAreaInput label="HTML esteso" rows={6} value={draft.blogHtml} onChange={set('blogHtml')} description="Facoltativo: HTML mostrato nella scheda sotto la descrizione. Il sito lo ripulisce prima di mostrarlo." />
    </CardForm>
  );
}

function DateVenueCard({ page, venues, venuesState, reloadVenues }: { page: EventPage; venues: VenueModel[]; venuesState: 'loading' | 'ready' | 'error'; reloadVenues: () => void }) {
  const { workshop } = page;
  const span = programmeSpan(programme(workshop));
  const place = clean(workshop.location?.name);
  const address = clean(workshop.location?.address);
  const rooms = workshop.location?.rooms ?? [];
  const spaces = workshop.location?.maximumSpaces ?? 0;
  const map = workshop.location ? mapsHref({ googleMapsUrl: workshop.location.googleMapsUrl, coordinates: workshop.location.coordinates }) : null;
  return (
    <EditCard id="sede" title="Data e sede" form={close => <DateVenueForm page={page} venues={venues} venuesState={venuesState} reloadVenues={reloadVenues} onDone={close} />}>
      <Facts items={[
        ['Data', formatWeekday(workshop.eventDate)],
        ['Orario', span ? `${toClockTime(span.start)}–${toClockTime(span.end)}` : <Missing>Si ricava dall'agenda</Missing>],
        ['Sede', place ? <>{place}{address && <span className="block text-muted">{address}</span>}</> : <Missing>Da scegliere</Missing>],
        ['Posti', spaces > 0 ? String(spaces) : <Missing>Nessun limite</Missing>],
        ...(rooms.length ? [['Sale', rooms.join(', ')] as [string, React.ReactNode]] : []),
        ['Mappa', map ? <ExternalLink href={map}>Apri la mappa</ExternalLink> : <Missing>Aggiungi le coordinate o il link a Google Maps.</Missing>],
      ]} />
    </EditCard>
  );
}

function DateVenueForm({ page, venues, venuesState, reloadVenues, onDone }: { page: EventPage; venues: VenueModel[]; venuesState: 'loading' | 'ready' | 'error'; reloadVenues: () => void; onDone: () => void }) {
  const { workshop } = page;
  const [draft, setDraft] = useState({
    eventDate: dateInputValue(workshop.eventDate),
    name: workshop.location?.name ?? '', address: workshop.location?.address ?? '', coordinates: workshop.location?.coordinates ?? '',
    googleMapsUrl: workshop.location?.googleMapsUrl ?? '', maximumSpaces: workshop.location?.maximumSpaces?.toString() ?? '', rooms: roomsText(workshop.location?.rooms),
  });
  const [venueId, setVenueId] = useState<string | null>(null);
  const set = <K extends keyof typeof draft>(key: K) => (value: string) => setDraft(d => ({ ...d, [key]: value }));
  const copyVenue = (id: string | null) => {
    setVenueId(id);
    const venue = venues.find(item => item.venueId === id);
    if (!venue) return;
    const location = locationFromVenue(venue);
    setDraft(d => ({ ...d, name: location.name ?? '', address: location.address ?? '', coordinates: location.coordinates ?? '', googleMapsUrl: location.googleMapsUrl ?? '', maximumSpaces: String(location.maximumSpaces ?? 0) }));
  };
  const save = async () => {
    const core = buildWorkshopUpdate(workshop, {
      ...coreValuesOf(workshop), eventDate: draft.eventDate, locationName: clean(draft.name), address: clean(draft.address),
      coordinates: clean(draft.coordinates), googleMapsUrl: clean(draft.googleMapsUrl), maximumSpaces: draft.maximumSpaces,
    });
    const body: EventRecord = { ...core, location: { ...core.location, rooms: parseRooms(draft.rooms) } };
    const ok = await page.save(body, { title: 'Evento aggiornato', description: 'Data e sede' });
    if (ok) onDone();
    return ok;
  };
  return (
    <CardForm onSave={save} onCancel={onDone}>
      <TextInput label="Data" type="date" isRequired autoFocus value={draft.eventDate} onChange={set('eventDate')} validate={value => (value ? null : 'La data è obbligatoria.')} />
      {venuesState === 'error' ? (
        <p className="text-sm text-muted">Le sedi salvate non si sono caricate. <button type="button" onClick={reloadVenues} className={`font-bold text-cyan-700 underline ${linkFocus}`}>Riprova</button></p>
      ) : (
        <SelectInput
          label="Copia da una sede salvata"
          items={venues.map(venue => ({ id: venue.venueId, label: clean(venue.name), description: clean(venue.address) || undefined }))}
          selectedKey={venueId}
          onSelectionChange={copyVenue}
          placeholder={venuesState === 'loading' ? 'Caricamento delle sedi…' : venues.length ? 'Scegli una sede…' : 'Nessuna sede salvata'}
          isDisabled={venuesState === 'loading' || venues.length === 0}
          description="Compila nome, indirizzo, coordinate, mappa e posti dalla sede scelta; puoi poi correggerli qui sotto."
        />
      )}
      <TextInput label="Nome della sede" isRequired value={draft.name} onChange={set('name')} validate={value => (clean(value) ? null : 'Il nome della sede è obbligatorio.')} />
      <TextInput label="Indirizzo" isRequired value={draft.address} onChange={set('address')} placeholder="Via, numero civico, CAP e città" validate={value => (clean(value) ? null : "L'indirizzo è obbligatorio.")} />
      <TextInput label="Coordinate" value={draft.coordinates} onChange={set('coordinates')} placeholder="44.4056, 8.9463" description="Latitudine e longitudine in gradi decimali, separate da una virgola." validate={value => (!clean(value) || parseCoordinates(value) ? null : 'Usa latitudine e longitudine in gradi decimali, ad esempio 44.4056, 8.9463.')} />
      <TextInput label="Link a Google Maps" type="url" value={draft.googleMapsUrl} onChange={set('googleMapsUrl')} placeholder="https://maps.app.goo.gl/…" validate={value => (!clean(value) || isWebUrl(clean(value)) ? null : 'Inserisci un indirizzo web completo, che inizi con https://.')} />
      <TextInput label="Posti disponibili" type="number" value={draft.maximumSpaces} onChange={set('maximumSpaces')} description="0 se la sede non ha un limite di posti." validate={value => (!clean(value) || /^\d+$/.test(clean(value)) ? null : "Indica un numero intero di posti, 0 se non c'è un limite.")} />
      <TextAreaInput label="Sale" rows={2} value={draft.rooms} onChange={set('rooms')} placeholder="Una sala per riga" description="Le sale usate in questo evento; possono cambiare da un evento all'altro." />
    </CardForm>
  );
}

function PosterCard({ page, stamp, onUploaded }: { page: EventPage; stamp: number; onUploaded: () => void }) {
  const { workshop } = page;
  const [busy, setBusy] = useState(false);
  const poster = contentUrl(workshop.image);
  const upload = async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    if (!hasAllowedExtension(file.name, IMAGE_EXTENSIONS)) {
      notify('Formato non ammesso', { description: 'Carica un file PNG, JPG, WebP o GIF.', kind: 'error' });
      return;
    }
    setBusy(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('workshopId', workshop.workshopId);
      await page.api('/workshopfile/uploadworkshopimage', { method: 'POST', body: form });
      await page.reload();
      onUploaded();
      notify('Locandina aggiornata', { description: file.name });
    } catch (error) {
      notify('Caricamento non riuscito', { description: errorText(error), kind: 'error' });
    } finally {
      setBusy(false);
    }
  };
  return (
    <EditCard id="locandina" title="Locandina">
      <EventPoster src={poster ? (stamp ? `${poster}?t=${stamp}` : poster) : null} alt={`Locandina di ${clean(workshop.title)}`} className="mb-4 aspect-video w-full max-w-sm rounded-xl border border-line object-cover" />
      {!poster && <p className="mb-4"><Missing>Nessuna locandina.</Missing> <span className="text-sm text-muted">Compare nelle liste e in cima alla scheda dell'evento.</span></p>}
      <Dropzone label="Trascina qui la locandina" hint="PNG, JPG, WebP o GIF in formato 16:9" accept={IMAGE_EXTENSIONS} busy={busy} buttonLabel="Scegli il file" onFiles={files => void upload(files)} />
    </EditCard>
  );
}

function BookingCard({ page }: { page: EventPage }) {
  const { workshop } = page;
  const booking = clean(bookingUrlOf(workshop));
  return (
    <EditCard id="iscrizione" title="Iscrizione" form={close => <BookingForm page={page} onDone={close} />}>
      {booking
        ? <Facts items={[['Link di prenotazione', <a key="link" href={booking} target="_blank" rel="noopener noreferrer" className={`break-all font-bold text-cyan-700 underline ${linkFocus}`}>{booking}<span className="sr-only"> (si apre in una nuova scheda)</span></a>]]} />
        : <p><Missing>Nessun link di iscrizione.</Missing> <span className="text-sm text-muted">Con un link di prenotazione il sito mostra «Prenota o annulla il posto» fino al giorno dell'evento.</span></p>}
      {workshop.eventbriteEventUrl && (
        <p className="mt-3 text-sm text-muted">
          <ExternalLink href={workshop.eventbriteEventUrl} className={`inline-flex items-center gap-1.5 font-bold text-cyan-700 underline ${linkFocus}`}>Evento su Eventbrite</ExternalLink>
          {' · '}biglietti e pubblicazione nella scheda <Link to={page.tabHref('pubblicazione')} className={`font-bold text-cyan-700 underline ${linkFocus}`}>Pubblicazione</Link>.
        </p>
      )}
    </EditCard>
  );
}

function BookingForm({ page, onDone }: { page: EventPage; onDone: () => void }) {
  const [url, setUrl] = useState(bookingUrlOf(page.workshop));
  const save = async () => {
    const ok = await page.save(withBookingUrl(page.workshop, clean(url)), { title: 'Evento aggiornato', description: 'Iscrizione' });
    if (ok) onDone();
    return ok;
  };
  return (
    <CardForm onSave={save} onCancel={onDone}>
      <TextInput label="Link di prenotazione" type="url" autoFocus value={url} onChange={setUrl} placeholder="https://www.eventbrite.it/…" description="Eventbrite o il servizio di prenotazione posti: il sito mostra «Prenota o annulla il posto» fino al giorno dell'evento." validate={value => (!clean(value) || isWebUrl(clean(value)) ? null : 'Inserisci un indirizzo web completo, che inizi con https://.')} />
    </CardForm>
  );
}

function NotesCard({ page }: { page: EventPage }) {
  const notes = (page.workshop.attendeeNotes ?? '').trim();
  return (
    <EditCard id="note" title="Note per chi partecipa" form={close => <NotesForm page={page} onDone={close} />}>
      {notes
        ? <p className="whitespace-pre-line">{notes}</p>
        : <p><Missing>Nessuna nota.</Missing> <span className="text-sm text-muted">Per esempio: portare il portatile, parcheggio, ingresso dal retro. Il sito le mostra prima dell'evento.</span></p>}
    </EditCard>
  );
}

function NotesForm({ page, onDone }: { page: EventPage; onDone: () => void }) {
  const [notes, setNotes] = useState(page.workshop.attendeeNotes ?? '');
  const save = async () => {
    const ok = await page.save({ ...page.workshop, attendeeNotes: notes }, { title: 'Evento aggiornato', description: 'Note per chi partecipa' });
    if (ok) onDone();
    return ok;
  };
  return (
    <CardForm onSave={save} onCancel={onDone}>
      <TextAreaInput label="Note" rows={4} autoFocus value={notes} onChange={setNotes} placeholder="Informazioni pratiche per chi partecipa" />
    </CardForm>
  );
}

// ---------- Page ----------

export default function EventDetailAdminPage() {
  const { id = '' } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const api = useEventApi();
  const [load, setLoad] = useState<RecordLoad>({ state: 'loading' });
  const [workshop, setWorkshop] = useState<EventRecord | null>(null);
  const [posterStamp, setPosterStamp] = useState(0);
  const [speakersLoad, reloadSpeakers] = useAdminLoad<EventSpeaker[]>('/Speaker/Get?onlyActive=true');
  const [venuesLoad, reloadVenues] = useAdminLoad<VenueModel[]>('/Venue');
  const speakers = useMemo(() => (speakersLoad.state === 'ready' ? speakersLoad.data : []), [speakersLoad]);
  const venues = venuesLoad.state === 'ready' ? venuesLoad.data : [];

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
    void fetchWorkshop();
  }, [fetchWorkshop]);

  const step = stepOf(location.hash, location.search);
  const tabHref = useCallback((next: string) => `${location.pathname}#${next}`, [location.pathname]);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const focusHeading = useRef(false);
  // Indietro/Avanti move the reader to the new step's heading once it is on screen.
  useEffect(() => {
    if (!focusHeading.current) return;
    focusHeading.current = false;
    headingRef.current?.focus();
  }, [step]);
  const selectStep = (next: StepId, moveFocus = false) => {
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

  const toggleFlag = useCallback(async (flag: 'published' | 'in_homepage' | 'feedbackEnabled', value: boolean) => {
    if (!workshop) return;
    const body = { ...workshop, [flag]: value } as EventRecord;
    setWorkshop(body);
    try {
      await api(`/Workshop/Update/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(body) });
      setWorkshop(afterSave(body));
      const labels = {
        published: value ? 'Evento pubblicato' : 'Evento in bozza',
        in_homepage: value ? 'Evento in evidenza nella home' : 'Evento tolto dalla home',
        feedbackEnabled: value ? 'Feedback aperto' : 'Feedback chiuso',
      };
      notify(labels[flag], { description: clean(workshop.title) });
    } catch (error) {
      setWorkshop(workshop);
      notify('Modifica non riuscita', { description: errorText(error), kind: 'error' });
    }
  }, [api, id, workshop]);

  const page: EventPage | null = workshop ? {
    workshop, speakers, api, save, toggleFlag, tabHref,
    replace: setWorkshop,
    reload: fetchWorkshop,
    reloadSpeakers,
  } : null;
  const agenda = useAgendaDraft(workshop);

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
  const speakerCount = eventSpeakers(workshop, speakers).length;
  const upcoming = dayKey(workshop.eventDate) >= dayKey(new Date().toISOString());
  const poster = contentUrl(workshop.image);
  const place = clean(workshop.location?.name);
  const statuses = stepStatuses(workshop, speakerCount);
  const stepDefinition = STEPS.find(item => item.id === step) ?? STEPS[0];
  const stepIndex = STEPS.indexOf(stepDefinition);

  const stepContent = () => {
    switch (step) {
      case 'agenda': return <AgendaPanel page={page} draft={agenda} />;
      case 'relatori': return <SpeakersPanel page={page} />;
      case 'materiali': return <FilesPanel page={page} />;
      case 'questionario': return <QuestionnairePanel page={page} />;
      case 'pubblicazione': return <PublishPanel page={page} />;
      default: return (
        <div className="grid items-start gap-5 xl:grid-cols-2">
          <DescriptionCard page={page} />
          <DateVenueCard page={page} venues={venues} venuesState={venuesLoad.state} reloadVenues={reloadVenues} />
          <PosterCard page={page} stamp={posterStamp} onUploaded={() => setPosterStamp(Date.now())} />
          <BookingCard page={page} />
          <NotesCard page={page} />
        </div>
      );
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
            {workshop.published === false && <Badge kind="warn">Bozza</Badge>}
          </div>
          <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight text-balance">{title}</h1>
          <p className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-muted">
            <span className="inline-flex items-center gap-1.5"><AdminIcon name="calendar" />{formatWeekday(workshop.eventDate)}</span>
            {span && <span className="inline-flex items-center gap-1.5"><EventIcon name="clock" />{toClockTime(span.start)}–{toClockTime(span.end)}</span>}
            {place && <span className="inline-flex items-center gap-1.5"><AdminIcon name="pin" />{place}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a href={`/workshop/${workshop.workshopId}`} target="_blank" rel="noopener noreferrer" className={btn.secondary}>
            <AdminIcon name="external" />Vedi sul sito<span className="sr-only"> (si apre in una nuova scheda)</span>
          </a>
          <RowMenu label="Altre azioni" items={[
            { id: 'publish', label: workshop.published === false ? 'Pubblica sul sito' : 'Metti in bozza', icon: <AdminIcon name={workshop.published === false ? 'check' : 'todo'} className="size-5 text-muted" />, onAction: () => void toggleFlag('published', workshop.published === false) },
            { id: 'feature', label: workshop.in_homepage ? 'Togli dalla home' : 'Metti in evidenza', icon: <EventIcon name="star" className="size-5 text-muted" />, onAction: () => void toggleFlag('in_homepage', !workshop.in_homepage) },
          ]} />
        </div>
      </div>

      <Stepper current={step} statuses={statuses} hrefFor={tabHref} onSelect={id => selectStep(id)} />
      <section aria-labelledby="step-heading" className="mt-6">
        <h2 id="step-heading" ref={headingRef} tabIndex={-1} className="text-2xl font-bold leading-tight outline-none">
          <span className="text-muted">{stepIndex + 1}.</span> {stepDefinition.label}
        </h2>
        <p className="mt-1 max-w-[65ch] text-muted">{stepDefinition.description}</p>
        <div className="mt-5">{stepContent()}</div>
        <StepNav current={step} onMove={id => selectStep(id, true)} />
      </section>
    </>
  );
}

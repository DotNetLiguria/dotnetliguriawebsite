import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from 'react-aria-components';
import { useOidcFetch } from '@axa-fr/react-oidc';
import { QRCodeSVG } from 'qrcode.react';
import { AdminIcon } from '../icons';
import { Badge, LoadError, Panel, SwitchInput, TextAreaInput, TextInput, btn, linkFocus } from '../ui';
import { AdminLoad, clean, useAdminLoad } from '../adminApi';
import { notify } from '../toasts';
import { contentUrl } from '../../site/siteApi';
import { createQuestionnaireAdminApi, FetchLike } from '../../questionnaire/api';
import { statusLabels } from '../../questionnaire/status';
import type { Questionnaire, QuestionnaireStatus } from '../../questionnaire/types';
import type { VenueModel } from '../../models/VenueModel';
import EventPoster from '../EventPoster';
import { ExternalLink, Notice, Skeleton, plural } from './listUi';
import { Dropzone, EventIcon, EventPage, InlineConfirm, Missing, PanelTitle, SelectInput, errorText } from './eventKit';
import { EventFile, FILE_TYPE, IMAGE_EXTENSIONS, MATERIAL_EXTENSIONS, hasAllowedExtension, locationFromVenue } from './eventModel';

// Steps 1 (Pubblicazione), 2 (Locandina), 3 (Informazioni), 4 (Sede), 9 (Materiali) and 10 (Foto) of the wizard.
// Steps 1, 3 and 4 edit the page draft and save together with "Salva modifiche"; uploads are immediate.

// ---------- 1. Pubblicazione ----------

const questionnaireTone: Record<QuestionnaireStatus, 'warn' | 'ok' | 'done'> = { Draft: 'warn', Published: 'ok', Closed: 'done', Archived: 'done' };

export function PublicationStep({ page }: { page: EventPage }) {
  const { workshop, values, edit } = page;
  const navigate = useNavigate();
  const { fetch } = useOidcFetch();
  const api = useMemo(() => createQuestionnaireAdminApi(fetch as FetchLike), [fetch]);
  const [items, setItems] = useState<Questionnaire[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const feedbackUrl = `${window.location.origin}/feedback/${workshop.workshopId}`;

  useEffect(() => {
    let active = true;
    api.byWorkshop(workshop.workshopId)
      .then(result => { if (active) setItems(result); })
      .catch(err => { if (active) { setItems([]); setError(err instanceof Error ? err.message : 'Impossibile caricare i questionari.'); } });
    return () => { active = false; };
  }, [api, workshop.workshopId]);

  const create = async () => {
    setBusy(true);
    try {
      const created = await api.create({ template: 'workshopFeedback', workshopId: workshop.workshopId });
      navigate(`/admin/questionnaires/${created.questionnaireId}/edit`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Creazione non riuscita.');
      setBusy(false);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(feedbackUrl);
      notify('Link copiato', { description: feedbackUrl });
    } catch {
      notify('Copia non riuscita', { description: 'Seleziona e copia il link a mano.', kind: 'error' });
    }
  };

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <Panel labelledBy="visibility-title" className="p-5">
        <PanelTitle id="visibility-title" title="Visibilità sul sito" hint="Si salva con «Salva modifiche» all'ultimo passo." />
        <ul className="mt-3 divide-y divide-line">
          <li className="py-3"><SwitchInput isSelected={values.published} onChange={published => edit({ published })}>Pubblicato</SwitchInput><p className="pl-15 text-sm text-muted">Visibile nell'archivio e sulla sua pagina.</p></li>
          <li className="py-3"><SwitchInput isSelected={values.inHomepage} onChange={inHomepage => edit({ inHomepage })}>In evidenza nella home</SwitchInput><p className="pl-15 text-sm text-muted">Compare in apertura della home; un solo evento alla volta.</p></li>
          <li className="py-3"><SwitchInput isSelected={values.feedbackEnabled} onChange={feedbackEnabled => edit({ feedbackEnabled })}>Feedback aperto</SwitchInput><p className="pl-15 text-sm text-muted">Il questionario accetta risposte.</p></li>
        </ul>
      </Panel>
      <div className="space-y-5">
        <Panel labelledBy="feedback-title" className="p-5">
          <PanelTitle id="feedback-title" title="QR code del feedback" hint="Chi partecipa lo apre dal QR code in sala o dal link sulla pagina dell'evento." />
          <div className="mt-4 flex flex-wrap items-start gap-5">
            <div className="rounded-xl border border-line bg-white p-3"><QRCodeSVG value={feedbackUrl} size={150} level="H" title={`QR code del feedback di ${clean(workshop.title)}`} /></div>
            <div className="min-w-0 flex-1 space-y-3">
              <p className="break-all font-semibold">{feedbackUrl}</p>
              <Button onPress={() => void copyLink()} className={btn.secondary}><EventIcon name="copy" />Copia il link</Button>
            </div>
          </div>
        </Panel>
        <Panel labelledBy="questionnaires-title">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <h3 id="questionnaires-title" className="text-lg font-bold">Questionari collegati</h3>
            <Button onPress={() => void create()} isDisabled={busy} className={btn.secondary}><AdminIcon name="plus" />{busy ? 'Creazione…' : 'Crea questionario di feedback'}</Button>
          </div>
          {error && <div className="px-5 pb-4"><Notice tone="danger" title="Questionari non disponibili">{error}</Notice></div>}
          {items === null && !error && <p role="status" className="px-5 pb-5 text-muted">Caricamento dei questionari…</p>}
          {items && items.length === 0 && !error && <p className="px-5 pb-5 text-muted">Nessun questionario: il link di feedback mostrerà un messaggio finché non ne pubblichi uno.</p>}
          {items && items.length > 0 && (
            <ul className="divide-y divide-line border-t border-line">
              {items.map(q => (
                <li key={q.questionnaireId} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <Link to={`/admin/questionnaires/${q.questionnaireId}/edit`} className={`min-w-0 flex-1 rounded font-bold hover:underline ${linkFocus}`}>{q.title}</Link>
                  <Badge kind={questionnaireTone[q.status]}>{statusLabels[q.status]}</Badge>
                  <Link to={`/admin/questionnaires/${q.questionnaireId}/results`} className={`rounded text-sm font-semibold text-cyan-700 underline ${linkFocus}`}>{plural(q.responseCount, 'risposta', 'risposte')}</Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

// ---------- 2. Locandina ----------

export function PosterStep({ page, stamp, onUploaded }: { page: EventPage; stamp: number; onUploaded: () => void }) {
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
    <Panel labelledBy="poster-title" className="p-5">
      <PanelTitle id="poster-title" title="Locandina" hint="Compare nelle liste e in cima alla scheda dell'evento; il caricamento è immediato." />
      <div className="mt-4 grid items-start gap-5 md:grid-cols-2">
        <div>
          <EventPoster src={poster ? (stamp ? `${poster}?t=${stamp}` : poster) : null} alt={`Locandina di ${clean(workshop.title)}`} className="aspect-video w-full rounded-xl border border-line object-cover" />
          {!poster && <p className="mt-2"><Missing>Nessuna locandina.</Missing></p>}
        </div>
        <Dropzone label="Trascina qui la locandina" hint="PNG, JPG, WebP o GIF in formato 16:9" accept={IMAGE_EXTENSIONS} busy={busy} buttonLabel="Scegli il file" onFiles={files => void upload(files)} />
      </div>
    </Panel>
  );
}

// ---------- 3. Informazioni ----------

export function InfoStep({ page }: { page: EventPage }) {
  const { values, edit } = page;
  return (
    <Panel labelledBy="info-title" className="space-y-4 p-5">
      <PanelTitle id="info-title" title="Informazioni" hint="Si salvano con «Salva modifiche» all'ultimo passo." />
      <TextInput label="Titolo" value={values.title} onChange={title => edit({ title })} placeholder="Titolo dell'evento" />
      <TextInput label="Data" type="date" value={values.eventDate} onChange={eventDate => edit({ eventDate })} className="block sm:max-w-xs" />
      <TextAreaInput label="Descrizione" rows={6} value={values.description} onChange={description => edit({ description })} placeholder="Di cosa si parla e a chi è rivolto" description="Compare nella scheda dell'evento e nella home." />
      <TextInput label="Tag" value={values.tags} onChange={tags => edit({ tags })} placeholder="dotnet, ai, cloud" description="Separati da virgola: compaiono nella scheda dell'evento." />
      <TextAreaInput label="HTML esteso" rows={6} value={values.blogHtml} onChange={blogHtml => edit({ blogHtml })} description="Facoltativo: HTML mostrato nella scheda sotto la descrizione. Il sito lo ripulisce prima di mostrarlo." />
    </Panel>
  );
}

// ---------- 4. Sede ----------

export function VenueStep({ page }: { page: EventPage }) {
  const { values, edit } = page;
  const [venuesLoad, reloadVenues] = useAdminLoad<VenueModel[]>('/Venue');
  const venues = venuesLoad.state === 'ready' ? venuesLoad.data : [];
  const [venueId, setVenueId] = useState<string | null>(null);
  const copyVenue = (id: string | null) => {
    setVenueId(id);
    const venue = venues.find(item => item.venueId === id);
    if (!venue) return;
    const location = locationFromVenue(venue);
    edit({ locationName: location.name ?? '', address: location.address ?? '', coordinates: location.coordinates ?? '', googleMapsUrl: location.googleMapsUrl ?? '', maximumSpaces: String(location.maximumSpaces ?? 0) });
  };
  return (
    <Panel labelledBy="venue-title" className="space-y-4 p-5">
      <PanelTitle id="venue-title" title="Sede" hint="Si salva con «Salva modifiche» all'ultimo passo." />
      {venuesLoad.state === 'error' ? (
        <p className="text-sm text-muted">Le sedi salvate non si sono caricate. <button type="button" onClick={reloadVenues} className={`font-bold text-cyan-700 underline ${linkFocus}`}>Riprova</button></p>
      ) : (
        <SelectInput
          label="Copia da una sede salvata"
          items={venues.map(venue => ({ id: venue.venueId, label: clean(venue.name), description: clean(venue.address) || undefined }))}
          selectedKey={venueId}
          onSelectionChange={copyVenue}
          placeholder={venuesLoad.state === 'loading' ? 'Caricamento delle sedi…' : venues.length ? 'Scegli una sede…' : 'Nessuna sede salvata da copiare'}
          isDisabled={venuesLoad.state === 'loading' || venues.length === 0}
          description="Compila nome, indirizzo, coordinate, mappa e posti dalla sede scelta; puoi poi correggerli qui sotto."
        />
      )}
      <TextInput label="Nome della sede" value={values.locationName} onChange={locationName => edit({ locationName })} placeholder="Nome della sede" />
      <TextInput label="Coordinate" value={values.coordinates} onChange={coordinates => edit({ coordinates })} placeholder="Latitudine, longitudine" />
      <TextInput label="Indirizzo" value={values.address} onChange={address => edit({ address })} />
      <TextInput label="Link a Google Maps" value={values.googleMapsUrl} onChange={googleMapsUrl => edit({ googleMapsUrl })} placeholder="https://maps.google.com/..." />
      <TextInput label="Posti disponibili" type="number" value={values.maximumSpaces} onChange={maximumSpaces => edit({ maximumSpaces })} className="block sm:max-w-xs" />
      <TextAreaInput label="Sale di questo evento" rows={2} value={values.rooms} onChange={rooms => edit({ rooms })} placeholder="Una sala per riga" description="Le sale possono cambiare da un evento all'altro." />
    </Panel>
  );
}

// ---------- 9. Materiali and 10. Foto ----------

/** Files of the event from the file endpoint (materials are type 4, photos type 2), with upload and delete. */
function useEventFiles(page: EventPage) {
  const { workshop, api } = page;
  const [load, setLoad] = useState<AdminLoad<EventFile[]>>({ state: 'loading' });
  const [busy, setBusy] = useState<'upload' | 'delete' | null>(null);
  const fetchFiles = useCallback(async () => {
    try {
      setLoad({ state: 'ready', data: await api<EventFile[]>(`/workshopfile/${encodeURIComponent(workshop.workshopId)}`) });
    } catch (error) {
      setLoad({ state: 'error', message: errorText(error) });
    }
  }, [api, workshop.workshopId]);
  useEffect(() => { void fetchFiles(); }, [fetchFiles]);

  const upload = async (kind: 'material' | 'photo', chosen: File[], title: string) => {
    const allowed = kind === 'material' ? MATERIAL_EXTENSIONS : IMAGE_EXTENSIONS;
    const rejected = chosen.filter(file => !hasAllowedExtension(file.name, allowed)).map(file => file.name);
    const accepted = chosen.filter(file => hasAllowedExtension(file.name, allowed));
    const failed: string[] = [];
    setBusy('upload');
    for (const file of accepted) {
      const form = new FormData();
      form.append('file', file);
      form.append('workshopId', workshop.workshopId);
      form.append('fileType', String(kind === 'material' ? FILE_TYPE.material : FILE_TYPE.photo));
      form.append('title', title);
      try {
        await api('/workshopfile/Upload', { method: 'POST', body: form });
      } catch (error) {
        failed.push(`${file.name} (${errorText(error)})`);
      }
    }
    setBusy(null);
    const saved = accepted.length - failed.length;
    if (saved) await fetchFiles();
    const problems = [...rejected.map(name => `${name}: formato non ammesso`), ...failed];
    if (saved && !problems.length) notify(kind === 'material' ? plural(saved, 'file caricato', 'file caricati') : plural(saved, 'foto caricata', 'foto caricate'));
    else if (saved) notify(plural(saved, 'file caricato', 'file caricati'), { description: `Non caricati: ${problems.join('; ')}.` });
    else notify('Caricamento non riuscito', { description: problems.join('; ') || 'Nessun file scelto.', kind: 'error' });
    return saved > 0;
  };

  const remove = async (file: EventFile) => {
    setBusy('delete');
    try {
      await api(`/workshopfile/${encodeURIComponent(file.workshopFileId)}`, { method: 'DELETE' });
      setLoad(current => (current.state === 'ready' ? { state: 'ready', data: current.data.filter(item => item.workshopFileId !== file.workshopFileId) } : current));
      notify('File eliminato', { description: clean(file.title) || clean(file.fileName) });
    } catch (error) {
      notify('Eliminazione non riuscita', { description: errorText(error), kind: 'error' });
    } finally {
      setBusy(null);
    }
  };

  return { load, busy, upload, remove, retry: () => { setLoad({ state: 'loading' }); void fetchFiles(); } };
}

function FileRow({ file, busy, onDelete }: { file: EventFile; busy: boolean; onDelete: () => Promise<void> }) {
  const [confirm, setConfirm] = useState(false);
  const title = clean(file.title) || clean(file.fileName) || 'File';
  const href = contentUrl(file.fullPath);
  return (
    <li className="px-5 py-3">
      {confirm ? (
        <InlineConfirm title={`Eliminare «${title}»?`} confirmLabel="Elimina" busyLabel="Eliminazione…" busy={busy} onConfirm={() => void onDelete().then(() => setConfirm(false))} onCancel={() => setConfirm(false)}>
          <p>Il file viene cancellato dal server e sparisce dalla scheda dell'evento.</p>
        </InlineConfirm>
      ) : (
        <div className="flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-cyan-50 text-cyan-700"><AdminIcon name="file" /></span>
          <span className="min-w-0 flex-1">
            <span className="block font-bold leading-snug">{title}</span>
            <span className="block truncate text-sm text-muted">{clean(file.fileName)}</span>
          </span>
          {href && <ExternalLink href={href} className={btn.icon}><span className="sr-only">Apri {title}</span></ExternalLink>}
          <Button onPress={() => setConfirm(true)} aria-label={`Elimina: ${title}`} className={btn.icon}><AdminIcon name="trash" /></Button>
        </div>
      )}
    </li>
  );
}

function PhotoCard({ file, busy, onDelete }: { file: EventFile; busy: boolean; onDelete: () => Promise<void> }) {
  const [confirm, setConfirm] = useState(false);
  const title = clean(file.title) || clean(file.fileName) || 'Foto';
  const src = contentUrl(file.fullPath);
  return (
    <li className="overflow-hidden rounded-xl border border-line">
      {src && <img src={src} alt={title} loading="lazy" className="aspect-[4/3] w-full object-cover" />}
      {confirm ? (
        <div className="p-3">
          <InlineConfirm title={`Eliminare «${title}»?`} confirmLabel="Elimina" busyLabel="Eliminazione…" busy={busy} onConfirm={() => void onDelete().then(() => setConfirm(false))} onCancel={() => setConfirm(false)} />
        </div>
      ) : (
        <div className="flex items-center gap-2 p-3">
          <span className="min-w-0 flex-1">
            <span className="block truncate font-bold">{title}</span>
            <span className="block truncate text-sm text-muted">{clean(file.fileName)}</span>
          </span>
          <Button onPress={() => setConfirm(true)} aria-label={`Elimina: ${title}`} className={btn.icon}><AdminIcon name="trash" /></Button>
        </div>
      )}
    </li>
  );
}

export function MaterialsStep({ page }: { page: EventPage }) {
  const files = useEventFiles(page);
  const [title, setTitle] = useState('');
  if (files.load.state === 'error') return <LoadError message={`I materiali non sono disponibili (${files.load.message}).`} onRetry={files.retry} />;
  if (files.load.state === 'loading') return <Skeleton className="h-72" />;
  const materials = files.load.data.filter(file => file.fileType === FILE_TYPE.material);
  return (
    <Panel labelledBy="materials-title">
      <div className="p-5">
        <PanelTitle id="materials-title" title="Slide e materiali" hint={materials.length ? plural(materials.length, 'file', 'file') : 'Ancora nessun file: chi ha partecipato li cerca qui.'} />
        <div className="mt-4 space-y-3">
          <TextInput label="Titolo del materiale" value={title} onChange={setTitle} placeholder="Per esempio: slide del talk su Blazor" description="Facoltativo: se vuoto, usa il nome del file." />
          <Dropzone label="Trascina qui slide e materiali" hint="PDF, DOCX, PPTX o XLSX" accept={MATERIAL_EXTENSIONS} multiple busy={files.busy === 'upload'} onFiles={chosen => void files.upload('material', chosen, clean(title)).then(ok => { if (ok) setTitle(''); })} />
        </div>
      </div>
      {materials.length > 0 && (
        <ul className="divide-y divide-line border-t border-line" aria-label="Materiali">
          {materials.map(file => <FileRow key={file.workshopFileId} file={file} busy={files.busy === 'delete'} onDelete={() => files.remove(file)} />)}
        </ul>
      )}
    </Panel>
  );
}

export function PhotosStep({ page }: { page: EventPage }) {
  const files = useEventFiles(page);
  if (files.load.state === 'error') return <LoadError message={`Le foto non sono disponibili (${files.load.message}).`} onRetry={files.retry} />;
  if (files.load.state === 'loading') return <Skeleton className="h-72" />;
  const photos = files.load.data.filter(file => file.fileType === FILE_TYPE.photo);
  return (
    <Panel labelledBy="photos-title">
      <div className="p-5">
        <PanelTitle id="photos-title" title="Foto dell'evento" hint={photos.length ? plural(photos.length, 'foto', 'foto') : 'Ancora nessuna foto.'} />
        <div className="mt-4">
          <Dropzone label="Trascina qui le foto" hint="JPG, PNG, WebP o GIF" accept={IMAGE_EXTENSIONS} multiple busy={files.busy === 'upload'} onFiles={chosen => void files.upload('photo', chosen, '')} />
        </div>
      </div>
      {photos.length > 0 && (
        <ul className="grid gap-3 border-t border-line p-5 sm:grid-cols-2 lg:grid-cols-3" aria-label="Foto">
          {photos.map(file => <PhotoCard key={file.workshopFileId} file={file} busy={files.busy === 'delete'} onDelete={() => files.remove(file)} />)}
        </ul>
      )}
    </Panel>
  );
}

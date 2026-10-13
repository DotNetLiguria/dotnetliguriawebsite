import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from 'react-aria-components';
import { useOidcFetch } from '@axa-fr/react-oidc';
import { QRCodeSVG } from 'qrcode.react';
import { AdminIcon } from '../icons';
import { Badge, Panel, SwitchInput, TextAreaInput, TextInput, btn, linkFocus } from '../ui';
import { clean, useAdminLoad } from '../adminApi';
import { notify } from '../toasts';
import { contentUrl } from '../../site/siteApi';
import { createQuestionnaireAdminApi, FetchLike } from '../../questionnaire/api';
import { statusLabels } from '../../questionnaire/status';
import type { Questionnaire, QuestionnaireStatus } from '../../questionnaire/types';
import type { VenueModel } from '../../models/VenueModel';
import EventPoster from '../EventPoster';
import { Notice } from './listUi';
import { Caption, Dropzone, EventPage, FilePicker, InlineConfirm, PanelTitle, SelectInput, errorText } from './eventKit';
import { EventFile, FILE_TYPE, locationFromVenue } from './eventModel';

// Steps 1 (Pubblicazione), 2 (Immagine dell'evento), 3 (Informazioni sull'evento), 4 (Sede), 9 (Materiali)
// and 10 (Foto): the previous AdminWorkshopDetail sections, texts translated literally.

// ---------- 1. Pubblicazione ----------

const questionnaireTone: Record<QuestionnaireStatus, 'warn' | 'ok' | 'done'> = { Draft: 'warn', Published: 'ok', Closed: 'done', Archived: 'done' };

/** Questionari collegati: the previous WorkshopQuestionnaires panel. */
function WorkshopQuestionnaires({ workshopId }: { workshopId: string }) {
  const navigate = useNavigate();
  const { fetch } = useOidcFetch();
  const api = useMemo(() => createQuestionnaireAdminApi(fetch as FetchLike), [fetch]);
  const [items, setItems] = useState<Questionnaire[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    api.byWorkshop(workshopId)
      .then(result => { if (active) setItems(result); })
      .catch(err => { if (active) { setItems([]); setError(err instanceof Error ? err.message : 'Impossibile caricare i questionari.'); } });
    return () => { active = false; };
  }, [api, workshopId]);

  const create = async () => {
    setBusy(true);
    try {
      const created = await api.create({ template: 'workshopFeedback', workshopId });
      navigate(`/admin/questionnaires/${created.questionnaireId}/edit`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Creazione non riuscita.');
      setBusy(false);
    }
  };

  return (
    <div className="mt-6 w-full">
      <h4 className="font-bold">Questionari collegati</h4>
      {error && <div className="mt-2"><Notice tone="danger" title={error} /></div>}
      {items && items.length === 0 && !error && <p className="mt-1 text-sm text-muted">Nessun questionario: il link di feedback mostrerà un messaggio finché non ne pubblichi uno.</p>}
      {items && items.length > 0 && (
        <ul className="mt-2 space-y-2">
          {items.map(q => (
            <li key={q.questionnaireId} className="flex flex-wrap items-center gap-3">
              <Link to={`/admin/questionnaires/${q.questionnaireId}/edit`} className={`min-w-0 flex-1 rounded font-semibold text-cyan-700 underline ${linkFocus}`}>{q.title}</Link>
              <Badge kind={questionnaireTone[q.status]}>{statusLabels[q.status]}</Badge>
              <Link to={`/admin/questionnaires/${q.questionnaireId}/results`} className={`rounded text-sm font-semibold text-cyan-700 underline ${linkFocus}`}>{q.responseCount} risposte</Link>
            </li>
          ))}
        </ul>
      )}
      <Button onPress={() => void create()} isDisabled={busy} className={`mt-3 ${btn.secondary}`}><AdminIcon name="plus" />Crea questionario di feedback</Button>
    </div>
  );
}

export function PublicationStep({ page }: { page: EventPage }) {
  const { workshop, values, edit } = page;
  const feedbackUrl = `${window.location.origin}/feedback/${workshop.workshopId}`;
  return (
    <Panel labelledBy="publication-title" className="grid items-start gap-6 p-5 md:grid-cols-[5fr_7fr] sm:p-6">
      <div>
        <PanelTitle id="publication-title" title="Impostazioni di pubblicazione" />
        <div className="mt-3 space-y-2">
          <SwitchInput isSelected={values.published} onChange={published => edit({ published })}>Pubblicato</SwitchInput>
          <SwitchInput isSelected={values.inHomepage} onChange={inHomepage => edit({ inHomepage })}>Mostra in homepage</SwitchInput>
          <SwitchInput isSelected={values.feedbackEnabled} onChange={feedbackEnabled => edit({ feedbackEnabled })}>Feedback abilitato</SwitchInput>
        </div>
      </div>
      <div className="flex flex-col items-center text-center">
        <h3 className="text-lg font-bold">QR code del feedback</h3>
        <div className="mt-3 rounded-xl border border-line bg-white p-3"><QRCodeSVG value={feedbackUrl} size={150} level="H" title={`QR code del feedback di ${clean(workshop.title)}`} /></div>
        <p className="mt-2 break-all text-sm text-muted">{feedbackUrl}</p>
        <WorkshopQuestionnaires workshopId={workshop.workshopId} />
      </div>
    </Panel>
  );
}

// ---------- 2. Immagine dell'evento ----------

export function ImageStep({ page, stamp, onUploaded }: { page: EventPage; stamp: number; onUploaded: () => void }) {
  const { workshop } = page;
  const [busy, setBusy] = useState(false);
  const poster = contentUrl(workshop.image);
  const upload = async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('workshopId', workshop.workshopId);
      await page.api('/workshopfile/uploadworkshopimage', { method: 'POST', body: form });
      await page.refresh();
      onUploaded();
      notify("Immagine dell'evento caricata");
    } catch (error) {
      notify("Errore nel caricamento dell'immagine dell'evento", { description: errorText(error), kind: 'error' });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Panel labelledBy="image-title" className="space-y-4 p-5 sm:p-6">
      <PanelTitle id="image-title" title="Immagine dell'evento" />
      <div>
        <Caption>Immagine attuale</Caption>
        <EventPoster src={poster ? (stamp ? `${poster}?t=${stamp}` : poster) : null} alt={`Locandina di ${clean(workshop.title)}`} className="mt-1 aspect-video w-full max-w-md rounded-xl border border-line object-cover" />
      </div>
      <Dropzone label="Carica l'immagine di copertina dell'evento" accept={['image/*']} busy={busy} buttonLabel="Scegli il file immagine…" onFiles={files => void upload(files)} />
    </Panel>
  );
}

// ---------- 3. Informazioni sull'evento ----------

export function InfoStep({ page }: { page: EventPage }) {
  const { values, edit } = page;
  return (
    <Panel labelledBy="info-title" className="space-y-4 p-5 sm:p-6">
      <PanelTitle id="info-title" title="Informazioni" />
      <TextInput label="Titolo" value={values.title} onChange={title => edit({ title })} placeholder="Titolo dell'evento" />
      <TextInput label="Data dell'evento" type="date" value={values.eventDate} onChange={eventDate => edit({ eventDate })} />
      <TextAreaInput label="Descrizione dell'evento" rows={6} value={values.description} onChange={description => edit({ description })} placeholder="Inserisci la descrizione dell'evento" />
    </Panel>
  );
}

// ---------- 4. Sede ----------

export function LocationStep({ page }: { page: EventPage }) {
  const { values, edit } = page;
  const [venuesLoad] = useAdminLoad<VenueModel[]>('/Venue');
  const venues = venuesLoad.state === 'ready' ? venuesLoad.data : [];
  const [venueId, setVenueId] = useState<string | null>(null);
  useEffect(() => {
    if (venuesLoad.state === 'error') notify(`Impossibile caricare le sedi (${venuesLoad.message})`, { kind: 'error' });
  }, [venuesLoad]);
  const copyVenue = (id: string | null) => {
    const venue = venues.find(item => item.venueId === id);
    if (!venue) return;
    setVenueId(id);
    const location = locationFromVenue(venue);
    edit({ locationName: location.name ?? '', address: location.address ?? '', coordinates: location.coordinates ?? '', googleMapsUrl: location.googleMapsUrl ?? '', maximumSpaces: String(location.maximumSpaces ?? 0) });
  };
  return (
    <Panel labelledBy="location-title" className="space-y-4 p-5 sm:p-6">
      <PanelTitle id="location-title" title="Informazioni sulla sede" />
      <div>
        <SelectInput label="Copia dalla sede" items={venues.map(venue => ({ id: venue.venueId, label: clean(venue.name) }))} selectedKey={venueId} onSelectionChange={copyVenue} placeholder="" isDisabled={venues.length === 0} />
        {venuesLoad.state !== 'loading' && venues.length === 0 && <p className="mt-1.5 text-sm text-muted">Nessuna sede disponibile da copiare.</p>}
      </div>
      <TextInput label="Nome" isRequired value={values.locationName} onChange={locationName => edit({ locationName })} placeholder="Nome della sede" />
      <TextInput label="Coordinate" value={values.coordinates} onChange={coordinates => edit({ coordinates })} placeholder="Latitudine, longitudine" />
      <TextInput label="Indirizzo" isRequired value={values.address} onChange={address => edit({ address })} />
      <TextInput label="URL di Google Maps" value={values.googleMapsUrl} onChange={googleMapsUrl => edit({ googleMapsUrl })} placeholder="https://maps.google.com/..." />
      <TextInput label="Posti massimi" type="number" value={values.maximumSpaces} onChange={maximumSpaces => edit({ maximumSpaces })} />
    </Panel>
  );
}

// ---------- 9. Materiali and 10. Foto ----------

type FileKind = 'Materiale' | 'Foto';
const uploadedText: Record<FileKind, string> = { Materiale: 'Materiale caricato', Foto: 'Foto caricata' };
const deletedText: Record<FileKind, string> = { Materiale: 'Materiale eliminato', Foto: 'Foto eliminata' };

/** Files of the event from the file endpoint (materials are type 4, photos type 2), with upload and delete. */
function useEventFiles(page: EventPage, fileType: number, kind: FileKind) {
  const { workshop, api } = page;
  const [files, setFiles] = useState<EventFile[]>([]);
  const [busy, setBusy] = useState(false);
  const fetchFiles = useCallback(async () => {
    try {
      const all = await api<EventFile[]>(`/workshopfile/${encodeURIComponent(workshop.workshopId)}`);
      setFiles(all.filter(file => file.fileType === fileType));
    } catch { /* as before: the list stays empty */ }
  }, [api, fileType, workshop.workshopId]);
  useEffect(() => { void fetchFiles(); }, [fetchFiles]);

  const upload = async (file: File, title: string) => {
    setBusy(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('workshopId', workshop.workshopId);
      form.append('fileType', String(fileType));
      form.append('title', title);
      await api('/workshopfile/Upload', { method: 'POST', body: form });
      await fetchFiles();
      notify(uploadedText[kind]);
      return true;
    } catch (error) {
      notify(`Errore nel caricamento: ${kind.toLowerCase()}`, { description: errorText(error), kind: 'error' });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const remove = async (file: EventFile) => {
    setBusy(true);
    try {
      await api(`/workshopfile/${encodeURIComponent(file.workshopFileId)}`, { method: 'DELETE' });
      setFiles(current => current.filter(item => item.workshopFileId !== file.workshopFileId));
      notify(deletedText[kind]);
      return true;
    } catch (error) {
      notify(`Errore nell'eliminazione: ${kind.toLowerCase()}`, { description: errorText(error), kind: 'error' });
      return false;
    } finally {
      setBusy(false);
    }
  };

  return { files, busy, upload, remove };
}

/** The previous "Add" dialog, inline: a title and a file, both required, then the upload. */
function UploadForm({ title, accept, busy, onUpload }: { title: string; accept?: string[]; busy: boolean; onUpload: (file: File, title: string) => Promise<boolean> }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const reset = () => { setOpen(false); setName(''); setFile(null); };
  if (!open) return <Button onPress={() => setOpen(true)} className={btn.primary}><AdminIcon name="plus" />Aggiungi</Button>;
  return (
    <div className="w-full space-y-3 rounded-xl border border-line p-4" role="group" aria-label={title}>
      <h4 className="font-bold">{title}</h4>
      <TextInput label="Titolo" isRequired value={name} onChange={setName} />
      <div>
        <Caption>File *</Caption>
        <div className="mt-1"><FilePicker label="Scegli file…" file={file} accept={accept} onSelect={setFile} /></div>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <Button onPress={reset} className={btn.ghost}>Annulla</Button>
        <Button onPress={() => { if (file) void onUpload(file, name).then(ok => { if (ok) reset(); }); }} isDisabled={!name || !file || busy} className={btn.primary}>{busy ? 'Caricamento…' : 'Carica'}</Button>
      </div>
    </div>
  );
}

const fileLabel = (file: EventFile) => clean(file.title) || clean(file.fileName);

export function MaterialsStep({ page }: { page: EventPage }) {
  const { files, busy, upload, remove } = useEventFiles(page, FILE_TYPE.material, 'Materiale');
  const [confirmId, setConfirmId] = useState<string | null>(null);
  return (
    <Panel labelledBy="materials-title" className="p-5 sm:p-6">
      <PanelTitle id="materials-title" title="Materiali" actions={<UploadForm title="Aggiungi materiale" busy={busy} onUpload={upload} />} />
      {files.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {files.map(file => (
            <li key={file.workshopFileId} className="rounded-xl bg-[#f3f7fa] p-4">
              {confirmId === file.workshopFileId ? (
                <InlineConfirm title="Vuoi davvero eliminare questo materiale?" confirmLabel="OK" busy={busy} onConfirm={() => void remove(file).then(() => setConfirmId(null))} onCancel={() => setConfirmId(null)} />
              ) : (
                <div className="flex items-center gap-4">
                  <AdminIcon name="file" className="size-10 shrink-0 text-cyan-700" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold">{file.title}</span>
                    <span className="block text-sm text-muted">{file.fileName}</span>
                    <span className="block text-xs text-muted">Tipo file: {file.fileType}</span>
                  </span>
                  <Button onPress={() => setConfirmId(file.workshopFileId)} aria-label={`Elimina: ${fileLabel(file)}`} className={btn.icon}><AdminIcon name="trash" /></Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : <p className="py-8 text-center text-muted">Nessun materiale disponibile.</p>}
    </Panel>
  );
}

export function PhotosStep({ page }: { page: EventPage }) {
  const { files, busy, upload, remove } = useEventFiles(page, FILE_TYPE.photo, 'Foto');
  const [confirmId, setConfirmId] = useState<string | null>(null);
  return (
    <Panel labelledBy="photos-title" className="p-5 sm:p-6">
      <PanelTitle id="photos-title" title="Foto" actions={<UploadForm title="Aggiungi foto" accept={['image/*']} busy={busy} onUpload={upload} />} />
      {files.length > 0 ? (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          {files.map(file => {
            const src = contentUrl(file.fullPath);
            return (
              <li key={file.workshopFileId} className="overflow-hidden rounded-xl bg-[#f3f7fa]">
                {confirmId === file.workshopFileId ? (
                  <div className="p-3"><InlineConfirm title="Vuoi davvero eliminare questa foto?" confirmLabel="OK" busy={busy} onConfirm={() => void remove(file).then(() => setConfirmId(null))} onCancel={() => setConfirmId(null)} /></div>
                ) : (
                  <>
                    {src && <img src={src} alt={clean(file.title)} loading="lazy" className="h-48 w-full object-cover" />}
                    <div className="flex items-center gap-2 p-3">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-bold">{file.title}</span>
                        <span className="block truncate text-xs text-muted">{file.fileName}</span>
                      </span>
                      <Button onPress={() => setConfirmId(file.workshopFileId)} aria-label={`Elimina: ${fileLabel(file)}`} className={btn.icon}><AdminIcon name="trash" /></Button>
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      ) : <p className="py-8 text-center text-muted">Nessuna foto disponibile.</p>}
    </Panel>
  );
}

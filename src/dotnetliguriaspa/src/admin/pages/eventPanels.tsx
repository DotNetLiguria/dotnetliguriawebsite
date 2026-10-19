import React, { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from 'react-aria-components';
import { useOidcFetch } from '@axa-fr/react-oidc';
import { QRCodeSVG } from 'qrcode.react';
import { AdminIcon } from '../icons';
import { Badge, Panel, SwitchInput, TextAreaInput, TextInput, btn, linkFocus } from '../ui';
import { clean } from '../adminApi';
import { notify } from '../toasts';
import { contentUrl } from '../../site/siteApi';
import { createQuestionnaireAdminApi, FetchLike } from '../../questionnaire/api';
import { statusLabels } from '../../questionnaire/status';
import type { Questionnaire, QuestionnaireStatus } from '../../questionnaire/types';
import type { VenueModel } from '../../models/VenueModel';
import { useAccountCapabilities } from '../../account/AccountCapabilities';
import EventPoster from '../EventPoster';
import { ModalHeader, Notice, RecordModal } from './listUi';
import { Caption, EventPage, FilePicker, InlineConfirm, PanelTitle, SelectInput } from './eventKit';
import { EventFile, FILE_TYPE, locationFromVenue } from './eventModel';
import { canPerform, hasPermission, hasAnyPermission, RESULTS_PERMISSIONS } from '../../account/permissions';

// Steps 1 (Pubblicazione), 2 (Immagine dell'evento), 3 (Informazioni sull'evento), 4 (Sede), 9 (Materiali)
// and 10 (Foto): the previous AdminWorkshopDetail sections, texts translated literally.

// ---------- 1. Pubblicazione ----------

const questionnaireTone: Record<QuestionnaireStatus, 'warn' | 'ok' | 'done'> = { Draft: 'warn', Published: 'ok', Closed: 'done', Archived: 'done' };

/** Questionari collegati: the previous WorkshopQuestionnaires panel. */
function WorkshopQuestionnaires({ workshopId, canManage }: { workshopId: string; canManage: boolean }) {
  const { capabilities } = useAccountCapabilities();
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
      <h3 className="font-bold">Questionari collegati</h3>
      {error && <div className="mt-2"><Notice tone="danger" title={error} /></div>}
      {items && items.length === 0 && !error && <p className="mt-1 text-sm text-muted">Nessun questionario: il link di feedback mostrerà un messaggio finché non ne pubblichi uno.</p>}
      {items && items.length > 0 && (
        <ul className="mt-2 space-y-2">
          {items.map(q => (
            <li key={q.questionnaireId} className="flex flex-wrap items-center gap-3">
              <Link to={`/admin/questionnaires/${q.questionnaireId}/edit`} className={`min-w-0 flex-1 rounded font-semibold text-cyan-700 underline ${linkFocus}`}>{q.title}</Link>
              <Badge kind={questionnaireTone[q.status]}>{statusLabels[q.status]}</Badge>
              {hasAnyPermission(capabilities, RESULTS_PERMISSIONS) && <Link to={`/admin/questionnaires/${q.questionnaireId}/results`} className={`rounded text-sm font-semibold text-cyan-700 underline ${linkFocus}`}>{q.responseCount} risposte</Link>}
            </li>
          ))}
        </ul>
      )}
      <Button onPress={() => void create()} isDisabled={busy || !canManage} className={`mt-3 ${btn.secondary}`}><AdminIcon name="plus" />Crea questionario di feedback</Button>
    </div>
  );
}

export function PublicationStep({ page }: { page: EventPage }) {
  const { capabilities } = useAccountCapabilities();
  const { workshop, values, edit } = page;
  const feedbackUrl = `${window.location.origin}/feedback/${workshop.workshopId}`;
  const [publicationBusy, setPublicationBusy] = useState(false);
  const updatePublication = async (kind: 'Publication' | 'Homepage', selected: boolean) => {
    setPublicationBusy(true);
    try {
      await page.api(`/Workshop/${kind}/${encodeURIComponent(workshop.workshopId)}`, {
        method: 'PUT', body: JSON.stringify(kind === 'Publication' ? { published: selected } : { selected }),
      });
      await page.refresh();
      notify(kind === 'Publication' ? 'Pubblicazione aggiornata' : 'Homepage aggiornata');
    } catch {
      notify('Modifica non autorizzata o non completata. Ricarica i permessi e l’evento prima di riprovare.', { kind: 'error' });
    } finally { setPublicationBusy(false); }
  };
  return (
    <Panel labelledBy="publication-title" className="grid items-start gap-6 p-5 md:grid-cols-[5fr_7fr] sm:p-6">
      <div>
        <PanelTitle id="publication-title" title="Impostazioni di pubblicazione" />
        <div className="mt-3 space-y-2">
          <SwitchInput isDisabled={publicationBusy || !canPerform(capabilities, 'events.publish', workshop)} isSelected={workshop.published === true} onChange={published => void updatePublication('Publication', published)}>Pubblicato</SwitchInput>
          <SwitchInput isDisabled={publicationBusy || !canPerform(capabilities, 'events.homepage.manage', workshop)} isSelected={workshop.in_homepage === true} onChange={selected => void updatePublication('Homepage', selected)}>Mostra in homepage</SwitchInput>
          <SwitchInput isDisabled={!canPerform(capabilities, 'questionnaires.publish', workshop) || !canPerform(capabilities, 'events.manage', workshop)} isSelected={values.feedbackEnabled} onChange={feedbackEnabled => edit({ feedbackEnabled })}>Feedback abilitato</SwitchInput>
        </div>
      </div>
      <div className="flex flex-col items-center text-center">
        <h2 className="text-lg font-bold">QR code del feedback</h2>
        <div className="mt-3 rounded-xl border border-line bg-white p-3"><QRCodeSVG value={feedbackUrl} size={150} level="H" /></div>
        <p className="mt-2 break-all text-sm text-muted">{feedbackUrl}</p>
        {hasPermission(capabilities, 'questionnaires.read') && <WorkshopQuestionnaires workshopId={workshop.workshopId} canManage={canPerform(capabilities, 'questionnaires.manage', workshop)} />}
      </div>
    </Panel>
  );
}

// ---------- 2. Immagine dell'evento ----------

/** The current image (only when there is one) and the file button that uploads at once, as before. */
export function ImageStep({ page, stamp, onUploaded }: { page: EventPage; stamp: number; onUploaded: () => void }) {
  const { workshop } = page;
  const [uploaded, setUploaded] = useState<File | null>(null);
  const captionId = useId();
  const poster = contentUrl(workshop.image);
  const upload = async (file: File) => {
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('workshopId', workshop.workshopId);
      await page.api('/workshopfile/uploadworkshopimage', { method: 'POST', body: form });
      if (await page.refresh()) onUploaded();
      notify("Immagine dell'evento caricata correttamente");
      setUploaded(file);
    } catch {
      notify("Errore nel caricamento dell'immagine dell'evento", { kind: 'error' });
    }
  };
  return (
    <Panel labelledBy="image-title" className="space-y-4 p-5 sm:p-6">
      <PanelTitle id="image-title" title="Immagine dell'evento" />
      {workshop.image && (
        <div>
          <Caption>Immagine attuale</Caption>
          <EventPoster src={poster && stamp ? `${poster}?t=${stamp}` : poster} alt={clean(workshop.title)} className="mt-1 aspect-video w-full max-w-md rounded-xl border border-line object-cover" />
        </div>
      )}
      <div>
        <Caption id={captionId}>Carica l'immagine di copertina dell'evento</Caption>
        <div className="mt-1"><FilePicker label="Scegli il file immagine…" file={uploaded} accept={['image/*']} describedBy={captionId} onSelect={file => void upload(file)} /></div>
      </div>
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

/** The venues load with the page and the chosen one stays selected across the steps, as before. */
export function LocationStep({ page, venues, venueId, onVenue }: { page: EventPage; venues: VenueModel[]; venueId: string | null; onVenue: (venueId: string) => void }) {
  const { values, edit } = page;
  const copyVenue = (id: string | null) => {
    const venue = venues.find(item => item.venueId === id);
    if (!venue) return;
    onVenue(venue.venueId);
    const location = locationFromVenue(venue);
    edit({ locationName: location.name ?? '', address: location.address ?? '', coordinates: location.coordinates ?? '', googleMapsUrl: location.googleMapsUrl ?? '', maximumSpaces: String(location.maximumSpaces ?? 0) });
  };
  return (
    <Panel labelledBy="location-title" className="space-y-4 p-5 sm:p-6">
      <PanelTitle id="location-title" title="Informazioni sulla sede" />
      <div>
        <SelectInput label="Copia dalla sede" items={venues.map(venue => ({ id: venue.venueId, label: clean(venue.name) }))} selectedKey={venueId} onSelectionChange={copyVenue} placeholder="" isDisabled={venues.length === 0} />
        {venues.length === 0 && <p className="mt-1.5 text-sm text-muted">Nessuna sede disponibile da copiare.</p>}
      </div>
      <TextInput label="Nome" isRequired value={values.locationName} onChange={locationName => edit({ locationName })} placeholder="Nome della sede" />
      <TextInput label="Coordinate" value={values.coordinates} onChange={coordinates => edit({ coordinates })} placeholder="Latitudine, longitudine" />
      <TextInput label="Indirizzo" isRequired value={values.address} onChange={address => edit({ address })} />
      <TextInput label="URL di Google Maps" type="url" value={values.googleMapsUrl} onChange={googleMapsUrl => edit({ googleMapsUrl })} placeholder="https://maps.google.com/..." />
      <TextInput label="Posti massimi" type="number" value={values.maximumSpaces} onChange={maximumSpaces => edit({ maximumSpaces })} />
    </Panel>
  );
}

// ---------- 9. Materiali and 10. Foto ----------

const FILE_TEXT = {
  material: {
    dialog: 'Aggiungi materiale', placeholder: 'Titolo del materiale', confirm: 'Vuoi davvero eliminare questo materiale?',
    uploaded: 'Materiale caricato correttamente', uploadFailed: 'Errore nel caricamento del materiale',
    deleted: 'Materiale eliminato correttamente', deleteFailed: "Errore nell'eliminazione del materiale",
  },
  photo: {
    dialog: 'Aggiungi foto', placeholder: 'Titolo della foto', confirm: 'Vuoi davvero eliminare questa foto?',
    uploaded: 'Foto caricata correttamente', uploadFailed: 'Errore nel caricamento della foto',
    deleted: 'Foto eliminata correttamente', deleteFailed: "Errore nell'eliminazione della foto",
  },
} as const;
type FileKind = keyof typeof FILE_TEXT;

/** Files of the event from the file endpoint (materials are type 4, photos type 2), with upload and delete. */
function useEventFiles(page: EventPage, kind: FileKind) {
  const { workshop, api } = page;
  const fileType = kind === 'material' ? FILE_TYPE.material : FILE_TYPE.photo;
  const text = FILE_TEXT[kind];
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
      notify(text.uploaded);
      return true;
    } catch {
      notify(text.uploadFailed, { kind: 'error' });
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
      notify(text.deleted);
      return true;
    } catch {
      notify(text.deleteFailed, { kind: 'error' });
      return false;
    } finally {
      setBusy(false);
    }
  };

  return { files, busy, upload, remove };
}

/** The previous "Add" button and dialog (full page on phones): a title and a file, both required, then Carica. */
function AddFileDialog({ kind, accept, busy, onUpload }: { kind: FileKind; accept?: string[]; busy: boolean; onUpload: (file: File, title: string) => Promise<boolean> }) {
  const text = FILE_TEXT[kind];
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const captionId = useId();
  const close = () => { setOpen(false); setTitle(''); setFile(null); };
  return (
    <>
      <Button onPress={() => setOpen(true)} className={btn.primary}><AdminIcon name="plus" />Aggiungi</Button>
      <RecordModal isOpen={open} onOpenChange={value => { if (!value) close(); }} label={text.dialog}>
        <ModalHeader title={text.dialog} />
        <div className="space-y-4 p-5 sm:p-6">
          <TextInput label="Titolo" isRequired autoFocus value={title} onChange={setTitle} placeholder={text.placeholder} />
          <div>
            <Caption id={captionId}>File *</Caption>
            <div className="mt-1"><FilePicker label="Scegli file…" file={file} accept={accept} describedBy={captionId} onSelect={setFile} /></div>
          </div>
          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <Button onPress={close} className={btn.ghost}>Annulla</Button>
            <Button onPress={() => { if (file) void onUpload(file, title).then(ok => { if (ok) close(); }); }} isDisabled={!title || !file || busy} className={btn.primary}>{busy ? 'Caricamento…' : 'Carica'}</Button>
          </div>
        </div>
      </RecordModal>
    </>
  );
}

const fileLabel = (file: EventFile) => clean(file.title) || clean(file.fileName);

export function MaterialsStep({ page }: { page: EventPage }) {
  const { capabilities } = useAccountCapabilities();
  const { files, busy, upload, remove } = useEventFiles(page, 'material');
  const [confirmId, setConfirmId] = useState<string | null>(null);
  return (
    <Panel labelledBy="materials-title" className="p-5 sm:p-6">
      <PanelTitle id="materials-title" title="Materiali" actions={canPerform(capabilities, 'event-assets.manage', page.workshop) ? <AddFileDialog kind="material" busy={busy} onUpload={upload} /> : undefined} />
      {files.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {files.map(file => (
            <li key={file.workshopFileId} className="rounded-xl bg-[#f3f7fa] p-4">
              {confirmId === file.workshopFileId ? (
                <InlineConfirm title={FILE_TEXT.material.confirm} confirmLabel="OK" busy={busy} onConfirm={() => void remove(file).then(() => setConfirmId(null))} onCancel={() => setConfirmId(null)} />
              ) : (
                <div className="flex items-center gap-4">
                  <AdminIcon name="file" className="size-10 shrink-0 text-cyan-700" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold">{file.title}</span>
                    <span className="block text-sm text-muted">{file.fileName}</span>
                    <span className="block text-xs text-muted">Tipo file: {file.fileType}</span>
                  </span>
                  <Button isDisabled={!canPerform(capabilities, 'event-assets.delete', page.workshop)} onPress={() => setConfirmId(file.workshopFileId)} aria-label={`Elimina: ${fileLabel(file)}`} className={btn.icon}><AdminIcon name="trash" /></Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : <p className="py-8 text-center text-muted">Nessun materiale disponibile.</p>}
    </Panel>
  );
}

/** A photo, or the previous "Image not found" placeholder when it is missing or does not load. */
function PhotoImage({ src, title }: { src: string | null; title: string }) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  if (!src || src === failedSource) {
    return <div role="img" aria-label="Immagine non trovata" className="grid h-48 w-full place-items-center bg-[#dddddd] font-mono text-[#666666]">Immagine non trovata</div>;
  }
  return <img src={src} alt={title} loading="lazy" onError={() => setFailedSource(src)} className="h-48 w-full object-cover" />;
}

export function PhotosStep({ page }: { page: EventPage }) {
  const { capabilities } = useAccountCapabilities();
  const { files, busy, upload, remove } = useEventFiles(page, 'photo');
  const [confirmId, setConfirmId] = useState<string | null>(null);
  return (
    <Panel labelledBy="photos-title" className="p-5 sm:p-6">
      <PanelTitle id="photos-title" title="Foto" actions={canPerform(capabilities, 'event-assets.manage', page.workshop) ? <AddFileDialog kind="photo" accept={['image/*']} busy={busy} onUpload={upload} /> : undefined} />
      {files.length > 0 ? (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          {files.map(file => (
            <li key={file.workshopFileId} className="overflow-hidden rounded-xl bg-[#f3f7fa]">
              {confirmId === file.workshopFileId ? (
                <div className="p-3"><InlineConfirm title={FILE_TEXT.photo.confirm} confirmLabel="OK" busy={busy} onConfirm={() => void remove(file).then(() => setConfirmId(null))} onCancel={() => setConfirmId(null)} /></div>
              ) : (
                <>
                  <PhotoImage src={contentUrl(file.fullPath)} title={clean(file.title)} />
                  <div className="flex items-center gap-2 p-3">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-bold">{file.title}</span>
                      <span className="block truncate text-xs text-muted">{file.fileName}</span>
                    </span>
                    <Button isDisabled={!canPerform(capabilities, 'event-assets.delete', page.workshop)} onPress={() => setConfirmId(file.workshopFileId)} aria-label={`Elimina: ${fileLabel(file)}`} className={btn.icon}><AdminIcon name="trash" /></Button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      ) : <p className="py-8 text-center text-muted">Nessuna foto disponibile.</p>}
    </Panel>
  );
}

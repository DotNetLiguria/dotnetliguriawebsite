import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from 'react-aria-components';
import { useOidcFetch } from '@axa-fr/react-oidc';
import { QRCodeSVG } from 'qrcode.react';
import { AdminIcon } from '../icons';
import { Avatar, Badge, EmptyState, LoadError, Panel, SwitchInput, TextInput, btn, linkFocus } from '../ui';
import { AdminLoad, AdminSpeaker, clean, useSpeakerPhotos } from '../adminApi';
import { notify } from '../toasts';
import { contentUrl } from '../../site/siteApi';
import { dayKey, formatDate } from '../../site/format';
import { programme, sessionCount, sessionsLabel } from '../../site/event/programme';
import { createQuestionnaireAdminApi, FetchLike } from '../../questionnaire/api';
import { formatDateTime } from '../../questionnaire/format';
import { statusLabels } from '../../questionnaire/status';
import type { Questionnaire, QuestionnaireStatus } from '../../questionnaire/types';
import { ExternalLink, Notice, Skeleton, plural } from './listUi';
import { CardForm, CheckRow, Dropzone, EditCard, EventIcon, EventPage, Facts, InlineConfirm, Missing, SwitchRow, errorText } from './eventKit';
import {
  EventFile, EventRecord, FILE_TYPE, IMAGE_EXTENSIONS, MATERIAL_EXTENSIONS, eventSpeakers, eventbriteIssues, eventbriteStatusLabel,
  hasAllowedExtension, registrationOf, salesWindowProblem,
} from './eventModel';

// The remaining tabs of the event card: speakers, files, questionnaire and publication (site + Eventbrite).

// ---------- Relatori ----------

export function SpeakersPanel({ page }: { page: EventPage }) {
  const entries = useMemo(() => eventSpeakers(page.workshop, page.speakers), [page.workshop, page.speakers]);
  const matched = useMemo(() => entries.flatMap(entry => (entry.speaker ? [entry.speaker as AdminSpeaker] : [])), [entries]);
  const photos = useSpeakerPhotos(matched);
  return (
    <Panel className="overflow-hidden">
      {entries.length ? (
        <ul className="divide-y divide-line" aria-label="Relatori dell'evento">
          {entries.map(entry => {
            const photo = entry.speaker ? photos?.get(entry.speaker.workshopSpeakerId) : null;
            const body = (
              <>
                <Avatar name={entry.name} src={photo} />
                <span className="min-w-0 flex-1">
                  <span className="block font-bold">{entry.name}</span>
                  <span className="block text-sm text-muted">{plural(entry.sessions, 'sessione', 'sessioni')} in questo evento</span>
                </span>
                <span className="flex flex-col items-end gap-1">
                  {!entry.speaker && <Badge kind="warn">Non in anagrafica</Badge>}
                  {entry.speaker && photo === null && <Badge kind="warn">Senza foto</Badge>}
                </span>
              </>
            );
            return (
              <li key={entry.key}>
                {entry.speaker
                  ? <Link to={`/admin/speakers/${entry.speaker.workshopSpeakerId}`} className={`flex items-center gap-3 px-4 py-3 transition-colors hover:bg-cyan-50/60 sm:px-5 ${linkFocus}`}>{body}</Link>
                  : <div className="flex items-center gap-3 px-4 py-3 sm:px-5">{body}</div>}
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState icon="mic" title="Nessun relatore" actions={<Link to={page.tabHref('agenda')} className={btn.secondary}>Vai all'agenda</Link>}>
          <p>I relatori compaiono quando li assegni ai talk dell'agenda.</p>
        </EmptyState>
      )}
    </Panel>
  );
}

// ---------- Materiali e foto ----------

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
          {href && <ExternalLink href={href} className={`${btn.icon}`}><span className="sr-only">Apri {title}</span></ExternalLink>}
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

export function FilesPanel({ page }: { page: EventPage }) {
  const { workshop, api } = page;
  const [load, setLoad] = useState<AdminLoad<EventFile[]>>({ state: 'loading' });
  const [busy, setBusy] = useState<'material' | 'photo' | 'delete' | null>(null);
  const [materialTitle, setMaterialTitle] = useState('');

  const fetchFiles = useCallback(async () => {
    try {
      setLoad({ state: 'ready', data: await api<EventFile[]>(`/workshopfile/${encodeURIComponent(workshop.workshopId)}`) });
    } catch (error) {
      setLoad({ state: 'error', message: errorText(error) });
    }
  }, [api, workshop.workshopId]);
  useEffect(() => { void fetchFiles(); }, [fetchFiles]);

  const files = load.state === 'ready' ? load.data : [];
  const materials = files.filter(file => file.fileType === FILE_TYPE.material);
  const photos = files.filter(file => file.fileType === FILE_TYPE.photo);

  const upload = async (kind: 'material' | 'photo', chosen: File[]) => {
    const allowed = kind === 'material' ? MATERIAL_EXTENSIONS : IMAGE_EXTENSIONS;
    const rejected = chosen.filter(file => !hasAllowedExtension(file.name, allowed)).map(file => file.name);
    const accepted = chosen.filter(file => hasAllowedExtension(file.name, allowed));
    const failed: string[] = [];
    setBusy(kind);
    for (const file of accepted) {
      const form = new FormData();
      form.append('file', file);
      form.append('workshopId', workshop.workshopId);
      form.append('fileType', String(kind === 'material' ? FILE_TYPE.material : FILE_TYPE.photo));
      form.append('title', kind === 'material' ? clean(materialTitle) : '');
      try {
        await api('/workshopfile/Upload', { method: 'POST', body: form });
      } catch (error) {
        failed.push(`${file.name} (${errorText(error)})`);
      }
    }
    setBusy(null);
    const saved = accepted.length - failed.length;
    if (saved) {
      setMaterialTitle('');
      await fetchFiles();
      await page.reload();
    }
    const problems = [...rejected.map(name => `${name}: formato non ammesso`), ...failed];
    if (saved && !problems.length) notify(kind === 'material' ? plural(saved, 'file caricato', 'file caricati') : plural(saved, 'foto caricata', 'foto caricate'));
    else if (saved) notify(plural(saved, 'file caricato', 'file caricati'), { description: `Non caricati: ${problems.join('; ')}.` });
    else notify('Caricamento non riuscito', { description: problems.join('; ') || 'Nessun file scelto.', kind: 'error' });
  };

  const remove = async (file: EventFile) => {
    setBusy('delete');
    try {
      await api(`/workshopfile/${encodeURIComponent(file.workshopFileId)}`, { method: 'DELETE' });
      setLoad(current => (current.state === 'ready' ? { state: 'ready', data: current.data.filter(item => item.workshopFileId !== file.workshopFileId) } : current));
      notify('File eliminato', { description: clean(file.title) || clean(file.fileName) });
      await page.reload();
    } catch (error) {
      notify('Eliminazione non riuscita', { description: errorText(error), kind: 'error' });
    } finally {
      setBusy(null);
    }
  };

  if (load.state === 'error') return <LoadError message={`Materiali e foto non sono disponibili (${load.message}).`} onRetry={() => { setLoad({ state: 'loading' }); void fetchFiles(); }} />;
  if (load.state === 'loading') return <Skeleton className="h-72" />;

  return (
    <div className="grid items-start gap-5 xl:grid-cols-2">
      <Panel labelledBy="materials-title">
        <div className="p-5">
          <h3 id="materials-title" className="text-lg font-bold">Slide e materiali</h3>
          <p className="text-sm text-muted">{materials.length ? plural(materials.length, 'file', 'file') : 'Ancora nessun file: chi ha partecipato li cerca qui.'}</p>
          <div className="mt-4 space-y-3">
            <TextInput label="Titolo del materiale" value={materialTitle} onChange={setMaterialTitle} placeholder="Per esempio: slide del talk su Blazor" description="Facoltativo: se vuoto, usa il nome del file." />
            <Dropzone label="Trascina qui slide e materiali" hint="PDF, DOCX, PPTX o XLSX" accept={MATERIAL_EXTENSIONS} multiple busy={busy === 'material'} onFiles={files => void upload('material', files)} />
          </div>
        </div>
        {materials.length > 0 && (
          <ul className="divide-y divide-line border-t border-line" aria-label="Materiali">
            {materials.map(file => <FileRow key={file.workshopFileId} file={file} busy={busy === 'delete'} onDelete={() => remove(file)} />)}
          </ul>
        )}
      </Panel>
      <Panel labelledBy="photos-title">
        <div className="p-5">
          <h3 id="photos-title" className="text-lg font-bold">Foto dell'evento</h3>
          <p className="text-sm text-muted">{photos.length ? plural(photos.length, 'foto', 'foto') : 'Ancora nessuna foto.'}</p>
          <div className="mt-4">
            <Dropzone label="Trascina qui le foto" hint="JPG, PNG, WebP o GIF" accept={IMAGE_EXTENSIONS} multiple busy={busy === 'photo'} onFiles={files => void upload('photo', files)} />
          </div>
        </div>
        {photos.length > 0 && (
          <ul className="grid gap-3 border-t border-line p-5 sm:grid-cols-2" aria-label="Foto">
            {photos.map(file => <PhotoCard key={file.workshopFileId} file={file} busy={busy === 'delete'} onDelete={() => remove(file)} />)}
          </ul>
        )}
      </Panel>
    </div>
  );
}

// ---------- Questionario ----------

const questionnaireTone: Partial<Record<QuestionnaireStatus, 'warn' | 'done'>> = { Draft: 'warn', Closed: 'done', Archived: 'done' };

export function QuestionnairePanel({ page }: { page: EventPage }) {
  const { workshop } = page;
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
      notify('Questionario creato', { description: created.title });
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
    <div className="grid items-start gap-5 xl:grid-cols-2">
      <Panel labelledBy="feedback-title" className="p-5">
        <h3 id="feedback-title" className="text-lg font-bold">Link e QR code del feedback</h3>
        <p className="text-sm text-muted">Chi partecipa lo apre dal QR code in sala o dal link sulla pagina dell'evento; le risposte arrivano nel questionario collegato.</p>
        <div className="mt-4 flex flex-wrap items-start gap-5">
          <div className="rounded-xl border border-line bg-white p-3"><QRCodeSVG value={feedbackUrl} size={160} level="H" title={`QR code del feedback di ${clean(workshop.title)}`} /></div>
          <div className="min-w-0 flex-1 space-y-3">
            <p className="break-all font-semibold">{feedbackUrl}</p>
            <Button onPress={() => void copyLink()} className={btn.secondary}><EventIcon name="copy" />Copia il link</Button>
            <SwitchInput isSelected={!!workshop.feedbackEnabled} onChange={value => void page.toggleFlag('feedbackEnabled', value)}>Feedback aperto</SwitchInput>
          </div>
        </div>
      </Panel>
      <Panel labelledBy="questionnaires-title">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <h3 id="questionnaires-title" className="text-lg font-bold">Questionari collegati</h3>
          <Button onPress={() => void create()} isDisabled={busy} className={btn.primary}><AdminIcon name="plus" />{busy ? 'Creazione…' : 'Crea questionario di feedback'}</Button>
        </div>
        {error && <div className="px-5 pb-4"><Notice tone="danger" title="Questionari non disponibili">{error}</Notice></div>}
        {items === null && !error && <p role="status" className="px-5 pb-5 text-muted">Caricamento dei questionari…</p>}
        {items && items.length === 0 && !error && <p className="px-5 pb-5 text-muted">Nessun questionario: il link di feedback mostrerà un messaggio finché non ne pubblichi uno.</p>}
        {items && items.length > 0 && (
          <ul className="divide-y divide-line border-t border-line">
            {items.map(q => (
              <li key={q.questionnaireId} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <Link to={`/admin/questionnaires/${q.questionnaireId}/edit`} className={`min-w-0 flex-1 rounded font-bold hover:underline ${linkFocus}`}>{q.title}</Link>
                {questionnaireTone[q.status] && <Badge kind={questionnaireTone[q.status]!}>{statusLabels[q.status]}</Badge>}
                <Link to={`/admin/questionnaires/${q.questionnaireId}/results`} className={`rounded text-sm font-semibold text-cyan-700 underline ${linkFocus}`}>{plural(q.responseCount, 'risposta', 'risposte')}</Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

// ---------- Pubblicazione ----------

interface TicketSales { totalCapacity: number; sold: number; pending: number; remaining: number; refreshedAt: string }

function EventbriteForm({ page, sales, onDone }: { page: EventPage; sales: TicketSales | null; onDone: () => void }) {
  const { workshop } = page;
  const synced = workshop.eventbriteSyncedTicketCapacity ?? 0;
  const minimum = Math.max(synced, (sales?.sold ?? 0) + (sales?.pending ?? 0));
  const [capacity, setCapacity] = useState(String(workshop.eventbriteTicketCapacity ?? 0));
  const [start, setStart] = useState(workshop.eventbriteSalesStart ?? '');
  const [end, setEnd] = useState(workshop.eventbriteSalesEnd ?? '');
  const [problem, setProblem] = useState<string | null>(null);
  const save = async () => {
    const windowProblem = salesWindowProblem(start, end);
    if (windowProblem) {
      setProblem(windowProblem);
      return false;
    }
    const body: EventRecord = { ...workshop, eventbriteTicketCapacity: Math.max(0, Number.parseInt(capacity, 10) || 0), eventbriteSalesStart: start, eventbriteSalesEnd: end };
    const ok = await page.save(body, { title: 'Evento aggiornato', description: 'Biglietti Eventbrite' });
    if (ok) onDone();
    return ok;
  };
  return (
    <CardForm onSave={save} onCancel={onDone}>
      <TextInput label="Biglietti gratuiti disponibili" type="number" autoFocus value={capacity} onChange={setCapacity} description={`Separati dai posti della sede. Aumenta il numero per liberare altri biglietti; totale già sincronizzato: ${synced}.`} validate={value => (/^\d+$/.test(clean(value)) && Number(value) >= minimum ? null : `Indica un numero intero di biglietti, almeno ${minimum}.`)} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput label="Inizio vendite" type="datetime-local" value={start} onChange={value => { setStart(value); setProblem(null); }} description="Facoltativo, nel fuso orario configurato su Eventbrite." />
        <TextInput label="Fine vendite" type="datetime-local" value={end} onChange={value => { setEnd(value); setProblem(null); }} description="Facoltativo." />
      </div>
      {problem && <p role="alert" className="text-sm font-semibold text-[#b42318]">{problem}</p>}
    </CardForm>
  );
}

function EventbriteCard({ page }: { page: EventPage }) {
  const { workshop, api } = page;
  const [sales, setSales] = useState<TicketSales | null>(null);
  const [busy, setBusy] = useState<'sales' | 'capacity' | 'sync' | 'publish' | null>(null);
  const [confirmPublish, setConfirmPublish] = useState(false);
  const issues = eventbriteIssues(workshop);
  const id = encodeURIComponent(workshop.workshopId);
  const capacity = workshop.eventbriteTicketCapacity ?? 0;
  const synced = workshop.eventbriteSyncedTicketCapacity ?? 0;
  const hasEvent = !!workshop.eventbriteEventId;

  const run = async (kind: NonNullable<typeof busy>, action: () => Promise<void>, failure: string) => {
    setBusy(kind);
    try {
      await action();
    } catch (error) {
      notify(failure, { description: errorText(error), kind: 'error' });
    } finally {
      setBusy(null);
    }
  };
  const refreshSales = () => run('sales', async () => {
    setSales(await api<TicketSales>(`/Eventbrite/TicketSales/${id}`));
    notify('Vendite aggiornate', { description: 'Dati letti ora da Eventbrite.' });
  }, 'Vendite non disponibili');
  const applyCapacity = () => run('capacity', async () => {
    page.replace(await api<EventRecord>(`/Eventbrite/SetTicketCapacity/${id}`, { method: 'PUT', body: JSON.stringify({ capacity }) }));
    notify('Capienza salvata', { description: 'Sincronizza con Eventbrite per applicarla.' });
  }, 'Capienza non aggiornata');
  const sync = () => run('sync', async () => {
    const updated = await api<EventRecord>(`/Eventbrite/Sync/${id}`, { method: 'POST' });
    page.replace(updated);
    if (updated.eventbriteEventId) notify('Evento sincronizzato con Eventbrite');
    else notify('Evento salvato', { description: 'Aggiungi sede, agenda e biglietti iniziali prima che Eventbrite possa creare la bozza.' });
  }, 'Sincronizzazione con Eventbrite non riuscita');
  const publish = () => run('publish', async () => {
    await api(`/Eventbrite/Publish/${id}`, { method: 'POST' });
    await page.reload();
    setConfirmPublish(false);
    notify('Pubblicato su Eventbrite');
  }, 'Pubblicazione su Eventbrite non riuscita');

  const salesWindow = workshop.eventbriteSalesStart || workshop.eventbriteSalesEnd
    ? [workshop.eventbriteSalesStart ? `dal ${formatDateTime(workshop.eventbriteSalesStart)}` : null, workshop.eventbriteSalesEnd ? `al ${formatDateTime(workshop.eventbriteSalesEnd)}` : null].filter(Boolean).join(' ')
    : null;

  return (
    <EditCard id="eventbrite" title="Eventbrite" form={close => <EventbriteForm page={page} sales={sales} onDone={close} />}>
      <Facts items={[
        ['Stato', <span key="status" className="flex flex-wrap items-center gap-2">{eventbriteStatusLabel(workshop)}{workshop.eventbritePublished && <Badge kind="ok">Pubblicato su Eventbrite</Badge>}</span>],
        ['Biglietti gratuiti', hasEvent ? `${capacity} (sincronizzati: ${synced})` : capacity > 0 ? String(capacity) : <Missing>Nessuno: indica quanti biglietti liberare.</Missing>],
        ['Vendite', salesWindow ?? <Missing>Finestra non impostata: decide Eventbrite.</Missing>],
        ...(workshop.eventbriteLastSyncedAt ? [['Ultima sincronizzazione', formatDateTime(workshop.eventbriteLastSyncedAt)] as [string, React.ReactNode]] : []),
        ...(workshop.eventbriteEventUrl ? [['Evento', <ExternalLink key="url" href={workshop.eventbriteEventUrl}>Apri su Eventbrite</ExternalLink>] as [string, React.ReactNode]] : []),
      ]} />
      <div className="mt-4 space-y-3">
        {workshop.eventbriteLastError && <Notice tone="danger" title="Ultimo errore Eventbrite">{workshop.eventbriteLastError}</Notice>}
        {sales && (
          <Notice tone="ok" title="Biglietti Eventbrite">
            Venduti {sales.sold}, in sospeso {sales.pending}, capienza {sales.totalCapacity}, disponibili {sales.remaining}. Aggiornato: {formatDateTime(sales.refreshedAt)}.
          </Notice>
        )}
        {issues.length > 0 && (
          <Notice tone="warn" title={hasEvent ? 'Prima di sincronizzare servono:' : 'Prima di creare la bozza su Eventbrite servono:'}>
            <ul className="mt-1 list-disc pl-5">{issues.map(issue => <li key={issue}>{issue}</li>)}</ul>
          </Notice>
        )}
        {confirmPublish ? (
          <InlineConfirm title="Pubblicare l'evento su Eventbrite?" confirmLabel="Pubblica" busyLabel="Pubblicazione…" busy={busy === 'publish'} onConfirm={() => void publish()} onCancel={() => setConfirmPublish(false)}>
            <p>È separato dalla pubblicazione sul sito: l'evento diventa visibile e prenotabile su Eventbrite.</p>
          </InlineConfirm>
        ) : (
          <div className="flex flex-wrap gap-2">
            {hasEvent && <Button onPress={() => void refreshSales()} isDisabled={busy !== null} className={btn.ghost}><EventIcon name="refresh" />{busy === 'sales' ? 'Aggiornamento…' : 'Aggiorna le vendite'}</Button>}
            {hasEvent && capacity > synced && <Button onPress={() => void applyCapacity()} isDisabled={busy !== null} className={btn.secondary}><EventIcon name="ticket" />{busy === 'capacity' ? 'Salvataggio…' : 'Applica la capienza su Eventbrite'}</Button>}
            <Button onPress={() => void sync()} isDisabled={busy !== null || issues.length > 0} className={hasEvent ? btn.secondary : btn.primary}>
              {busy === 'sync' ? 'Sincronizzazione…' : hasEvent ? 'Sincronizza con Eventbrite' : 'Crea la bozza su Eventbrite'}
            </Button>
            {hasEvent && !workshop.eventbritePublished && <Button onPress={() => setConfirmPublish(true)} isDisabled={busy !== null} className={btn.primary}>Pubblica su Eventbrite…</Button>}
          </div>
        )}
      </div>
    </EditCard>
  );
}

export function PublishPanel({ page }: { page: EventPage }) {
  const { workshop } = page;
  const sessions = sessionCount(programme(workshop));
  const done = dayKey(workshop.eventDate) < dayKey(new Date().toISOString());
  const place = clean(workshop.location?.name);
  const registration = registrationOf(workshop);
  const fix = (tab: string, label: string) => <Link to={page.tabHref(tab)} className={btn.ghost}>{label}</Link>;
  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <Panel labelledBy="ready-title">
        <h3 id="ready-title" className="px-5 pt-4 text-lg font-bold">Pronto per il sito?</h3>
        <ul className="divide-y divide-line px-5">
          <CheckRow done={!!clean(workshop.description)} title="Descrizione" detail={clean(workshop.description) ? 'Presente' : 'Manca la descrizione: compare nella scheda e nella home.'} action={clean(workshop.description) ? undefined : fix('panoramica', 'Scrivi')} />
          <CheckRow done={!!place} title="Data e sede" detail={place ? `${formatDate(workshop.eventDate)} · ${place}` : 'Manca la sede.'} action={place ? undefined : fix('panoramica', 'Scegli la sede')} />
          <CheckRow done={sessions > 0} title="Agenda" detail={sessions ? sessionsLabel(sessions) : 'Nessuna sessione: importa i talk da Sessionize o aggiungili.'} action={sessions ? undefined : fix('agenda', "Prepara l'agenda")} />
          <CheckRow done={!!workshop.image} title="Locandina" detail={workshop.image ? 'Caricata' : 'Manca la locandina.'} action={workshop.image ? undefined : fix('panoramica', 'Carica')} />
          <CheckRow done={!!registration || done} title="Iscrizione" detail={registration ? 'Link di prenotazione presente' : done ? 'Non serve: evento concluso' : 'Manca il link di prenotazione.'} action={registration || done ? undefined : fix('panoramica', 'Aggiungi il link')} />
        </ul>
      </Panel>
      <Panel labelledBy="visibility-title">
        <h3 id="visibility-title" className="px-5 pt-4 text-lg font-bold">Visibilità</h3>
        <ul className="divide-y divide-line px-5 pb-2">
          <SwitchRow title="Pubblicato" hint="Visibile nell'archivio e sulla sua pagina.">
            <SwitchInput isSelected={workshop.published !== false} onChange={value => void page.toggleFlag('published', value)}><span className="sr-only">Pubblicato</span></SwitchInput>
          </SwitchRow>
          <SwitchRow title="In evidenza nella home" hint="Compare in apertura della home; un solo evento alla volta.">
            <SwitchInput isSelected={!!workshop.in_homepage} onChange={value => void page.toggleFlag('in_homepage', value)}><span className="sr-only">In evidenza nella home</span></SwitchInput>
          </SwitchRow>
          <SwitchRow title="Feedback aperto" hint="Il questionario accetta risposte.">
            <SwitchInput isSelected={!!workshop.feedbackEnabled} onChange={value => void page.toggleFlag('feedbackEnabled', value)}><span className="sr-only">Feedback aperto</span></SwitchInput>
          </SwitchRow>
        </ul>
      </Panel>
      <div className="xl:col-span-2"><EventbriteCard page={page} /></div>
    </div>
  );
}

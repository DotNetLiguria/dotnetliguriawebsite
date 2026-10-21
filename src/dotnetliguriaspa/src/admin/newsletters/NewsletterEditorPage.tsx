import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Form } from 'react-aria-components';
import { useAccountCapabilities } from '../../account/AccountCapabilities';
import { hasPermission } from '../../account/permissions';
import { useAdminFetch, useAdminLoad } from '../adminApi';
import { Badge, btn, LoadError, PageHeader, Panel, TextInput } from '../ui';
import { notify } from '../toasts';
import type { Attempt, Confirmation, Newsletter, NewsletterConfig, NewsletterEvent, NewsletterKind, NewsletterPreview, NewsletterTemplate, RenderedPreview } from './types';
import { downloadEml, isSingleMailbox, jsonPost, newsletterError, useNewsletterBinary } from './newsletterApi';
import { ConfirmDialog, editorInput, EventCombobox, MarkdownEditor, useUnsavedChanges } from './editorUi';
import ServerPreview from './ServerPreview';

type Draft = { title: string; subject: string; markdown: string };
const draftOf = (value?: Newsletter): Draft => ({ title: value?.title ?? '', subject: value?.subject ?? '', markdown: value?.markdown ?? '' });
const sameDraft = (a: Draft, b: Draft) => a.title === b.title && a.subject === b.subject && a.markdown === b.markdown;
const pathOf = (id: string) => `/newsletters/${encodeURIComponent(id)}`;
const frozen = (value: Newsletter) => value.archived || ['accepted', 'unknown', 'submitting', 'pending'].includes(value.productionStatus);

export default function NewsletterEditorPage() {
  const { id } = useParams();
  const { capabilities } = useAccountCapabilities();
  const read = hasPermission(capabilities, 'newsletters.read');
  if (!read) return <p role="alert">Non disponi del permesso per leggere le newsletter.</p>;
  return <NewsletterEditor key={id ?? 'new'} id={id} manage={hasPermission(capabilities, 'newsletters.manage')} send={hasPermission(capabilities, 'newsletters.send')} />;
}

function NewsletterEditor({ id, manage, send }: { id?: string; manage: boolean; send: boolean }) {
  const api = useAdminFetch();
  const binary = useNewsletterBinary();
  const navigate = useNavigate();
  const [record, setRecord] = useState<Newsletter | null>(null);
  const [draft, setDraft] = useState<Draft>(() => draftOf());
  const [kind, setKind] = useState<NewsletterKind>('generic');
  const [templateId, setTemplateId] = useState('');
  const [eventId, setEventId] = useState('');
  const [recipient, setRecipient] = useState('');
  const recipientEdited = useRef(false);
  const [preview, setPreview] = useState<NewsletterPreview | null>(null);
  const [previewUsable, setPreviewUsable] = useState(false);
  const [testedSnapshot, setTestedSnapshot] = useState<string | null>(null);
  const [visualApproved, setVisualApproved] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [dialog, setDialog] = useState<'generate' | 'archive' | 'reload' | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [revision, setRevision] = useState(0);
  const [historyRevision, setHistoryRevision] = useState(0);
  const [history, setHistory] = useState<Attempt[]>([]);
  const [historyError, setHistoryError] = useState('');
  const [historyLoading, setHistoryLoading] = useState(!!id);
  const epoch = useRef(0);
  const mounted = useRef(true);
  const operation = useRef(false);
  const [configLoad, reloadConfig] = useAdminLoad<NewsletterConfig>('/newsletters/config');
  const [templates, reloadTemplates] = useAdminLoad<NewsletterTemplate[]>('/newsletter-templates', manage);
  const [events, reloadEvents] = useAdminLoad<NewsletterEvent[]>('/newsletters/events', manage);
  const config = configLoad.state === 'ready' ? configLoad.data : null;
  const dirty = record ? !sameDraft(draft, draftOf(record)) : !!(draft.title || draft.subject || draft.markdown);
  const editable = manage && (!record || !frozen(record));
  const persisted = !!record && !dirty;
  const currentPreview = persisted ? preview : null;
  const recipientValid = isSingleMailbox(recipient) && recipient.toLowerCase() !== config?.distributionAddress.toLowerCase();
  const eligible = send && !!record && !frozen(record) && persisted && !!currentPreview && previewUsable && testedSnapshot === currentPreview.snapshotId && visualApproved;
  const selectedTemplate = templates.state === 'ready' ? templates.data.find(value => value.id === templateId && !value.archived && value.kind === kind) : undefined;
  const generationBlocker = !selectedTemplate ? 'Seleziona un template per generare il testo.'
    : kind === 'event' && !eventId ? 'Seleziona un evento per generare il testo.'
      : record && dirty ? 'Salva le modifiche alla bozza prima di sostituire il testo.' : '';
  const allowNavigation = useUnsavedChanges(dirty);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; epoch.current += 1; };
  }, []);
  useEffect(() => {
    if (config && !recipientEdited.current) setRecipient(config.defaultTestAddress);
  }, [config]);
  useEffect(() => {
    if (templates.state !== 'ready' || templateId) return;
    const matching = templates.data.filter(value => !value.archived && value.kind === kind);
    if (matching.length === 1) setTemplateId(matching[0].id);
  }, [templates, templateId, kind]);
  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    setLoadError('');
    api<Newsletter>(pathOf(id), { signal: controller.signal }).then(value => {
      if (controller.signal.aborted) return;
      setRecord(value);
      setDraft(draftOf(value));
      setKind(value.kind);
      setEventId(value.eventId ?? '');
      setTemplateId(value.templateId ?? '');
    }).catch(error => { if (!controller.signal.aborted) setLoadError(newsletterError(error)); });
    return () => controller.abort();
  }, [api, id, revision]);
  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    setHistoryError('');
    setHistoryLoading(true);
    api<Attempt[]>(`${pathOf(id)}/history`, { signal: controller.signal })
      .then(value => { if (!controller.signal.aborted) setHistory(value); })
      .catch(error => { if (!controller.signal.aborted) setHistoryError(newsletterError(error)); })
      .finally(() => { if (!controller.signal.aborted) setHistoryLoading(false); });
    return () => controller.abort();
  }, [api, id, historyRevision]);

  const invalidate = () => {
    epoch.current += 1;
    setPreview(null);
    setPreviewUsable(false);
    setTestedSnapshot(null);
    setVisualApproved(false);
    setConfirmation(null);
  };
  const edit = (field: keyof Draft, value: string) => {
    invalidate();
    setDraft(current => ({ ...current, [field]: value }));
  };
  const selectEvent = (value: string) => {
    setEventId(value);
    const selected = events.state === 'ready' ? events.data.find(event => event.id === value) : undefined;
    if (selected) {
      invalidate();
      setDraft(current => ({ ...current, title: selected.title, subject: selected.title }));
    }
  };
  const accept = (value: Newsletter) => {
    invalidate();
    setRecord(value);
    setDraft(draftOf(value));
    setKind(value.kind);
    setEventId(value.eventId ?? '');
    setTemplateId(value.templateId ?? '');
  };
  const run = async (label: string, action: (ticket: number) => Promise<void>) => {
    if (operation.current) return;
    operation.current = true;
    setBusy(label);
    setError('');
    const ticket = epoch.current;
    try { await action(ticket); }
    catch (error) {
      if (mounted.current) {
        const message = newsletterError(error);
        setError(message);
        notify('Operazione newsletter non riuscita', { description: message, kind: 'error' });
      }
    } finally {
      operation.current = false;
      if (mounted.current) setBusy(null);
    }
  };
  const current = (ticket: number) => mounted.current && ticket === epoch.current;
  const save = () => void run('save', async () => {
    if (!editable) return;
    const value = record
      ? await api<Newsletter>(pathOf(record.id), { method: 'PUT', body: JSON.stringify({ version: record.version, ...draft }) })
      : await api<Newsletter>('/newsletters', jsonPost({ kind, ...draft, ...(templateId ? { templateId } : {}), ...(eventId && kind === 'event' ? { eventId } : {}) }));
    if (!mounted.current) return;
    allowNavigation();
    accept(value);
    notify('Bozza salvata');
    if (!record) navigate(`/admin/newsletters/${encodeURIComponent(value.id)}`, { replace: true });
  });
  const prepare = () => void run('preview', async ticket => {
    if (!record || !persisted) return;
    // A newly prepared artifact always requires a fresh test and visual review.
    setTestedSnapshot(null);
    setVisualApproved(false);
    setConfirmation(null);
    setPreview(null);
    setPreviewUsable(false);
    const value = await api<NewsletterPreview>(`${pathOf(record.id)}/preview`, jsonPost({ version: record.version }));
    if (current(ticket)) setPreview(value);
  });
  const generate = () => {
    setDialog(null);
    void run('generate', async () => {
      if (!editable || generationBlocker || !selectedTemplate) return;
      if (!record) {
        const value = await api<RenderedPreview & { markdown: string }>(`/newsletter-templates/${encodeURIComponent(selectedTemplate.id)}/preview`,
          jsonPost({ version: selectedTemplate.version, ...(kind === 'event' ? { eventId } : {}) }));
        if (mounted.current) {
          invalidate();
          const selectedEvent = events.state === 'ready' ? events.data.find(value => value.id === eventId) : undefined;
          setDraft(previous => ({ title: previous.title.trim() ? previous.title : selectedEvent?.title ?? selectedTemplate.name, subject: value.subject, markdown: value.markdown }));
          notify('Testo generato. Rivedilo e salva la bozza.');
        }
        return;
      }
      const value = await api<Newsletter>(`${pathOf(record.id)}/generate`, jsonPost({ version: record.version, templateId, ...(kind === 'event' ? { eventId } : {}) }));
      if (mounted.current) { accept(value); notify('Testo generato e salvato come nuova revisione'); }
    });
  };
  const test = () => void run('test', async ticket => {
    if (!record || !currentPreview || !persisted || !send || !config?.testEnabled || !recipientValid) return;
    setTestedSnapshot(null);
    setVisualApproved(false);
    setConfirmation(null);
    const attempt = await api<Attempt>(`${pathOf(record.id)}/test`, jsonPost({ version: record.version, snapshotId: currentPreview.snapshotId, recipient }));
    if (!current(ticket)) return;
    setHistoryRevision(value => value + 1);
    if (attempt.status === 'accepted') {
      setTestedSnapshot(currentPreview.snapshotId);
      notify('Prova accettata dall’appliance SMTP', { description: 'Non è una conferma di consegna. Controlla il messaggio nel client email.' });
    } else {
      setError(`Prova non accettata: ${attemptLabel(attempt.status)}${attempt.errorCode ? ` (${attempt.errorCode})` : ''}. Non riprovare automaticamente in caso di esito incerto.`);
    }
  });
  const requestConfirmation = () => void run('confirmation', async ticket => {
    if (!record || !currentPreview || !eligible || !config?.productionEnabled) return;
    const value = await api<Confirmation>(`${pathOf(record.id)}/confirmation`, jsonPost({ version: record.version, snapshotId: currentPreview.snapshotId, visualApproved }));
    if (current(ticket)) setConfirmation(value);
  });
  const production = () => void run('send', async ticket => {
    if (!record || !currentPreview || !confirmation || !eligible || !config?.productionEnabled) return;
    // Consume locally before the request; a failed/ambiguous call is never automatically retried.
    setConfirmation(null);
    setTestedSnapshot(null);
    setVisualApproved(false);
    try {
      const attempt = await api<Attempt>(`${pathOf(record.id)}/send`, jsonPost({ version: record.version, snapshotId: currentPreview.snapshotId, confirmationId: confirmation.confirmationId }));
      if (!current(ticket)) return;
      setHistoryRevision(value => value + 1);
      setRecord(value => value ? { ...value, productionStatus: attempt.status } : value);
      if (attempt.status === 'accepted') notify('Messaggio accettato dall’appliance SMTP', { description: 'L’appliance gestisce l’inoltro; la consegna agli iscritti non è verificata.' });
      else setError(`Invio: ${attemptLabel(attempt.status)}. Verifica la cronologia e, se necessario, riconcilia con i log SMTP prima di qualsiasi nuovo tentativo.`);
    } catch (error) {
      if (mounted.current) {
        setRecord(value => value ? { ...value, productionStatus: 'unknown' } : value);
        setHistoryRevision(value => value + 1);
      }
      throw error;
    }
  });
  const upload = async (file: File) => {
    let inserted: string | undefined;
    await run('upload', async ticket => {
      if (!record || !editable || !config) return;
      if (!['image/png', 'image/jpeg'].includes(file.type) || file.size > config.maxImageBytes) throw new Error('Scegli un PNG o JPEG entro il limite indicato.');
      const form = new FormData();
      form.append('file', file);
      const response = await binary(`${pathOf(record.id)}/images`, { method: 'POST', body: form });
      const image = await response.json() as { id: string; markdown: string };
      if (current(ticket)) inserted = image.markdown;
    });
    return inserted;
  };
  const clone = () => void run('clone', async () => {
    if (!record || !manage || dirty) return;
    const value = await api<Newsletter>(`${pathOf(record.id)}/clone`, jsonPost({}));
    if (mounted.current) navigate(`/admin/newsletters/${encodeURIComponent(value.id)}`);
  });
  const archive = () => {
    setDialog(null);
    void run('archive', async () => {
      if (!record || !manage || dirty) return;
      const value = await api<Newsletter>(`${pathOf(record.id)}/archive`, jsonPost({ version: record.version }));
      if (mounted.current) accept(value);
    });
  };
  const exportEml = () => void run('download', async () => {
    if (!record || !currentPreview || !recipientValid) return;
    const query = new URLSearchParams({ snapshotId: currentPreview.snapshotId, recipient });
    await downloadEml(await binary(`${pathOf(record.id)}/eml?${query}`), record.id);
  });
  const reload = () => { invalidate(); setRecord(null); setDialog(null); setRevision(value => value + 1); };

  if (id && !record) return loadError ? <LoadError message={loadError} onRetry={() => setRevision(value => value + 1)} /> : <p role="status">Caricamento bozza…</p>;
  if (!id && !manage) return <p role="alert">Per creare una newsletter servono i permessi di lettura e gestione.</p>;
  return <div className="space-y-6">
    <PageHeader title={record ? record.title : 'Nuova newsletter'} back={{ to: '/admin/newsletters', label: 'Newsletter' }} description={record ? `Revisione ${record.version} · ${kind === 'event' ? 'Annuncio evento' : 'Newsletter generica'}` : 'Genera il testo da un template o scrivilo liberamente, poi salva la bozza.'} actions={record && <>
      {manage && <Button className={btn.secondary} isDisabled={!!busy || dirty} onPress={clone}>Clona in una nuova bozza</Button>}
      {manage && !record.archived && <Button className={btn.ghost} isDisabled={!!busy || dirty} onPress={() => setDialog('archive')}>Archivia</Button>}
      <Button className={btn.ghost} isDisabled={!!busy} onPress={() => dirty ? setDialog('reload') : reload()}>Ricarica versione salvata</Button>
    </>} />
    {editable && <Panel className="space-y-4 p-5" labelledBy="newsletter-generation">
      <h2 id="newsletter-generation" className="text-xl font-bold">Genera da un template</h2>
      <label className="block space-y-1 text-sm font-semibold">Tipo<select className={editorInput} value={kind} disabled={!!record || !manage || !!busy} onChange={event => { invalidate(); setKind(event.target.value as NewsletterKind); setTemplateId(''); }}><option value="generic">Generica</option><option value="event">Annuncio evento</option></select></label>
      <p>{record ? 'La generazione sostituisce e salva oggetto e testo.' : 'Seleziona il template e l’evento, genera il testo, poi rivedilo e salva la bozza.'} Gli eventi disponibili sono verificati dal server, senza dipendere dall’orologio del browser.</p>
      {templates.state === 'error' && <LoadError message={templates.message} onRetry={reloadTemplates} />}
      {templates.state === 'loading' && <p role="status">Caricamento template…</p>}
      {templates.state === 'ready' && <label className="block space-y-1 text-sm font-semibold">Template<select className={editorInput} value={templateId} onChange={event => { setTemplateId(event.target.value); }} disabled={!!busy}><option value="">Seleziona un template</option>{templates.data.filter(value => !value.archived && value.kind === kind).map(value => <option key={value.id} value={value.id}>{value.name} · v{value.version}</option>)}</select></label>}
      {kind === 'event' && <>
        {events.state === 'error' && <LoadError message={events.message} onRetry={reloadEvents} />}
        {events.state === 'loading' && <p role="status">Caricamento eventi…</p>}
        {events.state === 'ready' && <EventCombobox events={events.data} value={eventId} onChange={selectEvent} disabled={!!busy} />}
      </>}
      {generationBlocker && <p className="text-sm text-muted">{generationBlocker}</p>}
      <Button className={btn.secondary} isDisabled={!!busy || !!generationBlocker} onPress={() => setDialog('generate')}>Genera e sostituisci testo</Button>
    </Panel>}
    {error && <p role="alert" className="rounded-xl bg-[#fdecea] p-4 text-[#912018]">{error}</p>}
    {!manage && <p className="rounded-xl bg-cyan-50 p-4">Modalità sola lettura dei contenuti.{send ? ' Puoi preparare l’anteprima e inviare con i permessi attuali.' : ''}</p>}
    {record?.archived && <Badge kind="done">Newsletter archiviata</Badge>}
    {record?.productionStatus === 'accepted' && <p role="status" className="rounded-xl bg-basil-50 p-4">Accettata dall’appliance SMTP, non necessariamente consegnata agli iscritti. Il contenuto è bloccato: clona per un nuovo invio.</p>}
    {record?.productionStatus === 'unknown' && <p role="alert" className="rounded-xl bg-[#fff4e5] p-4">Esito SMTP incerto: nessun nuovo invio consentito fino alla riconciliazione con i log dell’appliance.</p>}
    <Panel className="space-y-5 p-5">
      <Form className="space-y-5" onSubmit={event => { event.preventDefault(); save(); }}>
          <TextInput label="Titolo interno" isRequired value={draft.title} onChange={value => edit('title', value)} isReadOnly={!editable} isDisabled={!!busy && !['preview', 'test', 'confirmation'].includes(busy)} />
        <TextInput label="Oggetto email" isRequired value={draft.subject} onChange={value => edit('subject', value)} isReadOnly={!editable} isDisabled={!!busy && !['preview', 'test', 'confirmation'].includes(busy)} />
        <MarkdownEditor value={draft.markdown} onChange={value => edit('markdown', value)} readOnly={!editable} disabled={!!busy && !['preview', 'test', 'confirmation'].includes(busy)} uploadDisabled={!!busy} onUpload={record && editable && config ? upload : undefined} maxImageBytes={config?.maxImageBytes} />
        <div className="flex flex-wrap items-center gap-3">
          {editable && <Button type="submit" className={btn.primary} isDisabled={!!busy || !draft.title.trim() || !draft.subject.trim() || (!!record && !dirty)}>Salva bozza</Button>}
          <span role="status" className="text-sm text-muted">{dirty ? 'Modifiche non salvate: salva prima di anteprima, generazione o invio.' : record ? 'Versione salvata. Nessun invio automatico.' : 'Bozza non ancora salvata.'}</span>
        </div>
      </Form>
    </Panel>
    <Panel className="space-y-4 p-5" labelledBy="newsletter-verification">
      <h2 id="newsletter-verification" className="text-xl font-bold">Anteprima e verifica</h2>
      <p>Le verifiche si riferiscono solo alla revisione salvata e al suo snapshot. Ogni modifica richiede nuova anteprima, prova e approvazione visiva.</p>
      <Button className={btn.secondary} isDisabled={!persisted || !!busy} onPress={prepare}>Prepara anteprima</Button>
      {currentPreview && <p className="break-words text-sm text-muted">Snapshot {currentPreview.snapshotId} · {currentPreview.messageBytes.toLocaleString('it-IT')} byte MIME · Impronta {currentPreview.contentHash}</p>}
      {configLoad.state === 'error' && <LoadError message={configLoad.message} onRetry={reloadConfig} />}
      {configLoad.state === 'loading' && <p role="status">Caricamento configurazione di invio…</p>}
      <TextInput label="Destinatario della prova" type="email" value={recipient} onChange={value => { recipientEdited.current = true; setRecipient(value); setConfirmation(null); }} isDisabled={!!busy} description="Un solo indirizzo email, modificabile. Non usare la lista di distribuzione né un alias che inoltra agli iscritti." />
      {recipient && !recipientValid && <p className="text-[#912018]">Inserisci un solo indirizzo diverso dalla distribuzione configurata.</p>}
      <div className="flex flex-wrap gap-3">
        <Button className={btn.secondary} isDisabled={!send || !config?.testEnabled || !currentPreview || !previewUsable || !recipientValid || !!busy || !!record && frozen(record)} onPress={test}>Invia prova</Button>
        <Button className={btn.ghost} isDisabled={!currentPreview || !recipientValid || !!busy} onPress={exportEml}>Scarica .eml di prova</Button>
      </div>
      {!send && <p className="text-sm text-muted">L’invio richiede i permessi newsletters.read e newsletters.send.</p>}
      {config && !config.testEnabled && <p className="rounded-xl bg-[#fff4e5] p-3">Invii di prova disabilitati dalla configurazione.</p>}
      {testedSnapshot && currentPreview?.snapshotId === testedSnapshot && <p role="status">Prova di questo snapshot accettata dall’appliance SMTP. Controlla la ricezione e l’aspetto nel client email: accettazione non significa consegna.</p>}
      <label className="flex min-h-11 items-start gap-3 py-2 font-semibold"><input type="checkbox" checked={visualApproved} disabled={!send || !currentPreview || !previewUsable || testedSnapshot !== currentPreview.snapshotId || !!busy || !!record && frozen(record)} onChange={event => { setVisualApproved(event.target.checked); setConfirmation(null); }} className="mt-1" />Ho verificato visivamente nel client email il messaggio di prova di questo esatto snapshot, inclusi logo, immagini, link e testo.</label>
      {config && !config.productionEnabled && <p className="rounded-xl bg-[#fff4e5] p-3 font-semibold">Invio in produzione disabilitato dalla configurazione. La preparazione delle bozze rimane disponibile.</p>}
      {config?.distributionAddress && <p>Distribuzione configurata: <strong className="break-all">{config.distributionAddress}</strong>. La destinazione non è modificabile da questa pagina.</p>}
      <Button className={btn.primary} isDisabled={!eligible || !config?.productionEnabled || !!busy} onPress={requestConfirmation}>Prepara conferma invio</Button>
    </Panel>
    {currentPreview && <ServerPreview preview={currentPreview} onValidityChange={setPreviewUsable} />}
    {record && <Panel className="space-y-4 p-5" labelledBy="newsletter-history">
      <h2 id="newsletter-history" className="text-xl font-bold">Cronologia invii</h2>
      <p className="text-sm text-muted">L’accettazione SMTP non certifica la consegna. Gli esiti incerti richiedono verifica manuale dei log; nessun tentativo viene ripetuto automaticamente.</p>
      {historyLoading ? <p role="status">Caricamento cronologia…</p> : historyError ? <LoadError message={historyError} onRetry={() => setHistoryRevision(value => value + 1)} /> : history.length === 0 ? <p>Nessun tentativo registrato.</p> :
        <ul className="divide-y divide-line">{history.map(attempt => <li key={attempt.id} className="space-y-2 py-3">
          <p><strong>{attempt.mode === 'production' ? 'Produzione' : 'Prova'} · {attemptLabel(attempt.status)}</strong></p><p className="break-words text-sm">{attempt.occurredAt} · {attempt.recipient}</p>{attempt.messageId && <p className="break-all text-sm">Message-ID: {attempt.messageId}</p>}{attempt.errorCode && <p className="text-sm">{attempt.errorCode}</p>}
          {send && (attempt.reconciliationRequired ?? attempt.status === 'unknown') && <ReconcileAttempt attempt={attempt} disabled={!!busy || dirty} onReconcile={(outcome, reason) => void run('reconcile', async () => {
            const value = await api<Newsletter>(`${pathOf(record.id)}/reconcile`, jsonPost({ attemptId: attempt.id, outcome, reason }));
            if (mounted.current) { accept(value); setHistoryRevision(value => value + 1); }
          })} />}
        </li>)}</ul>}
    </Panel>}
    {dialog === 'generate' && <ConfirmDialog title="Sostituire il testo della newsletter?" confirmLabel={record ? 'Sostituisci e salva' : 'Genera testo'} onCancel={() => setDialog(null)} onConfirm={generate}>
      <p>{record ? 'L’oggetto e il contenuto salvati verranno sostituiti dal template selezionato.' : 'L’oggetto e il contenuto nell’editor verranno sostituiti dal template selezionato. Potrai rivederli prima di salvare la bozza.'} Test e approvazioni precedenti non saranno più validi. Copia prima il testo se vuoi conservarlo.</p>
    </ConfirmDialog>}
    {dialog === 'archive' && <ConfirmDialog title="Archiviare la newsletter?" confirmLabel="Archivia" onCancel={() => setDialog(null)} onConfirm={archive}><p>La cronologia rimane disponibile. Per riutilizzare il contenuto, crea una nuova bozza con Clona.</p></ConfirmDialog>}
    {dialog === 'reload' && <ConfirmDialog title="Abbandonare le modifiche non salvate?" confirmLabel="Abbandona e ricarica" onCancel={() => setDialog(null)} onConfirm={reload} danger><p>Copia il tuo testo prima di ricaricare: le modifiche locali verranno sostituite dalla versione sul server.</p></ConfirmDialog>}
    {confirmation && <ConfirmDialog title="Conferma finale di invio in produzione" confirmLabel="Confermo: invia all’appliance SMTP" busy={busy === 'send'} danger onCancel={() => setConfirmation(null)} onConfirm={production}>
      <p><strong>{record?.title}</strong></p><p>Oggetto: {currentPreview?.subject}</p><p>Il messaggio sarà sottoposto una sola volta a <strong className="break-all">{confirmation.distributionAddress}</strong>. L’appliance lo inoltrerà agli iscritti: questa azione non è una prova.</p><p className="text-sm">Conferma valida fino a {confirmation.expiresAt}. Il server ricontrolla revisione, permessi e configurazione. Accettazione SMTP non significa consegna.</p>
    </ConfirmDialog>}
  </div>;
}

function attemptLabel(status: string) {
  return ({ accepted: 'Accettato da SMTP', submitting: 'Sottomissione SMTP in corso', rejected: 'Rifiutato', unknown: 'Esito incerto', 'not-submitted': 'Non sottoposto a SMTP' } as Record<string, string>)[status] ?? status;
}

function ReconcileAttempt({ attempt, onReconcile, disabled }: { attempt: Attempt; disabled: boolean; onReconcile: (outcome: string, reason: string) => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [outcome, setOutcome] = useState('accepted');
  const requiredOutcome = attempt.reconciliationOutcome;
  const selectedOutcome = requiredOutcome ?? outcome;
  const reasonValid = reason.trim().length >= 10;
  return <>
    <Button className={btn.secondary} isDisabled={disabled} onPress={() => setOpen(true)}>{requiredOutcome ? 'Completa riconciliazione invio' : 'Riconcilia esito incerto'}</Button>
    {open && <ConfirmDialog title="Riconcilia dopo verifica dei log SMTP" confirmLabel="Registra esito verificato" busy={disabled} onCancel={() => setOpen(false)} onConfirm={() => { if (reasonValid) { onReconcile(selectedOutcome, reason.trim()); setOpen(false); } }}>
      <p>Controlla il Message-ID {attempt.messageId || attempt.id} nei log dell’appliance. Questa azione non invia email e non deve essere usata per riprovare un esito ambiguo.</p>
      {requiredOutcome && <p>L’esito è già registrato: questa operazione completa la registrazione senza modificarlo.</p>}
      <label className="block space-y-1 text-sm font-semibold">Esito verificato<select className={editorInput} value={selectedOutcome} disabled={!!requiredOutcome} onChange={event => setOutcome(event.target.value)}>
        {(!requiredOutcome || requiredOutcome === 'accepted') && <option value="accepted">Accettato da SMTP</option>}
        {(!requiredOutcome || requiredOutcome === 'not-submitted') && <option value="not-submitted">Verificato: non sottoposto a SMTP</option>}
      </select></label>
      <TextInput label="Motivazione e riscontro nei log (obbligatori)" value={reason} onChange={setReason} isRequired minLength={10} description="Almeno 10 caratteri, senza contare gli spazi iniziali e finali." />
      {!reasonValid && <p className="text-sm">Inserisci un riscontro di almeno 10 caratteri prima di registrare l’esito.</p>}
    </ConfirmDialog>}
  </>;
}

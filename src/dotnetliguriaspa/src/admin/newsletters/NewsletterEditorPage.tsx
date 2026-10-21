import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Button, Form } from 'react-aria-components';
import { useAccountCapabilities } from '../../account/AccountCapabilities';
import { hasPermission } from '../../account/permissions';
import { AdminApiError, useAdminFetch, useAdminLoad } from '../adminApi';
import { Badge, btn, LoadError, PageHeader, Panel, TextInput, linkFocus } from '../ui';
import { notify } from '../toasts';
import type { Attempt, Confirmation, Newsletter, NewsletterConfig, NewsletterEvent, NewsletterKind, NewsletterPreview, NewsletterTemplate, RenderedPreview } from './types';
import { downloadEml, isSingleMailbox, jsonPost, newsletterError, useNewsletterBinary } from './newsletterApi';
import { ConfirmDialog, editorInput, EventCombobox, MarkdownEditor, useUnsavedChanges } from './editorUi';
import ServerPreview from './ServerPreview';
import NewsletterStepper, { type NewsletterStep } from './NewsletterStepper';

type Draft = { title: string; subject: string; markdown: string };
type StartMode = 'template' | 'blank';
const draftOf = (value?: Newsletter): Draft => ({ title: value?.title ?? '', subject: value?.subject ?? '', markdown: value?.markdown ?? '' });
const sameDraft = (a: Draft, b: Draft) => a.title === b.title && a.subject === b.subject && a.markdown === b.markdown;
const pathOf = (id: string) => `/newsletters/${encodeURIComponent(id)}`;
const editorPath = (id: string, step?: NewsletterStep) => `/admin/newsletters/${encodeURIComponent(id)}${step ? `?step=${step}` : ''}`;
const productionStatuses = ['accepted', 'unknown', 'submitting', 'pending'];
const productionStarted = (value: Newsletter) => productionStatuses.includes(value.productionStatus);
const frozen = (value: Newsletter) => value.archived || productionStarted(value);
const parseStep = (value: string | null): NewsletterStep | null => {
  const step = Number(value);
  return Number.isInteger(step) && step >= 1 && step <= 5 ? step as NewsletterStep : null;
};

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
  const [params, setParams] = useSearchParams();
  const [record, setRecord] = useState<Newsletter | null>(null);
  const [draft, setDraft] = useState<Draft>(() => draftOf());
  const [kind, setKind] = useState<NewsletterKind>('generic');
  const [startMode, setStartMode] = useState<StartMode>('template');
  const [templateId, setTemplateId] = useState('');
  const [eventId, setEventId] = useState('');
  const [recipient, setRecipient] = useState('');
  const recipientEdited = useRef(false);
  const [preview, setPreview] = useState<NewsletterPreview | null>(null);
  const previewRef = useRef<NewsletterPreview | null>(null);
  const [previewUsable, setPreviewUsable] = useState(false);
  const [approvedStale, setApprovedStale] = useState(false);
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
  const approvedId = record && !dirty && !approvedStale ? record.approvedSnapshotId ?? null : null;
  const previewApproved = !!currentPreview && currentPreview.snapshotId === approvedId;
  const tested = !!approvedId && record?.testedSnapshotId === approvedId;
  const started = !!record && productionStarted(record);
  const recipientValid = isSingleMailbox(recipient) && recipient.toLowerCase() !== config?.distributionAddress.toLowerCase();
  const eligible = send && !!record && !frozen(record) && tested && visualApproved;
  const selectedTemplate = templates.state === 'ready' ? templates.data.find(value => value.id === templateId && !value.archived && value.kind === kind) : undefined;
  const generationBlocker = !selectedTemplate ? 'Seleziona un template per generare il testo.'
    : kind === 'event' && !eventId ? 'Seleziona un evento per generare il testo.'
      : dirty ? 'Salva le modifiche alla bozza prima di sostituire il testo.' : '';
  const createBlocker = kind === 'event' && !eventId ? 'Seleziona un evento.'
    : startMode === 'template' && !selectedTemplate ? 'Seleziona un template oppure scegli «Inizia da zero».'
      : !draft.title.trim() ? 'Inserisci il titolo interno.'
        : startMode === 'blank' && !draft.subject.trim() ? 'Inserisci l’oggetto email.' : '';
  const allowNavigation = useUnsavedChanges(dirty);
  const testBlocker = !send || !config || !config.testEnabled || !record ? ''
    : frozen(record) ? 'Questa newsletter non è più modificabile: l’invio di prova non è disponibile.'
      : !recipient.trim() ? 'Inserisci l’indirizzo del destinatario della prova.'
        : !recipientValid ? 'Inserisci un solo indirizzo valido, diverso dalla distribuzione configurata.' : '';

  const reachable = (step: NewsletterStep) => step === 1 || (!!record && (step === 2 || step === 5
    || (step === 3 && !!approvedId) || (step === 4 && (tested || started))));
  const completed = (step: NewsletterStep) => step === 1 ? !!record
    : step === 2 ? !!approvedId || started
      : step === 3 ? tested || started
        : step === 4 ? record?.productionStatus === 'accepted' : false;
  const defaultStep: NewsletterStep = !record ? 1 : record.archived || started ? 5 : tested ? 4 : approvedId ? 3 : 2;
  const requested = parseStep(params.get('step'));
  const step: NewsletterStep = !id ? 1 : requested && reachable(requested) ? requested : defaultStep;
  const goTo = (value: NewsletterStep) => { if (reachable(value)) setParams({ step: String(value) }); };

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; epoch.current += 1; };
  }, []);
  useEffect(() => { previewRef.current = preview; }, [preview]);
  useEffect(() => {
    if (id && record && params.get('step') !== String(step)) setParams({ step: String(step) }, { replace: true });
  }, [id, record, params, step, setParams]);
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
  const approvedSnapshot = record?.approvedSnapshotId ?? null;
  const recordKey = record ? `${record.id}/${record.version}` : '';
  useEffect(() => {
    // Reload the approved artifact so a returning editor sees exactly what was approved.
    if (!recordKey || !approvedSnapshot || previewRef.current?.snapshotId === approvedSnapshot) return;
    const controller = new AbortController();
    const ticket = epoch.current;
    const [newsletterId] = recordKey.split('/');
    api<NewsletterPreview>(`${pathOf(newsletterId)}/snapshots/${encodeURIComponent(approvedSnapshot)}`, { signal: controller.signal })
      .then(value => { if (!controller.signal.aborted && ticket === epoch.current) setPreview(value); })
      .catch(error => {
        if (controller.signal.aborted) return;
        if (error instanceof AdminApiError && [404, 409].includes(error.status)) setApprovedStale(true);
        else setError(newsletterError(error));
      });
    return () => controller.abort();
  }, [api, recordKey, approvedSnapshot]);

  const invalidate = () => {
    epoch.current += 1;
    setPreview(null);
    setPreviewUsable(false);
    setVisualApproved(false);
    setConfirmation(null);
  };
  const edit = (field: keyof Draft, value: string) => {
    invalidate();
    setDraft(current => ({ ...current, [field]: value }));
  };
  const changeKind = (value: NewsletterKind) => {
    setKind(value);
    setTemplateId('');
    setEventId('');
  };
  const selectEvent = (value: string) => {
    setEventId(value);
    const selected = events.state === 'ready' ? events.data.find(event => event.id === value) : undefined;
    if (selected) setDraft(current => ({ ...current, title: selected.title, subject: selected.title }));
  };
  const accept = (value: Newsletter) => {
    invalidate();
    setApprovedStale(false);
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
  const create = () => void run('create', async () => {
    if (record || !manage || createBlocker) return;
    let subject = draft.subject.trim();
    let markdown = '';
    const template = startMode === 'template' ? selectedTemplate : undefined;
    if (template) {
      const generated = await api<RenderedPreview & { markdown: string }>(`/newsletter-templates/${encodeURIComponent(template.id)}/preview`,
        jsonPost({ version: template.version, ...(kind === 'event' ? { eventId } : {}) }));
      markdown = generated.markdown;
      if (!subject) subject = generated.subject;
    }
    const value = await api<Newsletter>('/newsletters', jsonPost({ kind, title: draft.title.trim(), subject, markdown,
      ...(template ? { templateId: template.id } : {}), ...(kind === 'event' ? { eventId } : {}) }));
    if (!mounted.current) return;
    allowNavigation();
    notify('Bozza creata', { description: 'Rivedi il testo, prepara l’anteprima e approvala.' });
    navigate(editorPath(value.id, 2), { replace: true });
  });
  const save = () => void run('save', async () => {
    if (!editable || !record) return;
    const value = await api<Newsletter>(pathOf(record.id), { method: 'PUT', body: JSON.stringify({ version: record.version, ...draft }) });
    if (!mounted.current) return;
    allowNavigation();
    accept(value);
    notify('Bozza salvata', record.approvedSnapshotId ? { description: 'Le modifiche hanno revocato l’approvazione precedente.' } : undefined);
  });
  const prepare = () => void run('preview', async ticket => {
    if (!record || !persisted) return;
    setVisualApproved(false);
    setConfirmation(null);
    setPreview(null);
    setPreviewUsable(false);
    const value = await api<NewsletterPreview>(`${pathOf(record.id)}/preview`, jsonPost({ version: record.version }));
    if (current(ticket)) setPreview(value);
  });
  const approve = () => void run('approve', async ticket => {
    if (!record || !currentPreview || !previewUsable || !editable || previewApproved) return;
    const value = await api<Newsletter>(`${pathOf(record.id)}/approve`, jsonPost({ version: record.version, snapshotId: currentPreview.snapshotId }));
    if (!current(ticket)) return;
    setApprovedStale(false);
    setVisualApproved(false);
    setConfirmation(null);
    setRecord(value);
    notify('Newsletter approvata', { description: 'Ora puoi inviare la prova di questa anteprima.' });
  });
  const generate = () => {
    setDialog(null);
    void run('generate', async () => {
      if (!record || !editable || generationBlocker || !selectedTemplate) return;
      const value = await api<Newsletter>(`${pathOf(record.id)}/generate`, jsonPost({ version: record.version, templateId, ...(kind === 'event' ? { eventId } : {}) }));
      if (mounted.current) { accept(value); notify('Testo generato e salvato come nuova revisione'); }
    });
  };
  const test = () => void run('test', async ticket => {
    if (!record || !approvedId || frozen(record) || !send || !config?.testEnabled || !recipientValid) return;
    setVisualApproved(false);
    setConfirmation(null);
    setRecord(value => value ? { ...value, testedSnapshotId: null } : value);
    const attempt = await api<Attempt>(`${pathOf(record.id)}/test`, jsonPost({ version: record.version, snapshotId: approvedId, recipient }));
    if (!current(ticket)) return;
    setHistoryRevision(value => value + 1);
    if (attempt.status === 'accepted') {
      setRecord(value => value ? { ...value, testedSnapshotId: approvedId } : value);
      notify('Prova accettata dall’appliance SMTP', { description: 'Non è una conferma di consegna. Controlla il messaggio nel client email.' });
    } else {
      setError(`Prova non accettata: ${attemptLabel(attempt.status)}${attempt.errorCode ? ` (${attempt.errorCode})` : ''}. Non riprovare automaticamente in caso di esito incerto.`);
    }
  });
  const requestConfirmation = () => void run('confirmation', async ticket => {
    if (!record || !approvedId || !eligible || !config?.productionEnabled) return;
    const value = await api<Confirmation>(`${pathOf(record.id)}/confirmation`, jsonPost({ version: record.version, snapshotId: approvedId, visualApproved }));
    if (current(ticket)) setConfirmation(value);
  });
  const production = () => void run('send', async ticket => {
    if (!record || !approvedId || !confirmation || !eligible || !config?.productionEnabled) return;
    // Consume locally before the request; a failed/ambiguous call is never automatically retried.
    setConfirmation(null);
    setVisualApproved(false);
    try {
      const attempt = await api<Attempt>(`${pathOf(record.id)}/send`, jsonPost({ version: record.version, snapshotId: approvedId, confirmationId: confirmation.confirmationId }));
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
    if (mounted.current) navigate(editorPath(value.id, 2));
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
    if (!record || !approvedId || !recipientValid) return;
    const query = new URLSearchParams({ snapshotId: approvedId, recipient });
    await downloadEml(await binary(`${pathOf(record.id)}/eml?${query}`), record.id);
  });
  const reload = () => { invalidate(); setApprovedStale(false); setRecord(null); setDialog(null); setRevision(value => value + 1); };

  if (id && !record) return loadError ? <LoadError message={loadError} onRetry={() => setRevision(value => value + 1)} /> : <p role="status">Caricamento bozza…</p>;
  const inputsDisabled = !!busy && busy !== 'preview';
  const next = (target: NewsletterStep, label: string) => reachable(target) && <Button className={btn.primary} isDisabled={!!busy} onPress={() => goTo(target)}>{label}</Button>;
  return <div className="space-y-6">
    <PageHeader title={record ? record.title : 'Nuova newsletter'} back={{ to: '/admin/newsletters', label: 'Newsletter' }} description={record ? `Revisione ${record.version} · ${kind === 'event' ? 'Annuncio evento' : 'Newsletter generica'}` : 'Crea una nuova bozza oppure riprendi una bozza esistente.'} actions={record && <>
      {manage && <Button className={btn.secondary} isDisabled={!!busy || dirty} onPress={clone}>Clona in una nuova bozza</Button>}
      {manage && !record.archived && <Button className={btn.ghost} isDisabled={!!busy || dirty} onPress={() => setDialog('archive')}>Archivia</Button>}
      <Button className={btn.ghost} isDisabled={!!busy} onPress={() => dirty ? setDialog('reload') : reload()}>Ricarica versione salvata</Button>
    </>} />
    <NewsletterStepper current={step} reachable={reachable} completed={completed} onSelect={goTo} />
    {error && <p role="alert" className="rounded-xl bg-[#fdecea] p-4 text-[#912018]">{error}</p>}
    {!manage && record && <p className="rounded-xl bg-cyan-50 p-4">Modalità sola lettura dei contenuti.{send ? ' Puoi inviare prove e la newsletter approvata con i permessi attuali.' : ''}</p>}
    {record?.archived && <Badge kind="done">Newsletter archiviata</Badge>}
    {record?.productionStatus === 'accepted' && <p role="status" className="rounded-xl bg-basil-50 p-4">Accettata dall’appliance SMTP, non necessariamente consegnata agli iscritti. Il contenuto è bloccato: clona per un nuovo invio.</p>}
    {record?.productionStatus === 'unknown' && <p role="alert" className="rounded-xl bg-[#fff4e5] p-4">Esito SMTP incerto: nessun nuovo invio consentito fino alla riconciliazione con i log dell’appliance (passo 5).</p>}

    {step === 1 && <>
      {!record && !manage && <p role="alert">Per creare una newsletter servono i permessi di lettura e gestione.</p>}
      {!record && manage && <Panel className="space-y-4 p-5" labelledBy="newsletter-create">
        <h2 id="newsletter-create" className="text-xl font-bold">Crea una nuova newsletter</h2>
        <label className="block space-y-1 text-sm font-semibold">Tipo<select className={editorInput} value={kind} disabled={!!busy} onChange={event => changeKind(event.target.value as NewsletterKind)}><option value="generic">Generica</option><option value="event">Annuncio evento</option></select></label>
        {kind === 'event' && <>
          {events.state === 'error' && <LoadError message={events.message} onRetry={reloadEvents} />}
          {events.state === 'loading' && <p role="status">Caricamento eventi…</p>}
          {events.state === 'ready' && <EventCombobox events={events.data} value={eventId} onChange={selectEvent} disabled={!!busy} />}
        </>}
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold">Contenuto iniziale</legend>
          <label className="flex min-h-11 items-center gap-3"><input type="radio" name="newsletter-start" value="template" checked={startMode === 'template'} disabled={!!busy} onChange={() => setStartMode('template')} />{kind === 'event' ? 'Copia i dati dell’evento nel testo usando un template' : 'Parti da un template'}</label>
          <label className="flex min-h-11 items-center gap-3"><input type="radio" name="newsletter-start" value="blank" checked={startMode === 'blank'} disabled={!!busy} onChange={() => setStartMode('blank')} />Inizia da zero con un testo vuoto</label>
        </fieldset>
        {startMode === 'template' && <>
          {templates.state === 'error' && <LoadError message={templates.message} onRetry={reloadTemplates} />}
          {templates.state === 'loading' && <p role="status">Caricamento template…</p>}
          {templates.state === 'ready' && <label className="block space-y-1 text-sm font-semibold">Template<select className={editorInput} value={templateId} onChange={event => setTemplateId(event.target.value)} disabled={!!busy}><option value="">Seleziona un template</option>{templates.data.filter(value => !value.archived && value.kind === kind).map(value => <option key={value.id} value={value.id}>{value.name} · v{value.version}</option>)}</select></label>}
        </>}
        <TextInput label="Titolo interno" isRequired value={draft.title} onChange={value => edit('title', value)} isDisabled={!!busy} />
        <TextInput label="Oggetto email" isRequired={startMode === 'blank'} value={draft.subject} onChange={value => edit('subject', value)} isDisabled={!!busy} description={startMode === 'template' ? 'Se vuoto, viene usato l’oggetto del template.' : undefined} />
        <p className="text-sm text-muted">Gli eventi disponibili sono verificati dal server. Nessun messaggio viene inviato in questo passo.</p>
        {createBlocker && <p role="status" className="text-sm text-muted">{createBlocker}</p>}
        <Button className={btn.primary} isDisabled={!!busy || !!createBlocker} onPress={create}>Crea bozza e continua</Button>
      </Panel>}
      {record && <Panel className="space-y-4 p-5" labelledBy="newsletter-summary">
        <h2 id="newsletter-summary" className="text-xl font-bold">Bozza aperta</h2>
        <p>{kind === 'event' ? 'Annuncio evento' : 'Newsletter generica'} · Revisione {record.version}{record.templateVersion ? ` · Template v${record.templateVersion}` : ''}</p>
        {editable && <>
          <h3 className="text-lg font-bold">Rigenera il testo da un template</h3>
          <p className="text-sm">La rigenerazione sostituisce e salva oggetto e testo, e revoca approvazione e prove.</p>
          {templates.state === 'error' && <LoadError message={templates.message} onRetry={reloadTemplates} />}
          {templates.state === 'ready' && <label className="block space-y-1 text-sm font-semibold">Template<select className={editorInput} value={templateId} onChange={event => setTemplateId(event.target.value)} disabled={!!busy}><option value="">Seleziona un template</option>{templates.data.filter(value => !value.archived && value.kind === kind).map(value => <option key={value.id} value={value.id}>{value.name} · v{value.version}</option>)}</select></label>}
          {kind === 'event' && events.state === 'ready' && <EventCombobox events={events.data} value={eventId} onChange={setEventId} disabled={!!busy} />}
          {kind === 'event' && events.state === 'error' && <LoadError message={events.message} onRetry={reloadEvents} />}
          {generationBlocker && <p className="text-sm text-muted">{generationBlocker}</p>}
          <Button className={btn.secondary} isDisabled={!!busy || !!generationBlocker} onPress={() => setDialog('generate')}>Genera e sostituisci testo</Button>
        </>}
        <div className="flex flex-wrap gap-3">
          {next(2, 'Continua: testo e approvazione')}
          {manage && <Link className={`${btn.ghost} ${linkFocus}`} to="/admin/newsletters/new">Crea un’altra newsletter</Link>}
        </div>
      </Panel>}
      <DraftList currentId={record?.id} />
    </>}

    {step === 2 && record && <>
      <Panel className="space-y-5 p-5" labelledBy="newsletter-text">
        <h2 id="newsletter-text" className="text-xl font-bold">Testo della newsletter</h2>
        <Form className="space-y-5" onSubmit={event => { event.preventDefault(); save(); }}>
          <TextInput label="Titolo interno" isRequired value={draft.title} onChange={value => edit('title', value)} isReadOnly={!editable} isDisabled={inputsDisabled} />
          <TextInput label="Oggetto email" isRequired value={draft.subject} onChange={value => edit('subject', value)} isReadOnly={!editable} isDisabled={inputsDisabled} />
          <MarkdownEditor value={draft.markdown} onChange={value => edit('markdown', value)} readOnly={!editable} disabled={inputsDisabled} uploadDisabled={!!busy} onUpload={editable && config ? upload : undefined} maxImageBytes={config?.maxImageBytes} />
          <div className="flex flex-wrap items-center gap-3">
            {editable && <Button type="submit" className={btn.primary} isDisabled={!!busy || !draft.title.trim() || !draft.subject.trim() || !dirty}>Salva bozza</Button>}
            <span role="status" className="text-sm text-muted">{dirty ? `Modifiche non salvate: salva prima di anteprima e approvazione.${record.approvedSnapshotId ? ' Salvando, l’approvazione attuale verrà revocata.' : ''}` : 'Versione salvata. Nessun invio automatico.'}</span>
          </div>
        </Form>
      </Panel>
      <Panel className="space-y-4 p-5" labelledBy="newsletter-approval">
        <h2 id="newsletter-approval" className="text-xl font-bold">Anteprima e approvazione</h2>
        <p>L’approvazione riguarda l’anteprima della revisione salvata. Ogni modifica salvata o rigenerazione la revoca e richiede nuove prove.</p>
        {approvedId && <p role="status" className="rounded-xl bg-basil-50 p-3"><Badge kind="ok">Approvata</Badge> {record.approvedAt ? `il ${new Date(record.approvedAt).toLocaleString('it-IT')}` : ''}{previewApproved ? ' · L’anteprima mostrata è quella approvata.' : currentPreview ? ' · L’anteprima mostrata è più recente di quella approvata.' : ''}</p>}
        {approvedStale && <p role="status" className="rounded-xl bg-[#fff4e5] p-3">L’anteprima approvata non è più valida (revisione o configurazione di invio cambiate). Preparane una nuova e approvala di nuovo.</p>}
        <div className="flex flex-wrap gap-3">
          <Button className={btn.secondary} isDisabled={!persisted || !!busy} onPress={prepare}>Prepara anteprima</Button>
          {editable && <Button className={btn.primary} isDisabled={!currentPreview || !previewUsable || previewApproved || !!busy} onPress={approve}>Approva questa anteprima</Button>}
          {next(3, 'Continua: invio di prova')}
        </div>
        {!manage && !approvedId && <p className="text-sm text-muted">L’approvazione richiede il permesso newsletters.manage.</p>}
        {persisted && !currentPreview && !approvedId && <p role="status" className="text-sm text-muted">Premi «Prepara anteprima», controllala e approvala per abilitare l’invio di prova.</p>}
        {currentPreview && <p className="break-words text-sm text-muted">Snapshot {currentPreview.snapshotId} · {currentPreview.messageBytes.toLocaleString('it-IT')} byte MIME · Impronta {currentPreview.contentHash}</p>}
      </Panel>
      {currentPreview && <ServerPreview preview={currentPreview} onValidityChange={setPreviewUsable} />}
    </>}

    {step === 3 && record && approvedId && <Panel className="space-y-4 p-5" labelledBy="newsletter-test">
      <h2 id="newsletter-test" className="text-xl font-bold">Invio di prova</h2>
      <p>La prova usa esattamente l’anteprima approvata{preview?.snapshotId === approvedId ? ` («${preview.subject}», ${preview.messageBytes.toLocaleString('it-IT')} byte MIME)` : ''}. Il messaggio ha l’oggetto marcato come prova.</p>
      {configLoad.state === 'error' && <LoadError message={configLoad.message} onRetry={reloadConfig} />}
      {configLoad.state === 'loading' && <p role="status">Caricamento configurazione di invio…</p>}
      <TextInput label="Destinatario della prova" type="email" value={recipient} onChange={value => { recipientEdited.current = true; setRecipient(value); }} isDisabled={!!busy} description="Un solo indirizzo email, modificabile. Non usare la lista di distribuzione né un alias che inoltra agli iscritti." />
      {recipient && !recipientValid && <p className="text-[#912018]">Inserisci un solo indirizzo diverso dalla distribuzione configurata.</p>}
      <div className="flex flex-wrap gap-3">
        <Button className={btn.secondary} isDisabled={!send || !config?.testEnabled || !recipientValid || !!busy || frozen(record)} onPress={test}>Invia prova</Button>
        <Button className={btn.ghost} isDisabled={!recipientValid || !!busy} onPress={exportEml}>Scarica .eml di prova</Button>
        {next(4, 'Continua: invio agli iscritti')}
      </div>
      {testBlocker && !busy && <p role="status" className="text-sm text-muted">{testBlocker}</p>}
      {!send && <p className="text-sm text-muted">L’invio richiede i permessi newsletters.read e newsletters.send.</p>}
      {config && !config.testEnabled && <p className="rounded-xl bg-[#fff4e5] p-3">{config.testDisabledReason || 'Invii di prova disabilitati: configura il server SMTP e il mittente, quindi abilita Newsletters:TestEnabled nelle impostazioni del server.'}</p>}
      {tested && <p role="status">Prova dell’anteprima approvata accettata dall’appliance SMTP. Controlla la ricezione e l’aspetto nel client email: accettazione non significa consegna.</p>}
      <p className="text-sm text-muted">Il file .eml è solo per la verifica locale e non conta come prova inviata.</p>
    </Panel>}

    {step === 4 && record && <Panel className="space-y-4 p-5" labelledBy="newsletter-production">
      <h2 id="newsletter-production" className="text-xl font-bold">Invio a tutti gli iscritti</h2>
      <p><strong>{record.title}</strong>{preview?.snapshotId === approvedId && preview ? <> · Oggetto: {preview.subject}</> : null}</p>
      {config?.distributionAddress && <p>Distribuzione configurata: <strong className="break-all">{config.distributionAddress}</strong>. La destinazione non è modificabile da questa pagina; l’appliance inoltra il messaggio agli iscritti.</p>}
      {config && !config.productionEnabled && <p className="rounded-xl bg-[#fff4e5] p-3 font-semibold">Invio in produzione disabilitato dalla configurazione. La preparazione delle bozze rimane disponibile.</p>}
      {!started && <>
        <label className="flex min-h-11 items-start gap-3 py-2 font-semibold"><input type="checkbox" checked={visualApproved} disabled={!send || !tested || !!busy || frozen(record)} onChange={event => { setVisualApproved(event.target.checked); setConfirmation(null); }} className="mt-1" />Ho verificato visivamente nel client email il messaggio di prova di questo esatto snapshot, inclusi logo, immagini, link e testo.</label>
        <Button className={btn.primary} isDisabled={!eligible || !config?.productionEnabled || !!busy} onPress={requestConfirmation}>Prepara conferma invio</Button>
        {!send && <p className="text-sm text-muted">L’invio richiede i permessi newsletters.read e newsletters.send.</p>}
      </>}
      {next(5, 'Vai alla cronologia')}
    </Panel>}

    {step === 5 && record && <Panel className="space-y-4 p-5" labelledBy="newsletter-history">
      <h2 id="newsletter-history" className="text-xl font-bold">Cronologia invii</h2>
      <p className="text-sm text-muted">Prove e invii in produzione. L’accettazione SMTP non certifica la consegna. Gli esiti incerti richiedono verifica manuale dei log; nessun tentativo viene ripetuto automaticamente.</p>
      {historyLoading ? <p role="status">Caricamento cronologia…</p> : historyError ? <LoadError message={historyError} onRetry={() => setHistoryRevision(value => value + 1)} /> : history.length === 0 ? <p>Nessun tentativo registrato.</p> :
        <ul className="divide-y divide-line">{history.map(attempt => <li key={attempt.id} className="space-y-2 py-3">
          <p><strong>{attempt.mode === 'production' ? 'Produzione' : 'Prova'} · {attemptLabel(attempt.status)}</strong></p><p className="break-words text-sm">{attempt.occurredAt} · {attempt.recipient}</p>{attempt.messageId && <p className="break-all text-sm">Message-ID: {attempt.messageId}</p>}{attempt.errorCode && <p className="text-sm">{attempt.errorCode}</p>}
          {send && (attempt.reconciliationRequired ?? attempt.status === 'unknown') && <ReconcileAttempt attempt={attempt} disabled={!!busy || dirty} onReconcile={(outcome, reason) => void run('reconcile', async () => {
            const value = await api<Newsletter>(`${pathOf(record.id)}/reconcile`, jsonPost({ attemptId: attempt.id, outcome, reason }));
            if (mounted.current) { accept(value); setHistoryRevision(value => value + 1); }
          })} />}
        </li>)}</ul>}
    </Panel>}

    {dialog === 'generate' && <ConfirmDialog title="Sostituire il testo della newsletter?" confirmLabel="Sostituisci e salva" onCancel={() => setDialog(null)} onConfirm={generate}>
      <p>L’oggetto e il contenuto salvati verranno sostituiti dal template selezionato. Approvazione e prove precedenti non saranno più valide. Copia prima il testo se vuoi conservarlo.</p>
    </ConfirmDialog>}
    {dialog === 'archive' && <ConfirmDialog title="Archiviare la newsletter?" confirmLabel="Archivia" onCancel={() => setDialog(null)} onConfirm={archive}><p>La cronologia rimane disponibile. Per riutilizzare il contenuto, crea una nuova bozza con Clona.</p></ConfirmDialog>}
    {dialog === 'reload' && <ConfirmDialog title="Abbandonare le modifiche non salvate?" confirmLabel="Abbandona e ricarica" onCancel={() => setDialog(null)} onConfirm={reload} danger><p>Copia il tuo testo prima di ricaricare: le modifiche locali verranno sostituite dalla versione sul server.</p></ConfirmDialog>}
    {confirmation && <ConfirmDialog title="Conferma finale di invio in produzione" confirmLabel="Confermo: invia all’appliance SMTP" busy={busy === 'send'} danger onCancel={() => setConfirmation(null)} onConfirm={production}>
      <p><strong>{record?.title}</strong></p>{preview?.snapshotId === approvedId && <p>Oggetto: {preview?.subject}</p>}<p>Il messaggio sarà sottoposto una sola volta a <strong className="break-all">{confirmation.distributionAddress}</strong>. L’appliance lo inoltrerà agli iscritti: questa azione non è una prova.</p><p className="text-sm">Conferma valida fino a {confirmation.expiresAt}. Il server ricontrolla revisione, approvazione, permessi e configurazione. Accettazione SMTP non significa consegna.</p>
    </ConfirmDialog>}
  </div>;
}

function DraftList({ currentId }: { currentId?: string }) {
  const [load, reload] = useAdminLoad<Newsletter[]>('/newsletters');
  const drafts = load.state === 'ready' ? load.data.filter(item => !frozen(item) && item.id !== currentId) : [];
  return <Panel className="space-y-3 p-5" labelledBy="newsletter-drafts">
    <h2 id="newsletter-drafts" className="text-xl font-bold">{currentId ? 'Apri un’altra bozza' : 'Oppure riprendi una bozza esistente'}</h2>
    {load.state === 'loading' && <p role="status">Caricamento bozze…</p>}
    {load.state === 'error' && <LoadError message={load.message} onRetry={reload} />}
    {load.state === 'ready' && (drafts.length === 0 ? <p className="text-muted">Nessuna altra bozza in lavorazione.</p> :
      <ul className="divide-y divide-line">{drafts.map(item => <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
        <div className="min-w-0"><Link className={`inline-flex min-h-11 items-center font-bold text-cyan-700 underline ${linkFocus}`} to={editorPath(item.id)}>{item.title}</Link><p className="break-words text-sm text-muted">{item.subject} · {item.kind === 'event' ? 'Annuncio evento' : 'Generica'} · Revisione {item.version}</p></div>
        <Badge kind={item.approvedSnapshotId ? 'ok' : 'planned'}>{item.testedSnapshotId ? 'Approvata e provata' : item.approvedSnapshotId ? 'Approvata' : 'Bozza'}</Badge>
      </li>)}</ul>)}
  </Panel>;
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

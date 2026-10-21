import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button, Form } from 'react-aria-components';
import { useAccountCapabilities } from '../../account/AccountCapabilities';
import { hasPermission } from '../../account/permissions';
import { useAdminFetch, useAdminLoad } from '../adminApi';
import { Badge, btn, EmptyState, linkFocus, LoadError, PageHeader, Panel, TextInput } from '../ui';
import { notify } from '../toasts';
import type { NewsletterEvent, NewsletterKind, NewsletterTemplate, RenderedPreview } from './types';
import { jsonPost, newsletterError } from './newsletterApi';
import { ConfirmDialog, editorInput, EventCombobox, MarkdownEditor, useUnsavedChanges } from './editorUi';
import ServerPreview from './ServerPreview';

const placeholders = ['event.title', 'event.date', 'event.startTime', 'event.endTime', 'event.location.name', 'event.location.address', 'event.location.mapUrl', 'event.url', 'event.talksMarkdown'];
const pathOf = (id: string) => `/newsletter-templates/${encodeURIComponent(id)}`;

export default function NewsletterTemplatesPage() {
  const { id } = useParams();
  const { capabilities } = useAccountCapabilities();
  const read = hasPermission(capabilities, 'newsletters.read');
  const manage = read && hasPermission(capabilities, 'newsletters.manage');
  if (!read) return <p role="alert">Non disponi del permesso per leggere i template newsletter.</p>;
  return id ? <TemplateEditor key={id} id={id === 'new' ? undefined : id} manage={manage} /> : <TemplateList manage={manage} />;
}

function TemplateList({ manage }: { manage: boolean }) {
  const [load, reload] = useAdminLoad<NewsletterTemplate[]>('/newsletter-templates');
  const [showArchived, setShowArchived] = useState(false);
  const items = load.state === 'ready' ? load.data.filter(item => showArchived || !item.archived) : [];
  return <div className="space-y-6">
    <PageHeader title="Template newsletter" description="Modelli Markdown riutilizzabili. Le modifiche non riscrivono le bozze già generate." back={{ to: '/admin/newsletters', label: 'Newsletter' }} actions={manage && <Link className={btn.primary} to="/admin/newsletter-templates/new">Nuovo template</Link>} />
    <label className="flex min-h-11 items-center gap-3 font-semibold"><input type="checkbox" checked={showArchived} onChange={event => setShowArchived(event.target.checked)} />Mostra anche i template archiviati</label>
    {load.state === 'loading' && <p role="status">Caricamento template…</p>}
    {load.state === 'error' && <LoadError message={load.message} onRetry={reload} />}
    {load.state === 'ready' && <Panel>{items.length === 0 ? <EmptyState icon="list" title="Nessun template">Crea un modello per una newsletter generica o un annuncio evento.</EmptyState> : <ul className="divide-y divide-line">{items.map(item => <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 p-5">
      <div><Link className={`inline-flex min-h-11 items-center text-lg font-bold text-cyan-700 underline ${linkFocus}`} to={`/admin/newsletter-templates/${encodeURIComponent(item.id)}`}>{item.name}</Link><p className="text-sm text-muted">{item.kind === 'event' ? 'Annuncio evento' : 'Generico'} · Revisione {item.version}</p></div>
      {item.archived && <Badge kind="done">Archiviato</Badge>}
    </li>)}</ul>}</Panel>}
  </div>;
}

function TemplateEditor({ id, manage }: { id?: string; manage: boolean }) {
  const api = useAdminFetch();
  const navigate = useNavigate();
  const [record, setRecord] = useState<NewsletterTemplate | null>(null);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<NewsletterKind>('generic');
  const [subject, setSubject] = useState('');
  const [markdown, setMarkdown] = useState('');
  const [eventId, setEventId] = useState('');
  const [preview, setPreview] = useState<RenderedPreview | null>(null);
  const [previewMarkdown, setPreviewMarkdown] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [revision, setRevision] = useState(0);
  const [dialog, setDialog] = useState<'archive' | 'reload' | null>(null);
  const epoch = useRef(0);
  const mounted = useRef(true);
  const operation = useRef(false);
  const [events, reloadEvents] = useAdminLoad<NewsletterEvent[]>('/newsletters/events', kind === 'event');
  const dirty = record ? record.name !== name || record.subject !== subject || record.markdown !== markdown : !!(name || subject || markdown);
  const editable = manage && !record?.archived;
  const allowNavigation = useUnsavedChanges(dirty);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; epoch.current += 1; };
  }, []);
  const accept = (value: NewsletterTemplate) => {
    epoch.current += 1;
    setRecord(value);
    setName(value.name);
    setKind(value.kind);
    setSubject(value.subject);
    setMarkdown(value.markdown);
    setPreview(null);
  };
  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    setLoadError('');
    api<NewsletterTemplate>(pathOf(id), { signal: controller.signal })
      .then(value => { if (!controller.signal.aborted) accept(value); })
      .catch(error => { if (!controller.signal.aborted) setLoadError(newsletterError(error)); });
    return () => controller.abort();
  }, [api, id, revision]);
  const edit = (set: (value: string) => void, value: string) => { epoch.current += 1; setPreview(null); set(value); };
  const run = async (action: (ticket: number) => Promise<void>) => {
    if (operation.current) return;
    operation.current = true;
    setBusy(true);
    setError('');
    try { await action(epoch.current); }
    catch (error) {
      if (mounted.current) {
        const message = newsletterError(error);
        setError(message);
        notify('Operazione template non riuscita', { description: message, kind: 'error' });
      }
    } finally { operation.current = false; if (mounted.current) setBusy(false); }
  };
  const save = () => void run(async () => {
    if (!editable) return;
    const value = record
      ? await api<NewsletterTemplate>(pathOf(record.id), { method: 'PUT', body: JSON.stringify({ version: record.version, name, subject, markdown }) })
      : await api<NewsletterTemplate>('/newsletter-templates', jsonPost({ kind, name, subject, markdown }));
    if (!mounted.current) return;
    allowNavigation();
    accept(value);
    notify('Template salvato');
    if (!record) navigate(`/admin/newsletter-templates/${encodeURIComponent(value.id)}`, { replace: true });
  });
  const prepare = () => void run(async ticket => {
    if (!record || dirty) return;
    setPreview(null);
    const value = await api<RenderedPreview & { markdown: string }>(`${pathOf(record.id)}/preview`, jsonPost({ version: record.version, ...(kind === 'event' ? { eventId } : {}) }));
    if (mounted.current && ticket === epoch.current) { setPreview(value); setPreviewMarkdown(value.markdown); }
  });
  const archive = () => {
    setDialog(null);
    void run(async () => {
      if (!record || !manage || dirty) return;
      const value = await api<NewsletterTemplate>(`${pathOf(record.id)}/archive`, jsonPost({ version: record.version }));
      if (mounted.current) accept(value);
    });
  };
  const reload = () => { epoch.current += 1; setPreview(null); setRecord(null); setDialog(null); setRevision(value => value + 1); };
  if (id && !record) return loadError ? <LoadError message={loadError} onRetry={() => setRevision(value => value + 1)} /> : <p role="status">Caricamento template…</p>;
  if (!id && !manage) return <p role="alert">Per creare template servono i permessi di lettura e gestione.</p>;
  return <div className="space-y-6">
    <PageHeader title={record ? record.name : 'Nuovo template newsletter'} description={record ? `Revisione ${record.version}. Le bozze esistenti conservano la versione già generata.` : 'Un modello separato dalle singole newsletter.'} back={{ to: '/admin/newsletter-templates', label: 'Template newsletter' }} actions={record && <>
      <Button className={btn.ghost} isDisabled={busy} onPress={() => dirty ? setDialog('reload') : reload()}>Ricarica versione salvata</Button>
      {editable && <Button className={btn.secondary} isDisabled={busy || dirty} onPress={() => setDialog('archive')}>Archivia template</Button>}
    </>} />
    {!manage && <p className="rounded-xl bg-cyan-50 p-4">Modalità sola lettura.</p>}
    {record?.archived && <Badge kind="done">Template archiviato</Badge>}
    {error && <p role="alert" className="rounded-xl bg-[#fdecea] p-4 text-[#912018]">{error}</p>}
    <Panel className="p-5">
      <Form className="space-y-5" onSubmit={event => { event.preventDefault(); save(); }}>
        <TextInput label="Nome template" isRequired value={name} onChange={value => edit(setName, value)} isReadOnly={!editable} isDisabled={busy} />
        <label className="block space-y-1 text-sm font-semibold">Tipo<select className={editorInput} value={kind} disabled={!!record || !manage || busy} onChange={event => { epoch.current += 1; setKind(event.target.value as NewsletterKind); }}><option value="generic">Generico</option><option value="event">Annuncio evento</option></select></label>
        <TextInput label="Oggetto del template" isRequired value={subject} onChange={value => edit(setSubject, value)} isReadOnly={!editable} isDisabled={busy} />
        <MarkdownEditor value={markdown} onChange={value => edit(setMarkdown, value)} readOnly={!editable} disabled={busy} />
        {editable && <Button type="submit" className={btn.primary} isDisabled={busy || !name.trim() || !subject.trim() || (!!record && !dirty)}>Salva template</Button>}
        <p role="status" className="text-sm text-muted">{dirty ? 'Modifiche non salvate: salva prima dell’anteprima.' : 'Versione salvata. Nessuna bozza viene modificata automaticamente.'}</p>
      </Form>
    </Panel>
    <Panel className="space-y-4 p-5" labelledBy="template-placeholders">
      <h2 id="template-placeholders" className="text-xl font-bold">Segnaposto e anteprima</h2>
      <p>Usa Markdown, non HTML o codice. I segnaposto vengono sostituiti una sola volta dal server; non sono espressioni eseguibili. Per i template evento sono disponibili:</p>
      <ul className="grid gap-2 text-sm sm:grid-cols-2">{placeholders.map(value => <li key={value}><code>{`{{${value}}}`}</code></li>)}</ul>
      {kind === 'event' && <>
        {events.state === 'error' && <LoadError message={events.message} onRetry={reloadEvents} />}
        {events.state === 'loading' && <p role="status">Caricamento eventi…</p>}
        {events.state === 'ready' && <EventCombobox events={events.data} value={eventId} disabled={busy} onChange={value => edit(setEventId, value)} />}
        <p className="text-sm text-muted">Seleziona un evento per verificare i dati reali, inclusi orari, sede e interventi. Nessun contenuto di esempio viene inventato.</p>
      </>}
      <Button className={btn.secondary} isDisabled={!record || dirty || busy || (kind === 'event' && !eventId)} onPress={prepare}>Prepara anteprima template</Button>
    </Panel>
    {preview && !dirty && <>
      <ServerPreview preview={preview} />
      <details className="rounded-xl border border-line bg-white p-4"><summary className="min-h-11 cursor-pointer font-semibold">Markdown generato</summary><pre className="whitespace-pre-wrap break-words text-sm">{previewMarkdown}</pre></details>
    </>}
    {dialog === 'archive' && <ConfirmDialog title="Archiviare il template?" confirmLabel="Archivia template" onCancel={() => setDialog(null)} onConfirm={archive}><p>Le revisioni usate dalle newsletter rimangono disponibili. Il template non sarà proposto per le nuove generazioni.</p></ConfirmDialog>}
    {dialog === 'reload' && <ConfirmDialog title="Abbandonare le modifiche al template?" confirmLabel="Abbandona e ricarica" danger onCancel={() => setDialog(null)} onConfirm={reload}><p>Copia prima le tue modifiche: verranno sostituite dalla versione salvata sul server.</p></ConfirmDialog>}
  </div>;
}

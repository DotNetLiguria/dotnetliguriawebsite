import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button, ComboBox, Form, Input, Label, ListBox, ListBoxItem, Popover, Radio, RadioGroup, Text, ToggleButton } from 'react-aria-components';
import { useOidcFetch } from '@axa-fr/react-oidc';
import { AdminIcon } from '../icons';
import { Badge, EmptyState, LoadError, PageHeader, Panel, TextInput, btn, focusRing, linkFocus } from '../ui';
import { AdminLoad, AdminWorkshop, clean, nameKey, useAdminLoad } from '../adminApi';
import { notify } from '../toasts';
import { createQuestionnaireAdminApi, FetchLike } from '../../questionnaire/api';
import { formatDateTime } from '../../questionnaire/format';
import { statusLabels } from '../../questionnaire/status';
import type { CreateQuestionnaireRequest, QuestionnaireStatus, QuestionnaireSummary } from '../../questionnaire/types';
import { formatDate } from '../../site/format';
import { ConfirmDialog, ExtraIcon, ModalHeader, RecordModal, RowMenu, SearchBox, Skeleton, inputCls, pill, plural, table } from './listUi';

// Questionnaire list (role feedbackadmin) over src/questionnaire/api.ts; the designer and the results
// keep their own screens at /admin/questionnaires/:id/edit and /:id/results.

const STATUSES: QuestionnaireStatus[] = ['Draft', 'Published', 'Closed', 'Archived'];
// Published is the normal state of a live questionnaire: only the others get a badge.
const badgeTone: Partial<Record<QuestionnaireStatus, 'warn' | 'done'>> = { Draft: 'warn', Closed: 'done', Archived: 'done' };
const errorText = (error: unknown) => (error instanceof Error ? error.message : 'Operazione non riuscita.');
const editHref = (id: string) => `/admin/questionnaires/${id}/edit`;
const resultsHref = (id: string) => `/admin/questionnaires/${id}/results`;

const periodOf = (q: QuestionnaireSummary) => {
  if (!q.opensAt && !q.closesAt) return null;
  return [q.opensAt ? `dal ${formatDateTime(q.opensAt)}` : null, q.closesAt ? `al ${formatDateTime(q.closesAt)}` : null].filter(Boolean).join(' ');
};

function StatusBadge({ status }: { status: QuestionnaireStatus }) {
  const tone = badgeTone[status];
  return tone ? <Badge kind={tone}>{statusLabels[status]}</Badge> : null;
}

const radioCls = `group flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3.5 transition-colors data-[hovered]:border-cyan-200 data-[selected]:border-navy data-[selected]:bg-cyan-50/60 ${focusRing}`;
const RadioMark = () => (
  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2 border-[#c3d3df] transition-colors group-data-[selected]:border-navy" aria-hidden="true">
    <span className="size-2.5 rounded-full bg-navy opacity-0 transition-opacity group-data-[selected]:opacity-100" />
  </span>
);

function CreateForm({ workshops, busy, onCancel, onCreate }: {
  workshops: AdminWorkshop[];
  busy: boolean;
  onCancel: () => void;
  onCreate: (request: CreateQuestionnaireRequest) => void;
}) {
  const [template, setTemplate] = useState<CreateQuestionnaireRequest['template']>('workshopFeedback');
  const [title, setTitle] = useState('');
  const [workshopId, setWorkshopId] = useState<string | null>(null);
  const needsWorkshop = template === 'workshopFeedback';
  const canCreate = !busy && (!needsWorkshop || !!workshopId);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (canCreate) onCreate({ template, title: clean(title) || null, workshopId });
  };

  return (
    <Form onSubmit={submit} className="space-y-5">
      <RadioGroup value={template} onChange={value => setTemplate(value as CreateQuestionnaireRequest['template'])} className="block">
        <Label className="text-sm font-semibold text-navy">Modello</Label>
        <div className="mt-1.5 grid gap-2">
          <Radio value="workshopFeedback" className={radioCls}>
            <RadioMark />
            <span><span className="block font-bold">Feedback di un evento</span><span className="block text-sm text-muted">Valutazione complessiva, utilità, voto per ogni sessione dell'evento, argomenti futuri e suggerimenti.</span></span>
          </Radio>
          <Radio value="blank" className={radioCls}>
            <RadioMark />
            <span><span className="block font-bold">Questionario vuoto</span><span className="block text-sm text-muted">Parti da zero e aggiungi le domande che ti servono.</span></span>
          </Radio>
        </div>
      </RadioGroup>

      <ComboBox selectedKey={workshopId} onSelectionChange={key => setWorkshopId(key == null ? null : String(key))} defaultItems={workshops} menuTrigger="focus" isRequired={needsWorkshop} className="block">
        <Label className="text-sm font-semibold text-navy">{needsWorkshop ? 'Evento' : 'Evento collegato (facoltativo)'}{needsWorkshop && <span className="text-[#b42318]" aria-hidden="true"> *</span>}</Label>
        <div className="relative mt-1.5">
          <Input placeholder="Cerca per titolo" className={`${inputCls} pr-12`} />
          {/* React Aria names this button after the field label and opens the list of events. */}
          <Button className={`absolute inset-y-1 right-1 grid w-10 cursor-pointer place-items-center rounded-lg text-muted data-[hovered]:bg-cyan-50 ${focusRing}`}><AdminIcon name="chevron" /></Button>
        </div>
        <Text slot="description" className="mt-1.5 block text-sm text-muted">
          {needsWorkshop ? "Le sessioni dell'evento diventano le righe da valutare." : 'Collegalo a un evento per ritrovarlo dalla sua scheda.'}
        </Text>
        <Popover className="w-[var(--trigger-width)] rounded-xl border border-line bg-white p-1.5 shadow-lift outline-none">
          <ListBox className="max-h-72 overflow-y-auto outline-none" renderEmptyState={() => <p className="px-3 py-2 text-muted">Nessun evento trovato.</p>}>
            {(w: AdminWorkshop) => (
              <ListBoxItem id={w.workshopId} textValue={clean(w.title)} className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-lg px-3 outline-none data-[focused]:bg-cyan-50 data-[selected]:font-bold">
                <span className="truncate">{clean(w.title)}</span><span className="shrink-0 text-sm text-muted">{formatDate(w.eventDate)}</span>
              </ListBoxItem>
            )}
          </ListBox>
        </Popover>
      </ComboBox>

      <TextInput label="Titolo" value={title} onChange={setTitle} description="Facoltativo: se vuoto viene proposto un titolo automatico." />

      <div className="flex flex-wrap justify-end gap-2 pt-2">
        <Button onPress={onCancel} className={btn.ghost}>Annulla</Button>
        <Button type="submit" isDisabled={!canCreate} className={btn.primary}>{busy ? 'Creazione…' : 'Crea e modifica'}</Button>
      </div>
    </Form>
  );
}

export default function QuestionnairesPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { fetch } = useOidcFetch();
  const api = useMemo(() => createQuestionnaireAdminApi(fetch as FetchLike), [fetch]);
  const [load, setLoad] = useState<AdminLoad<QuestionnaireSummary[]>>({ state: 'loading' });
  const [version, setVersion] = useState(0);
  const reload = () => setVersion(v => v + 1);
  const [workshopsLoad] = useAdminLoad<AdminWorkshop[]>('/Workshop/Get?onlyPublished=false');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [toDelete, setToDelete] = useState<QuestionnaireSummary | null>(null);

  useEffect(() => {
    let alive = true;
    setLoad(current => (current.state === 'ready' ? current : { state: 'loading' }));
    api.list()
      .then(data => { if (alive) setLoad({ state: 'ready', data }); })
      .catch((error: unknown) => { if (alive) setLoad({ state: 'error', message: errorText(error) }); });
    return () => { alive = false; };
  }, [api, version]);

  const workshops = useMemo(() => [...(workshopsLoad.state === 'ready' ? workshopsLoad.data : [])].sort((a, b) => b.eventDate.localeCompare(a.eventDate)), [workshopsLoad]);
  const rows = load.state === 'ready' ? load.data : null;
  const sorted = useMemo(() => [...(rows ?? [])].sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '')), [rows]);
  const counts = useMemo(() => Object.fromEntries(STATUSES.map(s => [s, sorted.filter(q => q.status === s).length])) as Record<QuestionnaireStatus, number>, [sorted]);

  const requested = params.get('stato');
  const status = STATUSES.find(s => s === requested) ?? null;
  const creating = params.has('nuovo');
  const q = nameKey(query);
  const visible = sorted.filter(item => (!status || item.status === status) && (!q || nameKey(item.title).includes(q) || nameKey(item.workshopTitle).includes(q)));

  const withParam = (name: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value === null) next.delete(name); else next.set(name, value);
    return next;
  };
  const setStatus = (next: QuestionnaireStatus | null) => setParams(withParam('stato', next), { replace: true });
  const createHref = { pathname: '/admin/questionnaires', search: `?${withParam('nuovo', '1')}` };
  const closeCreate = () => setParams(withParam('nuovo', null));

  const create = async (request: CreateQuestionnaireRequest) => {
    setBusy(true);
    try {
      const created = await api.create(request);
      notify('Questionario creato', { description: created.title });
      navigate(editHref(created.questionnaireId));
    } catch (error) {
      notify('Creazione non riuscita', { description: errorText(error), kind: 'error' });
      setBusy(false);
    }
  };

  const duplicate = async (item: QuestionnaireSummary) => {
    setBusy(true);
    try {
      const copy = await api.duplicate(item.questionnaireId);
      notify('Questionario duplicato', { description: copy.title });
      navigate(editHref(copy.questionnaireId));
    } catch (error) {
      notify('Duplicazione non riuscita', { description: errorText(error), kind: 'error' });
      setBusy(false);
    }
  };

  const archive = async (item: QuestionnaireSummary) => {
    setBusy(true);
    try {
      await api.archive(item.questionnaireId);
      notify('Questionario archiviato', { description: item.title });
      reload();
    } catch (error) {
      notify('Archiviazione non riuscita', { description: errorText(error), kind: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!toDelete) return;
    setBusy(true);
    try {
      await api.remove(toDelete.questionnaireId);
      notify('Questionario eliminato', { description: toDelete.title });
      setToDelete(null);
      reload();
    } catch (error) {
      notify('Eliminazione non riuscita', { description: errorText(error), kind: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const menuFor = (item: QuestionnaireSummary) => (
    <RowMenu label={`Altre azioni per ${item.title}`} items={[
      { id: 'duplicate', label: 'Duplica', icon: <ExtraIcon name="copy" className="size-5 text-muted" />, isDisabled: busy, onAction: () => void duplicate(item) },
      { id: 'archive', label: 'Archivia', icon: <ExtraIcon name="archive" className="size-5 text-muted" />, isDisabled: busy || item.status === 'Archived', onAction: () => void archive(item) },
      { id: 'delete', label: item.responseCount > 0 ? 'Elimina… (ha risposte)' : 'Elimina…', icon: <AdminIcon name="trash" />, destructive: true, isDisabled: busy || item.responseCount > 0, onAction: () => setToDelete(item) },
    ]} />
  );

  return (
    <>
      <PageHeader
        title="Questionari"
        description={rows ? `${plural(rows.length, 'questionario', 'questionari')}, ${counts.Published} ${counts.Published === 1 ? 'pubblicato' : 'pubblicati'}.` : undefined}
        actions={<Link to={createHref} className={btn.primary}><AdminIcon name="plus" />Nuovo questionario</Link>}
      />

      <div className="mt-6 flex flex-wrap items-center gap-2.5" role="search">
        <SearchBox label="Cerca un questionario" placeholder="Titolo o evento" value={query} onChange={setQuery} />
        <div className="flex flex-wrap gap-2" role="group" aria-label="Stato">
          <ToggleButton isSelected={status === null} onChange={() => setStatus(null)} className={pill}>Tutti</ToggleButton>
          {STATUSES.map(s => (
            <ToggleButton key={s} isSelected={status === s} onChange={on => setStatus(on ? s : null)} className={pill}>
              {statusLabels[s]}{rows && <span className="tabular-nums">{counts[s]}</span>}
            </ToggleButton>
          ))}
        </div>
      </div>

      {load.state === 'error' && <div className="mt-5"><LoadError message={load.message} onRetry={reload} /></div>}
      {load.state === 'loading' && <div className="mt-5"><Skeleton /></div>}
      {rows && (
        <Panel className="mt-5 overflow-hidden">
          {visible.length ? (
            <>
              <table className={table.el}>
                <thead className={table.head}>
                  <tr>
                    <th scope="col" className={table.th}>Questionario</th>
                    <th scope="col" className={table.th}>Evento</th>
                    <th scope="col" className={`${table.th} text-right`}>Risposte</th>
                    <th scope="col" className={table.th}>Stato</th>
                    <th scope="col" className={`${table.th} w-36`}><span className="sr-only">Azioni</span></th>
                  </tr>
                </thead>
                <tbody className={table.body}>
                  {visible.map(item => {
                    const period = periodOf(item);
                    return (
                      <tr key={item.questionnaireId} className={table.row}>
                        <td className={table.td}>
                          <Link to={editHref(item.questionnaireId)} className={`block rounded-lg font-bold leading-snug hover:underline ${linkFocus}`}>{item.title}</Link>
                          <span className="block text-sm text-muted">{[period ? `Aperto ${period}` : null, item.updatedAt ? `modificato il ${formatDate(item.updatedAt)}` : null].filter(Boolean).join(' · ')}</span>
                        </td>
                        <td className={`${table.td} text-muted`}>{clean(item.workshopTitle) || '—'}</td>
                        <td className={`${table.td} text-right tabular-nums`}>
                          {item.responseCount > 0
                            ? <Link to={resultsHref(item.questionnaireId)} className={`rounded font-semibold text-cyan-700 hover:underline ${linkFocus}`}>{item.responseCount}</Link>
                            : <span className="text-muted">0</span>}
                        </td>
                        <td className={table.td}><StatusBadge status={item.status} /></td>
                        <td className={table.td}>
                          <span className={table.actions}>
                            <Link to={editHref(item.questionnaireId)} aria-label={`Modifica ${item.title}`} className={btn.icon}><AdminIcon name="pencil" /></Link>
                            <Link to={resultsHref(item.questionnaireId)} aria-label={`Risultati di ${item.title}`} className={btn.icon}><ExtraIcon name="chart" /></Link>
                            {menuFor(item)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <ul className={table.cards}>
                {visible.map(item => (
                  <li key={item.questionnaireId} className="flex items-start gap-3 p-4">
                    <span className="min-w-0 flex-1">
                      <Link to={editHref(item.questionnaireId)} className={`block rounded-lg font-bold leading-snug hover:underline ${linkFocus}`}>{item.title}</Link>
                      <span className="block text-sm text-muted">{clean(item.workshopTitle) || 'Nessun evento collegato'}</span>
                      <span className="mt-1.5 flex flex-wrap items-center gap-2">
                        <StatusBadge status={item.status} />
                        <Link to={resultsHref(item.questionnaireId)} className={`rounded text-sm font-semibold text-cyan-700 underline ${linkFocus}`}>{plural(item.responseCount, 'risposta', 'risposte')}</Link>
                      </span>
                    </span>
                    {menuFor(item)}
                  </li>
                ))}
              </ul>
              <p className={table.footer}>{visible.length} di {plural(sorted.length, 'questionario', 'questionari')}</p>
            </>
          ) : sorted.length === 0 ? (
            <EmptyState icon="clipboard" title="Nessun questionario" actions={<Link to={createHref} className={btn.secondary}><AdminIcon name="plus" />Nuovo questionario</Link>}>
              <p>Crea il primo: il modello «Feedback di un evento» ha già le domande per valutare le sessioni.</p>
            </EmptyState>
          ) : (
            <EmptyState icon="clipboard" title="Nessun questionario trovato" actions={<Button onPress={() => { setQuery(''); setStatus(null); }} className={btn.secondary}>Azzera i filtri</Button>}>
              <p>Nessun questionario corrisponde alla ricerca o al filtro sullo stato.</p>
            </EmptyState>
          )}
        </Panel>
      )}

      <RecordModal isOpen={creating} onOpenChange={isOpen => { if (!isOpen) closeCreate(); }} label="Nuovo questionario">
        <ModalHeader title="Nuovo questionario" />
        <div className="p-5 sm:p-6">
          <CreateForm workshops={workshops} busy={busy} onCancel={closeCreate} onCreate={request => void create(request)} />
        </div>
      </RecordModal>

      <ConfirmDialog
        isOpen={toDelete !== null}
        onOpenChange={isOpen => { if (!isOpen) setToDelete(null); }}
        title="Eliminare il questionario?"
        confirmLabel="Elimina"
        busyLabel="Eliminazione…"
        busy={busy}
        onConfirm={() => void remove()}
      >
        <p>«{toDelete?.title}» verrà eliminato definitivamente, con le sue domande.</p>
      </ConfirmDialog>
    </>
  );
}

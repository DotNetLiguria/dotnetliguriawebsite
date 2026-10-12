import React, { FC, useMemo, useState } from 'react';
import { Button, ToggleButton } from 'react-aria-components';
import { AdminIcon } from '../../admin/icons';
import { EmptyState, Panel, btn } from '../../admin/ui';
import { ConfirmDialog, ModalHeader, RecordModal, SearchBox, pill, plural, table } from '../../admin/pages/listUi';
import { useIsDesktop } from '../../admin/pages/listKit';
import { Icon, SelectField, dangerGhost, miniIcon } from '../QuestionnaireDesigner/designerUi';
import {
  DEFAULT_SORT, PAGE_SIZES, SortKey, SortState, filterResponses, nextSort, paginate, respondentName, sortResponses, sourceLabel,
} from './responsesModel';
import { formatAnswer, formatDateTime } from '../../questionnaire/format';
import { allQuestions } from '../../questionnaire/rules';
import type { Questionnaire, QuestionnaireResponse, ResponseSource } from '../../questionnaire/types';

const when = (response: QuestionnaireResponse) => formatDateTime(response.submittedAt);

function SortHeader({ label, sortKey, sort, onSort, align = 'left' }: { label: string; sortKey: SortKey; sort: SortState; onSort: (key: SortKey) => void; align?: 'left' | 'right' }) {
  const active = sort.key === sortKey;
  return (
    <th scope="col" aria-sort={active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : undefined} className={`${table.th} ${align === 'right' ? 'text-right' : ''}`}>
      <Button onPress={() => onSort(sortKey)} className={`-mx-2 inline-flex min-h-10 cursor-pointer items-center gap-1 rounded-lg px-2 font-semibold transition-colors data-[hovered]:text-navy ${active ? 'text-navy' : ''} focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-cyan-700 data-[focus-visible]:outline-3 data-[focus-visible]:outline-offset-2 data-[focus-visible]:outline-cyan-700`}>
        {label}
        <span className={`inline-block size-4 ${active ? '' : 'opacity-0'}`} aria-hidden="true">
          <AdminIcon name="chevron" className={`size-4 transition-transform ${active && sort.direction === 'asc' ? 'rotate-180' : ''}`} />
        </span>
      </Button>
    </th>
  );
}

const SORT_OPTIONS: { value: string; label: string; key: SortKey; direction: SortState['direction']; identified?: boolean }[] = [
  { value: 'submittedAt:desc', label: 'Più recenti', key: 'submittedAt', direction: 'desc' },
  { value: 'submittedAt:asc', label: 'Meno recenti', key: 'submittedAt', direction: 'asc' },
  { value: 'name:asc', label: 'Partecipante (A-Z)', key: 'name', direction: 'asc', identified: true },
  { value: 'email:asc', label: 'Email (A-Z)', key: 'email', direction: 'asc', identified: true },
  { value: 'answers:desc', label: 'Più risposte date', key: 'answers', direction: 'desc' },
  { value: 'source:asc', label: 'Origine (A-Z)', key: 'source', direction: 'asc' },
];

export interface ResponsesPanelProps {
  questionnaire: Questionnaire;
  responses: QuestionnaireResponse[];
  /** Deletes on the server and refreshes the data; failures are reported by the caller. */
  onDelete: (response: QuestionnaireResponse) => Promise<void>;
}

/** Every response: search, source filter, sortable columns, paging (a table from md, stacked cards on phones), detail and delete. */
const ResponsesPanel: FC<ResponsesPanelProps> = ({ questionnaire, responses, onDelete }) => {
  const desktop = useIsDesktop();
  const questions = useMemo(() => allQuestions(questionnaire).filter(q => q.type !== 'InfoText'), [questionnaire]);
  const [query, setQuery] = useState('');
  const [source, setSource] = useState<ResponseSource | null>(null);
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZES[0]);
  const [page, setPage] = useState(0);
  const [detail, setDetail] = useState<QuestionnaireResponse | null>(null);
  const [toDelete, setToDelete] = useState<QuestionnaireResponse | null>(null);
  const [deleting, setDeleting] = useState(false);

  const identified = responses.some(r => r.respondent);
  const sources = useMemo(() => [...new Set(responses.map(r => r.source))], [responses]);
  const sourceCounts = useMemo(() => Object.fromEntries(sources.map(s => [s, responses.filter(r => r.source === s).length])), [sources, responses]);
  const filtered = useMemo(() => filterResponses(responses, questions, query, source), [responses, questions, query, source]);
  const sorted = useMemo(() => sortResponses(filtered, sort), [filtered, sort]);
  const shown = paginate(sorted, page, pageSize);
  const filtering = query.trim() !== '' || source !== null;

  const changeSort = (key: SortKey) => { setSort(current => nextSort(current, key)); setPage(0); };
  const resetFilters = () => { setQuery(''); setSource(null); setPage(0); };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await onDelete(toDelete);
      setToDelete(null);
    } catch {
      // The caller has reported the failure: the dialog stays open so that the person can retry or cancel.
    } finally {
      setDeleting(false);
    }
  };

  const openDetail = (response: QuestionnaireResponse) => setDetail(response);
  const sortValue = `${sort.key}:${sort.direction}`;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2.5" role="search">
        <SearchBox label="Cerca nelle risposte" placeholder="Nome, email o testo" value={query} onChange={value => { setQuery(value); setPage(0); }} />
        {sources.length > 1 && (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Origine">
            <ToggleButton isSelected={source === null} onChange={() => { setSource(null); setPage(0); }} className={pill}>Tutte</ToggleButton>
            {sources.map(s => (
              <ToggleButton key={s} isSelected={source === s} onChange={on => { setSource(on ? s : null); setPage(0); }} className={pill}>
                {sourceLabel(s)}<span className="tabular-nums">{sourceCounts[s]}</span>
              </ToggleButton>
            ))}
          </div>
        )}
      </div>

      {!desktop && responses.length > 1 && (
        <div className="mt-4 max-w-xs">
          <SelectField label="Ordina per" value={SORT_OPTIONS.some(o => o.value === sortValue) ? sortValue : ''} onChange={value => {
            const option = SORT_OPTIONS.find(o => o.value === value);
            if (option) { setSort({ key: option.key, direction: option.direction }); setPage(0); }
          }}>
            {!SORT_OPTIONS.some(o => o.value === sortValue) && <option value="" disabled>Ordinamento personalizzato</option>}
            {SORT_OPTIONS.filter(o => !o.identified || identified).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </SelectField>
        </div>
      )}

      <Panel className="mt-4 overflow-hidden">
        {shown.total === 0 ? (
          filtering ? (
            <EmptyState icon="search" title="Nessuna risposta trovata" actions={<Button onPress={resetFilters} className={btn.secondary}>Azzera i filtri</Button>}>
              <p>Nessuna risposta corrisponde alla ricerca o all'origine scelta.</p>
            </EmptyState>
          ) : (
            <EmptyState icon="clipboard" title="Nessuna risposta"><p>Le risposte arrivano qui appena qualcuno compila il questionario.</p></EmptyState>
          )
        ) : desktop ? (
          <table className="w-full text-left">
            <caption className="sr-only">Risposte al questionario, {plural(shown.total, 'risposta', 'risposte')}</caption>
            <thead className={table.head}>
              <tr>
                <SortHeader label="Inviata" sortKey="submittedAt" sort={sort} onSort={changeSort} />
                {identified && <SortHeader label="Partecipante" sortKey="name" sort={sort} onSort={changeSort} />}
                {identified && <SortHeader label="Email" sortKey="email" sort={sort} onSort={changeSort} />}
                <SortHeader label="Risposte date" sortKey="answers" sort={sort} onSort={changeSort} align="right" />
                <SortHeader label="Origine" sortKey="source" sort={sort} onSort={changeSort} />
                <th scope="col" className={`${table.th} w-16`}><span className="sr-only">Azioni</span></th>
              </tr>
            </thead>
            <tbody className={table.body}>
              {shown.items.map(response => (
                <tr key={response.responseId} className={table.row} onDoubleClick={() => openDetail(response)}>
                  <td className={table.td}>
                    <Button aria-label={`Apri la risposta del ${when(response)}`} onPress={() => openDetail(response)} className="min-h-10 cursor-pointer rounded-lg font-bold text-cyan-700 hover:underline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-cyan-700 data-[focus-visible]:outline-3 data-[focus-visible]:outline-offset-2 data-[focus-visible]:outline-cyan-700">
                      {when(response)}
                    </Button>
                  </td>
                  {identified && <td className={table.td}>{respondentName(response) || <span className="text-muted">—</span>}</td>}
                  {identified && <td className={`${table.td} text-muted`}>{response.respondent?.email ?? '—'}</td>}
                  <td className={`${table.td} text-right tabular-nums`}>{response.answers.length}</td>
                  <td className={`${table.td} text-muted`}>{sourceLabel(response.source)}</td>
                  <td className={table.td}>
                    <span className={table.actions}>
                      <Button aria-label={`Elimina la risposta del ${when(response)}`} onPress={() => setToDelete(response)} className={miniIcon}><AdminIcon name="trash" /></Button>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <ul className="divide-y divide-line">
            {shown.items.map(response => (
              <li key={response.responseId} className="flex items-start gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <Button aria-label={`Apri la risposta del ${when(response)}`} onPress={() => openDetail(response)} className="min-h-10 cursor-pointer rounded-lg text-left font-bold text-cyan-700 underline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-cyan-700 data-[focus-visible]:outline-3 data-[focus-visible]:outline-offset-2 data-[focus-visible]:outline-cyan-700">
                    {when(response)}
                  </Button>
                  {identified && (
                    <p className="font-semibold">{respondentName(response) || '—'}<span className="block break-all text-sm font-normal text-muted">{response.respondent?.email}</span></p>
                  )}
                  <p className="text-sm text-muted">{plural(response.answers.length, 'risposta data', 'risposte date')} · {sourceLabel(response.source)}</p>
                </div>
                <Button aria-label={`Elimina la risposta del ${when(response)}`} onPress={() => setToDelete(response)} className={miniIcon}><AdminIcon name="trash" /></Button>
              </li>
            ))}
          </ul>
        )}
        {shown.total > 0 && (
          <div className={`${table.footer} flex flex-wrap items-center justify-between gap-x-6 gap-y-3`}>
            <p role="status">
              {shown.from}–{shown.to} di {plural(shown.total, 'risposta', 'risposte')}{filtering ? ` (su ${responses.length})` : ''}
            </p>
            {shown.total > PAGE_SIZES[0] && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <label className="flex items-center gap-2">
                  Righe per pagina
                  <select
                    value={pageSize}
                    onChange={event => { setPageSize(Number(event.target.value)); setPage(0); }}
                    className="min-h-10 cursor-pointer rounded-xl border border-line bg-white px-2 text-navy outline-none focus:border-cyan-700 focus:ring-3 focus:ring-cyan-700/25"
                  >
                    {PAGE_SIZES.map(size => <option key={size} value={size}>{size}</option>)}
                  </select>
                </label>
                <span className="flex items-center gap-1">
                  <Button aria-label="Pagina precedente" isDisabled={shown.page === 0} onPress={() => setPage(shown.page - 1)} className={miniIcon}><Icon name="up" className="size-5 -rotate-90" /></Button>
                  <span className="tabular-nums">Pagina {shown.page + 1} di {shown.pageCount}</span>
                  <Button aria-label="Pagina successiva" isDisabled={shown.page >= shown.pageCount - 1} onPress={() => setPage(shown.page + 1)} className={miniIcon}><Icon name="up" className="size-5 rotate-90" /></Button>
                </span>
              </div>
            )}
          </div>
        )}
      </Panel>

      <RecordModal isOpen={detail !== null} onOpenChange={isOpen => { if (!isOpen) setDetail(null); }} label={`Risposta del ${detail ? when(detail) : ''}`}>
        <ModalHeader title={`Risposta del ${detail ? when(detail) : ''}`}>
          {detail?.respondent && (
            <p className="mt-1 text-muted">
              {respondentName(detail)}{detail.respondent.email ? `${respondentName(detail) ? ' · ' : ''}${detail.respondent.email}` : ''}
            </p>
          )}
        </ModalHeader>
        <div className="p-5 sm:p-6">
          <dl className="divide-y divide-line">
            {detail && questions.map(q => {
              const value = formatAnswer(q, detail.answers.find(a => a.questionId === q.id));
              return (
                <div key={q.id} className="py-3 first:pt-0">
                  <dt className="text-sm font-semibold text-muted">{q.title || '(senza titolo)'}</dt>
                  <dd className={`mt-0.5 whitespace-pre-wrap ${value ? '' : 'text-muted'}`}>{value || '—'}</dd>
                </div>
              );
            })}
          </dl>
          {detail && (
            <p className="mt-5 text-sm text-muted">
              Origine: {sourceLabel(detail.source)} · Versione del questionario: {detail.questionnaireVersion}
              {detail.respondent ? ` · Consenso privacy: ${detail.consentGiven ? 'sì' : 'no'}` : ''}
            </p>
          )}
          <div className="mt-6 flex justify-end">
            <Button onPress={() => { setToDelete(detail); setDetail(null); }} className={dangerGhost}><AdminIcon name="trash" />Elimina risposta</Button>
          </div>
        </div>
      </RecordModal>

      <ConfirmDialog
        isOpen={toDelete !== null}
        onOpenChange={isOpen => { if (!isOpen) setToDelete(null); }}
        title="Eliminare la risposta?"
        confirmLabel="Elimina"
        busyLabel="Eliminazione…"
        busy={deleting}
        onConfirm={() => void confirmDelete()}
      >
        <p>La risposta del {toDelete ? when(toDelete) : ''} verrà eliminata definitivamente.</p>
      </ConfirmDialog>
    </div>
  );
};

export default ResponsesPanel;

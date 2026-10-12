import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Button, Tab, TabList, TabPanel, Tabs } from 'react-aria-components';
import { useOidcFetch } from '@axa-fr/react-oidc';
import { AdminIcon } from '../../admin/icons';
import { EmptyState, LoadError, PageHeader, Panel, btn, focusRing } from '../../admin/ui';
import { ExternalLink, SearchBox, Skeleton, plural } from '../../admin/pages/listUi';
import { notify } from '../../admin/toasts';
import { Icon, StatusBadge } from '../QuestionnaireDesigner/designerUi';
import { ResponsesPerDay } from './ResultsCharts';
import { QuestionResult } from './ResultsSummary';
import ResponsesPanel from './ResponsesPanel';
import { createQuestionnaireAdminApi, publicQuestionnaireUrl } from '../../questionnaire/api';
import { formatDate, formatDateTime } from '../../questionnaire/format';
import { allQuestions } from '../../questionnaire/rules';
import type { Questionnaire, QuestionnaireResponse, QuestionnaireStatistics } from '../../questionnaire/types';

interface ResultsData {
  questionnaire: Questionnaire;
  stats: QuestionnaireStatistics;
  responses: QuestionnaireResponse[];
}

const errorText = (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback);

const tabCls = `-mb-px inline-flex min-h-11 cursor-pointer items-center border-b-[3px] border-transparent px-4 font-bold text-muted transition-colors data-[hovered]:text-navy data-[selected]:border-navy data-[selected]:text-navy ${focusRing}`;

const periodOf = (questionnaire: Questionnaire) => {
  const parts = [
    questionnaire.opensAt ? `dal ${formatDateTime(questionnaire.opensAt)}` : null,
    questionnaire.closesAt ? `al ${formatDateTime(questionnaire.closesAt)}` : null,
  ].filter(Boolean);
  return parts.length ? `Aperto ${parts.join(' ')}` : null;
};

const Stat: FC<{ label: string; children: React.ReactNode; large?: boolean }> = ({ label, children, large }) => (
  <div>
    <dt className="text-sm font-semibold text-muted">{label}</dt>
    <dd className={`mt-0.5 font-bold tabular-nums ${large ? 'text-3xl' : 'text-xl'}`}>{children}</dd>
  </div>
);

const QuestionnaireResults: FC = () => {
  const { id = '' } = useParams<{ id: string }>();
  const [params, setParams] = useSearchParams();
  const { fetch } = useOidcFetch();
  const api = useMemo(() => createQuestionnaireAdminApi(fetch), [fetch]);
  const [data, setData] = useState<ResultsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [version, setVersion] = useState(0);
  const [filter, setFilter] = useState('');
  const [exporting, setExporting] = useState(false);
  const reload = useCallback(() => setVersion(v => v + 1), []);

  // A load that is superseded (new id, refresh, unmount) never overwrites newer data.
  useEffect(() => {
    let alive = true;
    setData(current => (current?.questionnaire.questionnaireId === id ? current : null));
    setRefreshing(true);
    Promise.all([api.get(id), api.statistics(id), api.responses(id)])
      .then(([questionnaire, stats, responses]) => {
        if (!alive) return;
        setData({ questionnaire, stats, responses });
        setError(null);
      })
      .catch((err: unknown) => { if (alive) setError(errorText(err, 'Impossibile caricare i risultati.')); })
      .finally(() => { if (alive) setRefreshing(false); });
    return () => { alive = false; };
  }, [api, id, version]);

  const questions = useMemo(() => new Map((data ? allQuestions(data.questionnaire) : []).map(q => [q.id, q])), [data]);
  const tab = params.get('vista') === 'risposte' ? 'risposte' : 'riepilogo';
  const setTab = (next: string) => {
    const nextParams = new URLSearchParams(params);
    if (next === 'risposte') nextParams.set('vista', 'risposte'); else nextParams.delete('vista');
    setParams(nextParams, { replace: true });
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const blob = await api.exportCsv(id);
      const filename = `${(data?.questionnaire.title || 'questionario').replace(/[^\w-]+/g, '_')}.csv`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
      notify('Esportazione pronta', { description: filename });
    } catch (err) {
      notify('Esportazione non riuscita', { description: errorText(err, 'Riprova tra qualche istante.'), kind: 'error' });
    } finally {
      setExporting(false);
    }
  };

  const deleteResponse = async (response: QuestionnaireResponse) => {
    try {
      await api.removeResponse(id, response.responseId);
      notify('Risposta eliminata', { description: formatDateTime(response.submittedAt) });
      reload();
    } catch (err) {
      notify('Eliminazione non riuscita', { description: errorText(err, 'Riprova tra qualche istante.'), kind: 'error' });
      throw err;
    }
  };

  const back = { to: '/admin/questionnaires', label: 'Questionari' };

  if (!data) {
    return (
      <>
        <PageHeader title="Risultati" back={back} />
        <div className="mt-6">
          {error ? <LoadError message={error} onRetry={reload} /> : (
            <>
              <p role="status" className="sr-only">Caricamento dei risultati…</p>
              <Skeleton className="h-96" />
            </>
          )}
        </div>
      </>
    );
  }

  const { questionnaire, stats, responses } = data;
  const period = periodOf(questionnaire);

  return (
    <>
      <PageHeader
        back={back}
        title={`Risultati: ${questionnaire.title}`}
        description={(
          <>
            {plural(stats.responseCount, 'risposta', 'risposte')}{period ? ` · ${period}` : ''}
            {questionnaire.status !== 'Published' && <span className="ml-2 align-middle"><StatusBadge status={questionnaire.status} /></span>}
          </>
        )}
        actions={(
          <>
            <Button isDisabled={refreshing} onPress={reload} className={btn.ghost}><Icon name="refresh" />{refreshing ? 'Aggiornamento…' : 'Aggiorna'}</Button>
            <Link to={`/admin/questionnaires/${questionnaire.questionnaireId}/edit`} className={btn.ghost}><AdminIcon name="pencil" />Modifica</Link>
            {questionnaire.status === 'Published' && (
              <ExternalLink href={publicQuestionnaireUrl(questionnaire.questionnaireId)} className={`${btn.secondary} gap-1.5`}>Apri il link pubblico</ExternalLink>
            )}
            <Button isDisabled={exporting || stats.responseCount === 0} onPress={() => void exportCsv()} className={btn.primary}>
              <AdminIcon name="download" />{exporting ? 'Esportazione…' : 'Esporta CSV'}
            </Button>
          </>
        )}
      />

      {error && <div className="mt-5"><LoadError message={error} onRetry={reload} /></div>}

      <Panel className="mt-6 p-5 sm:p-6" labelledBy="results-numbers">
        <h2 id="results-numbers" className="sr-only">Numeri in sintesi</h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
          <Stat label="Risposte" large>{stats.responseCount}</Stat>
          <Stat label="Prima risposta">{formatDate(stats.firstResponseAt) || '—'}</Stat>
          <Stat label="Ultima risposta">{formatDate(stats.lastResponseAt) || '—'}</Stat>
          <Stat label="Domande">{stats.questions.length}</Stat>
        </dl>
      </Panel>

      <Tabs selectedKey={tab} onSelectionChange={key => setTab(String(key))} className="mt-6">
        <TabList aria-label="Sezioni dei risultati" className="flex gap-1 border-b border-line">
          <Tab id="riepilogo" className={tabCls}>Riepilogo</Tab>
          <Tab id="risposte" className={tabCls}>Risposte ({responses.length})</Tab>
        </TabList>

        <TabPanel id="riepilogo" className="mt-5 outline-none">
          {stats.responseCount === 0 ? (
            <Panel>
              <EmptyState
                icon="clipboard"
                title="Ancora nessuna risposta"
                actions={<Link to={`/admin/questionnaires/${questionnaire.questionnaireId}/edit`} className={btn.secondary}><Icon name="share" />Condividi dalla pagina di modifica</Link>}
              >
                <p>Condividi il link o il QR code: i risultati compaiono qui appena arriva la prima risposta.</p>
              </EmptyState>
            </Panel>
          ) : (
            <div className="space-y-4">
              {stats.responsesPerDay.length > 1 && (
                <Panel className="p-5 sm:p-6" labelledBy="results-per-day">
                  <h3 id="results-per-day" className="text-lg font-bold">Risposte per giorno</h3>
                  <div className="mt-3"><ResponsesPerDay data={stats.responsesPerDay} /></div>
                </Panel>
              )}
              <SearchBox label="Cerca nelle risposte testuali" placeholder="Cerca nelle risposte testuali" value={filter} onChange={setFilter} />
              {stats.questions.map(s => (
                <QuestionResult key={s.questionId} stats={s} question={questions.get(s.questionId)} total={stats.responseCount} filter={filter} />
              ))}
            </div>
          )}
        </TabPanel>

        <TabPanel id="risposte" className="mt-5 outline-none">
          <ResponsesPanel questionnaire={questionnaire} responses={responses} onDelete={deleteResponse} />
        </TabPanel>
      </Tabs>
    </>
  );
};

export default QuestionnaireResults;

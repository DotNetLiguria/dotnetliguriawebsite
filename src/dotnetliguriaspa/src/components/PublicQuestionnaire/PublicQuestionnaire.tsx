import React, { FC, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import QuestionnaireRunner from '../QuestionnaireRunner/QuestionnaireRunner';
import { publicQuestionnaireApi, QuestionnaireApiError } from '../../questionnaire/api';
import type { PublicQuestionnaireView } from '../../questionnaire/types';
import SiteLayout from '../../site/SiteLayout';
import { LogoArc } from '../../site/ui';

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleString('it-IT', { dateStyle: 'long', timeStyle: 'short' }) : '';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'loaded'; view: PublicQuestionnaireView };

const homeLink = (
  <Link to="/" className="mt-6 inline-flex min-h-11 items-center gap-2 font-bold text-cyan-700 underline decoration-2 underline-offset-4">
    Torna alla pagina iniziale
  </Link>
);

const PublicQuestionnaire: FC = () => {
  const { questionnaireId, workshopId } = useParams<{ questionnaireId?: string; workshopId?: string }>();
  const [state, setState] = useState<LoadState>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    setState({ kind: 'loading' });
    const load = questionnaireId
      ? publicQuestionnaireApi.get(questionnaireId)
      : workshopId
        ? publicQuestionnaireApi.byWorkshop(workshopId)
        : Promise.reject(new QuestionnaireApiError(404));
    load
      .then(view => !cancelled && setState({ kind: 'loaded', view }))
      .catch(err => {
        if (cancelled) return;
        const message = err instanceof QuestionnaireApiError && err.status === 404
          ? (workshopId ? 'Non ci sono questionari attivi per questo evento.' : 'Questionario non trovato.')
          : 'Impossibile caricare il questionario. Riprova più tardi.';
        setState({ kind: 'error', message });
      });
    return () => { cancelled = true; };
  }, [questionnaireId, workshopId]);

  const panel = 'rounded-3xl bg-white p-6 shadow-card sm:p-8';
  let content: React.ReactNode;
  if (state.kind === 'loading') {
    content = <div className={panel}><p className="text-lg font-semibold text-muted" role="status">Caricamento del questionario…</p></div>;
  } else if (state.kind === 'error') {
    content = (
      <div className={panel}>
        <h1 className="text-3xl font-bold">Questionario non disponibile</h1>
        <div><p className="mt-3 text-lg text-navy/85">{state.message}</p></div>
        {homeLink}
      </div>
    );
  } else {
    const { view } = state;
    if (view.availability === 'Open' && view.questionnaire) {
      const q = view.questionnaire;
      content = (
        <QuestionnaireRunner
          questionnaire={q}
          draftKey={`questionnaire-draft:${q.questionnaireId}:${q.version}`}
          onSubmit={async payload => { await publicQuestionnaireApi.submit(q.questionnaireId, payload); }}
        />
      );
    } else {
      const message = view.availability === 'NotYetOpen'
        ? `Il questionario sarà disponibile dal ${formatDate(view.opensAt)}.`
        : view.availability === 'Closed'
          ? 'Il questionario è chiuso e non accetta più risposte. Grazie per l\'interesse!'
          : 'Il questionario non è disponibile.';
      content = (
        <div className={panel}>
          <h1 className="text-3xl font-bold">{view.title}</h1>
          <div><p className="mt-3 text-lg text-navy/85">{message}</p></div>
          {homeLink}
        </div>
      );
    }
  }

  return (
    <SiteLayout>
      <div className="on-navy relative isolate overflow-hidden bg-navy" aria-hidden="true">
        <LogoArc className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-full w-full" />
        <div className="h-40 sm:h-48" />
      </div>
      <div className="relative mx-auto -mt-28 max-w-3xl px-4 pb-16 sm:-mt-32 sm:px-6">
        {content}
      </div>
    </SiteLayout>
  );
};

export default PublicQuestionnaire;

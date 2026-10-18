import React, { FC, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import QuestionnaireRunner from '../QuestionnaireRunner/QuestionnaireRunner';
import { publicQuestionnaireApi, QuestionnaireApiError } from '../../questionnaire/api';
import type { PublicQuestionnaireView } from '../../questionnaire/types';
import SiteLayout from '../../site/SiteLayout';
import PageMeta from '../../site/PageMeta';
import { LogoArc } from '../../site/ui';
import { useOidc, useOidcFetch, useOidcUser } from '@axa-fr/react-oidc';
import { getOidcPublicSettings } from '../../config/oidcConfig';

const DESCRIPTION = 'Questionario di feedback di un evento DotNetLiguria: valuta i talk e suggerisci i temi del prossimo incontro.';

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
  const { isAuthenticated, login } = useOidc();
  const { oidcUser } = useOidcUser();
  const { fetch: authenticatedFetch } = useOidcFetch();
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
  let title = 'Questionario';
  if (state.kind === 'loading') {
    content = <div className={panel}><p className="text-lg font-semibold text-muted" role="status">Caricamento del questionario…</p></div>;
  } else if (state.kind === 'error') {
    title = 'Questionario non disponibile';
    content = (
      <div className={panel}>
        <h1 className="text-3xl font-bold">Questionario non disponibile</h1>
        <div><p className="mt-3 text-lg text-navy/85">{state.message}</p></div>
        {homeLink}
      </div>
    );
  } else {
    const { view } = state;
    title = view.title || title;
    if (view.availability === 'Open' && view.questionnaire) {
      const q = view.questionnaire.respondentMode === 'Identified'
        ? { ...view.questionnaire, respondentMode: 'Authenticated' as const }
        : view.questionnaire;
      const requiresLogin = q.respondentMode === 'Authenticated';
      const draftOwner = requiresLogin
        ? `${getOidcPublicSettings().authority}|${String(oidcUser?.sub ?? '')}` : 'anonymous';
      content = requiresLogin && !isAuthenticated ? (
        <div className={panel}>
          <h1 className="text-3xl font-bold">{q.title}</h1>
          <p className="mt-3">Questo questionario richiede l'accesso con Keycloak. Nome ed email non vengono salvati con le risposte.</p>
          <button type="button" className="mt-5 rounded-full bg-navy px-6 py-3 font-bold text-white"
            onClick={() => void login(window.location.pathname)}>Accedi per compilare</button>
        </div>
      ) : requiresLogin && !oidcUser?.sub ? (
        <div className={panel} role="status">Caricamento dei dati di accesso…</div>
      ) : (
        <QuestionnaireRunner
          key={`${q.questionnaireId}:${draftOwner}`}
          questionnaire={q}
          draftOwner={draftOwner}
          draftKey={`questionnaire-draft:${q.questionnaireId}:${q.version}`}
          onSubmit={async payload => {
            await publicQuestionnaireApi.submit(q.questionnaireId, payload, requiresLogin ? authenticatedFetch : fetch);
          }}
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
      {/* Questionnaires are reached from a QR code or a link: never indexed. */}
      <PageMeta title={title} description={DESCRIPTION} noindex />
      <div className="on-navy relative isolate overflow-hidden bg-navy" aria-hidden="true">
        <LogoArc className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-full w-full" />
        <div className="h-40 sm:h-48" />
      </div>
      {/* site-questionnaire raises the scroll padding for the sticky progress bar (site.css). */}
      <div className="site-questionnaire relative mx-auto -mt-28 max-w-3xl px-4 pb-16 sm:-mt-32 sm:px-6">
        {content}
      </div>
    </SiteLayout>
  );
};

export default PublicQuestionnaire;

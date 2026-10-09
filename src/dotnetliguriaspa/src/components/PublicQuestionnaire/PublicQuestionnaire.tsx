import React, { FC, useEffect, useState } from 'react';
import { Alert, Box, CircularProgress, Container, Typography } from '@mui/material';
import { useParams } from 'react-router-dom';
import QuestionnaireRunner from '../QuestionnaireRunner/QuestionnaireRunner';
import { publicQuestionnaireApi, QuestionnaireApiError } from '../../questionnaire/api';
import type { PublicQuestionnaireView } from '../../questionnaire/types';

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleString('it-IT', { dateStyle: 'long', timeStyle: 'short' }) : '';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'loaded'; view: PublicQuestionnaireView };

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

  let content: React.ReactNode;
  if (state.kind === 'loading') {
    content = <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress aria-label="Caricamento" /></Box>;
  } else if (state.kind === 'error') {
    content = <Alert severity="info">{state.message}</Alert>;
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
        <>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 700, mb: 2 }}>{view.title}</Typography>
          <Alert severity="info">{message}</Alert>
        </>
      );
    }
  }

  return (
    <Container maxWidth="md" sx={{ mt: '80px', mb: 4, minHeight: 'calc(100vh - 200px)', px: { xs: 1.5, sm: 3 } }}>
      {content}
    </Container>
  );
};

export default PublicQuestionnaire;

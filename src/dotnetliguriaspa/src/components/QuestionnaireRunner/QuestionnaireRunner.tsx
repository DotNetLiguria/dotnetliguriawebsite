import React, { FC, useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Checkbox, FormControlLabel, FormHelperText, LinearProgress, Paper, Stack, Step, StepLabel, Stepper,
  TextField, Typography,
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlined';
import QuestionField from './QuestionField';
import { QuestionnaireApiError } from '../../questionnaire/api';
import { hasValue, isAnswerable, MAX_EMAIL_LENGTH, MAX_NAME_LENGTH, visibleQuestionIds } from '../../questionnaire/rules';
import type { AnswerMap, QuestionAnswer, Questionnaire, Respondent, SubmitQuestionnaireResponseRequest } from '../../questionnaire/types';
import { buildSubmission, validateResponse } from '../../questionnaire/validation';

export interface QuestionnaireRunnerProps {
  questionnaire: Questionnaire;
  /** When omitted the runner works in preview mode: it validates but never submits. */
  onSubmit?: (payload: SubmitQuestionnaireResponseRequest) => Promise<void>;
  /** localStorage key used to keep unsent answers across reloads. */
  draftKey?: string;
}

type Errors = Record<string, string>;
const RESPONDENT_FIELDS = ['respondent.name', 'respondent.surname', 'respondent.email', 'consentGiven'];

function loadDraft(key?: string): AnswerMap {
  if (!key) return {};
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as AnswerMap) : {};
  } catch {
    return {};
  }
}

const QuestionnaireRunner: FC<QuestionnaireRunnerProps> = ({ questionnaire, onSubmit, draftKey }) => {
  const preview = !onSubmit;
  const [answers, setAnswers] = useState<AnswerMap>(() => loadDraft(draftKey));
  const [respondent, setRespondent] = useState<Respondent>({});
  const [consentGiven, setConsentGiven] = useState(false);
  const [website, setWebsite] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [attempted, setAttempted] = useState(false);
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const identified = questionnaire.respondentMode === 'Identified';
  const visible = useMemo(() => visibleQuestionIds(questionnaire, answers), [questionnaire, answers]);
  const pages = useMemo(
    () => questionnaire.sections.filter(s => s.questions.some(q => visible.has(q.id))),
    [questionnaire.sections, visible],
  );
  const stepper = questionnaire.displayMode === 'Stepper' && pages.length > 1;
  const currentStep = Math.min(step, Math.max(0, pages.length - 1));
  const shownPages = stepper ? pages.slice(currentStep, currentStep + 1) : pages;
  const isLastStep = !stepper || currentStep === pages.length - 1;

  const numbers = useMemo(() => {
    const map = new Map<string, number>();
    let n = 0;
    for (const section of questionnaire.sections) {
      for (const q of section.questions) if (isAnswerable(q.type) && visible.has(q.id)) map.set(q.id, ++n);
    }
    return map;
  }, [questionnaire.sections, visible]);

  useEffect(() => {
    if (draftKey && !done) localStorage.setItem(draftKey, JSON.stringify(answers));
  }, [answers, draftKey, done]);

  const draft = () => ({ answers, respondent, consentGiven });
  const toErrors = (list: { questionId?: string | null; field: string; message: string }[]) =>
    Object.fromEntries(list.map(e => [e.questionId || e.field, e.message]));

  const fieldsForStep = (index: number) => {
    const ids = new Set(pages[index]?.questions.map(q => q.id));
    if (!stepper || index === 0) RESPONDENT_FIELDS.slice(0, 3).forEach(f => ids.add(f));
    if (!stepper || index === pages.length - 1) ids.add('consentGiven');
    return ids;
  };

  const runValidation = (onlyStep?: number) => {
    const all = toErrors(validateResponse(questionnaire, draft()));
    if (onlyStep === undefined) return all;
    const allowed = fieldsForStep(onlyStep);
    return Object.fromEntries(Object.entries(all).filter(([k]) => allowed.has(k)));
  };

  useEffect(() => {
    if (attempted) setErrors(runValidation(stepper && !isLastStep ? currentStep : undefined));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers, respondent, consentGiven]);

  const focusFirstError = (errs: Errors) => {
    const first = Object.keys(errs)[0];
    if (!first) return;
    const element = document.querySelector(`[data-question-id="${first}"], [data-field="${first}"]`);
    if (element && 'scrollIntoView' in element && typeof element.scrollIntoView === 'function') {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const setAnswer = (questionId: string, answer: QuestionAnswer | undefined) =>
    setAnswers(prev => ({ ...prev, [questionId]: answer }));

  const next = () => {
    const errs = runValidation(currentStep);
    setAttempted(true);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return focusFirstError(errs);
    setAttempted(false);
    setStep(currentStep + 1);
    window.scrollTo?.({ top: 0 });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    const errs = runValidation();
    setAttempted(true);
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      const firstStep = pages.findIndex((_, i) => Object.keys(errs).some(k => fieldsForStep(i).has(k)));
      if (stepper && firstStep >= 0) setStep(firstStep);
      return focusFirstError(errs);
    }
    if (preview) {
      setDone(true);
      return;
    }
    try {
      setSubmitting(true);
      await onSubmit!({ ...buildSubmission(questionnaire, draft()), website });
      if (draftKey) localStorage.removeItem(draftKey);
      setDone(true);
    } catch (err) {
      if (err instanceof QuestionnaireApiError) {
        if (err.problem?.errors?.length) setErrors(toErrors(err.problem.errors));
        if (err.status === 409) setSubmitError('Abbiamo già ricevuto una risposta associata a questa email. Grazie!');
        else if (err.status === 410) setSubmitError('Il questionario non accetta più risposte.');
        else setSubmitError(err.message);
      } else {
        setSubmitError('Invio non riuscito: controlla la connessione e riprova.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const restart = () => {
    setAnswers({});
    setRespondent({});
    setConsentGiven(false);
    setErrors({});
    setAttempted(false);
    setStep(0);
    setDone(false);
  };

  if (done) {
    return (
      <Paper variant="outlined" sx={{ p: { xs: 3, sm: 5 }, textAlign: 'center', borderRadius: 3 }} role="status">
        <CheckCircleOutlineIcon color="success" sx={{ fontSize: 64 }} />
        <Typography variant="h5" component="h2" sx={{ mt: 1, mb: 1 }}>
          {preview ? 'Anteprima: risposta valida' : 'Grazie!'}
        </Typography>
        <Typography color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
          {preview ? 'In anteprima le risposte non vengono inviate.' : questionnaire.thankYouText || 'La tua risposta è stata registrata.'}
        </Typography>
        {preview && <Button sx={{ mt: 3 }} onClick={restart}>Ricomincia</Button>}
      </Paper>
    );
  }

  const answeredCount = [...numbers.keys()].filter(id => hasValue(answers[id])).length;
  const progress = stepper ? ((currentStep + 1) / pages.length) * 100 : numbers.size ? (answeredCount / numbers.size) * 100 : 0;
  const showRespondent = identified && (!stepper || currentStep === 0);
  const respondentField = (field: keyof Respondent, label: string, max: number, type = 'text') => (
    <TextField
      label={label}
      required
      size="small"
      type={type}
      autoComplete={field === 'name' ? 'given-name' : field === 'surname' ? 'family-name' : 'email'}
      value={respondent[field] ?? ''}
      onChange={e => setRespondent(r => ({ ...r, [field]: e.target.value }))}
      error={!!errors[`respondent.${field}`]}
      helperText={errors[`respondent.${field}`]}
      slotProps={{ htmlInput: { maxLength: max, 'data-field': `respondent.${field}` } }}
      fullWidth
    />
  );

  return (
    <Box component="form" noValidate onSubmit={submit} aria-label={questionnaire.title}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 700, mb: 1 }}>{questionnaire.title}</Typography>
        {questionnaire.description && <Typography color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>{questionnaire.description}</Typography>}
        {questionnaire.introText && <Alert severity="info" sx={{ mt: 2, whiteSpace: 'pre-wrap' }}>{questionnaire.introText}</Alert>}
      </Box>

      <Box sx={{ position: 'sticky', top: { xs: 56, sm: 64 }, zIndex: 1, bgcolor: 'background.default', py: 1, mb: 2 }}>
        {stepper && (
          <Stepper activeStep={currentStep} alternativeLabel sx={{ mb: 1, display: { xs: 'none', sm: 'flex' } }}>
            {pages.map((p, i) => <Step key={p.id}><StepLabel>{p.title || `Parte ${i + 1}`}</StepLabel></Step>)}
          </Stepper>
        )}
        <LinearProgress variant="determinate" value={progress} aria-label="Avanzamento" sx={{ height: 6, borderRadius: 3 }} />
        {stepper && <Typography variant="caption" color="text.secondary">Passo {currentStep + 1} di {pages.length}</Typography>}
      </Box>

      {showRespondent && (
        <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, mb: 2, borderRadius: 3 }}>
          <Typography variant="h6" component="h2" sx={{ mb: 2 }}>I tuoi dati</Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
            {respondentField('name', 'Nome', MAX_NAME_LENGTH)}
            {respondentField('surname', 'Cognome', MAX_NAME_LENGTH)}
          </Stack>
          {respondentField('email', 'Email', MAX_EMAIL_LENGTH, 'email')}
          {questionnaire.onePerEmail && (
            <Typography variant="caption" color="text.secondary">È possibile inviare una sola risposta per indirizzo email.</Typography>
          )}
        </Paper>
      )}

      {shownPages.map(section => (
        <Paper key={section.id} variant="outlined" sx={{ p: { xs: 2, sm: 3 }, mb: 2, borderRadius: 3 }} component="section">
          {section.title && <Typography variant="h6" component="h2">{section.title}</Typography>}
          {section.description && <Typography color="text.secondary" sx={{ mb: 1, whiteSpace: 'pre-wrap' }}>{section.description}</Typography>}
          <Stack spacing={2} sx={{ mt: section.title ? 1 : 0 }}>
            {section.questions.filter(q => visible.has(q.id)).map(q => (
              <QuestionField
                key={q.id}
                question={q}
                number={numbers.get(q.id)}
                answer={answers[q.id]}
                error={errors[q.id]}
                disabled={submitting}
                onChange={a => setAnswer(q.id, a)}
              />
            ))}
          </Stack>
        </Paper>
      ))}

      {isLastStep && identified && questionnaire.consentText?.trim() && (
        <Box sx={{ mb: 2 }} data-field="consentGiven">
          <FormControlLabel
            control={<Checkbox checked={consentGiven} onChange={e => setConsentGiven(e.target.checked)} />}
            label={<Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{questionnaire.consentText}</Typography>}
          />
          {errors.consentGiven && <FormHelperText error role="alert">{errors.consentGiven}</FormHelperText>}
        </Box>
      )}

      <Box aria-hidden sx={{ position: 'absolute', left: '-10000px', width: 1, height: 1, overflow: 'hidden' }}>
        <label>
          Lascia vuoto questo campo
          <input tabIndex={-1} autoComplete="off" name="website" value={website} onChange={e => setWebsite(e.target.value)} />
        </label>
      </Box>

      {submitError && <Alert severity="error" sx={{ mb: 2 }} role="alert">{submitError}</Alert>}
      {attempted && Object.keys(errors).length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>Controlla le risposte evidenziate.</Alert>
      )}

      <Stack direction="row" spacing={2} sx={{ mb: 4, justifyContent: 'space-between' }}>
        {stepper && currentStep > 0
          ? <Button onClick={() => { setStep(currentStep - 1); setAttempted(false); setErrors({}); }}>Indietro</Button>
          : <span />}
        {isLastStep ? (
          <Button type="submit" variant="contained" size="large" disabled={submitting} sx={{ px: 5 }}>
            {submitting ? 'Invio…' : preview ? 'Prova invio' : 'Invia'}
          </Button>
        ) : (
          <Button variant="contained" size="large" onClick={next}>Avanti</Button>
        )}
      </Stack>
    </Box>
  );
};

export default QuestionnaireRunner;

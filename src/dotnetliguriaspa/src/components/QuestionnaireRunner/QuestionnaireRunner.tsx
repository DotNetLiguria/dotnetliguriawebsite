import React, { FC, useEffect, useMemo, useState } from 'react';
import { Button, Checkbox } from 'react-aria-components';
import QuestionField from './QuestionField';
import { QuestionnaireApiError } from '../../questionnaire/api';
import { hasValue, isAnswerable, visibleQuestionIds } from '../../questionnaire/rules';
import type { AnswerMap, QuestionAnswer, Questionnaire, Respondent, SubmitQuestionnaireResponseRequest } from '../../questionnaire/types';
import { buildSubmission, validateResponse } from '../../questionnaire/validation';
import { loadDraft, saveDraft, discardDraft } from '../../questionnaire/drafts';

export interface QuestionnaireRunnerProps {
  questionnaire: Questionnaire;
  /** When omitted the runner works in preview mode: it validates but never submits. */
  onSubmit?: (payload: SubmitQuestionnaireResponseRequest) => Promise<void>;
  /** Expiring session-storage key for unsent answers. */
  draftKey?: string;
  draftOwner?: string;
}

type Errors = Record<string, string>;
const ring = 'outline-none';
const primaryButton = `inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-full bg-site-green px-8 text-lg font-bold text-navy shadow-card transition data-[hovered]:-translate-y-0.5 data-[disabled]:cursor-default data-[disabled]:opacity-60 ${ring}`;
const secondaryButton = `inline-flex min-h-12 cursor-pointer items-center justify-center rounded-full border-2 border-navy px-6 font-bold text-navy transition data-[hovered]:bg-navy data-[hovered]:text-white ${ring}`;
const card = 'rounded-3xl bg-white p-6 shadow-card sm:p-8';
const Notice = ({ tone, children, role }: { tone: 'info' | 'warning' | 'error'; children: React.ReactNode; role?: string }) => (
  <div role={role} className={`rounded-2xl px-5 py-4 text-base font-semibold whitespace-pre-wrap ${tone === 'info' ? 'bg-cyan-50 text-navy' : tone === 'warning' ? 'bg-amber-50 text-amber-900' : 'bg-red-50 text-red-800'}`}>
    {children}
  </div>
);
const RESPONDENT_FIELDS = ['respondent.name', 'respondent.surname', 'respondent.email', 'consentGiven'];

const QuestionnaireRunner: FC<QuestionnaireRunnerProps> = ({ questionnaire, onSubmit, draftKey, draftOwner }) => {
  const preview = !onSubmit;
  const [answers, setAnswers] = useState<AnswerMap>(() => loadDraft(draftKey, draftOwner));
  const [respondent] = useState<Respondent>({});
  const [consentGiven, setConsentGiven] = useState(false);
  const [website, setWebsite] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [attempted, setAttempted] = useState(false);
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const identified = questionnaire.respondentMode !== 'Anonymous';
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
    if (draftKey && !done) saveDraft(draftKey, answers, draftOwner);
  }, [answers, draftKey, draftOwner, done]);

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

  /** Brings the first invalid question into view and moves focus to its first control (WCAG 3.3.1). */
  const focusFirstError = (errs: Errors) => {
    const first = Object.keys(errs)[0];
    if (!first) return;
    const element = document.querySelector<HTMLElement>(`[data-question-id="${first}"], [data-field="${first}"]`);
    if (!element) return;
    // Smoothness follows the page's scroll-behavior, which honours prefers-reduced-motion.
    if (typeof element.scrollIntoView === 'function') element.scrollIntoView({ block: 'center' });
    const control = 'input:not([type="hidden"]), textarea, select, button';
    (element.matches(control) ? element : element.querySelector<HTMLElement>(control))?.focus({ preventScroll: true });
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
      if (draftKey) discardDraft(draftKey);
      setDone(true);
    } catch (err) {
      if (err instanceof QuestionnaireApiError) {
        if (err.problem?.errors?.length) setErrors(toErrors(err.problem.errors));
        if (err.status === 409) setSubmitError('Abbiamo già ricevuto una risposta per questo account. Grazie!');
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
    setConsentGiven(false);
    setErrors({});
    setAttempted(false);
    setStep(0);
    setDone(false);
  };

  if (done) {
    return (
      <div className={`${card} text-center`} role="status">
        <svg viewBox="0 0 24 24" className="mx-auto size-16 text-basil-700" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9.5" />
          <path d="M7.5 12.5l3 3 6-6.5" />
        </svg>
        {/* The form (and its h1) is gone: this is now the page's main heading. */}
        <h1 className="mt-3 text-3xl font-bold">{preview ? 'Anteprima: risposta valida' : 'Grazie!'}</h1>
        <p className="mx-auto mt-2 max-w-xl whitespace-pre-wrap text-lg text-navy/85">
          {preview ? 'In anteprima le risposte non vengono inviate.' : questionnaire.thankYouText || 'La tua risposta è stata registrata.'}
        </p>
        {preview && <Button className={`mt-6 ${secondaryButton}`} onPress={restart}>Ricomincia</Button>}
      </div>
    );
  }

  const answeredCount = [...numbers.keys()].filter(id => hasValue(answers[id])).length;
  const progress = stepper ? ((currentStep + 1) / pages.length) * 100 : numbers.size ? (answeredCount / numbers.size) * 100 : 0;
  const progressText = stepper ? `Passo ${currentStep + 1} di ${pages.length}` : `${answeredCount} risposte su ${numbers.size}`;
  const anyRequired = identified || questionnaire.sections.some(s => s.questions.some(q => q.required));

  return (
    <form noValidate onSubmit={submit} aria-label={questionnaire.title} className="space-y-6">
      <header className={card}>
        <h1 className="text-3xl font-bold leading-tight sm:text-4xl">{questionnaire.title}</h1>
        {questionnaire.description && <p className="mt-3 whitespace-pre-wrap text-lg text-navy/85">{questionnaire.description}</p>}
        {questionnaire.introText && <div className="mt-5"><Notice tone="info">{questionnaire.introText}</Notice></div>}
        {anyRequired && <p className="mt-4 text-base text-muted">I campi contrassegnati con l'asterisco (<span className="text-red-700">*</span>) sono obbligatori.</p>}
      </header>

      <div className="sticky top-20 z-10 rounded-2xl bg-white/95 px-5 py-3 shadow-card backdrop-blur">
        {stepper && (
          <ol className="mb-2 hidden gap-2 sm:flex">
            {pages.map((p, i) => (
              <li key={p.id} className={`flex-1 truncate text-sm font-bold ${i === currentStep ? 'text-navy' : 'text-muted'}`} aria-current={i === currentStep ? 'step' : undefined}>
                {i + 1}. {p.title || `Parte ${i + 1}`}
              </li>
            ))}
          </ol>
        )}
        <div
          role="progressbar"
          aria-label="Avanzamento"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress)}
          aria-valuetext={progressText}
          className="h-2 overflow-hidden rounded-full bg-cyan-50"
        >
          {/* basil-700 on cyan-50 is 4.8:1: the bar reads without relying on the text below. */}
          <div className="h-full rounded-full bg-basil-700 transition-[width] duration-300" style={{ width: `${progress}%` }} />
        </div>
        {stepper && <p className="mt-1 text-sm text-muted">Passo {currentStep + 1} di {pages.length}</p>}
      </div>

      <p className="text-base text-muted">
        {identified ? "Accesso verificato da Keycloak: nome ed email non sono salvati con le risposte." : "Questionario anonimo: non inserire dati personali nelle risposte."}
      </p>

      {shownPages.map(section => (
        <section key={section.id} className={card}>
          {section.title && <h2 className="text-2xl font-bold">{section.title}</h2>}
          {section.description && <p className="mt-2 whitespace-pre-wrap text-base text-muted">{section.description}</p>}
          <div className={`space-y-6 ${section.title ? 'mt-5' : ''}`}>
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
          </div>
        </section>
      ))}

      {isLastStep && (identified || questionnaire.respondentMode === 'Authenticated') && questionnaire.consentText?.trim() && (
        <div className={card} data-field="consentGiven">
          <Checkbox
            isSelected={consentGiven}
            onChange={setConsentGiven}
            isRequired
            isInvalid={!!errors.consentGiven}
            aria-describedby={errors.consentGiven ? 'consent-error' : undefined}
            className={`flex cursor-pointer items-start gap-3 text-base ${ring}`}
          >
            {({ isSelected }) => (
              <>
                <span className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-md border-2 ${isSelected ? 'border-navy bg-navy' : errors.consentGiven ? 'border-red-700' : 'border-muted'}`} aria-hidden="true">
                  {isSelected && <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="white" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M3.5 8.5l3 3 6-7" /></svg>}
                </span>
                <span className="whitespace-pre-wrap">{questionnaire.consentText}</span>
              </>
            )}
          </Checkbox>
          <p className="mt-3 pl-9 text-base text-muted">
            Come trattiamo i tuoi dati: leggi l'
            <a href="/privacy" target="_blank" rel="noopener noreferrer" className="font-bold text-cyan-700 underline decoration-2 underline-offset-4">
              informativa sulla privacy{' '}<span className="sr-only">(si apre in una nuova scheda)</span>
            </a>.
          </p>
          {errors.consentGiven && <p id="consent-error" role="alert" className="mt-2 font-bold text-red-700">{errors.consentGiven}</p>}
        </div>
      )}

      <div aria-hidden="true" className="absolute -left-[10000px] size-px overflow-hidden">
        <label>
          Lascia vuoto questo campo
          <input tabIndex={-1} autoComplete="off" name="website" value={website} onChange={e => setWebsite(e.target.value)} />
        </label>
      </div>

      {submitError && <Notice tone="error" role="alert">{submitError}</Notice>}
      {attempted && Object.keys(errors).length > 0 && <Notice tone="warning" role="status">Controlla le risposte evidenziate.</Notice>}

      <div className="flex items-center justify-between gap-4 pb-4">
        {stepper && currentStep > 0
          ? <Button className={secondaryButton} onPress={() => { setStep(currentStep - 1); setAttempted(false); setErrors({}); }}>Indietro</Button>
          : <span />}
        {isLastStep ? (
          <Button type="submit" isDisabled={submitting} className={primaryButton}>
            {submitting ? 'Invio…' : preview ? 'Prova invio' : 'Invia'}
          </Button>
        ) : (
          <Button className={primaryButton} onPress={next}>Avanti</Button>
        )}
      </div>
    </form>
  );
};

export default QuestionnaireRunner;

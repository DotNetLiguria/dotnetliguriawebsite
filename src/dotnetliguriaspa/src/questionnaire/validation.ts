import {
  allQuestions, hasValue, isAnswerable, isValidEmail, operatorsFor, OTHER_OPTION_ID,
  DEFAULT_SHORT_TEXT_LENGTH, scaleBounds, textLimit, visibleQuestionIds,
} from './rules';
import type {
  AnswerMap, Question, QuestionAnswer, Questionnaire, QuestionnaireValidationError, Respondent,
} from './types';

export interface ResponseDraft {
  answers: AnswerMap;
  respondent: Respondent;
  consentGiven: boolean;
}

const REQUIRED = 'Risposta obbligatoria.';
const INVALID = 'Risposta non valida.';
const isInteger = (value: number | null | undefined, min: number, max: number) =>
  value !== null && value !== undefined && Number.isInteger(value) && value >= min && value <= max;

function validateAnswer(question: Question, answer: QuestionAnswer): string | null {
  switch (question.type) {
    case 'ShortText':
    case 'LongText':
    case 'Email':
    case 'Date': {
      const text = (answer.text ?? '').trim();
      if (!text) return INVALID;
      if (text.length > textLimit(question)) return `Massimo ${textLimit(question)} caratteri.`;
      if (question.type === 'Email' && !isValidEmail(text)) return 'Indirizzo email non valido.';
      if (question.type === 'Date' && !/^\d{4}-\d{2}-\d{2}$/.test(text)) return 'Data non valida.';
      return null;
    }
    case 'Number': {
      const n = answer.number;
      const { min, max } = question.settings;
      if (n === null || n === undefined || !Number.isFinite(n)
        || (min !== null && min !== undefined && n < min) || (max !== null && max !== undefined && n > max)) {
        return "Numero fuori dall'intervallo consentito.";
      }
      return null;
    }
    case 'Rating':
    case 'Scale': {
      const { min, max } = scaleBounds(question);
      return isInteger(answer.number, min, max) ? null : `Il valore deve essere tra ${min} e ${max}.`;
    }
    case 'YesNo':
      return answer.bool === null || answer.bool === undefined ? INVALID : null;
    case 'SingleChoice':
    case 'MultipleChoice': {
      const choices = [...new Set(answer.choices ?? [])];
      const allowed = new Set(question.options.map(o => o.id));
      if (question.settings.allowOther) allowed.add(OTHER_OPTION_ID);
      if (choices.length === 0 || choices.some(c => !allowed.has(c))) return INVALID;
      if (question.type === 'SingleChoice' && choices.length !== 1) return 'Seleziona una sola opzione.';
      if (question.type === 'MultipleChoice') {
        const min = Math.max(question.settings.minSelections ?? 0, question.required ? 1 : 0);
        const max = question.settings.maxSelections ?? allowed.size;
        if (choices.length < min || choices.length > max) {
          return min === max ? `Seleziona ${min} opzioni.` : `Seleziona da ${min} a ${max} opzioni.`;
        }
      }
      if (choices.includes(OTHER_OPTION_ID)) {
        const other = (answer.otherText ?? '').trim();
        if (!other) return 'Specifica il valore per "Altro".';
        if (other.length > DEFAULT_SHORT_TEXT_LENGTH) return `Massimo ${DEFAULT_SHORT_TEXT_LENGTH} caratteri.`;
      }
      return null;
    }
    case 'Matrix': {
      const { min, max } = scaleBounds(question);
      const rowIds = new Set(question.rows.map(r => r.id));
      const seen = new Set<string>();
      for (const row of answer.rows ?? []) {
        if (!rowIds.has(row.rowId) || seen.has(row.rowId) || !isInteger(row.value, min, max)) {
          return `Ogni valutazione deve essere tra ${min} e ${max}.`;
        }
        seen.add(row.rowId);
      }
      if (question.required && seen.size !== rowIds.size) return 'Valuta tutte le righe.';
      return null;
    }
    default:
      return null;
  }
}

// Client mirror of QuestionnaireResponseValidator; the server remains authoritative.
export function validateResponse(questionnaire: Questionnaire, draft: ResponseDraft, onlyQuestionIds?: Set<string>): QuestionnaireValidationError[] {
  const errors: QuestionnaireValidationError[] = [];
  const checkRespondent = !onlyQuestionIds;
  if (checkRespondent && questionnaire.respondentMode !== 'Anonymous') {
    if (questionnaire.consentText?.trim() && !draft.consentGiven) {
      errors.push({ field: 'consentGiven', message: "È necessario accettare l'informativa." });
    }
  }

  const visible = visibleQuestionIds(questionnaire, draft.answers);
  for (const question of allQuestions(questionnaire)) {
    if (!isAnswerable(question.type) || !visible.has(question.id)) continue;
    if (onlyQuestionIds && !onlyQuestionIds.has(question.id)) continue;
    const answer = draft.answers[question.id];
    if (!hasValue(answer)) {
      if (question.required) errors.push({ questionId: question.id, field: 'answers', message: REQUIRED });
      continue;
    }
    const error = validateAnswer(question, answer!);
    if (error) errors.push({ questionId: question.id, field: 'answers', message: error });
  }
  return errors;
}

// Builds the payload with only visible, answered questions and trimmed texts.
export function buildSubmission(questionnaire: Questionnaire, draft: ResponseDraft) {
  const visible = visibleQuestionIds(questionnaire, draft.answers);
  const answers = allQuestions(questionnaire)
    .filter(q => isAnswerable(q.type) && visible.has(q.id) && hasValue(draft.answers[q.id]))
    .map(q => {
      const answer = { ...draft.answers[q.id]!, questionId: q.id };
      if (answer.text) answer.text = answer.text.trim();
      if (!answer.choices?.includes(OTHER_OPTION_ID)) delete answer.otherText;
      return answer;
    });
  return {
    respondent: null,
    consentGiven: draft.consentGiven,
    answers,
  };
}

// Client mirror of QuestionnaireDefinitionValidator (publish checklist).
export function validateDefinition(questionnaire: Questionnaire, forPublish = true): QuestionnaireValidationError[] {
  const errors: QuestionnaireValidationError[] = [];
  const add = (questionId: string | null, field: string, message: string) => errors.push({ questionId, field, message });

  if (!questionnaire.title.trim()) add(null, 'title', 'Il titolo è obbligatorio.');
  else if (questionnaire.title.length > 200) add(null, 'title', 'Il titolo non può superare 200 caratteri.');
  if (questionnaire.opensAt && questionnaire.closesAt && new Date(questionnaire.opensAt) >= new Date(questionnaire.closesAt)) {
    add(null, 'closesAt', 'La data di chiusura deve seguire quella di apertura.');
  }
  if ((questionnaire.onePerEmail || questionnaire.onePerAccount) && questionnaire.respondentMode === 'Anonymous') {
    add(null, 'onePerEmail', 'Una risposta per email richiede rispondenti identificati.');
  }

  const ids = new Set<string>();
  for (const question of allQuestions(questionnaire)) {
    if (!question.id || ids.has(question.id)) add(question.id, 'id', 'Ogni domanda deve avere un identificativo univoco.');
    ids.add(question.id);
  }
  if (!forPublish) return errors;

  const questions = allQuestions(questionnaire);
  if (!questions.some(q => isAnswerable(q.type))) add(null, 'sections', 'Aggiungi almeno una domanda.');

  questions.forEach((question, index) => {
    const q = (field: string, message: string) => add(question.id, field, message);
    if (question.type === 'InfoText') {
      if (!question.title.trim() && !question.helpText?.trim()) q('title', 'Il blocco di testo è vuoto.');
    } else if (!question.title.trim()) {
      q('title', 'Il testo della domanda è obbligatorio.');
    }

    const s = question.settings;
    if (question.type === 'SingleChoice' || question.type === 'MultipleChoice') {
      if (question.options.length < 2) q('options', 'Servono almeno due opzioni.');
      if (question.options.some(o => !o.label.trim())) q('options', 'Ogni opzione deve avere un testo.');
      else if (new Set(question.options.map(o => o.label.trim().toLowerCase())).size !== question.options.length) {
        q('options', 'Le opzioni non possono essere duplicate.');
      }
      if (question.type === 'MultipleChoice') {
        const available = question.options.length + (s.allowOther ? 1 : 0);
        const min = s.minSelections ?? 0;
        const max = s.maxSelections ?? available;
        if (min < 0 || min > max || max > available || max < 1) {
          q('settings', 'Il numero di selezioni minimo/massimo non è coerente con le opzioni.');
        }
      }
    } else if (question.type === 'Rating') {
      const stars = s.max ?? 5;
      if (stars < 3 || stars > 10 || !Number.isInteger(stars)) q('settings.max', 'Il numero di stelle deve essere tra 3 e 10.');
    } else if (question.type === 'Scale' || question.type === 'Matrix') {
      const { min, max } = scaleBounds(question);
      if (min >= max || max - min > 10 || min < 0) q('settings', 'La scala deve avere minimo ≥ 0, minimo < massimo e al più 11 valori.');
      if (question.type === 'Matrix') {
        if (question.rows.length === 0) q('rows', 'Aggiungi almeno una riga.');
        if (question.rows.some(r => !r.label.trim())) q('rows', "Ogni riga deve avere un'etichetta.");
      }
    } else if (question.type === 'Number') {
      if (s.min != null && s.max != null && s.min > s.max) q('settings', 'Il minimo non può superare il massimo.');
    } else if (question.type === 'ShortText' || question.type === 'LongText') {
      if (s.maxLength != null && (s.maxLength < 1 || s.maxLength > 10000)) q('settings.maxLength', 'La lunghezza massima deve essere tra 1 e 10000.');
    }

    const condition = question.visibleIf;
    if (condition) {
      const source = questions.slice(0, index).find(p => p.id === condition.questionId);
      if (!source || !isAnswerable(source.type)) {
        q('visibleIf', 'La condizione deve riferirsi a una domanda precedente.');
      } else if (!operatorsFor(source.type).includes(condition.operator)) {
        q('visibleIf', 'La condizione non è compatibile con il tipo della domanda di riferimento.');
      } else if (condition.operator !== 'Answered' && condition.operator !== 'NotAnswered') {
        const value = condition.value?.trim();
        if (!value) q('visibleIf', 'La condizione richiede un valore.');
        else if ((source.type === 'SingleChoice' || source.type === 'MultipleChoice')
          && value !== OTHER_OPTION_ID && !source.options.some(o => o.id === value)) {
          q('visibleIf', 'La condizione non è compatibile con il tipo della domanda di riferimento.');
        } else if (source.type === 'YesNo' && value !== 'true' && value !== 'false') {
          q('visibleIf', 'La condizione non è compatibile con il tipo della domanda di riferimento.');
        }
      }
    }
  });
  return errors;
}

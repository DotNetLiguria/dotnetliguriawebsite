import type { AnswerMap, ConditionOperator, Question, QuestionAnswer, Questionnaire, QuestionType, VisibilityCondition } from './types';

export const OTHER_OPTION_ID = '__other';
export const DEFAULT_SHORT_TEXT_LENGTH = 500;
export const DEFAULT_LONG_TEXT_LENGTH = 4000;
export const MAX_EMAIL_LENGTH = 250;
export const MAX_NAME_LENGTH = 50;

export const isAnswerable = (type: QuestionType) => type !== 'InfoText';
export const isNumeric = (type: QuestionType) => type === 'Number' || type === 'Rating' || type === 'Scale';
export const isChoice = (type: QuestionType) => type === 'SingleChoice' || type === 'MultipleChoice';

export function scaleBounds(question: Question): { min: number; max: number } {
  const { min, max } = question.settings ?? {};
  switch (question.type) {
    case 'Rating': return { min: 1, max: Math.trunc(max ?? 5) };
    case 'Scale': return { min: Math.trunc(min ?? 0), max: Math.trunc(max ?? 10) };
    case 'Matrix': return { min: Math.trunc(min ?? 1), max: Math.trunc(max ?? 5) };
    default: return { min: 0, max: 0 };
  }
}

export function textLimit(question: Question): number {
  if (question.settings?.maxLength) return question.settings.maxLength;
  if (question.type === 'LongText') return DEFAULT_LONG_TEXT_LENGTH;
  if (question.type === 'Email') return MAX_EMAIL_LENGTH;
  return DEFAULT_SHORT_TEXT_LENGTH;
}

export const allQuestions = (questionnaire: Pick<Questionnaire, 'sections'>): Question[] =>
  questionnaire.sections.flatMap(s => s.questions);

const hasText = (value?: string | null) => !!value && value.trim().length > 0;

export function hasValue(answer?: QuestionAnswer | null): boolean {
  if (!answer) return false;
  return hasText(answer.text)
    || (answer.number !== undefined && answer.number !== null && !Number.isNaN(answer.number))
    || (answer.bool !== undefined && answer.bool !== null)
    || (!!answer.choices && answer.choices.length > 0)
    || (!!answer.rows && answer.rows.length > 0)
    || hasText(answer.otherText);
}

export function isValidEmail(email?: string | null): boolean {
  if (!email || !email.trim() || email.length > MAX_EMAIL_LENGTH) return false;
  const trimmed = email.trim();
  const at = trimmed.indexOf('@');
  return at > 0 && at === trimmed.lastIndexOf('@') && at < trimmed.length - 3
    && trimmed.indexOf('.', at) > at + 1 && !trimmed.endsWith('.') && !/\s/.test(trimmed);
}

const parseNumber = (value: string) => {
  if (value.trim() === '') return Number.NaN;
  return Number(value);
};

function areEqual(source: Question, answer: QuestionAnswer, value: string): boolean {
  if (isChoice(source.type)) return answer.choices?.includes(value) ?? false;
  if (source.type === 'YesNo') {
    const expected = value.toLowerCase();
    return answer.bool !== undefined && answer.bool !== null
      && (expected === 'true' || expected === 'false') && answer.bool === (expected === 'true');
  }
  if (isNumeric(source.type)) {
    const number = parseNumber(value);
    return !Number.isNaN(number) && answer.number === number;
  }
  return (answer.text ?? '').trim().toLowerCase() === value.toLowerCase();
}

export function matches(condition: VisibilityCondition, source: Question | undefined, answer: QuestionAnswer | undefined): boolean {
  const answered = hasValue(answer);
  if (condition.operator === 'Answered') return answered;
  if (condition.operator === 'NotAnswered') return !answered;
  if (!answered || !source || !answer) return false;

  const value = (condition.value ?? '').trim();
  const number = parseNumber(value);
  switch (condition.operator) {
    case 'Equals': return areEqual(source, answer, value);
    case 'NotEquals': return !areEqual(source, answer, value);
    case 'Contains':
      return isChoice(source.type)
        ? answer.choices?.includes(value) ?? false
        : (answer.text ?? '').toLowerCase().includes(value.toLowerCase());
    case 'GreaterOrEqual': return !Number.isNaN(number) && answer.number != null && answer.number >= number;
    case 'LessOrEqual': return !Number.isNaN(number) && answer.number != null && answer.number <= number;
    default: return false;
  }
}

// Same semantics as the server: answers of hidden source questions count as missing.
export function visibleQuestionIds(questionnaire: Pick<Questionnaire, 'sections'>, answers: AnswerMap): Set<string> {
  const visible = new Set<string>();
  const byId = new Map<string, Question>();
  for (const question of allQuestions(questionnaire)) {
    if (!byId.has(question.id)) byId.set(question.id, question);
  }
  for (const question of allQuestions(questionnaire)) {
    const condition = question.visibleIf;
    if (!condition || !condition.questionId) {
      visible.add(question.id);
      continue;
    }
    const source = byId.get(condition.questionId);
    const answer = source && visible.has(source.id) ? answers[source.id] : undefined;
    if (matches(condition, source, answer)) visible.add(question.id);
  }
  return visible;
}

export const operatorLabels: Record<ConditionOperator, string> = {
  Equals: 'è uguale a',
  NotEquals: 'è diverso da',
  Contains: 'contiene',
  GreaterOrEqual: 'è maggiore o uguale a',
  LessOrEqual: 'è minore o uguale a',
  Answered: 'ha una risposta',
  NotAnswered: 'non ha risposta',
};

// Operators that make sense for a given source question type (mirrors the server validator).
export function operatorsFor(type: QuestionType): ConditionOperator[] {
  switch (type) {
    case 'Matrix': return ['Answered', 'NotAnswered'];
    case 'SingleChoice':
    case 'MultipleChoice': return ['Equals', 'NotEquals', 'Contains', 'Answered', 'NotAnswered'];
    case 'YesNo': return ['Equals', 'NotEquals', 'Answered', 'NotAnswered'];
    case 'Number':
    case 'Rating':
    case 'Scale': return ['Equals', 'NotEquals', 'GreaterOrEqual', 'LessOrEqual', 'Answered', 'NotAnswered'];
    case 'InfoText': return [];
    default: return ['Equals', 'NotEquals', 'Contains', 'Answered', 'NotAnswered'];
  }
}

export const newId = () =>
  (globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`).replace(/-/g, '');

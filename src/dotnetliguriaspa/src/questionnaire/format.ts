import { OTHER_OPTION_ID } from './rules';
import type { Question, QuestionAnswer } from './types';

/** Human-readable rendering of a stored answer, used by the responses view. */
export function formatAnswer(question: Question | undefined, answer: QuestionAnswer | undefined): string {
  if (!answer) return '';
  if (answer.text != null && answer.text !== '') return answer.text;
  if (answer.number != null) {
    if (question?.type === 'Rating') return `${answer.number} / ${question.settings.max ?? 5}`;
    return String(answer.number);
  }
  if (answer.bool != null) return answer.bool ? 'Sì' : 'No';
  if (answer.choices?.length) {
    return answer.choices.map(id => {
      if (id === OTHER_OPTION_ID) return `${question?.settings.otherLabel ?? 'Altro'}${answer.otherText ? `: ${answer.otherText}` : ''}`;
      return question?.options.find(o => o.id === id)?.label ?? id;
    }).join(', ');
  }
  if (answer.rows?.length) {
    return answer.rows.map(r => `${question?.rows.find(row => row.id === r.rowId)?.label ?? r.rowId}: ${r.value}`).join('; ');
  }
  return '';
}

export const formatDateTime = (value?: string | null) =>
  value ? new Date(value).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' }) : '';

export const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString('it-IT', { dateStyle: 'medium' }) : '';

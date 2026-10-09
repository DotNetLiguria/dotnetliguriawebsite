import { newId } from './rules';
import type { Question, QuestionnaireSection, QuestionType } from './types';

export interface QuestionTypeInfo {
  type: QuestionType;
  label: string;
  description: string;
  group: 'Testo' | 'Scelta' | 'Valutazione' | 'Altro';
}

export const questionTypes: QuestionTypeInfo[] = [
  { type: 'ShortText', label: 'Testo breve', description: 'Una riga di testo', group: 'Testo' },
  { type: 'LongText', label: 'Testo lungo', description: 'Paragrafo libero', group: 'Testo' },
  { type: 'Email', label: 'Email', description: 'Indirizzo email validato', group: 'Testo' },
  { type: 'SingleChoice', label: 'Scelta singola', description: 'Una opzione (radio o menu)', group: 'Scelta' },
  { type: 'MultipleChoice', label: 'Scelta multipla', description: 'Più opzioni (caselle)', group: 'Scelta' },
  { type: 'YesNo', label: 'Sì / No', description: 'Risposta binaria', group: 'Scelta' },
  { type: 'Rating', label: 'Stelle', description: 'Valutazione da 1 a N stelle', group: 'Valutazione' },
  { type: 'Scale', label: 'Scala', description: 'Scala numerica (es. 0-10)', group: 'Valutazione' },
  { type: 'Matrix', label: 'Griglia', description: 'Valuta più righe sulla stessa scala', group: 'Valutazione' },
  { type: 'Number', label: 'Numero', description: 'Valore numerico', group: 'Altro' },
  { type: 'Date', label: 'Data', description: 'Selezione di una data', group: 'Altro' },
  { type: 'InfoText', label: 'Testo informativo', description: 'Blocco di testo senza risposta', group: 'Altro' },
];

export const questionTypeLabel = (type: QuestionType) =>
  questionTypes.find(t => t.type === type)?.label ?? type;

export function newQuestion(type: QuestionType): Question {
  const question: Question = {
    id: newId(), type, title: '', helpText: null, required: false, options: [], rows: [], settings: {}, visibleIf: null,
  };
  switch (type) {
    case 'SingleChoice':
    case 'MultipleChoice':
      question.options = [{ id: newId(), label: 'Opzione 1' }, { id: newId(), label: 'Opzione 2' }];
      break;
    case 'Rating':
      question.settings = { max: 5 };
      break;
    case 'Scale':
      question.settings = { min: 0, max: 10, minLabel: 'Per niente', maxLabel: 'Moltissimo' };
      break;
    case 'Matrix':
      question.settings = { min: 1, max: 5 };
      question.rows = [{ id: newId(), label: 'Riga 1' }, { id: newId(), label: 'Riga 2' }];
      break;
    case 'InfoText':
      question.title = 'Testo informativo';
      break;
  }
  return question;
}

// Changing type keeps id, text and condition; incompatible settings are reset.
export function changeQuestionType(question: Question, type: QuestionType): Question {
  if (question.type === type) return question;
  const fresh = newQuestion(type);
  const keepOptions = (type === 'SingleChoice' || type === 'MultipleChoice') && question.options.length > 0;
  return {
    ...fresh,
    id: question.id,
    title: question.title,
    helpText: question.helpText,
    required: type === 'InfoText' ? false : question.required,
    options: keepOptions ? question.options : fresh.options,
    settings: keepOptions ? { ...fresh.settings, allowOther: question.settings.allowOther, otherLabel: question.settings.otherLabel } : fresh.settings,
    visibleIf: question.visibleIf,
  };
}

export function cloneQuestion(question: Question): Question {
  return {
    ...structuredClone(question),
    id: newId(),
    title: question.title ? `${question.title} (copia)` : '',
  };
}

export const newSection = (title = ''): QuestionnaireSection => ({ id: newId(), title, description: null, questions: [] });

// Splits pasted text (one option per line), skipping blanks and duplicates.
export function parseOptionLines(text: string, existing: string[] = []): string[] {
  const seen = new Set(existing.map(l => l.trim().toLowerCase()));
  const result: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const label = line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim();
    if (!label || seen.has(label.toLowerCase())) continue;
    seen.add(label.toLowerCase());
    result.push(label);
  }
  return result;
}

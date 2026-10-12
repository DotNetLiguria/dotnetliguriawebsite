import { nameKey } from '../../admin/adminApi';
import { formatAnswer } from '../../questionnaire/format';
import { sourceLabels } from '../../questionnaire/status';
import type { Question, QuestionnaireResponse, ResponseSource, ValueCount } from '../../questionnaire/types';

// Pure helpers behind the responses table: search, source filter, sorting and paging.

export type SortKey = 'submittedAt' | 'name' | 'email' | 'answers' | 'source';
export interface SortState { key: SortKey; direction: 'asc' | 'desc' }

export const PAGE_SIZES = [25, 50, 100] as const;
export const DEFAULT_SORT: SortState = { key: 'submittedAt', direction: 'desc' };

export const respondentName = (response: QuestionnaireResponse) =>
  [response.respondent?.name, response.respondent?.surname].filter(Boolean).join(' ');
export const sourceLabel = (source: ResponseSource) => sourceLabels[source] ?? source;

/** A new sort column starts ascending, except the date (newest first) and the answer count (most first). */
export const firstDirection = (key: SortKey): SortState['direction'] => (key === 'submittedAt' || key === 'answers' ? 'desc' : 'asc');

/** Next sort after the column `key` was chosen: the same column flips its direction. */
export const nextSort = (current: SortState, key: SortKey): SortState =>
  (current.key === key ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' } : { key, direction: firstDirection(key) });

/** Everything a search can match for one response: respondent, source and the readable answers. */
function haystack(response: QuestionnaireResponse, questions: Map<string, Question>) {
  const answers = response.answers.map(answer => formatAnswer(questions.get(answer.questionId), answer));
  return nameKey([respondentName(response), response.respondent?.email, sourceLabel(response.source), ...answers].filter(Boolean).join(' \n '));
}

export function filterResponses(responses: QuestionnaireResponse[], questions: Question[], query: string, source: ResponseSource | null) {
  const byId = new Map(questions.map(q => [q.id, q]));
  const needle = nameKey(query);
  return responses.filter(response => (!source || response.source === source) && (!needle || haystack(response, byId).includes(needle)));
}

const compareText = (a: string, b: string) => a.localeCompare(b, 'it', { sensitivity: 'base' });
// Empty values go last whichever the direction.
const compareValues = (a: string | number, b: string | number, direction: 'asc' | 'desc') => {
  const aEmpty = a === '' || Number.isNaN(a);
  const bEmpty = b === '' || Number.isNaN(b);
  if (aEmpty || bEmpty) return Number(aEmpty) - Number(bEmpty);
  const order = typeof a === 'number' && typeof b === 'number' ? a - b : compareText(String(a), String(b));
  return direction === 'asc' ? order : -order;
};

const valueOf = (response: QuestionnaireResponse, key: SortKey): string | number => {
  switch (key) {
    case 'submittedAt': return Date.parse(response.submittedAt);
    case 'name': return respondentName(response);
    case 'email': return response.respondent?.email ?? '';
    case 'answers': return response.answers.length;
    case 'source': return sourceLabel(response.source);
  }
};

/** Sorted copy; ties fall back to the newest submission first, so the order is always deterministic. */
export function sortResponses(responses: QuestionnaireResponse[], sort: SortState) {
  return [...responses].sort((a, b) =>
    compareValues(valueOf(a, sort.key), valueOf(b, sort.key), sort.direction)
    || Date.parse(b.submittedAt) - Date.parse(a.submittedAt)
    || a.responseId.localeCompare(b.responseId));
}

export interface Page<T> {
  items: T[];
  /** Zero-based, clamped to the existing pages. */
  page: number;
  pageCount: number;
  /** 1-based position of the first and last item shown (0 when empty). */
  from: number;
  to: number;
  total: number;
}

export function paginate<T>(items: T[], page: number, pageSize: number): Page<T> {
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(Math.max(0, page), pageCount - 1);
  const start = current * pageSize;
  const shown = items.slice(start, start + pageSize);
  return { items: shown, page: current, pageCount, from: shown.length ? start + 1 : 0, to: start + shown.length, total: items.length };
}

/** Distribution with a zero for every value of the scale that nobody chose, so bars and tables line up. */
export function fillDistribution(data: ValueCount[], bounds?: { min: number; max: number } | null): ValueCount[] {
  if (!bounds || bounds.max < bounds.min) return [...data].sort((a, b) => a.value - b.value);
  const counts = new Map(data.map(d => [d.value, d.count]));
  const values = new Set([...counts.keys(), ...Array.from({ length: bounds.max - bounds.min + 1 }, (_, i) => bounds.min + i)]);
  return [...values].sort((a, b) => a - b).map(value => ({ value, count: counts.get(value) ?? 0 }));
}

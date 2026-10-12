import { DEFAULT_SORT, PAGE_SIZES, fillDistribution, filterResponses, firstDirection, nextSort, paginate, respondentName, sortResponses } from './responsesModel';
import type { Question, QuestionnaireResponse } from '../../questionnaire/types';

const response = (id: string, submittedAt: string, extra: Partial<QuestionnaireResponse> = {}): QuestionnaireResponse => ({
  responseId: id, questionnaireId: 'q1', questionnaireVersion: 1, submittedAt, consentGiven: true, source: 'Web', answers: [], ...extra,
});
const person = (name: string, surname: string, email: string) => ({ name, surname, email });

const questions: Question[] = [
  { id: 'topics', type: 'MultipleChoice', title: 'Argomenti', required: false, rows: [], settings: { allowOther: true }, options: [{ id: 'ai', label: 'AI' }, { id: 'web', label: 'Web' }] },
  { id: 'notes', type: 'LongText', title: 'Note', required: false, rows: [], settings: {}, options: [] },
];

const ada = response('r1', '2024-05-01T10:00:00Z', { respondent: person('Ada', 'Lovelace', 'ada@example.org'), answers: [{ questionId: 'topics', choices: ['ai'] }, { questionId: 'notes', text: 'Più demo dal vivo' }] });
const alan = response('r2', '2024-05-03T10:00:00Z', { respondent: person('Alan', 'Turing', 'alan@example.org'), source: 'LegacySqlServer', answers: [{ questionId: 'topics', choices: ['web', '__other'], otherText: 'Rust' }] });
const anonymous = response('r3', '2024-05-02T10:00:00Z', { answers: [{ questionId: 'notes', text: 'Perché no' }] });
const emile = response('r4', '2024-05-02T10:00:00Z', { respondent: person('Émile', 'Zola', 'emile@example.org') });
const all = [ada, alan, anonymous, emile];

describe('filterResponses', () => {
  test('matches name, email, source and the readable answers, ignoring case and accents', () => {
    const ids = (query: string, source = null as QuestionnaireResponse['source'] | null) => filterResponses(all, questions, query, source).map(r => r.responseId);
    expect(ids('')).toEqual(['r1', 'r2', 'r3', 'r4']);
    expect(ids('LOVELACE')).toEqual(['r1']);
    expect(ids('alan@')).toEqual(['r2']);
    expect(ids('emile')).toEqual(['r4']);
    expect(ids('demo dal vivo')).toEqual(['r1']);
    expect(ids('rust')).toEqual(['r2']);
    expect(ids('web')).toEqual(['r1', 'r2', 'r3', 'r4']); // the source label "Web" and an answer both match
    expect(ids('blazor server')).toEqual(['r2']);
    expect(ids('nessuna')).toEqual([]);
  });

  test('the source filter combines with the search', () => {
    expect(filterResponses(all, questions, '', 'LegacySqlServer').map(r => r.responseId)).toEqual(['r2']);
    expect(filterResponses(all, questions, 'ada', 'LegacySqlServer')).toEqual([]);
    expect(filterResponses(all, questions, 'ada', 'Web').map(r => r.responseId)).toEqual(['r1']);
  });
});

describe('sortResponses', () => {
  const order = (sorted: QuestionnaireResponse[]) => sorted.map(r => r.responseId);

  test('newest first by default, and oldest first when reversed', () => {
    expect(order(sortResponses(all, DEFAULT_SORT))).toEqual(['r2', 'r3', 'r4', 'r1']);
    expect(order(sortResponses(all, { key: 'submittedAt', direction: 'asc' }))).toEqual(['r1', 'r3', 'r4', 'r2']);
  });

  test('sorts people by name in Italian order, with anonymous responses always last', () => {
    expect(order(sortResponses(all, { key: 'name', direction: 'asc' }))).toEqual(['r1', 'r2', 'r4', 'r3']);
    expect(order(sortResponses(all, { key: 'name', direction: 'desc' }))).toEqual(['r4', 'r2', 'r1', 'r3']);
    expect(order(sortResponses(all, { key: 'email', direction: 'asc' }))).toEqual(['r1', 'r2', 'r4', 'r3']);
  });

  test('sorts by number of answers and by source label', () => {
    expect(order(sortResponses(all, { key: 'answers', direction: 'desc' }))[0]).toBe('r1');
    expect(order(sortResponses(all, { key: 'answers', direction: 'asc' })).at(-1)).toBe('r1');
    expect(order(sortResponses(all, { key: 'source', direction: 'asc' }))).toEqual(['r2', 'r3', 'r4', 'r1']);
  });

  test('does not touch the input', () => {
    const copy = [...all];
    sortResponses(all, { key: 'name', direction: 'desc' });
    expect(all).toEqual(copy);
  });
});

describe('nextSort', () => {
  test('a new column starts in its natural direction and the same column flips', () => {
    expect(firstDirection('submittedAt')).toBe('desc');
    expect(firstDirection('name')).toBe('asc');
    expect(nextSort(DEFAULT_SORT, 'name')).toEqual({ key: 'name', direction: 'asc' });
    expect(nextSort({ key: 'name', direction: 'asc' }, 'name')).toEqual({ key: 'name', direction: 'desc' });
    expect(nextSort({ key: 'name', direction: 'desc' }, 'name')).toEqual({ key: 'name', direction: 'asc' });
    expect(nextSort({ key: 'name', direction: 'asc' }, 'answers')).toEqual({ key: 'answers', direction: 'desc' });
  });
});

describe('paginate', () => {
  const items = Array.from({ length: 60 }, (_, i) => i + 1);

  test('slices pages and reports the position', () => {
    const first = paginate(items, 0, PAGE_SIZES[0]);
    expect(first).toMatchObject({ page: 0, pageCount: 3, from: 1, to: 25, total: 60 });
    expect(first.items).toHaveLength(25);
    const last = paginate(items, 2, 25);
    expect(last).toMatchObject({ page: 2, from: 51, to: 60 });
    expect(last.items).toEqual(items.slice(50));
  });

  test('clamps a page that no longer exists (after filtering) and handles an empty list', () => {
    expect(paginate(items, 9, 25).page).toBe(2);
    expect(paginate(items, -3, 25).page).toBe(0);
    expect(paginate([], 4, 25)).toEqual({ items: [], page: 0, pageCount: 1, from: 0, to: 0, total: 0 });
  });
});

describe('fillDistribution', () => {
  test('adds a zero for every value of the scale nobody chose and keeps stray values', () => {
    expect(fillDistribution([{ value: 4, count: 2 }, { value: 2, count: 1 }], { min: 1, max: 5 })).toEqual([
      { value: 1, count: 0 }, { value: 2, count: 1 }, { value: 3, count: 0 }, { value: 4, count: 2 }, { value: 5, count: 0 },
    ]);
    expect(fillDistribution([{ value: 0, count: 3 }], { min: 1, max: 2 }).map(d => d.value)).toEqual([0, 1, 2]);
  });

  test('without bounds the data is only sorted', () => {
    expect(fillDistribution([{ value: 3, count: 1 }, { value: 1, count: 1 }])).toEqual([{ value: 1, count: 1 }, { value: 3, count: 1 }]);
  });
});

describe('respondentName', () => {
  test('joins the available parts', () => {
    expect(respondentName(ada)).toBe('Ada Lovelace');
    expect(respondentName(anonymous)).toBe('');
    expect(respondentName(response('x', '2024-01-01T00:00:00Z', { respondent: { name: 'Solo' } }))).toBe('Solo');
  });
});

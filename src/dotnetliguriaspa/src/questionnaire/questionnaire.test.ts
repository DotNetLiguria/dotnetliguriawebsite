import { describe, expect, it, vi } from 'vitest';
import { hasFeedbackAdmin } from './adminAccess';
import { createQuestionnaireAdminApi, publicQuestionnaireApi, QuestionnaireApiError } from './api';
import { changeQuestionType, newQuestion, parseOptionLines } from './factory';
import { hasValue, isValidEmail, OTHER_OPTION_ID, visibleQuestionIds } from './rules';
import type { AnswerMap, Question, Questionnaire } from './types';
import { buildSubmission, validateDefinition, validateResponse } from './validation';

const question = (id: string, type: Question['type'], extra: Partial<Question> = {}): Question =>
  ({ ...newQuestion(type), id, title: `Domanda ${id}`, ...extra });

const questionnaire = (questions: Question[], extra: Partial<Questionnaire> = {}): Questionnaire => ({
  questionnaireId: 'q1', title: 'Test', status: 'Draft', respondentMode: 'Anonymous', onePerEmail: false,
  displayMode: 'SinglePage', sections: [{ id: 's1', questions }], version: 1, createdAt: '', updatedAt: '',
  origin: 'Web', responseCount: 0, ...extra,
});

const choice = (id: string, extra: Partial<Question> = {}) => question(id, 'SingleChoice', {
  options: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }], ...extra,
});

describe('questionnaire rules', () => {
  it('validates emails like the server', () => {
    expect(isValidEmail('mario.rossi@example.com')).toBe(true);
    expect(isValidEmail('a@bc')).toBe(false);
    expect(isValidEmail('a@@b.com')).toBe(false);
    expect(isValidEmail('a b@c.com')).toBe(false);
    expect(isValidEmail('mario@example.')).toBe(false);
  });

  it('detects answered values', () => {
    expect(hasValue({ questionId: 'x', text: '  ' })).toBe(false);
    expect(hasValue({ questionId: 'x', number: 0 })).toBe(true);
    expect(hasValue({ questionId: 'x', bool: false })).toBe(true);
    expect(hasValue({ questionId: 'x', choices: [] })).toBe(false);
  });

  it('chains visibility and ignores answers of hidden sources', () => {
    const q = questionnaire([
      choice('c1'),
      question('t1', 'ShortText', { visibleIf: { questionId: 'c1', operator: 'Equals', value: 'a' } }),
      question('t2', 'ShortText', { visibleIf: { questionId: 't1', operator: 'Answered' } }),
    ]);
    const answers: AnswerMap = { c1: { questionId: 'c1', choices: ['b'] }, t1: { questionId: 't1', text: 'x' } };
    expect([...visibleQuestionIds(q, answers)]).toEqual(['c1']);
    answers.c1 = { questionId: 'c1', choices: ['a'] };
    expect([...visibleQuestionIds(q, answers)]).toEqual(['c1', 't1', 't2']);
  });

  it('compares numbers and yes/no answers', () => {
    const q = questionnaire([
      question('r', 'Rating'),
      question('low', 'LongText', { visibleIf: { questionId: 'r', operator: 'LessOrEqual', value: '2' } }),
      question('yn', 'YesNo'),
      question('why', 'ShortText', { visibleIf: { questionId: 'yn', operator: 'Equals', value: 'false' } }),
    ]);
    const visible = visibleQuestionIds(q, { r: { questionId: 'r', number: 2 }, yn: { questionId: 'yn', bool: false } });
    expect(visible.has('low')).toBe(true);
    expect(visible.has('why')).toBe(true);
    expect(visibleQuestionIds(q, { r: { questionId: 'r', number: 4 } }).has('low')).toBe(false);
  });
});

describe('validateResponse', () => {
  it('requires visible required questions only', () => {
    const q = questionnaire([
      choice('c1', { required: true }),
      question('t1', 'ShortText', { required: true, visibleIf: { questionId: 'c1', operator: 'Equals', value: 'a' } }),
    ]);
    const draft = { answers: { c1: { questionId: 'c1', choices: ['b'] } }, respondent: {}, consentGiven: false };
    expect(validateResponse(q, draft)).toEqual([]);
    draft.answers.c1.choices = ['a'];
    expect(validateResponse(q, draft).map(e => e.questionId)).toEqual(['t1']);
  });

  it('validates ranges, other text, matrix rows and respondent fields', () => {
    const q = questionnaire([
      question('r', 'Rating'),
      choice('c', { settings: { allowOther: true } }),
      question('m', 'Matrix', { required: true, rows: [{ id: 'x', label: 'X' }, { id: 'y', label: 'Y' }] }),
    ], { respondentMode: 'Identified', consentText: 'Privacy' });
    const errors = validateResponse(q, {
      answers: {
        r: { questionId: 'r', number: 6 },
        c: { questionId: 'c', choices: [OTHER_OPTION_ID] },
        m: { questionId: 'm', rows: [{ rowId: 'x', value: 3 }] },
      },
      respondent: { name: 'Mario', surname: '', email: 'bad' },
      consentGiven: false,
    });
    expect(errors.map(e => e.questionId ?? e.field)).toEqual(['consentGiven', 'r', 'c', 'm']);
  });

  it('builds a payload without hidden or empty answers', () => {
    const q = questionnaire([
      choice('c1'),
      question('t1', 'ShortText', { visibleIf: { questionId: 'c1', operator: 'Equals', value: 'a' } }),
      question('t2', 'ShortText'),
    ]);
    const payload = buildSubmission(q, {
      answers: {
        c1: { questionId: 'c1', choices: ['b'], otherText: 'stale' },
        t1: { questionId: 't1', text: 'hidden' },
        t2: { questionId: 't2', text: '  hello ' },
      },
      respondent: {}, consentGiven: false,
    });
    expect(payload.respondent).toBeNull();
    expect(payload.answers).toEqual([{ questionId: 'c1', choices: ['b'] }, { questionId: 't2', text: 'hello' }]);
  });
});

describe('validateDefinition', () => {
  it('reports publish problems', () => {
    const q = questionnaire([
      question('c', 'SingleChoice', { options: [{ id: 'a', label: 'A' }] }),
      question('r', 'Rating', { settings: { max: 12 } }),
      question('t', 'ShortText', { visibleIf: { questionId: 'later', operator: 'Answered' } }),
      question('later', 'ShortText', { title: '' }),
    ], { onePerEmail: true });
    const fields = validateDefinition(q).map(e => `${e.questionId ?? ''}:${e.field}`);
    expect(fields).toEqual(['onePerEmail', 'c:options', 'r:settings.max', 't:visibleIf', 'later:title'].map(f => f.includes(':') ? f : `:${f}`));
  });

  it('accepts a valid definition and skips content checks for drafts', () => {
    const q = questionnaire([choice('c'), question('t', 'ShortText', { visibleIf: { questionId: 'c', operator: 'Equals', value: 'b' } })]);
    expect(validateDefinition(q)).toEqual([]);
    expect(validateDefinition(questionnaire([]), false)).toEqual([]);
    expect(validateDefinition(questionnaire([])).map(e => e.field)).toEqual(['sections']);
  });
});

describe('factory', () => {
  it('parses pasted options skipping bullets, blanks and duplicates', () => {
    expect(parseOptionLines('- Uno\n\n2) Due\n• uno\nTre', ['Tre'])).toEqual(['Uno', 'Due']);
  });

  it('keeps identity and options when switching between choice types', () => {
    const original = choice('c1', { required: true });
    const changed = changeQuestionType(original, 'MultipleChoice');
    expect(changed).toMatchObject({ id: 'c1', type: 'MultipleChoice', required: true, options: original.options });
    expect(changeQuestionType(original, 'Rating').settings).toEqual({ max: 5 });
  });
});

describe('hasFeedbackAdmin', () => {
  it('accepts realm, client roles and claims', () => {
    expect(hasFeedbackAdmin([{ realm_access: { roles: ['feedbackadmin'] } }])).toBe(true);
    expect(hasFeedbackAdmin([{ resource_access: { DotNetLiguriaCore: { roles: ['feedbackadmin'] } } }])).toBe(true);
    expect(hasFeedbackAdmin([null, { feedbackadmin: 'true' }])).toBe(true);
    expect(hasFeedbackAdmin([{ feedbackadmin: 'false', roles: ['member'] }])).toBe(false);
  });
  it.each([
    { realm_access: { roles: ['FeedbackAdmin'] } },
    { resource_access: { spa: { roles: ['feedbackadmin'] } } },
    { roles: { nested: ['feedbackadmin'] } },
    { feedbackadmin: 'yes' }, { feedbackadmin: 1 }, { FeedbackAdmin: true },
  ])('rejects foreign-client, nested and loosely truthy privileges %j', payload => {
    expect(hasFeedbackAdmin([payload])).toBe(false);
  });
});

describe('api client', () => {
  it('surfaces problem details as typed errors', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ code: 'Conflict', message: 'Versione obsoleta', errors: [] }), { status: 409 }));
    const api = createQuestionnaireAdminApi(fetcher);
    const error = await api.publish('q1').catch(e => e);
    expect(error).toBeInstanceOf(QuestionnaireApiError);
    expect(error).toMatchObject({ status: 409, message: 'Versione obsoleta', problem: { code: 'Conflict' } });
    expect(fetcher).toHaveBeenCalledWith(expect.stringMatching(/\/api\/Questionnaire\/q1\/publish$/), expect.objectContaining({ method: 'POST' }));
  });

  it('explains when an API endpoint returns an HTML page instead of JSON', async () => {
    const fetcher = vi.fn(async () => new Response('<!DOCTYPE html><html></html>', {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    }));
    const api = createQuestionnaireAdminApi(fetcher);

    const error = await api.byWorkshop('not-a-guid').catch(e => e);

    expect(error).toBeInstanceOf(QuestionnaireApiError);
    expect(error).toMatchObject({
      status: 200,
      message: expect.stringContaining('risposta non JSON (text/html)'),
    });
    expect(error.message).toContain('/api/Questionnaire/by-workshop/not-a-guid');
    expect(error.message).not.toContain('<!DOCTYPE');
  });

  it('posts public responses as JSON', async () => {
    const fetcher = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify({ responseId: 'r1' }), { status: 200 }));
    await expect(publicQuestionnaireApi.submit('q1', { consentGiven: false, answers: [] }, fetcher)).resolves.toEqual({ responseId: 'r1' });
    const init = fetcher.mock.calls[0][1]!;
    expect(init.headers).toMatchObject({ 'Content-Type': 'application/json' });
  });
});

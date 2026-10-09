import React from 'react';
import { Route, Routes } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { render, screen, waitFor, within } from '../../test-utils';
import AdminQuestionnaires, { CreateQuestionnaireDialog } from './AdminQuestionnaires';
import WorkshopQuestionnaires from './WorkshopQuestionnaires';
import QuestionnaireResults from '../QuestionnaireResults/QuestionnaireResults';
import { formatAnswer } from '../../questionnaire/format';
import type { Question, Questionnaire, QuestionnaireStatistics, QuestionnaireSummary } from '../../questionnaire/types';

type Handler = (url: string, method: string, body?: unknown) => unknown;

function serve(handler: Handler) {
  const calls: { url: string; method: string; body?: unknown }[] = [];
  vi.mocked(fetch).mockImplementation(async (input, init) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ url, method, body });
    const result = handler(url, method, body);
    if (result instanceof Response) return result;
    return new Response(result === undefined ? null : JSON.stringify(result), {
      status: result === undefined ? 204 : 200, headers: { 'Content-Type': 'application/json' },
    });
  });
  return calls;
}

const summary = (extra: Partial<QuestionnaireSummary> = {}): QuestionnaireSummary => ({
  questionnaireId: 'q1', title: 'Feedback Meetup', status: 'Published', workshopTitle: 'Meetup Genova', responseCount: 4,
  updatedAt: '2024-05-01T10:00:00Z', origin: 'Web', ...extra,
});

const question = (id: string, type: Question['type'], title: string, extra: Partial<Question> = {}): Question =>
  ({ id, type, title, required: false, options: [], rows: [], settings: {}, ...extra });

const questionnaire: Questionnaire = {
  questionnaireId: 'q1', title: 'Feedback Meetup', status: 'Closed', respondentMode: 'Identified', onePerEmail: true,
  displayMode: 'SinglePage', version: 2, createdAt: '', updatedAt: '', origin: 'Web', responseCount: 2,
  sections: [{
    id: 's1', questions: [
      question('overall', 'Rating', 'Voto complessivo', { settings: { max: 5 } }),
      question('topics', 'MultipleChoice', 'Argomenti', { options: [{ id: 'ai', label: 'AI' }, { id: 'web', label: 'Web' }], settings: { allowOther: true } }),
      question('notes', 'LongText', 'Suggerimenti'),
    ],
  }],
};

const statistics: QuestionnaireStatistics = {
  questionnaireId: 'q1', title: 'Feedback Meetup', responseCount: 2,
  firstResponseAt: '2024-05-01T10:00:00Z', lastResponseAt: '2024-05-02T10:00:00Z',
  responsesPerDay: [{ date: '2024-05-01', count: 1 }, { date: '2024-05-02', count: 1 }],
  questions: [
    { questionId: 'overall', title: 'Voto complessivo', type: 'Rating', answeredCount: 2, average: 4.5, distribution: [{ value: 4, count: 1 }, { value: 5, count: 1 }], options: [], rows: [], textAnswers: [] },
    { questionId: 'topics', title: 'Argomenti', type: 'MultipleChoice', answeredCount: 2, distribution: [], rows: [], textAnswers: [],
      options: [{ optionId: 'ai', label: 'AI', count: 2 }, { optionId: 'web', label: 'Web', count: 1 }] },
    { questionId: 'notes', title: 'Suggerimenti', type: 'LongText', answeredCount: 2, distribution: [], options: [], rows: [],
      textAnswers: [{ responseId: 'r1', submittedAt: '2024-05-01T10:00:00Z', text: 'Più demo dal vivo' }, { responseId: 'r2', submittedAt: '2024-05-02T10:00:00Z', text: 'Pizza migliore' }] },
  ],
};

describe('<AdminQuestionnaires />', () => {
  test('lists questionnaires and creates a workshop feedback questionnaire', async () => {
    const user = userEvent.setup();
    const calls = serve((url, method) => {
      if (url.includes('/Workshop/Get')) return [{ workshopId: 'w1', title: 'Meetup Genova', eventDate: '2024-05-01T18:00:00Z' }];
      if (method === 'POST') return { ...questionnaire, questionnaireId: 'new1' };
      return [summary()];
    });
    render(
      <Routes>
        <Route path="/admin/questionnaires" element={<AdminQuestionnaires />} />
        <Route path="/admin/questionnaires/:id/edit" element={<div>Editor aperto</div>} />
      </Routes>,
      { route: '/admin/questionnaires' },
    );

    expect(await screen.findByText('Feedback Meetup')).toBeInTheDocument();
    expect(screen.getByText('Pubblicato')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Nuovo questionario' }));
    const dialog = await screen.findByRole('dialog', { name: 'Nuovo questionario' });
    await user.click(within(dialog).getByLabelText(/Feedback di un evento/));
    const create = within(dialog).getByRole('button', { name: 'Crea e modifica' });
    expect(create).toBeDisabled();
    await user.click(within(dialog).getByRole('combobox', { name: /Evento/ }));
    await user.click(await screen.findByRole('option', { name: /Meetup Genova/ }));
    await user.click(create);

    expect(await screen.findByText('Editor aperto')).toBeInTheDocument();
    expect(calls.find(c => c.method === 'POST')?.body).toEqual({ template: 'workshopFeedback', title: null, workshopId: 'w1' });
  });

  test('shows the permission message when the role is missing', async () => {
    serve(url => (url.includes('/Questionnaire') ? new Response('', { status: 403 }) : []));
    render(<AdminQuestionnaires />);
    expect(await screen.findByText(/ruolo feedbackadmin/)).toBeInTheDocument();
  });

  test('a blank questionnaire does not require a workshop', async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();
    render(<CreateQuestionnaireDialog open workshops={[]} onClose={() => undefined} onCreate={onCreate} />);
    await user.type(screen.getByRole('textbox', { name: 'Titolo' }), ' Sondaggio soci ');
    await user.click(screen.getByRole('button', { name: 'Crea e modifica' }));
    expect(onCreate).toHaveBeenCalledWith({ template: 'blank', title: 'Sondaggio soci', workshopId: null });
  });
});

describe('<WorkshopQuestionnaires />', () => {
  test('lists linked questionnaires and creates one from the workshop', async () => {
    const user = userEvent.setup();
    const calls = serve((_, method) => (method === 'POST' ? { ...questionnaire, questionnaireId: 'new2' } : [questionnaire]));
    render(
      <Routes>
        <Route path="/admin/workshop/w1" element={<WorkshopQuestionnaires workshopId="w1" />} />
        <Route path="/admin/questionnaires/:id/edit" element={<div>Editor aperto</div>} />
      </Routes>,
      { route: '/admin/workshop/w1' },
    );
    expect(await screen.findByRole('link', { name: 'Feedback Meetup' })).toHaveAttribute('href', '/admin/questionnaires/q1/edit');
    expect(screen.getByRole('link', { name: '2 risposte' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Crea questionario di feedback' }));
    expect(await screen.findByText('Editor aperto')).toBeInTheDocument();
    expect(calls.some(c => c.url.endsWith('/Questionnaire/by-workshop/w1'))).toBe(true);
  });
});

describe('<QuestionnaireResults />', () => {
  const responses = [
    { responseId: 'r1', questionnaireId: 'q1', questionnaireVersion: 2, submittedAt: '2024-05-01T10:00:00Z', consentGiven: true, source: 'Web',
      respondent: { name: 'Ada', surname: 'Lovelace', email: 'ada@example.org' },
      answers: [{ questionId: 'overall', number: 5 }, { questionId: 'topics', choices: ['ai', '__other'], otherText: 'Rust' }] },
    { responseId: 'r2', questionnaireId: 'q1', questionnaireVersion: 2, submittedAt: '2024-05-02T10:00:00Z', consentGiven: true, source: 'LegacySqlServer',
      respondent: { name: 'Alan', surname: 'Turing', email: 'alan@example.org' }, answers: [{ questionId: 'overall', number: 4 }] },
  ];

  const renderResults = (handler: Handler) => {
    const calls = serve(handler);
    render(<Routes><Route path="/admin/questionnaires/:id/results" element={<QuestionnaireResults />} /></Routes>,
      { route: '/admin/questionnaires/q1/results' });
    return calls;
  };

  test('shows KPIs, per-question summaries and searchable text answers', async () => {
    const user = userEvent.setup();
    renderResults(url => (url.endsWith('/statistics') ? statistics : url.endsWith('/responses') ? responses : questionnaire));

    expect(await screen.findByText('Risultati: Feedback Meetup')).toBeInTheDocument();
    expect(screen.getByText('Media 4,5')).toBeInTheDocument();
    expect(screen.getByLabelText('AI: 100%')).toBeInTheDocument();
    expect(screen.getByText('Più demo dal vivo')).toBeInTheDocument();

    await user.type(screen.getByRole('textbox', { name: 'Cerca nelle risposte testuali' }), 'pizza');
    expect(screen.queryByText('Più demo dal vivo')).not.toBeInTheDocument();
    expect(screen.getByText('Pizza migliore')).toBeInTheDocument();
  });

  test('lists responses, shows details and deletes a response', async () => {
    const user = userEvent.setup();
    const calls = renderResults((url, method) => {
      if (method === 'DELETE') return undefined;
      return url.endsWith('/statistics') ? statistics : url.endsWith('/responses') ? responses : questionnaire;
    });

    await user.click(await screen.findByRole('tab', { name: 'Risposte (2)' }));
    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('Blazor Server (storico)')).toBeInTheDocument();

    await user.dblClick(screen.getByText('Ada Lovelace'));
    const detail = await screen.findByRole('dialog', { name: /Risposta del/ });
    expect(within(detail).getByText('AI, Altro: Rust')).toBeInTheDocument();
    await user.click(within(detail).getByRole('button', { name: 'Elimina risposta' }));
    const confirm = await screen.findByRole('dialog', { name: 'Eliminare la risposta?' });
    await user.click(within(confirm).getByRole('button', { name: 'Elimina' }));
    await waitFor(() => expect(calls.some(c => c.method === 'DELETE' && c.url.endsWith('/Questionnaire/q1/responses/r1'))).toBe(true));
  });
});

describe('formatAnswer', () => {
  test('renders every answer kind in Italian', () => {
    const [rating, topics] = questionnaire.sections[0].questions;
    expect(formatAnswer(rating, { questionId: 'overall', number: 4 })).toBe('4 / 5');
    expect(formatAnswer(topics, { questionId: 'topics', choices: ['web'] })).toBe('Web');
    expect(formatAnswer(question('y', 'YesNo', 'Y'), { questionId: 'y', bool: false })).toBe('No');
    expect(formatAnswer(question('m', 'Matrix', 'M', { rows: [{ id: 't1', label: 'Keynote' }] }), { questionId: 'm', rows: [{ rowId: 't1', value: 3 }] }))
      .toBe('Keynote: 3');
    expect(formatAnswer(undefined, undefined)).toBe('');
  });
});

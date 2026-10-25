import React from 'react';
import { Route, Routes } from 'react-router-dom';
import axe from 'axe-core';
import userEvent from '@testing-library/user-event';
import { jsonResponse, mockApi, render, screen, within } from '../test-utils';
import QuestionnaireDesigner from './QuestionnaireDesigner/QuestionnaireDesigner';
import QuestionnaireResults from './QuestionnaireResults/QuestionnaireResults';
import type { Question, Questionnaire, QuestionnaireResponse, QuestionnaireStatistics } from '../questionnaire/types';

// axe on the rendered DOM of the designer and of the results (jsdom has no layout, so colour contrast is measured
// in a browser instead, and the table or the cards, the palette or the sheets depend on matchMedia).
const OPTIONS: axe.RunOptions = {
  runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa'] },
  rules: { 'color-contrast': { enabled: false }, 'landmark-unique': { enabled: false }, region: { enabled: false } },
};

async function expectNoViolations(root: Element = document.body) {
  const results = await axe.run(root, OPTIONS);
  const summary = results.violations.map(v => `${v.id}: ${v.help}\n  ${v.nodes.map(n => n.html).join('\n  ')}`);
  expect(summary).toEqual([]);
}

const q = (id: string, type: Question['type'], title: string, extra: Partial<Question> = {}): Question =>
  ({ id, type, title, required: false, options: [], rows: [], settings: {}, ...extra });

const questionnaire: Questionnaire = {
  questionnaireId: 'q1', title: 'Feedback evento', description: 'Dicci come è andata.', status: 'Draft', respondentMode: 'Authenticated', onePerEmail: false, onePerAccount: true,
  consentText: 'Accetto', displayMode: 'SinglePage', version: 1, createdAt: '', updatedAt: '', origin: 'Web', responseCount: 0, workshopId: 'w1',
  sections: [
    { id: 's1', title: 'Generale', questions: [
      q('rating', 'Rating', 'Voto complessivo', { required: true, settings: { max: 5 } }),
      q('yn', 'YesNo', 'Torneresti?'),
      q('why', 'LongText', 'Perché?', { visibleIf: { questionId: 'yn', operator: 'Equals', value: 'false' } }),
      q('single', 'SingleChoice', 'Come ci hai conosciuto?', { options: [{ id: 'a', label: 'Social' }, { id: 'b', label: 'Amici' }], settings: { allowOther: true } }),
      q('matrix', 'Matrix', 'Valuta le sessioni', { settings: { min: 1, max: 5 }, rows: [{ id: 'r1', label: 'Keynote', description: 'Apertura' }] }),
      q('empty', 'SingleChoice', '', { options: [{ id: 'x', label: 'Uno' }] }),
    ] },
    { id: 's2', title: '', questions: [q('name', 'ShortText', 'Il tuo ruolo')] },
  ],
};

function phone() {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
}

const renderDesigner = () => render(
  <Routes><Route path="/admin/questionnaires/:id/edit" element={<QuestionnaireDesigner autosaveDelayMs={0} />} /></Routes>,
  { route: '/admin/questionnaires/q1/edit' },
);

// A full axe audit of the designer takes a few seconds on the slower CI runners (about 4 s on Windows).
const AUDIT = { timeout: 15_000 };

describe('questionnaire designer accessibility', AUDIT, () => {
  beforeEach(() => { vi.mocked(fetch).mockImplementation(async () => jsonResponse(questionnaire)); });

  test('three panes with a question selected', async () => {
    const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
    renderDesigner();
    await screen.findByText('Voto complessivo');
    await user.click(screen.getByTestId('card-single'));
    await user.click(screen.getByTestId('card-matrix'));
    await user.click(screen.getByTestId('card-why'));
    await expectNoViolations();
  });

  test('definition problems shown on the fields', async () => {
    const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
    renderDesigner();
    await user.click(await screen.findByRole('button', { name: 'Pubblica' }));
    const dialog = await screen.findByRole('dialog', { name: 'Pubblica il questionario' });
    await user.click(within(dialog).getAllByRole('button', { name: /Il testo della domanda/ })[0]);
    await expectNoViolations();
  });

  test('dialogs: preview, share and publish', async () => {
    const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
    renderDesigner();
    await user.click(await screen.findByRole('button', { name: 'Condividi' }));
    await screen.findByRole('dialog', { name: 'Condividi il questionario' });
    await user.click(screen.getByRole('button', { name: 'Chiudi' }));
    await user.click(await screen.findByRole('button', { name: 'Anteprima' }));
    await screen.findByRole('dialog', { name: 'Anteprima del questionario' });
    await expectNoViolations();
  });

  test('single column with the palette and the properties as sheets', async () => {
    const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
    phone();
    renderDesigner();
    await screen.findByText('Voto complessivo');
    await expectNoViolations();
    await user.click(screen.getByRole('button', { name: 'Aggiungi domanda' }));
    await screen.findByRole('dialog', { name: 'Aggiungi domanda' });
    await user.click(screen.getByRole('button', { name: 'Chiudi' }));
    await user.click(await screen.findByRole('button', { name: 'Proprietà: Come ci hai conosciuto?' }));
    await screen.findByRole('dialog', { name: /Proprietà: Scelta singola/ });
    await expectNoViolations();
  });
});

describe('questionnaire results accessibility', AUDIT, () => {
  const responses: QuestionnaireResponse[] = Array.from({ length: 3 }, (_, i) => ({
    responseId: `r${i}`, questionnaireId: 'q1', questionnaireVersion: 1, submittedAt: `2024-05-0${i + 1}T10:00:00Z`, consentGiven: true,
    source: i === 2 ? 'LegacySqlServer' : 'Web', respondent: { name: `Persona${i}`, surname: 'Test', email: `p${i}@example.org` }, answers: [{ questionId: 'rating', number: 4 }, { questionId: 'single', choices: ['a'] }],
  }));
  const stats: QuestionnaireStatistics = {
    questionnaireId: 'q1', title: 'Feedback evento', responseCount: 3, firstResponseAt: '2024-05-01T10:00:00Z', lastResponseAt: '2024-05-03T10:00:00Z',
    responsesPerDay: [{ date: '2024-05-01', count: 1 }, { date: '2024-05-02', count: 2 }],
    questions: [
      { questionId: 'rating', title: 'Voto complessivo', type: 'Rating', answeredCount: 3, average: 4, distribution: [{ value: 4, count: 3 }], options: [], rows: [], textAnswers: [] },
      { questionId: 'single', title: 'Come ci hai conosciuto?', type: 'SingleChoice', answeredCount: 3, distribution: [], rows: [], textAnswers: [{ responseId: 'r1', submittedAt: '2024-05-01T10:00:00Z', text: 'Da un collega' }], options: [{ optionId: 'a', label: 'Social', count: 3 }, { optionId: 'b', label: 'Amici', count: 0 }] },
      { questionId: 'matrix', title: 'Valuta le sessioni', type: 'Matrix', answeredCount: 2, distribution: [], options: [], textAnswers: [], rows: [{ rowId: 'r1', label: 'Keynote', answeredCount: 2, average: 4.5, distribution: [{ value: 4, count: 1 }, { value: 5, count: 1 }] }] },
    ],
  };
  const renderResults = (route = '/admin/questionnaires/q1/results') => {
    mockApi({ '/statistics': stats, '/responses': responses, '/Questionnaire/q1': { ...questionnaire, status: 'Published', responseCount: 3 } });
    render(<Routes><Route path="/admin/questionnaires/:id/results" element={<QuestionnaireResults />} /></Routes>, { route });
  };

  test('summary with charts, choices and written answers', async () => {
    renderResults();
    await screen.findByRole('heading', { level: 1, name: /^Risultati/ });
    await expectNoViolations();
  });

  test('responses table, detail and confirmation', async () => {
    const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
    renderResults('/admin/questionnaires/q1/results?vista=risposte');
    const table = await screen.findByRole('table', { name: /Risposte al questionario/ });
    await expectNoViolations();
    await user.click(within(table).getAllByRole('button', { name: /^Apri la risposta/ })[0]);
    await screen.findByRole('dialog', { name: /Risposta del/ });
    await expectNoViolations();
    await user.click(screen.getByRole('button', { name: 'Elimina risposta' }));
    await screen.findByRole('alertdialog', { name: 'Eliminare la risposta?' });
    await expectNoViolations();
  });

  test('stacked responses on a phone', async () => {
    const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
    phone();
    renderResults();
    await user.click(await screen.findByRole('tab', { name: /^Risposte \(/ }));
    await screen.findByRole('combobox', { name: 'Ordina per' });
    await expectNoViolations();
  });
});

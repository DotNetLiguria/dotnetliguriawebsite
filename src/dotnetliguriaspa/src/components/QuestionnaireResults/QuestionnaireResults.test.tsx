import React from 'react';
import { Route, Routes } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { jsonResponse, mockApi, render, screen, waitFor, within } from '../../test-utils';
import { AdminToastRegion, adminToasts } from '../../admin/toasts';
import { formatDateTime } from '../../questionnaire/format';
import QuestionnaireResults from './QuestionnaireResults';
import type { Question, Questionnaire, QuestionnaireResponse, QuestionnaireStatistics } from '../../questionnaire/types';

// The responses table, the charts and the export of the results screen; the basic summary flow is also covered in
// components/AdminQuestionnaires/WorkshopQuestionnaires.test.tsx.

const question = (id: string, type: Question['type'], title: string, extra: Partial<Question> = {}): Question =>
  ({ id, type, title, required: false, options: [], rows: [], settings: {}, ...extra });

const definition = (extra: Partial<Questionnaire> = {}): Questionnaire => ({
  questionnaireId: 'q1', title: 'Feedback Meetup', status: 'Closed', respondentMode: 'Identified', onePerEmail: true,
  displayMode: 'SinglePage', version: 2, createdAt: '', updatedAt: '', origin: 'Web', responseCount: 3,
  opensAt: '2024-05-01T08:00:00Z', closesAt: '2024-05-31T20:00:00Z',
  sections: [{ id: 's1', questions: [
    question('overall', 'Rating', 'Voto complessivo', { settings: { max: 5 } }),
    question('topics', 'MultipleChoice', 'Argomenti', { options: [{ id: 'ai', label: 'AI' }, { id: 'web', label: 'Web' }], settings: { allowOther: true } }),
    question('notes', 'LongText', 'Suggerimenti'),
  ] }],
  ...extra,
});

const statistics = (extra: Partial<QuestionnaireStatistics> = {}): QuestionnaireStatistics => ({
  questionnaireId: 'q1', title: 'Feedback Meetup', responseCount: 3,
  firstResponseAt: '2024-05-01T10:00:00Z', lastResponseAt: '2024-05-03T10:00:00Z',
  responsesPerDay: [{ date: '2024-05-01', count: 1 }, { date: '2024-05-03', count: 2 }],
  questions: [
    { questionId: 'overall', title: 'Voto complessivo', type: 'Rating', answeredCount: 3, average: 4, distribution: [{ value: 3, count: 1 }, { value: 4, count: 1 }, { value: 5, count: 1 }], options: [], rows: [], textAnswers: [] },
    { questionId: 'topics', title: 'Argomenti', type: 'MultipleChoice', answeredCount: 3, distribution: [], rows: [], textAnswers: [], options: [{ optionId: 'ai', label: 'AI', count: 2 }, { optionId: 'web', label: 'Web', count: 1 }] },
  ],
  ...extra,
});

const response = (id: string, submittedAt: string, extra: Partial<QuestionnaireResponse> = {}): QuestionnaireResponse => ({
  responseId: id, questionnaireId: 'q1', questionnaireVersion: 2, submittedAt, consentGiven: true, source: 'Web', answers: [{ questionId: 'overall', number: 4 }], ...extra,
});
const people = [
  response('r1', '2024-05-01T10:00:00Z', { respondent: { name: 'Ada', surname: 'Lovelace', email: 'ada@example.org' }, answers: [{ questionId: 'overall', number: 5 }, { questionId: 'topics', choices: ['ai', '__other'], otherText: 'Rust' }] }),
  response('r2', '2024-05-03T10:00:00Z', { respondent: { name: 'Zoe', surname: 'Zuse', email: 'zoe@example.org' }, source: 'LegacySqlServer' }),
  response('r3', '2024-05-02T10:00:00Z', { respondent: { name: 'Alan', surname: 'Turing', email: 'alan@example.org' } }),
];

interface Call { url: string; method: string }
function serve(options: { questionnaire?: Questionnaire; stats?: QuestionnaireStatistics; responses?: QuestionnaireResponse[]; exportStatus?: number; deleteStatus?: number } = {}) {
  const calls: Call[] = [];
  let responses = options.responses ?? people;
  mockApi({
    '/export': (url: string, init?: RequestInit) => {
      calls.push({ url, method: init?.method ?? 'GET' });
      return (options.exportStatus ?? 200) === 200 ? new Response('a;b\n1;2\n', { status: 200, headers: { 'Content-Type': 'text/csv' } }) : new Response('', { status: options.exportStatus });
    },
    '/statistics': (url: string) => { calls.push({ url, method: 'GET' }); return jsonResponse(options.stats ?? statistics()); },
    '/responses/': (url: string, init?: RequestInit) => {
      calls.push({ url, method: init?.method ?? 'GET' });
      if ((options.deleteStatus ?? 204) !== 204) return new Response('', { status: options.deleteStatus });
      responses = responses.filter(r => !url.endsWith(`/${r.responseId}`));
      return new Response(null, { status: 204 });
    },
    '/responses': (url: string) => { calls.push({ url, method: 'GET' }); return jsonResponse(responses); },
    '/Questionnaire/q1': (url: string) => { calls.push({ url, method: 'GET' }); return jsonResponse(options.questionnaire ?? definition()); },
  });
  return calls;
}

const renderResults = (route = '/admin/questionnaires/q1/results') => render(
  <>
    <Routes>
      <Route path="/admin/questionnaires" element={<div>Elenco questionari</div>} />
      <Route path="/admin/questionnaires/:id/edit" element={<div>Editor aperto</div>} />
      <Route path="/admin/questionnaires/:id/results" element={<QuestionnaireResults />} />
    </Routes>
    <AdminToastRegion />
  </>,
  { route },
);
const ready = () => screen.findByRole('heading', { level: 1, name: /^Risultati/ });
const openResponses = async (user: ReturnType<typeof userEvent.setup>) => { await user.click(await screen.findByRole('tab', { name: /^Risposte \(/ })); return screen.findByRole('table', { name: /Risposte al questionario/ }); };
/** First cell (date) of every body row, in order. */
const dates = (table: HTMLElement) => within(table).getAllByRole('row').slice(1).map(row => within(row).getAllByRole('cell')[0].textContent);
const names = (table: HTMLElement) => within(table).getAllByRole('row').slice(1).map(row => within(row).getAllByRole('cell')[1].textContent);

/** The width decides table or stacked cards. */
function setPhone() {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
}

beforeEach(() => adminToasts.clear());

describe('<QuestionnaireResults /> header', () => {
  test('shows title, response count, period and the actions of a published questionnaire', async () => {
    serve({ questionnaire: definition({ status: 'Published' }) });
    renderResults();

    expect(await ready()).toHaveTextContent('Risultati: Feedback Meetup');
    const period = `Aperto dal ${formatDateTime('2024-05-01T08:00:00Z')} al ${formatDateTime('2024-05-31T20:00:00Z')}`;
    expect(screen.getByText(new RegExp(`^3 risposte · ${period.replace(/[()/]/g, '\\$&')}`))).toBeInTheDocument();
    expect(screen.queryByText('Chiuso')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Apri il link pubblico/ })).toHaveAttribute('href', expect.stringMatching(/\/q\/q1$/));
    expect(screen.getByRole('link', { name: 'Modifica' })).toHaveAttribute('href', '/admin/questionnaires/q1/edit');
    expect(screen.getByRole('link', { name: 'Questionari' })).toHaveAttribute('href', '/admin/questionnaires');
    expect(screen.getByRole('button', { name: 'Esporta CSV' })).toBeEnabled();
    const numbers = within(screen.getByRole('region', { name: 'Numeri in sintesi' }));
    expect(numbers.getByText('Domande').nextElementSibling).toHaveTextContent('2');
  });

  test('a closed questionnaire says so and has no public link; with no responses there is nothing to export', async () => {
    serve({ questionnaire: definition({ status: 'Closed', responseCount: 0 }), stats: statistics({ responseCount: 0, responsesPerDay: [], questions: [] }), responses: [] });
    renderResults();

    expect(await ready()).toBeInTheDocument();
    expect(screen.getByText('Chiuso')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Apri il link pubblico/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Esporta CSV' })).toBeDisabled();
    expect(screen.getByText('Ancora nessuna risposta')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Risposte (0)' })).toBeInTheDocument();
  });

  test('a failed load offers a retry and then shows the results', async () => {
    const user = userEvent.setup({ delay: null });
    let attempts = 0;
    mockApi({
      '/statistics': () => (++attempts === 1 ? new Response('', { status: 500 }) : jsonResponse(statistics())),
      '/responses': people,
      '/Questionnaire/q1': definition(),
    });
    renderResults();
    expect(await screen.findByRole('alert')).toHaveTextContent('Errore del server (500).');
    expect(screen.getByRole('link', { name: 'Questionari' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Riprova' }));
    expect(await ready()).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  test('"Aggiorna" loads everything again without blanking the page', async () => {
    const user = userEvent.setup({ delay: null });
    const calls = serve();
    renderResults();
    await ready();
    const before = calls.filter(c => c.url.endsWith('/statistics')).length;
    await user.click(screen.getByRole('button', { name: 'Aggiorna' }));
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    await waitFor(() => expect(calls.filter(c => c.url.endsWith('/statistics')).length).toBe(before + 1));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Aggiorna' })).toBeEnabled());
  });
});

describe('<QuestionnaireResults /> summary', () => {
  test('every chart has its numbers as text: a table of values, counts and shares', async () => {
    serve();
    renderResults();
    await ready();

    const rating = screen.getByRole('table', { name: 'Distribuzione delle risposte a: Voto complessivo' });
    // The scale 1-5 is complete even though nobody chose 1 or 2.
    const rows = within(rating).getAllByRole('row').slice(1).map(row => [within(row).getByRole('rowheader').textContent, ...within(row).getAllByRole('cell').map(cell => cell.textContent)]);
    expect(rows).toEqual([['1', '0', '0%'], ['2', '0', '0%'], ['3', '1', '33%'], ['4', '1', '33%'], ['5', '1', '33%']]);
    const perDay = screen.getByRole('table', { name: 'Risposte per giorno' });
    expect(within(perDay).getAllByRole('row')).toHaveLength(3);
    expect(within(perDay).getByRole('row', { name: /^1 maggio 2024 1 33%$/ })).toBeInTheDocument();
    // Choices write count and share next to the bar, and the bar is a labelled meter.
    expect(screen.getByText('2 (67%)')).toBeInTheDocument();
    expect(screen.getByLabelText('AI: 67%')).toBeInTheDocument();
  });

  test('"Mostra altre" pages long lists of written answers and keeps the reader in place', async () => {
    const user = userEvent.setup({ delay: null });
    const textAnswers = Array.from({ length: 45 }, (_, i) => ({ responseId: `t${i}`, submittedAt: '2024-05-01T10:00:00Z', text: `Idea numero ${i + 1}` }));
    serve({ stats: statistics({ questions: [{ questionId: 'notes', title: 'Suggerimenti', type: 'LongText', answeredCount: 45, distribution: [], options: [], rows: [], textAnswers }] }) });
    renderResults();
    await ready();

    expect(screen.getAllByText(/^Idea numero/)).toHaveLength(20);
    await user.click(screen.getByRole('button', { name: 'Mostra altre (25)' }));
    expect(screen.getAllByText(/^Idea numero/)).toHaveLength(40);
    expect(screen.getByText('Idea numero 21').closest('li')).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Mostra altre (5)' }));
    expect(screen.getAllByText(/^Idea numero/)).toHaveLength(45);
    expect(screen.queryByRole('button', { name: /Mostra altre/ })).not.toBeInTheDocument();
  });

  test('the selected tab lives in the address', async () => {
    const user = userEvent.setup({ delay: null });
    serve();
    renderResults('/admin/questionnaires/q1/results?vista=risposte');
    expect(await screen.findByRole('tab', { name: 'Risposte (3)', selected: true })).toBeInTheDocument();
    expect(await screen.findByRole('table', { name: /Risposte al questionario/ })).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Riepilogo' }));
    expect(await screen.findByRole('tab', { name: 'Riepilogo', selected: true })).toBeInTheDocument();
    expect(screen.queryByRole('table', { name: /Risposte al questionario/ })).not.toBeInTheDocument();
  });
});

describe('<QuestionnaireResults /> responses table', () => {
  test('is sorted newest first and sorts by any column, announcing the order', async () => {
    const user = userEvent.setup({ delay: null });
    serve();
    renderResults();
    const table = await openResponses(user);

    expect(dates(table)).toEqual(['2024-05-03T10:00:00Z', '2024-05-02T10:00:00Z', '2024-05-01T10:00:00Z'].map(formatDateTime));
    const header = (name: string) => within(table).getByRole('columnheader', { name });
    expect(header('Inviata')).toHaveAttribute('aria-sort', 'descending');
    expect(header('Partecipante')).not.toHaveAttribute('aria-sort');

    await user.click(within(header('Partecipante')).getByRole('button'));
    expect(names(table)).toEqual(['Ada Lovelace', 'Alan Turing', 'Zoe Zuse']);
    expect(header('Partecipante')).toHaveAttribute('aria-sort', 'ascending');
    expect(header('Inviata')).not.toHaveAttribute('aria-sort');

    await user.click(within(header('Partecipante')).getByRole('button'));
    expect(names(table)).toEqual(['Zoe Zuse', 'Alan Turing', 'Ada Lovelace']);
    expect(header('Partecipante')).toHaveAttribute('aria-sort', 'descending');

    await user.click(within(header('Inviata')).getByRole('button'));
    expect(header('Inviata')).toHaveAttribute('aria-sort', 'descending');
    await user.click(within(header('Inviata')).getByRole('button'));
    expect(header('Inviata')).toHaveAttribute('aria-sort', 'ascending');
    expect(names(table)).toEqual(['Ada Lovelace', 'Alan Turing', 'Zoe Zuse']);

    await user.click(within(header('Origine')).getByRole('button'));
    expect(within(table).getAllByRole('row')[1]).toHaveTextContent('Blazor Server (storico)');
  });

  test('anonymous questionnaires have no respondent columns', async () => {
    const user = userEvent.setup({ delay: null });
    serve({ responses: people.map(({ respondent: _respondent, ...rest }) => rest) });
    renderResults();
    const table = await openResponses(user);
    expect(within(table).queryByRole('columnheader', { name: 'Partecipante' })).not.toBeInTheDocument();
    expect(within(table).queryByRole('columnheader', { name: 'Email' })).not.toBeInTheDocument();
    expect(within(table).getByRole('columnheader', { name: 'Risposte date' })).toBeInTheDocument();
  });

  test('pages 25 rows at a time with a choice of 50 and 100', async () => {
    const user = userEvent.setup({ delay: null });
    const many = Array.from({ length: 60 }, (_, i) => response(`m${i}`, `2024-05-01T${String(8 + Math.floor(i / 6)).padStart(2, '0')}:${String((i % 6) * 10).padStart(2, '0')}:00Z`, { respondent: { name: 'Persona', surname: String(i + 1).padStart(2, '0') } }));
    serve({ responses: many, stats: statistics({ responseCount: 60 }) });
    renderResults();
    const table = await openResponses(user);

    expect(within(table).getAllByRole('row')).toHaveLength(26);
    expect(screen.getByText('1–25 di 60 risposte')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pagina precedente' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Pagina successiva' }));
    expect(screen.getByText('26–50 di 60 risposte')).toBeInTheDocument();
    expect(screen.getByText('Pagina 2 di 3')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Pagina successiva' }));
    expect(within(table).getAllByRole('row')).toHaveLength(11);
    expect(screen.getByText('51–60 di 60 risposte')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pagina successiva' })).toBeDisabled();

    await user.selectOptions(screen.getByRole('combobox', { name: 'Righe per pagina' }), '50');
    expect(screen.getByText('1–50 di 60 risposte')).toBeInTheDocument();
    expect(within(table).getAllByRole('row')).toHaveLength(51);
  });

  test('searches names, emails and answers, filters by origin and resets', async () => {
    const user = userEvent.setup({ delay: null });
    serve();
    renderResults();
    const table = await openResponses(user);

    await user.type(screen.getByRole('searchbox', { name: 'Cerca nelle risposte' }), 'rust');
    expect(names(table)).toEqual(['Ada Lovelace']);
    expect(screen.getByText('1–1 di 1 risposta (su 3)')).toBeInTheDocument();

    await user.clear(screen.getByRole('searchbox', { name: 'Cerca nelle risposte' }));
    expect(within(table).getAllByRole('row')).toHaveLength(4);
    await user.click(within(screen.getByRole('group', { name: 'Origine' })).getByRole('button', { name: /Blazor Server/ }));
    expect(names(table)).toEqual(['Zoe Zuse']);

    await user.type(screen.getByRole('searchbox', { name: 'Cerca nelle risposte' }), 'zzzz');
    expect(await screen.findByText('Nessuna risposta trovata')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Azzera i filtri' }));
    expect(within(await screen.findByRole('table', { name: /Risposte al questionario/ })).getAllByRole('row')).toHaveLength(4);
  });

  test('opens a response in a dialog with every answer, and double click does the same', async () => {
    const user = userEvent.setup({ delay: null });
    serve();
    renderResults();
    const table = await openResponses(user);

    await user.click(within(table).getByRole('button', { name: `Apri la risposta del ${formatDateTime('2024-05-01T10:00:00Z')}` }));
    const dialog = await screen.findByRole('dialog', { name: `Risposta del ${formatDateTime('2024-05-01T10:00:00Z')}` });
    expect(within(dialog).getByText('Ada Lovelace · ada@example.org')).toBeInTheDocument();
    expect(within(dialog).getByText('5 / 5')).toBeInTheDocument();
    expect(within(dialog).getByText('AI, Altro: Rust')).toBeInTheDocument();
    expect(within(dialog).getByText(/Consenso privacy: sì/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Chiudi' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    await user.dblClick(within(table).getByText('Alan Turing'));
    expect(await screen.findByRole('dialog', { name: /Risposta del/ })).toBeInTheDocument();
  });

  test('deletes a response after a confirmation and refreshes the list', async () => {
    const user = userEvent.setup({ delay: null });
    const calls = serve();
    renderResults();
    const table = await openResponses(user);

    await user.click(within(table).getByRole('button', { name: `Elimina la risposta del ${formatDateTime('2024-05-03T10:00:00Z')}` }));
    const confirmation = await screen.findByRole('alertdialog', { name: 'Eliminare la risposta?' });
    expect(calls.some(c => c.method === 'DELETE')).toBe(false);
    await user.click(within(confirmation).getByRole('button', { name: 'Elimina' }));

    expect(await screen.findByText('Risposta eliminata')).toBeInTheDocument();
    expect(calls.find(c => c.method === 'DELETE')?.url).toMatch(/\/Questionnaire\/q1\/responses\/r2$/);
    await waitFor(() => expect(names(screen.getByRole('table', { name: /Risposte al questionario/ }))).toEqual(['Alan Turing', 'Ada Lovelace']));
    expect(screen.getByRole('tab', { name: 'Risposte (2)' })).toBeInTheDocument();
  });

  test('a failed delete is reported and keeps the confirmation open', async () => {
    const user = userEvent.setup({ delay: null });
    serve({ deleteStatus: 500 });
    renderResults();
    const table = await openResponses(user);
    await user.click(within(table).getAllByRole('button', { name: /^Elimina la risposta/ })[0]);
    const confirmation = await screen.findByRole('alertdialog', { name: 'Eliminare la risposta?' });
    await user.click(within(confirmation).getByRole('button', { name: 'Elimina' }));

    expect(await screen.findByText('Eliminazione non riuscita')).toBeInTheDocument();
    expect(screen.getByRole('alertdialog', { name: 'Eliminare la risposta?' })).toBeInTheDocument();
    expect(within(confirmation).getByRole('button', { name: 'Elimina' })).toBeEnabled();
  });

  test('the dialog of a response can delete it too', async () => {
    const user = userEvent.setup({ delay: null });
    const calls = serve();
    renderResults();
    const table = await openResponses(user);
    await user.click(within(table).getByRole('button', { name: `Apri la risposta del ${formatDateTime('2024-05-01T10:00:00Z')}` }));
    await user.click(within(await screen.findByRole('dialog', { name: /Risposta del/ })).getByRole('button', { name: 'Elimina risposta' }));
    await user.click(within(await screen.findByRole('alertdialog', { name: 'Eliminare la risposta?' })).getByRole('button', { name: 'Elimina' }));
    await waitFor(() => expect(calls.find(c => c.method === 'DELETE')?.url).toMatch(/\/responses\/r1$/));
  });

  describe('on a phone', () => {
    test('stacks the responses as cards with a sort menu', async () => {
      const user = userEvent.setup({ delay: null });
      setPhone();
      serve();
      renderResults();
      await user.click(await screen.findByRole('tab', { name: /^Risposte \(/ }));
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
      const cards = () => screen.getAllByRole('listitem')
        .filter(li => within(li).queryByRole('button', { name: /^Apri la risposta/ }))
        .map(li => /Ada Lovelace|Alan Turing|Zoe Zuse/.exec(li.textContent ?? '')?.[0]);

      expect(cards()).toEqual(['Zoe Zuse', 'Alan Turing', 'Ada Lovelace']);
      await user.selectOptions(screen.getByRole('combobox', { name: 'Ordina per' }), 'name:asc');
      expect(cards()).toEqual(['Ada Lovelace', 'Alan Turing', 'Zoe Zuse']);
      await user.click(screen.getAllByRole('button', { name: /^Apri la risposta/ })[0]);
      expect(await screen.findByRole('dialog', { name: /Risposta del/ })).toBeInTheDocument();
    });
  });
});

describe('<QuestionnaireResults /> CSV export', () => {
  const original = { create: URL.createObjectURL, revoke: URL.revokeObjectURL };
  let downloads: { download: string; href: string }[];

  beforeEach(() => {
    downloads = [];
    URL.createObjectURL = vi.fn(() => 'blob:csv');
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function click(this: HTMLAnchorElement) { downloads.push({ download: this.download, href: this.href }); });
  });
  afterEach(() => {
    URL.createObjectURL = original.create;
    URL.revokeObjectURL = original.revoke;
  });

  test('downloads the server CSV with a file name made from the title', async () => {
    const user = userEvent.setup({ delay: null });
    const calls = serve({ questionnaire: definition({ title: 'Feedback: Meetup 2024!' }) });
    renderResults();
    await ready();
    await user.click(screen.getByRole('button', { name: 'Esporta CSV' }));

    expect(await screen.findByText('Esportazione pronta')).toBeInTheDocument();
    expect(calls.filter(c => c.url.endsWith('/Questionnaire/q1/export'))).toHaveLength(1);
    expect(vi.mocked(URL.createObjectURL)).toHaveBeenCalledTimes(1);
    expect((vi.mocked(URL.createObjectURL).mock.calls[0][0] as Blob).size).toBe('a;b\n1;2\n'.length);
    expect(downloads).toEqual([{ download: 'Feedback_Meetup_2024_.csv', href: 'blob:csv' }]);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:csv');
  });

  test('says so when the export fails and offers it again', async () => {
    const user = userEvent.setup({ delay: null });
    serve({ exportStatus: 500 });
    renderResults();
    await ready();
    await user.click(screen.getByRole('button', { name: 'Esporta CSV' }));

    expect(await screen.findByText('Esportazione non riuscita')).toBeInTheDocument();
    expect(downloads).toEqual([]);
    expect(screen.getByRole('button', { name: 'Esporta CSV' })).toBeEnabled();
  });
});

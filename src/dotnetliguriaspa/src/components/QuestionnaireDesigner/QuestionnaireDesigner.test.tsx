import React from 'react';
import { Route, Routes } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { fireEvent, render, screen, waitFor, within } from '../../test-utils';
import { AdminToastRegion, adminToasts } from '../../admin/toasts';
import QuestionnaireDesigner from './QuestionnaireDesigner';
import { useDesignerStore } from './designerStore';
import { DEFAULT_CONSENT_TEXT } from './QuestionnaireSettings';
import { dragAnnouncements, screenReaderInstructions } from './dragText';
import type { Question, Questionnaire } from '../../questionnaire/types';

const q = (id: string, type: Question['type'], title: string, extra: Partial<Question> = {}): Question =>
  ({ id, type, title, required: false, options: [], rows: [], settings: {}, ...extra });

function draft(extra: Partial<Questionnaire> = {}): Questionnaire {
  return {
    questionnaireId: 'q1', title: 'Feedback evento', status: 'Draft', respondentMode: 'Anonymous', onePerEmail: false,
    displayMode: 'SinglePage', version: 1, createdAt: '', updatedAt: '', origin: 'Web', responseCount: 0,
    sections: [
      { id: 's1', title: 'Generale', questions: [q('a', 'YesNo', 'Torneresti?'), q('b', 'LongText', 'Perché?', { visibleIf: { questionId: 'a', operator: 'Equals', value: 'false' } })] },
      { id: 's2', title: 'Altro', questions: [q('c', 'ShortText', 'Note')] },
    ],
    ...extra,
  };
}

const ids = () => useDesignerStore.getState().questionnaire!.sections.map(s => s.questions.map(x => x.id));

describe('designer store', () => {
  beforeEach(() => useDesignerStore.getState().load(draft()));

  test('adds after the selected question and supports undo/redo', () => {
    const store = useDesignerStore.getState();
    store.select({ kind: 'question', id: 'a' });
    const added = store.addQuestion('Rating');
    expect(ids()[0]).toEqual(['a', added, 'b']);
    expect(useDesignerStore.getState().selection).toEqual({ kind: 'question', id: added });

    useDesignerStore.getState().undo();
    expect(ids()[0]).toEqual(['a', 'b']);
    expect(useDesignerStore.getState().selection).toEqual({ kind: 'questionnaire' });
    useDesignerStore.getState().redo();
    expect(ids()[0]).toEqual(['a', added, 'b']);
  });

  test('coalesces typing into a single undo step', () => {
    const { updateQuestion } = useDesignerStore.getState();
    updateQuestion('c', { title: 'N' }, 'c:title');
    updateQuestion('c', { title: 'No' }, 'c:title');
    updateQuestion('c', { title: 'Not' }, 'c:title');
    expect(useDesignerStore.getState().past).toHaveLength(1);
    useDesignerStore.getState().undo();
    expect(useDesignerStore.getState().questionnaire!.sections[1].questions[0].title).toBe('Note');
  });

  test('undo keeps server-controlled fields from the latest save', () => {
    useDesignerStore.getState().updateQuestion('c', { title: 'X' });
    useDesignerStore.getState().acknowledgeSave({ ...draft(), version: 7, status: 'Published' });
    useDesignerStore.getState().undo();
    const current = useDesignerStore.getState().questionnaire!;
    expect(current.version).toBe(7);
    expect(current.status).toBe('Published');
  });

  test('moving a question before its condition source clears the condition', () => {
    useDesignerStore.getState().moveQuestion('b', 's1', 0);
    const moved = useDesignerStore.getState().questionnaire!.sections[0].questions[0];
    expect(moved.id).toBe('b');
    expect(moved.visibleIf).toBeNull();
  });

  test('removing a section keeps its questions in the previous section', () => {
    useDesignerStore.getState().removeSection('s2');
    expect(ids()).toEqual([['a', 'b', 'c']]);
  });

  test('changing the source type resets dependent conditions to "answered"', () => {
    useDesignerStore.getState().setQuestionType('a', 'ShortText');
    expect(useDesignerStore.getState().questionnaire!.sections[0].questions[1].visibleIf)
      .toEqual({ questionId: 'a', operator: 'Answered', value: null });
  });
});

describe('<QuestionnaireDesigner />', () => {
  interface Call { url: string; method: string }
  function serve(initial: Questionnaire, options: { put?: (body: Questionnaire, count: number) => Response | undefined } = {}) {
    let stored = initial;
    let putCount = 0;
    const puts: Questionnaire[] = [];
    const calls: Call[] = [];
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      calls.push({ url, method });
      const reply = (data: unknown) => new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
      if (method === 'PUT') {
        const body = JSON.parse(String(init!.body)) as Questionnaire;
        puts.push(body);
        const custom = options.put?.(body, ++putCount);
        if (custom) return custom;
        stored = { ...body, version: stored.version + 1 };
        return reply(stored);
      }
      if (method === 'POST' && url.endsWith('/publish')) {
        stored = { ...stored, status: 'Published', publishedAt: '2024-01-01T00:00:00Z' };
        return reply(stored);
      }
      if (method === 'POST' && url.endsWith('/close')) { stored = { ...stored, status: 'Closed' }; return reply(stored); }
      if (method === 'POST' && url.endsWith('/reopen')) { stored = { ...stored, status: 'Published' }; return reply(stored); }
      if (method === 'POST' && url.endsWith('/duplicate')) return reply({ ...stored, questionnaireId: 'copy1', title: `${stored.title} (copia)`, responseCount: 0 });
      return reply(stored);
    });
    return { puts, calls };
  }

  const problem = (status: number, message: string) =>
    new Response(JSON.stringify({ code: 'Problem', message, errors: [] }), { status, headers: { 'Content-Type': 'application/json' } });

  /** The width decides the layout: three panes from 1360px, a single column with sheets below. */
  function setViewport(kind: 'phone' | 'tablet') {
    const width = kind === 'phone' ? 390 : 900;
    vi.stubGlobal('matchMedia', (query: string) => {
      const min = /min-width:\s*(\d+)px/.exec(query);
      return { matches: min ? width >= Number(min[1]) : false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() };
    });
  }

  const renderDesigner = () => render(
    <>
      <Routes>
        <Route path="/admin/questionnaires" element={<div>Elenco questionari</div>} />
        <Route path="/admin/questionnaires/:id/edit" element={<QuestionnaireDesigner autosaveDelayMs={0} />} />
        <Route path="/admin/questionnaires/:id/results" element={<div>Risultati aperti</div>} />
      </Routes>
      <AdminToastRegion />
    </>,
    { route: '/admin/questionnaires/q1/edit' },
  );
  const cardIds = () => screen.getAllByTestId(/^card-/).map(card => card.dataset.testid!.replace('card-', ''));
  const card = (id: string) => screen.getByTestId(`card-${id}`);
  const properties = () => screen.getByRole('complementary', { name: 'Proprietà' });
  const questions = () => useDesignerStore.getState().questionnaire!.sections.flatMap(s => s.questions);
  const choices = () => draft({ sections: [{ id: 's1', title: 'Generale', questions: [q('d', 'SingleChoice', 'Come ci hai conosciuto?', { options: [{ id: 'o1', label: 'Uno' }, { id: 'o2', label: 'Due' }, { id: 'o3', label: 'Tre' }] })] }] });

  beforeEach(() => adminToasts.clear());

  test('adds a question from the palette and autosaves it', async () => {
    const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
    const { puts } = serve(draft());
    renderDesigner();

    expect(await screen.findByText('Torneresti?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Aggiungi domanda: .*Stelle/i }));

    await waitFor(() => expect(puts).toHaveLength(1));
    expect(puts[0].sections.flatMap(s => s.questions).map(x => x.type)).toContain('Rating');
    expect(puts[0].version).toBe(1);
    expect(await screen.findByText('Salvato')).toBeInTheDocument();
    expect(useDesignerStore.getState().questionnaire!.version).toBe(2);
    expect(screen.getByText('Aggiunta una domanda «Stelle».')).toBeInTheDocument();
  });

  test('publish dialog lists blocking issues and publishes a valid questionnaire', async () => {
    const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
    serve(draft({ sections: [{ id: 's1', title: '', questions: [q('a', 'SingleChoice', '')] }] }));
    renderDesigner();

    await user.click(await screen.findByRole('button', { name: 'Pubblica' }));
    const dialog = await screen.findByRole('dialog', { name: 'Pubblica il questionario' });
    expect(within(dialog).getByRole('button', { name: 'Pubblica' })).toBeDisabled();
    expect(within(dialog).getAllByRole('button', { name: /Domanda 1/ }).length).toBeGreaterThan(0);
    await user.click(within(dialog).getByRole('button', { name: 'Annulla' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    useDesignerStore.getState().load(draft());
    await user.click(screen.getByRole('button', { name: 'Pubblica' }));
    const ready = await screen.findByRole('dialog', { name: 'Pubblica il questionario' });
    await user.click(within(ready).getByRole('button', { name: 'Pubblica' }));

    expect(await screen.findByRole('dialog', { name: /Condividi/ })).toBeInTheDocument();
    expect(useDesignerStore.getState().questionnaire!.status).toBe('Published');
    expect(await screen.findByText('Questionario pubblicato')).toBeInTheDocument();
  });

  test('locks the structure when responses exist', async () => {
    serve(draft({ status: 'Published', responseCount: 3 }));
    renderDesigner();

    expect(await screen.findByText(/ha 3 risposte/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Aggiungi domanda: .*Stelle/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Duplica' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Chiudi' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Elimina: Torneresti?' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Sposta giù: Torneresti?' })).toBeDisabled();
  });

  describe('reordering without dragging', () => {
    test('moves a question with the buttons, keeps focus on the pressed one and announces the position', async () => {
      const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
      serve(draft());
      renderDesigner();
      await screen.findByText('Torneresti?');

      screen.getByRole('button', { name: 'Sposta giù: Torneresti?' }).focus();
      await user.keyboard('{Enter}');
      expect(cardIds()).toEqual(['b', 'a', 'c']);
      expect(screen.getByRole('button', { name: 'Sposta giù: Torneresti?' })).toHaveFocus();
      expect(screen.getByText('Domanda spostata alla posizione 2 di 3.')).toBeInTheDocument();

      // Last of its section but not of the questionnaire: it crosses to the next section.
      await user.keyboard('{Enter}');
      expect(ids()).toEqual([['b'], ['a', 'c']]);
      expect(screen.getByRole('button', { name: 'Sposta giù: Torneresti?' })).toHaveFocus();
      await user.keyboard('{Enter}');
      expect(ids()).toEqual([['b'], ['c', 'a']]);
      // At the end the "down" button is disabled: focus falls back to "up" instead of being lost.
      expect(screen.getByRole('button', { name: 'Sposta su: Torneresti?' })).toHaveFocus();
    });

    test('the first question of a section moves up into the previous one', async () => {
      const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
      serve(draft());
      renderDesigner();
      await user.click(await screen.findByRole('button', { name: 'Sposta su: Note' }));
      expect(ids()).toEqual([['a', 'b', 'c'], []]);
      expect(screen.getByText('Sezione vuota: trascina qui un tipo di domanda o cliccalo nella palette.')).toBeInTheDocument();
    });

    test('moves sections and keeps focus on their button', async () => {
      const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
      serve(draft());
      renderDesigner();
      await screen.findByText('Torneresti?');
      screen.getByRole('button', { name: 'Sposta giù: Generale' }).focus();
      await user.keyboard('{Enter}');
      await waitFor(() => expect(useDesignerStore.getState().questionnaire!.sections.map(s => s.id)).toEqual(['s2', 's1']));
      expect(screen.getByRole('button', { name: 'Sposta su: Generale' })).toHaveFocus();
      expect(screen.getByText('Generale spostata alla posizione 2 di 2.')).toBeInTheDocument();
    });

    test('options can be moved with buttons too (single-pointer alternative to dragging)', async () => {
      const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
      serve(choices());
      renderDesigner();
      await user.click(await screen.findByTestId('card-d'));
      const list = within(properties());
      expect(list.getByRole('button', { name: 'Sposta su: Uno' })).toBeDisabled();

      list.getByRole('button', { name: 'Sposta giù: Uno' }).focus();
      await user.keyboard('{Enter}');
      expect(questions()[0].options.map(o => o.label)).toEqual(['Due', 'Uno', 'Tre']);
      expect(list.getByRole('button', { name: 'Sposta giù: Uno' })).toHaveFocus();
      expect(list.getAllByRole('textbox', { name: /^Opzione \d$/ }).map(input => (input as HTMLInputElement).value)).toEqual(['Due', 'Uno', 'Tre']);
    });
  });

  test('removing a question moves focus to its neighbour and can be undone', async () => {
    const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
    serve(draft());
    renderDesigner();
    await user.click(await screen.findByRole('button', { name: 'Elimina: Perché?' }));

    expect(cardIds()).toEqual(['a', 'c']);
    expect(screen.getByText('Domanda eliminata.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Trascina: Note' })).toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'Annulla' }));
    expect(cardIds()).toEqual(['a', 'b', 'c']);
    await user.click(screen.getByRole('button', { name: 'Ripeti' }));
    expect(cardIds()).toEqual(['a', 'c']);
  });

  test('undo and redo also answer to Ctrl+Z and Ctrl+Shift+Z outside text fields', async () => {
    const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
    serve(draft());
    renderDesigner();
    await screen.findByText('Torneresti?');
    await user.click(screen.getByRole('button', { name: 'Duplica: Torneresti?' }));
    expect(cardIds()).toHaveLength(4);
    await user.keyboard('{Control>}z{/Control}');
    expect(cardIds()).toHaveLength(3);
    await user.keyboard('{Control>}{Shift>}z{/Shift}{/Control}');
    expect(cardIds()).toHaveLength(4);
    expect(questions().map(x => x.title)).toContain('Torneresti? (copia)');
  });

  describe('properties', () => {
    test('edits the selected question: text, type and required flag', async () => {
      const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
      const { puts } = serve(draft());
      renderDesigner();
      expect(await screen.findByRole('heading', { name: 'Impostazioni questionario' })).toBeInTheDocument();

      await user.click(card('a'));
      const panel = within(properties());
      expect(panel.getByRole('heading', { name: 'Sì / No' })).toBeInTheDocument();
      const text = panel.getByRole('textbox', { name: 'Domanda' });
      await user.clear(text);
      await user.type(text, 'Ci sarai?');
      expect(questions()[0].title).toBe('Ci sarai?');

      await user.click(panel.getByRole('switch', { name: 'Risposta obbligatoria' }));
      expect(questions()[0].required).toBe(true);

      await user.selectOptions(panel.getByRole('combobox', { name: 'Tipo di domanda' }), 'Rating');
      expect(questions()[0].type).toBe('Rating');
      expect(panel.getByRole('heading', { name: 'Stelle' })).toBeInTheDocument();
      expect(panel.getByRole('spinbutton', { name: 'Numero di stelle (3-10)' })).toHaveValue(5);
      await waitFor(() => expect(puts.length).toBeGreaterThan(0));
    });

    test('options: Enter adds a row and focuses it, rows can be removed down to the minimum', async () => {
      const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
      serve(choices());
      renderDesigner();
      await user.click(await screen.findByTestId('card-d'));
      const panel = within(properties());

      await user.click(panel.getByRole('textbox', { name: 'Opzione 1' }));
      await user.keyboard('{Enter}');
      expect(panel.getByRole('textbox', { name: 'Opzione 2' })).toHaveFocus();
      await user.keyboard('Mezzo');
      expect(questions()[0].options.map(o => o.label)).toEqual(['Uno', 'Mezzo', 'Due', 'Tre']);

      await user.click(panel.getByRole('button', { name: 'Elimina opzione 2' }));
      await user.click(panel.getByRole('button', { name: 'Elimina opzione 2' }));
      expect(questions()[0].options.map(o => o.label)).toEqual(['Uno', 'Tre']);
      expect(panel.getByRole('button', { name: 'Elimina opzione 1' })).toBeDisabled();
    });

    test('options: pasted lists are cleaned and duplicates ignored', async () => {
      const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
      serve(choices());
      renderDesigner();
      await user.click(await screen.findByTestId('card-d'));
      await user.click(within(properties()).getByRole('button', { name: 'Incolla elenco' }));

      const dialog = await screen.findByRole('dialog', { name: 'Incolla un elenco' });
      await user.type(within(dialog).getByRole('textbox', { name: 'Elenco da incollare' }), 'Quattro{Enter}- Cinque{Enter}1. uno');
      await user.click(within(dialog).getByRole('button', { name: 'Aggiungi 2' }));
      expect(questions()[0].options.map(o => o.label)).toEqual(['Uno', 'Due', 'Tre', 'Quattro', 'Cinque']);
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });

    test('when responses exist the option texts stay editable but the list cannot change', async () => {
      const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
      serve({ ...choices(), status: 'Published', responseCount: 5 });
      renderDesigner();
      await user.click(await screen.findByTestId('card-d'));
      const panel = within(properties());

      expect(panel.getByRole('combobox', { name: 'Tipo di domanda' })).toBeDisabled();
      expect(panel.getByRole('button', { name: 'Elimina opzione 1' })).toBeDisabled();
      expect(panel.getByRole('button', { name: 'Sposta giù: Uno' })).toBeDisabled();
      expect(panel.queryByRole('button', { name: 'Aggiungi' })).not.toBeInTheDocument();
      await user.type(panel.getByRole('textbox', { name: 'Opzione 1' }), '!');
      expect(questions()[0].options[0].label).toBe('Uno!');
    });

    test('visibility: edits the condition and can drop it', async () => {
      const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
      serve(draft());
      renderDesigner();
      await user.click(await screen.findByTestId('card-b'));
      const panel = within(properties());

      expect(panel.getByRole('combobox', { name: 'Mostra se la domanda' })).toHaveDisplayValue('1. Torneresti?');
      expect(panel.getByRole('combobox', { name: 'Condizione' })).toHaveDisplayValue('è uguale a');
      await user.selectOptions(panel.getByRole('combobox', { name: 'Valore' }), 'true');
      expect(questions()[1].visibleIf).toEqual({ questionId: 'a', operator: 'Equals', value: 'true' });
      await user.selectOptions(panel.getByRole('combobox', { name: 'Condizione' }), 'Answered');
      expect(questions()[1].visibleIf).toEqual({ questionId: 'a', operator: 'Answered', value: null });

      await user.click(panel.getByRole('button', { name: 'Mostra sempre' }));
      expect(questions()[1].visibleIf).toBeNull();
      await user.click(panel.getByRole('button', { name: 'Mostra solo se…' }));
      expect(questions()[1].visibleIf).toEqual({ questionId: 'a', operator: 'Answered', value: null });
    });

    test('settings: a missing title is reported on the field and blocks saving', async () => {
      const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
      const { puts } = serve(draft());
      renderDesigner();
      const title = await screen.findByRole('textbox', { name: 'Titolo' });
      await user.clear(title);

      expect(title).toBeInvalid();
      expect(title).toHaveAccessibleDescription('Il titolo è obbligatorio.');
      expect(await screen.findByText('Non salvato')).toBeInTheDocument();
      expect(screen.getByText('Correggi gli errori evidenziati per salvare.')).toBeInTheDocument();
      expect(puts).toHaveLength(0);

      await user.type(title, 'Nuovo titolo');
      await waitFor(() => expect(puts.at(-1)?.title).toBe('Nuovo titolo'));
      expect(await screen.findByText('Salvato')).toBeInTheDocument();
    });

    test('settings: the closing date must follow the opening date', async () => {
      serve(draft());
      renderDesigner();
      const opens = await screen.findByLabelText('Apre il');
      const closes = screen.getByLabelText('Chiude il');
      fireEvent.change(opens, { target: { value: '2030-01-02T10:00' } });
      fireEvent.change(closes, { target: { value: '2030-01-01T10:00' } });

      expect(closes).toBeInvalid();
      expect(closes).toHaveAccessibleDescription('La data di chiusura deve seguire quella di apertura.');
      fireEvent.change(closes, { target: { value: '2030-01-03T10:00' } });
      expect(closes).toBeValid();
      expect(useDesignerStore.getState().questionnaire!.closesAt).toBe(new Date('2030-01-03T10:00').toISOString());
    });

    test('settings: identified respondents get the default consent text; the mode is fixed once there are responses', async () => {
      const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
      serve(draft());
      renderDesigner();
      await user.click(await screen.findByRole('radio', { name: /Identificati/ }));
      expect(screen.getByRole('textbox', { name: /informativa privacy/ })).toHaveValue(DEFAULT_CONSENT_TEXT);
      await user.click(screen.getByRole('switch', { name: 'Una sola risposta per indirizzo email' }));
      expect(useDesignerStore.getState().questionnaire!.onePerEmail).toBe(true);

      useDesignerStore.getState().load(draft({ responseCount: 2, status: 'Published' }));
      expect(await screen.findByRole('radio', { name: /Anonimi/ })).toBeDisabled();
      expect(screen.getByText('Non si può cambiare: il questionario ha già delle risposte.')).toBeInTheDocument();
    });

    test('a section can be renamed and described from the properties', async () => {
      const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
      serve(draft());
      renderDesigner();
      await user.click(await screen.findByRole('textbox', { name: 'Titolo sezione 2' }));
      const panel = within(properties());
      expect(panel.getByRole('heading', { name: 'Sezione' })).toBeInTheDocument();
      await user.type(panel.getByRole('textbox', { name: 'Descrizione' }), 'Una nota');
      expect(useDesignerStore.getState().questionnaire!.sections[1].description).toBe('Una nota');
      await user.click(panel.getByRole('button', { name: 'Impostazioni' }));
      expect(await screen.findByRole('heading', { name: 'Impostazioni questionario' })).toBeInTheDocument();
    });
  });

  describe('publishing', () => {
    test('an issue in the publish checklist opens the question that needs fixing, with the problem on its field', async () => {
      const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
      serve(draft({ sections: [{ id: 's1', title: '', questions: [q('a', 'SingleChoice', 'Scegli', { options: [{ id: 'x', label: 'Uno' }] })] }] }));
      renderDesigner();
      await user.click(await screen.findByRole('button', { name: 'Pubblica' }));
      const dialog = await screen.findByRole('dialog', { name: 'Pubblica il questionario' });
      await user.click(within(dialog).getByRole('button', { name: /Servono almeno due opzioni/ }));

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(within(properties()).getByRole('heading', { name: 'Scelta singola' })).toBeInTheDocument();
      expect(within(properties()).getByRole('group', { name: 'Opzioni' })).toHaveAccessibleDescription('Servono almeno due opzioni.');
      expect(within(card('a')).getByText('Da completare')).toBeInTheDocument();
    });

    test('a failed publish is reported inside the dialog', async () => {
      const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
      serve(draft());
      renderDesigner();
      await user.click(await screen.findByRole('button', { name: 'Pubblica' }));
      const dialog = await screen.findByRole('dialog', { name: 'Pubblica il questionario' });
      vi.mocked(fetch).mockImplementation(async () => problem(500, 'Il server non risponde.'));
      await user.click(within(dialog).getByRole('button', { name: 'Pubblica' }));
      expect(await within(dialog).findByRole('alert')).toHaveTextContent('Il server non risponde.');
      expect(useDesignerStore.getState().questionnaire!.status).toBe('Draft');
    });

    test('closes and reopens a published questionnaire', async () => {
      const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
      const { calls } = serve(draft({ status: 'Published' }));
      renderDesigner();
      expect(screen.queryByText('Bozza')).not.toBeInTheDocument();

      await user.click(await screen.findByRole('button', { name: 'Chiudi' }));
      expect(await screen.findByRole('button', { name: 'Riapri' })).toBeInTheDocument();
      expect(screen.getByText('Chiuso')).toBeInTheDocument();
      expect(await screen.findByText('Questionario chiuso')).toBeInTheDocument();
      expect(calls.some(c => c.method === 'POST' && c.url.endsWith('/Questionnaire/q1/close'))).toBe(true);

      await user.click(screen.getByRole('button', { name: 'Riapri' }));
      expect(await screen.findByRole('button', { name: 'Chiudi' })).toBeInTheDocument();
      expect(calls.some(c => c.method === 'POST' && c.url.endsWith('/Questionnaire/q1/reopen'))).toBe(true);
    });

    test('duplicates a locked questionnaire and opens the copy', async () => {
      const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
      const { calls } = serve(draft({ status: 'Published', responseCount: 3 }));
      renderDesigner();
      await user.click(await screen.findByRole('button', { name: 'Duplica' }));
      await waitFor(() => expect(calls.some(c => c.method === 'POST' && c.url.endsWith('/Questionnaire/q1/duplicate'))).toBe(true));
      // The copy has no responses and opens in the editor.
      await waitFor(() => expect(calls.filter(c => c.method === 'GET' && c.url.endsWith('/Questionnaire/copy1'))).toHaveLength(1));
    });
  });

  describe('autosave status', () => {
    test('a version conflict is announced and "Ricarica" loads the latest version', async () => {
      const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
      const { calls } = serve(draft(), { put: (_, count) => (count === 1 ? problem(409, 'Il questionario è stato modificato da un altro utente.') : undefined) });
      renderDesigner();
      await user.click(await screen.findByRole('button', { name: /Aggiungi domanda: .*Stelle/i }));

      expect(await screen.findByText('Conflitto')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveTextContent('Il questionario è stato modificato da un altro utente.');
      const before = calls.filter(c => c.method === 'GET').length;
      await user.click(screen.getByRole('button', { name: 'Ricarica' }));
      await waitFor(() => expect(calls.filter(c => c.method === 'GET').length).toBe(before + 1));
      expect(await screen.findByText('Salvato')).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(cardIds()).toEqual(['a', 'b', 'c']);
    });

    test('a failed save offers a retry', async () => {
      const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
      const { puts } = serve(draft(), { put: (_, count) => (count === 1 ? problem(500, 'Errore del server (500).') : undefined) });
      renderDesigner();
      await user.click(await screen.findByRole('button', { name: /Aggiungi domanda: .*Stelle/i }));

      expect(await screen.findByText('Errore di salvataggio')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Riprova' }));
      expect(await screen.findByText('Salvato')).toBeInTheDocument();
      expect(puts).toHaveLength(2);
    });
  });

  test('shows a load failure with a retry instead of an empty editor', async () => {
    const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
    serve(draft());
    vi.mocked(fetch).mockResolvedValueOnce(problem(404, 'Questionario non trovato.'));
    renderDesigner();
    expect(await screen.findByRole('alert')).toHaveTextContent('Questionario non trovato.');
    await user.click(screen.getByRole('button', { name: 'Riprova' }));
    expect(await screen.findByText('Torneresti?')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Torna ai questionari' })).toHaveAttribute('href', '/admin/questionnaires');
  });

  describe('dialogs', () => {
    test('preview runs the real questionnaire in a desktop or phone frame and closes', async () => {
      const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
      serve(draft());
      renderDesigner();
      await user.click(await screen.findByRole('button', { name: 'Anteprima' }));

      const dialog = await screen.findByRole('dialog', { name: 'Anteprima del questionario' });
      expect(within(dialog).getByRole('form', { name: 'Feedback evento' })).toBeInTheDocument();
      expect(within(dialog).getByText('Le risposte non vengono salvate.')).toBeInTheDocument();
      await user.click(within(dialog).getByRole('radio', { name: 'Smartphone' }));
      expect(within(dialog).getByRole('form', { name: 'Feedback evento' })).toBeInTheDocument();
      await user.click(within(dialog).getByRole('button', { name: 'Chiudi anteprima' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });

    test('share shows the public link and the event link, and copies them', async () => {
      const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
      serve(draft({ workshopId: 'w9', status: 'Published' }));
      renderDesigner();
      await user.click(await screen.findByRole('button', { name: 'Condividi' }));

      const dialog = await screen.findByRole('dialog', { name: 'Condividi il questionario' });
      expect((within(dialog).getByRole('textbox', { name: 'Link pubblico' }) as HTMLInputElement).value).toMatch(/\/q\/q1$/);
      expect((within(dialog).getByRole('textbox', { name: "Link dell'evento" }) as HTMLInputElement).value).toMatch(/\/feedback\/w9$/);
      expect(within(dialog).getByRole('img', { name: 'QR code del questionario' })).toBeInTheDocument();
      expect(within(dialog).getByRole('button', { name: 'Scarica PNG' })).toBeInTheDocument();
      expect(within(dialog).getByRole('button', { name: 'Scarica SVG (stampa)' })).toBeInTheDocument();

      await user.click(within(dialog).getByRole('button', { name: 'Copia link pubblico' }));
      expect(await navigator.clipboard.readText()).toMatch(/\/q\/q1$/);
      expect(within(dialog).getByText('Link pubblico copiato negli appunti.')).toBeInTheDocument();
    });

    test('share warns that a draft is not reachable yet', async () => {
      const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
      serve(draft());
      renderDesigner();
      await user.click(await screen.findByRole('button', { name: 'Condividi' }));
      expect(await screen.findByText('Il link funziona solo quando il questionario è pubblicato.')).toBeInTheDocument();
    });
  });

  describe('on a phone', () => {
    test('is a single column: the palette and the properties open as sheets', async () => {
      const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
      setViewport('phone');
      serve(draft());
      renderDesigner();
      await screen.findByText('Torneresti?');
      expect(screen.queryByRole('complementary', { name: 'Proprietà' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Aggiungi domanda: / })).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Aggiungi domanda' }));
      const palette = await screen.findByRole('dialog', { name: 'Aggiungi domanda' });
      await user.click(within(palette).getByRole('button', { name: /Aggiungi domanda: .*Stelle/i }));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(questions().at(-1)?.type).toBe('Rating');

      await user.click(screen.getByRole('button', { name: 'Proprietà: Stelle' }));
      const sheet = await screen.findByRole('dialog', { name: 'Proprietà: Stelle' });
      await user.type(within(sheet).getByRole('textbox', { name: 'Domanda' }), 'Voto?');
      expect(questions().at(-1)?.title).toBe('Voto?');
      await user.click(within(sheet).getByRole('button', { name: 'Chiudi' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });

    test('settings and the secondary actions are in the page: Impostazioni and the actions menu', async () => {
      const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
      setViewport('phone');
      serve(draft());
      renderDesigner();
      await user.click(await screen.findByRole('button', { name: 'Impostazioni' }));
      const sheet = await screen.findByRole('dialog', { name: 'Proprietà: Impostazioni questionario' });
      expect(within(sheet).getByRole('textbox', { name: 'Titolo' })).toHaveValue('Feedback evento');
      await user.click(within(sheet).getByRole('button', { name: 'Chiudi' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

      await user.click(screen.getByRole('button', { name: 'Altre azioni' }));
      expect(await screen.findByRole('menuitem', { name: 'Anteprima' })).toBeInTheDocument();
      await user.click(screen.getByRole('menuitem', { name: 'Risultati' }));
      expect(await screen.findByText('Risultati aperti')).toBeInTheDocument();
    });
  });
});

describe('drag announcements', () => {
  test('are in Italian and use the names of the things being dragged', () => {
    const announcements = dragAnnouncements(id => `«${id}»`);
    const active = { id: 'a' } as never;
    const over = { id: 'b' } as never;
    expect(announcements.onDragStart({ active })).toBe('Hai preso: «a».');
    expect(announcements.onDragOver({ active, over })).toBe('«a» è sopra: «b».');
    expect(announcements.onDragOver({ active, over: null })).toBe('«a» non è sopra una posizione valida.');
    expect(announcements.onDragEnd({ active, over })).toBe('«a» rilasciato su: «b».');
    expect(announcements.onDragCancel({ active, over: null })).toBe("Spostamento annullato: «a» è rimasto dov'era.");
    expect(screenReaderInstructions.draggable).toMatch(/Sposta su e Sposta giù/);
  });
});

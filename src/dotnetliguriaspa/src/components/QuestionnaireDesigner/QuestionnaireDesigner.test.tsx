import React from 'react';
import { Route, Routes } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { render, screen, waitFor, within } from '../../test-utils';
import QuestionnaireDesigner from './QuestionnaireDesigner';
import { useDesignerStore } from './designerStore';
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
  function serve(initial: Questionnaire) {
    let stored = initial;
    const puts: Questionnaire[] = [];
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      const reply = (data: unknown) => new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
      if (method === 'PUT') {
        const body = JSON.parse(String(init!.body)) as Questionnaire;
        puts.push(body);
        stored = { ...body, version: stored.version + 1 };
        return reply(stored);
      }
      if (method === 'POST' && url.endsWith('/publish')) {
        stored = { ...stored, status: 'Published', publishedAt: '2024-01-01T00:00:00Z' };
        return reply(stored);
      }
      return reply(stored);
    });
    return puts;
  }

  const renderDesigner = () => render(
    <Routes><Route path="/admin/questionnaires/:id/edit" element={<QuestionnaireDesigner autosaveDelayMs={0} />} /></Routes>,
    { route: '/admin/questionnaires/q1/edit' },
  );

  test('adds a question from the palette and autosaves it', async () => {
    const user = userEvent.setup();
    const puts = serve(draft());
    renderDesigner();

    expect(await screen.findByText('Torneresti?')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Aggiungi' }));
    await user.click(screen.getByRole('button', { name: /Aggiungi domanda: .*Stelle/i }));

    await waitFor(() => expect(puts).toHaveLength(1));
    expect(puts[0].sections.flatMap(s => s.questions).map(x => x.type)).toContain('Rating');
    expect(puts[0].version).toBe(1);
    expect(await screen.findByRole('status', { name: 'Stato salvataggio: Salvato' })).toBeInTheDocument();
    expect(useDesignerStore.getState().questionnaire!.version).toBe(2);
  });

  test('publish dialog lists blocking issues and publishes a valid questionnaire', async () => {
    const user = userEvent.setup();
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
  });

  test('locks the structure when responses exist', async () => {
    serve(draft({ status: 'Published', responseCount: 3 }));
    renderDesigner();

    expect(await screen.findByText(/ha 3 risposte/)).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Aggiungi' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Duplica' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Chiudi' })).toBeInTheDocument();
  });
});

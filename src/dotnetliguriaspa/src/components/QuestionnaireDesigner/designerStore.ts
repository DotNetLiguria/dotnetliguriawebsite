import { create } from 'zustand';
import { changeQuestionType, cloneQuestion, newQuestion, newSection } from '../../questionnaire/factory';
import type { Question, Questionnaire, QuestionnaireSection, QuestionType } from '../../questionnaire/types';

const HISTORY_LIMIT = 100;

export type Selection = { kind: 'questionnaire' } | { kind: 'section'; id: string } | { kind: 'question'; id: string };

export interface DesignerState {
  questionnaire: Questionnaire | null;
  past: Questionnaire[];
  future: Questionnaire[];
  lastChangeKey: string | null;
  /** Incremented on every local edit; autosave compares it with the saved revision. */
  revision: number;
  selection: Selection;

  load: (questionnaire: Questionnaire) => void;
  /** Applies server-controlled fields (version, status, timestamps) without touching local edits. */
  acknowledgeSave: (saved: Questionnaire, statusAction?: boolean) => void;
  replace: (questionnaire: Questionnaire) => void;
  change: (recipe: (draft: Questionnaire) => void, coalesceKey?: string) => void;
  undo: () => void;
  redo: () => void;
  select: (selection: Selection) => void;

  addQuestion: (type: QuestionType, target?: { sectionId: string; index: number }) => string;
  updateQuestion: (id: string, patch: Partial<Question>, coalesceKey?: string) => void;
  setQuestionType: (id: string, type: QuestionType) => void;
  duplicateQuestion: (id: string) => void;
  removeQuestion: (id: string) => void;
  moveQuestion: (id: string, sectionId: string, index: number) => void;
  addSection: () => void;
  updateSection: (id: string, patch: Partial<QuestionnaireSection>, coalesceKey?: string) => void;
  removeSection: (id: string) => void;
  moveSection: (id: string, index: number) => void;
}

export function locateQuestion(questionnaire: Questionnaire, id: string) {
  for (let s = 0; s < questionnaire.sections.length; s++) {
    const index = questionnaire.sections[s].questions.findIndex(q => q.id === id);
    if (index >= 0) return { section: questionnaire.sections[s], sectionIndex: s, index, question: questionnaire.sections[s].questions[index] };
  }
  return null;
}

const withServerFields = (snapshot: Questionnaire, current: Questionnaire): Questionnaire => ({
  ...snapshot,
  version: current.version,
  updatedAt: current.updatedAt,
  status: current.status,
  publishedAt: current.publishedAt,
  responseCount: current.responseCount,
});

// Removes conditions that would point to deleted or later questions.
function pruneConditions(questionnaire: Questionnaire) {
  const seen = new Set<string>();
  for (const section of questionnaire.sections) {
    for (const question of section.questions) {
      if (question.visibleIf && !seen.has(question.visibleIf.questionId)) question.visibleIf = null;
      seen.add(question.id);
    }
  }
}

export const useDesignerStore = create<DesignerState>((set, get) => {
  const change = (recipe: (draft: Questionnaire) => void, coalesceKey?: string) => {
    const { questionnaire, past, lastChangeKey, revision } = get();
    if (!questionnaire) return;
    const draft = structuredClone(questionnaire);
    recipe(draft);
    const coalesce = !!coalesceKey && coalesceKey === lastChangeKey;
    set({
      questionnaire: draft,
      past: coalesce ? past : [...past, questionnaire].slice(-HISTORY_LIMIT),
      future: [],
      lastChangeKey: coalesceKey ?? null,
      revision: revision + 1,
    });
  };

  const selectAfterRemoval = (questionnaire: Questionnaire) => {
    const { selection } = get();
    if (selection.kind === 'question' && !locateQuestion(questionnaire, selection.id)) set({ selection: { kind: 'questionnaire' } });
    if (selection.kind === 'section' && !questionnaire.sections.some(s => s.id === selection.id)) set({ selection: { kind: 'questionnaire' } });
  };

  return {
    questionnaire: null,
    past: [],
    future: [],
    lastChangeKey: null,
    revision: 0,
    selection: { kind: 'questionnaire' },

    load: questionnaire => set({ questionnaire, past: [], future: [], lastChangeKey: null, revision: 0, selection: { kind: 'questionnaire' } }),
    acknowledgeSave: (saved, statusAction) => set(state => state.questionnaire
      ? {
        questionnaire: {
          ...state.questionnaire, version: saved.version, updatedAt: saved.updatedAt, responseCount: saved.responseCount,
          status: saved.status, publishedAt: saved.publishedAt, ...(statusAction ? { closesAt: saved.closesAt } : {}),
        },
      }
      : {}),
    replace: questionnaire => set(state => ({ questionnaire, revision: state.revision + 1, lastChangeKey: null })),
    change,
    undo: () => {
      const { past, future, questionnaire, revision } = get();
      if (!questionnaire || past.length === 0) return;
      const previous = withServerFields(past[past.length - 1], questionnaire);
      set({ questionnaire: previous, past: past.slice(0, -1), future: [questionnaire, ...future], lastChangeKey: null, revision: revision + 1 });
      selectAfterRemoval(previous);
    },
    redo: () => {
      const { past, future, questionnaire, revision } = get();
      if (!questionnaire || future.length === 0) return;
      const next = withServerFields(future[0], questionnaire);
      set({ questionnaire: next, past: [...past, questionnaire], future: future.slice(1), lastChangeKey: null, revision: revision + 1 });
      selectAfterRemoval(next);
    },
    select: selection => set({ selection, lastChangeKey: null }),

    addQuestion: (type, target) => {
      const question = newQuestion(type);
      change(draft => {
        if (draft.sections.length === 0) draft.sections.push(newSection());
        let sectionIndex = draft.sections.length - 1;
        let index = draft.sections[sectionIndex].questions.length;
        const selection = get().selection;
        if (target) {
          sectionIndex = Math.max(0, draft.sections.findIndex(s => s.id === target.sectionId));
          index = target.index;
        } else if (selection.kind === 'question') {
          const location = locateQuestion(draft, selection.id);
          if (location) { sectionIndex = location.sectionIndex; index = location.index + 1; }
        } else if (selection.kind === 'section') {
          const found = draft.sections.findIndex(s => s.id === selection.id);
          if (found >= 0) { sectionIndex = found; index = draft.sections[found].questions.length; }
        }
        draft.sections[sectionIndex].questions.splice(index, 0, question);
      });
      set({ selection: { kind: 'question', id: question.id } });
      return question.id;
    },
    updateQuestion: (id, patch, coalesceKey) => change(draft => {
      const location = locateQuestion(draft, id);
      if (location) location.section.questions[location.index] = { ...location.question, ...patch };
    }, coalesceKey),
    setQuestionType: (id, type) => change(draft => {
      const location = locateQuestion(draft, id);
      if (location) location.section.questions[location.index] = changeQuestionType(location.question, type);
      for (const q of draft.sections.flatMap(s => s.questions)) {
        if (q.visibleIf?.questionId === id && q.visibleIf.operator !== 'Answered' && q.visibleIf.operator !== 'NotAnswered') {
          q.visibleIf = { questionId: id, operator: 'Answered', value: null };
        }
      }
    }),
    duplicateQuestion: id => {
      let copyId = '';
      change(draft => {
        const location = locateQuestion(draft, id);
        if (!location) return;
        const copy = cloneQuestion(location.question);
        copyId = copy.id;
        location.section.questions.splice(location.index + 1, 0, copy);
      });
      if (copyId) set({ selection: { kind: 'question', id: copyId } });
    },
    removeQuestion: id => {
      change(draft => {
        const location = locateQuestion(draft, id);
        if (location) location.section.questions.splice(location.index, 1);
        pruneConditions(draft);
      });
      selectAfterRemoval(get().questionnaire!);
    },
    moveQuestion: (id, sectionId, index) => change(draft => {
      const location = locateQuestion(draft, id);
      const target = draft.sections.find(s => s.id === sectionId);
      if (!location || !target) return;
      location.section.questions.splice(location.index, 1);
      target.questions.splice(Math.max(0, Math.min(index, target.questions.length)), 0, location.question);
      pruneConditions(draft);
    }),
    addSection: () => {
      const section = newSection(`Sezione ${(get().questionnaire?.sections.length ?? 0) + 1}`);
      change(draft => { draft.sections.push(section); });
      set({ selection: { kind: 'section', id: section.id } });
    },
    updateSection: (id, patch, coalesceKey) => change(draft => {
      const index = draft.sections.findIndex(s => s.id === id);
      if (index >= 0) draft.sections[index] = { ...draft.sections[index], ...patch };
    }, coalesceKey),
    removeSection: id => {
      change(draft => {
        const index = draft.sections.findIndex(s => s.id === id);
        if (index < 0) return;
        const [removed] = draft.sections.splice(index, 1);
        // Questions are kept by merging them into the previous (or next) section.
        if (removed.questions.length > 0) {
          if (draft.sections.length === 0) draft.sections.push({ ...newSection(), questions: removed.questions });
          else draft.sections[Math.max(0, index - 1)].questions.push(...removed.questions);
        }
        pruneConditions(draft);
      });
      selectAfterRemoval(get().questionnaire!);
    },
    moveSection: (id, index) => change(draft => {
      const from = draft.sections.findIndex(s => s.id === id);
      if (from < 0) return;
      const [section] = draft.sections.splice(from, 1);
      draft.sections.splice(Math.max(0, Math.min(index, draft.sections.length)), 0, section);
      pruneConditions(draft);
    }),
  };
});

import React, { FC, useEffect, useRef } from 'react';
import { Button } from 'react-aria-components';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { AdminIcon } from '../../admin/icons';
import { btn } from '../../admin/ui';
import { restoreMoveFocus } from '../../admin/pages/listKit';
import QuestionCard from './QuestionCard';
import { FieldText, Icon, miniIcon, MoveButtons } from './designerUi';
import { useDesignerStore } from './designerStore';
import { allQuestions, isAnswerable } from '../../questionnaire/rules';
import type { QuestionnaireSection, QuestionnaireValidationError } from '../../questionnaire/types';

const SectionDropZone: FC<{ sectionId: string; empty: boolean; locked: boolean; compact: boolean }> = ({ sectionId, empty, locked, compact }) => {
  const { setNodeRef, isOver } = useDroppable({ id: `drop:${sectionId}`, data: { kind: 'section-end', sectionId }, disabled: locked });
  if (locked && !empty) return null;
  const text = empty
    ? (compact ? 'Sezione vuota: aggiungi una domanda con il pulsante «Aggiungi domanda».' : 'Sezione vuota: trascina qui un tipo di domanda o cliccalo nella palette.')
    : 'Rilascia qui per aggiungere in fondo';
  // On touch screens a non-empty section's end target is noise: the move buttons already cross sections.
  return (
    <div
      ref={setNodeRef}
      className={`rounded-xl border-2 border-dashed text-center ${empty ? 'p-6 text-base' : 'p-2.5 text-sm pointer-coarse:hidden'} ${isOver ? 'border-cyan-700 bg-cyan-50 text-navy' : 'border-line text-muted'}`}
    >
      {text}
    </div>
  );
};

export interface DesignerCanvasProps {
  locked: boolean;
  /** Definition problems per question, already filtered by whether they should be shown yet. */
  questionErrors: Map<string, QuestionnaireValidationError[]>;
  /** Properties are not beside the canvas: cards and sections get a button that opens them. */
  onOpenProperties?: () => void;
  /** Politely announced to screen readers (moves, removals). */
  announce: (message: string) => void;
}

type Refocus = { kind: 'move'; id: string; delta: -1 | 1 } | { kind: 'card'; id: string } | { kind: 'canvas' };

const DesignerCanvas: FC<DesignerCanvasProps> = ({ locked, questionErrors, onOpenProperties, announce }) => {
  const questionnaire = useDesignerStore(s => s.questionnaire)!;
  const selection = useDesignerStore(s => s.selection);
  const store = useDesignerStore.getState;
  const select = useDesignerStore(s => s.select);
  const multipleSections = questionnaire.sections.length > 1;
  const compact = !!onOpenProperties;
  const root = useRef<HTMLDivElement>(null);
  const refocus = useRef<Refocus | null>(null);

  // Cards that move are re-inserted in the DOM and the browser drops focus: restore it to the pressed button.
  // After a removal, focus goes to the neighbouring card so that a keyboard user keeps their place.
  useEffect(() => {
    const target = refocus.current;
    if (!target) return;
    refocus.current = null;
    if (target.kind === 'move') restoreMoveFocus(target.id, target.delta);
    else if (target.kind === 'card') document.querySelector<HTMLElement>(`[data-testid="card-${target.id}"] button`)?.focus();
    else root.current?.focus();
  }, [questionnaire]);

  const positionOf = (id: string) => {
    const all = allQuestions(store().questionnaire!);
    return `${all.findIndex(q => q.id === id) + 1} di ${all.length}`;
  };

  let counter = 0;
  const renderSection = (section: QuestionnaireSection, sectionIndex: number) => {
    const sectionSelected = selection.kind === 'section' && selection.id === section.id;
    const sectionLabel = section.title || `Sezione ${sectionIndex + 1}`;
    return (
      <section
        key={section.id}
        aria-label={sectionLabel}
        className={`rounded-2xl border bg-white p-2.5 sm:p-4 ${sectionSelected ? 'border-navy ring-2 ring-navy/15' : 'border-line'}`}
      >
        {(multipleSections || section.title || sectionSelected) && (
          <div className="mb-3" onClick={() => select({ kind: 'section', id: section.id })}>
            <div className="flex items-center gap-0.5">
              <div className="min-w-0 flex-1" onClick={event => event.stopPropagation()}>
                <FieldText
                  aria-label={`Titolo sezione ${sectionIndex + 1}`}
                  placeholder={`Sezione ${sectionIndex + 1} (titolo facoltativo)`}
                  value={section.title ?? ''}
                  maxLength={200}
                  onFocus={() => select({ kind: 'section', id: section.id })}
                  onChange={title => store().updateSection(section.id, { title }, `section:${section.id}:title`)}
                  inputClassName="text-lg font-bold"
                />
              </div>
              <MoveButtons
                id={`s-${section.id}`}
                label={sectionLabel}
                canUp={sectionIndex > 0}
                canDown={sectionIndex < questionnaire.sections.length - 1}
                disabled={locked}
                onMove={delta => {
                  refocus.current = { kind: 'move', id: `s-${section.id}`, delta };
                  store().moveSection(section.id, sectionIndex + delta);
                  announce(`${sectionLabel} spostata alla posizione ${sectionIndex + delta + 1} di ${questionnaire.sections.length}.`);
                }}
              />
              <Button aria-label={`Elimina sezione ${sectionIndex + 1}`} isDisabled={locked || !multipleSections} onPress={() => { store().removeSection(section.id); announce(`${sectionLabel} eliminata: le domande sono passate alla sezione precedente.`); }} className={miniIcon}>
                <AdminIcon name="trash" />
              </Button>
              {onOpenProperties && (
                <Button aria-label={`Proprietà sezione ${sectionIndex + 1}`} onPress={() => { select({ kind: 'section', id: section.id }); onOpenProperties(); }} className={miniIcon}>
                  <Icon name="sliders" />
                </Button>
              )}
            </div>
            {section.description && <p className="mt-1 px-1 text-sm text-muted">{section.description}</p>}
          </div>
        )}
        <SortableContext items={section.questions.map(q => q.id)} strategy={verticalListSortingStrategy}>
          <ul className="space-y-2.5">
            {section.questions.map((question, index) => {
              const number = isAnswerable(question.type) ? ++counter : undefined;
              const isFirst = sectionIndex === 0 && index === 0;
              const isLast = sectionIndex === questionnaire.sections.length - 1 && index === section.questions.length - 1;
              return (
                <QuestionCard
                  key={question.id}
                  question={question}
                  sectionId={section.id}
                  number={number}
                  locked={locked}
                  selected={selection.kind === 'question' && selection.id === question.id}
                  hasErrors={questionErrors.has(question.id)}
                  canMoveUp={!isFirst}
                  canMoveDown={!isLast}
                  onSelect={() => { if (!(selection.kind === 'question' && selection.id === question.id)) select({ kind: 'question', id: question.id }); }}
                  onTitleChange={title => store().updateQuestion(question.id, { title }, `${question.id}:title`)}
                  onDuplicate={() => { store().duplicateQuestion(question.id); announce('Domanda duplicata.'); }}
                  onRemove={() => {
                    const all = allQuestions(questionnaire);
                    const at = all.findIndex(q => q.id === question.id);
                    const neighbour = all[at + 1] ?? all[at - 1];
                    refocus.current = neighbour ? { kind: 'card', id: neighbour.id } : { kind: 'canvas' };
                    store().removeQuestion(question.id);
                    announce('Domanda eliminata.');
                  }}
                  onMove={delta => {
                    refocus.current = { kind: 'move', id: `q-${question.id}`, delta };
                    const sections = questionnaire.sections;
                    if (delta === -1 && index === 0) store().moveQuestion(question.id, sections[sectionIndex - 1].id, sections[sectionIndex - 1].questions.length);
                    else if (delta === 1 && index === section.questions.length - 1) store().moveQuestion(question.id, sections[sectionIndex + 1].id, 0);
                    else store().moveQuestion(question.id, section.id, index + delta);
                    announce(`Domanda spostata alla posizione ${positionOf(question.id)}.`);
                  }}
                  onOpenProperties={onOpenProperties && (() => { select({ kind: 'question', id: question.id }); onOpenProperties(); })}
                />
              );
            })}
          </ul>
        </SortableContext>
        <div className={section.questions.length ? 'mt-2.5' : ''}>
          <SectionDropZone sectionId={section.id} empty={section.questions.length === 0} locked={locked} compact={compact} />
        </div>
      </section>
    );
  };

  return (
    <div ref={root} tabIndex={-1} className="space-y-4 outline-none">
      {questionnaire.sections.map(renderSection)}
      <div className="flex justify-center">
        <Button isDisabled={locked} onPress={() => store().addSection()} className={btn.secondary}><AdminIcon name="plus" />Aggiungi sezione</Button>
      </div>
    </div>
  );
};

export default DesignerCanvas;

import React, { FC } from 'react';
import { Button } from 'react-aria-components';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AdminIcon } from '../../admin/icons';
import { Badge } from '../../admin/ui';
import { QuestionTypeIcon } from './QuestionTypeIcon';
import { FieldText, Icon, miniIcon, MoveButtons } from './designerUi';
import QuestionField from '../QuestionnaireRunner/QuestionField';
import { questionTypeLabel } from '../../questionnaire/factory';
import type { Question } from '../../questionnaire/types';

export interface QuestionCardProps {
  question: Question;
  sectionId: string;
  number?: number;
  selected: boolean;
  locked: boolean;
  hasErrors: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onSelect: () => void;
  onTitleChange: (title: string) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onMove: (delta: -1 | 1) => void;
  /** Where the properties are not beside the canvas: a button that opens them. */
  onOpenProperties?: () => void;
}

const handleCls = 'inline-grid size-9 shrink-0 cursor-grab touch-none place-items-center rounded-full text-muted transition-colors hover:bg-cyan-50 hover:text-navy disabled:cursor-default disabled:opacity-35 pointer-coarse:size-11 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-cyan-700';

const QuestionCard: FC<QuestionCardProps> = ({
  question, sectionId, number, selected, locked, hasErrors, canMoveUp, canMoveDown, onSelect, onTitleChange, onDuplicate, onRemove, onMove, onOpenProperties,
}) => {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: question.id, data: { kind: 'question', sectionId }, disabled: locked });
  const label = question.title || questionTypeLabel(question.type);
  const tone = selected ? 'border-navy ring-2 ring-navy/15' : hasErrors ? 'border-line border-l-[#b45309]' : 'border-line hover:border-cyan-200';

  return (
    <li ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}>
      <div
        role="group"
        aria-label={`${number ? `Domanda ${number}: ` : ''}${label}`}
        data-testid={`card-${question.id}`}
        data-selected={selected ? 'true' : undefined}
        aria-current={selected ? 'true' : undefined}
        onClick={onSelect}
        onFocusCapture={onSelect}
        className={`relative cursor-pointer rounded-xl border bg-white p-2.5 transition-colors sm:p-3 ${hasErrors && !selected ? 'border-l-4' : ''} ${tone}`}
      >
        <div className="flex flex-wrap items-center gap-x-0.5 gap-y-1">
          <button type="button" ref={setActivatorNodeRef} disabled={locked} aria-label={`Trascina: ${label}`} className={handleCls} {...attributes} {...listeners}>
            <Icon name="grip" />
          </button>
          <span className="inline-flex min-w-0 items-center gap-1.5 pr-2 text-sm font-semibold text-muted">
            <QuestionTypeIcon type={question.type} className="size-4.5" />
            <span className="truncate">{questionTypeLabel(question.type)}</span>
          </span>
          {question.visibleIf && (
            <span className="inline-flex items-center gap-1 pr-2 text-sm text-muted">
              <Icon name="branch" className="size-4" />Condizionale<span className="sr-only">: visibile solo se la condizione è soddisfatta</span>
            </span>
          )}
          {hasErrors && <Badge kind="warn">Da completare</Badge>}
          <span className="flex-1" />
          <span className="flex items-center" onClick={event => event.stopPropagation()}>
            <MoveButtons id={`q-${question.id}`} label={label} canUp={canMoveUp} canDown={canMoveDown} disabled={locked} onMove={onMove} />
            <Button aria-label={`Duplica: ${label}`} isDisabled={locked} onPress={onDuplicate} className={miniIcon}><Icon name="copy" /></Button>
            <Button aria-label={`Elimina: ${label}`} isDisabled={locked} onPress={onRemove} className={miniIcon}><AdminIcon name="trash" /></Button>
            {onOpenProperties && (
              <Button aria-label={`Proprietà: ${label}`} onPress={onOpenProperties} className={miniIcon}><Icon name="sliders" /></Button>
            )}
          </span>
        </div>
        {selected && (
          <div className="mt-2" onClick={event => event.stopPropagation()}>
            <FieldText
              aria-label="Testo della domanda"
              placeholder={question.type === 'InfoText' ? 'Titolo del blocco' : 'Scrivi la domanda…'}
              value={question.title}
              autoFocus={!question.title}
              maxLength={500}
              onChange={onTitleChange}
              inputClassName="font-semibold"
            />
          </div>
        )}
        <div inert className="mt-2 px-1 opacity-90">
          {selected
            ? <QuestionField question={{ ...question, title: '' }} disabled onChange={() => undefined} />
            : <QuestionField question={{ ...question, title: question.title || '(senza titolo)' }} number={number} disabled onChange={() => undefined} />}
        </div>
        {!selected && question.type !== 'InfoText' && !question.title && (
          <p className="px-1 text-sm font-semibold text-[#8a4b00]">Aggiungi il testo della domanda</p>
        )}
      </div>
    </li>
  );
};

export default QuestionCard;

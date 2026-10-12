import React, { FC } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { QuestionTypeIcon } from './QuestionTypeIcon';
import { questionTypes, QuestionTypeInfo } from '../../questionnaire/factory';
import type { QuestionType } from '../../questionnaire/types';

const itemCls = 'flex min-h-11 w-full cursor-pointer items-center gap-2.5 rounded-xl border border-line bg-white px-2.5 text-left font-semibold text-navy transition-colors hover:border-cyan-200 hover:bg-cyan-50/60 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-cyan-700';

const PaletteItem: FC<{ info: QuestionTypeInfo; disabled?: boolean; draggable: boolean; onAdd: (type: QuestionType) => void }> = ({ info, disabled, draggable, onAdd }) => {
  const { setNodeRef, listeners, isDragging } = useDraggable({ id: `palette:${info.type}`, data: { kind: 'palette', type: info.type }, disabled: disabled || !draggable });
  // Keyboard and screen-reader users add with Enter/click; only pointer dragging starts from the palette.
  const pointerListeners = listeners ? { onPointerDown: listeners.onPointerDown as React.PointerEventHandler<HTMLButtonElement> } : {};
  return (
    <button
      type="button"
      ref={setNodeRef}
      disabled={disabled}
      onClick={() => onAdd(info.type)}
      aria-label={`Aggiungi domanda: ${info.label}`}
      title={info.description}
      {...pointerListeners}
      className={`${itemCls} ${draggable && !disabled ? 'touch-none' : ''} ${isDragging ? 'opacity-50' : ''}`}
    >
      <span className="text-cyan-700"><QuestionTypeIcon type={info.type} /></span>
      {info.label}
    </button>
  );
};

export interface QuestionPaletteProps {
  disabled?: boolean;
  /** Pointer drag from the palette to the canvas: only where both are on screen. */
  draggable?: boolean;
  onAdd: (type: QuestionType) => void;
}

const QuestionPalette: FC<QuestionPaletteProps> = ({ disabled, draggable = true, onAdd }) => {
  const groups = [...new Set(questionTypes.map(t => t.group))];
  return (
    <nav aria-label="Tipi di domanda" className="space-y-5">
      {disabled && (
        <p className="text-sm text-muted">Struttura bloccata: il questionario ha già delle risposte.</p>
      )}
      {groups.map(group => (
        <div key={group}>
          <h3 className="mb-1.5 px-1 text-sm font-bold text-muted">{group}</h3>
          <ul className="space-y-1.5">
            {questionTypes.filter(t => t.group === group).map(info => (
              <li key={info.type}><PaletteItem info={info} disabled={disabled} draggable={draggable} onAdd={onAdd} /></li>
            ))}
          </ul>
        </div>
      ))}
      <p className="px-1 text-sm text-muted">
        {draggable
          ? 'Clicca per aggiungere dopo la domanda selezionata, oppure trascina nel punto desiderato.'
          : 'La nuova domanda viene aggiunta dopo quella selezionata.'}
      </p>
    </nav>
  );
};

export default QuestionPalette;

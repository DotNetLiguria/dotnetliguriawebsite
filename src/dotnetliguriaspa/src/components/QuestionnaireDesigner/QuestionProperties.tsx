import React, { FC } from 'react';
import { SwitchInput } from '../../admin/ui';
import ItemListEditor from './ItemListEditor';
import VisibilityEditor from './VisibilityEditor';
import { Callout, FieldText, groupHeading, NumberField, SelectField } from './designerUi';
import { useDesignerStore } from './designerStore';
import { questionTypes } from '../../questionnaire/factory';
import { DEFAULT_LONG_TEXT_LENGTH, DEFAULT_SHORT_TEXT_LENGTH } from '../../questionnaire/rules';
import type { Question, QuestionnaireValidationError, QuestionSettings, QuestionType } from '../../questionnaire/types';

export interface QuestionPropertiesProps {
  question: Question;
  locked: boolean;
  errors: QuestionnaireValidationError[];
}

// Problems of the definition check that have a field of their own below; the rest are listed on top.
const FIELD_ERRORS = new Set(['title', 'options', 'rows', 'settings', 'settings.max', 'settings.maxLength', 'visibleIf']);

const QuestionProperties: FC<QuestionPropertiesProps> = ({ question, locked, errors }) => {
  const questionnaire = useDesignerStore(s => s.questionnaire)!;
  const updateQuestion = useDesignerStore(s => s.updateQuestion);
  const setQuestionType = useDesignerStore(s => s.setQuestionType);

  const patch = (p: Partial<Question>, key?: string) => updateQuestion(question.id, p, key ? `${question.id}:${key}` : undefined);
  const setting = (p: Partial<QuestionSettings>, key?: string) => patch({ settings: { ...question.settings, ...p } }, key);
  const s = question.settings;
  const groups = [...new Set(questionTypes.map(t => t.group))];
  const isText = question.type === 'ShortText' || question.type === 'LongText' || question.type === 'Email';
  const problem = (field: string) => errors.find(e => e.field === field)?.message ?? null;
  const general = errors.filter(e => !FIELD_ERRORS.has(e.field));

  return (
    <div className="space-y-4">
      {general.length > 0 && (
        <Callout tone="warn" role="status">
          <ul className="list-inside list-disc">{general.map(e => <li key={e.message}>{e.message}</li>)}</ul>
        </Callout>
      )}
      <SelectField label="Tipo di domanda" value={question.type} isDisabled={locked} onChange={type => setQuestionType(question.id, type as QuestionType)}>
        {groups.map(group => (
          <optgroup key={group} label={group}>
            {questionTypes.filter(t => t.group === group).map(t => <option key={t.type} value={t.type}>{t.label}</option>)}
          </optgroup>
        ))}
      </SelectField>
      <FieldText
        label={question.type === 'InfoText' ? 'Titolo' : 'Domanda'}
        multiline
        rows={2}
        maxLength={500}
        value={question.title}
        error={problem('title')}
        onChange={title => patch({ title }, 'title')}
      />
      <FieldText
        label={question.type === 'InfoText' ? 'Testo' : 'Descrizione / aiuto'}
        multiline
        rows={question.type === 'InfoText' ? 5 : 3}
        value={question.helpText ?? ''}
        onChange={helpText => patch({ helpText: helpText || null }, 'help')}
      />
      {question.type !== 'InfoText' && (
        <SwitchInput isSelected={question.required} onChange={required => patch({ required })}>Risposta obbligatoria</SwitchInput>
      )}

      {isText && (
        <>
          <h3 className={groupHeading}>Testo</h3>
          {question.type !== 'Email' && (
            <NumberField
              label="Lunghezza massima"
              description={`Predefinita: ${question.type === 'LongText' ? DEFAULT_LONG_TEXT_LENGTH : DEFAULT_SHORT_TEXT_LENGTH} caratteri.`}
              value={s.maxLength}
              min={1}
              max={10000}
              error={problem('settings.maxLength')}
              onChange={v => setting({ maxLength: v }, 'maxLength')}
            />
          )}
          <FieldText label="Segnaposto" value={s.placeholder ?? ''} onChange={placeholder => setting({ placeholder: placeholder || null }, 'placeholder')} />
        </>
      )}

      {question.type === 'Number' && (
        <>
          <h3 className={groupHeading}>Intervallo</h3>
          <div className="grid grid-cols-2 gap-3">
            <NumberField label="Minimo" value={s.min} isDisabled={locked} onChange={v => setting({ min: v }, 'min')} />
            <NumberField label="Massimo" value={s.max} isDisabled={locked} onChange={v => setting({ max: v }, 'max')} />
          </div>
          {problem('settings') && <p role="alert" className="text-sm font-semibold text-[#b42318]">{problem('settings')}</p>}
        </>
      )}

      {question.type === 'Rating' && (
        <NumberField
          label="Numero di stelle (3-10)"
          value={s.max ?? 5}
          min={3}
          max={10}
          isDisabled={locked}
          error={problem('settings.max')}
          onChange={v => setting({ max: v }, 'max')}
        />
      )}

      {(question.type === 'Scale' || question.type === 'Matrix') && (
        <>
          <h3 className={groupHeading}>Scala</h3>
          <div className="grid grid-cols-2 gap-3">
            <NumberField label="Da" value={s.min ?? (question.type === 'Scale' ? 0 : 1)} min={0} isDisabled={locked} onChange={v => setting({ min: v }, 'min')} />
            <NumberField label="A" value={s.max ?? (question.type === 'Scale' ? 10 : 5)} min={1} isDisabled={locked} onChange={v => setting({ max: v }, 'max')} />
          </div>
          {problem('settings') && <p role="alert" className="text-sm font-semibold text-[#b42318]">{problem('settings')}</p>}
          <div className="grid grid-cols-2 gap-3">
            <FieldText label="Etichetta minimo" value={s.minLabel ?? ''} onChange={minLabel => setting({ minLabel: minLabel || null }, 'minLabel')} />
            <FieldText label="Etichetta massimo" value={s.maxLabel ?? ''} onChange={maxLabel => setting({ maxLabel: maxLabel || null }, 'maxLabel')} />
          </div>
        </>
      )}

      {question.type === 'Matrix' && (
        <>
          <h3 className={groupHeading}>Righe da valutare</h3>
          <ItemListEditor
            items={question.rows}
            noun="Riga"
            nounPlural="Righe da valutare"
            locked={locked}
            minItems={1}
            withDescription
            error={problem('rows')}
            onChange={(rows, key) => patch({ rows }, key)}
          />
        </>
      )}

      {(question.type === 'SingleChoice' || question.type === 'MultipleChoice') && (
        <>
          <h3 className={groupHeading}>Opzioni</h3>
          <ItemListEditor
            items={question.options}
            noun="Opzione"
            nounPlural="Opzioni"
            locked={locked}
            minItems={2}
            error={problem('options')}
            onChange={(options, key) => patch({ options }, key)}
          />
          <SwitchInput isDisabled={locked} isSelected={!!s.allowOther} onChange={allowOther => setting({ allowOther })}>Consenti «Altro» con testo libero</SwitchInput>
          {s.allowOther && (
            <FieldText label="Etichetta di «Altro»" value={s.otherLabel ?? ''} placeholder="Altro" onChange={otherLabel => setting({ otherLabel: otherLabel || null }, 'otherLabel')} />
          )}
          {question.type === 'SingleChoice' ? (
            <SwitchInput isSelected={!!s.useDropdown} onChange={useDropdown => setting({ useDropdown })}>Mostra come menu a tendina</SwitchInput>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <NumberField label="Min. selezioni" value={s.minSelections} min={0} onChange={v => setting({ minSelections: v }, 'minSel')} />
                <NumberField label="Max. selezioni" value={s.maxSelections} min={1} onChange={v => setting({ maxSelections: v }, 'maxSel')} />
              </div>
              {problem('settings') && <p role="alert" className="text-sm font-semibold text-[#b42318]">{problem('settings')}</p>}
            </>
          )}
        </>
      )}

      <h3 className={groupHeading}>Logica condizionale</h3>
      <VisibilityEditor questionnaire={questionnaire} question={question} error={problem('visibleIf')} onChange={visibleIf => patch({ visibleIf })} />
    </div>
  );
};

export default QuestionProperties;

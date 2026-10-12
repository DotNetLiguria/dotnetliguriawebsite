import React, { FC } from 'react';
import { Button } from 'react-aria-components';
import { btn } from '../../admin/ui';
import { Callout, FieldText, helpCls, SelectField } from './designerUi';
import { allQuestions, isAnswerable, operatorLabels, operatorsFor, OTHER_OPTION_ID, scaleBounds } from '../../questionnaire/rules';
import type { ConditionOperator, Question, Questionnaire, VisibilityCondition } from '../../questionnaire/types';

export interface VisibilityEditorProps {
  questionnaire: Questionnaire;
  question: Question;
  /** Problem reported by the definition check (e.g. the source question was moved after this one). */
  error?: string | null;
  onChange: (condition: VisibilityCondition | null) => void;
}

const needsValue = (operator: ConditionOperator) => operator !== 'Answered' && operator !== 'NotAnswered';

const VisibilityEditor: FC<VisibilityEditorProps> = ({ questionnaire, question, error, onChange }) => {
  const questions = allQuestions(questionnaire);
  const position = questions.findIndex(q => q.id === question.id);
  const candidates = questions.slice(0, position).filter(q => isAnswerable(q.type));
  const condition = question.visibleIf;
  const source = condition ? candidates.find(q => q.id === condition.questionId) : undefined;

  if (!condition) {
    return candidates.length === 0 ? (
      <p className={helpCls}>Le condizioni possono riferirsi solo a domande precedenti: aggiungi una domanda prima di questa.</p>
    ) : (
      <div>
        <p className="text-base text-muted">Ora la domanda è sempre visibile.</p>
        <Button onPress={() => onChange({ questionId: candidates[candidates.length - 1].id, operator: 'Answered', value: null })} className={`${btn.secondary} mt-2`}>
          Mostra solo se…
        </Button>
      </div>
    );
  }

  const label = (q: Question) => `${questions.indexOf(q) + 1}. ${q.title || '(senza titolo)'}`;
  const operators = source ? operatorsFor(source.type) : [];
  let valueInput: React.ReactNode = null;
  if (source && needsValue(condition.operator)) {
    const setValue = (value: string) => onChange({ ...condition, value });
    if (source.type === 'SingleChoice' || source.type === 'MultipleChoice') {
      const options = [...source.options, ...(source.settings.allowOther ? [{ id: OTHER_OPTION_ID, label: source.settings.otherLabel || 'Altro' }] : [])];
      valueInput = (
        <SelectField label="Opzione" value={options.some(o => o.id === condition.value) ? condition.value ?? '' : ''} onChange={setValue}>
          <option value="" disabled>Scegli un'opzione</option>
          {options.map(o => <option key={o.id} value={o.id}>{o.label || '(vuota)'}</option>)}
        </SelectField>
      );
    } else if (source.type === 'YesNo') {
      valueInput = (
        <SelectField label="Valore" value={condition.value === 'true' || condition.value === 'false' ? condition.value : ''} onChange={setValue}>
          <option value="" disabled>Scegli un valore</option>
          <option value="true">Sì</option>
          <option value="false">No</option>
        </SelectField>
      );
    } else {
      const numeric = source.type === 'Number' || source.type === 'Rating' || source.type === 'Scale';
      const bounds = source.type === 'Rating' || source.type === 'Scale' ? scaleBounds(source) : null;
      valueInput = (
        <FieldText
          label="Valore"
          type={numeric ? 'number' : 'text'}
          value={condition.value ?? ''}
          onChange={setValue}
          description={bounds ? `Da ${bounds.min} a ${bounds.max}` : undefined}
        />
      );
    }
  }

  return (
    <div className="space-y-3">
      {!source && <Callout tone="warn" role="alert">La domanda di riferimento non è più disponibile: scegline un'altra.</Callout>}
      <SelectField
        label="Mostra se la domanda"
        value={source ? source.id : ''}
        error={error}
        onChange={value => onChange({ questionId: value, operator: 'Answered', value: null })}
      >
        {!source && <option value="" disabled>Scegli una domanda</option>}
        {candidates.map(q => <option key={q.id} value={q.id}>{label(q)}</option>)}
      </SelectField>
      {source && (
        <SelectField
          label="Condizione"
          value={operators.includes(condition.operator) ? condition.operator : ''}
          onChange={value => {
            const operator = value as ConditionOperator;
            onChange({ ...condition, operator, value: needsValue(operator) ? condition.value ?? '' : null });
          }}
        >
          {!operators.includes(condition.operator) && <option value="" disabled>Scegli una condizione</option>}
          {operators.map(op => <option key={op} value={op}>{operatorLabels[op]}</option>)}
        </SelectField>
      )}
      {valueInput}
      <Button onPress={() => onChange(null)} className={btn.ghost}>Mostra sempre</Button>
    </div>
  );
};

export default VisibilityEditor;

import React, { FC } from 'react';
import { Alert, Button, FormControl, InputLabel, MenuItem, Select, Stack, TextField, Typography } from '@mui/material';
import { allQuestions, isAnswerable, operatorLabels, operatorsFor, OTHER_OPTION_ID, scaleBounds } from '../../questionnaire/rules';
import type { ConditionOperator, Question, Questionnaire, VisibilityCondition } from '../../questionnaire/types';

export interface VisibilityEditorProps {
  questionnaire: Questionnaire;
  question: Question;
  onChange: (condition: VisibilityCondition | null) => void;
}

const needsValue = (operator: ConditionOperator) => operator !== 'Answered' && operator !== 'NotAnswered';

const VisibilityEditor: FC<VisibilityEditorProps> = ({ questionnaire, question, onChange }) => {
  const questions = allQuestions(questionnaire);
  const position = questions.findIndex(q => q.id === question.id);
  const candidates = questions.slice(0, position).filter(q => isAnswerable(q.type));
  const condition = question.visibleIf;
  const source = condition ? candidates.find(q => q.id === condition.questionId) : undefined;

  if (!condition) {
    return candidates.length === 0 ? (
      <Typography variant="body2" color="text.secondary">
        Le condizioni possono riferirsi solo a domande precedenti: aggiungi una domanda prima di questa.
      </Typography>
    ) : (
      <Button size="small" onClick={() => onChange({ questionId: candidates[candidates.length - 1].id, operator: 'Answered', value: null })}>
        Mostra solo se…
      </Button>
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
        <FormControl size="small" fullWidth>
          <InputLabel id="vis-value">Opzione</InputLabel>
          <Select labelId="vis-value" label="Opzione" value={options.some(o => o.id === condition.value) ? condition.value : ''}
            onChange={e => setValue(e.target.value as string)}>
            {options.map(o => <MenuItem key={o.id} value={o.id}>{o.label || '(vuota)'}</MenuItem>)}
          </Select>
        </FormControl>
      );
    } else if (source.type === 'YesNo') {
      valueInput = (
        <FormControl size="small" fullWidth>
          <InputLabel id="vis-value">Valore</InputLabel>
          <Select labelId="vis-value" label="Valore" value={condition.value === 'true' || condition.value === 'false' ? condition.value : ''}
            onChange={e => setValue(e.target.value as string)}>
            <MenuItem value="true">Sì</MenuItem>
            <MenuItem value="false">No</MenuItem>
          </Select>
        </FormControl>
      );
    } else {
      const numeric = source.type === 'Number' || source.type === 'Rating' || source.type === 'Scale';
      const bounds = source.type === 'Rating' || source.type === 'Scale' ? scaleBounds(source) : null;
      valueInput = (
        <TextField size="small" fullWidth label="Valore" type={numeric ? 'number' : 'text'} value={condition.value ?? ''}
          onChange={e => setValue(e.target.value)}
          helperText={bounds ? `Da ${bounds.min} a ${bounds.max}` : undefined}
          slotProps={{ htmlInput: bounds ? { min: bounds.min, max: bounds.max } : {} }} />
      );
    }
  }

  return (
    <Stack spacing={1.5}>
      {!source && <Alert severity="warning">La domanda di riferimento non è più disponibile: scegline un'altra.</Alert>}
      <FormControl size="small" fullWidth>
        <InputLabel id="vis-source">Mostra se la domanda</InputLabel>
        <Select labelId="vis-source" label="Mostra se la domanda" value={source ? source.id : ''}
          onChange={e => onChange({ questionId: e.target.value as string, operator: 'Answered', value: null })}>
          {candidates.map(q => <MenuItem key={q.id} value={q.id}>{label(q)}</MenuItem>)}
        </Select>
      </FormControl>
      {source && (
        <FormControl size="small" fullWidth>
          <InputLabel id="vis-op">Condizione</InputLabel>
          <Select labelId="vis-op" label="Condizione" value={operators.includes(condition.operator) ? condition.operator : ''}
            onChange={e => {
              const operator = e.target.value as ConditionOperator;
              onChange({ ...condition, operator, value: needsValue(operator) ? condition.value ?? '' : null });
            }}>
            {operators.map(op => <MenuItem key={op} value={op}>{operatorLabels[op]}</MenuItem>)}
          </Select>
        </FormControl>
      )}
      {valueInput}
      <Button size="small" color="inherit" onClick={() => onChange(null)} sx={{ alignSelf: 'flex-start' }}>
        Mostra sempre
      </Button>
    </Stack>
  );
};

export default VisibilityEditor;

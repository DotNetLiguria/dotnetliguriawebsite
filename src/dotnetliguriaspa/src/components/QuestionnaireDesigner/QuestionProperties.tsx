import React, { FC } from 'react';
import {
  Alert, Divider, FormControl, FormControlLabel, InputLabel, ListSubheader, MenuItem, Select, Stack, Switch, TextField, Typography,
} from '@mui/material';
import ItemListEditor from './ItemListEditor';
import VisibilityEditor from './VisibilityEditor';
import { useDesignerStore } from './designerStore';
import { questionTypes } from '../../questionnaire/factory';
import { DEFAULT_LONG_TEXT_LENGTH, DEFAULT_SHORT_TEXT_LENGTH } from '../../questionnaire/rules';
import type { Question, QuestionSettings, QuestionType } from '../../questionnaire/types';

const toNumber = (value: string) => (value.trim() === '' ? null : Number(value));

const NumberInput: FC<{ label: string; value?: number | null; disabled?: boolean; min?: number; max?: number; onChange: (v: number | null) => void }> =
  ({ label, value, disabled, min, max, onChange }) => (
    <TextField size="small" type="number" label={label} value={value ?? ''} disabled={disabled} fullWidth
      onChange={e => onChange(toNumber(e.target.value))} slotProps={{ htmlInput: { min, max } }} />
  );

export interface QuestionPropertiesProps {
  question: Question;
  locked: boolean;
  errors: string[];
}

const QuestionProperties: FC<QuestionPropertiesProps> = ({ question, locked, errors }) => {
  const questionnaire = useDesignerStore(s => s.questionnaire)!;
  const updateQuestion = useDesignerStore(s => s.updateQuestion);
  const setQuestionType = useDesignerStore(s => s.setQuestionType);

  const patch = (p: Partial<Question>, key?: string) => updateQuestion(question.id, p, key ? `${question.id}:${key}` : undefined);
  const setting = (p: Partial<QuestionSettings>, key?: string) => patch({ settings: { ...question.settings, ...p } }, key);
  const s = question.settings;
  const groups = [...new Set(questionTypes.map(t => t.group))];
  const isText = question.type === 'ShortText' || question.type === 'LongText' || question.type === 'Email';

  return (
    <Stack spacing={2}>
      {errors.map(e => <Alert key={e} severity="warning" sx={{ py: 0 }}>{e}</Alert>)}
      <FormControl size="small" fullWidth disabled={locked}>
        <InputLabel id="prop-type">Tipo di domanda</InputLabel>
        <Select labelId="prop-type" label="Tipo di domanda" value={question.type}
          onChange={e => setQuestionType(question.id, e.target.value as QuestionType)}>
          {groups.flatMap(group => [
            <ListSubheader key={group}>{group}</ListSubheader>,
            ...questionTypes.filter(t => t.group === group).map(t => <MenuItem key={t.type} value={t.type}>{t.label}</MenuItem>),
          ])}
        </Select>
      </FormControl>
      <TextField size="small" label={question.type === 'InfoText' ? 'Titolo' : 'Domanda'} multiline value={question.title}
        onChange={e => patch({ title: e.target.value }, 'title')} slotProps={{ htmlInput: { maxLength: 500 } }} />
      <TextField size="small" label={question.type === 'InfoText' ? 'Testo' : 'Descrizione / aiuto'} multiline minRows={question.type === 'InfoText' ? 4 : 2}
        value={question.helpText ?? ''} onChange={e => patch({ helpText: e.target.value || null }, 'help')} />
      {question.type !== 'InfoText' && (
        <FormControlLabel control={<Switch checked={question.required} onChange={e => patch({ required: e.target.checked })} />} label="Risposta obbligatoria" />
      )}

      {isText && (
        <>
          <Divider textAlign="left"><Typography variant="caption">Testo</Typography></Divider>
          {question.type !== 'Email' && (
            <NumberInput label={`Lunghezza massima (predefinita ${question.type === 'LongText' ? DEFAULT_LONG_TEXT_LENGTH : DEFAULT_SHORT_TEXT_LENGTH})`}
              value={s.maxLength} min={1} max={10000} onChange={v => setting({ maxLength: v }, 'maxLength')} />
          )}
          <TextField size="small" label="Segnaposto" value={s.placeholder ?? ''} onChange={e => setting({ placeholder: e.target.value || null }, 'placeholder')} />
        </>
      )}

      {question.type === 'Number' && (
        <Stack direction="row" spacing={1}>
          <NumberInput label="Minimo" value={s.min} disabled={locked} onChange={v => setting({ min: v }, 'min')} />
          <NumberInput label="Massimo" value={s.max} disabled={locked} onChange={v => setting({ max: v }, 'max')} />
        </Stack>
      )}

      {question.type === 'Rating' && (
        <NumberInput label="Numero di stelle (3-10)" value={s.max ?? 5} min={3} max={10} disabled={locked}
          onChange={v => setting({ max: v }, 'max')} />
      )}

      {(question.type === 'Scale' || question.type === 'Matrix') && (
        <>
          <Divider textAlign="left"><Typography variant="caption">Scala</Typography></Divider>
          <Stack direction="row" spacing={1}>
            <NumberInput label="Da" value={s.min ?? (question.type === 'Scale' ? 0 : 1)} min={0} disabled={locked} onChange={v => setting({ min: v }, 'min')} />
            <NumberInput label="A" value={s.max ?? (question.type === 'Scale' ? 10 : 5)} min={1} disabled={locked} onChange={v => setting({ max: v }, 'max')} />
          </Stack>
          <Stack direction="row" spacing={1}>
            <TextField size="small" fullWidth label="Etichetta minimo" value={s.minLabel ?? ''} onChange={e => setting({ minLabel: e.target.value || null }, 'minLabel')} />
            <TextField size="small" fullWidth label="Etichetta massimo" value={s.maxLabel ?? ''} onChange={e => setting({ maxLabel: e.target.value || null }, 'maxLabel')} />
          </Stack>
        </>
      )}

      {question.type === 'Matrix' && (
        <>
          <Divider textAlign="left"><Typography variant="caption">Righe da valutare</Typography></Divider>
          <ItemListEditor items={question.rows} noun="Riga" locked={locked} minItems={1} withDescription
            onChange={(rows, key) => patch({ rows }, key)} />
        </>
      )}

      {(question.type === 'SingleChoice' || question.type === 'MultipleChoice') && (
        <>
          <Divider textAlign="left"><Typography variant="caption">Opzioni</Typography></Divider>
          <ItemListEditor items={question.options} noun="Opzione" locked={locked} minItems={2}
            onChange={(options, key) => patch({ options }, key)} />
          <FormControlLabel disabled={locked} label='Consenti "Altro" con testo libero'
            control={<Switch checked={!!s.allowOther} onChange={e => setting({ allowOther: e.target.checked })} />} />
          {s.allowOther && (
            <TextField size="small" label='Etichetta di "Altro"' value={s.otherLabel ?? ''} placeholder="Altro"
              onChange={e => setting({ otherLabel: e.target.value || null }, 'otherLabel')} />
          )}
          {question.type === 'SingleChoice' ? (
            <FormControlLabel label="Mostra come menu a tendina"
              control={<Switch checked={!!s.useDropdown} onChange={e => setting({ useDropdown: e.target.checked })} />} />
          ) : (
            <Stack direction="row" spacing={1}>
              <NumberInput label="Min. selezioni" value={s.minSelections} min={0} onChange={v => setting({ minSelections: v }, 'minSel')} />
              <NumberInput label="Max. selezioni" value={s.maxSelections} min={1} onChange={v => setting({ maxSelections: v }, 'maxSel')} />
            </Stack>
          )}
        </>
      )}

      <Divider textAlign="left"><Typography variant="caption">Logica condizionale</Typography></Divider>
      <VisibilityEditor questionnaire={questionnaire} question={question} onChange={visibleIf => patch({ visibleIf })} />
    </Stack>
  );
};

export default QuestionProperties;

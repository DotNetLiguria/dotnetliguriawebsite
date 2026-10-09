import React, { FC } from 'react';
import {
  Box, Checkbox, FormControl, FormControlLabel, FormGroup, FormHelperText, FormLabel, MenuItem, Radio, RadioGroup,
  Rating, Select, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import { OTHER_OPTION_ID, scaleBounds, textLimit } from '../../questionnaire/rules';
import type { Question, QuestionAnswer } from '../../questionnaire/types';

export interface QuestionFieldProps {
  question: Question;
  answer?: QuestionAnswer;
  error?: string;
  number?: number;
  disabled?: boolean;
  onChange: (answer: QuestionAnswer | undefined) => void;
}

const range = (min: number, max: number) => Array.from({ length: Math.max(0, max - min + 1) }, (_, i) => min + i);

const ScaleButtons: FC<{
  min: number; max: number; value?: number | null; label: string; disabled?: boolean; onChange: (value: number | null) => void;
}> = ({ min, max, value, label, disabled, onChange }) => (
  <ToggleButtonGroup
    exclusive
    size="small"
    value={value ?? null}
    disabled={disabled}
    aria-label={label}
    onChange={(_, v: number | null) => onChange(v)}
    sx={{ flexWrap: 'wrap', gap: 0.5, '& .MuiToggleButton-root': { minWidth: 40, border: '1px solid', borderColor: 'divider', borderRadius: '8px !important' } }}
  >
    {range(min, max).map(v => <ToggleButton key={v} value={v} aria-label={`${v}`}>{v}</ToggleButton>)}
  </ToggleButtonGroup>
);

const QuestionField: FC<QuestionFieldProps> = ({ question, answer, error, number, disabled, onChange }) => {
  const id = `q-${question.id}`;
  const set = (patch: Partial<QuestionAnswer>) => onChange({ ...answer, ...patch, questionId: question.id });
  const title = (
    <>
      {number !== undefined && <Box component="span" sx={{ color: 'text.secondary', mr: 1 }}>{number}.</Box>}
      {question.title}
      {question.required && <Box component="span" aria-hidden sx={{ color: 'error.main', ml: 0.5 }}>*</Box>}
    </>
  );

  if (question.type === 'InfoText') {
    return (
      <Box sx={{ py: 1 }}>
        {question.title && <Typography variant="h6" component="h3">{question.title}</Typography>}
        {question.helpText && <Typography sx={{ whiteSpace: 'pre-wrap' }} color="text.secondary">{question.helpText}</Typography>}
      </Box>
    );
  }

  const otherSelected = answer?.choices?.includes(OTHER_OPTION_ID) ?? false;
  const otherField = question.settings.allowOther && otherSelected && (
    <TextField
      size="small"
      label="Specifica"
      value={answer?.otherText ?? ''}
      disabled={disabled}
      onChange={e => set({ otherText: e.target.value })}
      slotProps={{ htmlInput: { maxLength: 500 } }}
      sx={{ mt: 1, maxWidth: 400 }}
    />
  );
  const options = [
    ...question.options,
    ...(question.settings.allowOther ? [{ id: OTHER_OPTION_ID, label: question.settings.otherLabel || 'Altro' }] : []),
  ];

  let control: React.ReactNode;
  switch (question.type) {
    case 'ShortText':
    case 'LongText':
    case 'Email':
    case 'Date':
    case 'Number': {
      const isNumber = question.type === 'Number';
      const limit = textLimit(question);
      control = (
        <TextField
          id={id}
          fullWidth
          size="small"
          type={isNumber ? 'number' : question.type === 'Email' ? 'email' : question.type === 'Date' ? 'date' : 'text'}
          multiline={question.type === 'LongText'}
          minRows={question.type === 'LongText' ? 4 : undefined}
          placeholder={question.settings.placeholder ?? undefined}
          value={isNumber ? (answer?.number ?? '') : (answer?.text ?? '')}
          disabled={disabled}
          error={!!error}
          onChange={e => {
            if (!isNumber) return set({ text: e.target.value });
            const raw = e.target.value;
            if (raw === '') onChange(undefined);
            else set({ number: Number(raw) });
          }}
          slotProps={{
            htmlInput: {
              'aria-labelledby': `${id}-label`,
              'aria-describedby': `${id}-help`,
              ...(isNumber ? { min: question.settings.min ?? undefined, max: question.settings.max ?? undefined, step: 'any' } : { maxLength: limit }),
            },
          }}
          helperText={question.type === 'LongText' ? `${(answer?.text ?? '').length}/${limit}` : undefined}
        />
      );
      break;
    }
    case 'YesNo':
      control = (
        <ToggleButtonGroup
          exclusive
          size="small"
          value={answer?.bool ?? null}
          disabled={disabled}
          aria-labelledby={`${id}-label`}
          onChange={(_, v: boolean | null) => (v === null ? onChange(undefined) : set({ bool: v }))}
        >
          <ToggleButton value={true} sx={{ px: 3 }}>Sì</ToggleButton>
          <ToggleButton value={false} sx={{ px: 3 }}>No</ToggleButton>
        </ToggleButtonGroup>
      );
      break;
    case 'SingleChoice':
      control = question.settings.useDropdown ? (
        <Select
          size="small"
          displayEmpty
          value={answer?.choices?.[0] ?? ''}
          disabled={disabled}
          inputProps={{ 'aria-labelledby': `${id}-label` }}
          onChange={e => (e.target.value ? set({ choices: [e.target.value as string] }) : onChange(undefined))}
          sx={{ minWidth: 240 }}
        >
          <MenuItem value=""><em>Seleziona…</em></MenuItem>
          {options.map(o => <MenuItem key={o.id} value={o.id}>{o.label}</MenuItem>)}
        </Select>
      ) : (
        <RadioGroup aria-labelledby={`${id}-label`} value={answer?.choices?.[0] ?? ''} onChange={e => set({ choices: [e.target.value] })}>
          {options.map(o => <FormControlLabel key={o.id} value={o.id} control={<Radio disabled={disabled} />} label={o.label} />)}
        </RadioGroup>
      );
      break;
    case 'MultipleChoice': {
      const selected = answer?.choices ?? [];
      const toggle = (optionId: string, checked: boolean) => {
        const choices = checked ? [...selected, optionId] : selected.filter(c => c !== optionId);
        set({ choices });
      };
      const { minSelections, maxSelections } = question.settings;
      control = (
        <>
          <FormGroup aria-labelledby={`${id}-label`}>
            {options.map(o => (
              <FormControlLabel
                key={o.id}
                label={o.label}
                control={
                  <Checkbox
                    checked={selected.includes(o.id)}
                    disabled={disabled || (!selected.includes(o.id) && maxSelections != null && selected.length >= maxSelections)}
                    onChange={e => toggle(o.id, e.target.checked)}
                  />
                }
              />
            ))}
          </FormGroup>
          {(minSelections || maxSelections) && (
            <Typography variant="caption" color="text.secondary">
              {minSelections && maxSelections ? `Seleziona da ${minSelections} a ${maxSelections} opzioni`
                : minSelections ? `Seleziona almeno ${minSelections} opzioni` : `Seleziona al massimo ${maxSelections} opzioni`}
            </Typography>
          )}
        </>
      );
      break;
    }
    case 'Rating': {
      const { max } = scaleBounds(question);
      control = (
        <Rating
          name={id}
          max={max}
          size="large"
          value={answer?.number ?? null}
          disabled={disabled}
          onChange={(_, v) => (v === null ? onChange(undefined) : set({ number: v }))}
          getLabelText={v => `${v} ${v === 1 ? 'stella' : 'stelle'} su ${max}`}
        />
      );
      break;
    }
    case 'Scale': {
      const { min, max } = scaleBounds(question);
      control = (
        <Box>
          <ScaleButtons min={min} max={max} label={question.title} value={answer?.number} disabled={disabled}
            onChange={v => (v === null ? onChange(undefined) : set({ number: v }))} />
          {(question.settings.minLabel || question.settings.maxLabel) && (
            <Stack direction="row" sx={{ justifyContent: 'space-between', mt: 0.5, maxWidth: (max - min + 1) * 48 }}>
              <Typography variant="caption" color="text.secondary">{min} = {question.settings.minLabel}</Typography>
              <Typography variant="caption" color="text.secondary">{max} = {question.settings.maxLabel}</Typography>
            </Stack>
          )}
        </Box>
      );
      break;
    }
    case 'Matrix': {
      const { min, max } = scaleBounds(question);
      const rows = answer?.rows ?? [];
      const setRow = (rowId: string, value: number | null) => {
        const next = rows.filter(r => r.rowId !== rowId);
        if (value !== null) next.push({ rowId, value });
        const ordered = question.rows.flatMap(r => next.filter(n => n.rowId === r.id));
        if (ordered.length === 0) onChange(undefined);
        else set({ rows: ordered });
      };
      control = (
        <Stack spacing={1.5} divider={<Box sx={{ borderTop: 1, borderColor: 'divider' }} />}>
          {(question.settings.minLabel || question.settings.maxLabel) && (
            <Typography variant="caption" color="text.secondary">
              {min} = {question.settings.minLabel || 'minimo'} · {max} = {question.settings.maxLabel || 'massimo'}
            </Typography>
          )}
          {question.rows.map(row => (
            <Box key={row.id} sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center', justifyContent: 'space-between' }}>
              <Box sx={{ flex: '1 1 220px' }}>
                <Typography sx={{ fontWeight: 600 }}>{row.label}</Typography>
                {row.description && <Typography variant="body2" color="text.secondary">{row.description}</Typography>}
              </Box>
              <ScaleButtons min={min} max={max} label={row.label} disabled={disabled}
                value={rows.find(r => r.rowId === row.id)?.value} onChange={v => setRow(row.id, v)} />
            </Box>
          ))}
        </Stack>
      );
      break;
    }
  }

  return (
    <FormControl component="fieldset" error={!!error} fullWidth sx={{ py: 1 }} data-question-id={question.id}>
      <FormLabel component="legend" id={`${id}-label`} sx={{ color: 'text.primary', fontWeight: 600, mb: 0.5, '&.Mui-focused': { color: 'text.primary' } }}>
        {title}
      </FormLabel>
      {question.helpText && <Typography id={`${id}-help`} variant="body2" color="text.secondary" sx={{ mb: 1, whiteSpace: 'pre-wrap' }}>{question.helpText}</Typography>}
      {control}
      {otherField}
      {error && <FormHelperText role="alert">{error}</FormHelperText>}
    </FormControl>
  );
};

export default QuestionField;

import React, { FC } from 'react';
import { Button, Checkbox, CheckboxGroup, Radio, RadioGroup, ToggleButton } from 'react-aria-components';
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
const ring = 'outline-none';
// Control boundaries use line-strong (3:1 on white) and placeholders the full muted colour (WCAG 1.4.3, 1.4.11).
// Focus shows the site ring (site.css) and a cyan border.
const inputClass = (error?: string) =>
  `block w-full rounded-2xl border-2 bg-white px-4 py-3 text-lg text-navy placeholder:text-muted focus:border-cyan-700 disabled:opacity-60 ${error ? 'border-red-700' : 'border-line-strong'}`;

/** One button per value of a scale (1..5, 0..10): a single-choice radio group. */
const ScaleButtons: FC<{
  min: number; max: number; value?: number | null; label: string; disabled?: boolean; required?: boolean; onChange: (value: number | null) => void;
}> = ({ min, max, value, label, disabled, required, onChange }) => (
  <RadioGroup
    aria-label={label}
    orientation="horizontal"
    value={value === undefined || value === null ? null : String(value)}
    isDisabled={disabled}
    isRequired={required}
    onChange={v => onChange(v === '' ? null : Number(v))}
    className="flex flex-wrap gap-2"
  >
    {range(min, max).map(v => (
      <Radio
        key={v}
        value={String(v)}
        className={`grid size-11 cursor-pointer place-items-center rounded-xl border-2 border-line-strong bg-white text-lg font-bold text-navy transition data-[hovered]:border-cyan-700 data-[selected]:border-navy data-[selected]:bg-navy data-[selected]:text-white data-[disabled]:cursor-default data-[disabled]:opacity-60 ${ring}`}
      >
        {v}
      </Radio>
    ))}
  </RadioGroup>
);

/* A chosen star is basil on white (3.1:1) with a basil-700 outline; an empty one keeps the muted outline. */
function Star({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="size-9" aria-hidden="true" focusable="false">
      <path
        d="M12 3.2l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 17l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z"
        className={filled ? 'fill-basil stroke-basil-700' : 'fill-none stroke-muted'}
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
    </svg>
  );
}

const QuestionField: FC<QuestionFieldProps> = ({ question, answer, error, number, disabled, onChange }) => {
  const id = `q-${question.id}`;
  const set = (patch: Partial<QuestionAnswer>) => onChange({ ...answer, ...patch, questionId: question.id });
  const describedBy = [question.helpText ? `${id}-help` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined;

  if (question.type === 'InfoText') {
    return (
      <div className="py-1">
        {question.title && <h3 className="text-xl font-bold">{question.title}</h3>}
        {question.helpText && <p className="mt-1 whitespace-pre-wrap text-navy/85">{question.helpText}</p>}
      </div>
    );
  }

  const otherSelected = answer?.choices?.includes(OTHER_OPTION_ID) ?? false;
  const otherField = question.settings.allowOther && otherSelected && (
    <label className="mt-3 block max-w-md">
      <span className="text-sm font-bold text-muted">Specifica</span>
      <input
        className={`mt-1 ${inputClass()}`}
        value={answer?.otherText ?? ''}
        disabled={disabled}
        maxLength={500}
        onChange={e => set({ otherText: e.target.value })}
      />
    </label>
  );
  const options = [
    ...question.options,
    ...(question.settings.allowOther ? [{ id: OTHER_OPTION_ID, label: question.settings.otherLabel || 'Altro' }] : []),
  ];
  const choiceRow = `flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl border-2 border-line-strong bg-white px-4 py-2 text-lg text-navy transition data-[hovered]:border-cyan-700 data-[selected]:border-navy data-[selected]:bg-cyan-50 data-[disabled]:cursor-default data-[disabled]:opacity-60 ${ring}`;
  const required = question.required || undefined;

  let control: React.ReactNode;
  switch (question.type) {
    case 'ShortText':
    case 'LongText':
    case 'Email':
    case 'Date':
    case 'Number': {
      const isNumber = question.type === 'Number';
      const limit = textLimit(question);
      const common = {
        id,
        'aria-labelledby': `${id}-label`,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
        required,
        disabled,
        placeholder: question.settings.placeholder ?? undefined,
        className: inputClass(error),
      };
      control = question.type === 'LongText' ? (
        <>
          <textarea {...common} rows={4} maxLength={limit} value={answer?.text ?? ''} onChange={e => set({ text: e.target.value })} />
          <p className="mt-1 text-right text-sm text-muted" aria-hidden="true">{(answer?.text ?? '').length}/{limit}</p>
        </>
      ) : (
        <input
          {...common}
          type={isNumber ? 'number' : question.type === 'Email' ? 'email' : question.type === 'Date' ? 'date' : 'text'}
          value={isNumber ? (answer?.number ?? '') : (answer?.text ?? '')}
          {...(isNumber ? { min: question.settings.min ?? undefined, max: question.settings.max ?? undefined, step: 'any' } : { maxLength: limit })}
          onChange={e => {
            if (!isNumber) return set({ text: e.target.value });
            if (e.target.value === '') onChange(undefined);
            else set({ number: Number(e.target.value) });
          }}
        />
      );
      break;
    }
    case 'YesNo': {
      const toggle = `inline-flex min-h-12 min-w-24 cursor-pointer items-center justify-center rounded-full border-2 border-line-strong bg-white px-6 text-lg font-bold text-navy transition data-[hovered]:border-cyan-700 data-[selected]:border-navy data-[selected]:bg-navy data-[selected]:text-white data-[disabled]:opacity-60 ${ring}`;
      const choose = (value: boolean) => (answer?.bool === value ? onChange(undefined) : set({ bool: value }));
      control = (
        <div role="group" aria-labelledby={`${id}-label`} className="flex gap-3">
          <ToggleButton isSelected={answer?.bool === true} isDisabled={disabled} onChange={() => choose(true)} className={toggle}>Sì</ToggleButton>
          <ToggleButton isSelected={answer?.bool === false} isDisabled={disabled} onChange={() => choose(false)} className={toggle}>No</ToggleButton>
        </div>
      );
      break;
    }
    case 'SingleChoice':
      control = question.settings.useDropdown ? (
        <select
          aria-labelledby={`${id}-label`}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          required={required}
          value={answer?.choices?.[0] ?? ''}
          disabled={disabled}
          onChange={e => (e.target.value ? set({ choices: [e.target.value] }) : onChange(undefined))}
          className={`${inputClass(error)} max-w-md`}
        >
          <option value="">Seleziona…</option>
          {options.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      ) : (
        <RadioGroup
          aria-labelledby={`${id}-label`}
          aria-describedby={describedBy}
          value={answer?.choices?.[0] ?? null}
          isDisabled={disabled}
          isRequired={required}
          isInvalid={!!error}
          onChange={v => set({ choices: [v] })}
          className="grid gap-2"
        >
          {options.map(o => (
            <Radio key={o.id} value={o.id} className={choiceRow}>
              {({ isSelected }) => (
                <>
                  <span className={`grid size-5 shrink-0 place-items-center rounded-full border-2 ${isSelected ? 'border-navy' : 'border-muted'}`} aria-hidden="true">
                    {isSelected && <span className="size-2.5 rounded-full bg-navy" />}
                  </span>
                  {o.label}
                </>
              )}
            </Radio>
          ))}
        </RadioGroup>
      );
      break;
    case 'MultipleChoice': {
      const selected = answer?.choices ?? [];
      const { minSelections, maxSelections } = question.settings;
      control = (
        <>
          <CheckboxGroup
            aria-labelledby={`${id}-label`}
            aria-describedby={describedBy}
            value={selected}
            isDisabled={disabled}
            isRequired={required}
            isInvalid={!!error}
            onChange={choices => set({ choices })}
            className="grid gap-2"
          >
            {options.map(o => (
              <Checkbox
                key={o.id}
                value={o.id}
                isDisabled={!selected.includes(o.id) && maxSelections != null && selected.length >= maxSelections}
                className={choiceRow}
              >
                {({ isSelected }) => (
                  <>
                    <span className={`grid size-5 shrink-0 place-items-center rounded-md border-2 ${isSelected ? 'border-navy bg-navy' : 'border-muted'}`} aria-hidden="true">
                      {isSelected && (
                        <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="white" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M3.5 8.5l3 3 6-7" /></svg>
                      )}
                    </span>
                    {o.label}
                  </>
                )}
              </Checkbox>
            ))}
          </CheckboxGroup>
          {(minSelections || maxSelections) && (
            <p className="mt-2 text-sm text-muted">
              {minSelections && maxSelections ? `Seleziona da ${minSelections} a ${maxSelections} opzioni`
                : minSelections ? `Seleziona almeno ${minSelections} opzioni` : `Seleziona al massimo ${maxSelections} opzioni`}
            </p>
          )}
        </>
      );
      break;
    }
    case 'Rating': {
      const { max } = scaleBounds(question);
      const value = answer?.number ?? null;
      control = (
        <div className="flex flex-wrap items-center gap-3">
          <RadioGroup
            aria-labelledby={`${id}-label`}
            aria-describedby={describedBy}
            orientation="horizontal"
            value={value === null ? null : String(value)}
            isDisabled={disabled}
            isRequired={required}
            isInvalid={!!error}
            onChange={v => set({ number: Number(v) })}
            className="flex gap-1"
          >
            {range(1, max).map(v => (
              <Radio key={v} value={String(v)} aria-label={`${v} ${v === 1 ? 'stella' : 'stelle'} su ${max}`} className={`cursor-pointer rounded-lg p-0.5 data-[disabled]:cursor-default ${ring}`}>
                <Star filled={value !== null && v <= value} />
              </Radio>
            ))}
          </RadioGroup>
          {value !== null && !question.required && !disabled && (
            <Button onPress={() => onChange(undefined)} className={`min-h-11 cursor-pointer rounded-full px-3 text-sm font-bold text-cyan-700 underline underline-offset-4 ${ring}`}>
              Rimuovi voto
            </Button>
          )}
        </div>
      );
      break;
    }
    case 'Scale': {
      const { min, max } = scaleBounds(question);
      control = (
        <div>
          <ScaleButtons min={min} max={max} label={question.title} value={answer?.number} disabled={disabled} required={required}
            onChange={v => (v === null ? onChange(undefined) : set({ number: v }))} />
          {(question.settings.minLabel || question.settings.maxLabel) && (
            <div className="mt-2 flex justify-between gap-4 text-sm text-muted" style={{ maxWidth: (max - min + 1) * 52 }}>
              <span>{min} = {question.settings.minLabel}</span>
              <span>{max} = {question.settings.maxLabel}</span>
            </div>
          )}
        </div>
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
        <div className="divide-y divide-line">
          {(question.settings.minLabel || question.settings.maxLabel) && (
            <p className="pb-3 text-sm text-muted">
              {min} = {question.settings.minLabel || 'minimo'} · {max} = {question.settings.maxLabel || 'massimo'}
            </p>
          )}
          {question.rows.map(row => (
            <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
              <div className="min-w-0 flex-[1_1_14rem]">
                <p className="text-lg font-bold">{row.label}</p>
                {row.description && <p className="text-base text-muted">{row.description}</p>}
              </div>
              <ScaleButtons min={min} max={max} label={row.label} disabled={disabled} required={required}
                value={rows.find(r => r.rowId === row.id)?.value} onChange={v => setRow(row.id, v)} />
            </div>
          ))}
        </div>
      );
      break;
    }
  }

  return (
    <fieldset className="min-w-0 py-2" data-question-id={question.id} aria-describedby={describedBy}>
      <legend id={`${id}-label`} className="mb-2 text-xl font-bold leading-snug text-navy">
        {number !== undefined && <span className="mr-2 text-cyan-700">{number}.</span>}
        {question.title}
        {question.required && <span aria-hidden="true" className="ml-1 text-red-700">*</span>}
      </legend>
      {question.helpText && <p id={`${id}-help`} className="-mt-1 mb-3 whitespace-pre-wrap text-base text-muted">{question.helpText}</p>}
      {control}
      {otherField}
      {error && <p id={`${id}-error`} role="alert" className="mt-2 font-bold text-red-700">{error}</p>}
    </fieldset>
  );
};

export default QuestionField;

import React, { useCallback, useId, useSyncExternalStore } from 'react';
import {
  Button, ButtonProps, Dialog, FieldError, Heading, Input, Label, Modal, ModalOverlay, Radio, RadioGroup, Text, TextArea, TextField, TextFieldProps,
} from 'react-aria-components';
import { AdminIcon } from '../../admin/icons';
import { Badge, btn, focusRing } from '../../admin/ui';
import { inputCls } from '../../admin/pages/listUi';
import { statusLabels } from '../../questionnaire/status';
import type { QuestionnaireStatus } from '../../questionnaire/types';

// Presentation primitives shared by the questionnaire designer and results screens, on top of the admin kit
// (src/admin/ui.tsx): icons that the kit lacks, fields with linked errors, a callout, a side sheet.

// ---------- Icons (same 24px grid and stroke as AdminIcon) ----------

const GLYPHS = {
  undo: <><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></>,
  redo: <><path d="m15 14 5-5-5-5" /><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" /></>,
  up: <><path d="M12 19V5" /><path d="m6 11 6-6 6 6" /></>,
  down: <><path d="M12 5v14" /><path d="m6 13 6 6 6-6" /></>,
  eye: <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="2.8" /></>,
  copy: <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15h-.5A1.5 1.5 0 0 1 3 13.5v-9A1.5 1.5 0 0 1 4.5 3h9A1.5 1.5 0 0 1 15 4.5V5" /></>,
  chart: <><path d="M4 20h16" /><path d="M7 16v-5M12 16V7M17 16v-8" /></>,
  share: <><circle cx="18" cy="5.5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="18.5" r="2.5" /><path d="m8.2 10.8 7.6-4.1M8.2 13.2l7.6 4.1" /></>,
  lock: <><rect x="5" y="10.5" width="14" height="10" rx="2" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /></>,
  sliders: <><path d="M4 7h9M17 7h3M4 17h3M11 17h9" /><circle cx="15" cy="7" r="2" /><circle cx="9" cy="17" r="2" /></>,
  grip: <>{[[9, 6], [15, 6], [9, 12], [15, 12], [9, 18], [15, 18]].map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.3" fill="currentColor" stroke="none" />)}</>,
  branch: <><circle cx="6" cy="5.5" r="2" /><circle cx="6" cy="18.5" r="2" /><circle cx="18" cy="9" r="2" /><path d="M6 7.5v9" /><path d="M18 11c0 4-12 1.5-12 5.5" /></>,
  link: <><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></>,
  refresh: <><path d="M20 12a8 8 0 1 1-2.5-5.8" /><path d="M20 4v4.5h-4.5" /></>,
  paste: <><rect x="6" y="5" width="12" height="16" rx="2" /><path d="M9.5 5V4a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1M9.5 11h5M9.5 15h5" /></>,
  desktop: <><rect x="3" y="4.5" width="18" height="12" rx="2" /><path d="M8 20h8M12 16.5V20" /></>,
  phone: <><rect x="7" y="2.5" width="10" height="19" rx="2.5" /><path d="M11 18.5h2" /></>,
  sync: <><path d="M4 12a8 8 0 0 1 13.7-5.6L20 8.5" /><path d="M20 4v4.5h-4.5" /><path d="M20 12a8 8 0 0 1-13.7 5.6L4 15.5" /><path d="M4 20v-4.5h4.5" /></>,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
} as const;

export type DesignerIconName = keyof typeof GLYPHS;

export function Icon({ name, className = 'size-5' }: { name: DesignerIconName; className?: string }) {
  return (
    <svg className={`${className} shrink-0`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {GLYPHS[name]}
    </svg>
  );
}

// ---------- Responsive ----------

/** Live `matchMedia` flag. Without matchMedia (jsdom) the answer is `fallback`, i.e. the desktop layout. */
export function useMediaQuery(query: string, fallback = true) {
  const hasMedia = typeof window !== 'undefined' && typeof window.matchMedia === 'function';
  const subscribe = useCallback((notify: () => void) => {
    if (!hasMedia) return () => undefined;
    const list = window.matchMedia(query);
    list.addEventListener('change', notify);
    return () => list.removeEventListener('change', notify);
  }, [hasMedia, query]);
  const read = useCallback(() => (hasMedia ? window.matchMedia(query).matches : fallback), [hasMedia, query, fallback]);
  return useSyncExternalStore(subscribe, read, () => fallback);
}

/** Three panes (palette, canvas, properties) fit from here: the shell menu and paddings take 312px of the viewport. */
export const WIDE_QUERY = '(min-width: 1360px)';
/** Toolbar actions as buttons (below this they move into a menu). */
export const MEDIUM_QUERY = '(min-width: 768px)';

// ---------- Small pieces ----------

export const labelCls = 'text-sm font-semibold text-navy';
export const helpCls = 'mt-1.5 block text-sm text-muted';
export const errorCls = 'mt-1.5 block text-sm font-semibold text-[#b42318]';
/** Sub-heading between groups of fields (properties, settings). */
export const groupHeading = 'mt-6 border-t border-line pt-4 text-base font-bold text-navy';

/** Icon-only control: the accessible name is the label. */
export function IconButton({ label, icon, className = btn.icon, ...props }: Omit<ButtonProps, 'children' | 'aria-label'> & { label: string; icon: React.ReactNode }) {
  return <Button {...props} aria-label={label} className={className}>{icon}</Button>;
}

export const miniIcon = `inline-grid size-9 shrink-0 cursor-pointer place-items-center rounded-full text-muted transition-colors data-[hovered]:bg-cyan-50 data-[hovered]:text-navy data-[disabled]:cursor-default data-[disabled]:opacity-35 pointer-coarse:size-11 ${focusRing}`;

/** Destructive action that is not the main one of its dialog: red text, no fill. */
export const dangerGhost = `inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full px-4 font-bold text-[#b42318] transition-colors data-[hovered]:bg-[#fdecea] data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 ${focusRing}`;

/** Move up / down: the single-pointer and keyboard alternative to dragging (WCAG 2.5.7). Ids follow listKit so that restoreMoveFocus works. */
export function MoveButtons({ id, label, canUp, canDown, disabled, onMove, className = miniIcon }: {
  id: string;
  label: string;
  canUp: boolean;
  canDown: boolean;
  disabled?: boolean;
  onMove: (delta: -1 | 1) => void;
  className?: string;
}) {
  return (
    <>
      <Button id={`move-${id}-up`} aria-label={`Sposta su: ${label}`} isDisabled={disabled || !canUp} onPress={() => onMove(-1)} className={className}><Icon name="up" /></Button>
      <Button id={`move-${id}-down`} aria-label={`Sposta giù: ${label}`} isDisabled={disabled || !canDown} onPress={() => onMove(1)} className={className}><Icon name="down" /></Button>
    </>
  );
}

/** Drafts and closed questionnaires are the exceptions worth a badge; a published one is the normal state. */
export function StatusBadge({ status }: { status: QuestionnaireStatus }) {
  if (status === 'Published') return null;
  return <Badge kind={status === 'Draft' ? 'warn' : 'done'}>{statusLabels[status]}</Badge>;
}

const calloutTone = {
  info: 'bg-cyan-50 text-navy',
  ok: 'bg-basil-50 text-basil-700',
  warn: 'bg-[#fff4e5] text-[#8a4b00]',
  danger: 'bg-[#fdecea] text-[#912018]',
} as const;

/** Inline message with an optional action. Errors are announced (role "alert"), outcomes politely (role "status"). */
export function Callout({ tone, icon, role, children, action, className = '' }: {
  tone: keyof typeof calloutTone;
  icon?: React.ReactNode;
  role?: 'alert' | 'status';
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div role={role} className={`flex flex-wrap items-start gap-x-3 gap-y-2 rounded-xl p-4 ${calloutTone[tone]} ${className}`}>
      {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
      <div className="min-w-0 flex-1 text-base leading-snug">{children}</div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

// ---------- Fields ----------

type FieldTextProps = Omit<TextFieldProps, 'children' | 'className'> & {
  label?: string;
  description?: React.ReactNode;
  /** Shown under the field and linked to it (aria-describedby, aria-invalid). */
  error?: string | null;
  multiline?: boolean;
  rows?: number;
  placeholder?: string;
  /** 40px tall instead of 44px: for dense lists of fields. */
  compact?: boolean;
  inputClassName?: string;
};

export function FieldText({ label, description, error, multiline, rows = 3, placeholder, compact, inputClassName = '', ...props }: FieldTextProps) {
  const cls = `${label ? 'mt-1.5' : ''} ${compact ? inputCls.replace('min-h-11', 'min-h-10') : inputCls} ${inputClassName}`;
  return (
    <TextField {...props} isInvalid={props.isInvalid || !!error} className="block">
      {label && <Label className={labelCls}>{label}{props.isRequired && <span className="text-[#b42318]" aria-hidden="true"> *</span>}</Label>}
      {multiline
        ? <TextArea rows={rows} placeholder={placeholder} className={`py-2.5 leading-relaxed ${cls}`} />
        : <Input placeholder={placeholder} className={cls} />}
      {description && <Text slot="description" className={helpCls}>{description}</Text>}
      {error && <FieldError className={errorCls}>{error}</FieldError>}
    </TextField>
  );
}

const toNumber = (value: string) => (value.trim() === '' ? null : Number(value));

export function NumberField({ label, value, onChange, min, max, isDisabled, description, error }: {
  label: string;
  value?: number | null;
  onChange: (value: number | null) => void;
  min?: number;
  max?: number;
  isDisabled?: boolean;
  description?: React.ReactNode;
  error?: string | null;
}) {
  return (
    <TextField type="number" value={value == null ? '' : String(value)} onChange={text => onChange(toNumber(text))} isDisabled={isDisabled} isInvalid={!!error} className="block min-w-0">
      <Label className={labelCls}>{label}</Label>
      <Input min={min} max={max} className={`mt-1.5 ${inputCls}`} />
      {description && <Text slot="description" className={helpCls}>{description}</Text>}
      <FieldError className={errorCls}>{error}</FieldError>
    </TextField>
  );
}

/** Native select (grouped options welcome): the best control on phones and for screen readers. */
export function SelectField({ label, value, onChange, children, isDisabled, description, error }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  isDisabled?: boolean;
  description?: React.ReactNode;
  error?: string | null;
}) {
  const id = useId();
  const describedBy = [description ? `${id}-help` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined;
  return (
    <div className="min-w-0">
      <label htmlFor={id} className={labelCls}>{label}</label>
      <div className="relative mt-1.5">
        <select
          id={id}
          value={value}
          disabled={isDisabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          onChange={event => onChange(event.target.value)}
          className={`${inputCls} cursor-pointer appearance-none pr-10 disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-[#b42318]`}
        >
          {children}
        </select>
        <span className="pointer-events-none absolute inset-y-0 right-3 grid place-items-center text-muted"><AdminIcon name="chevron" className="size-4" /></span>
      </div>
      {description && <p id={`${id}-help`} className={helpCls}>{description}</p>}
      {error && <p id={`${id}-error`} className={errorCls}>{error}</p>}
    </div>
  );
}

/** Native date and time field (value as `yyyy-MM-ddTHH:mm`). */
export function DateTimeField({ label, value, onChange, description, error, isDisabled }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  description?: React.ReactNode;
  error?: string | null;
  isDisabled?: boolean;
}) {
  const id = useId();
  const describedBy = [description ? `${id}-help` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined;
  return (
    <div className="min-w-0">
      <label htmlFor={id} className={labelCls}>{label}</label>
      <input
        id={id}
        type="datetime-local"
        value={value}
        disabled={isDisabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        onChange={event => onChange(event.target.value)}
        className={`mt-1.5 ${inputCls} disabled:opacity-60 aria-[invalid=true]:border-[#b42318]`}
      />
      {description && <p id={`${id}-help`} className={helpCls}>{description}</p>}
      {error && <p id={`${id}-error`} className={errorCls}>{error}</p>}
    </div>
  );
}

const radioCls = `group flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3.5 transition-colors data-[hovered]:border-cyan-200 data-[selected]:border-navy data-[selected]:bg-cyan-50/60 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-60 ${focusRing}`;

export function RadioField<T extends string>({ label, value, onChange, options, isDisabled, description }: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; description?: string }[];
  isDisabled?: boolean;
  description?: React.ReactNode;
}) {
  return (
    <RadioGroup value={value} onChange={next => onChange(next as T)} isDisabled={isDisabled} className="block">
      <Label className={labelCls}>{label}</Label>
      <div className="mt-1.5 grid gap-2">
        {options.map(option => (
          <Radio key={option.value} value={option.value} className={radioCls}>
            <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2 border-[#8aa3b8] transition-colors group-data-[selected]:border-navy" aria-hidden="true">
              <span className="size-2.5 rounded-full bg-navy opacity-0 transition-opacity group-data-[selected]:opacity-100" />
            </span>
            <span>
              <span className="block font-semibold">{option.label}</span>
              {option.description && <span className="block text-sm text-muted">{option.description}</span>}
            </span>
          </Radio>
        ))}
      </div>
      {description && <Text slot="description" className={helpCls}>{description}</Text>}
    </RadioGroup>
  );
}

// ---------- Side sheet ----------

/** Dialog docked to the right from the sm breakpoint, a full page on phones. */
export function Sheet({ isOpen, onOpenChange, label, title, children }: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  label: string;
  title: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <ModalOverlay isOpen={isOpen} onOpenChange={onOpenChange} isDismissable className="fixed inset-0 z-50 flex bg-[rgb(0_36_69/0.42)] sm:justify-end">
      <Modal className="h-dvh w-full overflow-y-auto bg-white text-navy shadow-lift sm:max-w-md">
        <Dialog aria-label={label} className="outline-none">
          <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-line bg-white px-5 py-3">
            <Heading slot="title" className="min-w-0 flex-1 truncate text-xl font-bold">{title}</Heading>
            <Button slot="close" aria-label="Chiudi" className={btn.icon}><AdminIcon name="x" /></Button>
          </div>
          <div className="p-5">{children}</div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

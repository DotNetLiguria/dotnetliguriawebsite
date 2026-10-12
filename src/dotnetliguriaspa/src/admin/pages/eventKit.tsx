import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Checkbox, CheckboxGroup, DropZone, FileTrigger, Form, Input, Label, ListBox, ListBoxItem, Popover, Select, SelectValue, Text, TextField } from 'react-aria-components';
import { useOidcFetch } from '@axa-fr/react-oidc';
import { API_BASE_URL } from '../../config/apiConfig';
import { AdminIcon } from '../icons';
import { Panel, btn, focusRing } from '../ui';
import { clean, nameKey } from '../adminApi';
import { inputCls } from './listUi';
import { EventRecord, EventSpeaker, problemDetail } from './eventModel';

/** What every panel of the event page gets: the record, the directory of speakers and the ways to change them. */
export interface EventPage {
  workshop: EventRecord;
  speakers: EventSpeaker[];
  api: <T>(path: string, init?: RequestInit) => Promise<T>;
  /** PUT the whole record; on success the page follows the body. Resolves to false (after a toast) on failure. */
  save: (body: EventRecord, toast: { title: string; description?: string }) => Promise<boolean>;
  /** Replace the page record with one returned by the server. */
  replace: (workshop: EventRecord) => void;
  /** Read the record again from the server. */
  reload: () => Promise<void>;
  reloadSpeakers: () => void;
  /** Flip one visibility flag, saving at once (optimistic, reverted on failure). */
  toggleFlag: (flag: 'published' | 'in_homepage' | 'feedbackEnabled', value: boolean) => Promise<void>;
  /** Address of a tab of this event, for links between panels. */
  tabHref: (tab: string) => string;
}

// Building blocks of the event screens: an API hook that keeps the server's error detail, the read-only card
// with its own pencil, dropzones, the speaker picker and a few icons the shared kit does not have.

// ---------- API ----------

export class EventApiError extends Error {
  readonly status: number;

  constructor(status: number, detail?: string | null) {
    super(detail || `Errore HTTP: ${status}`);
    this.name = 'EventApiError';
    this.status = status;
  }
}

export const errorText = (error: unknown) => (error instanceof Error ? error.message : 'Errore di rete');

/**
 * fetch for the event admin: the signed-in user's token, JSON in and out, FormData passed through as-is, and
 * the ProblemDetails `detail` of a failed call kept as the error message (Eventbrite and Sessionize explain
 * themselves that way).
 */
export function useEventApi() {
  const { fetch } = useOidcFetch();
  return useCallback(async <T,>(path: string, init: RequestInit = {}): Promise<T> => {
    const headers: Record<string, string> = { Accept: 'application/json', ...(init.headers as Record<string, string> | undefined) };
    if (init.body && !(init.body instanceof FormData)) headers['Content-Type'] = 'application/json';
    const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
    if (!response.ok) {
      let detail: string | null = null;
      try { detail = problemDetail(await response.text()); } catch { /* no body */ }
      throw new EventApiError(response.status, detail);
    }
    const text = response.status === 204 ? '' : await response.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }, [fetch]);
}

// ---------- Icons (same grid and stroke as AdminIcon) ----------

const GLYPHS = {
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  copy: <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15h-.5A1.5 1.5 0 0 1 3 13.5v-9A1.5 1.5 0 0 1 4.5 3h9A1.5 1.5 0 0 1 15 4.5V5" /></>,
  star: <path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />,
  link: <><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></>,
  ticket: <><path d="M3.5 8.5v-2a1 1 0 0 1 1-1h15a1 1 0 0 1 1 1v2a2.5 2.5 0 0 0 0 5v2a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1v-2a2.5 2.5 0 0 0 0-5z" /><path d="M14 6v12" strokeDasharray="2 2" /></>,
  refresh: <><path d="M20 12a8 8 0 1 1-2.3-5.7" /><path d="M20 4v5h-5" /></>,
} as const;

export function EventIcon({ name, className = 'size-5' }: { name: keyof typeof GLYPHS; className?: string }) {
  return (
    <svg className={`${className} shrink-0`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {GLYPHS[name]}
    </svg>
  );
}

// ---------- Cards ----------

/**
 * Read-only card with its own pencil: one card at a time goes into edit mode and renders `form`, which closes
 * itself after a successful save or on cancel; focus goes back to the pencil.
 */
export function EditCard({ id, title, children, form, actions, className = '' }: {
  id: string;
  title: string;
  children: React.ReactNode;
  /** Edit mode; omitted when the card is not editable in place. */
  form?: (close: () => void) => React.ReactNode;
  /** Extra header controls shown next to the pencil in view mode. */
  actions?: React.ReactNode;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const pencil = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef(false);
  useEffect(() => {
    if (!editing && returnFocus.current) {
      returnFocus.current = false;
      pencil.current?.focus();
    }
  }, [editing]);
  const close = () => { returnFocus.current = true; setEditing(false); };
  const headingId = `card-${id}`;
  return (
    <Panel labelledBy={headingId} className={className}>
      <div className="flex items-center justify-between gap-3 px-5 pt-4">
        <h2 id={headingId} className="text-lg font-bold">{title}</h2>
        {!editing && (
          <span className="flex items-center gap-1">
            {actions}
            {form && <Button ref={pencil} onPress={() => setEditing(true)} aria-label={`Modifica: ${title}`} className={btn.icon}><AdminIcon name="pencil" /></Button>}
          </span>
        )}
      </div>
      <div className="px-5 pt-2 pb-5">{editing && form ? form(close) : children}</div>
    </Panel>
  );
}

/** The form of a card in edit mode: native validation, Annulla/Salva, stays open when the save fails. */
export function CardForm({ onSave, onCancel, children, saveLabel = 'Salva', className = 'space-y-4' }: {
  /** Resolves to true when saved (the card closes) or false to stay in edit mode. */
  onSave: () => Promise<boolean> | boolean;
  onCancel: () => void;
  children: React.ReactNode;
  saveLabel?: string;
  className?: string;
}) {
  const [saving, setSaving] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await onSave();
    } finally {
      setSaving(false);
    }
  };
  return (
    <Form onSubmit={submit} className={className}>
      {children}
      <div className="flex flex-wrap justify-end gap-2 pt-1">
        <Button onPress={onCancel} isDisabled={saving} className={btn.ghost}>Annulla</Button>
        <Button type="submit" isDisabled={saving} className={btn.primary}>{saving ? 'Salvataggio…' : saveLabel}</Button>
      </div>
    </Form>
  );
}

/** Definition list of a card in view mode. */
export function Facts({ items }: { items: Array<[string, React.ReactNode]> }) {
  return (
    <dl className="grid gap-3">
      {items.map(([label, value]) => (
        <div key={label}><dt className="text-sm font-semibold text-muted">{label}</dt><dd className="mt-0.5">{value}</dd></div>
      ))}
    </dl>
  );
}

export const Missing = ({ children }: { children: React.ReactNode }) => <span className="text-muted">{children}</span>;

/** Explicit confirmation inside the card before a destructive action. */
export function InlineConfirm({ title, children, confirmLabel, busyLabel, busy = false, onConfirm, onCancel }: {
  title: string;
  children?: React.ReactNode;
  confirmLabel: string;
  busyLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div role="alert" className="rounded-xl border border-[#b42318] p-4">
      <p className="font-bold text-[#b42318]">{title}</p>
      {children && <div className="text-sm text-muted">{children}</div>}
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <Button onPress={onCancel} isDisabled={busy} className={btn.ghost} autoFocus>Annulla</Button>
        <Button onPress={onConfirm} isDisabled={busy} className={btn.danger}>{busy ? (busyLabel ?? confirmLabel) : confirmLabel}</Button>
      </div>
    </div>
  );
}

/** Row of the readiness checklists, like the dashboard's. */
export function CheckRow({ done, title, detail, action }: { done: boolean; title: string; detail: React.ReactNode; action?: React.ReactNode }) {
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3.5">
      <span className={`grid size-8 shrink-0 place-items-center rounded-full ${done ? 'bg-basil-50 text-basil-700' : 'bg-[#fff4e5] text-[#8a4b00]'}`}>
        <AdminIcon name={done ? 'check' : 'todo'} />
        <span className="sr-only">{done ? 'Fatto:' : 'Da fare:'}</span>
      </span>
      <span className="min-w-0 flex-1"><span className="block font-bold">{title}</span><span className="block text-muted">{detail}</span></span>
      {action}
    </li>
  );
}

// ---------- Inputs ----------

export interface SelectOption { id: string; label: string; description?: string }

/** Styled single select with a visible label. */
export function SelectInput({ label, items, selectedKey, onSelectionChange, placeholder = 'Scegli…', description, isRequired, isDisabled, className = 'block' }: {
  label: string;
  items: SelectOption[];
  selectedKey: string | null;
  onSelectionChange: (key: string | null) => void;
  placeholder?: string;
  description?: string;
  isRequired?: boolean;
  isDisabled?: boolean;
  className?: string;
}) {
  return (
    <Select selectedKey={selectedKey} onSelectionChange={key => onSelectionChange(key == null ? null : String(key))} placeholder={placeholder} isRequired={isRequired} isDisabled={isDisabled} className={className}>
      <Label className="text-sm font-semibold text-navy">{label}{isRequired && <span className="text-[#b42318]" aria-hidden="true"> *</span>}</Label>
      <Button className={`mt-1.5 flex items-center justify-between gap-2 text-left ${inputCls} ${focusRing}`}>
        <SelectValue className="truncate data-[placeholder]:text-[#6b8399]" />
        <AdminIcon name="chevron" className="size-4 shrink-0 text-muted" />
      </Button>
      {description && <Text slot="description" className="mt-1.5 block text-sm text-muted">{description}</Text>}
      <Popover className="max-h-72 w-[var(--trigger-width)] overflow-y-auto rounded-xl border border-line bg-white p-1.5 shadow-lift outline-none">
        <ListBox className="outline-none">
          {items.map(item => (
            <ListBoxItem key={item.id} id={item.id} textValue={item.label} className="flex min-h-10 cursor-pointer flex-col justify-center rounded-lg px-3 outline-none data-[focused]:bg-cyan-50 data-[selected]:font-bold">
              <span>{item.label}</span>
              {item.description && <span className="text-sm font-normal text-muted">{item.description}</span>}
            </ListBoxItem>
          ))}
        </ListBox>
      </Popover>
    </Select>
  );
}

/** Compact input whose label is for assistive technology only (agenda rows). */
export function InlineField({ label, value, onChange, type = 'text', placeholder, className = '' }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  className?: string;
}) {
  return (
    <TextField aria-label={label} value={value} onChange={onChange} className={`block ${className}`}>
      <Input type={type} placeholder={placeholder} className={`${inputCls} min-h-10 px-3 text-sm`} />
    </TextField>
  );
}

// ---------- Files ----------

/** Drag-and-drop area with a file button: the only entry point for uploads. */
export function Dropzone({ label, hint, accept, multiple = false, busy = false, buttonLabel, onFiles }: {
  label: string;
  hint: string;
  /** Extensions (".pdf") or MIME types accepted by the file dialog. */
  accept: string[];
  multiple?: boolean;
  busy?: boolean;
  buttonLabel?: string;
  onFiles: (files: File[]) => void;
}) {
  return (
    <DropZone
      onDrop={async event => {
        const files = await Promise.all(event.items.flatMap(item => (item.kind === 'file' ? [item.getFile()] : [])));
        if (files.length) onFiles(multiple ? files : files.slice(0, 1));
      }}
      className={`flex flex-col items-center rounded-2xl border-2 border-dashed border-line bg-[#f3f7fa] px-6 py-8 text-center transition-colors data-[drop-target]:border-cyan-700 data-[drop-target]:bg-cyan-50 ${focusRing}`}
    >
      <AdminIcon name="upload" className="size-7 text-cyan-700" />
      <Text slot="label" className="mt-2 font-semibold">{label}</Text>
      <p className="text-sm text-muted">{hint}</p>
      <FileTrigger acceptedFileTypes={accept} allowsMultiple={multiple} onSelect={files => { if (files?.length) onFiles([...files]); }}>
        <Button isDisabled={busy} className={`mt-3 ${btn.secondary}`}>{busy ? 'Caricamento…' : (buttonLabel ?? (multiple ? 'Scegli i file' : 'Scegli il file'))}</Button>
      </FileTrigger>
    </DropZone>
  );
}

// ---------- Speakers ----------

const checkboxCls = `group flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 transition-colors data-[hovered]:bg-cyan-50 ${focusRing}`;
const CheckMark = () => (
  <span className="grid size-5 shrink-0 place-items-center rounded border-2 border-[#c3d3df] transition-colors group-data-[selected]:border-basil-700 group-data-[selected]:bg-basil-700" aria-hidden="true">
    <AdminIcon name="check" className="size-3.5 text-white opacity-0 group-data-[selected]:opacity-100" />
  </span>
);

/**
 * Picks speakers from the directory: chips for the chosen ones, a search box and a checkbox list.
 * `extras` are names on the talk that are not in the directory (imported): shown, kept, not editable.
 */
export function SpeakerPicker({ label = 'Relatori', speakers, selectedIds, onChange, extras = [], isRequired, errorMessage }: {
  label?: string;
  speakers: EventSpeaker[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  extras?: string[];
  isRequired?: boolean;
  errorMessage?: string | null;
}) {
  const [query, setQuery] = useState('');
  const q = nameKey(query);
  const sorted = useMemo(() => [...speakers].sort((a, b) => clean(a.name).localeCompare(clean(b.name), 'it')), [speakers]);
  const visible = sorted.filter(speaker => !q || nameKey(speaker.name).includes(q));
  const selected = selectedIds.map(id => speakers.find(speaker => speaker.workshopSpeakerId === id)).filter((s): s is EventSpeaker => !!s);
  const errorId = errorMessage ? `${label}-error` : undefined;
  return (
    // The requirement is checked by the dialog (imported speakers outside the directory count too), not natively.
    <CheckboxGroup value={selectedIds} onChange={onChange} isInvalid={!!errorMessage} aria-describedby={errorId} className="block">
      <Label className="text-sm font-semibold text-navy">{label}{isRequired && <span className="text-[#b42318]" aria-hidden="true"> *</span>}</Label>
      {(selected.length > 0 || extras.length > 0) && (
        <ul className="mt-1.5 flex flex-wrap gap-1.5" aria-label="Relatori scelti">
          {selected.map(speaker => (
            <li key={speaker.workshopSpeakerId} className="inline-flex items-center gap-1 rounded-full bg-cyan-50 py-0.5 pr-1 pl-3 text-sm font-bold text-cyan-700">
              {clean(speaker.name)}
              <Button aria-label={`Togli ${clean(speaker.name)}`} onPress={() => onChange(selectedIds.filter(id => id !== speaker.workshopSpeakerId))} className={`grid size-7 cursor-pointer place-items-center rounded-full data-[hovered]:bg-white ${focusRing}`}><AdminIcon name="x" className="size-3.5" /></Button>
            </li>
          ))}
          {extras.map(name => (
            <li key={name} className="inline-flex items-center rounded-full bg-[#eef3f7] px-3 py-0.5 text-sm font-bold text-muted" title="Importato: non è in anagrafica">{name}</li>
          ))}
        </ul>
      )}
      <TextField aria-label="Cerca un relatore" value={query} onChange={setQuery} className="mt-2 block">
        <Input placeholder="Cerca per nome" className={`${inputCls} min-h-10`} />
      </TextField>
      <div className="mt-1.5 max-h-52 overflow-y-auto rounded-xl border border-line p-1">
        {visible.length ? visible.map(speaker => (
          <Checkbox key={speaker.workshopSpeakerId} value={speaker.workshopSpeakerId} className={checkboxCls}>
            <CheckMark /><span className="font-semibold">{clean(speaker.name)}</span>
          </Checkbox>
        )) : <p className="px-2 py-3 text-sm text-muted">{speakers.length ? 'Nessun relatore corrisponde alla ricerca.' : 'Nessun relatore attivo in anagrafica.'}</p>}
      </div>
      {errorMessage && <p id={errorId} className="mt-1.5 text-sm font-semibold text-[#b42318]">{errorMessage}</p>}
    </CheckboxGroup>
  );
}

// ---------- Tabs ----------

export const tabCls = `min-h-12 shrink-0 cursor-pointer border-b-2 border-transparent px-3 font-semibold whitespace-nowrap text-muted transition-colors data-[hovered]:text-navy data-[selected]:border-cyan-700 data-[selected]:text-navy ${focusRing}`;

/** Switch row of the visibility panel: title, hint and the switch. */
export function SwitchRow({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-4 py-3.5">
      <span className="min-w-0 flex-1"><span className="block font-bold">{title}</span><span className="block text-sm text-muted">{hint}</span></span>
      {children}
    </li>
  );
}

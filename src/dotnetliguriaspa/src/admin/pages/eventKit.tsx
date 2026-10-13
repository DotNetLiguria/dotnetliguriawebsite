import React, { useCallback, useMemo, useState } from 'react';
import { Button, Checkbox, CheckboxGroup, DropZone, FileTrigger, Form, Input, Label, ListBox, ListBoxItem, Popover, Select, SelectValue, Text, TextField } from 'react-aria-components';
import { useOidcFetch } from '@axa-fr/react-oidc';
import { API_BASE_URL } from '../../config/apiConfig';
import { AdminIcon } from '../icons';
import { btn, focusRing } from '../ui';
import { clean, nameKey } from '../adminApi';
import { inputCls } from './listUi';
import { EventCoreValues, EventRecord, EventSpeaker, problemDetail } from './eventModel';

// Building blocks of the event screens: an API hook that keeps the server's error detail, dropzones, file
// pickers, the speaker picker and a few icons the shared kit does not have.

/** What every step of the wizard gets: the record, the speakers, the page draft and the ways to change them. */
export interface EventPage {
  workshop: EventRecord;
  speakers: EventSpeaker[];
  api: <T>(path: string, init?: RequestInit) => Promise<T>;
  /** The record as it is right now (also inside callbacks started earlier). */
  current: () => EventRecord;
  /**
   * PUT the whole record, built from the latest record at send time; on success the page follows the body.
   * Resolves to false (after a toast) on failure. One whole-record PUT at a time: `saving` is true meanwhile.
   */
  save: (build: (latest: EventRecord) => EventRecord, toast: { title: string; description?: string }) => Promise<boolean>;
  saving: boolean;
  /** Replace the page record with one returned by the server (handleRelatedWorkshopSaved). */
  replace: (workshop: EventRecord) => void;
  /** Replace the page record as given, without the saved-record normalisation. */
  commitRecord: (workshop: EventRecord) => void;
  /** Read the record again from the server; a failure is ignored, as before. */
  refresh: () => Promise<void>;
  reloadSpeakers: () => void;
  /** The draft of steps 1, 3 and 4: the record's values with the edits on top, saved by "Salva modifiche". */
  values: EventCoreValues;
  edit: (patch: Partial<EventCoreValues>) => void;
}

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

// ---------- Forms and confirmations ----------

/**
 * A dialog form: Annulla and the save button; stays open when the save fails. Required fields are announced,
 * not enforced by the browser: the save handler checks them and says so, as the previous dialogs did.
 */
export function CardForm({ onSave, onCancel, children, saveLabel = 'Salva', className = 'space-y-4' }: {
  /** Resolves to true when saved (the dialog closes) or false to stay in edit mode. */
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
    <Form onSubmit={submit} validationBehavior="aria" className={className}>
      {children}
      <div className="flex flex-wrap justify-end gap-2 pt-1">
        <Button onPress={onCancel} isDisabled={saving} className={btn.ghost}>Annulla</Button>
        <Button type="submit" isDisabled={saving} className={btn.primary}>{saving ? 'Salvataggio…' : saveLabel}</Button>
      </div>
    </Form>
  );
}

/** Explicit confirmation inside the panel before a destructive action (the previous window.confirm). */
export function InlineConfirm({ title, confirmLabel, busyLabel, busy = false, onConfirm, onCancel }: {
  title: string;
  confirmLabel: string;
  busyLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div role="alert" className="rounded-xl border border-[#b42318] p-4">
      <p className="font-bold text-[#b42318]">{title}</p>
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <Button onPress={onCancel} isDisabled={busy} className={btn.ghost} autoFocus>Annulla</Button>
        <Button onPress={onConfirm} isDisabled={busy} className={btn.danger}>{busy ? (busyLabel ?? confirmLabel) : confirmLabel}</Button>
      </div>
    </div>
  );
}

/** Title block of a step panel. */
export function PanelTitle({ id, title, actions }: { id?: string; title: string; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h3 id={id} className="text-lg font-bold">{title}</h3>
      {actions}
    </div>
  );
}

/** Caption above a field, as the previous forms had. */
export const Caption = ({ children }: { children: React.ReactNode }) => <p className="text-sm font-semibold text-muted">{children}</p>;

// ---------- Inputs ----------

export interface SelectOption { id: string; label: string; description?: string }

/** Styled single select with a visible label. */
export function SelectInput({ label, items, selectedKey, onSelectionChange, placeholder = 'Scegli…', description, isDisabled, isRequired, className = 'block' }: {
  label: string;
  items: SelectOption[];
  selectedKey: string | null;
  onSelectionChange: (key: string | null) => void;
  placeholder?: string;
  description?: string;
  isDisabled?: boolean;
  isRequired?: boolean;
  className?: string;
}) {
  return (
    <Select selectedKey={selectedKey} onSelectionChange={key => onSelectionChange(key == null ? null : String(key))} placeholder={placeholder} isDisabled={isDisabled} className={className}>
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

/** Number input with a visible label and a lower bound shown to the browser. */
export function NumberInput({ label, value, onChange, min, description, className = 'block' }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: number;
  description?: string;
  className?: string;
}) {
  return (
    <TextField value={value} onChange={onChange} className={className}>
      <Label className="text-sm font-semibold text-navy">{label}</Label>
      <Input type="number" min={min} step={1} className={`mt-1.5 ${inputCls}`} />
      {description && <Text slot="description" className="mt-1.5 block text-sm text-muted">{description}</Text>}
    </TextField>
  );
}

// ---------- Files ----------

/** Drag-and-drop area with a file button; choosing a file is the action. */
export function Dropzone({ label, accept, busy = false, buttonLabel, onFiles }: {
  label: string;
  /** Extensions (".pdf") or MIME types accepted by the file dialog. */
  accept: string[];
  busy?: boolean;
  buttonLabel: string;
  onFiles: (files: File[]) => void;
}) {
  return (
    <DropZone
      onDrop={async event => {
        const files = await Promise.all(event.items.flatMap(item => (item.kind === 'file' ? [item.getFile()] : [])));
        if (files.length) onFiles(files.slice(0, 1));
      }}
      className={`flex flex-col items-center rounded-2xl border-2 border-dashed border-line bg-[#f3f7fa] px-6 py-8 text-center transition-colors data-[drop-target]:border-cyan-700 data-[drop-target]:bg-cyan-50 ${focusRing}`}
    >
      <AdminIcon name="upload" className="size-7 text-cyan-700" />
      <Text slot="label" className="mt-2 font-semibold">{label}</Text>
      <FileTrigger acceptedFileTypes={accept} onSelect={files => { if (files?.length) onFiles([...files]); }}>
        <Button isDisabled={busy} className={`mt-3 ${btn.secondary}`}>{busy ? 'Caricamento…' : buttonLabel}</Button>
      </FileTrigger>
    </DropZone>
  );
}

/** "Choose file…" button that shows the chosen file's name, as the previous dialogs did. */
export function FilePicker({ label, file, accept, onSelect }: { label: string; file: File | null; accept?: string[]; onSelect: (file: File | null) => void }) {
  return (
    <FileTrigger acceptedFileTypes={accept} onSelect={files => onSelect(files?.[0] ?? null)}>
      <Button className={`${btn.secondary} w-full justify-start`}>{file ? file.name : label}</Button>
    </FileTrigger>
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
 * Picks speakers from the directory (the previous multi-select autocomplete): chips for the chosen ones, a
 * search box and a checkbox list. With `collapsed` the list opens on request, so a long talk list stays
 * readable. `extras` are names on the talk that are not in the directory (imported): shown, kept, not editable.
 */
export function SpeakerPicker({ label, placeholder = 'Seleziona i relatori', speakers, selectedIds, onChange, extras = [], collapsed = false }: {
  label: string;
  placeholder?: string;
  speakers: EventSpeaker[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  extras?: string[];
  collapsed?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(!collapsed);
  const q = nameKey(query);
  const sorted = useMemo(() => [...speakers].sort((a, b) => clean(a.name).localeCompare(clean(b.name), 'it')), [speakers]);
  const visible = sorted.filter(speaker => !q || nameKey(speaker.name).includes(q));
  const selected = selectedIds.map(id => speakers.find(speaker => speaker.workshopSpeakerId === id)).filter((s): s is EventSpeaker => !!s);
  return (
    <CheckboxGroup value={selectedIds} onChange={onChange} className="block">
      <Label className="text-sm font-semibold text-navy">{label}</Label>
      {(selected.length > 0 || extras.length > 0) && (
        <ul className="mt-1.5 flex flex-wrap gap-1.5" aria-label={`${label}: selezionati`}>
          {selected.map(speaker => (
            <li key={speaker.workshopSpeakerId} className="inline-flex items-center gap-1 rounded-full bg-cyan-50 py-0.5 pr-1 pl-3 text-sm font-bold text-cyan-700">
              {clean(speaker.name)}
              <Button aria-label={`Rimuovi ${clean(speaker.name)}`} onPress={() => onChange(selectedIds.filter(id => id !== speaker.workshopSpeakerId))} className={`grid size-7 cursor-pointer place-items-center rounded-full data-[hovered]:bg-white ${focusRing}`}><AdminIcon name="x" className="size-3.5" /></Button>
            </li>
          ))}
          {extras.map(name => (
            <li key={name} className="inline-flex items-center rounded-full bg-[#eef3f7] px-3 py-0.5 text-sm font-bold text-muted">{name}</li>
          ))}
        </ul>
      )}
      {!open ? (
        <Button onPress={() => setOpen(true)} className={`mt-2 ${btn.ghost}`}><AdminIcon name="plus" />{placeholder}</Button>
      ) : (
        <>
          <TextField aria-label={placeholder} value={query} onChange={setQuery} className="mt-2 block">
            <Input placeholder={placeholder} className={`${inputCls} min-h-10`} />
          </TextField>
          <div className="mt-1.5 max-h-52 overflow-y-auto rounded-xl border border-line p-1">
            {visible.map(speaker => (
              <Checkbox key={speaker.workshopSpeakerId} value={speaker.workshopSpeakerId} className={checkboxCls}>
                <CheckMark /><span className="font-semibold">{clean(speaker.name)}</span>
              </Checkbox>
            ))}
          </div>
          {collapsed && <Button onPress={() => setOpen(false)} className={`mt-1 ${btn.ghost}`}>Chiudi</Button>}
        </>
      )}
    </CheckboxGroup>
  );
}

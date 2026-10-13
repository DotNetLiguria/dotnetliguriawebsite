import React, { useCallback, useState } from 'react';
import { Button, Checkbox, CheckboxGroup, FileTrigger, Form, Input, Label, ListBox, ListBoxItem, Popover, Select, SelectValue, Text, TextField } from 'react-aria-components';
import { useOidcFetch } from '@axa-fr/react-oidc';
import { API_BASE_URL } from '../../config/apiConfig';
import { AdminIcon } from '../icons';
import { btn, focusRing } from '../ui';
import { clean, nameKey } from '../adminApi';
import { inputCls } from './listUi';
import { EventApiError, EventCoreValues, EventRecord, EventSpeaker } from './eventModel';

// Building blocks of the event screens: an API hook that keeps the failed response for the wording of each
// action, file pickers, the speaker picker and a few icons the shared kit does not have.

/** What every step of the wizard gets: the record, the speakers, the page draft and the ways to change them. */
export interface EventPage {
  workshop: EventRecord;
  speakers: EventSpeaker[];
  setSpeakers: (speakers: EventSpeaker[]) => void;
  api: <T>(path: string, init?: RequestInit) => Promise<T>;
  /** The record as it is right now (also inside callbacks started earlier). */
  current: () => EventRecord;
  /**
   * PUT the whole record, built from the latest record at send time; on success the page follows the body and
   * shows `success`. Resolves to false (after the `failure` toast) on failure. One whole-record PUT at a time:
   * `saving` is true meanwhile.
   */
  save: (build: (latest: EventRecord) => EventRecord, messages: { success: string; failure: (error: unknown) => string }) => Promise<boolean>;
  saving: boolean;
  /** Replace the page record with one returned by the server (handleRelatedWorkshopSaved). */
  replace: (workshop: EventRecord) => void;
  /** Replace the page record as given, without the saved-record normalisation. */
  commitRecord: (workshop: EventRecord) => void;
  /** Read the record again from the server; resolves to false when that fails (ignored, as before). */
  refresh: () => Promise<boolean>;
  /** The draft of steps 1, 3 and 4: the record's values with the edits on top, saved by "Salva modifiche". */
  values: EventCoreValues;
  edit: (patch: Partial<EventCoreValues>) => void;
}

// ---------- API ----------

/**
 * fetch for the event admin: the signed-in user's token, JSON in and out, FormData passed through as-is. A
 * failed call throws an EventApiError with the status and the body, worded by each action (eventModel).
 */
export function useEventApi() {
  const { fetch } = useOidcFetch();
  return useCallback(async <T,>(path: string, init: RequestInit = {}): Promise<T> => {
    const headers: Record<string, string> = { Accept: 'application/json', ...(init.headers as Record<string, string> | undefined) };
    if (init.body && !(init.body instanceof FormData)) headers['Content-Type'] = 'application/json';
    const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
    if (!response.ok) {
      let body = '';
      try { body = await response.text(); } catch { /* no body */ }
      throw new EventApiError(response.status, response.headers.get('Content-Type') ?? '', body);
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

/** Title of a step panel: the step's heading, focused when the step is opened from the wizard. */
export function PanelTitle({ id, title, actions }: { id?: string; title: string; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 id={id} tabIndex={-1} className="text-lg font-bold outline-none">{title}</h2>
      {actions}
    </div>
  );
}

/** Caption above a field, as the previous forms had. */
export const Caption = ({ id, children }: { id?: string; children: React.ReactNode }) => <p id={id} className="text-sm font-semibold text-muted">{children}</p>;

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

/** "Choose file…" button that shows the chosen file's name, as the previous admin did. */
export function FilePicker({ label, file, accept, describedBy, onSelect }: { label: string; file: File | null; accept?: string[]; describedBy?: string; onSelect: (file: File) => void }) {
  return (
    <FileTrigger acceptedFileTypes={accept} onSelect={files => { const chosen = files?.[0]; if (chosen) onSelect(chosen); }}>
      <Button aria-describedby={describedBy} className={`${btn.secondary} w-full justify-start`}>{file ? file.name : label}</Button>
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
 * readable.
 */
export function SpeakerPicker({ label, placeholder = 'Seleziona i relatori', speakers, selectedIds, onChange, collapsed = false }: {
  label: string;
  placeholder?: string;
  speakers: EventSpeaker[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  collapsed?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(!collapsed);
  const q = nameKey(query);
  // In the order the API returns them, as the previous autocomplete listed them.
  const visible = speakers.filter(speaker => !q || nameKey(speaker.name).includes(q));
  const selected = selectedIds.map(id => speakers.find(speaker => speaker.workshopSpeakerId === id)).filter((s): s is EventSpeaker => !!s);
  return (
    <CheckboxGroup value={selectedIds} onChange={onChange} className="block">
      <Label className="text-sm font-semibold text-navy">{label}</Label>
      {selected.length > 0 && (
        <ul className="mt-1.5 flex flex-wrap gap-1.5" aria-label={`${label}: selezionati`}>
          {selected.map(speaker => (
            <li key={speaker.workshopSpeakerId} className="inline-flex items-center gap-1 rounded-full bg-cyan-50 py-0.5 pr-1 pl-3 text-sm font-bold text-cyan-700">
              {clean(speaker.name)}
              <Button aria-label={`Rimuovi ${clean(speaker.name)}`} onPress={() => onChange(selectedIds.filter(id => id !== speaker.workshopSpeakerId))} className={`grid size-7 cursor-pointer place-items-center rounded-full data-[hovered]:bg-white ${focusRing}`}><AdminIcon name="x" className="size-3.5" /></Button>
            </li>
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

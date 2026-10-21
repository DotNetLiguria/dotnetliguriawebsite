import React, { useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Button, Dialog, Heading, Modal, ModalOverlay, Toolbar, Tooltip, TooltipTrigger } from 'react-aria-components';
import { btn, focusRing } from '../ui';
import { AdminIcon } from '../icons';
import { UNSAFE_NavigationContext, useLocation } from 'react-router-dom';
import type { NewsletterEvent } from './types';

export const editorInput = `min-h-11 w-full rounded-xl border border-line bg-white px-3 py-2 text-navy focus:outline-3 focus:outline-cyan-700 disabled:opacity-60 ${focusRing}`;

export function useUnsavedChanges(dirty: boolean) {
  const location = useLocation();
  const { navigator } = useContext(UNSAFE_NavigationContext);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const currentPath = `${location.pathname}${location.search}${location.hash}`;
  const historyIndex = useRef<number | undefined>(window.history.state?.idx);
  useEffect(() => { historyIndex.current = window.history.state?.idx; }, [currentPath]);
  useEffect(() => {
    if (!dirty) return;
    const message = 'Ci sono modifiche non salvate. Vuoi abbandonarle?';
    const allow = () => !dirtyRef.current || window.confirm(message);
    const unload = (event: BeforeUnloadEvent) => { if (dirtyRef.current) { event.preventDefault(); event.returnValue = ''; } };
    const originalPush = navigator.push;
    const originalReplace = navigator.replace;
    const push: typeof navigator.push = (...args) => { if (allow()) originalPush.apply(navigator, args); };
    const replace: typeof navigator.replace = (...args) => { if (allow()) originalReplace.apply(navigator, args); };
    navigator.push = push;
    navigator.replace = replace;
    const click = (event: MouseEvent) => {
      const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (!(link instanceof HTMLAnchorElement) || link.hasAttribute('download') || link.target === '_blank' || event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const url = new URL(link.href, window.location.href);
      if (`${url.pathname}${url.search}${url.hash}` === currentPath) return;
      // Same-origin React Router links are guarded by the navigator, including palette actions.
      if (url.origin === window.location.origin && link.hasAttribute('data-discover')) return;
      if (!allow()) { event.preventDefault(); event.stopPropagation(); }
    };
    let restoring = false;
    const back = (event: PopStateEvent) => {
      if (restoring) {
        restoring = false;
        event.stopImmediatePropagation();
        return;
      }
      const target = event.state?.idx as number | undefined;
      const previous = historyIndex.current;
      if (!allow() && previous != null && target != null && previous !== target) {
        event.stopImmediatePropagation();
        restoring = true;
        window.history.go(previous - target);
      }
    };
    window.addEventListener('beforeunload', unload);
    document.addEventListener('click', click, true);
    window.addEventListener('popstate', back, true);
    return () => {
      window.removeEventListener('beforeunload', unload);
      document.removeEventListener('click', click, true);
      window.removeEventListener('popstate', back, true);
      if (navigator.push === push) navigator.push = originalPush;
      if (navigator.replace === replace) navigator.replace = originalReplace;
    };
  }, [dirty, currentPath, navigator]);
  return () => { dirtyRef.current = false; };
}

export function ConfirmDialog({ title, children, confirmLabel, onConfirm, onCancel, busy = false, danger = false }: {
  title: string; children: React.ReactNode; confirmLabel: string; onConfirm: () => void; onCancel: () => void; busy?: boolean; danger?: boolean;
}) {
  return <ModalOverlay isOpen onOpenChange={open => { if (!open && !busy) onCancel(); }} isKeyboardDismissDisabled={busy} className="fixed inset-0 z-50 flex items-center justify-center bg-[rgb(0_36_69/0.42)] p-4">
    <Modal className="max-h-[90dvh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 text-navy shadow-lift">
      <Dialog className="space-y-4 outline-none">
        <Heading slot="title" className="text-2xl font-bold">{title}</Heading>
        {children}
        <div className="flex flex-wrap justify-end gap-3">
          <Button className={btn.secondary} isDisabled={busy} onPress={onCancel}>Annulla</Button>
          <Button className={danger ? btn.danger : btn.primary} isDisabled={busy} onPress={onConfirm}>{busy ? 'Operazione in corso…' : confirmLabel}</Button>
        </div>
      </Dialog>
    </Modal>
  </ModalOverlay>;
}

export function EventCombobox({ events, value, onChange, disabled }: { events: NewsletterEvent[]; value: string; onChange: (id: string) => void; disabled?: boolean }) {
  return <div><label className="block space-y-1 text-sm font-semibold">
    <span>Evento pubblicato in corso o futuro</span>
    <select className={editorInput} value={value} onChange={event => onChange(event.target.value)} disabled={disabled || events.length === 0}>
      <option value="">{events.length === 0 ? 'Nessun evento disponibile' : 'Seleziona un evento'}</option>
      {events.map(event => <option key={event.id} value={event.id}>{event.title} · {event.date.slice(0, 10)}{event.startTime ? ` · ${event.startTime}` : ''}{event.endTime ? `–${event.endTime}` : ''}{event.locationName ? ` · ${event.locationName}` : ''}</option>)}
    </select>
  </label>
    {events.length === 1 && <p className="mt-1 text-sm text-muted">Un solo evento disponibile: selezionalo dal menu.</p>}
  </div>;
}

function FormattingButton({ label, hint = label, children, disabled, onPress }: {
  label: string; hint?: string; children: React.ReactNode; disabled?: boolean; onPress: () => void;
}) {
  return <TooltipTrigger>
    <Button aria-label={label} className={`${btn.icon} min-h-11 min-w-11 rounded-lg`} isDisabled={disabled} onPress={onPress}>{children}</Button>
    <Tooltip className="z-50 rounded-lg bg-navy px-3 py-2 text-sm text-white shadow-lift">{hint}</Tooltip>
  </TooltipTrigger>;
}

export function MarkdownEditor({ value, onChange, readOnly, disabled, onUpload, maxImageBytes, uploadDisabled }: {
  value: string; onChange: (value: string) => void; readOnly?: boolean; disabled?: boolean;
  onUpload?: (file: File) => Promise<string | undefined>; maxImageBytes?: number; uploadDisabled?: boolean;
}) {
  const textarea = useRef<HTMLTextAreaElement>(null);
  const pendingSelection = useRef<{ start: number; end: number } | null>(null);
  const [uploading, setUploading] = useState(false);
  useLayoutEffect(() => {
    if (!pendingSelection.current || !textarea.current) return;
    const { start, end } = pendingSelection.current;
    textarea.current.focus();
    textarea.current.setSelectionRange(start, end);
    pendingSelection.current = null;
  }, [value]);
  const insert = (before: string, after = '', selection = 'testo') => {
    const element = textarea.current;
    const start = element?.selectionStart ?? value.length;
    const end = element?.selectionEnd ?? value.length;
    const selected = start === end ? selection : value.slice(start, end);
    const unwrap = after && value.slice(Math.max(0, start - before.length), start) === before && value.slice(end, end + after.length) === after;
    pendingSelection.current = unwrap
      ? { start: start - before.length, end: end - before.length }
      : { start: start + before.length, end: start + before.length + selected.length };
    onChange(unwrap
      ? value.slice(0, start - before.length) + selected + value.slice(end + after.length)
      : value.slice(0, start) + before + selected + after + value.slice(end));
  };
  const upload = async (file?: File) => {
    if (!file || !onUpload) return;
    setUploading(true);
    try {
      const markdown = await onUpload(file);
      if (markdown) insert(markdown, '', '');
    } finally { setUploading(false); }
  };
  return <div className="space-y-2">
    <label htmlFor="newsletter-markdown" className="text-sm font-semibold">Contenuto Markdown</label>
    {!readOnly && <Toolbar aria-label="Formattazione testo" className="flex flex-wrap items-center gap-1 rounded-t-xl border border-line bg-cyan-50 p-1">
      <FormattingButton label="Grassetto" hint="Grassetto (Ctrl+B / ⌘B)" disabled={disabled || uploading} onPress={() => insert('**', '**')}><strong aria-hidden="true" className="text-lg">B</strong></FormattingButton>
      <FormattingButton label="Corsivo" hint="Corsivo (Ctrl+I / ⌘I)" disabled={disabled || uploading} onPress={() => insert('_', '_')}><em aria-hidden="true" className="font-serif text-lg">I</em></FormattingButton>
      <FormattingButton label="Titolo" disabled={disabled || uploading} onPress={() => insert('## ', '', 'Titolo')}><span aria-hidden="true" className="font-bold">H₂</span></FormattingButton>
      <span aria-hidden="true" className="mx-1 h-6 border-l border-line" />
      <FormattingButton label="Link" hint="Inserisci link" disabled={disabled || uploading} onPress={() => insert('[', '](https://)', 'link')}><AdminIcon name="external" /></FormattingButton>
      <FormattingButton label="Elenco" hint="Elenco puntato" disabled={disabled || uploading} onPress={() => insert('\n- ', '', 'voce')}><AdminIcon name="list" /></FormattingButton>
      <FormattingButton label="Elenco numerato" disabled={disabled || uploading} onPress={() => insert('\n1. ', '', 'voce')}><span aria-hidden="true" className="font-mono font-bold">1.</span></FormattingButton>
      <FormattingButton label="Citazione" disabled={disabled || uploading} onPress={() => insert('\n> ', '', 'citazione')}><span aria-hidden="true" className="font-serif text-xl">“</span></FormattingButton>
      <FormattingButton label="Codice" hint="Codice inline" disabled={disabled || uploading} onPress={() => insert('`', '`', 'codice')}><span aria-hidden="true" className="font-mono">&lt;/&gt;</span></FormattingButton>
    </Toolbar>}
    <textarea ref={textarea} id="newsletter-markdown" rows={18} value={value} readOnly={readOnly} disabled={disabled || uploading} onChange={event => onChange(event.target.value)} onKeyDown={event => {
      if (!readOnly && !disabled && !uploading && (event.ctrlKey || event.metaKey) && !event.altKey && ['b', 'i'].includes(event.key.toLowerCase())) {
        event.preventDefault();
        const marker = event.key.toLowerCase() === 'b' ? '**' : '_';
        insert(marker, marker);
      }
    }} className={`${editorInput} font-mono text-sm leading-relaxed`} />
    {onUpload && !readOnly && <label className="block space-y-2 text-sm font-semibold">
      <span>{uploading ? 'Caricamento immagine…' : 'Carica immagine PNG o JPEG e inseriscila nel testo'}</span>
      <input type="file" accept="image/png,image/jpeg" disabled={disabled || uploading || uploadDisabled} onChange={event => { void upload(event.target.files?.[0]); event.target.value = ''; }} className="block min-h-11 max-w-full rounded-lg py-2 focus-visible:outline-3 focus-visible:outline-cyan-700" />
      {maxImageBytes != null && <span className="block font-normal text-muted">Massimo {Math.floor(maxImageBytes / 1024)} KB. Immagini esterne e HTML non sono ammessi; il logo viene aggiunto dal server.</span>}
    </label>}
  </div>;
}

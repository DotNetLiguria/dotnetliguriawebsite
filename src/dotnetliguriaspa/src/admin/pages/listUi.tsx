import React from 'react';
import { Button, Dialog, Heading, Input, Menu, MenuItem, MenuTrigger, Modal, ModalOverlay, Popover, SearchField, Separator } from 'react-aria-components';
import { AdminIcon } from '../icons';
import { btn, focusRing, linkFocus } from '../ui';

// List-page helpers shared by the venues, backup and questionnaires pages: table classes, the "…" row menu,
// the record modal (centred on desktop, full page on phones) and the confirmation dialog.

// Icons the shared kit does not have yet, on the same 24px grid and stroke as AdminIcon.
const EXTRA_PATHS = {
  copy: <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15h-.5A1.5 1.5 0 0 1 3 13.5v-9A1.5 1.5 0 0 1 4.5 3h9A1.5 1.5 0 0 1 15 4.5V5" /></>,
  archive: <><rect x="3.5" y="4" width="17" height="4.5" rx="1" /><path d="M5 8.5V19a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8.5M10 12.5h4" /></>,
  chart: <><path d="M4 20h16" /><path d="M7 16v-5M12 16V7M17 16v-8" /></>,
  restore: <><path d="M3.5 12a8.5 8.5 0 1 0 2.5-6" /><path d="M3.5 3.5V9H9" /><path d="M12 8v4.5l3 2" /></>,
} as const;

export type ExtraIconName = keyof typeof EXTRA_PATHS;

export function ExtraIcon({ name, className = 'size-5' }: { name: ExtraIconName; className?: string }) {
  return (
    <svg className={`${className} shrink-0`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {EXTRA_PATHS[name]}
    </svg>
  );
}

export const inputCls = 'w-full min-h-11 rounded-xl border border-line bg-white px-3.5 text-base text-navy placeholder:text-[#6b8399] transition-colors hover:border-cyan-200 outline-none focus:border-cyan-700 focus:ring-3 focus:ring-cyan-700/25 data-[invalid]:border-[#b42318]';

export const pill = `inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-full border border-line bg-white px-4 font-semibold text-navy transition-colors data-[hovered]:border-cyan-200 data-[selected]:border-navy data-[selected]:bg-navy data-[selected]:text-white ${focusRing}`;

export const table = {
  el: 'hidden w-full text-left md:table',
  head: 'border-b border-line text-sm text-muted',
  th: 'px-3 py-3 font-semibold first:pl-5 last:pr-5',
  body: 'divide-y divide-line',
  row: 'group transition-colors hover:bg-cyan-50/60 focus-within:bg-cyan-50/60',
  td: 'px-3 py-3 align-middle first:pl-5 last:pr-5',
  // Row actions appear on hover or keyboard focus; on touch screens (no hover) they stay visible.
  actions: 'flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 pointer-coarse:opacity-100 motion-reduce:transition-none',
  cards: 'divide-y divide-line md:hidden',
  footer: 'border-t border-line px-5 py-3 text-sm text-muted',
} as const;

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function SearchBox({ label, placeholder, value, onChange }: { label: string; placeholder: string; value: string; onChange: (value: string) => void }) {
  return (
    <SearchField aria-label={label} value={value} onChange={onChange} className="relative w-full sm:w-80">
      <span className="pointer-events-none absolute inset-y-0 left-3.5 grid place-items-center text-muted"><AdminIcon name="search" /></span>
      <Input placeholder={placeholder} className="min-h-11 w-full rounded-full border border-line bg-white pr-4 pl-11 text-base text-navy outline-none placeholder:text-[#6b8399] hover:border-cyan-200 focus:border-cyan-700 focus:ring-3 focus:ring-cyan-700/25 [&::-webkit-search-cancel-button]:hidden" />
    </SearchField>
  );
}

export function ExternalLink({ href, children, className = `inline-flex min-h-11 items-center gap-1.5 rounded-full font-semibold text-cyan-700 hover:underline ${linkFocus}` }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      <AdminIcon name="external" className="size-4" />{children}<span className="sr-only"> (si apre in una nuova scheda)</span>
    </a>
  );
}

export interface RowMenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  onAction: () => void;
  isDisabled?: boolean;
  destructive?: boolean;
}

/** "…" menu of a row: destructive items go last, in red, after a separator. */
export function RowMenu({ label, items }: { label: string; items: RowMenuItem[] }) {
  const ordered = [...items].sort((a, b) => Number(!!a.destructive) - Number(!!b.destructive));
  const firstDestructive = ordered.findIndex(item => item.destructive);
  return (
    <MenuTrigger>
      <Button aria-label={label} className={btn.icon}><AdminIcon name="more" /></Button>
      <Popover placement="bottom end" offset={4} className="min-w-56 rounded-xl border border-line bg-white p-1.5 shadow-lift outline-none">
        <Menu
          aria-label={label}
          className="outline-none"
          disabledKeys={ordered.filter(item => item.isDisabled).map(item => item.id)}
          onAction={key => ordered.find(item => item.id === key)?.onAction()}
        >
          {ordered.map((item, index) => (
            <React.Fragment key={item.id}>
              {index === firstDestructive && index > 0 && <Separator className="my-1 border-t border-line" />}
              <MenuItem
                id={item.id}
                textValue={item.label}
                className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 font-semibold outline-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 ${item.destructive ? 'text-[#b42318] data-[focused]:bg-[#fdecea]' : 'data-[focused]:bg-cyan-50'}`}
              >
                {item.icon}{item.label}
              </MenuItem>
            </React.Fragment>
          ))}
        </Menu>
      </Popover>
    </MenuTrigger>
  );
}

/** Record card: centred dialog on desktop, full page on phones. */
export function RecordModal({ isOpen, onOpenChange, label, children }: { isOpen: boolean; onOpenChange: (open: boolean) => void; label: string; children: React.ReactNode }) {
  return (
    <ModalOverlay isOpen={isOpen} onOpenChange={onOpenChange} isDismissable className="fixed inset-0 z-50 flex bg-[rgb(0_36_69/0.42)] sm:items-center sm:justify-center sm:p-6">
      <Modal className="h-dvh w-full overflow-y-auto bg-white text-navy shadow-lift sm:h-auto sm:max-h-[90dvh] sm:max-w-2xl sm:rounded-3xl">
        <Dialog aria-label={label} className="outline-none">{children}</Dialog>
      </Modal>
    </ModalOverlay>
  );
}

export function ModalHeader({ title, children, closeLabel = 'Chiudi' }: { title: React.ReactNode; children?: React.ReactNode; closeLabel?: string }) {
  return (
    <div className="flex items-start gap-4 border-b border-line p-5 sm:p-6">
      <div className="min-w-0 flex-1">
        <Heading slot="title" className="text-2xl font-bold leading-tight">{title}</Heading>
        {children}
      </div>
      <Button slot="close" aria-label={closeLabel} className={btn.icon}><AdminIcon name="x" /></Button>
    </div>
  );
}

/** Explicit confirmation before a destructive action; stays open while the action runs. */
export function ConfirmDialog({ isOpen, onOpenChange, title, children, confirmLabel, busyLabel, busy = false, onConfirm }: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
  confirmLabel: string;
  busyLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
}) {
  return (
    <ModalOverlay isOpen={isOpen} onOpenChange={onOpenChange} isDismissable={!busy} isKeyboardDismissDisabled={busy} className="fixed inset-0 z-50 flex items-center justify-center bg-[rgb(0_36_69/0.42)] p-4">
      <Modal className="w-full max-w-lg rounded-3xl bg-white p-6 text-navy shadow-lift">
        <Dialog role="alertdialog" aria-label={title} className="outline-none">
          <Heading slot="title" className="text-2xl font-bold text-[#b42318]">{title}</Heading>
          <div className="mt-2 space-y-2 leading-relaxed">{children}</div>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <Button slot="close" isDisabled={busy} className={btn.ghost} autoFocus>Annulla</Button>
            <Button onPress={onConfirm} isDisabled={busy} className={btn.danger}>{busy ? (busyLabel ?? confirmLabel) : confirmLabel}</Button>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

const noticeTone = {
  ok: 'bg-basil-50 text-basil-700',
  warn: 'bg-[#fff4e5] text-[#8a4b00]',
  danger: 'bg-[#fdecea] text-[#912018]',
} as const;

/** Inline notice (outcome of an action, warning on a record); errors are announced as alerts. */
export function Notice({ tone, title, children }: { tone: keyof typeof noticeTone; title: string; children?: React.ReactNode }) {
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={`rounded-xl p-4 ${noticeTone[tone]}`}>
      <p className="font-bold">{title}</p>
      {children && <div className="text-sm">{children}</div>}
    </div>
  );
}

export const Skeleton = ({ className = 'h-96' }: { className?: string }) => (
  <div className={`${className} animate-pulse rounded-2xl border border-line bg-white motion-reduce:animate-none`} aria-hidden="true" />
);

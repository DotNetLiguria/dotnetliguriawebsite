import React, { useEffect, useState } from 'react';
import { Button, Dialog, Menu, MenuItem, MenuTrigger, Modal, ModalOverlay, Popover, Separator } from 'react-aria-components';
import { AdminIcon, AdminIconName } from '../icons';
import { EmptyState, btn, focusRing, linkFocus } from '../ui';

// Building blocks shared by the ordered, record-card lists (Board, site menu): the same table/list
// rows, move buttons, row menu and full-page-on-phones card as the rest of the admin.

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// ---------- Ordering ----------

export interface Ordered { order?: number | null }

/** Display order: by `order`; ties keep the API order, exactly like the public site sorts them. */
export const byOrder = <T extends Ordered>(items: T[]) => [...items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

export interface OrderChange<T> { item: T; order: number }

/**
 * `order` values to save after moving the item at `from` to position `to` of a list already sorted by order.
 * Distinct values are reused by position (so a one-step move rewrites just two records and gaps survive);
 * a list with repeated values is renumbered from its lowest value so that the move is unambiguous.
 * Only records whose value actually changes are returned.
 */
export function planMove<T extends Ordered>(sorted: T[], from: number, to: number): OrderChange<T>[] {
  const next = [...sorted];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  const current = sorted.map(item => item.order ?? 0);
  const slots = new Set(current).size === current.length ? current : current.map((_, index) => current[0] + index);
  return next.flatMap((item, index) => ((item.order ?? 0) === slots[index] ? [] : [{ item, order: slots[index] }]));
}

// ---------- Responsive ----------

/** True from the md breakpoint up (tables); phones get stacked cards. Desktop when matchMedia is missing. */
export function useIsDesktop() {
  const query = '(min-width: 768px)';
  const read = () => typeof window.matchMedia !== 'function' || window.matchMedia(query).matches;
  const [desktop, setDesktop] = useState(read);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const list = window.matchMedia(query);
    const update = () => setDesktop(list.matches);
    update();
    list.addEventListener('change', update);
    return () => list.removeEventListener('change', update);
  }, []);
  return desktop;
}

// ---------- Icons missing from the admin set (same grid and stroke as AdminIcon) ----------

const GLYPHS = {
  up: <><path d="M12 19V5" /><path d="m6 11 6-6 6 6" /></>,
  down: <><path d="M12 5v14" /><path d="m6 13 6 6 6-6" /></>,
  eye: <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="2.8" /></>,
  eyeOff: <><path d="M9.9 5.7A9.4 9.4 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a15.7 15.7 0 0 1-2.6 3.4M6.3 7.3A15.6 15.6 0 0 0 2.5 12S6 18.5 12 18.5a9.2 9.2 0 0 0 4.1-.9" /><path d="M3.5 3.5l17 17" /><path d="M9.9 9.9a2.8 2.8 0 0 0 4.2 4.2" /></>,
} as const;

export function LocalIcon({ name, className = 'size-5' }: { name: keyof typeof GLYPHS; className?: string }) {
  return (
    <svg className={`${className} shrink-0`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {GLYPHS[name]}
    </svg>
  );
}

// ---------- Row controls ----------

const iconBase = 'inline-grid size-10 shrink-0 place-items-center rounded-full text-muted transition-colors pointer-coarse:size-11';
/** Icon button (react-aria Button). */
export const iconButton = `${iconBase} cursor-pointer data-[hovered]:bg-cyan-50 data-[hovered]:text-navy data-[disabled]:cursor-default data-[disabled]:opacity-35 ${focusRing}`;
/** Icon button that is a link. */
export const iconLink = `${iconBase} hover:bg-cyan-50 hover:text-navy ${linkFocus}`;
/** Row actions appear on hover or focus in tables (always on touch screens and while a menu is open). */
export const revealOnRow = 'transition-opacity md:opacity-0 md:group-hover/row:opacity-100 md:group-focus-within/row:opacity-100 md:group-has-[[aria-expanded=true]]/row:opacity-100 pointer-coarse:opacity-100';

export function MoveButtons({ id, name, index, count, disabled, onMove }: {
  id: string;
  name: string;
  index: number;
  count: number;
  disabled?: boolean;
  onMove: (delta: -1 | 1) => void;
}) {
  return (
    <span className="inline-flex items-center">
      <Button id={`move-${id}-up`} aria-label={`Sposta in alto: ${name}`} isDisabled={disabled || index === 0} onPress={() => onMove(-1)} className={iconButton}><LocalIcon name="up" /></Button>
      <Button id={`move-${id}-down`} aria-label={`Sposta in basso: ${name}`} isDisabled={disabled || index === count - 1} onPress={() => onMove(1)} className={iconButton}><LocalIcon name="down" /></Button>
    </span>
  );
}

/** After a move the rows are re-ordered and the browser drops focus: put it back on the button that was used. */
export function restoreMoveFocus(id: string, delta: -1 | 1) {
  const wanted = document.getElementById(`move-${id}-${delta < 0 ? 'up' : 'down'}`) as HTMLButtonElement | null;
  const other = document.getElementById(`move-${id}-${delta < 0 ? 'down' : 'up'}`) as HTMLButtonElement | null;
  (wanted && !wanted.disabled ? wanted : other)?.focus();
}

export interface RowMenuItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  onAction?: () => void;
  /** Opens in a new tab. */
  href?: string;
  /** Destructive: red, separated, and always last. */
  danger?: boolean;
}

const menuItem = 'flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 font-semibold outline-none data-[focused]:bg-cyan-50 data-[disabled]:opacity-50';
const menuDanger = 'flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 font-semibold text-[#b42318] outline-none data-[focused]:bg-[#fdecea]';

/** The "…" menu of a row; the destructive item, if any, goes last. */
export function RowMenu({ label, items }: { label: string; items: RowMenuItem[] }) {
  return (
    <MenuTrigger>
      <Button aria-label={label} className={iconButton}><AdminIcon name="more" /></Button>
      <Popover placement="bottom end" offset={4} className="min-w-60 rounded-xl border border-line bg-white p-1.5 shadow-lift outline-none">
        <Menu aria-label={label} className="outline-none">
          {items.flatMap((item, index) => [
            item.danger && index > 0 ? <Separator key={`${item.id}-separator`} className="my-1 h-px bg-line" /> : null,
            <MenuItem
              key={item.id}
              id={item.id}
              textValue={item.label}
              onAction={item.onAction}
              href={item.href}
              target={item.href ? '_blank' : undefined}
              rel={item.href ? 'noopener noreferrer' : undefined}
              className={item.danger ? menuDanger : menuItem}
            >
              <span className={item.danger ? undefined : 'text-muted'}>{item.icon}</span>
              {item.label}
              {item.href && <span className="sr-only"> (si apre in una nuova scheda)</span>}
            </MenuItem>,
          ])}
        </Menu>
      </Popover>
    </MenuTrigger>
  );
}

// ---------- Record card ----------

/** Centred on desktop, full page on phones. The label is explicit: react-aria reads the title slot only on first render. */
export function RecordDialog({ isOpen, onClose, label, children }: { isOpen: boolean; onClose: () => void; label: string; children: React.ReactNode }) {
  return (
    <ModalOverlay isOpen={isOpen} onOpenChange={open => { if (!open) onClose(); }} isDismissable className="fixed inset-0 z-50 flex bg-[rgb(0_36_69/0.42)] sm:items-center sm:justify-center sm:p-6">
      <Modal className="h-dvh w-full overflow-y-auto bg-white text-navy shadow-lift sm:h-auto sm:max-h-[90dvh] sm:max-w-2xl sm:rounded-3xl">
        <Dialog aria-label={label} className="outline-none">{children}</Dialog>
      </Modal>
    </ModalOverlay>
  );
}

/** Card body when the address points at a record that is not (yet) in the list. */
export function MissingCard({ listState, icon, title }: { listState: 'loading' | 'error' | 'ready'; icon: AdminIconName; title: string }) {
  return (
    <div className="p-6">
      <div className="flex justify-end"><Button slot="close" aria-label="Chiudi" className={btn.icon}><AdminIcon name="x" /></Button></div>
      {listState === 'loading' && <p role="status" className="py-10 text-center text-muted">Caricamento della scheda…</p>}
      {listState === 'error' && <EmptyState icon={icon} title="Scheda non disponibile"><p>L'elenco non si è caricato. Chiudi la scheda e riprova.</p></EmptyState>}
      {listState === 'ready' && <EmptyState icon={icon} title={title}><p>La scheda non esiste più o il link non è corretto.</p></EmptyState>}
    </div>
  );
}

import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Autocomplete, Dialog, Header, Input, Menu, MenuItem, MenuSection, Modal, ModalOverlay, SearchField, useFilter,
} from 'react-aria-components';
import { AdminIcon } from './icons';
import { AdminSpeaker, AdminWorkshop, clean, useAdminLoad } from './adminApi';
import { formatDate } from '../site/format';
import { useAccountCapabilities } from '../account/AccountCapabilities';

interface Command {
  id: string;
  label: string;
  meta?: string;
  to: string;
  external?: boolean;
}

const ACTIONS: Command[] = [
  { id: 'new-event', label: 'Nuovo evento', meta: 'Crea', to: '/admin/workshop/create' },
  { id: 'no-photo', label: 'Relatori senza foto', meta: 'Da sistemare', to: '/admin/speakers/?filtro=senza-foto' },
  { id: 'venues', label: 'Sedi', meta: 'Vai', to: '/admin/venues/' },
  { id: 'personal', label: 'Area personale', meta: 'Account e consensi', to: '/area-personale' },
  { id: 'site', label: 'Vedi il sito', meta: 'Si apre in una nuova scheda', to: '/', external: true },
];

const itemCls = 'flex cursor-pointer items-center justify-between gap-4 rounded-xl px-3 py-2.5 outline-none data-[focused]:bg-cyan-50';
const headerCls = 'px-3 pt-3 pb-1 text-sm font-semibold text-muted';

function Section({ title, items }: { title: string; items: Command[] }) {
  if (!items.length) return null;
  return (
    <MenuSection>
      <Header className={headerCls}>{title}</Header>
      {items.map(item => (
        <MenuItem key={item.id} id={item.id} textValue={`${item.label} ${item.meta ?? ''}`} className={itemCls}>
          <span className="font-semibold">{item.label}</span>
          {item.meta && <span className="truncate text-sm text-muted">{item.meta}</span>}
        </MenuItem>
      ))}
    </MenuSection>
  );
}

function PaletteContent({ close }: { close: () => void }) {
  const navigate = useNavigate();
  const { contains } = useFilter({ sensitivity: 'base' });
  const { capabilities } = useAccountCapabilities();
  const [workshops] = useAdminLoad<AdminWorkshop[]>('/Workshop/Get?onlyPublished=false');
  const [speakers] = useAdminLoad<AdminSpeaker[]>('/Speaker/Get');

  const events: Command[] = workshops.state === 'ready'
    ? [...workshops.data].sort((a, b) => b.eventDate.localeCompare(a.eventDate)).map(w => ({
      id: `event-${w.workshopId}`, label: clean(w.title), meta: [formatDate(w.eventDate), clean(w.location?.name)].filter(Boolean).join(' · '), to: `/admin/workshop/${w.workshopId}`,
    }))
    : [];
  const people: Command[] = speakers.state === 'ready'
    ? [...speakers.data].sort((a, b) => clean(a.name).localeCompare(clean(b.name), 'it')).map(s => ({
      id: `speaker-${s.workshopSpeakerId}`, label: clean(s.name), meta: 'Relatore', to: `/admin/speakers/${s.workshopSpeakerId}`,
    }))
    : [];
  const actions = capabilities?.privacyAdmin || capabilities?.notificationAdmin
    ? [...ACTIONS, { id: 'privacy', label: 'Privacy e avvisi', to: '/admin/privacy' }] : ACTIONS;
  const all = [...actions, ...events, ...people];

  return (
    <Autocomplete filter={contains}>
      <div className="flex items-center gap-3 border-b border-line px-4">
        <AdminIcon name="search" className="size-5 text-muted" />
        <SearchField aria-label="Cerca un evento, un relatore o un'azione" autoFocus className="flex-1">
          <Input placeholder="Cerca un evento, un relatore o un'azione" className="h-14 w-full bg-transparent text-lg text-navy outline-none placeholder:text-[#6b8399] [&::-webkit-search-cancel-button]:hidden" />
        </SearchField>
        <kbd className="rounded-md border border-line px-1.5 text-sm font-semibold text-muted">Esc</kbd>
      </div>
      <Menu
        aria-label="Risultati"
        className="max-h-[50vh] overflow-y-auto p-2 outline-none"
        onAction={key => {
          const item = all.find(i => i.id === key);
          if (!item) return;
          close();
          if (item.external) window.open(item.to, '_blank', 'noopener');
          else navigate(item.to);
        }}
        renderEmptyState={() => <p className="px-4 py-8 text-center text-muted">Nessun risultato.</p>}
      >
        <Section title="Azioni" items={actions} />
        <Section title="Eventi" items={events} />
        <Section title="Relatori" items={people} />
      </Menu>
      <p className="border-t border-line px-4 py-2.5 text-sm text-muted">↑ ↓ per scegliere · Invio per aprire</p>
    </Autocomplete>
  );
}

/** ⌘K / Ctrl+K: jump to any event or speaker, or run a common action. */
export default function CommandPalette({ isOpen, onOpenChange }: { isOpen: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <ModalOverlay isOpen={isOpen} onOpenChange={onOpenChange} isDismissable className="fixed inset-0 z-50 flex items-start justify-center bg-[rgb(0_36_69/0.42)] px-4">
      <Modal className="mt-[12vh] w-full max-w-[40rem] overflow-hidden rounded-2xl bg-white text-navy shadow-lift">
        <Dialog aria-label="Cerca e vai" className="outline-none">
          <PaletteContent close={() => onOpenChange(false)} />
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

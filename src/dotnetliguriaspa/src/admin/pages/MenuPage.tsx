import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PermissionGate, useCan } from '../../account/PermissionGate';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Button, Form, Heading } from 'react-aria-components';
import logo from '../../assets/logo/dotnet-liguria-storico.png';
import logo2x from '../../assets/logo/dotnet-liguria-storico-2x.png';
import { AdminIcon } from '../icons';
import { Badge, EmptyState, LoadError, PageHeader, Panel, SwitchInput, TextInput, btn, linkFocus } from '../ui';
import { AdminApiError, clean, useAdminFetch, useAdminLoad } from '../adminApi';
import { notify } from '../toasts';
import { AdminMenuItem, NEW_MENU_ITEM_ID, isMenuUrl, menuUrlError } from './menuModel';
import { LocalIcon, MissingCard, MoveButtons, RecordDialog, RowMenu, RowMenuItem, byOrder, iconLink, planMove, plural, restoreMoveFocus, revealOnRow, useIsDesktop } from './listKit';

const errorText = (error: unknown) => (error instanceof AdminApiError ? error.message : 'Errore di rete');
const nameOf = (item: AdminMenuItem) => clean(item.name) || 'Senza nome';

type Draft = { name: string; url: string; order: string; isActive: boolean };
const orderError = (value: string) => (/^\d+$/.test(value.trim()) ? null : 'Indica un numero intero, zero o maggiore.');

function MenuForm({ item, defaultOrder, onCancel, onSaved }: { item?: AdminMenuItem; defaultOrder: number; onCancel: () => void; onSaved: () => void }) {
  const api = useAdminFetch();
  const [draft, setDraft] = useState<Draft>(() => ({
    name: clean(item?.name), url: clean(item?.url), order: String(item?.order ?? defaultOrder), isActive: item?.isActive ?? true,
  }));
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof Draft>(key: K) => (value: Draft[K]) => setDraft(d => ({ ...d, [key]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    const fields = { name: clean(draft.name), url: clean(draft.url), order: Number(draft.order), isActive: draft.isActive };
    try {
      if (item) {
        await api(`/TopMenu/${item.topMenuElementId}`, { method: 'PUT', body: JSON.stringify({ ...item, ...fields }) });
        notify('Voce aggiornata', { description: fields.name });
      } else {
        await api('/TopMenu', { method: 'POST', body: JSON.stringify({ topMenuElementId: NEW_MENU_ITEM_ID, ...fields }) });
        notify('Voce creata', { description: fields.name });
      }
      onSaved();
    } catch (error) {
      notify('Salvataggio non riuscito', { description: errorText(error), kind: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Form onSubmit={submit} className="space-y-4">
      <TextInput label="Nome" isRequired value={draft.name} onChange={set('name')} autoFocus validate={value => (clean(value) ? null : 'Il nome è obbligatorio.')} description="Il testo che compare nel menu del sito." />
      <TextInput label="Indirizzo" isRequired value={draft.url} onChange={set('url')} placeholder="/workshops oppure /#team" validate={menuUrlError} description="Una pagina del sito, come /workshops, un punto della home, come /#team, oppure un indirizzo completo https://…" />
      <div className="grid items-start gap-4 sm:grid-cols-2">
        <TextInput label="Ordine" type="number" inputMode="numeric" isRequired value={draft.order} onChange={set('order')} validate={orderError} description="Il numero più basso viene per primo. Dall'elenco puoi anche usare le frecce." />
        <div className="sm:pt-[1.625rem]"><SwitchInput isSelected={draft.isActive} onChange={set('isActive')}>Attiva nel menu</SwitchInput></div>
      </div>
      <div className="flex flex-wrap justify-end gap-2 pt-2">
        <Button onPress={onCancel} className={btn.ghost}>Annulla</Button>
        <Button type="submit" isDisabled={saving} className={btn.primary}>{saving ? 'Salvataggio…' : 'Salva'}</Button>
      </div>
    </Form>
  );
}

type Mode = 'view' | 'edit' | 'delete';

function MenuCard({ item, position, count, initialMode, onChanged, onDeleted }: {
  item: AdminMenuItem;
  position: number;
  count: number;
  initialMode: Mode;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const can = useCan();
  const api = useAdminFetch();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [busy, setBusy] = useState(false);
  const name = nameOf(item);

  const remove = async () => {
    setBusy(true);
    try {
      await api(`/TopMenu/${item.topMenuElementId}`, { method: 'DELETE' });
      notify('Voce eliminata', { description: name });
      onDeleted();
    } catch (error) {
      notify('Eliminazione non riuscita', { description: errorText(error), kind: 'error' });
      setBusy(false);
    }
  };

  return (
    <>
      <div className="flex items-start gap-4 border-b border-line p-5 sm:p-6">
        <div className="min-w-0 flex-1">
          <Heading slot="title" className="text-2xl font-bold leading-tight">{name}</Heading>
          <p className="mt-1.5 flex flex-wrap gap-1.5">
            {item.isActive ? <Badge kind="ok">Attiva nel menu</Badge> : <Badge kind="done">Non attiva</Badge>}
          </p>
        </div>
        <Button slot="close" aria-label="Chiudi la scheda" className={btn.icon}><AdminIcon name="x" /></Button>
      </div>

      <div className="space-y-5 p-5 sm:p-6">
        {mode === 'edit' && can('site-menu.manage') ? (
          <MenuForm item={item} defaultOrder={item.order} onCancel={() => setMode('view')} onSaved={() => { setMode('view'); onChanged(); }} />
        ) : (
          <>
            <dl className="grid gap-4 sm:grid-cols-2">
              <div className="min-w-0">
                <dt className="text-sm font-semibold text-muted">Indirizzo</dt>
                <dd className="break-all">
                  {isMenuUrl(item.url) ? (
                    <a href={item.url} target="_blank" rel="noopener noreferrer" className={`font-bold text-cyan-700 underline ${linkFocus}`}>
                      {clean(item.url)}<span className="sr-only"> (si apre in una nuova scheda)</span>
                    </a>
                  ) : <>{clean(item.url) || '—'} <Badge kind="warn">Non valido</Badge></>}
                </dd>
              </div>
              <div><dt className="text-sm font-semibold text-muted">Posizione nel menu</dt><dd>{position} di {count} (ordine {item.order})</dd></div>
            </dl>
            {!item.isActive && (
              <p className="rounded-xl bg-[#eef3f7] p-4 text-muted">La voce non compare nel menu del sito finché non la attivi.</p>
            )}
            {mode === 'delete' && can('site-menu.delete') ? (
              <div role="alert" className="rounded-xl border border-[#b42318] p-4">
                <p className="font-bold text-[#b42318]">Eliminare {name}?</p>
                <p className="text-sm text-muted">La voce sparisce dal menu del sito. Se vuoi solo nasconderla, disattivala dalla scheda.</p>
                <div className="mt-3 flex flex-wrap justify-end gap-2">
                  <Button onPress={() => setMode('view')} className={btn.ghost} autoFocus>Annulla</Button>
                  <Button onPress={remove} isDisabled={busy} className={btn.danger}>{busy ? 'Eliminazione…' : 'Elimina'}</Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
                <Button isDisabled={!can('site-menu.delete')} onPress={() => setMode('delete')} className={`${btn.ghost} text-[#b42318] data-[hovered]:bg-[#fdecea]`}><AdminIcon name="trash" />Elimina…</Button>
                <Button isDisabled={!can('site-menu.manage')} onPress={() => setMode('edit')} className={btn.secondary}><AdminIcon name="pencil" />Modifica</Button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

/** The active entries as the public header lists them: same filter and sort as SiteHeader. */
function MenuPreview({ items }: { items: AdminMenuItem[] }) {
  const active = items.filter(item => item.isActive);
  return (
    <Panel className="mt-6 p-5" labelledBy="menu-preview-title">
      <h2 id="menu-preview-title" className="text-sm font-semibold text-muted">Anteprima nell'intestazione del sito</h2>
      <div className="mt-3 rounded-xl bg-[#f3f7fa] p-3">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-line bg-white px-4 py-2">
          <img src={logo} srcSet={`${logo} 1x, ${logo2x} 2x`} alt="" width={241} height={105} className="h-10 w-auto" />
          <ul aria-label="Voci attive nel menu" className="ml-auto flex flex-wrap items-center gap-1">
            {active.map(item => (
              <li key={item.topMenuElementId} className="inline-flex min-h-9 items-center rounded-full px-3 font-semibold text-navy">{nameOf(item)}</li>
            ))}
            <li aria-hidden="true" className="ml-2 inline-flex min-h-9 items-center rounded-full border-2 border-navy px-4 font-bold text-navy">Area Personale</li>
          </ul>
        </div>
      </div>
      {!active.length && <p className="mt-3 rounded-xl bg-[#fff4e5] p-3 text-[#8a4b00]">Nessuna voce attiva: il menu del sito resta vuoto.</p>}
    </Panel>
  );
}

interface RowsProps {
  items: AdminMenuItem[];
  busy: boolean;
  onMove: (index: number, delta: -1 | 1) => void;
  onToggle: (item: AdminMenuItem) => void;
  onDelete: (item: AdminMenuItem) => void;
}

const menuItems = (item: AdminMenuItem, { onToggle, onDelete }: Pick<RowsProps, 'onToggle' | 'onDelete'>): RowMenuItem[] => [
  ...(isMenuUrl(item.url) ? [{ id: 'open', label: 'Apri sul sito', icon: <AdminIcon name="external" />, href: clean(item.url) }] : []),
  {
    id: 'toggle',
    permission: 'site-menu.manage',
    label: item.isActive ? 'Disattiva' : 'Attiva',
    icon: <LocalIcon name={item.isActive ? 'eyeOff' : 'eye'} />,
    onAction: () => onToggle(item),
  },
  { id: 'delete', label: 'Elimina…', permission: 'site-menu.delete', icon: <AdminIcon name="trash" />, danger: true, onAction: () => onDelete(item) },
];

const nameLink = `block font-bold leading-snug after:absolute after:inset-0 hover:underline ${linkFocus}`;

function MenuTable({ items, busy, onMove, ...actions }: RowsProps) {
  return (
    <table className="w-full table-fixed text-left">
      <caption className="sr-only">Voci del menu del sito, nell'ordine in cui compaiono</caption>
      <thead className="border-b border-line text-sm text-muted">
        <tr>
          <th scope="col" className="w-36 py-3 pr-3 pl-5 font-semibold">Posizione</th>
          <th scope="col" className="px-3 font-semibold">Voce</th>
          <th scope="col" className="w-32 px-3 font-semibold">Nel menu</th>
          <th scope="col" className="w-28 pr-5"><span className="sr-only">Azioni</span></th>
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {items.map((item, index) => {
          const name = nameOf(item);
          return (
            <tr key={item.topMenuElementId} className="group/row relative transition-colors hover:bg-cyan-50/60">
              <td className="relative z-10 py-2 pr-3 pl-5">
                <span className="flex items-center gap-1">
                  <span className="w-6 text-right tabular-nums text-muted">{index + 1}</span>
                  <MoveButtons id={item.topMenuElementId} name={name} index={index} count={items.length} disabled={busy} onMove={delta => onMove(index, delta)} />
                </span>
              </td>
              <td className="px-3 py-3">
                <Link to={`/admin/topmenu/${item.topMenuElementId}`} className={nameLink}>{name}</Link>
                <span className="block truncate text-sm text-muted">{clean(item.url) || '—'}</span>
              </td>
              <td className="px-3">{item.isActive ? <span className="sr-only">Attiva</span> : <Badge kind="done">Non attiva</Badge>}</td>
              <td className="relative z-10 pr-5">
                <span className={`flex justify-end gap-1 ${revealOnRow}`}>
                  <Link to={`/admin/topmenu/${item.topMenuElementId}?azione=modifica`} className={iconLink} aria-label={`Modifica ${name}`}><AdminIcon name="pencil" /></Link>
                  <RowMenu label={`Altre azioni per ${name}`} items={menuItems(item, actions)} />
                </span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function MenuCards({ items, busy, onMove, ...actions }: RowsProps) {
  return (
    <ul className="divide-y divide-line">
      {items.map((item, index) => {
        const name = nameOf(item);
        return (
          <li key={item.topMenuElementId} className="relative p-4">
            <Link to={`/admin/topmenu/${item.topMenuElementId}`} className={nameLink}>{name}</Link>
            <span className="block truncate text-sm text-muted">{clean(item.url) || '—'}</span>
            {!item.isActive && <span className="mt-1.5 block"><Badge kind="done">Non attiva</Badge></span>}
            <div className="relative z-10 mt-2 flex items-center justify-between gap-2">
              <span className="flex items-center gap-1 text-sm text-muted">
                <span className="tabular-nums">{index + 1} di {items.length}</span>
                <MoveButtons id={item.topMenuElementId} name={name} index={index} count={items.length} disabled={busy} onMove={delta => onMove(index, delta)} />
              </span>
              <span className="flex gap-1">
                <Link to={`/admin/topmenu/${item.topMenuElementId}?azione=modifica`} className={iconLink} aria-label={`Modifica ${name}`}><AdminIcon name="pencil" /></Link>
                <RowMenu label={`Altre azioni per ${name}`} items={menuItems(item, actions)} />
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export default function MenuPage() {
  const can = useCan();
  const { id } = useParams<{ id?: string }>();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const api = useAdminFetch();
  const desktop = useIsDesktop();
  const [load, reload] = useAdminLoad<AdminMenuItem[]>('/TopMenu');
  const items = useMemo(() => (load.state === 'ready' ? byOrder(load.data) : null), [load]);
  // Locked from the first write until the reloaded list arrives, so that no move is planned on stale positions.
  const [lockedOn, setLockedOn] = useState<unknown>(null);
  const busy = lockedOn === load || !can('site-menu.manage');
  const [announcement, setAnnouncement] = useState('');
  const refocus = useRef<{ id: string; delta: -1 | 1 } | null>(null);

  useEffect(() => {
    if (!refocus.current) return;
    restoreMoveFocus(refocus.current.id, refocus.current.delta);
    refocus.current = null;
  }, [items]);

  const run = async (task: () => Promise<void>, failure: string) => {
    if (busy) return;
    setLockedOn(load);
    try {
      await task();
    } catch (error) {
      notify(failure, { description: errorText(error), kind: 'error' });
    } finally {
      reload();
    }
  };
  const put = (item: AdminMenuItem, patch: Partial<AdminMenuItem>) =>
    api(`/TopMenu/${item.topMenuElementId}`, { method: 'PUT', body: JSON.stringify({ ...item, ...patch }) });

  const move = (index: number, delta: -1 | 1) => {
    if (busy || !items || index + delta < 0 || index + delta >= items.length) return;
    const moved = items[index];
    refocus.current = { id: moved.topMenuElementId, delta };
    return run(async () => {
      await Promise.all(planMove(items, index, index + delta).map(change => put(change.item, { order: change.order })));
      setAnnouncement(`${nameOf(moved)} spostata in posizione ${index + delta + 1} di ${items.length}.`);
    }, 'Spostamento non riuscito');
  };

  const toggle = (item: AdminMenuItem) => run(async () => {
    await put(item, { isActive: !item.isActive });
    notify(item.isActive ? 'Voce disattivata' : 'Voce attivata', { description: nameOf(item) });
  }, 'Modifica non riuscita');

  const close = () => navigate('/admin/topmenu/');
  const selectedIndex = id && id !== 'new' && items ? items.findIndex(item => item.topMenuElementId === id) : -1;
  const selected = items && selectedIndex >= 0 ? items[selectedIndex] : undefined;
  const activeCount = items ? items.filter(item => item.isActive).length : 0;
  const nextOrder = items?.length ? Math.max(...items.map(item => item.order ?? 0)) + 1 : 0;
  const action = params.get('azione');
  const dialogLabel = id === 'new' ? 'Nuova voce del menu' : selected ? nameOf(selected) : 'Scheda della voce';

  return (
    <>
      <PageHeader
        title="Menu del sito"
        description={items ? `${plural(items.length, 'voce', 'voci')}, ${activeCount} ${activeCount === 1 ? 'attiva' : 'attive'}. Le voci attive compaiono nell'intestazione del sito, in quest'ordine.` : undefined}
        actions={<PermissionGate permission="site-menu.manage"><Link to="/admin/topmenu/new" className={btn.primary}><AdminIcon name="plus" />Nuova voce</Link></PermissionGate>}
      />
      <p role="status" aria-live="polite" className="sr-only">{announcement}</p>

      {load.state === 'error' && <div className="mt-6"><LoadError message={`Il menu non è disponibile (${load.message}).`} onRetry={reload} /></div>}
      {load.state === 'loading' && <div className="mt-6 h-72 animate-pulse rounded-2xl border border-line bg-white motion-reduce:animate-none" aria-hidden="true" />}
      {items && (
        <>
          <Panel className="mt-6 overflow-hidden">
            {items.length ? (
              <>
                {desktop
                  ? <MenuTable items={items} busy={busy} onMove={move} onToggle={toggle} onDelete={item => navigate(`/admin/topmenu/${item.topMenuElementId}?azione=elimina`)} />
                  : <MenuCards items={items} busy={busy} onMove={move} onToggle={toggle} onDelete={item => navigate(`/admin/topmenu/${item.topMenuElementId}?azione=elimina`)} />}
                <p className="border-t border-line px-5 py-3 text-sm text-muted">{activeCount} di {items.length} voci attive nel menu</p>
              </>
            ) : (
              <EmptyState icon="list" title="Nessuna voce nel menu"><p>Senza voci, l'intestazione del sito resta senza menu. Aggiungi la prima voce.</p></EmptyState>
            )}
          </Panel>
          <MenuPreview items={items} />
        </>
      )}

      <RecordDialog isOpen={!!id} onClose={close} label={dialogLabel}>
        {id === 'new' ? (
          <>
            <div className="flex items-center justify-between border-b border-line p-5 sm:p-6">
              <Heading slot="title" className="text-2xl font-bold">Nuova voce del menu</Heading>
              <Button slot="close" aria-label="Chiudi" className={btn.icon}><AdminIcon name="x" /></Button>
            </div>
            <div className="p-5 sm:p-6">
              {/* The form proposes the next free position, so it waits for the list. */}
              {load.state === 'loading'
                ? <p role="status" className="py-6 text-center text-muted">Caricamento del menu…</p>
                : <PermissionGate permission="site-menu.manage"><MenuForm defaultOrder={nextOrder} onCancel={close} onSaved={() => { reload(); close(); }} /></PermissionGate>}
            </div>
          </>
        ) : selected ? (
          <MenuCard
            key={`${selected.topMenuElementId}-${action ?? ''}`}
            item={selected}
            position={selectedIndex + 1}
            count={items?.length ?? 0}
            initialMode={action === 'modifica' ? 'edit' : action === 'elimina' ? 'delete' : 'view'}
            onChanged={reload}
            onDeleted={() => { reload(); close(); }}
          />
        ) : <MissingCard listState={load.state} icon="list" title="Voce non trovata" />}
      </RecordDialog>
    </>
  );
}

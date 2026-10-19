import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PermissionGate, useCan } from '../../account/PermissionGate';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Button, Form, Heading } from 'react-aria-components';
import { AdminIcon } from '../icons';
import { Avatar, Badge, EmptyState, LoadError, PageHeader, Panel, SwitchInput, TextAreaInput, TextInput, btn, linkFocus } from '../ui';
import { AdminApiError, clean, useAdminFetch, useAdminLoad } from '../adminApi';
import { notify } from '../toasts';
import { AdminBoardMember, LINKS, LinkKey, boardPhoto, isWebUrl, linkError } from './boardModel';
import { LocalIcon, MissingCard, MoveButtons, RecordDialog, RowMenu, RowMenuItem, byOrder, iconLink, planMove, plural, restoreMoveFocus, revealOnRow, useIsDesktop } from './listKit';

const errorText = (error: unknown) => (error instanceof AdminApiError ? error.message : 'Errore di rete');
const isVisible = (member: AdminBoardMember) => member.isActive !== false;
const nameOf = (member: AdminBoardMember) => clean(member.name) || 'Senza nome';
const roleOf = (member: AdminBoardMember) => clean(member.description);
const orNull = (text: string) => clean(text) || null;
const paragraphs = (text: string) => text.trim() || null;

type Draft = {
  name: string; description: string; email: string; shortBio: string; fullBio: string; profileImageUrl: string;
  order: string; isActive: boolean;
} & Record<LinkKey, string>;

const draftOf = (member?: AdminBoardMember): Draft => ({
  name: clean(member?.name), description: clean(member?.description), email: clean(member?.email),
  shortBio: member?.shortBio ?? '', fullBio: member?.fullBio ?? '', profileImageUrl: clean(member?.profileImageUrl),
  order: String(member?.order ?? 0), isActive: member ? isVisible(member) : true,
  blogHtml: clean(member?.blogHtml), lInkedinUrl: clean(member?.lInkedinUrl), gitHubUrl: clean(member?.gitHubUrl),
  twitterUrl: clean(member?.twitterUrl), faceboookUrl: clean(member?.faceboookUrl), instagramUrl: clean(member?.instagramUrl),
});

const orderError = (value: string) => (/^\d+$/.test(value.trim()) ? null : 'Indica un numero intero, zero o maggiore.');

/** One form, one save: the whole record goes back, with the fields the form does not show left as they were. */
function BoardForm({ member, initialOrder = 0, onCancel, onSaved }: {
  member?: AdminBoardMember;
  initialOrder?: number;
  onCancel: () => void;
  onSaved: (id: string) => void;
}) {
  const api = useAdminFetch();
  const [draft, setDraft] = useState<Draft>(() => ({ ...draftOf(member), order: String(member?.order ?? initialOrder) }));
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof Draft>(key: K) => (value: Draft[K]) => setDraft(d => ({ ...d, [key]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    const body = {
      ...(member ?? {}),
      name: clean(draft.name), description: orNull(draft.description), email: orNull(draft.email),
      shortBio: paragraphs(draft.shortBio), fullBio: paragraphs(draft.fullBio), profileImageUrl: orNull(draft.profileImageUrl),
      order: Number(draft.order), isActive: draft.isActive,
      ...Object.fromEntries(LINKS.map(link => [link.key, orNull(draft[link.key])])),
    };
    try {
      if (member) {
        await api(`/Board/Update/${member.boardId}`, { method: 'PUT', body: JSON.stringify(body) });
        notify('Membro aggiornato', { description: body.name });
        onSaved(member.boardId);
      } else {
        const created = await api<AdminBoardMember>('/Board/Post', { method: 'POST', body: JSON.stringify(body) });
        notify('Membro creato', { description: body.name });
        onSaved(created?.boardId ?? '');
      }
    } catch (error) {
      notify('Salvataggio non riuscito', { description: errorText(error), kind: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Form onSubmit={submit} className="space-y-4">
      <TextInput label="Nome" isRequired value={draft.name} onChange={set('name')} autoFocus validate={value => (clean(value) ? null : 'Il nome è obbligatorio.')} />
      <TextInput label="Ruolo" value={draft.description} onChange={set('description')} placeholder="Presidente, Consigliere…" description="Compare sotto il nome nella scheda del team sul sito." />
      <TextInput label="Email" type="email" value={draft.email} onChange={set('email')} />
      <TextAreaInput label="Presentazione breve" rows={3} value={draft.shortBio} onChange={set('shortBio')} description="Compare nella scheda del team sul sito; se manca si usa la biografia completa." />
      <TextAreaInput label="Biografia completa" rows={5} value={draft.fullBio} onChange={set('fullBio')} />
      <TextInput label="Foto" value={draft.profileImageUrl} onChange={set('profileImageUrl')} placeholder="profile/nome-cognome.jpg oppure https://…" description="Percorso sotto /Contents o indirizzo completo. Il caricamento diretto della foto è da completare." />
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-navy">Blog e social</legend>
        <p className="text-sm text-muted">Indirizzi completi che iniziano con https://. Sul sito compaiono solo quelli compilati.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {LINKS.map(link => (
            <TextInput key={link.key} label={link.label} type="url" inputMode="url" value={draft[link.key]} onChange={set(link.key)} placeholder={link.placeholder} validate={linkError} />
          ))}
        </div>
      </fieldset>
      <div className="grid items-start gap-4 sm:grid-cols-2">
        <TextInput label="Ordine" type="number" inputMode="numeric" isRequired value={draft.order} onChange={set('order')} validate={orderError} description="Il numero più basso viene per primo. Dall'elenco puoi anche usare le frecce." />
        <div className="sm:pt-[1.625rem]"><SwitchInput isSelected={draft.isActive} onChange={set('isActive')}>Visibile sul sito</SwitchInput></div>
      </div>
      <div className="flex flex-wrap justify-end gap-2 pt-2">
        <Button onPress={onCancel} className={btn.ghost}>Annulla</Button>
        <Button type="submit" isDisabled={saving} className={btn.primary}>{saving ? 'Salvataggio…' : 'Salva'}</Button>
      </div>
    </Form>
  );
}

function Detail({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-muted">{title}</h3>
      <div className="mt-1 max-w-[65ch] leading-relaxed whitespace-pre-line">{children}</div>
    </div>
  );
}

const none = (text: string) => <span className="text-muted">{text}</span>;

function BoardCard({ member, position, count, initialMode, onChanged, onDeleted }: {
  member: AdminBoardMember;
  position: number;
  count: number;
  initialMode: 'view' | 'edit';
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const can = useCan();
  const api = useAdminFetch();
  const [mode, setMode] = useState(initialMode);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const name = nameOf(member);
  const role = roleOf(member);
  const photo = boardPhoto(member.profileImageUrl);
  const links = LINKS.map(link => ({ ...link, value: clean(member[link.key] as string | null | undefined) })).filter(link => link.value);

  return (
    <>
      <div className="flex items-start gap-4 border-b border-line p-5 sm:p-6">
        <Avatar name={name} src={photo} className="size-20 text-2xl" />
        <div className="min-w-0 flex-1">
          <Heading slot="title" className="text-2xl font-bold leading-tight">{name}</Heading>
          {role && <p className="font-bold text-basil-700">{role}</p>}
          <p className="mt-1.5 flex flex-wrap gap-1.5">
            {isVisible(member) ? <Badge kind="ok">Visibile sul sito</Badge> : <Badge kind="done">Nascosto dal sito</Badge>}
            {!photo && <Badge kind="warn">Senza foto</Badge>}
          </p>
        </div>
        <Button slot="close" aria-label="Chiudi la scheda" className={btn.icon}><AdminIcon name="x" /></Button>
      </div>

      <div className="space-y-5 p-5 sm:p-6">
        {mode === 'edit' && can('board.manage') ? (
          <BoardForm member={member} onCancel={() => setMode('view')} onSaved={() => { setMode('view'); onChanged(); }} />
        ) : (
          <>
            {!photo && (
              <div className="rounded-xl bg-[#fff4e5] p-4 text-[#8a4b00]">
                <p className="font-bold">Manca la foto</p>
                <p className="text-sm">Sul sito compare con le iniziali. Indica il percorso della foto in Modifica; il caricamento diretto è da completare.</p>
              </div>
            )}
            <Detail title="Presentazione breve">{clean(member.shortBio) ? member.shortBio : none('Nessuna presentazione breve.')}</Detail>
            <Detail title="Biografia completa">{clean(member.fullBio) ? member.fullBio : none('Nessuna biografia.')}</Detail>
            <div>
              <h3 className="text-sm font-semibold text-muted">Blog e social</h3>
              {links.length ? (
                <ul className="mt-1 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
                  {links.map(link => (
                    <li key={link.key} className="min-w-0">
                      <span className="block text-sm text-muted">{link.label}</span>
                      {isWebUrl(link.value) ? (
                        <a href={link.value} target="_blank" rel="noopener noreferrer" className={`break-all font-bold text-cyan-700 underline ${linkFocus}`}>
                          {link.value}<span className="sr-only"> (si apre in una nuova scheda)</span>
                        </a>
                      ) : (
                        <span className="break-all">{link.value} <Badge kind="warn">Non valido</Badge></span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : <p className="mt-1 text-muted">Nessun link indicato.</p>}
            </div>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="font-semibold text-muted">Email</dt><dd className="break-all">{clean(member.email) || '—'}</dd></div>
              <div><dt className="font-semibold text-muted">Posizione nel team</dt><dd>{position} di {count} (ordine {member.order ?? 0})</dd></div>
            </dl>
            {confirmDelete && (
              <div role="alert" className="rounded-xl border border-[#b42318] p-4">
                <p className="font-bold text-[#b42318]">Eliminare {name}?</p>
                <p className="text-sm text-muted">Il membro viene rimosso dal database e dalla sezione Team del sito.</p>
                <div className="mt-3 flex flex-wrap justify-end gap-2">
                  <Button onPress={() => setConfirmDelete(false)} className={btn.ghost} autoFocus>Annulla</Button>
                  <Button
                    onPress={async () => {
                      setDeleting(true);
                      try {
                        await api(`/Board/Delete/${member.boardId}`, { method: 'DELETE' });
                        notify('Membro eliminato', { description: name });
                        onDeleted();
                      } catch (error) {
                        notify('Eliminazione non riuscita', { description: errorText(error), kind: 'error' });
                        setDeleting(false);
                      }
                    }}
                    isDisabled={deleting}
                    className={btn.danger}
                  >
                    {deleting ? 'Eliminazione…' : 'Elimina'}
                  </Button>
                </div>
              </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
              <Button isDisabled={!can('board.delete')} onPress={() => setConfirmDelete(true)} className={`${btn.ghost} text-[#b42318] data-[hovered]:bg-[#fdecea]`}><AdminIcon name="trash" />Elimina…</Button>
              <Button isDisabled={!can('board.manage')} onPress={() => setMode('edit')} className={btn.secondary}><AdminIcon name="pencil" />Modifica</Button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

interface RowsProps {
  members: AdminBoardMember[];
  busy: boolean;
  onMove: (index: number, delta: -1 | 1) => void;
  onToggle: (member: AdminBoardMember) => void;
}

const menuItems = (member: AdminBoardMember, onToggle: (member: AdminBoardMember) => void): RowMenuItem[] => [
  {
    id: 'toggle',
    permission: 'board.manage',
    label: isVisible(member) ? 'Nascondi dal sito' : 'Mostra sul sito',
    icon: <LocalIcon name={isVisible(member) ? 'eyeOff' : 'eye'} />,
    onAction: () => onToggle(member),
  },
  { id: 'site', label: 'Vedi il team sul sito', icon: <AdminIcon name="external" />, href: '/#team' },
];

const nameLink = `block font-bold leading-snug after:absolute after:inset-0 hover:underline ${linkFocus}`;

function BoardTable({ members, busy, onMove, onToggle }: RowsProps) {
  return (
    <table className="w-full table-fixed text-left">
      <caption className="sr-only">Membri del board, nell'ordine in cui compaiono sul sito</caption>
      <thead className="border-b border-line text-sm text-muted">
        <tr>
          <th scope="col" className="w-36 py-3 pr-3 pl-5 font-semibold">Posizione</th>
          <th scope="col" className="px-3 font-semibold">Membro</th>
          <th scope="col" className="hidden w-60 px-3 font-semibold xl:table-cell">Email</th>
          <th scope="col" className="w-28 px-3 font-semibold">Sul sito</th>
          <th scope="col" className="w-28 pr-5"><span className="sr-only">Azioni</span></th>
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {members.map((member, index) => {
          const name = nameOf(member);
          return (
            <tr key={member.boardId} className="group/row relative transition-colors hover:bg-cyan-50/60">
              <td className="relative z-10 py-2 pr-3 pl-5">
                <span className="flex items-center gap-1">
                  <span className="w-6 text-right tabular-nums text-muted">{index + 1}</span>
                  <MoveButtons id={member.boardId} name={name} index={index} count={members.length} disabled={busy} onMove={delta => onMove(index, delta)} />
                </span>
              </td>
              <td className="px-3 py-3">
                <div className="flex items-center gap-3">
                  <Avatar name={name} src={boardPhoto(member.profileImageUrl)} />
                  <span className="min-w-0">
                    <Link to={`/admin/board/${member.boardId}`} className={nameLink}>{name}</Link>
                    <span className="block text-sm text-muted">{roleOf(member) || 'Ruolo da indicare'}</span>
                  </span>
                </div>
              </td>
              <td className="hidden px-3 text-muted xl:table-cell"><span className="block truncate">{clean(member.email) || '—'}</span></td>
              <td className="px-3">{isVisible(member) ? <span className="sr-only">Visibile</span> : <Badge kind="done">Nascosto</Badge>}</td>
              <td className="relative z-10 pr-5">
                <span className={`flex justify-end gap-1 ${revealOnRow}`}>
                  <Link to={`/admin/board/${member.boardId}?azione=modifica`} className={iconLink} aria-label={`Modifica ${name}`}><AdminIcon name="pencil" /></Link>
                  <RowMenu label={`Altre azioni per ${name}`} items={menuItems(member, onToggle)} />
                </span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function BoardCards({ members, busy, onMove, onToggle }: RowsProps) {
  return (
    <ul className="divide-y divide-line">
      {members.map((member, index) => {
        const name = nameOf(member);
        return (
          <li key={member.boardId} className="relative p-4">
            <div className="flex items-start gap-3">
              <Avatar name={name} src={boardPhoto(member.profileImageUrl)} />
              <span className="min-w-0 flex-1">
                <Link to={`/admin/board/${member.boardId}`} className={nameLink}>{name}</Link>
                <span className="block text-sm text-muted">{roleOf(member) || 'Ruolo da indicare'}</span>
                {!isVisible(member) && <span className="mt-1.5 block"><Badge kind="done">Nascosto</Badge></span>}
              </span>
            </div>
            <div className="relative z-10 mt-2 flex items-center justify-between gap-2">
              <span className="flex items-center gap-1 text-sm text-muted">
                <span className="tabular-nums">{index + 1} di {members.length}</span>
                <MoveButtons id={member.boardId} name={name} index={index} count={members.length} disabled={busy} onMove={delta => onMove(index, delta)} />
              </span>
              <span className="flex gap-1">
                <Link to={`/admin/board/${member.boardId}?azione=modifica`} className={iconLink} aria-label={`Modifica ${name}`}><AdminIcon name="pencil" /></Link>
                <RowMenu label={`Altre azioni per ${name}`} items={menuItems(member, onToggle)} />
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export default function BoardPage() {
  const can = useCan();
  const { id } = useParams<{ id?: string }>();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const api = useAdminFetch();
  const desktop = useIsDesktop();
  const [load, reload] = useAdminLoad<AdminBoardMember[]>('/Board/Get');
  const members = useMemo(() => (load.state === 'ready' ? byOrder(load.data) : null), [load]);
  // Locked from the first write until the reloaded list arrives, so that no move is planned on stale positions.
  const [lockedOn, setLockedOn] = useState<unknown>(null);
  const busy = lockedOn === load || !can('board.manage');
  const [announcement, setAnnouncement] = useState('');
  const refocus = useRef<{ id: string; delta: -1 | 1 } | null>(null);

  useEffect(() => {
    if (!refocus.current) return;
    restoreMoveFocus(refocus.current.id, refocus.current.delta);
    refocus.current = null;
  }, [members]);

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
  const put = (member: AdminBoardMember, patch: Partial<AdminBoardMember>) =>
    api(`/Board/Update/${member.boardId}`, { method: 'PUT', body: JSON.stringify({ ...member, ...patch }) });

  const move = (index: number, delta: -1 | 1) => {
    if (busy || !members || index + delta < 0 || index + delta >= members.length) return;
    const moved = members[index];
    refocus.current = { id: moved.boardId, delta };
    return run(async () => {
      await Promise.all(planMove(members, index, index + delta).map(change => put(change.item, { order: change.order })));
      setAnnouncement(`${nameOf(moved)} spostato in posizione ${index + delta + 1} di ${members.length}.`);
    }, 'Spostamento non riuscito');
  };

  const toggle = (member: AdminBoardMember) => run(async () => {
    await put(member, { isActive: !isVisible(member) });
    notify(isVisible(member) ? 'Membro nascosto dal sito' : 'Membro visibile sul sito', { description: nameOf(member) });
  }, 'Modifica non riuscita');

  const close = () => navigate('/admin/board/');
  const selectedIndex = id && members ? members.findIndex(member => member.boardId === id) : -1;
  const selected = members && selectedIndex >= 0 ? members[selectedIndex] : undefined;
  const visibleCount = members ? members.filter(isVisible).length : 0;

  return (
    <>
      <PageHeader
        title="Board"
        description={members ? `${plural(members.length, 'membro', 'membri')}. L'ordine dell'elenco è quello della sezione Team del sito.` : undefined}
        actions={
          <>
            <PermissionGate permission="board.manage"><Link to="/admin/board/new" className={btn.primary}><AdminIcon name="plus" />Nuovo membro</Link></PermissionGate>
            <a href="/#team" target="_blank" rel="noopener noreferrer" className={btn.secondary}>Vedi il team sul sito<span className="sr-only"> (si apre in una nuova scheda)</span><AdminIcon name="external" /></a>
          </>
        }
      />
      <p role="status" aria-live="polite" className="sr-only">{announcement}</p>

      {load.state === 'error' && <div className="mt-6"><LoadError message={`Il board non è disponibile (${load.message}).`} onRetry={reload} /></div>}
      {load.state === 'loading' && <div className="mt-6 h-96 animate-pulse rounded-2xl border border-line bg-white motion-reduce:animate-none" aria-hidden="true" />}
      {members && (
        <Panel className="mt-6 overflow-hidden">
          {members.length ? (
            <>
              {desktop
                ? <BoardTable members={members} busy={busy} onMove={move} onToggle={toggle} />
                : <BoardCards members={members} busy={busy} onMove={move} onToggle={toggle} />}
              <p className="border-t border-line px-5 py-3 text-sm text-muted">{visibleCount} di {members.length} membri visibili sul sito</p>
            </>
          ) : (
            <EmptyState icon="users" title="Nessun membro del board"><p>Non ci sono ancora membri nel database.</p></EmptyState>
          )}
        </Panel>
      )}

      <RecordDialog isOpen={!!id} onClose={close} label={id === 'new' ? 'Nuovo membro del board' : selected ? nameOf(selected) : 'Scheda del membro'}>
        {id === 'new' ? (
          <>
            <div className="flex items-center justify-between border-b border-line p-5 sm:p-6">
              <Heading slot="title" className="text-2xl font-bold">Nuovo membro del board</Heading>
              <Button slot="close" aria-label="Chiudi" className={btn.icon}><AdminIcon name="x" /></Button>
            </div>
            <div className="p-5 sm:p-6" inert={!can('board.manage')}>
              <BoardForm
                initialOrder={(members ?? []).reduce((order, member) => Math.max(order, member.order ?? 0), 0) + 1}
                onCancel={close}
                onSaved={newId => { reload(); navigate(newId ? `/admin/board/${newId}` : '/admin/board/'); }}
              />
            </div>
          </>
        ) : selected ? (
          <BoardCard
            key={`${selected.boardId}-${params.get('azione') ?? ''}`}
            member={selected}
            position={selectedIndex + 1}
            count={members?.length ?? 0}
            initialMode={params.get('azione') === 'modifica' ? 'edit' : 'view'}
            onChanged={reload}
            onDeleted={() => { reload(); close(); }}
          />
        ) : <MissingCard listState={load.state} icon="users" title="Membro non trovato" />}
      </RecordDialog>
    </>
  );
}

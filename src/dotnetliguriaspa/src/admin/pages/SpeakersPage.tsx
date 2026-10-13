import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Button, Dialog, Form, Heading, Input, Modal, ModalOverlay, SearchField, ToggleButton, ToggleButtonGroup } from 'react-aria-components';
import { AdminIcon } from '../icons';
import { Avatar, Badge, EmptyState, LoadError, PageHeader, Panel, SwitchInput, TextAreaInput, TextInput, btn, focusRing, linkFocus } from '../ui';
import { AdminApiError, AdminSpeaker, AdminWorkshop, clean, nameKey, useAdminFetch, useAdminLoad, useSpeakerPhotos } from '../adminApi';
import { notify } from '../toasts';
import { formatDate } from '../../site/format';
import { programme } from '../../site/event/programme';

interface Talk { title: string; workshopId: string; event: string; date: string }

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const pill = `inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-full border border-line bg-white px-4 font-semibold text-navy transition-colors data-[hovered]:border-cyan-200 data-[selected]:border-navy data-[selected]:bg-navy data-[selected]:text-white ${focusRing}`;
const errorText = (error: unknown) => error instanceof AdminApiError
  ? error.status === 409 ? 'Esiste già un relatore con questo nome.' : error.message
  : 'Errore di rete';

function talksBySpeaker(workshops: AdminWorkshop[]) {
  const map = new Map<string, Talk[]>();
  for (const w of [...workshops].sort((a, b) => b.eventDate.localeCompare(a.eventDate))) {
    for (const entry of programme(w)) {
      for (const speaker of entry.speakers) {
        const key = nameKey(speaker.name);
        map.set(key, [...(map.get(key) ?? []), { title: entry.title, workshopId: w.workshopId, event: clean(w.title), date: w.eventDate }]);
      }
    }
  }
  return map;
}

type Draft = { name: string; email: string; description: string; profileImageUrl: string; isActive: boolean };
const draftOf = (s?: AdminSpeaker): Draft => ({
  name: clean(s?.name), email: clean(s?.email), description: s?.description ?? '', profileImageUrl: s?.profileImageUrl ?? '', isActive: s?.isActive ?? true,
});

function SpeakerForm({ speaker, onCancel, onSaved }: { speaker?: AdminSpeaker; onCancel: () => void; onSaved: (id: string) => void }) {
  const api = useAdminFetch();
  const [draft, setDraft] = useState<Draft>(() => draftOf(speaker));
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof Draft>(key: K) => (value: Draft[K]) => setDraft(d => ({ ...d, [key]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    const body = { ...(speaker ?? {}), ...draft, name: clean(draft.name), email: clean(draft.email) || null, profileImageUrl: clean(draft.profileImageUrl) || null };
    try {
      if (speaker) {
        await api(`/Speaker/Update/${speaker.workshopSpeakerId}`, { method: 'PUT', body: JSON.stringify(body) });
        notify('Relatore aggiornato', { description: clean(draft.name) });
        onSaved(speaker.workshopSpeakerId);
      } else {
        const created = await api<AdminSpeaker>('/Speaker/Post', { method: 'POST', body: JSON.stringify(body) });
        notify('Relatore creato', { description: clean(draft.name) });
        onSaved(created?.workshopSpeakerId ?? '');
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
      <TextInput label="Email" type="email" value={draft.email} onChange={set('email')} description="Resta nell'amministrazione: non compare sul sito." />
      <TextAreaInput label="Biografia" rows={5} value={draft.description} onChange={set('description')} description="Due o tre righe in terza persona." />
      <TextInput label="Foto" value={draft.profileImageUrl} onChange={set('profileImageUrl')} placeholder="speakers/nome_cognome.jpg oppure https://…" description="Percorso sotto /Contents o indirizzo completo. Il caricamento diretto della foto è da completare." />
      <SwitchInput isSelected={draft.isActive} onChange={set('isActive')}>Attivo</SwitchInput>
      <div className="flex flex-wrap justify-end gap-2 pt-2">
        <Button onPress={onCancel} className={btn.ghost}>Annulla</Button>
        <Button type="submit" isDisabled={saving} className={btn.primary}>{saving ? 'Salvataggio…' : 'Salva'}</Button>
      </div>
    </Form>
  );
}

function SpeakerCard({ speaker, photo, talks, duplicates, onChanged, onDeleted }: {
  speaker: AdminSpeaker;
  photo: string | null | undefined;
  talks: Talk[];
  duplicates: AdminSpeaker[];
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const api = useAdminFetch();
  const [mode, setMode] = useState<'view' | 'edit' | 'delete'>('view');
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState(speaker.isActive !== false);
  // The card stays mounted across reloads: follow the saved state after an edit from the form.
  useEffect(() => setActive(speaker.isActive !== false), [speaker.isActive]);
  const name = clean(speaker.name);

  const toggleActive = async (next: boolean) => {
    setActive(next);
    try {
      await api(`/Speaker/Update/${speaker.workshopSpeakerId}`, { method: 'PUT', body: JSON.stringify({ ...speaker, isActive: next }) });
      notify(next ? 'Relatore attivato' : 'Relatore disattivato', { description: name });
      onChanged();
    } catch (error) {
      setActive(!next);
      notify('Modifica non riuscita', { description: errorText(error), kind: 'error' });
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await api(`/Speaker/Delete/${speaker.workshopSpeakerId}`, { method: 'DELETE' });
      notify('Relatore eliminato', { description: name });
      onDeleted();
    } catch (error) {
      notify('Eliminazione non riuscita', { description: errorText(error), kind: 'error' });
      setBusy(false);
    }
  };

  return (
    <>
      <div className="flex items-start gap-4 border-b border-line p-5 sm:p-6">
        <Avatar name={name} src={photo} className="size-20 text-2xl" />
        <div className="min-w-0 flex-1">
          <Heading slot="title" className="text-2xl font-bold leading-tight">{name}</Heading>
          <p className="mt-1.5 flex flex-wrap gap-1.5">
            {!active ? <Badge kind="done">Non attivo</Badge> : <Badge kind="ok">Attivo</Badge>}
            {photo === null && <Badge kind="warn">Senza foto</Badge>}
            {duplicates.length > 0 && <Badge kind="warn">Doppione?</Badge>}
          </p>
        </div>
        <Button slot="close" aria-label="Chiudi la scheda" className={btn.icon}><AdminIcon name="x" /></Button>
      </div>

      <div className="space-y-5 p-5 sm:p-6">
        {mode === 'edit' ? (
          <SpeakerForm speaker={speaker} onCancel={() => setMode('view')} onSaved={() => { setMode('view'); onChanged(); }} />
        ) : (
          <>
            {duplicates.length > 0 && (
              <div className="rounded-xl bg-[#fff4e5] p-4 text-[#8a4b00]">
                <p className="font-bold">Possibile doppione</p>
                <p className="text-sm">Ci sono altre schede con questo nome: {duplicates.map((d, i) => (
                  <React.Fragment key={d.workshopSpeakerId}>{i > 0 && ', '}<Link to={`/admin/speakers/${d.workshopSpeakerId}`} className={`font-bold underline ${linkFocus}`}>apri l'altra scheda</Link></React.Fragment>
                ))}. Tieni quella più completa ed elimina l'altra.</p>
              </div>
            )}
            {photo === null && (
              <div className="rounded-xl bg-[#fff4e5] p-4 text-[#8a4b00]">
                <p className="font-bold">Manca la foto</p>
                <p className="text-sm">Sul sito compare con le iniziali. Indica il percorso della foto in Modifica; il caricamento diretto è da completare.</p>
              </div>
            )}
            <div>
              <h3 className="text-sm font-semibold text-muted">Biografia</h3>
              <p className="mt-1 max-w-[65ch] leading-relaxed whitespace-pre-line">{clean(speaker.description) ? speaker.description : <span className="text-muted">Nessuna biografia.</span>}</p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-muted">Talk ({talks.length})</h3>
              {talks.length ? (
                <ul className="mt-1 divide-y divide-line">
                  {talks.slice(0, 12).map((t, i) => (
                    <li key={`${t.workshopId}-${i}`}>
                      <Link to={`/admin/workshop/${t.workshopId}`} className={`block rounded-lg py-2.5 hover:underline ${linkFocus}`}>
                        <span className="block font-semibold">{t.title}</span>
                        <span className="block text-sm text-muted">{t.event} · {formatDate(t.date)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : <p className="mt-1 text-muted">Nessun talk in archivio.</p>}
            </div>
            <SwitchInput isSelected={active} onChange={toggleActive}>Attivo</SwitchInput>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="font-semibold text-muted">Email</dt><dd className="break-all">{clean(speaker.email) || '—'}</dd></div>
              <div><dt className="font-semibold text-muted">Sessionize</dt><dd>{clean(speaker.sessionizeId) || 'Non collegato'}</dd></div>
            </dl>
            {mode === 'delete' ? (
              <div role="alert" className="rounded-xl border border-[#b42318] p-4">
                <p className="font-bold text-[#b42318]">Eliminare {name}?</p>
                <p className="text-sm text-muted">La scheda viene rimossa; i talk già pubblicati restano nell'archivio con il nome del relatore.</p>
                <div className="mt-3 flex flex-wrap justify-end gap-2">
                  <Button onPress={() => setMode('view')} className={btn.ghost} autoFocus>Annulla</Button>
                  <Button onPress={remove} isDisabled={busy} className={btn.danger}>{busy ? 'Eliminazione…' : 'Elimina'}</Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
                <Button onPress={() => setMode('delete')} className={`${btn.ghost} text-[#b42318] data-[hovered]:bg-[#fdecea]`}><AdminIcon name="trash" />Elimina…</Button>
                <Button onPress={() => setMode('edit')} className={btn.secondary}><AdminIcon name="pencil" />Modifica</Button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

export default function SpeakersPage() {
  const { id } = useParams<{ id?: string }>();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const api = useAdminFetch();
  const [speakersLoad, reloadSpeakers] = useAdminLoad<AdminSpeaker[]>('/Speaker/Get');
  const [workshopsLoad] = useAdminLoad<AdminWorkshop[]>('/Workshop/Get?onlyPublished=false');
  const speakers = speakersLoad.state === 'ready' ? speakersLoad.data : null;
  const photos = useSpeakerPhotos(speakers);
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState<'talk' | 'nome'>('talk');
  const onlyNoPhoto = params.get('filtro') === 'senza-foto';

  const talks = useMemo(() => talksBySpeaker(workshopsLoad.state === 'ready' ? workshopsLoad.data : []), [workshopsLoad]);
  const groups = useMemo(() => {
    const map = new Map<string, AdminSpeaker[]>();
    for (const s of speakers ?? []) map.set(nameKey(s.name), [...(map.get(nameKey(s.name)) ?? []), s]);
    return map;
  }, [speakers]);
  const duplicateCount = useMemo(() => [...groups.values()].filter(group => group.length > 1).length, [groups]);
  const sorted = useMemo(() => [...(speakers ?? [])].sort((a, b) =>
    (sortBy === 'talk' ? (talks.get(nameKey(b.name))?.length ?? 0) - (talks.get(nameKey(a.name))?.length ?? 0) : 0)
    || clean(a.name).localeCompare(clean(b.name), 'it')), [speakers, talks, sortBy]);
  const missing = photos ? sorted.filter(s => photos.get(s.workshopSpeakerId) === null) : [];
  const q = nameKey(query);
  const visible = sorted.filter(s => (!q || nameKey(s.name).includes(q) || nameKey(s.email).includes(q)) && (!onlyNoPhoto || photos?.get(s.workshopSpeakerId) === null));

  const listSearch = params.toString() ? `?${params.toString()}` : '';
  const close = () => navigate(`/admin/speakers/${listSearch}`);
  const selected = id && id !== 'new' ? speakers?.find(s => s.workshopSpeakerId === id) : undefined;
  const reconcileDuplicates = async () => {
    if (!window.confirm(`Unire i ${duplicateCount} gruppi di doppioni? I talk saranno collegati alla scheda risultante.`)) return;
    try {
      const result = await api<{ removedSpeakers: number }>('/Speaker/ReconcileDuplicates', { method: 'POST' });
      notify('Doppioni uniti', { description: `${result?.removedSpeakers ?? 0} schede rimosse.` });
      reloadSpeakers();
    } catch (error) {
      notify('Unione non riuscita', { description: errorText(error), kind: 'error' });
    }
  };

  return (
    <>
      <PageHeader
        title="Relatori"
        description={speakers ? `${plural(speakers.length, 'relatore', 'relatori')}${photos ? `, ${speakers.length - missing.length} con foto` : ''}.` : undefined}
        actions={
          <>
            {duplicateCount > 0 && <Button onPress={() => void reconcileDuplicates()} className={btn.secondary}><AdminIcon name="users" />Unisci doppioni</Button>}
            <Link to={`/admin/speakers/new${listSearch}`} className={btn.primary}><AdminIcon name="plus" />Nuovo relatore</Link>
          </>
        }
      />
      <div className="mt-6 flex flex-wrap items-center gap-2.5" role="search">
        <SearchField aria-label="Cerca un relatore" value={query} onChange={setQuery} className="relative w-full sm:w-80">
          <span className="pointer-events-none absolute inset-y-0 left-3.5 grid place-items-center text-muted"><AdminIcon name="search" /></span>
          <Input placeholder="Nome o email" className="min-h-11 w-full rounded-full border border-line bg-white pr-4 pl-11 text-base text-navy outline-none placeholder:text-[#6b8399] hover:border-cyan-200 focus:border-cyan-700 focus:ring-3 focus:ring-cyan-700/25 [&::-webkit-search-cancel-button]:hidden" />
        </SearchField>
        <ToggleButton
          isSelected={onlyNoPhoto}
          onChange={on => setParams(p => { const next = new URLSearchParams(p); if (on) next.set('filtro', 'senza-foto'); else next.delete('filtro'); return next; }, { replace: true })}
          className={pill}
        >
          Senza foto{photos && <span className="tabular-nums">{missing.length}</span>}
        </ToggleButton>
        <ToggleButtonGroup aria-label="Ordina per" selectionMode="single" disallowEmptySelection selectedKeys={[sortBy]} onSelectionChange={keys => setSortBy(([...keys][0] as 'talk' | 'nome') ?? 'talk')} className="flex gap-2 sm:ml-auto">
          <ToggleButton id="talk" className={pill}>Più talk</ToggleButton>
          <ToggleButton id="nome" className={pill}>Nome</ToggleButton>
        </ToggleButtonGroup>
      </div>

      {speakersLoad.state === 'error' && <div className="mt-5"><LoadError message={`I relatori non sono disponibili (${speakersLoad.message}).`} onRetry={reloadSpeakers} /></div>}
      {speakersLoad.state === 'loading' && <div className="mt-5 h-96 animate-pulse rounded-2xl border border-line bg-white motion-reduce:animate-none" aria-hidden="true" />}
      {speakers && (
        <Panel className="mt-5 overflow-hidden">
          {visible.length ? (
            <ul className="divide-y divide-line" aria-label="Elenco relatori">
              {visible.map(s => {
                const t = talks.get(nameKey(s.name)) ?? [];
                const photo = photos?.get(s.workshopSpeakerId);
                return (
                  <li key={s.workshopSpeakerId}>
                    <Link to={`/admin/speakers/${s.workshopSpeakerId}${listSearch}`} className={`flex items-center gap-3 px-4 py-3 transition-colors hover:bg-cyan-50/60 sm:px-5 ${linkFocus}`}>
                      <Avatar name={clean(s.name)} src={photo} />
                      <span className="min-w-0 flex-1">
                        <span className="block font-bold">{clean(s.name)}</span>
                        <span className="block truncate text-sm text-muted">{t.length ? `${plural(t.length, 'talk', 'talk')} · ultimo: ${t[0].event}` : 'Nessun talk in archivio'}</span>
                      </span>
                      <span className="flex flex-col items-end gap-1">
                        {(groups.get(nameKey(s.name))?.length ?? 0) > 1 && <Badge kind="warn">Doppione?</Badge>}
                        {photo === null && <Badge kind="warn">Senza foto</Badge>}
                        {s.isActive === false && <Badge kind="done">Non attivo</Badge>}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState icon="mic" title="Nessun relatore trovato" actions={<Button onPress={() => { setQuery(''); setParams({}, { replace: true }); }} className={btn.secondary}>Azzera i filtri</Button>}>
              <p>Nessun relatore corrisponde alla ricerca o ai filtri.</p>
            </EmptyState>
          )}
        </Panel>
      )}

      <ModalOverlay isOpen={!!id} onOpenChange={open => { if (!open) close(); }} isDismissable className="fixed inset-0 z-50 flex bg-[rgb(0_36_69/0.42)] sm:items-center sm:justify-center sm:p-6">
        <Modal className="h-dvh w-full overflow-y-auto bg-white text-navy shadow-lift sm:h-auto sm:max-h-[90dvh] sm:max-w-2xl sm:rounded-3xl">
          <Dialog aria-label={id === 'new' ? 'Nuovo relatore' : selected ? clean(selected.name) : 'Scheda relatore'} className="outline-none">
            {id === 'new' ? (
              <>
                <div className="flex items-center justify-between border-b border-line p-5 sm:p-6">
                  <Heading slot="title" className="text-2xl font-bold">Nuovo relatore</Heading>
                  <Button slot="close" aria-label="Chiudi" className={btn.icon}><AdminIcon name="x" /></Button>
                </div>
                <div className="p-5 sm:p-6">
                  <SpeakerForm onCancel={close} onSaved={newId => { reloadSpeakers(); navigate(newId ? `/admin/speakers/${newId}` : '/admin/speakers/'); }} />
                </div>
              </>
            ) : selected ? (
              <SpeakerCard
                key={selected.workshopSpeakerId}
                speaker={selected}
                photo={photos?.get(selected.workshopSpeakerId)}
                talks={talks.get(nameKey(selected.name)) ?? []}
                duplicates={(groups.get(nameKey(selected.name)) ?? []).filter(d => d.workshopSpeakerId !== selected.workshopSpeakerId)}
                onChanged={reloadSpeakers}
                onDeleted={() => { reloadSpeakers(); close(); }}
              />
            ) : (
              <div className="p-6">
                <div className="flex justify-end"><Button slot="close" aria-label="Chiudi" className={btn.icon}><AdminIcon name="x" /></Button></div>
                {speakers ? (
                  <EmptyState icon="mic" title="Relatore non trovato"><p>La scheda non esiste più o il link non è corretto.</p></EmptyState>
                ) : <p role="status" className="py-10 text-center text-muted">Caricamento della scheda…</p>}
              </div>
            )}
          </Dialog>
        </Modal>
      </ModalOverlay>
    </>
  );
}

import React, { useEffect, useRef, useState } from 'react';
import { Button, Form, ToggleButton, ToggleButtonGroup } from 'react-aria-components';
import { AdminIcon } from '../icons';
import { Badge, EmptyState, Panel, TextAreaInput, TextInput, btn } from '../ui';
import { clean } from '../adminApi';
import { notify } from '../toasts';
import { formatDate } from '../../site/format';
import { MoveButtons, restoreMoveFocus } from './listKit';
import { ModalHeader, Notice, RecordModal, pill } from './listUi';
import { CardForm, EventIcon, EventPage, InlineConfirm, InlineField, SelectInput, SpeakerPicker, errorText } from './eventKit';
import {
  AgendaState, EventRecord, EventSpeaker, EventTalk, LegacyTrack, ScheduleParams, addServiceInterval, agendaProblem, agendaSaveBody,
  agendaSnapshot, assignTalkTrack, autoFillSchedule, createId, hasOnlyLegacyProgramme, hasTrack, initAgenda, legacyInputValue, moveItem,
  onEventDay, removeItem, removeTalk, renameTrack, setTrackCount, talkSpeakersFrom, toClockTime, toStoredTime, trackItems,
  unscheduledTalks, updateItem, upsertTalk,
} from './eventModel';

// Agenda builder: talks (imported from Sessionize or created here), parallel tracks, and the schedule of each
// track with time-only slots on the event day. Everything is local until "Salva agenda" sends the whole record.

const SESSION_TYPES = [
  { id: 'talk', label: 'Talk' },
  { id: 'panel', label: 'Panel' },
  { id: 'intro', label: 'Introduzione' },
  { id: 'service', label: 'Servizio' },
  { id: 'other', label: 'Altro' },
];

const sessionTypeLabel = (type?: string | null) => SESSION_TYPES.find(item => item.id === (type ?? 'talk'))?.label ?? clean(type);
const speakerNames = (talk: EventTalk) => (talk.speakers ?? []).map(speaker => clean(speaker.name)).filter(Boolean).join(', ');
const talkTitle = (talk: EventTalk) => clean(talk.title) || 'Talk senza titolo';
const EMPTY_GUID = '00000000-0000-0000-0000-000000000000';

// ---------- Draft ----------

export interface AgendaDraft {
  state: AgendaState;
  setState: (next: AgendaState | ((current: AgendaState) => AgendaState)) => void;
  params: ScheduleParams;
  setParams: (next: ScheduleParams) => void;
  trackIndex: number;
  setTrackIndex: (index: number) => void;
  dirty: boolean;
  reset: () => void;
}

interface DraftStore { key: string; state: AgendaState; saved: string; params: ScheduleParams; trackIndex: number }

const agendaKey = (workshop: EventRecord) =>
  `${workshop.workshopId}|${JSON.stringify([workshop.talks ?? [], workshop.agendaTracks ?? [], workshop.agendaItems ?? []])}`;

const fresh = (workshop: EventRecord, previous: DraftStore | null): DraftStore => {
  const init = initAgenda(workshop);
  const state = { talks: init.talks, tracks: init.tracks, items: init.items };
  return {
    key: agendaKey(workshop),
    state,
    saved: agendaSnapshot(state),
    params: { start: init.scheduleStart, duration: previous?.params.duration ?? '60', gap: previous?.params.gap ?? '5' },
    trackIndex: Math.min(previous?.trackIndex ?? 0, state.tracks.length - 1),
  };
};

/**
 * The agenda being edited. It survives tab changes and card saves, and starts again from the record only when
 * the saved agenda itself changes (after "Salva agenda", a Sessionize import or a reload).
 */
export function useAgendaDraft(workshop: EventRecord | null): AgendaDraft | null {
  const [store, setStore] = useState<DraftStore | null>(null);
  const key = workshop ? agendaKey(workshop) : '';
  let current = store;
  if (workshop && current?.key !== key) {
    current = fresh(workshop, store);
    setStore(current);
  }
  if (!workshop || !current) return null;
  const live = current;
  const update = (patch: Partial<DraftStore> | ((value: DraftStore) => Partial<DraftStore>)) =>
    setStore(value => (value ? { ...value, ...(typeof patch === 'function' ? patch(value) : patch) } : value));
  return {
    state: live.state,
    setState: next => update(value => ({ state: typeof next === 'function' ? next(value.state) : next })),
    params: live.params,
    setParams: params => update({ params }),
    trackIndex: live.trackIndex,
    setTrackIndex: trackIndex => update({ trackIndex }),
    dirty: agendaSnapshot(live.state) !== live.saved,
    reset: () => setStore(fresh(workshop, live)),
  };
}

// ---------- Dialogs ----------

function TalkDialog({ talk, state, speakers, onSave, onRemove, onClose }: {
  talk: EventTalk | null;
  state: AgendaState;
  speakers: EventSpeaker[];
  onSave: (talk: EventTalk) => void;
  onRemove?: (talkId: string) => void;
  onClose: () => void;
}) {
  const directoryIds = new Set(speakers.map(speaker => speaker.workshopSpeakerId));
  const known = (talk?.speakers ?? []).filter(speaker => speaker.workshopSpeakerId && directoryIds.has(speaker.workshopSpeakerId));
  const unknown = (talk?.speakers ?? []).filter(speaker => !(speaker.workshopSpeakerId && directoryIds.has(speaker.workshopSpeakerId)));
  const [title, setTitle] = useState(talk?.title ?? '');
  const [abstract, setAbstract] = useState(talk?.abstract ?? '');
  const [type, setType] = useState(talk?.sessionType || 'talk');
  const [selected, setSelected] = useState<string[]>(known.map(speaker => speaker.workshopSpeakerId as string));
  const [trackId, setTrackId] = useState<string | null>(talk?.trackId && hasTrack(state, talk.trackId) ? talk.trackId : null);
  const [speakerError, setSpeakerError] = useState<string | null>(null);
  const [trackError, setTrackError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const multiTrack = state.tracks.length > 1;

  const save = () => {
    const chosen = speakers.filter(speaker => selected.includes(speaker.workshopSpeakerId));
    if (!talk && chosen.length === 0 && unknown.length === 0) {
      setSpeakerError("Scegli almeno un relatore dall'anagrafica.");
      return false;
    }
    if (!talk && multiTrack && !trackId) {
      setTrackError('Scegli la track di questo talk.');
      return false;
    }
    onSave({
      workshopTalkId: talk?.workshopTalkId ?? createId(),
      ...(talk?.sessionizeId ? { sessionizeId: talk.sessionizeId } : {}),
      trackId: multiTrack ? trackId : state.tracks[0].workshopAgendaTrackId,
      title: clean(title),
      abstract,
      sessionType: type,
      speakers: [...unknown, ...talkSpeakersFrom(chosen)],
    });
    return true;
  };

  return (
    <RecordModal isOpen onOpenChange={open => { if (!open) onClose(); }} label={talk ? `Modifica talk: ${talkTitle(talk)}` : 'Nuovo talk'}>
      <ModalHeader title={talk ? 'Modifica talk' : 'Nuovo talk'} />
      <div className="p-5 sm:p-6">
        <CardForm onSave={save} onCancel={onClose} saveLabel={talk ? 'Applica' : 'Aggiungi'}>
          <TextInput label="Titolo" isRequired autoFocus value={title} onChange={setTitle} validate={value => (clean(value) ? null : 'Il titolo è obbligatorio.')} />
          <TextAreaInput label="Abstract" rows={3} value={abstract} onChange={setAbstract} />
          <SelectInput label="Tipo di sessione" items={SESSION_TYPES} selectedKey={type} onSelectionChange={key => setType(key ?? 'talk')} />
          <SpeakerPicker speakers={speakers} selectedIds={selected} onChange={ids => { setSelected(ids); setSpeakerError(null); }} extras={unknown.map(speaker => clean(speaker.name)).filter(Boolean)} isRequired={!talk} errorMessage={speakerError} />
          {multiTrack ? (
            <div>
              <SelectInput label="Track" items={state.tracks.map(track => ({ id: track.workshopAgendaTrackId, label: clean(track.name) || 'Track' }))} selectedKey={trackId} onSelectionChange={key => { setTrackId(key); setTrackError(null); }} placeholder="Scegli una track…" isRequired={!talk} />
              {trackError && <p role="alert" className="mt-1.5 text-sm font-semibold text-[#b42318]">{trackError}</p>}
            </div>
          ) : <p className="text-sm text-muted">Con una sola track il talk va in «{clean(state.tracks[0].name) || 'Track 1'}».</p>}
          {talk && onRemove && (confirmRemove ? (
            <InlineConfirm title={`Rimuovere «${talkTitle(talk)}»?`} confirmLabel="Rimuovi" onConfirm={() => { onRemove(talk.workshopTalkId); onClose(); }} onCancel={() => setConfirmRemove(false)}>
              <p>Il talk esce dall'agenda e dai talk da collocare; la modifica vale dopo «Salva agenda».</p>
            </InlineConfirm>
          ) : (
            <div className="border-t border-line pt-3">
              <Button onPress={() => setConfirmRemove(true)} className={`${btn.ghost} text-[#b42318] data-[hovered]:bg-[#fdecea]`}><AdminIcon name="trash" />Rimuovi talk…</Button>
            </div>
          ))}
        </CardForm>
      </div>
    </RecordModal>
  );
}

function TracksDialog({ state, onChange, onClose }: { state: AgendaState; onChange: (next: AgendaState) => void; onClose: () => void }) {
  const [count, setCount] = useState(String(state.tracks.length));
  return (
    <RecordModal isOpen onOpenChange={open => { if (!open) onClose(); }} label="Track parallele">
      <ModalHeader title="Track parallele" />
      <div className="space-y-4 p-5 sm:p-6">
        <p className="text-sm text-muted">Una track per sala o per percorso parallelo. Se ne togli una, i suoi talk passano alla prima.</p>
        <TextInput
          label="Numero di track"
          type="number"
          autoFocus
          value={count}
          onChange={value => {
            setCount(value);
            const next = Number.parseInt(value, 10);
            if (Number.isInteger(next) && next >= 1 && next <= 12) onChange(setTrackCount(state, next));
          }}
          description="Da 1 a 12."
        />
        {state.tracks.map((track, index) => (
          <TextInput key={track.workshopAgendaTrackId} label={`Nome della track ${index + 1}`} value={track.name ?? ''} onChange={name => onChange(renameTrack(state, track.workshopAgendaTrackId, name))} />
        ))}
        <div className="flex justify-end pt-1"><Button onPress={onClose} className={btn.secondary}>Fatto</Button></div>
      </div>
    </RecordModal>
  );
}

// ---------- Schedule ----------

function ScheduleRow({ item, title, isTalk, speakersText, index, count, eventDate, onChange, onMove, onEdit, onRemove }: {
  item: AgendaState['items'][number];
  title: string;
  isTalk: boolean;
  speakersText: string;
  index: number;
  count: number;
  eventDate: string;
  onChange: (update: Partial<AgendaState['items'][number]>) => void;
  onMove: (delta: -1 | 1) => void;
  onEdit?: () => void;
  onRemove?: () => void;
}) {
  return (
    <li className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-start sm:px-5">
      <div role="group" aria-label={`Orario di ${title}`} className="flex shrink-0 items-center gap-1.5">
        <InlineField label={`Inizio di ${title}`} type="time" value={toClockTime(item.startTime)} onChange={value => { if (value) onChange({ startTime: toStoredTime(value, item.startTime, eventDate) }); }} className="w-[6.5rem]" />
        <span aria-hidden="true" className="text-muted">–</span>
        <InlineField label={`Fine di ${title}`} type="time" value={toClockTime(item.endTime)} onChange={value => { if (value) onChange({ endTime: toStoredTime(value, item.endTime, eventDate) }); }} className="w-[6.5rem]" />
      </div>
      <div className="min-w-0 flex-1">
        {isTalk ? (
          <>
            <p className="font-bold leading-snug">{title}</p>
            {speakersText && <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted"><AdminIcon name="mic" className="size-4" />{speakersText}</p>}
          </>
        ) : (
          <InlineField label="Titolo della pausa" value={item.title ?? ''} onChange={value => onChange({ title: value })} placeholder="Pausa" />
        )}
        <InlineField label={`Sala di ${title}`} value={item.roomName ?? ''} onChange={value => onChange({ roomName: value })} placeholder="Sala (facoltativa)" className="mt-1.5 max-w-56" />
      </div>
      <div className="flex shrink-0 items-center gap-1 self-end sm:self-start">
        <MoveButtons id={item.workshopAgendaItemId} name={title} index={index} count={count} onMove={onMove} />
        {onEdit && <Button onPress={onEdit} aria-label={`Modifica: ${title}`} className={btn.icon}><AdminIcon name="pencil" /></Button>}
        {onRemove && <Button onPress={onRemove} aria-label={`Rimuovi: ${title}`} className={btn.icon}><AdminIcon name="trash" /></Button>}
      </div>
    </li>
  );
}

export function AgendaPanel({ page, draft }: { page: EventPage; draft: AgendaDraft }) {
  const { workshop, speakers } = page;
  const { state, setState, params, setParams, trackIndex, setTrackIndex, dirty } = draft;
  const [talkDialog, setTalkDialog] = useState<{ talk: EventTalk | null } | null>(null);
  const [tracksOpen, setTracksOpen] = useState(false);
  const [fillOpen, setFillOpen] = useState(false);
  const [fillDraft, setFillDraft] = useState(params);
  const [intervalOpen, setIntervalOpen] = useState(false);
  const [interval, setIntervalDraft] = useState({ title: 'Pausa', room: '' });
  const [sessionizeId, setSessionizeId] = useState('');
  const [importing, setImporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  // Events from before the agenda builder open on their historic sessions; the builder waits behind one action.
  const [builderRequested, setBuilderRequested] = useState(false);
  const legacyFirst = hasOnlyLegacyProgramme(workshop) && !builderRequested;
  // After a move the rows are re-ordered: focus goes back to the button that was used once React has rendered.
  const refocus = useRef<{ id: string; delta: -1 | 1 } | null>(null);
  useEffect(() => {
    if (!refocus.current) return;
    restoreMoveFocus(refocus.current.id, refocus.current.delta);
    refocus.current = null;
  }, [state.items]);

  const track = state.tracks[Math.min(trackIndex, state.tracks.length - 1)];
  const trackId = track.workshopAgendaTrackId;
  const rows = trackItems(state, trackId);
  const pending = unscheduledTalks(state);
  const unassigned = state.talks.filter(talk => !hasTrack(state, talk.trackId));

  // Talks that have a track but no slot are placed as soon as they appear, like the previous schedule page did.
  useEffect(() => {
    if (!pending.some(talk => hasTrack(state, talk.trackId)) || unassigned.length) return;
    const result = autoFillSchedule(state, params, workshop.eventDate);
    if ('items' in result) setState(current => ({ ...current, items: result.items }));
  }, [pending, unassigned.length, state, params, workshop.eventDate, setState]);

  const fill = () => {
    const result = autoFillSchedule(state, fillDraft, workshop.eventDate);
    if ('error' in result) {
      setProblem(result.error);
      return;
    }
    setParams(fillDraft);
    setState(current => ({ ...current, items: result.items }));
    setProblem(null);
    setFillOpen(false);
    notify('Orari riempiti', { description: 'Controlla le sessioni e le pause, poi salva l\'agenda.' });
  };

  const addInterval = () => {
    setState(current => addServiceInterval(current, trackId, { title: interval.title, room: interval.room, gap: params.gap, scheduleStart: params.start, eventDate: workshop.eventDate }));
    setIntervalDraft({ title: 'Pausa', room: '' });
    setIntervalOpen(false);
  };

  const save = async () => {
    const error = agendaProblem(state);
    if (error) {
      setProblem(error);
      return;
    }
    setProblem(null);
    setSaving(true);
    try {
      await page.save(agendaSaveBody(workshop, state), { title: 'Agenda salvata', description: `${state.talks.length} talk, ${state.items.length} voci in scaletta` });
    } finally {
      setSaving(false);
    }
  };

  const importTalks = async (event: React.FormEvent) => {
    event.preventDefault();
    setImporting(true);
    try {
      const result = await page.api<{ importedTalks?: number; importedSpeakers?: number }>(`/Workshop/ImportSessionize/${encodeURIComponent(workshop.workshopId)}`, {
        method: 'POST', body: JSON.stringify({ sessionizeId: sessionizeId.trim() }),
      });
      await page.reload();
      page.reloadSpeakers();
      setSessionizeId('');
      notify('Talk importati da Sessionize', { description: `${result?.importedTalks ?? 0} talk e ${result?.importedSpeakers ?? 0} relatori aggiornati in anagrafica.` });
    } catch (error) {
      notify('Importazione non riuscita', { description: errorText(error), kind: 'error' });
    } finally {
      setImporting(false);
    }
  };

  const openTalk = (talk: EventTalk | null) => setTalkDialog({ talk });
  const talkOf = (talkId?: string | null) => state.talks.find(talk => talk.workshopTalkId === talkId);

  if (legacyFirst) {
    return (
      <>
        <LegacyTracksPanel page={page} />
        <Panel className="mt-5 flex flex-wrap items-center justify-between gap-4 p-5">
          <p className="max-w-[60ch] text-muted">Il sito mostra queste sessioni storiche finché l'evento non ha un'agenda nuova: con talk, track e orari la sostituisce.</p>
          <Button onPress={() => setBuilderRequested(true)} className={btn.secondary}><AdminIcon name="plus" />Crea un'agenda nuova</Button>
        </Panel>
      </>
    );
  }

  return (
    <>
      <div className="grid items-start gap-5 2xl:grid-cols-[minmax(0,1fr)_20rem]">
        <Panel labelledBy="agenda-title">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
            <div>
              <h3 id="agenda-title" className="text-lg font-bold">Programma</h3>
              <p className="text-sm text-muted">{state.tracks.length === 1 ? 'Una track' : `${state.tracks.length} track parallele`} · orari sul giorno dell'evento</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onPress={() => setTracksOpen(true)} className={btn.ghost}><AdminIcon name="list" />Track</Button>
              <Button onPress={() => { setFillDraft(params); setFillOpen(open => !open); }} className={btn.ghost} aria-expanded={fillOpen}><EventIcon name="clock" />Riempi gli orari</Button>
              <Button onPress={() => openTalk(null)} className={btn.primary}><AdminIcon name="plus" />Aggiungi talk</Button>
            </div>
          </div>

          {state.tracks.length > 1 && (
            <ToggleButtonGroup aria-label="Track" selectionMode="single" disallowEmptySelection selectedKeys={[trackId]} onSelectionChange={keys => { const next = state.tracks.findIndex(t => t.workshopAgendaTrackId === [...keys][0]); if (next >= 0) setTrackIndex(next); }} className="flex flex-wrap gap-2 px-5 pt-4">
              {state.tracks.map(item => <ToggleButton key={item.workshopAgendaTrackId} id={item.workshopAgendaTrackId} className={pill}>{clean(item.name) || 'Track'}</ToggleButton>)}
            </ToggleButtonGroup>
          )}

          {fillOpen && (
            <Form onSubmit={event => { event.preventDefault(); fill(); }} className="m-5 grid gap-3 rounded-xl bg-[#f3f7fa] p-4 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end" aria-label="Riempi gli orari">
              <TextInput label="Inizio" type="time" isRequired value={fillDraft.start} onChange={start => setFillDraft(d => ({ ...d, start }))} />
              <TextInput label="Durata talk (minuti)" type="number" isRequired value={fillDraft.duration} onChange={duration => setFillDraft(d => ({ ...d, duration }))} />
              <TextInput label="Pausa tecnica (minuti)" type="number" isRequired value={fillDraft.gap} onChange={gap => setFillDraft(d => ({ ...d, gap }))} />
              <div className="flex gap-2"><Button type="submit" className={btn.secondary}>Riempi</Button><Button onPress={() => setFillOpen(false)} className={btn.ghost}>Chiudi</Button></div>
              <p className="text-sm text-muted sm:col-span-4">Ricalcola gli orari di tutte le track da questo inizio; le pause che hai aggiunto restano al loro posto.</p>
            </Form>
          )}

          {problem && <div className="px-5 pt-4"><Notice tone="danger" title="L'agenda non è pronta">{problem}</Notice></div>}

          {rows.length ? (
            <ol className="divide-y divide-line" aria-label={`Scaletta di ${clean(track.name) || 'Track'}`}>
              {rows.map((item, index) => {
                const talk = talkOf(item.talkId);
                const isTalk = item.itemType === 'talk' && !!talk;
                const title = isTalk ? talkTitle(talk) : clean(item.title) || 'Pausa';
                return (
                  <ScheduleRow
                    key={item.workshopAgendaItemId}
                    item={item}
                    title={title}
                    isTalk={isTalk}
                    speakersText={talk ? speakerNames(talk) : ''}
                    index={index}
                    count={rows.length}
                    eventDate={workshop.eventDate}
                    onChange={update => setState(current => updateItem(current, item.workshopAgendaItemId, update))}
                    onMove={delta => { refocus.current = { id: item.workshopAgendaItemId, delta }; setState(current => moveItem(current, trackId, item.workshopAgendaItemId, delta)); }}
                    onEdit={isTalk ? () => openTalk(talk) : undefined}
                    onRemove={isTalk ? undefined : () => setState(current => removeItem(current, item.workshopAgendaItemId))}
                  />
                );
              })}
            </ol>
          ) : (
            <EmptyState icon="calendar" title="Nessuna sessione" actions={<Button onPress={() => openTalk(null)} className={btn.secondary}><AdminIcon name="plus" />Aggiungi il primo talk</Button>}>
              <p>Importa i talk da Sessionize o aggiungili uno alla volta: gli orari si riempiono da soli.</p>
            </EmptyState>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-4">
            {intervalOpen ? (
              <Form onSubmit={event => { event.preventDefault(); addInterval(); }} className="flex flex-wrap items-end gap-2" aria-label="Aggiungi pausa">
                <TextInput label="Titolo della pausa" value={interval.title} onChange={title => setIntervalDraft(i => ({ ...i, title }))} />
                <TextInput label="Sala (facoltativa)" value={interval.room} onChange={room => setIntervalDraft(i => ({ ...i, room }))} />
                <Button type="submit" className={btn.secondary}>Aggiungi</Button>
                <Button onPress={() => setIntervalOpen(false)} className={btn.ghost}>Chiudi</Button>
              </Form>
            ) : (
              <Button onPress={() => setIntervalOpen(true)} className={btn.ghost}><AdminIcon name="plus" />Aggiungi pausa</Button>
            )}
            <div className="flex flex-wrap items-center gap-2">
              {dirty && <span className="text-sm font-semibold text-[#8a4b00]">Modifiche non salvate</span>}
              {dirty && <Button onPress={() => { draft.reset(); setProblem(null); }} isDisabled={saving} className={btn.ghost}>Annulla modifiche</Button>}
              <Button onPress={() => void save()} isDisabled={saving || !dirty} className={btn.primary}>{saving ? 'Salvataggio…' : 'Salva agenda'}</Button>
            </div>
          </div>
        </Panel>

        <Panel labelledBy="pool-title">
          <div className="px-5 pt-4">
            <h3 id="pool-title" className="text-lg font-bold">Talk da collocare</h3>
            <p className="text-sm text-muted">Talk importati o creati che non sono ancora in scaletta.</p>
          </div>
          {pending.length ? (
            <ul className="mt-2 divide-y divide-line border-t border-line">
              {pending.map(talk => (
                <li key={talk.workshopTalkId} className="flex items-start gap-3 px-5 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold leading-snug">{talkTitle(talk)}</span>
                    {speakerNames(talk) && <span className="block text-sm text-muted">{speakerNames(talk)}</span>}
                    <span className="block text-sm text-muted">{sessionTypeLabel(talk.sessionType)}</span>
                    {state.tracks.length > 1 && (
                      <SelectInput
                        label={`Track di ${talkTitle(talk)}`}
                        items={state.tracks.map(item => ({ id: item.workshopAgendaTrackId, label: clean(item.name) || 'Track' }))}
                        selectedKey={hasTrack(state, talk.trackId) ? talk.trackId! : null}
                        onSelectionChange={key => setState(current => assignTalkTrack(current, talk.workshopTalkId, key))}
                        placeholder="Scegli una track…"
                        className="mt-2 block [&>label]:sr-only"
                      />
                    )}
                  </span>
                  <Button onPress={() => openTalk(talk)} aria-label={`Modifica: ${talkTitle(talk)}`} className={btn.icon}><AdminIcon name="pencil" /></Button>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon="download" title="Nessun talk in attesa"><p>Importa le sessioni accettate su Sessionize: arrivano qui con relatori e abstract.</p></EmptyState>
          )}
          {unassigned.length > 0 && state.tracks.length > 1 && <div className="px-5 pb-4"><Notice tone="warn" title="Talk senza track">Scegli la track di ogni talk: gli orari si riempiono da soli.</Notice></div>}
          <Form onSubmit={importTalks} className="space-y-3 border-t border-line p-5" aria-label="Importa da Sessionize">
            <h4 className="font-bold">Importa da Sessionize</h4>
            <TextInput label="ID evento Sessionize" isRequired value={sessionizeId} onChange={setSessionizeId} placeholder="Per esempio: 2k3abc9x" description="Le sessioni accettate arrivano con relatori e abstract; i relatori nuovi finiscono in anagrafica." />
            {dirty && <p className="text-sm font-semibold text-[#8a4b00]">Salva l'agenda prima di importare: l'importazione ricarica la scaletta.</p>}
            <Button type="submit" isDisabled={importing || dirty || !sessionizeId.trim()} className={btn.secondary}><AdminIcon name="download" />{importing ? 'Importazione…' : 'Importa talk'}</Button>
          </Form>
        </Panel>
      </div>

      {(workshop.tracks?.length ?? 0) > 0 && <LegacyTracksPanel page={page} className="mt-5" />}

      {talkDialog && (
        <TalkDialog
          talk={talkDialog.talk}
          state={state}
          speakers={speakers}
          onSave={talk => { setState(current => upsertTalk(current, talk)); setTalkDialog(null); }}
          onRemove={talkDialog.talk ? id => setState(current => removeTalk(current, id)) : undefined}
          onClose={() => setTalkDialog(null)}
        />
      )}
      {tracksOpen && <TracksDialog state={state} onChange={setState} onClose={() => setTracksOpen(false)} />}
    </>
  );
}

// ---------- Legacy tracks ----------

function TrackDialog({ track, speakers, onSave, onClose }: { track: LegacyTrack | null; speakers: EventSpeaker[]; onSave: (track: LegacyTrack) => Promise<boolean>; onClose: () => void }) {
  const [title, setTitle] = useState(track?.title ?? '');
  const [start, setStart] = useState(legacyInputValue(track?.startTime));
  const [end, setEnd] = useState(legacyInputValue(track?.endTime));
  const [level, setLevel] = useState(String(track?.level ?? 0));
  const [abstract, setAbstract] = useState(track?.abstract ?? '');
  const [selected, setSelected] = useState<string[]>((track?.speakers ?? []).filter(id => speakers.some(speaker => speaker.workshopSpeakerId === id)));
  const [problem, setProblem] = useState<string | null>(null);

  const save = async () => {
    // Times are typed as UTC wall-clock values, as the previous admin stored them.
    const startTime = new Date(`${start}:00Z`);
    const endTime = new Date(`${end}:00Z`);
    if (Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime()) || endTime <= startTime) {
      setProblem('La sessione deve finire dopo il suo inizio.');
      return false;
    }
    const chosen = speakers.filter(speaker => selected.includes(speaker.workshopSpeakerId));
    const next: LegacyTrack = {
      ...(track ?? { workshopTrackId: EMPTY_GUID, image: '' }),
      title: clean(title),
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      abstract,
      level: Number.parseInt(level, 10) || 0,
      speakers: chosen.map(speaker => speaker.workshopSpeakerId),
      speakersName: chosen.map(speaker => clean(speaker.name)).join(', '),
    };
    return onSave(next);
  };

  return (
    <RecordModal isOpen onOpenChange={open => { if (!open) onClose(); }} label={track ? `Modifica sessione: ${clean(track.title)}` : 'Nuova sessione'}>
      <ModalHeader title={track ? 'Modifica sessione' : 'Nuova sessione'} />
      <div className="p-5 sm:p-6">
        <CardForm onSave={save} onCancel={onClose}>
          <TextInput label="Titolo" isRequired autoFocus value={title} onChange={setTitle} validate={value => (clean(value) ? null : 'Il titolo è obbligatorio.')} />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput label="Inizio" type="datetime-local" isRequired value={start} onChange={value => { setStart(value); setProblem(null); }} description="Ora UTC, come negli eventi storici." />
            <TextInput label="Fine" type="datetime-local" isRequired value={end} onChange={value => { setEnd(value); setProblem(null); }} />
          </div>
          {problem && <p role="alert" className="text-sm font-semibold text-[#b42318]">{problem}</p>}
          <TextInput label="Livello" type="number" value={level} onChange={setLevel} description="0 per tutti, poi crescente." />
          <TextAreaInput label="Abstract" rows={4} value={abstract} onChange={setAbstract} />
          <SpeakerPicker speakers={speakers} selectedIds={selected} onChange={setSelected} />
        </CardForm>
      </div>
    </RecordModal>
  );
}

export function LegacyTracksPanel({ page, className = '' }: { page: EventPage; className?: string }) {
  const { workshop, speakers } = page;
  const [dialog, setDialog] = useState<{ track: LegacyTrack | null } | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const tracks = [...(workshop.tracks ?? [])].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  const persist = async (next: LegacyTrack[], toast: string) => {
    setBusy(true);
    try {
      const ok = await page.save({ ...workshop, tracks: next }, { title: toast });
      if (ok) await page.reload();
      return ok;
    } finally {
      setBusy(false);
    }
  };
  const saveTrack = async (track: LegacyTrack) => {
    const current = workshop.tracks ?? [];
    const exists = current.some(item => item.workshopTrackId === track.workshopTrackId && track.workshopTrackId !== EMPTY_GUID);
    const next = exists ? current.map(item => (item.workshopTrackId === track.workshopTrackId ? track : item)) : [...current, track];
    const ok = await persist(next, exists ? 'Sessione aggiornata' : 'Sessione aggiunta');
    if (ok) setDialog(null);
    return ok;
  };
  const deleteTrack = async (id: string) => {
    const ok = await persist((workshop.tracks ?? []).filter(item => item.workshopTrackId !== id), 'Sessione eliminata');
    if (ok) setConfirmId(null);
  };

  return (
    <Panel labelledBy="legacy-title" className={className}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <h3 id="legacy-title" className="text-lg font-bold">Sessioni in formato storico</h3>
          <p className="text-sm text-muted">Programma degli eventi precedenti all'agenda; il sito lo mostra finché non esiste un'agenda nuova.</p>
        </div>
        <Button onPress={() => setDialog({ track: null })} className={btn.secondary}><AdminIcon name="plus" />Aggiungi sessione</Button>
      </div>
      <ul className="divide-y divide-line">
        {tracks.map(track => {
          const title = clean(track.title) || 'Sessione senza titolo';
          const sameDay = onEventDay(track, workshop);
          return (
            <li key={track.workshopTrackId} className="px-5 py-3">
              {confirmId === track.workshopTrackId ? (
                <InlineConfirm title={`Eliminare «${title}»?`} confirmLabel="Elimina" busyLabel="Eliminazione…" busy={busy} onConfirm={() => void deleteTrack(track.workshopTrackId)} onCancel={() => setConfirmId(null)}>
                  <p>La sessione sparisce dal programma storico dell'evento.</p>
                </InlineConfirm>
              ) : (
                <div className="flex flex-wrap items-start gap-3">
                  <span className="w-44 shrink-0 pt-0.5 text-sm font-semibold text-cyan-700 tabular-nums">
                    {!sameDay && <span className="block">{formatDate(track.startTime)}</span>}
                    {toClockTime(track.startTime)}–{toClockTime(track.endTime)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-bold leading-snug">{title}</span>
                      {!sameDay && <Badge kind="warn">Data diversa dall'evento</Badge>}
                    </span>
                    <span className="block text-sm text-muted">{[clean(track.speakersName), track.level ? `Livello ${track.level}` : null].filter(Boolean).join(' · ')}</span>
                    {clean(track.abstract) && <span className="mt-1 block max-w-[65ch] text-sm">{clean(track.abstract)}</span>}
                  </span>
                  <span className="flex items-center gap-1">
                    <Button onPress={() => setDialog({ track })} aria-label={`Modifica: ${title}`} className={btn.icon}><AdminIcon name="pencil" /></Button>
                    <Button onPress={() => setConfirmId(track.workshopTrackId)} aria-label={`Elimina: ${title}`} className={btn.icon}><AdminIcon name="trash" /></Button>
                  </span>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {dialog && <TrackDialog track={dialog.track} speakers={speakers} onSave={saveTrack} onClose={() => setDialog(null)} />}
    </Panel>
  );
}

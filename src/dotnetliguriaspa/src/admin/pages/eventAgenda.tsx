import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Form } from 'react-aria-components';
import { AdminIcon } from '../icons';
import { Badge, EmptyState, Panel, TextAreaInput, TextInput, btn } from '../ui';
import { clean } from '../adminApi';
import { notify } from '../toasts';
import { formatDate } from '../../site/format';
import { formatDateTime } from '../../questionnaire/format';
import { MoveButtons, restoreMoveFocus } from './listKit';
import { ExternalLink, ModalHeader, Notice, RecordModal } from './listUi';
import { CardForm, EventIcon, EventPage, InlineConfirm, InlineField, PanelTitle, SelectInput, SpeakerPicker, errorText } from './eventKit';
import {
  AgendaDraftState, AgendaPage, EventRecord, EventSpeaker, EventTalk, LegacyTrack, ScheduleParams, addServiceInterval, addTalk, adoptTalks,
  afterSave, agendaKeyOf, agendaProblem, agendaSaveBody, agendaSnapshot, assignTalkTrack, autoFillSchedule, createId, eventbriteIssues,
  eventbriteStatusLabel, hasTrack, initAgenda, legacyInputValue, moveItem, onEventDay, removeItem, removeTalk, renameTrack, setTrackCount,
  talkSpeakersFrom, toClockTime, toStoredTime, trackItems, unscheduledTalks, updateItem, updateTalk,
} from './eventModel';

// Steps 5 (Sessioni), 6 (Elenco talk), 7 (Agenda e orari) and 8 (Iscrizione) of the wizard: the previous
// legacy track dialog and AdminWorkshopAgenda, with the same state, saves and checks.

const SESSION_TYPES = [
  { id: 'talk', label: 'Talk' },
  { id: 'panel', label: 'Panel' },
  { id: 'intro', label: 'Introduzione' },
  { id: 'other', label: 'Altro' },
];
const LISTED_SESSION_TYPES = [...SESSION_TYPES.slice(0, 3), { id: 'service', label: 'Servizio' }, SESSION_TYPES[3]];

const speakerNames = (talk: EventTalk) => (talk.speakers ?? []).map(speaker => clean(speaker.name)).filter(Boolean).join(', ');
const talkTitle = (talk: EventTalk) => clean(talk.title) || 'Talk senza titolo';
const EMPTY_GUID = '00000000-0000-0000-0000-000000000000';

// ---------- Module draft (the previous AdminWorkshopAgenda state) ----------

export interface AgendaDraft {
  state: AgendaDraftState;
  setState: (next: AgendaDraftState | ((current: AgendaDraftState) => AgendaDraftState)) => void;
  params: ScheduleParams;
  setParams: (next: ScheduleParams) => void;
  trackIndex: number;
  setTrackIndex: (index: number) => void;
  dirty: boolean;
  /** After a Sessionize import: the talks come from the server, the local tracks and items stay (as before). */
  absorbImport: (workshop: EventRecord, imported: EventRecord) => EventRecord;
}

interface DraftStore { key: string; state: AgendaDraftState; saved: string; params: ScheduleParams; trackIndex: number }

const fresh = (workshop: EventRecord, previous: DraftStore | null): DraftStore => {
  const { scheduleStart, ...state } = initAgenda(workshop);
  return {
    key: agendaKeyOf(workshop),
    state,
    saved: agendaSnapshot(state),
    params: { start: scheduleStart, duration: previous?.params.duration ?? '60', gap: previous?.params.gap ?? '5' },
    trackIndex: Math.min(previous?.trackIndex ?? 0, state.tracks.length - 1),
  };
};

/**
 * The talk pool, schedule and registration being edited. It survives moving between steps and starts again
 * from the record only when the record's own agenda or registration fields change (after a save or a reload).
 */
export function useAgendaDraft(workshop: EventRecord | null): AgendaDraft | null {
  const [store, setStore] = useState<DraftStore | null>(null);
  const key = workshop ? agendaKeyOf(workshop) : '';
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
    absorbImport: (record, imported) => {
      const next = { ...record, talks: imported.talks ?? [] };
      update(value => ({ key: agendaKeyOf(next), state: { ...value.state, talks: adoptTalks(imported.talks, value.state.tracks) } }));
      return next;
    },
  };
}

/** The module's save: the same checks as before for the page it runs from, then one PUT of the whole record. */
function useAgendaSave(page: EventPage, draft: AgendaDraft) {
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const save = useCallback(async (from: AgendaPage) => {
    const error = agendaProblem(draft.state, from);
    if (error) {
      setProblem(error);
      return false;
    }
    setProblem(null);
    setSaving(true);
    try {
      const body = agendaSaveBody(page.workshop, draft.state);
      await page.api(`/Workshop/Update/${encodeURIComponent(page.workshop.workshopId)}`, { method: 'PUT', body: JSON.stringify(body) });
      page.replace(afterSave(body));
      return true;
    } catch (error) {
      notify('Salvataggio non riuscito', { description: errorText(error), kind: 'error' });
      return false;
    } finally {
      setSaving(false);
    }
  }, [draft.state, page]);
  return { save, saving, problem, setProblem };
}

const trackOptions = (state: AgendaDraftState) => state.tracks.map(track => ({ id: track.workshopAgendaTrackId, label: clean(track.name) || 'Track' }));
const idsInDirectory = (talk: EventTalk, speakers: EventSpeaker[]) =>
  (talk.speakers ?? []).flatMap(speaker => (speaker.workshopSpeakerId && speakers.some(s => s.workshopSpeakerId === speaker.workshopSpeakerId) ? [speaker.workshopSpeakerId] : []));
const namesOutsideDirectory = (talk: EventTalk, speakers: EventSpeaker[]) =>
  (talk.speakers ?? []).filter(speaker => !(speaker.workshopSpeakerId && speakers.some(s => s.workshopSpeakerId === speaker.workshopSpeakerId))).map(speaker => clean(speaker.name)).filter(Boolean);

// ---------- 6. Elenco talk ----------

export function TalkListStep({ page, draft }: { page: EventPage; draft: AgendaDraft }) {
  const { workshop, speakers } = page;
  const { state, setState } = draft;
  const { save, saving, problem } = useAgendaSave(page, draft);
  const [sessionizeId, setSessionizeId] = useState('');
  const [importing, setImporting] = useState(false);
  const [trackCount, setTrackCountText] = useState(String(state.tracks.length));
  const [newTalk, setNewTalk] = useState({ title: '', abstract: '', type: 'talk', speakerIds: [] as string[], trackId: null as string | null });
  const [notice, setNotice] = useState<{ tone: 'ok' | 'danger'; text: string } | null>(null);
  const multiTrack = state.tracks.length > 1;
  useEffect(() => setTrackCountText(String(state.tracks.length)), [state.tracks.length]);

  const importTalks = async (event: React.FormEvent) => {
    event.preventDefault();
    setImporting(true);
    try {
      await page.api(`/Workshop/ImportSessionize/${encodeURIComponent(workshop.workshopId)}`, { method: 'POST', body: JSON.stringify({ sessionizeId: sessionizeId.trim() }) });
      const refreshed = await page.api<EventRecord>(`/Workshop/Get/${encodeURIComponent(workshop.workshopId)}`);
      page.replace(draft.absorbImport(workshop, refreshed));
      page.reloadSpeakers();
      setNotice({ tone: 'ok', text: 'Talk importati da Sessionize; i relatori corrispondenti sono stati aggiornati in anagrafica.' });
    } catch (error) {
      setNotice({ tone: 'danger', text: errorText(error) });
    } finally {
      setImporting(false);
    }
  };

  const addNewTalk = () => {
    if (!newTalk.title.trim()) return setNotice({ tone: 'danger', text: 'Indica il titolo del talk.' });
    if (newTalk.speakerIds.length === 0) return setNotice({ tone: 'danger', text: "Scegli almeno un relatore dall'anagrafica." });
    if (multiTrack && !newTalk.trackId) return setNotice({ tone: 'danger', text: 'Scegli la track di questo talk.' });
    const chosen = speakers.filter(speaker => newTalk.speakerIds.includes(speaker.workshopSpeakerId));
    setState(current => addTalk(current, {
      workshopTalkId: createId(),
      trackId: multiTrack ? newTalk.trackId : current.tracks[0].workshopAgendaTrackId,
      title: newTalk.title.trim(),
      abstract: newTalk.abstract,
      sessionType: newTalk.type,
      speakers: talkSpeakersFrom(chosen),
    }));
    setNewTalk(value => ({ ...value, title: '', abstract: '', speakerIds: [] }));
    setNotice({ tone: 'ok', text: "Talk aggiunto all'elenco: salva l'elenco per renderlo definitivo." });
  };

  const setSpeakersOf = (talk: EventTalk, ids: string[]) => {
    const chosen = speakers.filter(speaker => ids.includes(speaker.workshopSpeakerId));
    const kept = (talk.speakers ?? []).filter(speaker => !(speaker.workshopSpeakerId && speakers.some(s => s.workshopSpeakerId === speaker.workshopSpeakerId)));
    setState(current => updateTalk(current, talk.workshopTalkId, { speakers: [...kept, ...talkSpeakersFrom(chosen)] }));
  };

  return (
    <div className="space-y-5">
      <Panel labelledBy="import-title" className="p-5">
        <PanelTitle id="import-title" title="Importa da Sessionize" hint="Le sessioni accettate arrivano con relatori e abstract e sostituiscono l'elenco qui sotto; track e orari non salvati restano." />
        <Form onSubmit={importTalks} className="mt-3 flex flex-wrap items-end gap-3" aria-label="Importa da Sessionize">
          <TextInput label="ID evento Sessionize" value={sessionizeId} onChange={setSessionizeId} placeholder="Per esempio: 2k3abc9x" className="block min-w-64" />
          <Button type="submit" isDisabled={importing || !sessionizeId.trim()} className={btn.secondary}><AdminIcon name="download" />{importing ? 'Importazione…' : 'Importa talk'}</Button>
        </Form>
      </Panel>

      <Panel labelledBy="tracks-title" className="p-5">
        <PanelTitle id="tracks-title" title="Track parallele" hint="Una track per sala o percorso; i talk di una track tolta passano alla prima." />
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <TextInput label="Numero di track" type="number" value={trackCount} onChange={value => { setTrackCountText(value); const n = Number(value); if (n >= 1) setState(current => setTrackCount(current, n)); }} />
          {state.tracks.map((track, index) => (
            <TextInput key={track.workshopAgendaTrackId} label={`Nome della track ${index + 1}`} value={track.name ?? ''} onChange={name => setState(current => renameTrack(current, track.workshopAgendaTrackId, name))} />
          ))}
        </div>
      </Panel>

      <Panel labelledBy="new-talk-title" className="p-5">
        <PanelTitle id="new-talk-title" title="Crea un talk" />
        <div className="mt-3 grid gap-3">
          <TextInput label="Titolo del talk" value={newTalk.title} onChange={title => setNewTalk(value => ({ ...value, title }))} />
          <TextAreaInput label="Abstract" rows={2} value={newTalk.abstract} onChange={abstract => setNewTalk(value => ({ ...value, abstract }))} />
          <SelectInput label="Tipo di sessione" items={SESSION_TYPES} selectedKey={newTalk.type} onSelectionChange={type => setNewTalk(value => ({ ...value, type: type ?? 'talk' }))} className="block sm:max-w-xs" />
          <SpeakerPicker speakers={speakers} selectedIds={newTalk.speakerIds} onChange={speakerIds => setNewTalk(value => ({ ...value, speakerIds }))} collapsed />
          {multiTrack
            ? <SelectInput label="Track" items={trackOptions(state)} selectedKey={newTalk.trackId} onSelectionChange={trackId => setNewTalk(value => ({ ...value, trackId }))} placeholder="Scegli una track…" className="block sm:max-w-xs" />
            : <p className="text-sm text-muted">I talk vanno in «{clean(state.tracks[0].name) || 'Track 1'}» automaticamente.</p>}
          <div><Button onPress={addNewTalk} className={btn.secondary}><AdminIcon name="plus" />Aggiungi talk all'elenco</Button></div>
        </div>
      </Panel>

      {notice && <Notice tone={notice.tone} title={notice.tone === 'ok' ? 'Fatto' : 'Controlla'}>{notice.text}</Notice>}

      <Panel labelledBy="talks-title">
        <div className="p-5"><PanelTitle id="talks-title" title="Talk nell'elenco" hint={state.talks.length ? `${state.talks.length} talk` : 'Ancora nessun talk: importali da Sessionize o creali qui sopra.'} /></div>
        {state.talks.length > 0 && (
          <ul className="divide-y divide-line border-t border-line" aria-label="Talk nell'elenco">
            {state.talks.map(talk => (
              <li key={talk.workshopTalkId} className="grid gap-3 p-5 md:grid-cols-[minmax(0,1fr)_auto]">
                <div className="grid gap-3">
                  <TextInput label="Titolo del talk" value={talk.title ?? ''} onChange={title => setState(current => updateTalk(current, talk.workshopTalkId, { title }))} />
                  <TextAreaInput label="Abstract" rows={2} value={talk.abstract ?? ''} onChange={abstract => setState(current => updateTalk(current, talk.workshopTalkId, { abstract }))} />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <SelectInput label="Tipo di sessione" items={LISTED_SESSION_TYPES} selectedKey={talk.sessionType || 'talk'} onSelectionChange={sessionType => setState(current => updateTalk(current, talk.workshopTalkId, { sessionType: sessionType ?? 'talk' }))} />
                    {multiTrack
                      ? <SelectInput label="Track" items={trackOptions(state)} selectedKey={hasTrack(state, talk.trackId) ? talk.trackId! : null} onSelectionChange={trackId => setState(current => assignTalkTrack(current, talk.workshopTalkId, trackId))} placeholder="Scegli una track…" />
                      : <p className="self-end pb-3 text-sm text-muted">{clean(state.tracks[0]?.name) || 'Track 1'}</p>}
                  </div>
                  <SpeakerPicker label={`Relatori di ${talkTitle(talk)}`} speakers={speakers} selectedIds={idsInDirectory(talk, speakers)} onChange={ids => setSpeakersOf(talk, ids)} extras={namesOutsideDirectory(talk, speakers)} collapsed />
                </div>
                <div><Button onPress={() => setState(current => removeTalk(current, talk.workshopTalkId))} className={`${btn.ghost} text-[#b42318] data-[hovered]:bg-[#fdecea]`}><AdminIcon name="trash" />Rimuovi</Button></div>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-4">
          <span className="text-sm font-semibold text-[#8a4b00]">{draft.dirty ? 'Modifiche non salvate' : ''}</span>
          <Button onPress={() => void save('talks').then(ok => { if (ok) notify('Elenco talk salvato'); })} isDisabled={saving} className={btn.primary}>{saving ? 'Salvataggio…' : 'Salva elenco talk'}</Button>
        </div>
        {problem && <div className="px-5 pb-5"><Notice tone="danger" title="L'elenco non è pronto">{problem}</Notice></div>}
      </Panel>
    </div>
  );
}

// ---------- 7. Agenda e orari ----------

function ScheduleRow({ item, title, isTalk, speakersText, index, count, eventDate, onChange, onMove, onRemove }: {
  item: AgendaDraftState['items'][number];
  title: string;
  isTalk: boolean;
  speakersText: string;
  index: number;
  count: number;
  eventDate: string;
  onChange: (update: Partial<AgendaDraftState['items'][number]>) => void;
  onMove: (delta: -1 | 1) => void;
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
        {onRemove && <Button onPress={onRemove} aria-label={`Rimuovi: ${title}`} className={btn.icon}><AdminIcon name="trash" /></Button>}
      </div>
    </li>
  );
}

export function ScheduleStep({ page, draft }: { page: EventPage; draft: AgendaDraft }) {
  const { workshop } = page;
  const { state, setState, params, setParams, trackIndex, setTrackIndex } = draft;
  const { save, saving, problem, setProblem } = useAgendaSave(page, draft);
  const [interval, setIntervalDraft] = useState({ title: 'Pausa', room: '' });
  const refocus = useRef<{ id: string; delta: -1 | 1 } | null>(null);
  useEffect(() => {
    if (!refocus.current) return;
    restoreMoveFocus(refocus.current.id, refocus.current.delta);
    refocus.current = null;
  }, [state.items]);

  const track = state.tracks[Math.min(trackIndex, state.tracks.length - 1)];
  const trackId = track.workshopAgendaTrackId;
  const rows = trackItems(state, trackId);

  const fill = useCallback(() => {
    const result = autoFillSchedule(state, params, workshop.eventDate);
    if ('error' in result) {
      setProblem(result.error);
      return;
    }
    setState(current => ({ ...current, items: result.items }));
    setProblem(null);
  }, [params, setProblem, setState, state, workshop.eventDate]);

  // Entering this step with talks still unscheduled fills the tracks, as the previous schedule page did.
  useEffect(() => {
    if (state.talks.length > 0 && unscheduledTalks(state).length > 0) fill();
  }, [fill, state]);

  const addInterval = () => {
    setState(current => addServiceInterval(current, trackId, { title: interval.title, room: interval.room, gap: params.gap, scheduleStart: params.start, eventDate: workshop.eventDate }));
    setIntervalDraft({ title: 'Pausa', room: '' });
  };

  return (
    <div className="space-y-5">
      <Panel labelledBy="fill-title" className="p-5">
        <PanelTitle id="fill-title" title="Riempi gli orari" hint="Ricalcola gli orari di ogni track da questo inizio; le pause che hai aggiunto restano al loro posto." />
        <Form onSubmit={event => { event.preventDefault(); fill(); }} className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end" aria-label="Riempi gli orari">
          <TextInput label="Inizio della track" type="time" value={params.start} onChange={start => setParams({ ...params, start })} />
          <TextInput label="Durata talk (minuti)" type="number" value={params.duration} onChange={duration => setParams({ ...params, duration })} />
          <TextInput label="Pausa tecnica (minuti)" type="number" value={params.gap} onChange={gap => setParams({ ...params, gap })} />
          <Button type="submit" className={btn.secondary}><EventIcon name="clock" />Riempi gli orari</Button>
        </Form>
      </Panel>

      {problem && <Notice tone="danger" title="L'agenda non è pronta">{problem}</Notice>}

      <Panel labelledBy="schedule-title">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
          <PanelTitle id="schedule-title" title={state.tracks.length > 1 ? `${clean(track.name) || 'Track'} (${trackIndex + 1} di ${state.tracks.length})` : clean(track.name) || 'Track 1'} hint="Orari sul giorno dell'evento" />
          {state.tracks.length > 1 && (
            <div className="flex gap-2">
              <Button onPress={() => setTrackIndex(Math.max(0, trackIndex - 1))} isDisabled={trackIndex === 0} className={btn.ghost}><AdminIcon name="back" />Track precedente</Button>
              <Button onPress={() => setTrackIndex(Math.min(state.tracks.length - 1, trackIndex + 1))} isDisabled={trackIndex >= state.tracks.length - 1} className={btn.ghost}>Track successiva<AdminIcon name="arrow" /></Button>
            </div>
          )}
        </div>
        {rows.length ? (
          <ol className="divide-y divide-line" aria-label={`Scaletta di ${clean(track.name) || 'Track'}`}>
            {rows.map((item, index) => {
              const talk = state.talks.find(value => value.workshopTalkId === item.talkId);
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
                  onRemove={isTalk ? undefined : () => setState(current => removeItem(current, item.workshopAgendaItemId))}
                />
              );
            })}
          </ol>
        ) : (
          <EmptyState icon="calendar" title="Nessuna voce in scaletta"><p>Aggiungi i talk nel passo «Elenco talk» o una pausa qui sotto.</p></EmptyState>
        )}
        <Form onSubmit={event => { event.preventDefault(); addInterval(); }} className="flex flex-wrap items-end gap-3 border-t border-line px-5 py-4" aria-label="Aggiungi pausa">
          <TextInput label="Titolo della nuova pausa" value={interval.title} onChange={title => setIntervalDraft(value => ({ ...value, title }))} />
          <TextInput label="Sala della nuova pausa" value={interval.room} onChange={room => setIntervalDraft(value => ({ ...value, room }))} />
          <Button type="submit" className={btn.secondary}><AdminIcon name="plus" />Aggiungi pausa</Button>
        </Form>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-4">
          <span className="text-sm font-semibold text-[#8a4b00]">{draft.dirty ? 'Modifiche non salvate' : ''}</span>
          <Button onPress={() => void save('schedule').then(ok => { if (ok) notify('Agenda salvata'); })} isDisabled={saving} className={btn.primary}>{saving ? 'Salvataggio…' : 'Salva agenda'}</Button>
        </div>
      </Panel>
    </div>
  );
}

// ---------- 8. Iscrizione ----------

interface TicketSales { totalCapacity: number; sold: number; pending: number; remaining: number; refreshedAt: string }

export function RegistrationStep({ page, draft }: { page: EventPage; draft: AgendaDraft }) {
  const { workshop, api } = page;
  const { state, setState } = draft;
  const { save, saving, problem } = useAgendaSave(page, draft);
  const [sales, setSales] = useState<TicketSales | null>(null);
  const [busy, setBusy] = useState<'sales' | 'capacity' | 'sync' | 'publish' | null>(null);
  const [confirmPublish, setConfirmPublish] = useState(false);
  const issues = eventbriteIssues(workshop, state);
  const id = encodeURIComponent(workshop.workshopId);
  const synced = workshop.eventbriteSyncedTicketCapacity ?? 0;
  const hasEvent = !!workshop.eventbriteEventId;
  const set = (patch: Partial<AgendaDraftState>) => setState(current => ({ ...current, ...patch }));

  const run = async (kind: NonNullable<typeof busy>, action: () => Promise<void>, failure: string) => {
    setBusy(kind);
    try {
      await action();
    } catch (error) {
      notify(failure, { description: errorText(error), kind: 'error' });
    } finally {
      setBusy(null);
    }
  };
  const refreshSales = () => run('sales', async () => {
    setSales(await api<TicketSales>(`/Eventbrite/TicketSales/${id}`));
    notify('Vendite aggiornate', { description: 'Dati letti ora da Eventbrite.' });
  }, 'Vendite non disponibili');
  const saveCapacity = () => run('capacity', async () => {
    page.replace(await api<EventRecord>(`/Eventbrite/SetTicketCapacity/${id}`, { method: 'PUT', body: JSON.stringify({ capacity: state.eventbriteTicketCapacity }) }));
    notify('Capienza salvata in locale', { description: 'Usa «Sincronizza con Eventbrite» per applicarla.' });
  }, 'Capienza non aggiornata');
  // As before: the module is saved (with its checks) and only then Eventbrite is called.
  const sync = () => run('sync', async () => {
    if (!await save('registration')) return;
    const updated = await api<EventRecord>(`/Eventbrite/Sync/${id}`, { method: 'POST' });
    page.replace(updated);
    if (updated.eventbriteEventId) notify('Evento sincronizzato con Eventbrite');
    else notify('Evento salvato', { description: 'Aggiungi sede, agenda e biglietti iniziali prima che Eventbrite possa creare la bozza.' });
  }, 'Sincronizzazione con Eventbrite non riuscita');
  const publish = () => run('publish', async () => {
    await api(`/Eventbrite/Publish/${id}`, { method: 'POST' });
    await page.reload();
    setConfirmPublish(false);
    notify('Pubblicato su Eventbrite');
  }, 'Pubblicazione su Eventbrite non riuscita');

  return (
    <div className="space-y-5">
      <Panel labelledBy="registration-title" className="space-y-4 p-5">
        <PanelTitle id="registration-title" title="Iscrizione e note per chi partecipa" hint="Salva prima in locale; Eventbrite cambia solo con «Sincronizza»." />
        {issues.length > 0 && (
          <Notice tone="warn" title="Prima di sincronizzare con Eventbrite servono:">
            <ul className="mt-1 list-disc pl-5">{issues.map(issue => <li key={issue}>{issue}</li>)}</ul>
          </Notice>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput label="Link di prenotazione e disdetta" value={state.bookingServiceUrl} onChange={bookingServiceUrl => set({ bookingServiceUrl })} placeholder="https://…" />
          <TextInput label="Biglietti gratuiti disponibili su Eventbrite" type="number" value={String(state.eventbriteTicketCapacity)} onChange={value => set({ eventbriteTicketCapacity: Math.max(0, Number.parseInt(value, 10) || 0) })} description={`Separati dai posti della sede. Aumenta il numero per liberare altri biglietti; totale già sincronizzato: ${synced}.`} />
          <TextInput label="Inizio vendite" type="datetime-local" value={state.eventbriteSalesStart} onChange={eventbriteSalesStart => set({ eventbriteSalesStart })} description="Facoltativo, nel fuso orario configurato su Eventbrite." />
          <TextInput label="Fine vendite" type="datetime-local" value={state.eventbriteSalesEnd} onChange={eventbriteSalesEnd => set({ eventbriteSalesEnd })} description="Facoltativo." />
          <div className="sm:col-span-2"><TextAreaInput label="Note per chi partecipa" rows={3} value={state.attendeeNotes} onChange={attendeeNotes => set({ attendeeNotes })} placeholder="Informazioni pratiche per chi partecipa" /></div>
        </div>
        {problem && <Notice tone="danger" title="Non salvato">{problem}</Notice>}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <span className="text-sm font-semibold text-[#8a4b00]">{draft.dirty ? 'Modifiche non salvate' : ''}</span>
          <Button onPress={() => void save('registration').then(ok => { if (ok) notify('Iscrizione e agenda salvate'); })} isDisabled={saving || busy === 'sync'} className={btn.primary}>{saving ? 'Salvataggio…' : 'Salva iscrizione e agenda'}</Button>
        </div>
      </Panel>

      <Panel labelledBy="eventbrite-title" className="space-y-4 p-5">
        <PanelTitle id="eventbrite-title" title="Eventbrite" hint={<>Stato: <strong>{eventbriteStatusLabel(workshop)}</strong>{workshop.eventbriteLastSyncedAt ? ` · ultima sincronizzazione ${formatDateTime(workshop.eventbriteLastSyncedAt)}` : ''}</>} />
        {workshop.eventbriteLastError && <Notice tone="danger" title="Ultimo errore Eventbrite">{workshop.eventbriteLastError}</Notice>}
        {sales && (
          <Notice tone="ok" title="Biglietti Eventbrite">
            Venduti {sales.sold}, in sospeso {sales.pending}, capienza {sales.totalCapacity}, disponibili {sales.remaining}. Aggiornato: {formatDateTime(sales.refreshedAt)}.
          </Notice>
        )}
        {confirmPublish ? (
          <InlineConfirm title="Pubblicare l'evento su Eventbrite?" confirmLabel="Pubblica" busyLabel="Pubblicazione…" busy={busy === 'publish'} onConfirm={() => void publish()} onCancel={() => setConfirmPublish(false)}>
            <p>È separato dalla pubblicazione sul sito: l'evento diventa visibile e prenotabile su Eventbrite.</p>
          </InlineConfirm>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {workshop.eventbriteEventUrl && <ExternalLink href={workshop.eventbriteEventUrl} className={btn.ghost}>Apri l'evento su Eventbrite</ExternalLink>}
            {hasEvent && <Button onPress={() => void refreshSales()} isDisabled={busy !== null} className={btn.ghost}><EventIcon name="refresh" />{busy === 'sales' ? 'Aggiornamento…' : 'Aggiorna le vendite'}</Button>}
            {hasEvent && state.eventbriteTicketCapacity > synced && <Button onPress={() => void saveCapacity()} isDisabled={busy !== null} className={btn.secondary}><EventIcon name="ticket" />{busy === 'capacity' ? 'Salvataggio…' : 'Salva capienza biglietti'}</Button>}
            <Button onPress={() => void sync()} isDisabled={busy !== null || saving || issues.length > 0} className={btn.secondary}>
              {busy === 'sync' ? 'Sincronizzazione…' : hasEvent ? 'Sincronizza con Eventbrite' : 'Crea la bozza su Eventbrite'}
            </Button>
            {hasEvent && !workshop.eventbritePublished && <Button onPress={() => setConfirmPublish(true)} isDisabled={busy !== null} className={btn.primary}>Pubblica su Eventbrite…</Button>}
            {workshop.eventbritePublished && <Badge kind="ok">Pubblicato su Eventbrite</Badge>}
          </div>
        )}
      </Panel>
    </div>
  );
}

// ---------- 5. Sessioni (legacy tracks) ----------

function TrackDialog({ track, speakers, onSave, onClose }: { track: LegacyTrack | null; speakers: EventSpeaker[]; onSave: (track: LegacyTrack) => Promise<boolean>; onClose: () => void }) {
  const [title, setTitle] = useState(track?.title ?? '');
  const [start, setStart] = useState(legacyInputValue(track?.startTime));
  const [end, setEnd] = useState(legacyInputValue(track?.endTime));
  const [level, setLevel] = useState(String(track?.level ?? 0));
  const [abstract, setAbstract] = useState(track?.abstract ?? '');
  const [selected, setSelected] = useState<string[]>((track?.speakers ?? []).filter(id => speakers.some(speaker => speaker.workshopSpeakerId === id)));
  const [problem, setProblem] = useState<string | null>(null);

  const save = async () => {
    // Title, start and end are required, as before; times are typed as UTC wall-clock values.
    if (!clean(title) || !start || !end) {
      setProblem('Compila titolo, inizio e fine della sessione.');
      return false;
    }
    const startTime = new Date(`${start}:00Z`);
    const endTime = new Date(`${end}:00Z`);
    if (Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime())) {
      setProblem('Indica un inizio e una fine validi.');
      return false;
    }
    const chosen = speakers.filter(speaker => selected.includes(speaker.workshopSpeakerId));
    return onSave({
      ...(track ?? { workshopTrackId: EMPTY_GUID, image: '' }),
      title: clean(title),
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      abstract,
      level: Number.parseInt(level, 10) || 0,
      speakers: chosen.map(speaker => speaker.workshopSpeakerId),
      speakersName: chosen.map(speaker => clean(speaker.name)).join(', '),
    });
  };

  return (
    <RecordModal isOpen onOpenChange={open => { if (!open) onClose(); }} label={track ? `Modifica sessione: ${clean(track.title)}` : 'Nuova sessione'}>
      <ModalHeader title={track ? 'Modifica sessione' : 'Nuova sessione'} />
      <div className="p-5 sm:p-6">
        <CardForm onSave={save} onCancel={onClose} saveLabel="Salva sessione">
          <TextInput label="Titolo" autoFocus value={title} onChange={value => { setTitle(value); setProblem(null); }} />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput label="Inizio" type="datetime-local" value={start} onChange={value => { setStart(value); setProblem(null); }} description="Ora UTC, come negli eventi storici." />
            <TextInput label="Fine" type="datetime-local" value={end} onChange={value => { setEnd(value); setProblem(null); }} />
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

export function SessionsStep({ page }: { page: EventPage }) {
  const { workshop, speakers } = page;
  const [dialog, setDialog] = useState<{ track: LegacyTrack | null } | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const tracks = [...(workshop.tracks ?? [])].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  // As before: the whole record is saved with the new track list, then read again from the server.
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
    const exists = track.workshopTrackId !== EMPTY_GUID && current.some(item => item.workshopTrackId === track.workshopTrackId);
    const next = exists ? current.map(item => (item.workshopTrackId === track.workshopTrackId ? track : item)) : [...current, track];
    const ok = await persist(next, exists ? 'Sessione aggiornata' : 'Sessione aggiunta');
    if (ok) setDialog(null);
    return ok;
  };
  const deleteTrack = async (trackId: string) => {
    const ok = await persist((workshop.tracks ?? []).filter(item => item.workshopTrackId !== trackId), 'Sessione eliminata');
    if (ok) setConfirmId(null);
  };

  return (
    <Panel labelledBy="legacy-title">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <PanelTitle id="legacy-title" title="Sessioni in formato storico" hint="Il sito le mostra finché l'evento non ha un'agenda; ogni sessione si salva subito." />
        <Button onPress={() => setDialog({ track: null })} className={btn.primary}><AdminIcon name="plus" />Aggiungi sessione</Button>
      </div>
      {tracks.length === 0 && <EmptyState icon="calendar" title="Nessuna sessione in formato storico"><p>Per i nuovi eventi usa «Elenco talk» e «Agenda e orari»; qui restano le sessioni degli eventi passati.</p></EmptyState>}
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
                    <span className="block text-sm text-muted">{[clean(track.speakersName), `Livello ${track.level ?? 0}`].filter(Boolean).join(' · ')}</span>
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

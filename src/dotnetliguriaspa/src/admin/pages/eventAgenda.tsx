import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Disclosure, DisclosureGroup, DisclosurePanel, Heading } from 'react-aria-components';
import { AdminIcon } from '../icons';
import { Badge, Panel, TextAreaInput, TextInput, btn } from '../ui';
import { notify } from '../toasts';
import { MoveButtons, restoreMoveFocus } from './listKit';
import { ExternalLink, ModalHeader, Notice, RecordModal } from './listUi';
import { CardForm, EventIcon, EventPage, InlineConfirm, NumberInput, PanelTitle, SelectInput, SpeakerPicker } from './eventKit';
import {
  AgendaDraftState, AgendaPage, AgendaTrack, EventRecord, EventSpeaker, EventTalk, LegacyTrack,
  SUGGESTED_INTERVAL_TITLE, addServiceInterval, adoptTalks, agendaProblem, agendaSaveBody, assignTalkTrack, autoFillSchedule, createId,
  detailMessage, eventbriteIssues, eventbriteStatusLabel, hasTrack, initAgenda, legacyInputValue, moveItem, removeItem, removeTalk, renameTrack,
  setTrackCount, talkSpeakersFrom, toClockTime, toStoredTime, trackItems, unscheduledTalks, updateItem, updateTalk,
} from './eventModel';

// Steps 5 (Tracks), 6 (Talk pool), 7 (Track e orari dell'agenda) and 8 (Dettagli di iscrizione): the previous
// track dialog and the previous AdminWorkshopAgenda, one component mounted for the whole wizard with its three
// pages shown in turn, the same state, saves, checks and messages.

const SESSION_TYPES = [
  { id: 'talk', label: 'Talk' },
  { id: 'panel', label: 'Panel' },
  { id: 'intro', label: 'Introduzione' },
  { id: 'other', label: 'Altro' },
];
const LISTED_SESSION_TYPES = [...SESSION_TYPES.slice(0, 3), { id: 'service', label: 'Servizio' }, SESSION_TYPES[3]];
const IMPORT_SOURCES = [{ id: 'none', label: 'Nessuno' }, { id: 'sessionize', label: 'Sessionize' }];
const EMPTY_GUID = '00000000-0000-0000-0000-000000000000';
/** Legacy track times as the previous admin printed them (UTC wall clock). */
const legacyDateTime = (value: string) => new Date(value).toLocaleString('it-IT', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });

/** The module state read from the record, and the schedule start the first item suggests. */
const stateOf = (workshop: EventRecord): { state: AgendaDraftState; scheduleStart: string } => {
  const { scheduleStart, ...state } = initAgenda(workshop);
  return { state, scheduleStart };
};
const trackOptions = (tracks: AgendaTrack[]) => tracks.map(track => ({ id: track.workshopAgendaTrackId, label: track.name ?? '' }));
/** The pool's "Select a track" entry: choosing it leaves the talk without a track, as before. */
const NO_TRACK = '__no-track__';
const SPEAKERS_PATH = '/Speaker/Get?onlyActive=true';
/** A call of the import, its failure worded as the previous reportError with that call's fallback. */
const worded = async <T,>(call: Promise<T>, fallback: string): Promise<T> => {
  try {
    return await call;
  } catch (error) {
    throw new Error(detailMessage(error, fallback), { cause: error });
  }
};
/**
 * Directory speakers of a talk: matched by id, or by name when the talk speaker has no id. As in the previous
 * autocomplete, only these are shown, and choosing speakers replaces the talk's list with them.
 */
const matchedSpeakerIds = (talk: EventTalk, speakers: EventSpeaker[]) =>
  (talk.speakers ?? []).flatMap(talkSpeaker => {
    const speaker = speakers.find(value => value.workshopSpeakerId === talkSpeaker.workshopSpeakerId || (!talkSpeaker.workshopSpeakerId && value.name === talkSpeaker.name));
    return speaker ? [speaker.workshopSpeakerId] : [];
  });

interface TicketSales { totalCapacity: number; sold: number; pending: number; remaining: number; refreshedAt: string }

export function AgendaModule({ page, activePage }: { page: EventPage; activePage: AgendaPage | null }) {
  const { workshop, speakers, api } = page;
  const [state, setState] = useState<AgendaDraftState>(() => stateOf(workshop).state);
  const { talks, tracks, items } = state;
  const [eventbriteSales, setEventbriteSales] = useState<TicketSales | null>(null);
  const [refreshingSales, setRefreshingSales] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [importSource, setImportSource] = useState<'none' | 'sessionize'>('none');
  const [sessionizeId, setSessionizeId] = useState('');
  const [talkTitleDraft, setTalkTitleDraft] = useState('');
  const [talkAbstract, setTalkAbstract] = useState('');
  const [talkType, setTalkType] = useState('talk');
  const [talkSpeakerIds, setTalkSpeakerIds] = useState<string[]>([]);
  const [talkTrackId, setTalkTrackId] = useState<string | null>(null);
  const [trackIndex, setTrackIndex] = useState(0);
  const [scheduleStart, setScheduleStart] = useState('09:00');
  const [talkDuration, setTalkDuration] = useState('60');
  const [gapDuration, setGapDuration] = useState('5');
  const [intervalTitle, setIntervalTitle] = useState(SUGGESTED_INTERVAL_TITLE);
  const [itemRoom, setItemRoom] = useState('');
  const [busy, setBusy] = useState(false);
  const skipInit = useRef(false);
  const refocus = useRef<{ id: string; delta: -1 | 1 } | null>(null);

  // As before: the module starts again from the workshop whenever the record changes.
  useEffect(() => {
    if (skipInit.current) { skipInit.current = false; return; }
    const { state: next, scheduleStart: start } = stateOf(workshop);
    setState(next);
    setTrackIndex(0);
    setTalkTrackId(next.tracks.length === 1 ? next.tracks[0].workshopAgendaTrackId : null);
    if (next.items.length > 0) setScheduleStart(start);
    setEventbriteSales(null);
  }, [workshop]);

  useEffect(() => {
    if (!refocus.current) return;
    restoreMoveFocus(refocus.current.id, refocus.current.delta);
    refocus.current = null;
  }, [items]);

  const set = (patch: Partial<AgendaDraftState>) => setState(current => ({ ...current, ...patch }));
  const message = (text: string, error = false) => notify(text, error ? { kind: 'error' } : undefined);

  const handleImport = async () => {
    if (importSource === 'none') return;
    setBusy(true);
    try {
      const workshopPath = encodeURIComponent(workshop.workshopId);
      await worded(api(`/Workshop/ImportSessionize/${workshopPath}`, { method: 'POST', body: JSON.stringify({ sessionizeId: sessionizeId.trim() }) }), 'Importazione da Sessionize non riuscita');
      const refreshed = await worded(api<EventRecord>(`/Workshop/Get/${workshopPath}`), 'Impossibile ricaricare i talk importati');
      // The imported talks replace the local ones; unsaved tracks and items stay. The page record follows the
      // server's talks too, so the final "Salva modifiche" cannot revert the import.
      skipInit.current = true;
      setState(current => ({ ...current, talks: adoptTalks(refreshed.talks, current.tracks) }));
      page.commitRecord({ ...page.current(), talks: refreshed.talks ?? [] });
      page.setSpeakers(await worded(api<EventSpeaker[]>(SPEAKERS_PATH), 'Impossibile ricaricare i relatori importati') ?? []);
      message('Talk importati da Sessionize e schede dei relatori corrispondenti aggiornate.');
    } catch (error) {
      message(error instanceof Error ? error.message : 'Importazione da Sessionize non riuscita', true);
    } finally {
      setBusy(false);
    }
  };

  const handleAddTalk = () => {
    if (!talkTitleDraft.trim()) return message('Inserisci un titolo per il talk.', true);
    if (talkSpeakerIds.length === 0) return message("Seleziona almeno un relatore dall'anagrafica relatori.", true);
    if (tracks.length > 1 && !talkTrackId) return message('Seleziona una track per questo talk.', true);
    const chosen = speakers.filter(speaker => talkSpeakerIds.includes(speaker.workshopSpeakerId));
    set({ talks: [...talks, {
      workshopTalkId: createId(),
      trackId: tracks.length === 1 ? tracks[0].workshopAgendaTrackId : talkTrackId || null,
      title: talkTitleDraft.trim(),
      abstract: talkAbstract,
      sessionType: talkType,
      speakers: talkSpeakersFrom(chosen),
    }] });
    setTalkTitleDraft('');
    setTalkAbstract('');
    setTalkSpeakerIds([]);
    message("Talk aggiunto al pool dell'evento. Salva il talk pool per renderlo definitivo.");
  };

  const handleTrackCount = (count: number) => {
    const next = setTrackCount(state, count);
    setState(next);
    setTalkTrackId(next.tracks.length === 1 ? next.tracks[0].workshopAgendaTrackId : null);
    setTrackIndex(current => Math.min(current, next.tracks.length - 1));
  };

  const handleAutoFillSchedule = useCallback(() => {
    const result = autoFillSchedule(state, { start: scheduleStart, duration: talkDuration, gap: gapDuration }, workshop.eventDate);
    if ('error' in result) return message(result.error, true);
    setState(current => ({ ...current, items: result.items }));
    message("Orari delle track riempiti dall'ora di inizio e dalle durate selezionate. Sistema sessioni o intervalli qui sotto.");
  }, [gapDuration, scheduleStart, state, talkDuration, workshop.eventDate]);

  // As before: the schedule page fills the tracks as soon as it is shown with talks still unscheduled.
  useEffect(() => {
    if (activePage === 'schedule' && talks.length > 0 && unscheduledTalks(state).length > 0) handleAutoFillSchedule();
  }, [activePage, handleAutoFillSchedule, state, talks.length]);

  const handleAddServiceInterval = () => {
    const track = tracks[trackIndex];
    if (!track) return;
    setState(current => addServiceInterval(current, track.workshopAgendaTrackId, { title: intervalTitle, room: itemRoom, gap: gapDuration, scheduleStart, eventDate: workshop.eventDate }));
    setIntervalTitle(SUGGESTED_INTERVAL_TITLE);
    setItemRoom('');
    message('Intervallo di servizio aggiunto. Sistema orario e posizione negli orari della track.');
  };

  const setSpeakersOf = (talk: EventTalk, ids: string[]) => {
    const chosen = speakers.filter(speaker => ids.includes(speaker.workshopSpeakerId));
    setState(current => updateTalk(current, talk.workshopTalkId, { speakers: talkSpeakersFrom(chosen) }));
  };

  /** The previous handleSave: the page's checks, then one PUT of the whole record; the record then reads update-pending. */
  const handleSave = async (): Promise<boolean> => {
    const problem = agendaProblem(state, activePage ?? 'registration');
    if (problem) {
      message(problem, true);
      return false;
    }
    return page.save(latest => agendaSaveBody(latest, state), {
      success: "Dettagli dell'evento e agenda salvati.",
      failure: error => detailMessage(error, "Impossibile salvare l'agenda dell'evento"),
    });
  };

  const handleSetEventbriteCapacity = async () => {
    setBusy(true);
    try {
      page.replace(await api<EventRecord>(`/Eventbrite/SetTicketCapacity/${encodeURIComponent(workshop.workshopId)}`, { method: 'PUT', body: JSON.stringify({ capacity: state.eventbriteTicketCapacity }) }));
      message('Capienza biglietti salvata in locale. Usa Sincronizza/Aggiorna Eventbrite per applicarla.');
    } catch (error) {
      message(detailMessage(error, 'Impossibile aggiornare la disponibilità dei biglietti Eventbrite'), true);
    } finally {
      setBusy(false);
    }
  };

  const handleRefreshEventbriteSales = async () => {
    setRefreshingSales(true);
    try {
      setEventbriteSales(await api<TicketSales>(`/Eventbrite/TicketSales/${encodeURIComponent(workshop.workshopId)}`));
      message('Vendite live dei biglietti Eventbrite aggiornate.');
    } catch (error) {
      message(detailMessage(error, 'Impossibile aggiornare le vendite dei biglietti Eventbrite'), true);
    } finally {
      setRefreshingSales(false);
    }
  };

  const handleSyncEventbrite = async () => {
    setSyncing(true);
    try {
      if (!await handleSave()) return;
      const updated = await api<EventRecord>(`/Eventbrite/Sync/${encodeURIComponent(workshop.workshopId)}`, { method: 'POST' });
      page.replace(updated);
      message(updated.eventbriteEventId
        ? 'Evento Eventbrite sincronizzato.'
        : 'Evento salvato. Aggiungi sede, agenda e quantità iniziale di biglietti prima che Eventbrite possa creare una bozza.');
    } catch (error) {
      message(detailMessage(error, 'Sincronizzazione Eventbrite non riuscita'), true);
    } finally {
      setSyncing(false);
    }
  };

  const handlePublishEventbrite = async () => {
    setPublishing(true);
    try {
      await api(`/Eventbrite/Publish/${encodeURIComponent(workshop.workshopId)}`, { method: 'POST' });
      await page.refresh();
      setConfirmPublish(false);
      message('Evento pubblicato su Eventbrite.');
    } catch (error) {
      message(detailMessage(error, 'Pubblicazione su Eventbrite non riuscita'), true);
    } finally {
      setPublishing(false);
    }
  };

  const readinessIssues = eventbriteIssues(workshop, state);
  const synced = workshop.eventbriteSyncedTicketCapacity ?? 0;
  const minimumCapacity = Math.max(synced, (eventbriteSales?.sold ?? 0) + (eventbriteSales?.pending ?? 0));
  const saving = busy || page.saving;
  const currentTrack = tracks[Math.min(trackIndex, tracks.length - 1)];
  const currentRows = currentTrack ? trackItems(state, currentTrack.workshopAgendaTrackId) : [];

  return (
    <div className="space-y-5">
      <Panel hidden={activePage !== 'registration'} labelledBy="registration-title" className="space-y-4 p-5 sm:p-6">
        <PanelTitle id="registration-title" title="Iscrizione e dettagli dei partecipanti" />
        <p className="text-sm text-muted">Salva prima in locale le modifiche all'evento e all'agenda. Eventbrite cambia solo quando selezioni Sincronizza/Aggiorna qui sotto.</p>
        {readinessIssues.length > 0 && (
          <Notice tone="info" title="Richiesto prima che Eventbrite possa essere sincronizzato">
            <ul className="mt-1 list-disc pl-5">{readinessIssues.map(issue => <li key={issue}>{issue}</li>)}</ul>
          </Notice>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput label="URL di prenotazione e cancellazione del posto" value={state.bookingServiceUrl} onChange={bookingServiceUrl => set({ bookingServiceUrl })} />
          <NumberInput label="Biglietti gratuiti Eventbrite disponibili" min={minimumCapacity} value={String(state.eventbriteTicketCapacity)} onChange={value => set({ eventbriteTicketCapacity: Math.max(0, Number.parseInt(value, 10) || 0) })} description={`Separati dalla capienza della sede. Aumenta questo valore per liberare altri biglietti; totale attualmente sincronizzato: ${synced}.`} />
          <TextInput label="Inizio vendita biglietti Eventbrite" type="datetime-local" value={state.eventbriteSalesStart} onChange={eventbriteSalesStart => set({ eventbriteSalesStart })} description="Facoltativo; interpretato nel fuso orario configurato di Eventbrite." />
          <TextInput label="Fine vendita biglietti Eventbrite" type="datetime-local" value={state.eventbriteSalesEnd} onChange={eventbriteSalesEnd => set({ eventbriteSalesEnd })} description="Facoltativo; interpretato nel fuso orario configurato di Eventbrite." />
          <div className="sm:col-span-2"><TextAreaInput label="Note per i partecipanti" rows={2} value={state.attendeeNotes} onChange={attendeeNotes => set({ attendeeNotes })} /></div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm">
            Stato Eventbrite: {eventbriteStatusLabel(workshop)}
            {workshop.eventbriteLastSyncedAt ? ` · Ultima sincronizzazione ${new Date(workshop.eventbriteLastSyncedAt).toLocaleString('it-IT')}` : ''}
          </p>
          {workshop.eventbriteEventUrl && <ExternalLink href={workshop.eventbriteEventUrl} className={btn.ghost}>Apri l'evento Eventbrite</ExternalLink>}
          {workshop.eventbriteEventId && (
            <Button onPress={() => void handleRefreshEventbriteSales()} isDisabled={refreshingSales || saving} className={btn.secondary}><EventIcon name="refresh" />{refreshingSales ? 'Aggiornamento delle vendite dei biglietti…' : 'Aggiorna le vendite live dei biglietti'}</Button>
          )}
          {eventbriteSales && (
            <p role="status" className="w-full rounded-xl bg-cyan-50 p-4 text-cyan-700">
              Biglietti Eventbrite — venduti: {eventbriteSales.sold}, in sospeso: {eventbriteSales.pending}, capienza totale: {eventbriteSales.totalCapacity}, rimanenti: {eventbriteSales.remaining}. Aggiornato {new Date(eventbriteSales.refreshedAt).toLocaleString('it-IT')}.
            </p>
          )}
          <Button onPress={() => void handleSave()} isDisabled={saving || syncing} className={btn.primary}>Salva iscrizione e agenda</Button>
          {workshop.eventbriteEventId && state.eventbriteTicketCapacity > synced && (
            <Button onPress={() => void handleSetEventbriteCapacity()} isDisabled={saving} className={btn.secondary}><EventIcon name="ticket" />Salva capienza biglietti</Button>
          )}
          <Button onPress={() => void handleSyncEventbrite()} isDisabled={saving || syncing || readinessIssues.length > 0} className={btn.secondary}>
            {syncing ? 'Sincronizzazione…' : workshop.eventbriteEventId ? 'Sincronizza/Aggiorna Eventbrite' : 'Crea bozza Eventbrite'}
          </Button>
          {workshop.eventbriteEventId && !workshop.eventbritePublished && !confirmPublish && (
            <Button onPress={() => setConfirmPublish(true)} isDisabled={saving || publishing} className={btn.primary}>{publishing ? 'Pubblicazione…' : 'Pubblica su Eventbrite'}</Button>
          )}
          {confirmPublish && (
            <div className="w-full">
              <InlineConfirm title="Pubblicare questo evento su Eventbrite? È separato dalla pubblicazione dell'evento su questo sito." confirmLabel="OK" busyLabel="Pubblicazione…" busy={publishing} onConfirm={() => void handlePublishEventbrite()} onCancel={() => setConfirmPublish(false)} />
            </div>
          )}
          {workshop.eventbritePublished && <Badge kind="ok">Pubblicato su Eventbrite</Badge>}
          {workshop.eventbriteLastError && <div className="w-full"><Notice tone="danger" title={workshop.eventbriteLastError} /></div>}
        </div>
      </Panel>

      <Panel hidden={activePage !== 'talks'} labelledBy="talk-pool-title" className="space-y-4 p-5 sm:p-6">
        <PanelTitle id="talk-pool-title" title="Talk pool" />
        <h3 className="font-bold">Importa talk</h3>
        <div className="grid items-end gap-3 md:grid-cols-[1fr_2fr_auto]">
          <SelectInput label="Importa da" items={IMPORT_SOURCES} selectedKey={importSource} onSelectionChange={key => setImportSource(key === 'sessionize' ? 'sessionize' : 'none')} />
          {importSource === 'sessionize' && <TextInput label="ID Sessionize" value={sessionizeId} onChange={setSessionizeId} placeholder="ID evento" />}
          {importSource === 'sessionize' && <Button onPress={() => void handleImport()} isDisabled={saving || !sessionizeId.trim()} className={btn.secondary}><AdminIcon name="download" />Importa talk</Button>}
        </div>
        <hr className="border-line" />
        <h3 className="font-bold">Tracks</h3>
        <NumberInput label="Numero di track" min={1} value={String(tracks.length)} onChange={value => handleTrackCount(Number(value) || 1)} className="block sm:max-w-xs" />
        <div className="grid gap-3">
          {tracks.map((track, index) => (
            <TextInput key={track.workshopAgendaTrackId} label={`Nome track ${index + 1}`} value={track.name ?? ''} onChange={name => setState(current => renameTrack(current, track.workshopAgendaTrackId, name))} />
          ))}
        </div>
        <hr className="border-line" />
        <h3 className="font-bold">Crea un talk</h3>
        <div className="grid gap-3" role="group" aria-label="Crea un talk">
          <TextInput label="Titolo del talk" value={talkTitleDraft} onChange={setTalkTitleDraft} />
          <TextAreaInput label="Abstract" rows={2} value={talkAbstract} onChange={setTalkAbstract} />
          <SelectInput label="Tipo di sessione" items={SESSION_TYPES} selectedKey={talkType} onSelectionChange={key => setTalkType(key ?? 'talk')} className="block sm:max-w-xs" />
          <SpeakerPicker label="Relatori" placeholder="Seleziona uno o più relatori" speakers={speakers} selectedIds={talkSpeakerIds} onChange={setTalkSpeakerIds} collapsed />
          {tracks.length > 1 && <SelectInput label="Track" items={trackOptions(tracks)} selectedKey={hasTrack(state, talkTrackId) ? talkTrackId : null} onSelectionChange={setTalkTrackId} placeholder="" className="block sm:max-w-xs" />}
          {tracks.length === 1 && <p className="text-muted">I talk sono assegnati a {tracks[0].name} automaticamente.</p>}
          <div><Button onPress={handleAddTalk} className={btn.secondary}>Aggiungi talk al pool</Button></div>
        </div>
        <h3 className="font-bold">Talk nel pool</h3>
        <ul className="grid gap-3" aria-label="Talk nel pool">
          {talks.map(talk => (
            <li key={talk.workshopTalkId} className="grid gap-3 rounded-xl border border-line p-4 md:grid-cols-[minmax(0,1fr)_auto]">
              <div className="grid gap-3">
                <TextInput label="Titolo del talk" value={talk.title ?? ''} onChange={title => setState(current => updateTalk(current, talk.workshopTalkId, { title }))} />
                <TextAreaInput label="Abstract" rows={2} value={talk.abstract ?? ''} onChange={abstract => setState(current => updateTalk(current, talk.workshopTalkId, { abstract }))} />
                <SelectInput label="Tipo di sessione" items={LISTED_SESSION_TYPES} selectedKey={talk.sessionType || 'talk'} onSelectionChange={sessionType => setState(current => updateTalk(current, talk.workshopTalkId, { sessionType: sessionType ?? 'talk' }))} className="block sm:max-w-xs" />
                <SpeakerPicker label="Relatori" placeholder="Seleziona uno o più relatori" speakers={speakers} selectedIds={matchedSpeakerIds(talk, speakers)} onChange={ids => setSpeakersOf(talk, ids)} collapsed />
                {tracks.length > 1
                  ? <SelectInput label="Track" items={[{ id: NO_TRACK, label: 'Seleziona una track' }, ...trackOptions(tracks)]} selectedKey={hasTrack(state, talk.trackId) ? talk.trackId! : null} onSelectionChange={trackId => setState(current => assignTalkTrack(current, talk.workshopTalkId, trackId === NO_TRACK ? null : trackId))} placeholder="" className="block sm:max-w-xs" />
                  : <p className="text-muted">{tracks[0]?.name ?? 'Track 1'}</p>}
              </div>
              <div><Button onPress={() => setState(current => removeTalk(current, talk.workshopTalkId))} className={`${btn.ghost} text-[#b42318] data-[hovered]:bg-[#fdecea]`}>Rimuovi</Button></div>
            </li>
          ))}
        </ul>
        <div><Button onPress={() => void handleSave()} isDisabled={saving} className={btn.primary}>Salva talk pool</Button></div>
      </Panel>

      <Panel hidden={activePage !== 'schedule'} labelledBy="schedule-title" className="space-y-4 p-5 sm:p-6">
        <PanelTitle id="schedule-title" title="Orari della track" />
        <div className="grid gap-3 sm:grid-cols-3">
          <TextInput label="Ora di inizio della track" type="time" value={scheduleStart} onChange={setScheduleStart} />
          <NumberInput label="Durata talk (minuti)" min={1} value={talkDuration} onChange={setTalkDuration} />
          <NumberInput label="Durata pausa (minuti)" min={1} value={gapDuration} onChange={setGapDuration} />
        </div>
        <div><Button onPress={handleAutoFillSchedule} className={btn.secondary}><EventIcon name="clock" />Riempi automaticamente gli orari delle track</Button></div>
        {tracks.length > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button onPress={() => setTrackIndex(index => Math.max(0, index - 1))} isDisabled={trackIndex === 0} className={btn.ghost}><AdminIcon name="back" />Track precedente</Button>
            <h3 className="text-lg font-bold">{currentTrack?.name} ({Math.min(trackIndex, tracks.length - 1) + 1} di {tracks.length})</h3>
            <Button onPress={() => setTrackIndex(index => Math.min(tracks.length - 1, index + 1))} isDisabled={trackIndex >= tracks.length - 1} className={btn.ghost}>Track successiva<AdminIcon name="arrow" /></Button>
          </div>
        )}
        {tracks.length === 1 && <h3 className="text-lg font-bold">{tracks[0].name}</h3>}
        <ol className="grid gap-3" aria-label={`Orari di ${currentTrack?.name ?? ''}`}>
          {currentRows.map((item, index) => {
            const talk = talks.find(value => value.workshopTalkId === item.talkId);
            const itemTitle = talk?.title ?? item.title ?? item.itemType ?? '';
            return (
              <li key={item.workshopAgendaItemId} className="grid gap-2 rounded-xl border border-line p-4">
                <div role="group" aria-label="Titolo e controlli della voce" className="flex items-center gap-2">
                  <h4 className="min-w-0 flex-1 text-lg font-bold [overflow-wrap:anywhere]">{itemTitle}</h4>
                  <MoveButtons id={item.workshopAgendaItemId} name={itemTitle} index={index} count={currentRows.length} onMove={delta => { refocus.current = { id: item.workshopAgendaItemId, delta }; setState(current => moveItem(current, currentTrack.workshopAgendaTrackId, item.workshopAgendaItemId, delta)); }} />
                  {item.itemType !== 'talk' && <Button onPress={() => setState(current => removeItem(current, item.workshopAgendaItemId))} className={`${btn.ghost} text-[#b42318] data-[hovered]:bg-[#fdecea]`}>Rimuovi intervallo</Button>}
                </div>
                <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-4">
                  <div role="group" aria-label="Orari della voce" className="grid grid-cols-2 gap-2 sm:col-span-2">
                    {/* A cleared time is stored as it is (not a valid time), so the save refuses it, as before. */}
                    <TextInput label="Ora di inizio" type="time" value={toClockTime(item.startTime)} onChange={value => setState(current => updateItem(current, item.workshopAgendaItemId, { startTime: toStoredTime(value, item.startTime, workshop.eventDate) }))} />
                    <TextInput label="Ora di fine" type="time" value={toClockTime(item.endTime)} onChange={value => setState(current => updateItem(current, item.workshopAgendaItemId, { endTime: toStoredTime(value, item.endTime, workshop.eventDate) }))} />
                  </div>
                  <TextInput label="Nome sala" value={item.roomName ?? ''} onChange={roomName => setState(current => updateItem(current, item.workshopAgendaItemId, { roomName }))} />
                  {item.itemType !== 'talk' && <TextInput label="Titolo servizio / intervallo" value={item.title ?? ''} onChange={title => setState(current => updateItem(current, item.workshopAgendaItemId, { title }))} />}
                </div>
              </li>
            );
          })}
        </ol>
        <div className="grid items-end gap-3 sm:grid-cols-[2fr_1fr_auto]">
          <TextInput label="Titolo intervallo di servizio" value={intervalTitle} onChange={setIntervalTitle} />
          <TextInput label="Sala (facoltativa)" value={itemRoom} onChange={setItemRoom} />
          <Button onPress={handleAddServiceInterval} className={btn.secondary}>Aggiungi intervallo di servizio</Button>
        </div>
        <div><Button onPress={() => void handleSave()} isDisabled={saving} className={btn.primary}>Salva agenda</Button></div>
      </Panel>
    </div>
  );
}

// ---------- 5. Tracks (legacy tracks) ----------

function TrackDialog({ track, speakers, onSave, onClose }: { track: LegacyTrack | null; speakers: EventSpeaker[]; onSave: (track: LegacyTrack) => Promise<boolean>; onClose: () => void }) {
  const [title, setTitle] = useState(track?.title ?? '');
  const [start, setStart] = useState(legacyInputValue(track?.startTime));
  const [end, setEnd] = useState(legacyInputValue(track?.endTime));
  const [level, setLevel] = useState(track?.level?.toString() || '0');
  const [abstract, setAbstract] = useState(track?.abstract ?? '');
  const [selected, setSelected] = useState<string[]>((track?.speakers ?? []).filter(id => speakers.some(speaker => speaker.workshopSpeakerId === id)));

  const save = async () => {
    if (!title || !start || !end) {
      notify('Compila tutti i campi obbligatori', { kind: 'error' });
      return false;
    }
    // As before: the datetime-local values are stored as UTC.
    const chosen = speakers.filter(speaker => selected.includes(speaker.workshopSpeakerId));
    return onSave({
      ...(track ?? { workshopTrackId: EMPTY_GUID, image: '' }),
      title,
      startTime: new Date(`${start}:00Z`).toISOString(),
      endTime: new Date(`${end}:00Z`).toISOString(),
      abstract,
      level: Number.parseInt(level, 10),
      speakers: chosen.map(speaker => speaker.workshopSpeakerId),
      speakersName: chosen.map(speaker => speaker.name).join(', '),
    });
  };

  return (
    <RecordModal isOpen onOpenChange={open => { if (!open) onClose(); }} label={track ? 'Modifica track' : 'Aggiungi nuova track'}>
      <ModalHeader title={track ? 'Modifica track' : 'Aggiungi nuova track'} />
      <div className="p-5 sm:p-6">
        <CardForm onSave={save} onCancel={onClose} saveLabel="Salva track">
          <TextInput label="Titolo" isRequired autoFocus value={title} onChange={setTitle} placeholder="Titolo della track" />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput label="Ora di inizio" isRequired type="datetime-local" value={start} onChange={setStart} />
            <TextInput label="Ora di fine" isRequired type="datetime-local" value={end} onChange={setEnd} />
          </div>
          <TextInput label="Livello" type="number" value={level} onChange={setLevel} placeholder="0" />
          <TextAreaInput label="Abstract" rows={4} value={abstract} onChange={setAbstract} placeholder="Abstract della track" />
          <SpeakerPicker label="Relatori" placeholder="Seleziona i relatori" speakers={speakers} selectedIds={selected} onChange={setSelected} />
        </CardForm>
      </div>
    </RecordModal>
  );
}

/** Track times as the previous accordion printed them (UTC wall clock). */
function TrackDetails({ track }: { track: LegacyTrack }) {
  return (
    <dl className="grid gap-2 text-sm md:grid-cols-2">
      <div><dt className="text-muted">Ora di inizio</dt><dd>{legacyDateTime(track.startTime)}</dd></div>
      <div><dt className="text-muted">Ora di fine</dt><dd>{legacyDateTime(track.endTime)}</dd></div>
      <div className="md:col-span-2"><dt className="text-muted">Livello</dt><dd>{track.level}</dd></div>
      {track.speakersName && <div className="md:col-span-2"><dt className="text-muted">Relatori</dt><dd>{track.speakersName}</dd></div>}
      {track.abstract && <div className="md:col-span-2"><dt className="text-muted">Abstract</dt><dd>{track.abstract}</dd></div>}
    </dl>
  );
}

export function TracksStep({ page }: { page: EventPage }) {
  const { workshop, speakers } = page;
  const [dialog, setDialog] = useState<{ track: LegacyTrack | null } | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const tracks = [...(workshop.tracks ?? [])].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  // As before: the whole record is saved with the new track list, then read again from the server.
  const persist = async (next: (current: LegacyTrack[]) => LegacyTrack[], success: string, failure: string) => {
    if (page.saving) return false;
    setBusy(true);
    try {
      const ok = await page.save(latest => ({ ...latest, tracks: next(latest.tracks ?? []) }), { success, failure: () => failure });
      if (ok) await page.refresh();
      return ok;
    } finally {
      setBusy(false);
    }
  };
  const saveTrack = async (track: LegacyTrack) => {
    const exists = track.workshopTrackId !== EMPTY_GUID && (workshop.tracks ?? []).some(item => item.workshopTrackId === track.workshopTrackId);
    const ok = await persist(
      current => (exists ? current.map(item => (item.workshopTrackId === track.workshopTrackId ? track : item)) : [...current, track]),
      exists ? 'Track aggiornata correttamente' : 'Track aggiunta correttamente',
      exists ? "Errore nell'aggiornamento della track" : "Errore nell'aggiunta della track",
    );
    if (ok) setDialog(null);
    return ok;
  };
  const deleteTrack = async (trackId: string) => {
    const ok = await persist(current => current.filter(item => item.workshopTrackId !== trackId), 'Track eliminata correttamente', "Errore nell'eliminazione della track");
    if (ok) setConfirmId(null);
  };

  return (
    <Panel labelledBy="tracks-title" className="p-5 sm:p-6">
      <PanelTitle id="tracks-title" title="Tracks" actions={<Button onPress={() => setDialog({ track: null })} isDisabled={page.saving} className={btn.primary}><AdminIcon name="plus" />Aggiungi</Button>} />
      {tracks.length > 0 ? (
        // The previous accordion: one track open at a time, the summary row always visible.
        <DisclosureGroup className="mt-4 space-y-2">
          {tracks.map(track => (
            confirmId === track.workshopTrackId ? (
              <div key={track.workshopTrackId} className="rounded-xl border border-line border-l-4 border-l-basil-700 p-4">
                <InlineConfirm title="Vuoi davvero eliminare questa track?" confirmLabel="OK" busy={busy} onConfirm={() => void deleteTrack(track.workshopTrackId)} onCancel={() => setConfirmId(null)} />
              </div>
            ) : (
              <Disclosure key={track.workshopTrackId} id={track.workshopTrackId} className="group rounded-xl border border-line border-l-4 border-l-basil-700">
                <div className="relative flex min-h-14 items-center gap-1 py-1 pr-2 pl-4">
                  <Heading level={3} className="min-w-0 flex-1 text-lg font-bold">
                    <Button slot="trigger" className="w-full cursor-pointer py-2 text-left outline-none after:absolute after:inset-0 after:rounded-[10px] data-[focus-visible]:after:outline-3 data-[focus-visible]:after:outline-offset-2 data-[focus-visible]:after:outline-cyan-700">{track.title}</Button>
                  </Heading>
                  <Button onPress={() => setDialog({ track })} aria-label={`Modifica: ${track.title}`} className={`relative z-10 ${btn.icon}`}><AdminIcon name="pencil" /></Button>
                  <Button onPress={() => setConfirmId(track.workshopTrackId)} aria-label={`Elimina: ${track.title}`} className={`relative z-10 ${btn.icon}`}><AdminIcon name="trash" /></Button>
                  <AdminIcon name="chevron" className="pointer-events-none mx-2 size-5 text-muted transition-transform group-data-[expanded]:rotate-180 motion-reduce:transition-none" />
                </div>
                <DisclosurePanel className="px-4 pb-4">
                  <TrackDetails track={track} />
                </DisclosurePanel>
              </Disclosure>
            )
          ))}
        </DisclosureGroup>
      ) : <p className="py-8 text-center text-muted">Nessuna track disponibile. Clicca su «Aggiungi track» per crearne una.</p>}
      {dialog && <TrackDialog track={dialog.track} speakers={speakers} onSave={saveTrack} onClose={() => setDialog(null)} />}
    </Panel>
  );
}

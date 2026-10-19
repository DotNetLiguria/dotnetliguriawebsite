import React, { useMemo, useState } from 'react';
import { PermissionGate, useCan } from '../../account/PermissionGate';
import { Link, useSearchParams } from 'react-router-dom';
import { Button, Form } from 'react-aria-components';
import { AdminIcon } from '../icons';
import { Badge, EmptyState, LoadError, PageHeader, Panel, TextInput, btn, linkFocus } from '../ui';
import { AdminApiError, AdminWorkshop, clean, nameKey, useAdminFetch, useAdminLoad } from '../adminApi';
import { notify } from '../toasts';
import { formatDate } from '../../site/format';
import type { VenueModel } from '../../models/VenueModel';
import { ExternalLink, ModalHeader, Notice, RecordModal, RowMenu, SearchBox, Skeleton, plural, table } from './listUi';

// Venues saved for reuse when creating an event: /api/Venue (GET, POST, PUT /{id}, DELETE /{id}).
// The card opens from the address (?sede=<id> or ?sede=nuova) so it survives reloads and can be linked.

const errorText = (error: unknown) => (error instanceof AdminApiError ? error.message : 'Errore di rete');
const monthYear = new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', month: 'long', year: 'numeric' });

/** "44.4056, 8.9463" (also separated by ; or spaces) in decimal degrees within the valid ranges. */
export function parseCoordinates(text?: string | null): { lat: number; lng: number } | null {
  const parts = clean(text).split(/\s*[,;]\s*|\s+/).filter(Boolean);
  if (parts.length !== 2 || !parts.every(part => /^-?\d+(\.\d+)?$/.test(part))) return null;
  const [lat, lng] = parts.map(Number);
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
}

export const isHttpUrl = (text: string) => {
  try {
    const url = new URL(text);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
};

/** The saved Google Maps link, or one built from the coordinates. */
export function mapsHref(venue: Pick<VenueModel, 'googleMapsUrl' | 'coordinates'>): string | null {
  const url = clean(venue.googleMapsUrl);
  if (url && isHttpUrl(url)) return url;
  const point = parseCoordinates(venue.coordinates);
  return point ? `https://www.google.com/maps?q=${point.lat},${point.lng}` : null;
}

export interface PastVenue {
  key: string;
  name: string;
  address: string;
  coordinates: string;
  googleMapsUrl: string;
  maximumSpaces: number;
  events: number;
  last: string;
}

type PastLocation = NonNullable<AdminWorkshop['location']> & { maximumSpaces?: number | null };

/** Distinct venues used by the archived events, newest first; details come from the most recent event that has them. */
export function pastVenuesOf(workshops: AdminWorkshop[]): PastVenue[] {
  const map = new Map<string, PastVenue>();
  for (const w of [...workshops].sort((a, b) => b.eventDate.localeCompare(a.eventDate))) {
    const location = w.location as PastLocation | null | undefined;
    const name = clean(location?.name);
    if (!name) continue;
    const key = nameKey(name);
    const venue = map.get(key) ?? { key, name, address: '', coordinates: '', googleMapsUrl: '', maximumSpaces: 0, events: 0, last: w.eventDate };
    venue.events += 1;
    venue.address ||= clean(location?.address);
    venue.coordinates ||= clean(location?.coordinates);
    venue.googleMapsUrl ||= clean(location?.googleMapsUrl);
    venue.maximumSpaces ||= location?.maximumSpaces ?? 0;
    map.set(key, venue);
  }
  return [...map.values()];
}

interface EventRef { workshopId: string; title: string; date: string }

function eventsByVenue(workshops: AdminWorkshop[]) {
  const map = new Map<string, EventRef[]>();
  for (const w of [...workshops].sort((a, b) => b.eventDate.localeCompare(a.eventDate))) {
    const key = nameKey(w.location?.name);
    if (key) map.set(key, [...(map.get(key) ?? []), { workshopId: w.workshopId, title: clean(w.title), date: w.eventDate }]);
  }
  return map;
}

type Draft = { name: string; address: string; coordinates: string; googleMapsUrl: string; maximumSpaces: string };
const draftOf = (venue?: VenueModel): Draft => ({
  name: clean(venue?.name), address: clean(venue?.address), coordinates: clean(venue?.coordinates), googleMapsUrl: clean(venue?.googleMapsUrl), maximumSpaces: String(venue?.maximumSpaces ?? 0),
});
const bodyOf = (draft: Draft) => ({
  name: clean(draft.name), address: clean(draft.address), coordinates: clean(draft.coordinates) || null, googleMapsUrl: clean(draft.googleMapsUrl) || null, maximumSpaces: Number(draft.maximumSpaces) || 0,
});

function VenueForm({ venue, onCancel, onSaved }: { venue?: VenueModel; onCancel: () => void; onSaved: (id: string) => void }) {
  const api = useAdminFetch();
  const [draft, setDraft] = useState<Draft>(() => draftOf(venue));
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof Draft>(key: K) => (value: Draft[K]) => setDraft(d => ({ ...d, [key]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    const body = bodyOf(draft);
    try {
      if (venue) {
        await api(`/Venue/${venue.venueId}`, { method: 'PUT', body: JSON.stringify({ ...venue, ...body }) });
        notify('Sede aggiornata', { description: body.name });
        onSaved(venue.venueId);
      } else {
        const created = await api<VenueModel>('/Venue', { method: 'POST', body: JSON.stringify(body) });
        notify('Sede creata', { description: body.name });
        onSaved(created?.venueId ?? '');
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
      <TextInput label="Indirizzo" isRequired value={draft.address} onChange={set('address')} placeholder="Via, numero civico, CAP e città" validate={value => (clean(value) ? null : "L'indirizzo è obbligatorio.")} />
      <TextInput
        label="Coordinate"
        value={draft.coordinates}
        onChange={set('coordinates')}
        placeholder="44.4056, 8.9463"
        description="Latitudine e longitudine in gradi decimali, separate da una virgola."
        validate={value => (!clean(value) || parseCoordinates(value) ? null : 'Usa latitudine e longitudine in gradi decimali, ad esempio 44.4056, 8.9463.')}
      />
      <TextInput
        label="Link a Google Maps"
        type="url"
        value={draft.googleMapsUrl}
        onChange={set('googleMapsUrl')}
        placeholder="https://maps.app.goo.gl/…"
        description="Il link «Apri la mappa» del sito. Se manca, viene costruito dalle coordinate."
        validate={value => (!clean(value) || isHttpUrl(clean(value)) ? null : 'Inserisci un indirizzo web completo, che inizi con https://.')}
      />
      <TextInput
        label="Posti disponibili"
        type="number"
        value={draft.maximumSpaces}
        onChange={set('maximumSpaces')}
        description="0 se la sede non ha un limite di posti."
        validate={value => (/^\d+$/.test(clean(value)) ? null : "Indica un numero intero di posti, 0 se non c'è un limite.")}
      />
      <div className="flex flex-wrap justify-end gap-2 pt-2">
        <Button onPress={onCancel} className={btn.ghost}>Annulla</Button>
        <Button type="submit" isDisabled={saving} className={btn.primary}>{saving ? 'Salvataggio…' : 'Salva'}</Button>
      </div>
    </Form>
  );
}

type CardMode = 'view' | 'edit' | 'delete';

function VenueCard({ venue, events, initialMode, onModeChange, onChanged, onDeleted }: {
  venue: VenueModel;
  events: EventRef[];
  initialMode: CardMode;
  onModeChange: () => void;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const can = useCan();
  const api = useAdminFetch();
  const [mode, setModeState] = useState<CardMode>(initialMode);
  const setMode = (next: CardMode) => { setModeState(next); onModeChange(); };
  const [busy, setBusy] = useState(false);
  const name = clean(venue.name);
  const address = clean(venue.address);
  const map = mapsHref(venue);

  const remove = async () => {
    setBusy(true);
    try {
      await api(`/Venue/${venue.venueId}`, { method: 'DELETE' });
      notify('Sede eliminata', { description: name });
      onDeleted();
    } catch (error) {
      notify('Eliminazione non riuscita', { description: errorText(error), kind: 'error' });
      setBusy(false);
    }
  };

  return (
    <>
      <ModalHeader title={name} closeLabel="Chiudi la scheda">
        <p className="mt-1.5 flex flex-wrap gap-1.5">
          {!address && <Badge kind="warn">Senza indirizzo</Badge>}
          {!map && <Badge kind="warn">Senza mappa</Badge>}
        </p>
      </ModalHeader>

      <div className="space-y-5 p-5 sm:p-6">
        {mode === 'edit' && can('venues.manage') ? (
          <VenueForm venue={venue} onCancel={() => setMode('view')} onSaved={() => { setMode('view'); onChanged(); }} />
        ) : (
          <>
            {!address && <Notice tone="warn" title="Manca l'indirizzo">Sul sito l'evento comparirebbe senza indirizzo: completalo in Modifica.</Notice>}
            <dl className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2"><dt className="text-sm font-semibold text-muted">Indirizzo</dt><dd className="mt-0.5">{address || <span className="text-muted">Da completare</span>}</dd></div>
              <div><dt className="text-sm font-semibold text-muted">Coordinate</dt><dd className="mt-0.5 tabular-nums">{clean(venue.coordinates) || <span className="text-muted">—</span>}</dd></div>
              <div><dt className="text-sm font-semibold text-muted">Posti disponibili</dt><dd className="mt-0.5 tabular-nums">{venue.maximumSpaces > 0 ? venue.maximumSpaces : <span className="text-muted">Nessun limite</span>}</dd></div>
              <div className="sm:col-span-2">
                <dt className="text-sm font-semibold text-muted">Mappa</dt>
                <dd className="mt-0.5">{map ? <ExternalLink href={map}>Apri la mappa</ExternalLink> : <span className="text-muted">Nessun link: aggiungi le coordinate o il link a Google Maps.</span>}</dd>
              </div>
            </dl>
            <div>
              <h3 className="text-sm font-semibold text-muted">Eventi in questa sede ({events.length})</h3>
              {events.length ? (
                <ul className="mt-1 divide-y divide-line">
                  {events.slice(0, 8).map(e => (
                    <li key={e.workshopId}>
                      <Link to={`/admin/workshop/${e.workshopId}`} className={`block rounded-lg py-2.5 hover:underline ${linkFocus}`}>
                        <span className="block font-semibold">{e.title}</span>
                        <span className="block text-sm text-muted">{formatDate(e.date)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : <p className="mt-1 text-muted">Nessun evento in archivio con questo nome di sede.</p>}
            </div>
            {mode === 'delete' && can('venues.delete') ? (
              <div role="alert" className="rounded-xl border border-[#b42318] p-4">
                <p className="font-bold text-[#b42318]">Eliminare {name}?</p>
                <p className="text-sm text-muted">La sede non sarà più proposta quando crei un evento; gli eventi esistenti conservano i dati della sede già salvati.</p>
                <div className="mt-3 flex flex-wrap justify-end gap-2">
                  <Button onPress={() => setMode('view')} className={btn.ghost} autoFocus>Annulla</Button>
                  <Button onPress={remove} isDisabled={busy} className={btn.danger}>{busy ? 'Eliminazione…' : 'Elimina'}</Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
                <Button isDisabled={!can('venues.delete')} onPress={() => setMode('delete')} className={`${btn.ghost} text-[#b42318] data-[hovered]:bg-[#fdecea]`}><AdminIcon name="trash" />Elimina…</Button>
                <Button isDisabled={!can('venues.manage')} onPress={() => setMode('edit')} className={btn.secondary}><AdminIcon name="pencil" />Modifica</Button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

/** Empty state: offer to save the venues found in past events, pre-selected, flagging the ones without an address. */
function PastVenuesImport({ venues, onSaved }: { venues: PastVenue[]; onSaved: () => void }) {
  const api = useAdminFetch();
  const [selected, setSelected] = useState<Set<string>>(() => new Set(venues.map(v => v.key)));
  const [saving, setSaving] = useState(false);
  const toggle = (key: string, on: boolean) => setSelected(current => { const next = new Set(current); if (on) next.add(key); else next.delete(key); return next; });

  const save = async () => {
    setSaving(true);
    const chosen = venues.filter(v => selected.has(v.key));
    const failed: string[] = [];
    for (const v of chosen) {
      try {
        await api('/Venue', { method: 'POST', body: JSON.stringify({ name: v.name, address: v.address || null, coordinates: v.coordinates || null, googleMapsUrl: v.googleMapsUrl || null, maximumSpaces: v.maximumSpaces }) });
      } catch {
        failed.push(v.name);
      }
    }
    setSaving(false);
    const saved = chosen.length - failed.length;
    if (saved) notify(plural(saved, 'sede salvata', 'sedi salvate'), { description: failed.length ? `Non salvate: ${failed.join(', ')}.` : 'Controlla gli indirizzi e aggiungi i posti disponibili.' });
    else notify('Nessuna sede salvata', { description: `Non salvate: ${failed.join(', ')}.`, kind: 'error' });
    onSaved();
  };

  const missing = venues.filter(v => !v.address).length;
  return (
    <>
      <EmptyState icon="pin" title="Nessuna sede salvata">
        <p>Negli eventi passati ci sono {plural(venues.length, 'sede', 'sedi')}: salvale in un colpo solo{missing ? `, poi completa ${missing === 1 ? "l'indirizzo che manca" : `i ${missing} indirizzi che mancano`}` : ' e controlla gli indirizzi'}.</p>
      </EmptyState>
      <ul className="mx-auto mb-6 max-w-2xl divide-y divide-line rounded-2xl border border-line" aria-label="Sedi trovate negli eventi passati">
        {venues.map(v => (
          <li key={v.key}>
            <label className="flex cursor-pointer items-center gap-4 px-4 py-3 transition-colors hover:bg-cyan-50/60">
              <input type="checkbox" checked={selected.has(v.key)} onChange={e => toggle(v.key, e.target.checked)} className="size-5 shrink-0 rounded accent-basil-700 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-cyan-700" />
              <span className="min-w-0 flex-1">
                <span className="block font-bold">{v.name}</span>
                <span className="block text-sm text-muted">{v.address || 'Indirizzo da completare'} · {plural(v.events, 'evento', 'eventi')}, l'ultimo a {monthYear.format(new Date(v.last))}</span>
              </span>
              {!v.address && <Badge kind="warn">Senza indirizzo</Badge>}
            </label>
          </li>
        ))}
      </ul>
      <div className="flex justify-center pb-10">
        <Button onPress={save} isDisabled={saving || selected.size === 0} className={btn.secondary}>
          {saving ? 'Salvataggio…' : `Salva ${plural(selected.size, 'sede', 'sedi')}`}
        </Button>
      </div>
    </>
  );
}

export default function VenuesPage() {
  const can = useCan();
  const [params, setParams] = useSearchParams();
  const [venuesLoad, reloadVenues] = useAdminLoad<VenueModel[]>('/Venue');
  const [workshopsLoad] = useAdminLoad<AdminWorkshop[]>('/Workshop/Get?onlyPublished=false', can('events.read'));
  const [query, setQuery] = useState('');
  const venues = venuesLoad.state === 'ready' ? venuesLoad.data : null;
  const workshops = useMemo(() => (workshopsLoad.state === 'ready' ? workshopsLoad.data : []), [workshopsLoad]);
  const events = useMemo(() => eventsByVenue(workshops), [workshops]);
  const past = useMemo(() => pastVenuesOf(workshops), [workshops]);

  const sorted = useMemo(() => [...(venues ?? [])].sort((a, b) => clean(a.name).localeCompare(clean(b.name), 'it')), [venues]);
  const q = nameKey(query);
  const visible = sorted.filter(v => !q || nameKey(v.name).includes(q) || nameKey(v.address).includes(q));
  const withoutAddress = sorted.filter(v => !clean(v.address)).length;

  const selectedId = params.get('sede');
  const action = params.get('azione');
  const initialMode: CardMode = action === 'modifica' ? 'edit' : action === 'elimina' ? 'delete' : 'view';
  const hrefFor = (id: string, edit = false) => `/admin/venues/?sede=${encodeURIComponent(id)}${edit ? '&azione=modifica' : ''}`;
  const open = (id: string, mode?: 'modifica' | 'elimina') => setParams(mode ? { sede: id, azione: mode } : { sede: id });
  const close = () => setParams({});
  // Once the card is open, the requested mode no longer belongs in the address.
  const clearAction = () => setParams(p => { const next = new URLSearchParams(p); next.delete('azione'); return next; }, { replace: true });
  const selected = selectedId && selectedId !== 'nuova' ? venues?.find(v => v.venueId === selectedId) : undefined;

  const description = venues
    ? venues.length === 0 ? 'Le sedi salvate si scelgono con un clic quando crei un evento, con indirizzo e mappa già compilati.'
      : `${plural(venues.length, 'sede salvata', 'sedi salvate')}${withoutAddress ? `, ${withoutAddress} senza indirizzo` : ''}.`
    : undefined;

  return (
    <>
      <PageHeader
        title="Sedi"
        description={description}
        actions={<PermissionGate permission="venues.manage"><Link to={hrefFor('nuova')} className={btn.primary}><AdminIcon name="plus" />Aggiungi sede</Link></PermissionGate>}
      />

      {venuesLoad.state === 'error' && <div className="mt-6"><LoadError message={`Le sedi non sono disponibili (${venuesLoad.message}).`} onRetry={reloadVenues} /></div>}
      {venuesLoad.state === 'loading' && <div className="mt-6"><Skeleton /></div>}

      {venues && venues.length === 0 && (
        <Panel className="mt-6 overflow-hidden">
          {workshopsLoad.state === 'loading' ? (
            <EmptyState icon="pin" title="Nessuna sede salvata"><p role="status">Cerco le sedi usate negli eventi passati…</p></EmptyState>
          ) : past.length ? (
            <PastVenuesImport key={past.map(v => v.key).join('|')} venues={past} onSaved={reloadVenues} />
          ) : (
            <EmptyState icon="pin" title="Nessuna sede salvata" actions={<Link to={hrefFor('nuova')} className={btn.secondary}><AdminIcon name="plus" />Aggiungi la prima sede</Link>}>
              <p>Negli eventi in archivio non ci sono sedi da recuperare. Aggiungi la prima: la sceglierai con un clic quando crei un evento.</p>
            </EmptyState>
          )}
        </Panel>
      )}

      {venues && venues.length > 0 && (
        <>
          <div className="mt-6 flex flex-wrap items-center gap-2.5" role="search">
            <SearchBox label="Cerca una sede" placeholder="Nome o indirizzo" value={query} onChange={setQuery} />
          </div>
          <Panel className="mt-5 overflow-hidden">
            {visible.length ? (
              <>
                <table className={table.el}>
                  <thead className={table.head}>
                    <tr>
                      <th scope="col" className={table.th}>Sede</th>
                      <th scope="col" className={`${table.th} text-right`}>Posti</th>
                      <th scope="col" className={table.th}>Mappa</th>
                      <th scope="col" className={table.th}>Da sistemare</th>
                      <th scope="col" className={`${table.th} w-28`}><span className="sr-only">Azioni</span></th>
                    </tr>
                  </thead>
                  <tbody className={table.body}>
                    {visible.map(v => {
                      const name = clean(v.name);
                      const address = clean(v.address);
                      const map = mapsHref(v);
                      return (
                        <tr key={v.venueId} className={table.row}>
                          <td className={table.td}>
                            <Link to={hrefFor(v.venueId)} className={`block rounded-lg font-bold leading-snug hover:underline ${linkFocus}`}>{name}</Link>
                            <span className={`block text-sm ${address ? 'text-muted' : 'text-[#8a4b00]'}`}>{address || 'Indirizzo da completare'}</span>
                          </td>
                          <td className={`${table.td} text-right tabular-nums ${v.maximumSpaces > 0 ? '' : 'text-muted'}`}>{v.maximumSpaces > 0 ? v.maximumSpaces : '—'}</td>
                          <td className={table.td}>{map ? <ExternalLink href={map}>Apri la mappa</ExternalLink> : <span className="text-muted">—</span>}</td>
                          <td className={table.td}>
                            <span className="flex flex-wrap gap-1.5">
                              {!address && <Badge kind="warn">Senza indirizzo</Badge>}
                              {!map && <Badge kind="warn">Senza mappa</Badge>}
                            </span>
                          </td>
                          <td className={table.td}>
                            <span className={table.actions}>
                              <Link to={hrefFor(v.venueId, true)} aria-label={`Modifica ${name}`} className={btn.icon}><AdminIcon name="pencil" /></Link>
                              <RowMenu label={`Altre azioni per ${name}`} items={[
                                { id: 'open', label: 'Apri la scheda', icon: <AdminIcon name="pin" className="size-5 text-muted" />, onAction: () => open(v.venueId) },
                                { id: 'edit', label: 'Modifica', isDisabled: !can('venues.manage'), icon: <AdminIcon name="pencil" className="size-5 text-muted" />, onAction: () => open(v.venueId, 'modifica') },
                                { id: 'delete', label: 'Elimina…', isDisabled: !can('venues.delete'), icon: <AdminIcon name="trash" />, destructive: true, onAction: () => open(v.venueId, 'elimina') },
                              ]} />
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <ul className={table.cards}>
                  {visible.map(v => {
                    const address = clean(v.address);
                    return (
                      <li key={v.venueId}>
                        <Link to={hrefFor(v.venueId)} className={`flex items-center gap-3 p-4 transition-colors hover:bg-cyan-50/60 ${linkFocus}`}>
                          <span className="min-w-0 flex-1">
                            <span className="block font-bold leading-snug">{clean(v.name)}</span>
                            <span className="block text-sm text-muted">{address || 'Indirizzo da completare'}{v.maximumSpaces > 0 ? ` · ${plural(v.maximumSpaces, 'posto', 'posti')}` : ''}</span>
                            <span className="mt-1.5 flex flex-wrap gap-1.5">
                              {!address && <Badge kind="warn">Senza indirizzo</Badge>}
                              {!mapsHref(v) && <Badge kind="warn">Senza mappa</Badge>}
                            </span>
                          </span>
                          <AdminIcon name="arrow" className="size-5 text-muted" />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
                <p className={table.footer}>{visible.length} di {plural(sorted.length, 'sede', 'sedi')}</p>
              </>
            ) : (
              <EmptyState icon="pin" title="Nessuna sede trovata" actions={<Button onPress={() => setQuery('')} className={btn.secondary}>Azzera la ricerca</Button>}>
                <p>Nessuna sede corrisponde a «{query}».</p>
              </EmptyState>
            )}
          </Panel>
        </>
      )}

      <RecordModal isOpen={!!selectedId} onOpenChange={isOpen => { if (!isOpen) close(); }} label={selectedId === 'nuova' ? 'Nuova sede' : selected ? clean(selected.name) : 'Scheda sede'}>
        {selectedId === 'nuova' ? (
          <>
            <ModalHeader title="Nuova sede" />
            <div className="p-5 sm:p-6">
              <PermissionGate permission="venues.manage"><VenueForm onCancel={close} onSaved={newId => { reloadVenues(); if (newId) open(newId); else close(); }} /></PermissionGate>
            </div>
          </>
        ) : selected ? (
          <VenueCard
            key={selected.venueId}
            venue={selected}
            events={events.get(nameKey(selected.name)) ?? []}
            initialMode={initialMode}
            onModeChange={clearAction}
            onChanged={reloadVenues}
            onDeleted={() => { reloadVenues(); close(); }}
          />
        ) : (
          <div className="p-6">
            <div className="flex justify-end"><Button slot="close" aria-label="Chiudi" className={btn.icon}><AdminIcon name="x" /></Button></div>
            {venues ? (
              <EmptyState icon="pin" title="Sede non trovata"><p>La scheda non esiste più o il link non è corretto.</p></EmptyState>
            ) : <p role="status" className="py-10 text-center text-muted">Caricamento della scheda…</p>}
          </div>
        )}
      </RecordModal>
    </>
  );
}

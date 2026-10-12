import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Form, Label, Radio, RadioGroup } from 'react-aria-components';
import { AdminIcon } from '../icons';
import { LoadError, PageHeader, Panel, TextAreaInput, TextInput, btn, focusRing, linkFocus } from '../ui';
import { clean, useAdminLoad } from '../adminApi';
import { notify } from '../toasts';
import type { VenueModel } from '../../models/VenueModel';
import { Notice } from './listUi';
import { errorText, useEventApi } from './eventKit';
import { isGuid, locationFromVenue, parseRooms } from './eventModel';

// New event, with the previous rules: title, description, date, a saved venue, location name and address are
// required; the venue's fields are copied onto the event and stay editable; rooms one per line. Same payload
// as before (POST /Workshop/Post), then the event card opens on its first step.

const radioCls = `group flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3.5 transition-colors data-[hovered]:border-cyan-200 data-[selected]:border-navy data-[selected]:bg-cyan-50/60 ${focusRing}`;
const RadioMark = () => (
  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2 border-[#c3d3df] transition-colors group-data-[selected]:border-navy" aria-hidden="true">
    <span className="size-2.5 rounded-full bg-navy opacity-0 transition-opacity group-data-[selected]:opacity-100" />
  </span>
);

interface Draft {
  title: string; description: string; eventDate: string;
  venueId: string | null; name: string; address: string; coordinates: string; googleMapsUrl: string; maximumSpaces: string; rooms: string;
  booking: string; tickets: string; notes: string;
}

const EMPTY: Draft = {
  title: '', description: '', eventDate: '',
  venueId: null, name: '', address: '', coordinates: '', googleMapsUrl: '', maximumSpaces: '0', rooms: '',
  booking: '', tickets: '0', notes: '',
};

export const MISSING_VENUE_MESSAGE = 'Compila tutti i campi obbligatori e scegli una sede salvata.';

export default function EventCreatePage() {
  const navigate = useNavigate();
  const api = useEventApi();
  const [venuesLoad, reloadVenues] = useAdminLoad<VenueModel[]>('/Venue');
  const venues = useMemo(() => [...(venuesLoad.state === 'ready' ? venuesLoad.data : [])].sort((a, b) => clean(a.name).localeCompare(clean(b.name), 'it')), [venuesLoad]);
  const noVenues = venuesLoad.state === 'ready' && venues.length === 0;
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof Draft>(key: K) => (value: Draft[K]) => setDraft(d => ({ ...d, [key]: value }));

  const pickVenue = (venueId: string) => {
    const venue = venues.find(item => item.venueId === venueId);
    if (!venue) return;
    const location = locationFromVenue(venue);
    setDraft(d => ({ ...d, venueId, name: location.name ?? '', address: location.address ?? '', coordinates: location.coordinates ?? '', googleMapsUrl: location.googleMapsUrl ?? '', maximumSpaces: String(location.maximumSpaces ?? 0) }));
    setError(null);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const selectedVenue = venues.find(venue => venue.venueId === draft.venueId);
    if (!selectedVenue || !draft.title || !draft.description || !draft.eventDate || !draft.name || !draft.address) {
      setError(MISSING_VENUE_MESSAGE);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const created = await api<Record<string, unknown> | undefined>('/Workshop/Post', {
        method: 'POST',
        body: JSON.stringify({
          title: draft.title,
          description: draft.description,
          eventDate: draft.eventDate,
          location: {
            name: draft.name,
            address: draft.address,
            coordinates: draft.coordinates,
            googleMapsUrl: draft.googleMapsUrl,
            maximumSpaces: Number(draft.maximumSpaces) || 0,
            rooms: parseRooms(draft.rooms),
          },
          bookingServiceUrl: draft.booking,
          externalRegistration: Boolean(draft.booking),
          externalRegistrationLink: draft.booking,
          eventbriteTicketCapacity: Math.max(0, Number.parseInt(draft.tickets, 10) || 0),
          attendeeNotes: draft.notes,
        }),
      });
      const id = created?.workshopId ?? created?.WorkshopId;
      if (!isGuid(id)) throw new Error("L'evento è stato creato, ma il server non ha restituito un identificativo valido.");
      notify('Evento creato', { description: clean(draft.title) });
      navigate(`/admin/workshop/${id}`);
    } catch (submitError) {
      setError(errorText(submitError));
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader back={{ to: '/admin/workshops/', label: 'Eventi' }} title="Nuovo evento" description="Titolo, descrizione, data e una sede salvata: agenda, materiali e questionario si completano dalla scheda dell'evento." />
      <Form onSubmit={submit} className="mt-6 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]" aria-label="Nuovo evento">
        <div className="space-y-5">
          <Panel labelledBy="create-info" className="space-y-4 p-5 sm:p-6">
            <h2 id="create-info" className="text-lg font-bold">Informazioni</h2>
            <TextInput label="Titolo" isRequired autoFocus value={draft.title} onChange={set('title')} placeholder="Per esempio: .NET Conf 2026 Liguria" validate={value => (clean(value) ? null : 'Il titolo è obbligatorio.')} />
            <TextAreaInput label="Descrizione" isRequired rows={4} value={draft.description} onChange={set('description')} placeholder="Di cosa si parla e a chi è rivolto" description="Compare nella scheda dell'evento e nella home." validate={value => (clean(value) ? null : 'La descrizione è obbligatoria.')} />
            <TextInput label="Data" type="date" isRequired value={draft.eventDate} onChange={set('eventDate')} validate={value => (value ? null : 'La data è obbligatoria.')} className="block sm:max-w-xs" />
          </Panel>

          <Panel labelledBy="create-venue" className="space-y-4 p-5 sm:p-6">
            <h2 id="create-venue" className="text-lg font-bold">Sede</h2>
            {venuesLoad.state === 'error' && <LoadError message={`Le sedi salvate non sono disponibili (${venuesLoad.message}).`} onRetry={reloadVenues} />}
            {noVenues && (
              <Notice tone="warn" title="Nessuna sede salvata">
                Per creare un evento serve una sede salvata: <Link to="/admin/venues/" className={`font-bold underline ${linkFocus}`}>aggiungine una in Sedi</Link>, poi torna qui.
              </Notice>
            )}
            {venues.length > 0 && (
              <RadioGroup value={draft.venueId} onChange={pickVenue} className="block">
                <Label className="text-sm font-semibold text-navy">Sede salvata<span className="text-[#b42318]" aria-hidden="true"> *</span></Label>
                <div className="mt-1.5 grid gap-3 sm:grid-cols-2">
                  {venues.map(venue => (
                    <Radio key={venue.venueId} value={venue.venueId} className={radioCls}>
                      <RadioMark />
                      <span className="min-w-0"><span className="block font-bold">{clean(venue.name)}</span><span className="block text-sm text-muted">{clean(venue.address) || 'Indirizzo da completare'}</span></span>
                    </Radio>
                  ))}
                </div>
                <p className="mt-1.5 text-sm text-muted">I dati della sede vengono copiati sull'evento e restano modificabili qui sotto.</p>
              </RadioGroup>
            )}
            {venuesLoad.state === 'loading' && <p role="status" className="text-sm text-muted">Caricamento delle sedi salvate…</p>}
            <div className="grid gap-4 sm:grid-cols-2">
              <TextInput label="Nome della sede" isRequired value={draft.name} onChange={set('name')} placeholder="Nome della sede" validate={value => (clean(value) ? null : 'Il nome della sede è obbligatorio.')} />
              <TextInput label="Indirizzo" isRequired value={draft.address} onChange={set('address')} placeholder="Indirizzo della sede" validate={value => (clean(value) ? null : "L'indirizzo è obbligatorio.")} />
              <TextInput label="Coordinate" value={draft.coordinates} onChange={set('coordinates')} placeholder="Latitudine, longitudine" />
              <TextInput label="Link a Google Maps" value={draft.googleMapsUrl} onChange={set('googleMapsUrl')} placeholder="https://maps.google.com/..." />
              <TextInput label="Posti disponibili" type="number" value={draft.maximumSpaces} onChange={set('maximumSpaces')} />
              <TextAreaInput label="Sale per questo evento" rows={2} value={draft.rooms} onChange={set('rooms')} placeholder="Una sala per riga" description="Le sale possono cambiare da un evento all'altro." />
            </div>
          </Panel>

          <Panel labelledBy="create-booking" className="space-y-4 p-5 sm:p-6">
            <h2 id="create-booking" className="text-lg font-bold">Iscrizione e note</h2>
            <TextInput label="Link di prenotazione e disdetta" value={draft.booking} onChange={set('booking')} placeholder="https://..." />
            <TextInput label="Biglietti gratuiti iniziali su Eventbrite" type="number" value={draft.tickets} onChange={set('tickets')} description="Separati dai posti della sede. La bozza su Eventbrite si crea dalla scheda dell'evento, dopo l'agenda." className="block sm:max-w-xs" />
            <TextAreaInput label="Note per chi partecipa" rows={3} value={draft.notes} onChange={set('notes')} placeholder="Informazioni pratiche per chi partecipa" />
          </Panel>

          {error && <Notice tone="danger" title="Evento non creato">{error}</Notice>}
          <div className="flex flex-wrap justify-end gap-3">
            <Link to="/admin/workshops/" className={btn.ghost}>Annulla</Link>
            <Button type="submit" isDisabled={saving || noVenues} className={btn.primary}><AdminIcon name="check" />{saving ? 'Creazione…' : 'Crea evento'}</Button>
          </div>
        </div>

        <aside className="rounded-2xl border border-line bg-white p-5 xl:sticky xl:top-0" aria-labelledby="create-next">
          <h2 id="create-next" className="text-lg font-bold">Dopo la creazione</h2>
          <ol className="mt-3 space-y-3 text-muted">
            {['Locandina, sessioni ed elenco talk (anche da Sessionize), poi gli orari.', 'Iscrizione: prenotazioni, note ed Eventbrite.', 'Materiali e foto; l\'evento resta in bozza finché non lo pubblichi.'].map((step, index) => (
              <li key={step} className="flex gap-3"><span className="grid size-7 shrink-0 place-items-center rounded-full bg-cyan-50 text-sm font-bold text-cyan-700">{index + 1}</span>{step}</li>
            ))}
          </ol>
        </aside>
      </Form>
    </>
  );
}

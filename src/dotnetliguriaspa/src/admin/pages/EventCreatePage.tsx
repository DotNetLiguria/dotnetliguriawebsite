import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from 'react-aria-components';
import { AdminIcon } from '../icons';
import { PageHeader, Panel, TextAreaInput, TextInput, btn } from '../ui';
import { clean } from '../adminApi';
import { notify } from '../toasts';
import type { VenueModel } from '../../models/VenueModel';
import { NumberInput, SelectInput, useEventApi } from './eventKit';
import { detailMessage, isGuid, locationFromVenue, parseRooms, statusMessage } from './eventModel';

// New event: the previous AdminWorkshopCreate, texts translated literally. Title, description, date, a saved
// venue, location name and address are required (one message); the venue's fields are copied onto the event
// and stay editable; rooms one per line. Same payload (POST /Workshop/Post), then the event card opens.

export const MISSING_FIELDS_MESSAGE = 'Compila tutti i campi obbligatori e seleziona una sede';

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

export default function EventCreatePage() {
  const navigate = useNavigate();
  const api = useEventApi();
  const [venues, setVenues] = useState<VenueModel[]>([]);
  const [loadingVenues, setLoadingVenues] = useState(true);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof Draft>(key: K) => (value: Draft[K]) => setDraft(d => ({ ...d, [key]: value }));
  useEffect(() => {
    let alive = true;
    api<VenueModel[]>('/Venue')
      .then(data => { if (alive) setVenues(data ?? []); })
      .catch((error: unknown) => { if (alive) notify(statusMessage(error, 'Impossibile caricare le sedi', 'Errore nel caricamento delle sedi'), { kind: 'error' }); })
      .finally(() => { if (alive) setLoadingVenues(false); });
    return () => { alive = false; };
  }, [api]);

  const pickVenue = (venueId: string | null) => {
    const venue = venues.find(item => item.venueId === venueId);
    if (!venue) {
      setDraft(d => ({ ...d, venueId }));
      return;
    }
    const location = locationFromVenue(venue);
    setDraft(d => ({ ...d, venueId, name: location.name ?? '', address: location.address ?? '', coordinates: location.coordinates ?? '', googleMapsUrl: location.googleMapsUrl ?? '', maximumSpaces: String(location.maximumSpaces ?? 0) }));
  };

  const submit = async () => {
    const selectedVenue = venues.find(venue => venue.venueId === draft.venueId);
    if (!draft.title || !draft.description || !draft.eventDate || !selectedVenue || !draft.name || !draft.address) {
      notify(MISSING_FIELDS_MESSAGE, { kind: 'error' });
      return;
    }
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
      if (!isGuid(id)) throw new Error("L'evento è stato creato, ma il server non ha restituito un ID evento valido.");
      navigate(`/admin/workshop/${id}`);
    } catch (submitError) {
      notify(detailMessage(submitError, "Impossibile creare l'evento", "Errore nella creazione dell'evento"), { kind: 'error' });
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader back={{ to: '/admin/workshops/', label: 'Eventi' }} title="Crea evento" />
      <Panel className="mt-6 max-w-3xl space-y-5 p-5 sm:p-6">
        <TextInput label="Titolo" value={draft.title} onChange={set('title')} placeholder="Inserisci il titolo dell'evento" />
        <div>
          <SelectInput label="Sede" isRequired items={venues.map(venue => ({ id: venue.venueId, label: clean(venue.name) }))} selectedKey={draft.venueId} onSelectionChange={pickVenue} placeholder="" isDisabled={loadingVenues || venues.length === 0} />
          {!loadingVenues && venues.length === 0 && <p className="mt-1.5 text-sm text-muted">Aggiungi una sede in Venues / Sale eventi prima di creare un evento.</p>}
        </div>
        <h2 className="text-lg font-bold">Informazioni sulla sede</h2>
        <TextInput label="Nome" isRequired value={draft.name} onChange={set('name')} placeholder="Nome della sede" />
        <TextInput label="Indirizzo" isRequired value={draft.address} onChange={set('address')} placeholder="Indirizzo della sede" />
        <TextInput label="Coordinate" value={draft.coordinates} onChange={set('coordinates')} placeholder="Latitudine, longitudine" />
        <TextInput label="URL di Google Maps" type="url" value={draft.googleMapsUrl} onChange={set('googleMapsUrl')} placeholder="https://maps.google.com/..." />
        <TextInput label="Posti massimi" type="number" value={draft.maximumSpaces} onChange={set('maximumSpaces')} />
        <TextAreaInput label="Sale per questo evento" rows={2} value={draft.rooms} onChange={set('rooms')} placeholder="Inserisci una sala per riga" description="Le sale possono differire per ogni data dell'evento." />
        <TextInput label="URL del servizio di prenotazione e cancellazione del posto" type="url" value={draft.booking} onChange={set('booking')} placeholder="https://..." />
        <NumberInput label="Biglietti gratuiti Eventbrite iniziali" min={0} value={draft.tickets} onChange={set('tickets')} description="Separati dai posti massimi della sede. La bozza Eventbrite viene creata dopo il salvataggio dell'agenda." />
        <TextAreaInput label="Note per i partecipanti" rows={3} value={draft.notes} onChange={set('notes')} placeholder="Informazioni pratiche per i partecipanti" />
        <TextInput label="Data dell'evento" type="date" value={draft.eventDate} onChange={set('eventDate')} />
        <TextAreaInput label="Descrizione" rows={5} value={draft.description} onChange={set('description')} placeholder="Inserisci la descrizione dell'evento" />
        <div className="flex flex-wrap justify-end gap-3">
          <Button onPress={() => navigate('/admin/workshops/')} isDisabled={saving} className={btn.ghost}>Annulla</Button>
          <Button onPress={() => void submit()} isDisabled={saving} className={btn.primary}><AdminIcon name="check" />{saving ? 'Creazione…' : 'Crea'}</Button>
        </div>
      </Panel>
    </>
  );
}

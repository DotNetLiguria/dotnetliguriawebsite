import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Disclosure, DisclosurePanel, FieldError, Form, Label, Radio, RadioGroup } from 'react-aria-components';
import { AdminIcon } from '../icons';
import { LoadError, PageHeader, Panel, SwitchInput, TextAreaInput, TextInput, btn, focusRing, linkFocus } from '../ui';
import { clean, useAdminLoad } from '../adminApi';
import { notify } from '../toasts';
import type { VenueModel } from '../../models/VenueModel';
import { Notice } from './listUi';
import { isHttpUrl as isWebUrl, parseCoordinates } from './VenuesPage';
import { errorText, useEventApi } from './eventKit';
import { isGuid, locationFromVenue, parseRooms } from './eventModel';

// New event: title, date and venue are enough; the agenda, the files and the questionnaire come after, on the
// event card. The payload of POST /Workshop/Post is the one the previous form sent.

const NEW_VENUE = 'nuova';
const radioCls = `group flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3.5 transition-colors data-[hovered]:border-cyan-200 data-[selected]:border-navy data-[selected]:bg-cyan-50/60 ${focusRing}`;
const RadioMark = () => (
  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2 border-[#c3d3df] transition-colors group-data-[selected]:border-navy" aria-hidden="true">
    <span className="size-2.5 rounded-full bg-navy opacity-0 transition-opacity group-data-[selected]:opacity-100" />
  </span>
);

interface Draft {
  title: string; description: string; eventDate: string;
  venue: string | null; name: string; address: string; coordinates: string; googleMapsUrl: string; maximumSpaces: string; rooms: string; saveVenue: boolean;
  booking: string; tickets: string; notes: string;
}

const EMPTY: Draft = {
  title: '', description: '', eventDate: '',
  venue: null, name: '', address: '', coordinates: '', googleMapsUrl: '', maximumSpaces: '0', rooms: '', saveVenue: false,
  booking: '', tickets: '0', notes: '',
};

export default function EventCreatePage() {
  const navigate = useNavigate();
  const api = useEventApi();
  const [venuesLoad, reloadVenues] = useAdminLoad<VenueModel[]>('/Venue');
  const venues = useMemo(() => [...(venuesLoad.state === 'ready' ? venuesLoad.data : [])].sort((a, b) => clean(a.name).localeCompare(clean(b.name), 'it')), [venuesLoad]);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof Draft>(key: K) => (value: Draft[K]) => setDraft(d => ({ ...d, [key]: value }));
  const isNew = draft.venue === NEW_VENUE;

  // Without saved venues there is nothing to pick: the new-venue fields are the form.
  useEffect(() => {
    if (venuesLoad.state !== 'loading' && venues.length === 0) setDraft(d => (d.venue ? d : { ...d, venue: NEW_VENUE }));
  }, [venuesLoad.state, venues.length]);

  const pickVenue = (key: string) => {
    const venue = venues.find(item => item.venueId === key);
    if (venue) {
      const location = locationFromVenue(venue);
      setDraft(d => ({ ...d, venue: key, name: location.name ?? '', address: location.address ?? '', coordinates: location.coordinates ?? '', googleMapsUrl: location.googleMapsUrl ?? '', maximumSpaces: String(location.maximumSpaces ?? 0), saveVenue: false }));
    } else {
      setDraft(d => ({ ...d, venue: NEW_VENUE, name: '', address: '', coordinates: '', googleMapsUrl: '', maximumSpaces: '0' }));
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSaving(true);
    const booking = clean(draft.booking);
    const location = {
      name: clean(draft.name), address: clean(draft.address), coordinates: clean(draft.coordinates), googleMapsUrl: clean(draft.googleMapsUrl),
      maximumSpaces: Number.parseInt(draft.maximumSpaces, 10) || 0, rooms: parseRooms(draft.rooms),
    };
    try {
      const created = await api<Record<string, unknown> | undefined>('/Workshop/Post', {
        method: 'POST',
        body: JSON.stringify({
          title: clean(draft.title),
          description: draft.description,
          eventDate: draft.eventDate,
          location,
          bookingServiceUrl: booking,
          externalRegistration: Boolean(booking),
          externalRegistrationLink: booking,
          eventbriteTicketCapacity: Math.max(0, Number.parseInt(draft.tickets, 10) || 0),
          attendeeNotes: draft.notes,
        }),
      });
      const id = created?.workshopId ?? created?.WorkshopId;
      if (!isGuid(id)) throw new Error("L'evento è stato creato, ma il server non ha restituito un identificativo valido.");
      if (isNew && draft.saveVenue) {
        try {
          await api('/Venue', { method: 'POST', body: JSON.stringify({ name: location.name, address: location.address, coordinates: location.coordinates || null, googleMapsUrl: location.googleMapsUrl || null, maximumSpaces: location.maximumSpaces }) });
        } catch (venueError) {
          notify('Sede non salvata', { description: `L'evento è stato creato, ma la sede no (${errorText(venueError)}).`, kind: 'error' });
        }
      }
      notify('Evento creato', { description: clean(draft.title) });
      navigate(`/admin/workshop/${id}#agenda`);
    } catch (submitError) {
      setError(errorText(submitError));
      setSaving(false);
    }
  };

  const venueFields = (
    <div className="grid gap-4 sm:grid-cols-2">
      <TextInput label="Nome della sede" isRequired value={draft.name} onChange={set('name')} validate={value => (clean(value) ? null : 'Il nome della sede è obbligatorio.')} />
      <TextInput label="Indirizzo" isRequired value={draft.address} onChange={set('address')} placeholder="Via, numero civico, CAP e città" validate={value => (clean(value) ? null : "L'indirizzo è obbligatorio.")} />
      <TextInput label="Coordinate" value={draft.coordinates} onChange={set('coordinates')} placeholder="44.4056, 8.9463" description="Latitudine e longitudine in gradi decimali." validate={value => (!clean(value) || parseCoordinates(value) ? null : 'Usa latitudine e longitudine in gradi decimali, ad esempio 44.4056, 8.9463.')} />
      <TextInput label="Link a Google Maps" type="url" value={draft.googleMapsUrl} onChange={set('googleMapsUrl')} placeholder="https://maps.app.goo.gl/…" validate={value => (!clean(value) || isWebUrl(clean(value)) ? null : 'Inserisci un indirizzo web completo, che inizi con https://.')} />
      <TextInput label="Posti disponibili" type="number" value={draft.maximumSpaces} onChange={set('maximumSpaces')} description="0 se la sede non ha un limite di posti." validate={value => (!clean(value) || /^\d+$/.test(clean(value)) ? null : "Indica un numero intero di posti, 0 se non c'è un limite.")} />
      <TextAreaInput label="Sale per questo evento" rows={2} value={draft.rooms} onChange={set('rooms')} placeholder="Una sala per riga" description="Le sale possono cambiare da un evento all'altro." />
      {isNew && <div className="sm:col-span-2"><SwitchInput isSelected={draft.saveVenue} onChange={set('saveVenue')}>Salva la sede per i prossimi eventi</SwitchInput></div>}
    </div>
  );

  return (
    <>
      <PageHeader back={{ to: '/admin/workshops/', label: 'Eventi' }} title="Nuovo evento" description="Bastano titolo, data e sede: agenda, materiali e questionario si aggiungono dopo." />
      <Form onSubmit={submit} className="mt-6 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]" aria-label="Nuovo evento">
        <div className="space-y-5">
          <Panel labelledBy="create-info" className="space-y-4 p-5 sm:p-6">
            <h2 id="create-info" className="text-lg font-bold">Informazioni</h2>
            <TextInput label="Titolo" isRequired autoFocus value={draft.title} onChange={set('title')} placeholder="Per esempio: .NET Conf 2026 Liguria" validate={value => (clean(value) ? null : 'Il titolo è obbligatorio.')} />
            <TextAreaInput label="Descrizione" rows={4} value={draft.description} onChange={set('description')} placeholder="Di cosa si parla e a chi è rivolto" description="Due o tre righe: compaiono nella scheda dell'evento e nella home. La locandina si carica dalla scheda dell'evento." />
          </Panel>

          <Panel labelledBy="create-venue" className="space-y-4 p-5 sm:p-6">
            <h2 id="create-venue" className="text-lg font-bold">Data e sede</h2>
            <TextInput label="Data" type="date" isRequired value={draft.eventDate} onChange={set('eventDate')} validate={value => (value ? null : 'La data è obbligatoria.')} className="block sm:max-w-xs" />
            {venuesLoad.state === 'error' && <LoadError message={`Le sedi salvate non sono disponibili (${venuesLoad.message}). Puoi comunque indicare una nuova sede.`} onRetry={reloadVenues} />}
            <RadioGroup value={draft.venue} onChange={pickVenue} isRequired className="block">
              <Label className="text-sm font-semibold text-navy">Sede<span className="text-[#b42318]" aria-hidden="true"> *</span></Label>
              {venuesLoad.state === 'loading' && <p role="status" className="mt-1.5 text-sm text-muted">Caricamento delle sedi salvate…</p>}
              <div className="mt-1.5 grid gap-3 sm:grid-cols-2">
                {venues.map(venue => (
                  <Radio key={venue.venueId} value={venue.venueId} className={radioCls}>
                    <RadioMark />
                    <span className="min-w-0"><span className="block font-bold">{clean(venue.name)}</span><span className="block text-sm text-muted">{clean(venue.address) || 'Indirizzo da completare'}</span></span>
                  </Radio>
                ))}
                <Radio value={NEW_VENUE} className={`${radioCls} border-dashed`}>
                  <RadioMark />
                  <span className="font-bold"><AdminIcon name="plus" className="mr-1 inline size-4" />Nuova sede</span>
                </Radio>
              </div>
              <FieldError className="mt-1.5 block text-sm font-semibold text-[#b42318]">Scegli una sede salvata o «Nuova sede».</FieldError>
              <p className="mt-1.5 text-sm text-muted">Le sedi salvate si gestiscono in <Link to="/admin/venues/" className={`font-bold text-cyan-700 underline ${linkFocus}`}>Sedi</Link>; indirizzo e mappa restano modificabili sull'evento.</p>
            </RadioGroup>
            {isNew && venueFields}
            {draft.venue && !isNew && (
              <Disclosure className="group rounded-xl border border-line">
                <Button slot="trigger" className={`flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-xl px-4 text-left font-semibold ${focusRing}`}>
                  <AdminIcon name="chevron" className="size-4 transition-transform group-data-[expanded]:rotate-180" />Dettagli della sede copiati sull'evento
                </Button>
                <DisclosurePanel className="px-4 pb-4">{venueFields}</DisclosurePanel>
              </Disclosure>
            )}
          </Panel>

          <Panel labelledBy="create-booking" className="space-y-4 p-5 sm:p-6">
            <h2 id="create-booking" className="text-lg font-bold">Iscrizione e note</h2>
            <TextInput label="Link di prenotazione" type="url" value={draft.booking} onChange={set('booking')} placeholder="https://www.eventbrite.it/…" description="Il sito mostra «Prenota o annulla il posto» fino al giorno dell'evento." validate={value => (!clean(value) || isWebUrl(clean(value)) ? null : 'Inserisci un indirizzo web completo, che inizi con https://.')} />
            <TextInput label="Biglietti gratuiti iniziali su Eventbrite" type="number" value={draft.tickets} onChange={set('tickets')} description="Separati dai posti della sede. La bozza su Eventbrite si crea dalla scheda dell'evento, dopo l'agenda." validate={value => (/^\d+$/.test(clean(value)) ? null : 'Indica un numero intero di biglietti, 0 se non usi Eventbrite.')} className="block sm:max-w-xs" />
            <TextAreaInput label="Note per chi partecipa" rows={3} value={draft.notes} onChange={set('notes')} placeholder="Portare il portatile, parcheggio, ingresso…" />
          </Panel>

          {error && <Notice tone="danger" title="Evento non creato">{error}</Notice>}
          <div className="flex flex-wrap justify-end gap-3">
            <Link to="/admin/workshops/" className={btn.ghost}>Annulla</Link>
            <Button type="submit" isDisabled={saving} className={btn.primary}>{saving ? 'Creazione…' : "Crea evento e passa all'agenda"}</Button>
          </div>
        </div>

        <aside className="rounded-2xl border border-line bg-white p-5 xl:sticky xl:top-0" aria-labelledby="create-next">
          <h2 id="create-next" className="text-lg font-bold">Dopo la creazione</h2>
          <ol className="mt-3 space-y-3 text-muted">
            {['Agenda: importa i talk da Sessionize o aggiungili, poi riempi gli orari.', 'Locandina, relatori, materiali e questionario dalla scheda dell\'evento.', 'Pubblica: l\'evento resta in bozza finché non lo decidi tu.'].map((step, index) => (
              <li key={step} className="flex gap-3"><span className="grid size-7 shrink-0 place-items-center rounded-full bg-cyan-50 text-sm font-bold text-cyan-700">{index + 1}</span>{step}</li>
            ))}
          </ol>
        </aside>
      </Form>
    </>
  );
}

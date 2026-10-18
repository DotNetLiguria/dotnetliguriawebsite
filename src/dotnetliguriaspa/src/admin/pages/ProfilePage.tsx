import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from 'react-aria-components';
import { useOidc, useOidcFetch, useOidcUser } from '@axa-fr/react-oidc';
import { PageHeader, Panel, TextInput, btn } from '../ui';
import { getOidcPublicSettings } from '../../config/oidcConfig';
import { API_BASE_URL } from '../../config/apiConfig';
import { clearPrivateBrowserState } from '../../questionnaire/drafts';
import PrivacyAdministration from './PrivacyAdministration';

type Subscription = { version: string; monthlyUpcomingEvents: boolean; eventAnnouncements: boolean };
const messages: Record<string, string> = {
  recent_mfa_required: 'È richiesta una verifica MFA recente. Verifica MFA e conferma di nuovo.',
  erasure_preflight_blocked: 'Cancellazione bloccata: dati o regole di conservazione richiedono un intervento amministrativo.',
  identity_admin_not_configured: 'Il collegamento amministrativo a Keycloak non è configurato.',
  protected_storage_not_approved: 'Le protezioni dello storage non sono ancora approvate.',
  external_copies_erasure_not_approved: 'La cancellazione delle copie esterne non è ancora approvata.',
  privacy_dependency_unavailable: 'Operazione incompleta: servizio non disponibile. Riprova o richiedi assistenza.',
  notification_dispatch_unavailable_no_approved_provider: 'Preparazione confermata, ma nessun messaggio è stato inviato: manca un fornitore approvato.',
};

export default function ProfilePage() {
  const { oidcUser } = useOidcUser();
  const { login, logout } = useOidc();
  const { fetch: authenticatedFetch } = useOidcFetch();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [status, setStatus] = useState('Caricamento dello stato privacy…');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const account = `${getOidcPublicSettings().authority.replace(/\/+$/, '')}/account`;

  const request = useCallback(async (path: string, init?: RequestInit) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/${path}`, { cache: 'no-store', ...init });
    if (!response.ok) {
      let code: string;
      try { code = (await response.json() as { code?: string }).code ?? ''; }
      catch { code = ''; }
      throw new Error(response.status === 401 ? 'Accedi di nuovo al tuo account.'
        : messages[code] ?? (response.status === 403 ? 'Operazione non autorizzata.'
          : `Operazione non completata (${response.status}). Riprova o richiedi assistenza.`));
    }
    return response;
  }, [authenticatedFetch]);

  const load = useCallback(async () => {
    await Promise.all([
      request('privacy/status').then(response => response.json()).then((value: { status: string }) => {
        setStatus(value.status === 'no_pending_request' ? 'Nessuna richiesta pendente.'
          : `Richiesta non conclusa (${value.status}). Rivolgiti a un amministratore per il recupero.`);
      }),
      request('notifications/subscription/').then(response => response.json()).then(setSubscription),
    ]);
  }, [request]);

  useEffect(() => {
    let active = true;
    load().catch(() => { if (active) setError('Impossibile caricare stato privacy o consensi. Riprova o richiedi assistenza.'); });
    return () => { active = false; };
  }, [load]);

  const run = async (action: () => Promise<void>) => {
    setBusy(true); setError(''); setMessage('');
    try { await action(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Operazione non completata. Richiedi assistenza.'); }
    finally { setBusy(false); }
  };
  const subscribe = (purpose: string, optIn: boolean) => run(async () => {
    if (!subscription) throw new Error('Consensi non disponibili.');
    await request('notifications/subscription/', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ purpose, version: subscription.version, optIn }),
    });
    await load();
    setMessage(optIn ? 'Iscrizione registrata in Keycloak.' : 'Iscrizione revocata.');
  });
  const exportData = () => run(async () => {
    const response = await request('privacy/export');
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = 'dotnetliguria-dati-personali.json';
    anchor.click();
    URL.revokeObjectURL(url);
    setMessage('Esportazione scaricata: contiene dati personali. Conservala e cancellala in modo sicuro.');
  });
  const erase = () => run(async () => {
    await request('privacy/erase', { method: 'POST', headers: { 'X-Confirm-Erasure': 'erase-my-account' } });
    clearPrivateBrowserState();
    setMessage('Cancellazione completata.');
    try { await logout('/'); }
    catch { setMessage('Cancellazione completata. La chiusura della sessione non è riuscita: chiudi la scheda.'); }
  });

  return <>
    <PageHeader title="Profilo" description="Account, consensi e diritti privacy." />
    {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-red-900">{error}</p>}
    {message && <p role="status" className="mt-4 rounded-xl bg-cyan-50 p-4">{message}</p>}
    <div className="mt-6 grid gap-6">
      <Panel labelledBy="profile-account" className="space-y-4 p-6">
        <h2 id="profile-account" className="text-lg font-bold">Account Keycloak</h2>
        <p>Nome, cognome ed email dell'account restano in Keycloak. Il sito non raccoglie dati aggiuntivi sul profilo.</p>
        <TextInput label="Nome" value={String(oidcUser?.given_name ?? '')} isReadOnly />
        <TextInput label="Cognome" value={String(oidcUser?.family_name ?? '')} isReadOnly />
        <TextInput label="Email" value={String(oidcUser?.email ?? '')} isReadOnly />
        <a href={account} target="_blank" rel="noopener noreferrer" className={btn.secondary}>Apri il tuo account (nuova scheda)</a>
      </Panel>
      <Panel labelledBy="profile-notifications" className="space-y-4 p-6">
        <h2 id="profile-notifications" className="text-lg font-bold">Avvisi sugli eventi</h2>
        <p>Consenso facoltativo e separato dai questionari; richiede email verificata.
          Versione dell'informativa: {subscription?.version ?? 'non disponibile'}.
          Nessun servizio di invio è attualmente configurato.</p>
        <Link className="font-bold underline" to="/privacy">Leggi l'informativa sulla privacy</Link>
        <div className="flex flex-wrap gap-3">
          <Button className={btn.secondary} isDisabled={busy || !subscription}
            onPress={() => void subscribe('monthly-upcoming-events', !subscription?.monthlyUpcomingEvents)}>
            {subscription?.monthlyUpcomingEvents ? 'Revoca riepilogo mensile' : 'Iscriviti al riepilogo mensile'}
          </Button>
          <Button className={btn.secondary} isDisabled={busy || !subscription}
            onPress={() => void subscribe('event-announcements', !subscription?.eventAnnouncements)}>
            {subscription?.eventAnnouncements ? 'Revoca annunci eventi' : 'Iscriviti agli annunci eventi'}
          </Button>
        </div>
      </Panel>
      <Panel labelledBy="profile-privacy" className="space-y-4 p-6">
        <h2 id="profile-privacy" className="text-lg font-bold">Dati personali e cancellazione</h2>
        <p>{status}</p>
        <p>L'esportazione è personale e può contenere risposte sensibili. I dati legacy non attribuibili
          richiedono una verifica separata: un export non dimostra l'assenza di altri dati.</p>
        <Button className={btn.secondary} isDisabled={busy} onPress={() => void exportData()}>Esporta i miei dati</Button>
        <p>La cancellazione è irreversibile: elimina il profilo Keycloak, le tue risposte e i questionari
          che hai creato, comprese tutte le risposte di altre persone a quei questionari.
          Le copie di sicurezza interessate vengono eliminate. Dati non attribuibili, configurazioni
          non sicure o copie esterne non verificate bloccano il completamento.</p>
        <Button className={btn.secondary} isDisabled={busy}
          onPress={() => void login(window.location.pathname, { acr_values: 'mfa', max_age: '0', prompt: 'login' })}>
          Verifica MFA per la cancellazione
        </Button>
        <label className="flex gap-3"><input type="checkbox" checked={acknowledged}
          onChange={event => setAcknowledged(event.target.checked)} />
          Ho compreso l'eliminazione irreversibile dei questionari creati e di tutte le loro risposte.</label>
        <TextInput label="Scrivi ELIMINA per confermare" value={confirmation} onChange={setConfirmation} />
        <Button className={btn.danger} isDisabled={busy || !acknowledged || confirmation !== 'ELIMINA'}
          onPress={() => void erase()}>Cancella definitivamente il mio account</Button>
      </Panel>
      <PrivacyAdministration request={request} />
    </div>
  </>;
}

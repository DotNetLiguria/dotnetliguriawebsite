import React, { useState } from 'react';
import { Button } from 'react-aria-components';
import { useOidc } from '@axa-fr/react-oidc';
import { useLocation } from 'react-router-dom';
import { useAccountCapabilities } from '../../account/AccountCapabilities';
import { ErasureOperation, useAccountRequest } from '../../account/accountApi';
import { useAccountResource } from '../../account/useAccountResource';
import { accountReturnPath } from '../../account/returnPath';
import { PageHeader, Panel, btn } from '../ui';
import { hasPermission, hasAnyPermission, PRIVACY_PERMISSIONS } from '../../account/permissions';

type Campaign = { id: string; recipientCount: number; expiresAt: string };
const stageLabel = (stage: string) => stage === 'awaiting_manual_identity_removal'
  ? 'In attesa della rimozione manuale dell’identità' : stage.startsWith('blocked_') ? `Bloccata (${stage})` : `Da verificare (${stage})`;
const noticeLabel = (status: string) => ({
  not_required: 'Non richiesto', queued: 'In coda', sending: 'Invio in corso',
  accepted: 'Accettato dal server SMTP', accepted_by_smtp: 'Accettato dal server SMTP', failed: 'Invio non riuscito',
})[status] ?? `Da verificare (${status})`;

export default function PrivacyAdministration() {
  const { capabilities } = useAccountCapabilities();
  if (!hasAnyPermission(capabilities, PRIVACY_PERMISSIONS))
    return <><PageHeader title="Accesso non autorizzato" /><p>Questa sezione richiede un permesso privacy o avvisi specifico.</p></>;
  return <Administration />;
}

function Administration() {
  const { capabilities } = useAccountCapabilities();
  const can = (permission: Parameters<typeof hasPermission>[1]) => hasPermission(capabilities, permission);
  const privacyAdmin = hasAnyPermission(capabilities, PRIVACY_PERMISSIONS.filter(permission => permission.startsWith('privacy.')));
  const notificationAdmin = can('notifications.preview') || can('notifications.confirm');
  const request = useAccountRequest();
  const { login } = useOidc();
  const location = useLocation();
  const operations = useAccountResource<ErasureOperation[]>('privacy/admin/operations', can('privacy.operations.read'));
  const [policy, setPolicy] = useState('{}');
  const [report, setReport] = useState('');
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [eventIds, setEventIds] = useState('');
  const run = async (action: () => Promise<void>) => {
    setBusy(true); setError('');
    try { await action(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Operazione non completata.'); }
    finally { setBusy(false); }
  };
  const loadPolicy = () => run(async () => {
    const retention = await request('privacy/admin/retention');
    const value = await retention.json() as { overrides: Record<string, string>; blockingOverrides: string[] };
    setPolicy(JSON.stringify(value.overrides, null, 2));
    setReport(JSON.stringify(value.blockingOverrides));
    operations.reload();
  });
  return <>
    <PageHeader title="Privacy e avvisi" description="Regole, richieste pendenti e preparazione degli avvisi. Ogni funzione richiede il proprio permesso." />
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-900">{error}</p>}
    {privacyAdmin && <Panel labelledBy="privacy-administration" className="space-y-4 p-6">
      <h2 id="privacy-administration" className="text-lg font-bold">Amministrazione privacy</h2>
      <p>Qualsiasi conservazione non valutata blocca la cancellazione. I report non contengono valori personali.
        Il recupero di operazioni distruttive richiede una verifica MFA recente.</p>
      <Button className={btn.secondary} onPress={() => void login(accountReturnPath(location),
        { acr_values: 'mfa', max_age: '0', prompt: 'login' })}>Verifica MFA per il recupero</Button>
      <h3 className="font-bold">Richieste pendenti</h3>
      {operations.loading && <p role="status">Caricamento richieste pendenti…</p>}
      {operations.error && <p role="alert">Richieste pendenti non disponibili: {operations.error}</p>}
      <Button className={btn.secondary} isDisabled={operations.loading || !can('privacy.operations.read')} onPress={operations.reload}>Aggiorna richieste pendenti</Button>
      {operations.data?.length === 0 && <p>Nessuna richiesta pendente.</p>}
      {operations.data?.map(operation => <OperationCard key={operation.id} operation={operation} reload={operations.reload} />)}
      <Button className={btn.secondary} isDisabled={busy || !can('privacy.retention.read')} onPress={() => void loadPolicy()}>Carica regole e richieste pendenti</Button>
      <label className="block font-bold" htmlFor="retention-overrides">Regole di cancellazione (JSON campo/azione)</label>
      <textarea disabled={!can('privacy.retention.manage')} id="retention-overrides" className="min-h-32 w-full rounded-xl border p-3 font-mono" value={policy}
        onChange={event => { setPolicy(event.target.value); setConfirmed(false); }} />
      <label className="flex gap-3"><input type="checkbox" checked={confirmed}
        onChange={event => setConfirmed(event.target.checked)} />Confermo la sostituzione delle regole.</label>
      <Button className={btn.secondary} isDisabled={busy || !confirmed || !can('privacy.retention.manage')} onPress={() => void run(async () => {
        const value: unknown = JSON.parse(policy);
        if (!value || typeof value !== 'object' || Array.isArray(value) ||
          Object.values(value).some(action => typeof action !== 'string')) throw new Error('Inserisci un oggetto JSON campo/azione.');
        const response = await request('privacy/admin/retention', { method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'X-Confirm-Retention-Policy': 'replace' }, body: JSON.stringify(value) });
        setReport(JSON.stringify(await response.json()));
        setConfirmed(false);
      })}>Sostituisci regole</Button>
      {report && <pre className="overflow-x-auto whitespace-pre-wrap" aria-label="Report privacy">{report}</pre>}
    </Panel>}
    {notificationAdmin && <Panel labelledBy="campaign-preparation" className="space-y-4 p-6">
      <h2 id="campaign-preparation" className="text-lg font-bold">Prepara avvisi</h2>
      <p>Anteprima del riepilogo degli eventi pubblicati del prossimo mese, senza indirizzi email.
        La conferma non invia messaggi: manca un fornitore approvato.</p>
      <Button className={btn.secondary} isDisabled={busy || !can('notifications.preview')} onPress={() => void run(async () => {
        const response = await request('notifications/campaigns/preview', { method: 'POST',
          headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ purpose: 'monthly-upcoming-events', eventIds: [] }) });
        setCampaign(await response.json() as Campaign);
      })}>Anteprima riepilogo mensile</Button>
      <label className="block font-bold" htmlFor="campaign-events">Eventi da annunciare (ID separati da virgola, massimo 20)</label>
      <input id="campaign-events" className="w-full rounded-xl border p-3" value={eventIds}
        onChange={event => { setEventIds(event.target.value); setCampaign(null); }} />
      <Button className={btn.secondary} isDisabled={busy || !eventIds.trim() || !can('notifications.preview')} onPress={() => void run(async () => {
        const ids = eventIds.split(',').map(value => value.trim());
        if (ids.length > 20 || ids.some(id => !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)))
          throw new Error('Inserisci da 1 a 20 identificativi evento validi.');
        const response = await request('notifications/campaigns/preview', { method: 'POST',
          headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ purpose: 'event-announcements', eventIds: ids }) });
        setCampaign(await response.json() as Campaign);
      })}>Anteprima annunci eventi</Button>
      {campaign && <>
        <p role="status">{campaign.recipientCount} destinatari idonei. Scadenza: {campaign.expiresAt}. Nessun messaggio inviato.</p>
        <Button className={btn.secondary} isDisabled={busy || !can('notifications.confirm')} onPress={() => void run(async () => {
          await request(`notifications/campaigns/${encodeURIComponent(campaign.id)}/confirm`, {
            method: 'POST', headers: { 'X-Confirm-Campaign': campaign.id },
          });
        })}>Conferma preparazione senza invio</Button>
      </>}
    </Panel>}
  </>;
}

function OperationCard({ operation, reload }: { operation: ErasureOperation; reload: () => void }) {
  const { capabilities } = useAccountCapabilities();
  const can = (permission: Parameters<typeof hasPermission>[1]) => hasPermission(capabilities, permission);
  const request = useAccountRequest();
  const [identity, setIdentity] = useState<{ issuer: string; subject: string } | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [report, setReport] = useState('');
  const path = `privacy/admin/operations/${encodeURIComponent(operation.id)}`;
  const run = async (action: () => Promise<void>) => {
    setBusy(true); setError(''); setMessage('');
    try { await action(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Operazione non completata.'); }
    finally { setBusy(false); }
  };
  const mutate = (action: 'resume' | 'verify-removal' | 'retry-notification', confirmation: string) => run(async () => {
    const response = await request(`${path}/${action}`, { method: 'POST', headers: { 'X-Confirm-Erasure': confirmation } });
    const result = await response.json() as { status: string };
    if (action === 'retry-notification') {
      if (response.status !== 202 || result.status !== 'queued') throw new Error('Accodamento non confermato.');
      setMessage('Avviso accodato. Non è una conferma di consegna.');
    } else if (result.status === 'completed' && response.status === 200) {
      setIdentity(null); setMessage('Cancellazione completata e verificata.');
    } else if (action === 'resume' && result.status === 'awaiting_manual_identity_removal' && response.status === 202) {
      setMessage('Richiesta ancora pendente: rimozione manuale dell’identità necessaria.');
    } else throw new Error('Completamento non confermato.');
    setConfirmed(false); reload();
  });
  return <section className="space-y-3 rounded-xl border border-line p-4" aria-label={`Richiesta ${operation.id}`}>
    <h4 className="font-bold">Richiesta {operation.id}</h4>
    <p>Fase: {stageLabel(operation.stage)}</p>
    <p>Avviso amministrativo: {noticeLabel(operation.notificationStatus)}. Tentativi: {operation.notificationAttempts}.
      L’accettazione SMTP non garantisce la consegna nella casella.</p>
    {operation.notificationError && <p role="alert">Errore avviso: {operation.notificationError}</p>}
    {error && <p role="alert">{error}</p>}
    {message && <p role="status">{message}</p>}
    <div className="flex flex-wrap gap-3">
      <Button className={btn.secondary} isDisabled={busy || !can('privacy.operations.read')} onPress={() => void run(async () => {
        setReport(JSON.stringify(await (await request(`${path}/report`)).json()));
      })}>Mostra report</Button>
      <Button className={btn.secondary} isDisabled={busy || !can('privacy.identities.read')} onPress={() => void run(async () => {
        setIdentity(await (await request(`${path}/identity`)).json() as { issuer: string; subject: string });
      })}>Mostra identità per rimozione manuale (MFA)</Button>
      {identity && <Button className={btn.secondary} onPress={() => setIdentity(null)}>Nascondi identità</Button>}
    </div>
    {report && <pre className="overflow-x-auto whitespace-pre-wrap" aria-label="Report richiesta">{report}</pre>}
    {identity && <dl className="break-all"><dt className="font-bold">Issuer</dt><dd>{identity.issuer}</dd><dt className="font-bold">Subject</dt><dd>{identity.subject}</dd></dl>}
    <p>Rimuovi l’identità nel sistema di identità prima di verificarne l’assenza. Non è possibile contrassegnare manualmente una richiesta come completata.</p>
    <label className="flex min-h-11 items-center gap-3"><input type="checkbox" className="size-6" checked={confirmed}
      onChange={event => setConfirmed(event.target.checked)} />Confermo l’azione sulla richiesta {operation.id}.</label>
    <div className="flex flex-wrap gap-3">
      <Button className={btn.secondary} isDisabled={busy || !confirmed || !can('privacy.operations.manage')} onPress={() => void mutate('resume', 'resume-erasure')}>Riprova cancellazione automatica</Button>
      <Button className={btn.danger} isDisabled={busy || !confirmed || !can('privacy.operations.manage')} onPress={() => void mutate('verify-removal', 'verify-identity-removal')}>Verifica identità già rimossa</Button>
      <Button className={btn.secondary} isDisabled={busy || !confirmed || !can('privacy.notifications.retry')} onPress={() => void mutate('retry-notification', 'retry-notification')}>Riprova avviso amministrativo</Button>
    </div>
  </section>;
}

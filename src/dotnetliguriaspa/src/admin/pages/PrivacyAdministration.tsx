import React, { useState } from 'react';
import { Button } from 'react-aria-components';
import { useAccountCapabilities } from '../../account/AccountCapabilities';
import { ErasureOperation, useAccountRequest } from '../../account/accountApi';
import { useAccountResource } from '../../account/useAccountResource';
import { useMfaWindow } from '../../account/useMfaWindow';
import { PageHeader, Panel, btn } from '../ui';
import MfaVerification from '../MfaVerification';
import { hasPermission, hasAnyPermission, PRIVACY_PERMISSIONS } from '../../account/permissions';

type Campaign = { id: string; recipientCount: number; expiresAt: string };
type RetentionPolicy = { overrides: Record<string, string>; blockingOverrides: string[]; fields: string[] };
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
  const needsMfa = can('privacy.operations.manage') || can('privacy.identities.read');
  const mfa = useMfaWindow();
  const request = useAccountRequest();
  const operations = useAccountResource<ErasureOperation[]>('privacy/admin/operations', can('privacy.operations.read'));
  const [policy, setPolicy] = useState('{}');
  const [savedPolicy, setSavedPolicy] = useState<string | null>(null);
  const [retentionFields, setRetentionFields] = useState<string[]>([]);
  const [blockingOverrides, setBlockingOverrides] = useState<string[] | null>(null);
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
    const value = await retention.json() as RetentionPolicy;
    const formatted = JSON.stringify(value.overrides, null, 2);
    setPolicy(formatted);
    setSavedPolicy(formatted);
    setRetentionFields(value.fields);
    setBlockingOverrides(value.blockingOverrides);
    setConfirmed(false);
  });
  return <>
    <PageHeader title="Privacy e avvisi" description="Regole, richieste pendenti e preparazione degli avvisi. Ogni funzione richiede il proprio permesso." />
    {needsMfa && <MfaVerification mfa={mfa} busy={busy} />}
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-900">{error}</p>}
    {privacyAdmin && <Panel labelledBy="privacy-administration" className="space-y-4 p-6">
      <h2 id="privacy-administration" className="text-lg font-bold">Amministrazione privacy</h2>
      <p>Le richieste di cancellazione che richiedono intervento appaiono qui. I dettagli e le azioni per ogni richiesta
        compaiono solo se esiste una richiesta pendente e il tuo account ha i permessi necessari; la verifica MFA è mostrata sopra.</p>
      <h3 className="font-bold">Richieste pendenti</h3>
      {operations.loading && <p role="status">Caricamento richieste pendenti…</p>}
      {operations.error && <p role="alert">Richieste pendenti non disponibili: {operations.error}</p>}
      <Button className={btn.secondary} isDisabled={operations.loading || !can('privacy.operations.read')} onPress={operations.reload}>Aggiorna richieste pendenti</Button>
      {operations.data?.length === 0 && <p>Nessuna richiesta pendente.</p>}
      {operations.data?.map(operation => <OperationCard key={operation.id} operation={operation} reload={operations.reload} />)}
      <h3 className="font-bold">Regole di conservazione per la cancellazione</h3>
      <p>Queste regole indicano quali campi possono essere eliminati quando una persona cancella il proprio account.
        Ogni chiave deve essere un percorso presente nell’inventario qui sotto e l’azione supportata è <code>delete</code>.
        Qualsiasi altra azione segnala un dato trattenuto e blocca il completamento della cancellazione.
        La guida tecnica è in <code>docs/privacy-backend.md</code>, sezione “Regole di conservazione”.</p>
      <Button className={btn.secondary} isDisabled={busy || !can('privacy.retention.read')} onPress={() => void loadPolicy()}>Carica regole di conservazione</Button>
      {retentionFields.length > 0 && <details>
        <summary className="min-h-11 cursor-pointer py-2 font-semibold">Percorsi campo validi</summary>
        <ul className="list-inside list-disc break-all font-mono text-sm">{retentionFields.map(field => <li key={field}>{field}</li>)}</ul>
      </details>}
      <label className="block font-bold" htmlFor="retention-overrides">Sostituzioni delle regole (JSON campo/azione)</label>
      <textarea disabled={!can('privacy.retention.manage')} id="retention-overrides" className="min-h-32 w-full rounded-xl border p-3 font-mono" value={policy}
        onChange={event => { setPolicy(event.target.value); setConfirmed(false); }} />
      <label className="flex gap-3"><input type="checkbox" checked={confirmed} disabled={savedPolicy === null || policy === savedPolicy}
        onChange={event => setConfirmed(event.target.checked)} />Confermo la sostituzione delle regole.</label>
      <Button className={btn.secondary} isDisabled={busy || !confirmed || savedPolicy === null || policy === savedPolicy || !can('privacy.retention.manage')} onPress={() => void run(async () => {
        const value: unknown = JSON.parse(policy);
        if (!value || typeof value !== 'object' || Array.isArray(value) ||
          Object.values(value).some(action => typeof action !== 'string')) throw new Error('Inserisci un oggetto JSON campo/azione.');
        if (Object.keys(value).some(field => !retentionFields.includes(field)))
          throw new Error('Usa solo percorsi presenti nell’inventario. Carica prima le regole per vedere l’elenco valido.');
        const response = await request('privacy/admin/retention', { method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'X-Confirm-Retention-Policy': 'replace' }, body: JSON.stringify(value) });
        const result = await response.json() as { blockingOverrides: string[] };
        const formatted = JSON.stringify(value, null, 2);
        setPolicy(formatted);
        setSavedPolicy(formatted);
        setBlockingOverrides(result.blockingOverrides);
        setConfirmed(true);
      })}>Sostituisci regole</Button>
      {blockingOverrides !== null && <section aria-label="Esito regole di conservazione" className="space-y-2">
        <h4 className="font-bold">Campi che bloccano la cancellazione</h4>
        {blockingOverrides.length === 0
          ? <p>Nessuna sostituzione blocca la cancellazione.</p>
          : <ul className="list-inside list-disc break-all font-mono text-sm">{blockingOverrides.map(field => <li key={field}>{field}</li>)}</ul>}
      </section>}
    </Panel>}
    {notificationAdmin && <Panel labelledBy="campaign-preparation" className="space-y-4 p-6">
      <h2 id="campaign-preparation" className="text-lg font-bold">Prepara avvisi</h2>
      <p>Gli avvisi sono email riepilogative di eventi: il riepilogo mensile considera gli eventi pubblicati del prossimo mese;
        gli annunci riguardano gli eventi pubblicati e imminenti che selezioni. L’anteprima conta solo le persone con consenso
        attuale per quel tipo di avviso e senza una cancellazione account pendente: non mostra indirizzi email e non invia nulla.
        Il conteggio è indicativo e l’anteprima scade dopo 30 minuti. L’invio è disabilitato perché non è configurato un fornitore approvato.</p>
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
        })}>Conferma preparazione (invio non disponibile)</Button>
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

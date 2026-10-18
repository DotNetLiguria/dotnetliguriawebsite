import React, { useState } from 'react';
import { Button } from 'react-aria-components';
import { useOidcAccessToken } from '@axa-fr/react-oidc';
import { hasFeedbackAdmin } from '../../questionnaire/adminAccess';
import { Panel, btn } from '../ui';

type Campaign = { id: string; recipientCount: number; expiresAt: string };
type Operation = { id: string; stage: string };

export default function PrivacyAdministration({ request }: {
  request: (path: string, init?: RequestInit) => Promise<Response>;
}) {
  const { accessTokenPayload } = useOidcAccessToken();
  const privacyAdmin = hasFeedbackAdmin([accessTokenPayload], 'privacyadmin', '');
  const notificationAdmin = hasFeedbackAdmin([accessTokenPayload], 'notificationadmin', '');
  const [policy, setPolicy] = useState('{}');
  const [operations, setOperations] = useState<Operation[]>([]);
  const [report, setReport] = useState('');
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [resumeConfirmed, setResumeConfirmed] = useState(false);
  const [eventIds, setEventIds] = useState('');
  if (!privacyAdmin && !notificationAdmin) return null;
  const run = async (action: () => Promise<void>) => {
    setBusy(true); setError('');
    try { await action(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Operazione non completata.'); }
    finally { setBusy(false); }
  };
  const loadPolicy = () => run(async () => {
    const [retention, pending] = await Promise.all([
      request('privacy/admin/retention'), request('privacy/admin/operations'),
    ]);
    const value = await retention.json() as { overrides: Record<string, string>; blockingOverrides: string[] };
    setPolicy(JSON.stringify(value.overrides, null, 2));
    setReport(JSON.stringify(value.blockingOverrides));
    setOperations(await pending.json() as Operation[]);
  });
  return <>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-900">{error}</p>}
    {privacyAdmin && <Panel labelledBy="privacy-administration" className="space-y-4 p-6">
      <h2 id="privacy-administration" className="text-lg font-bold">Amministrazione privacy</h2>
      <p>Qualsiasi conservazione non valutata blocca la cancellazione. I report non contengono valori personali.
        Il recupero di operazioni distruttive richiede una verifica MFA recente.</p>
      <Button className={btn.secondary} isDisabled={busy} onPress={() => void loadPolicy()}>Carica regole e richieste pendenti</Button>
      <label className="block font-bold" htmlFor="retention-overrides">Regole di cancellazione (JSON campo/azione)</label>
      <textarea id="retention-overrides" className="min-h-32 w-full rounded-xl border p-3 font-mono" value={policy}
        onChange={event => { setPolicy(event.target.value); setConfirmed(false); }} />
      <label className="flex gap-3"><input type="checkbox" checked={confirmed}
        onChange={event => setConfirmed(event.target.checked)} />Confermo la sostituzione delle regole.</label>
      <Button className={btn.secondary} isDisabled={busy || !confirmed} onPress={() => void run(async () => {
        const value: unknown = JSON.parse(policy);
        if (!value || typeof value !== 'object' || Array.isArray(value) ||
          Object.values(value).some(action => typeof action !== 'string')) throw new Error('Inserisci un oggetto JSON campo/azione.');
        const response = await request('privacy/admin/retention', { method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'X-Confirm-Retention-Policy': 'replace' }, body: JSON.stringify(value) });
        setReport(JSON.stringify(await response.json()));
        setConfirmed(false);
      })}>Sostituisci regole</Button>
      {report && <pre className="overflow-x-auto whitespace-pre-wrap" aria-label="Report privacy">{report}</pre>}
      {operations.length > 0 && <label className="flex gap-3"><input type="checkbox" checked={resumeConfirmed}
        onChange={event => setResumeConfirmed(event.target.checked)} />Confermo la ripresa delle cancellazioni pendenti.</label>}
      {operations.map(operation => <div key={operation.id} className="space-x-3 rounded-xl border p-3">
        <span>Richiesta {operation.id}: {operation.stage}</span>
        <Button className={btn.secondary} isDisabled={busy} onPress={() => void run(async () => {
          const response = await request(`privacy/admin/operations/${encodeURIComponent(operation.id)}/report`);
          setReport(JSON.stringify(await response.json()));
        })}>Mostra report {operation.id}</Button>
        <Button className={btn.secondary} isDisabled={busy || !resumeConfirmed} onPress={() => void run(async () => {
          await request(`privacy/admin/operations/${encodeURIComponent(operation.id)}/resume`, {
            method: 'POST', headers: { 'X-Confirm-Erasure': 'resume-erasure' },
          });
          setResumeConfirmed(false);
          setOperations(current => current.filter(item => item.id !== operation.id));
        })}>Riprendi cancellazione {operation.id}</Button>
      </div>)}
    </Panel>}
    {notificationAdmin && <Panel labelledBy="campaign-preparation" className="space-y-4 p-6">
      <h2 id="campaign-preparation" className="text-lg font-bold">Prepara avvisi</h2>
      <p>Anteprima del riepilogo degli eventi pubblicati del prossimo mese, senza indirizzi email.
        La conferma non invia messaggi: manca un fornitore approvato.</p>
      <Button className={btn.secondary} isDisabled={busy} onPress={() => void run(async () => {
        const response = await request('notifications/campaigns/preview', { method: 'POST',
          headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ purpose: 'monthly-upcoming-events', eventIds: [] }) });
        setCampaign(await response.json() as Campaign);
      })}>Anteprima riepilogo mensile</Button>
      <label className="block font-bold" htmlFor="campaign-events">Eventi da annunciare (ID separati da virgola, massimo 20)</label>
      <input id="campaign-events" className="w-full rounded-xl border p-3" value={eventIds}
        onChange={event => { setEventIds(event.target.value); setCampaign(null); }} />
      <Button className={btn.secondary} isDisabled={busy || !eventIds.trim()} onPress={() => void run(async () => {
        const ids = eventIds.split(',').map(value => value.trim());
        if (ids.length > 20 || ids.some(id => !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)))
          throw new Error('Inserisci da 1 a 20 identificativi evento validi.');
        const response = await request('notifications/campaigns/preview', { method: 'POST',
          headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ purpose: 'event-announcements', eventIds: ids }) });
        setCampaign(await response.json() as Campaign);
      })}>Anteprima annunci eventi</Button>
      {campaign && <>
        <p role="status">{campaign.recipientCount} destinatari idonei. Scadenza: {campaign.expiresAt}. Nessun messaggio inviato.</p>
        <Button className={btn.secondary} isDisabled={busy} onPress={() => void run(async () => {
          await request(`notifications/campaigns/${encodeURIComponent(campaign.id)}/confirm`, {
            method: 'POST', headers: { 'X-Confirm-Campaign': campaign.id },
          });
        })}>Conferma preparazione senza invio</Button>
      </>}
    </Panel>}
  </>;
}

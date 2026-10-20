import React, { useEffect, useState } from 'react';
import { Button } from 'react-aria-components';
import { useCan } from '../../account/PermissionGate';
import { useMfaWindow } from '../../account/useMfaWindow';
import { AdminApiError, useAdminFetch } from '../adminApi';
import MfaVerification from '../MfaVerification';
import { btn } from '../ui';

type Account = { subject: string; username: string | null; enabled: boolean };
type Status = { speakerId: string; email: string | null; account: Account | null; candidates: Account[]; onboardingState: string | null };
type Action = { kind: 'link'; account: Account } | { kind: 'create-and-invite' | 'resend-invitation' };
const states: Record<string, string> = {
  'create-pending': 'Creazione in corso: non ripetere la richiesta.',
  'create-uncertain': 'Esito della creazione incerto: richiedi una verifica amministrativa. Non creare un altro account.',
  created: 'Account creato. Invito non ancora confermato.',
  'created-unverified': 'Account creato ma collegamento non verificato: richiedi una verifica amministrativa.',
  'invitation-pending': 'Invio dell’invito in corso o non ancora verificato.',
  'invitation-failed': 'Account creato e collegato, ma invio dell’invito non riuscito. Puoi richiedere un nuovo invio.',
  invited: 'Invito accettato dall’Identity Provider. La consegna dell’email non è verificata.',
};
const errors: Record<string, string> = {
  speaker_account_creation_already_attempted: 'Una creazione è già stata tentata. Ricarica lo stato; non creare un altro account.',
  speaker_account_email_required: 'Salva un’email valida nel profilo prima di procedere.',
  speaker_account_email_match_changed: 'La corrispondenza email è cambiata. Ricarica lo stato prima di procedere.',
  speaker_profile_changed: 'Il profilo è cambiato. Ricarica lo stato prima di procedere.',
};

export default function SpeakerAccountPanel({ speakerId, email }: { speakerId: string; email?: string | null }) {
  const can = useCan();
  return can('speakers.read') && can('access.users.read')
    ? <Controls key={`${speakerId}:${email ?? ''}`} speakerId={speakerId} />
    : <p className="text-sm text-muted">Il profilo speaker e la foto non richiedono un account dell’Identity Provider.</p>;
}

function Controls({ speakerId }: { speakerId: string }) {
  const api = useAdminFetch();
  const can = useCan();
  const mfa = useMfaWindow();
  const [status, setStatus] = useState<Status | null>(null);
  const [revision, setRevision] = useState(0);
  const [pending, setPending] = useState<Action | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const endpoint = `/admin/speaker-accounts/${speakerId}`;
  const canManage = can('speakers.manage') && can('access.users.read');
  const canCreate = canManage && can('access.users.create');
  const explain = (reason: unknown) => reason instanceof AdminApiError ? errors[reason.code] ?? reason.message : 'Errore di rete.';
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    void api<Status>(endpoint, { signal: controller.signal }).then(data => { if (active) setStatus(data); })
      .catch(reason => { if (active) setError(explain(reason)); });
    return () => { active = false; controller.abort(); };
  }, [api, endpoint, revision]);
  const reload = () => { setError(''); setStatus(null); setPending(null); setRevision(value => value + 1); };
  const confirm = async () => {
    if (!status || !pending || busy || !mfa.active || !canManage || (pending.kind !== 'link' && !canCreate)) return;
    setBusy(true); setError('');
    try {
      await api(`${endpoint}/${pending.kind}`, {
        method: 'POST', headers: { 'X-Confirm-Speaker-Change': pending.kind },
        body: JSON.stringify({
          expectedEmail: status.email,
          ...(pending.kind === 'link' ? { subject: pending.account.subject }
            : pending.kind === 'resend-invitation' ? { subject: status.account?.subject } : {}),
        }),
      });
      reload();
    } catch (reason) {
      setStatus(null); setPending(null);
      setError(`${explain(reason)} L’esito potrebbe essere parziale. Ricarica lo stato prima di qualsiasi altra modifica.`);
    } finally { setBusy(false); }
  };
  return <section aria-label="Account speaker" className="space-y-3 border-t border-line pt-4">
    <h3 className="text-lg font-bold">Account speaker nell’Identity Provider</h3>
    <p className="text-sm">Associazione e invito sono operazioni esplicite, separate dal salvataggio del profilo. Non assegnano permessi Board. Una corrispondenza email non collega automaticamente l’account.</p>
    {canManage && <MfaVerification mfa={mfa} busy={busy} />}
    {error && <p role="alert">{error}</p>}
    {!status && !error && <p role="status">Verifica account speaker…</p>}
    <Button className={btn.secondary} isDisabled={busy} onPress={reload}>Ricarica account speaker</Button>
    {status && <>
      <p>{status.account ? `Account collegato: ${status.account.username || status.account.subject}` : 'Nessun account collegato.'}</p>
      {status.account && <p className="text-xs text-muted">Identificativo account: {status.account.subject}</p>}
      {status.onboardingState && <p role="status">{states[status.onboardingState] ?? 'Stato non riconosciuto: richiedi una verifica amministrativa.'}</p>}
      {!status.account && !status.onboardingState && <>
        {!status.email && <p>Salva un’email nel profilo per cercare o creare un account. La foto può essere caricata anche senza email.</p>}
        {status.candidates.map(account => <Button key={account.subject} className={btn.secondary}
          isDisabled={busy || !canManage || !mfa.active || !account.enabled || status.candidates.filter(candidate => candidate.enabled).length !== 1}
          onPress={() => setPending({ kind: 'link', account })}>Collega {account.username || account.subject}</Button>)}
        {!!status.candidates.length && <p>Il collegamento usa l’email salvata e non invia inviti né reimposta l’accesso di un account esistente.</p>}
        {!status.candidates.length && status.email && canCreate && <Button className={btn.primary} isDisabled={busy || !mfa.active}
          onPress={() => setPending({ kind: 'create-and-invite' })}>Crea account e invia invito</Button>}
      </>}
      {status.account && canCreate && ['created', 'invitation-failed', 'invitation-pending', 'invited'].includes(status.onboardingState ?? '') &&
        <Button className={btn.secondary} isDisabled={busy || !mfa.active} onPress={() => setPending({ kind: 'resend-invitation' })}>Invia nuovamente l’invito</Button>}
      {pending && <div role="alert" className="space-y-3 rounded-xl border border-line p-4">
        <p>{pending.kind === 'link' ? `Confermi il collegamento a ${pending.account.username || pending.account.subject}?`
          : pending.kind === 'create-and-invite' ? `Confermi la creazione di un account per ${status.email} e l’invio dell’invito?`
            : `Confermi un nuovo invio dell’invito a ${status.email}?`}</p>
        {pending.kind !== 'link' && <p>L’Identity Provider invierà le istruzioni per completare l’accesso. La consegna dell’email non è garantita.</p>}
        <Button className={btn.ghost} isDisabled={busy} onPress={() => setPending(null)}>Annulla modifica account speaker</Button>
        <Button className={btn.primary} isDisabled={busy || !mfa.active} onPress={() => void confirm()}>Conferma modifica account speaker</Button>
      </div>}
    </>}
  </section>;
}

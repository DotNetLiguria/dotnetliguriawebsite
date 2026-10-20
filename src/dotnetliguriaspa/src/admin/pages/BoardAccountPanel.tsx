import React, { useEffect, useState } from 'react';
import { Button } from 'react-aria-components';
import { useCan } from '../../account/PermissionGate';
import { useMfaWindow } from '../../account/useMfaWindow';
import { AdminApiError, useAdminFetch, useAdminLoad } from '../adminApi';
import MfaVerification from '../MfaVerification';
import { btn, TextInput } from '../ui';

type Account = { subject: string; username: string | null; enabled: boolean };
type Status = { boardId: string; email: string | null; account: Account | null; isMember: boolean; candidates: Account[] };
type Pending = { action: 'link'; account: Account; matchEmail: boolean } | { action: 'join' | 'leave'; account: Account };

function explanation(error: unknown) {
  const messages: Record<string, string> = {
    board_group_not_configured: 'Il gruppo Board non è configurato. Completare il provisioning dell’Identity Provider.',
    board_group_unsafe: 'I permessi del gruppo Board non corrispondono alla configurazione approvata. È necessario un controllo amministrativo.',
    board_email_match_changed: 'Nessun account univoco corrisponde all’email salvata. Ricarica o seleziona un account esistente.',
    board_profile_changed: 'La scheda o il collegamento è cambiato. Ricarica prima di riprovare.',
    board_account_already_linked: 'Questo account è già collegato a un’altra scheda.',
    board_account_index_required: 'Il collegamento richiede l’indice univoco degli account sul database. È necessario un intervento amministrativo approvato.',
    board_membership_changed: 'L’appartenenza al gruppo è cambiata. Ricarica prima di riprovare.',
    board_membership_unverified: 'Esito non verificato. Ricarica lo stato prima di qualsiasi altra modifica.',
    access_target_unavailable: 'Seleziona un account umano attivo dell’Identity Provider.',
    permission_required: 'Non possiedi tutti i permessi richiesti, inclusi quelli di lettura assegnati dal gruppo.',
  };
  return error instanceof AdminApiError ? messages[error.code] ?? error.message : 'Errore di rete';
}

/** Membership is deliberately separate from saving a public profile. */
export default function BoardAccountPanel({ boardId, email }: { boardId: string; email?: string | null }) {
  const can = useCan();
  return can('board.read') && can('access.users.read')
    ? <AccountControls key={`${boardId}:${email ?? ''}`} boardId={boardId} />
    : <p className="text-sm text-muted">Il profilo pubblico e il ruolo non determinano l’appartenenza al gruppo Board. Per gestire gli account serve l’autorizzazione alla lettura degli utenti.</p>;
}

function AccountControls({ boardId }: { boardId: string }) {
  const can = useCan();
  const api = useAdminFetch();
  const mfa = useMfaWindow();
  const [version, setVersion] = useState(0);
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState<string | null>(null);
  const endpoint = `/admin/board-accounts/${boardId}`;
  const canGrant = can('board.manage') && can('access.permissions.grant');
  const canRevoke = can('board.manage') && can('access.permissions.revoke');
  const canLink = can('board.manage') && can('access.users.read');

  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    api<Status>(endpoint, { signal: controller.signal })
      .then(data => { if (alive) setStatus(data); })
      .catch(reason => { if (alive) setError(explanation(reason)); });
    return () => { alive = false; controller.abort(); };
  }, [api, endpoint, version]);

  const reload = () => {
    setStatus(null); setError(''); setPending(null); setSearch(null); setVersion(value => value + 1);
  };

  const confirm = async () => {
    if (!pending || !status || !mfa.active || busy) return;
    setBusy(true);
    try {
      await api(`${endpoint}/${pending.action === 'link' ? 'link' : 'membership'}`, {
        method: 'POST', headers: { 'X-Confirm-Board-Change': pending.action },
        body: JSON.stringify(pending.action === 'link'
          ? { subject: pending.account.subject, expectedEmail: status.email, matchEmail: pending.matchEmail }
          : { subject: pending.account.subject, expectedMember: status.isMember, join: pending.action === 'join' }),
      });
      reload();
    } catch (reason) {
      // Never retry an uncertain write or present a stale status as verified.
      setStatus(null); setPending(null);
      setError(`${explanation(reason)} L’operazione potrebbe essere parziale: ricarica lo stato prima di riprovare.`);
    } finally { setBusy(false); }
  };

  return <section aria-label="Account e appartenenza al Board" className="space-y-3 border-t border-line pt-4">
    <h3 className="text-lg font-bold">Account e appartenenza al Board</h3>
    <p className="text-sm">Il gruppo Board abilita solo le letture previste del dashboard. Ruolo e visibilità sul sito rimangono indipendenti. I nuovi permessi richiedono un nuovo accesso o il rinnovo del token.</p>
    {(canLink || canGrant || canRevoke) && <MfaVerification mfa={mfa} busy={busy} />}
    {error && <p role="alert">{error}</p>}
    {!status && !error && <p role="status">Verifica dell’account…</p>}
    <Button className={btn.secondary} onPress={reload} isDisabled={busy}>Ricarica stato account</Button>
    {status && <>
      <p className="font-semibold">{status.account
        ? `${status.account.username || 'Account'}: ${status.isMember ? 'membro del gruppo Board' : 'collegato, non nel gruppo Board'}`
        : 'Profilo non collegato a un account'}</p>
      {status.account && <p className="text-xs text-muted">Identificativo account: {status.account.subject}</p>}
      {!status.account && <>
        {status.candidates.length !== 1 && <p>Nessun account univoco trovato tramite l’email salvata. Puoi correggere l’email nella scheda oppure cercare un account esistente.</p>}
        {status.candidates.length === 1 && status.candidates.map(account => <Button key={account.subject} className={btn.secondary}
          isDisabled={!canLink || !mfa.active || !account.enabled || busy}
          onPress={() => setPending({ action: 'link', account, matchEmail: true })}>
          Collega {account.username || account.subject}
        </Button>)}
        {canLink && <div className="space-y-2">
          <TextInput label="Cerca account nell’Identity Provider" value={query} onChange={setQuery} />
          <Button className={btn.secondary} isDisabled={busy} onPress={() => setSearch(query.trim())}>Cerca account</Button>
          {search !== null && <DirectoryResults key={search} search={search} disabled={!mfa.active || busy}
            onSelect={account => setPending({ action: 'link', account, matchEmail: false })} />}
        </div>}
      </>}
      {status.account && <Button className={status.isMember ? btn.danger : btn.primary}
        isDisabled={busy || !mfa.active || (status.isMember ? !canRevoke : !canGrant || !status.account.enabled)}
        onPress={() => setPending({ action: status.isMember ? 'leave' : 'join', account: status.account! })}>
        {status.isMember ? 'Rimuovi dal gruppo Board' : 'Aggiungi al gruppo Board'}
      </Button>}
      {status.account && <p className="text-sm text-muted">La rimozione dal gruppo conserva profilo, ruolo e collegamento. Permessi diretti o derivanti da altri gruppi possono continuare a consentire l’accesso.</p>}
      {pending && <div role="alert" className="space-y-3 rounded-xl border border-line p-4">
        <p>Confermi {pending.action === 'link' ? 'il collegamento del profilo a' : pending.action === 'join' ? 'l’aggiunta al gruppo Board di' : 'la rimozione dal gruppo Board di'} <strong>{pending.account.username || pending.account.subject}</strong>?</p>
        <p className="text-xs">{pending.account.subject}</p>
        {pending.action === 'link' && <p>Il collegamento non assegna permessi. Per concedere le letture devi poi confermare l’aggiunta al gruppo.</p>}
        <Button className={btn.ghost} isDisabled={busy} onPress={() => setPending(null)}>Annulla collegamento o modifica</Button>
        <Button className={btn.primary} isDisabled={busy || !mfa.active} onPress={() => void confirm()}>Conferma modifica account</Button>
      </div>}
    </>}
  </section>;
}

function DirectoryResults({ search, disabled, onSelect }: { search: string; disabled: boolean; onSelect: (account: Account) => void }) {
  const [directory] = useAdminLoad<{ users: Account[]; hasMore: boolean }>(
    `/admin/access/users?boardOnly=false&search=${encodeURIComponent(search)}&first=0&max=20`);
  if (directory.state === 'error') return <p role="alert">{directory.message}</p>;
  if (directory.state === 'loading') return <p role="status">Ricerca…</p>;
  return <>
    {!directory.data.users.length && <p>Nessun account trovato.</p>}
    {directory.data.users.map(account => <Button key={account.subject} className={`${btn.secondary} mr-2`}
      isDisabled={disabled || !account.enabled}
      onPress={() => onSelect(account)}>
      Seleziona {account.username || account.subject}
    </Button>)}
    {directory.data.hasMore && <p>Affina la ricerca per trovare altri account.</p>}
  </>;
}

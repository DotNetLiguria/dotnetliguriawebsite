import React, { useEffect, useRef, useState } from 'react';
import { Button, Dialog, Modal, ModalOverlay } from 'react-aria-components';
import { useOidcUser } from '@axa-fr/react-oidc';
import { useAccountCapabilities } from '../../account/AccountCapabilities';
import { useMfaWindow } from '../../account/useMfaWindow';
import MfaVerification from '../MfaVerification';
import { hasPermission, Permission } from '../../account/permissions';
import { AdminApiError, useAdminFetch, useAdminLoad } from '../adminApi';
import { PageHeader, Panel, btn } from '../ui';

type AccessUser = { issuer: string; subject: string; username: string; enabled: boolean; protectedTarget: boolean | null; isSelf?: boolean };
type Grants = {
  issuer: string; subject: string; directPermissions: string[]; inheritedPermissions: string[]; effectivePermissions: string[];
  protectedTarget: boolean; isSelf?: boolean; canGrant?: boolean; canRevoke?: boolean;
  grantablePermissions?: string[]; revocablePermissions?: string[];
};
type PermissionMetadata = { id: Permission; delegable: boolean };
type AuditEntry = {
  at: string; action: string; permission: string; actorSubject: string; actorUsername?: string | null;
  targetSubject: string; targetUsername?: string | null; outcome: string; correlationId: string;
};

const actionLabels: Record<string, string> = { grant: 'Concessione', revoke: 'Revoca' };
const outcomeLabels: Record<string, string> = { intent: 'Richiesta', verified: 'Verificata', unverified: 'Non verificata' };

function AuditAccount({ username, subject }: { username?: string | null; subject: string }) {
  return <>{username || 'Account non più disponibile'}<span className="block text-xs text-muted">{subject}</span></>;
}

function formatAuditTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('it-IT');
}

function accessError(reason: unknown) {
  const explanations: Record<string, string> = {
    access_assignment_changed: 'I permessi sono stati modificati da un altro operatore. Ricarica gli accessi prima di riprovare.',
    protected_access_target: 'Questo account è protetto: i suoi permessi devono essere gestiti nell’Identity Provider.',
    self_access_change_forbidden: 'Non puoi modificare i tuoi permessi.',
    permission_not_delegable: 'Questo permesso non può essere delegato dal pannello.',
    permission_remains_inherited: 'Il permesso è ereditato da un gruppo e non può essere revocato qui.',
    permission_not_directly_assigned: 'Il permesso non è più assegnato direttamente. Ricarica gli accessi.',
    access_target_unavailable: 'L’account non è disponibile per le modifiche.',
    access_audit_unavailable: 'La cronologia non è disponibile: la modifica è stata bloccata prima dell’invio all’Identity Provider.',
    permission_directory_unavailable: 'L’Identity Provider non è disponibile o ha rifiutato l’operazione. L’esito deve essere verificato ricaricando gli accessi.',
    permission_directory_not_configured: 'Il servizio di gestione dei permessi non è configurato correttamente.',
    access_change_not_verified: 'Non è stato possibile verificare la modifica. Ricarica gli accessi: non ripetere automaticamente l’operazione.',
    access_change_unverified: 'L’esito della modifica è incerto. Ricarica gli accessi: non ripetere automaticamente l’operazione.',
    recent_mfa_required: 'È richiesta una verifica MFA effettuata negli ultimi 5 minuti. Ripeti la verifica MFA (passo 1) e poi la modifica.',
  };
  if (reason instanceof AdminApiError) {
    const explanation = explanations[reason.code] ?? reason.message;
    return `${explanation}${reason.code ? ` (${reason.code})` : ''}`;
  }
  return reason instanceof Error ? reason.message : 'Modifica non completata.';
}

export default function AccessPage() {
  const { capabilities, refresh } = useAccountCapabilities();
  const { oidcUser } = useOidcUser();
  const mfa = useMfaWindow();
  const api = useAdminFetch();
  const canRead = hasPermission(capabilities, 'access.users.read');
  const canAudit = hasPermission(capabilities, 'access.audit.read');
  const canChange = hasPermission(capabilities, 'access.permissions.grant') || hasPermission(capabilities, 'access.permissions.revoke');
  const [catalogue] = useAdminLoad<{ permissions: PermissionMetadata[] }>('/admin/access/permissions', canRead);
  const [audit, reloadAudit] = useAdminLoad<{ entries: AuditEntry[] }>('/admin/access/audit?first=0&max=25', canAudit);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [boardOnly, setBoardOnly] = useState(true);
  const [listVersion, setListVersion] = useState(0);
  const [listing, setListing] = useState(false);
  const [first, setFirst] = useState(0);
  const [users, setUsers] = useState<AccessUser[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [selected, setSelected] = useState<AccessUser | null>(null);
  const [grants, setGrants] = useState<Grants | null>(null);
  const [detailsVersion, setDetailsVersion] = useState(0);
  const [needsReload, setNeedsReload] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [pending, setPending] = useState<{ permission: Permission; action: 'grant' | 'revoke' } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const feedback = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if ((error || message) && !pending) feedback.current?.focus();
  }, [error, message, pending]);

  useEffect(() => {
    const controller = new AbortController();
    setUsers([]); setHasMore(false); setSelected(null); setGrants(null); setPending(null);
    if (!canRead) return;
    setListing(true); setError('');
    api<{ users: AccessUser[]; hasMore: boolean }>(`/admin/access/users?search=${encodeURIComponent(filter)}&first=${first}&max=25&boardOnly=${boardOnly}`, { signal: controller.signal })
      .then(result => {
        if (!controller.signal.aborted) { setUsers(result.users); setHasMore(result.hasMore); }
      })
      .catch(reason => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Elenco utenti non disponibile.');
      })
      .finally(() => { if (!controller.signal.aborted) setListing(false); });
    return () => controller.abort();
  }, [api, canRead, filter, first, boardOnly, listVersion]);

  useEffect(() => {
    if (!selected || !canRead) return;
    const controller = new AbortController();
    setNeedsReload(true); setLoadingDetails(true); setPending(null); setError('');
    api<Grants>(`/admin/access/users/${encodeURIComponent(selected.subject)}`, { signal: controller.signal })
      .then(value => { if (!controller.signal.aborted) { setGrants(value); setNeedsReload(false); } })
      .catch(reason => { if (!controller.signal.aborted) setError(accessError(reason)); })
      .finally(() => { if (!controller.signal.aborted) setLoadingDetails(false); });
    return () => controller.abort();
  }, [api, selected, canRead, detailsVersion]);

  const find = (value: string) => {
    setMessage(''); setFilter(value.trim()); setFirst(0); setListVersion(version => version + 1);
  };

  const self = grants?.isSelf || selected?.isSelf || grants?.subject === oidcUser?.sub;
  const protectedTarget = grants?.protectedTarget || selected?.protectedTarget;
  const available = (permission: PermissionMetadata, action: 'grant' | 'revoke') =>
    !!grants && mfa.active && !self && !protectedTarget && permission.delegable && hasPermission(capabilities, permission.id)
    && hasPermission(capabilities, action === 'grant' ? 'access.permissions.grant' : 'access.permissions.revoke')
    && (action === 'grant' ? grants.canGrant !== false && (!grants.grantablePermissions || grants.grantablePermissions.includes(permission.id))
      : grants.canRevoke !== false && (!grants.revocablePermissions || grants.revocablePermissions.includes(permission.id)));

  const change = async () => {
    if (busy) return;
    if (!pending || !grants || needsReload || loadingDetails) {
      setPending(null);
      setError('Gli accessi devono essere ricaricati prima della conferma. Nessuna modifica è stata inviata.');
      return;
    }
    if (!mfa.active) {
      setPending(null);
      setError('La verifica MFA è scaduta o assente. Ripeti la verifica MFA (passo 1). Nessuna modifica è stata inviata.');
      return;
    }
    const metadata = catalogue.state === 'ready' ? catalogue.data.permissions.find(item => item.id === pending.permission) : undefined;
    if (!metadata || !available(metadata, pending.action)) {
      setPending(null);
      setError('Questa modifica non è più consentita con i permessi attuali. Ricarica gli accessi. Nessuna modifica è stata inviata.');
      return;
    }
    setBusy(true); setNeedsReload(true); setError(''); setMessage('');
    try {
      const result = await api<Grants & { changed: boolean; correlationId: string }>(
        `/admin/access/users/${encodeURIComponent(grants.subject)}/permissions/${encodeURIComponent(pending.permission)}`, {
          method: pending.action === 'grant' ? 'POST' : 'DELETE',
          headers: { 'X-Confirm-Access-Change': pending.action },
          body: JSON.stringify({ expectedDirectPermissions: grants.directPermissions }),
        });
      const verified = await api<Grants>(`/admin/access/users/${encodeURIComponent(grants.subject)}`);
      const assigned = verified.directPermissions.includes(pending.permission);
      setGrants(verified);
      if (assigned !== (pending.action === 'grant')) throw new Error('Esito non verificato: ricarica gli accessi prima di riprovare.');
      setNeedsReload(false);
      setMessage(`Modifica verificata. Riferimento: ${result.correlationId}. Le concessioni richiedono il rinnovo del token del destinatario.`);
      setPending(null); reloadAudit(); refresh();
    } catch (reason) {
      setPending(null);
      setError(accessError(reason));
      reloadAudit();
    } finally { setBusy(false); }
  };

  return <>
    <PageHeader title="Accessi utenti" description="Permessi diretti e di gruppo dell’applicazione. Nessuna modifica ai profili o ai gruppi dell’Identity Provider." />
    {!canRead && (error || message) && <div ref={feedback} tabIndex={-1} className="mt-4 rounded-xl border p-4">
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
    </div>}
    {canRead && canChange && <MfaVerification mfa={mfa} busy={busy} title="1. Verifica MFA" />}
    {canRead && <Panel labelledBy="access-users" className="mt-6 space-y-4 p-5">
      <h2 id="access-users" className="text-lg font-bold">{canChange ? '2. ' : ''}Seleziona un utente</h2>
      <p>{boardOnly ? 'Membri attivi del board, associati tramite email.' : 'Tutti gli utenti.'} 25 per pagina. La ricerca è facoltativa.</p>
      <form onSubmit={event => { event.preventDefault(); find(search); }} className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 font-semibold">Cerca utenti<input className="min-h-11 rounded-lg border p-2" value={search} onChange={event => setSearch(event.target.value)} maxLength={100} /></label>
        <Button type="submit" className={btn.primary} isDisabled={busy || listing}>Cerca</Button>
        <Button className={boardOnly ? btn.primary : btn.secondary} aria-pressed={boardOnly} isDisabled={busy || listing}
          onPress={() => { setBoardOnly(value => !value); setFirst(0); setMessage(''); }}>Solo board</Button>
        <Button className={btn.secondary} isDisabled={busy || listing} onPress={() => { setBoardOnly(false); setSearch(''); find(''); }}>Mostra tutti</Button>
      </form>
      {listing && <p role="status">Caricamento utenti…</p>}
      {!listing && !error && users.length === 0 && <p>Nessun utente trovato.</p>}
      <ul>{users.map(user => <li key={user.subject}><Button className={btn.ghost} isDisabled={busy} aria-pressed={selected?.subject === user.subject} onPress={() => {
        if (selected?.subject !== user.subject) { setGrants(null); setPending(null); setMessage(''); }
        setSelected(user);
      }}>{user.username || user.subject}{user.protectedTarget ? ' · Protetto' : ''}</Button></li>)}</ul>
      <div className="flex flex-wrap items-center gap-3"><span>Pagina {Math.floor(first / 25) + 1}</span><Button className={btn.secondary} isDisabled={busy || listing || first === 0} onPress={() => setFirst(Math.max(0, first - 25))}>Precedenti</Button><Button className={btn.secondary} isDisabled={busy || listing || !hasMore} onPress={() => setFirst(first + 25)}>Successivi</Button></div>
    </Panel>}
    {canRead && (selected || error || message) && <Panel labelledBy="access-grants" className="mt-6 space-y-4 p-5">
      <h2 id="access-grants" className="text-lg font-bold">{canChange ? '3. ' : ''}{selected ? `Permessi di ${selected.username || selected.subject}` : 'Permessi'}</h2>
      {selected && <Button className={btn.secondary} isDisabled={busy || loadingDetails} onPress={() => setDetailsVersion(version => version + 1)}>Ricarica accessi selezionati</Button>}
      {(error || message) && <div ref={feedback} tabIndex={-1} className="sticky top-2 z-10 rounded-xl border-2 border-cyan-700 bg-white p-4 shadow-lg focus:outline-2 focus:outline-cyan-700">
        {error && <p role="alert"><strong>Modifica non completata. </strong>{error}</p>}
        {message && <p role="status">{message}</p>}
      </div>}
      {loadingDetails && <p role="status">Caricamento permessi…</p>}
      {grants && needsReload && !busy && !loadingDetails && <p role="status">La tabella mostra l’ultimo stato letto, non un esito confermato. Ricarica gli accessi selezionati prima di effettuare altre modifiche.</p>}
      {catalogue.state === 'error' && <p role="alert">{catalogue.message}</p>}
      {grants && <>
        {(self || protectedTarget) && <p>Account proprio o protetto: le modifiche non sono consentite.</p>}
        {canChange && !mfa.active && !self && !protectedTarget && <p className="font-semibold">Modifiche bloccate: esegui prima la verifica MFA (passo 1).</p>}
        <p>Seleziona o deseleziona un permesso diretto, poi conferma la modifica. I permessi ereditati dai gruppi sono in sola lettura: revocare un permesso diretto non rimuove quello ereditato. Puoi delegare soltanto permessi consentiti che possiedi attualmente.</p>
        <div className="overflow-x-auto"><table className="w-full text-left">
          <caption className="sr-only">Permessi di {selected?.username || grants.subject}</caption>
          <thead><tr><th scope="col" className="p-3">Permesso</th><th scope="col" className="p-3">Diretto</th><th scope="col" className="p-3">Da gruppi (sola lettura)</th><th scope="col" className="p-3">Effettivo</th></tr></thead>
          <tbody className="divide-y divide-line">{catalogue.state === 'ready' && catalogue.data.permissions.map(permission => {
          const direct = grants.directPermissions.includes(permission.id);
          const inherited = grants.inheritedPermissions.includes(permission.id);
          const action = direct ? 'revoke' : 'grant';
          return <tr key={permission.id}>
            <th scope="row" className="p-3 font-medium">{permission.id}{!permission.delegable ? ' · Non delegabile' : ''}</th>
            <td className="p-3"><label className="inline-flex min-h-11 min-w-11 items-center justify-center">
              <span className="sr-only">Permesso diretto {permission.id}</span>
              <input type="checkbox" className="h-5 w-5 accent-cyan-700 focus-visible:outline-2 focus-visible:outline-offset-4" checked={direct}
                disabled={busy || needsReload || loadingDetails || !!pending || !available(permission, action)}
                onChange={() => setPending({ permission: permission.id, action })} />
            </label></td>
            <td className="p-3">{inherited ? 'Ereditato (sola lettura)' : 'No'}</td>
            <td className="p-3">{grants.effectivePermissions.includes(permission.id) ? 'Sì' : 'No'}</td>
          </tr>;
        })}</tbody></table></div>
      </>}
      <ModalOverlay isOpen={!!pending} isDismissable={!busy} onOpenChange={open => { if (!open && !busy) setPending(null); }}
        className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4">
        <Modal className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-5 text-navy shadow-xl">
        <Dialog role="alertdialog" aria-label="Conferma modifica accessi" className="space-y-3 outline-none">
        {pending && <>
        <p>Confermi {pending.action === 'grant' ? 'la concessione' : 'la revoca'} del permesso diretto {pending.permission} a {selected?.username || grants?.subject}?</p>
        {busy && <p role="status">Modifica in corso: attendo la risposta del server e la verifica dei permessi…</p>}
        <Button className={btn.danger} isDisabled={busy} onPress={() => void change()}>{busy ? 'Verifica in corso…' : 'Conferma modifica'}</Button>
        <Button className={btn.secondary} isDisabled={busy} onPress={() => setPending(null)}>Annulla</Button>
        </>}
        </Dialog></Modal>
      </ModalOverlay>
    </Panel>}
    {canAudit && <Panel labelledBy="access-audit" className="mt-6 space-y-3 p-5">
      <h2 id="access-audit" className="text-lg font-bold">Cronologia modifiche ai permessi</h2>
      <p>Ultime 25 operazioni di concessione o revoca registrate dall’applicazione, con esito e riferimento. Non è l’elenco degli utenti e non include le modifiche effettuate direttamente nell’Identity Provider. I nomi sono letti dall’Identity Provider al momento della consultazione e non sono salvati nella cronologia.</p>
      <Button className={btn.secondary} onPress={reloadAudit}>Ricarica cronologia modifiche</Button>
      {audit.state === 'error' && <p role="alert">{audit.message}</p>}
      {audit.state === 'ready' && audit.data.entries.length > 0 && <div className="overflow-x-auto"><table className="w-full text-left">
        <caption className="sr-only">Cronologia modifiche ai permessi</caption>
        <thead><tr>
          <th scope="col" className="p-3">Data</th><th scope="col" className="p-3">Eseguita da</th><th scope="col" className="p-3">Utente modificato</th>
          <th scope="col" className="p-3">Operazione</th><th scope="col" className="p-3">Permesso</th><th scope="col" className="p-3">Esito</th><th scope="col" className="p-3">Riferimento</th>
        </tr></thead>
        <tbody className="divide-y divide-line">{audit.data.entries.map((entry, index) => <tr key={`${entry.correlationId}-${entry.outcome}-${index}`}>
          <td className="p-3">{formatAuditTime(entry.at)}</td>
          <td className="p-3"><AuditAccount username={entry.actorUsername} subject={entry.actorSubject} /></td>
          <td className="p-3"><AuditAccount username={entry.targetUsername} subject={entry.targetSubject} /></td>
          <td className="p-3">{actionLabels[entry.action] ?? entry.action}</td>
          <td className="p-3">{entry.permission}</td>
          <td className="p-3">{outcomeLabels[entry.outcome] ?? entry.outcome}</td>
          <td className="p-3 text-xs">{entry.correlationId}</td>
        </tr>)}</tbody>
      </table></div>}
      {audit.state === 'ready' && audit.data.entries.length === 0 && <p>Nessuna modifica registrata.</p>}
    </Panel>}
  </>;
}

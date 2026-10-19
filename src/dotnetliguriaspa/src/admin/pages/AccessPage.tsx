import React, { useEffect, useState } from 'react';
import { Button } from 'react-aria-components';
import { useOidc, useOidcUser } from '@axa-fr/react-oidc';
import { useLocation } from 'react-router-dom';
import { useAccountCapabilities } from '../../account/AccountCapabilities';
import { accountReturnPath } from '../../account/returnPath';
import { hasPermission, Permission } from '../../account/permissions';
import { useAdminFetch, useAdminLoad } from '../adminApi';
import { PageHeader, Panel, btn } from '../ui';

type AccessUser = { issuer: string; subject: string; username: string; enabled: boolean; protectedTarget: boolean | null; isSelf?: boolean };
type Grants = {
  issuer: string; subject: string; directPermissions: string[]; inheritedPermissions: string[]; effectivePermissions: string[];
  protectedTarget: boolean; isSelf?: boolean; canGrant?: boolean; canRevoke?: boolean;
  grantablePermissions?: string[]; revocablePermissions?: string[];
};
type PermissionMetadata = { id: Permission; delegable: boolean };
type AuditEntry = { at: string; action: string; permission: string; targetSubject: string; outcome: string; correlationId: string };

export default function AccessPage() {
  const { capabilities, refresh } = useAccountCapabilities();
  const { oidcUser } = useOidcUser();
  const { login } = useOidc();
  const location = useLocation();
  const api = useAdminFetch();
  const canRead = hasPermission(capabilities, 'access.users.read');
  const canAudit = hasPermission(capabilities, 'access.audit.read');
  const [catalogue] = useAdminLoad<{ permissions: PermissionMetadata[] }>('/admin/access/permissions', canRead);
  const [audit, reloadAudit] = useAdminLoad<{ entries: AuditEntry[] }>('/admin/access/audit?first=0&max=25', canAudit);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [listVersion, setListVersion] = useState(0);
  const [listing, setListing] = useState(false);
  const [first, setFirst] = useState(0);
  const [users, setUsers] = useState<AccessUser[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [selected, setSelected] = useState<AccessUser | null>(null);
  const [grants, setGrants] = useState<Grants | null>(null);
  const [pending, setPending] = useState<{ permission: Permission; action: 'grant' | 'revoke' } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setUsers([]); setHasMore(false); setSelected(null); setGrants(null); setPending(null);
    if (!canRead) return;
    setListing(true); setError('');
    api<{ users: AccessUser[]; hasMore: boolean }>(`/admin/access/users?search=${encodeURIComponent(filter)}&first=${first}&max=25`, { signal: controller.signal })
      .then(result => {
        if (!controller.signal.aborted) { setUsers(result.users); setHasMore(result.hasMore); }
      })
      .catch(reason => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Elenco utenti non disponibile.');
      })
      .finally(() => { if (!controller.signal.aborted) setListing(false); });
    return () => controller.abort();
  }, [api, canRead, filter, first, listVersion]);

  useEffect(() => {
    if (!selected || !canRead) return;
    const controller = new AbortController();
    setGrants(null); setPending(null); setError('');
    api<Grants>(`/admin/access/users/${encodeURIComponent(selected.subject)}`, { signal: controller.signal })
      .then(value => { if (!controller.signal.aborted) setGrants(value); })
      .catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Accessi non disponibili.'); });
    return () => controller.abort();
  }, [api, selected, canRead]);

  const find = (value: string) => {
    setMessage(''); setFilter(value.trim()); setFirst(0); setListVersion(version => version + 1);
  };

  const self = grants?.isSelf || selected?.isSelf || grants?.subject === oidcUser?.sub;
  const protectedTarget = grants?.protectedTarget || selected?.protectedTarget;
  const available = (permission: PermissionMetadata, action: 'grant' | 'revoke') =>
    !!grants && !self && !protectedTarget && permission.delegable && hasPermission(capabilities, permission.id)
    && hasPermission(capabilities, action === 'grant' ? 'access.permissions.grant' : 'access.permissions.revoke')
    && (action === 'grant' ? grants.canGrant !== false && (!grants.grantablePermissions || grants.grantablePermissions.includes(permission.id))
      : grants.canRevoke !== false && (!grants.revocablePermissions || grants.revocablePermissions.includes(permission.id)));

  const change = async () => {
    if (!pending || !grants) return;
    const metadata = catalogue.state === 'ready' ? catalogue.data.permissions.find(item => item.id === pending.permission) : undefined;
    if (!metadata || !available(metadata, pending.action)) return;
    setBusy(true); setError(''); setMessage('');
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
      setMessage(`Modifica verificata. Riferimento: ${result.correlationId}. Le concessioni richiedono il rinnovo del token del destinatario.`);
      setPending(null); reloadAudit(); refresh();
    } catch (reason) {
      setPending(null);
      setError(`${reason instanceof Error ? reason.message : 'Modifica non completata.'} Ricarica gli accessi: non ripetere automaticamente la modifica.`);
      setGrants(null);
    } finally { setBusy(false); }
  };

  return <>
    <PageHeader title="Accessi utenti" description="Permessi diretti e di gruppo dell’applicazione. Nessuna modifica ai profili o ai gruppi dell’Identity Provider." />
    {error && <p role="alert" className="mt-4">{error}</p>}
    {message && <p role="status" className="mt-4">{message}</p>}
    {canRead && <Panel className="mt-6 space-y-4 p-5">
      <p>Tutti gli utenti, 25 per pagina. La ricerca è facoltativa.</p>
      <form onSubmit={event => { event.preventDefault(); find(search); }} className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 font-semibold">Cerca utenti<input className="min-h-11 rounded-lg border p-2" value={search} onChange={event => setSearch(event.target.value)} maxLength={100} /></label>
        <Button type="submit" className={btn.primary} isDisabled={busy || listing}>Cerca</Button>
        <Button className={btn.secondary} isDisabled={busy || listing} onPress={() => { setSearch(''); find(''); }}>Mostra tutti</Button>
      </form>
      {listing && <p role="status">Caricamento utenti…</p>}
      {!listing && !error && users.length === 0 && <p>Nessun utente trovato.</p>}
      <ul>{users.map(user => <li key={user.subject}><Button className={btn.ghost} isDisabled={busy} aria-pressed={selected?.subject === user.subject} onPress={() => setSelected(user)}>{user.username || user.subject}{user.protectedTarget ? ' · Protetto' : ''}</Button></li>)}</ul>
      <div className="flex flex-wrap items-center gap-3"><span>Pagina {Math.floor(first / 25) + 1}</span><Button className={btn.secondary} isDisabled={busy || listing || first === 0} onPress={() => setFirst(Math.max(0, first - 25))}>Precedenti</Button><Button className={btn.secondary} isDisabled={busy || listing || !hasMore} onPress={() => setFirst(first + 25)}>Successivi</Button></div>
      {selected && <Button className={btn.secondary} isDisabled={busy} onPress={() => setSelected({ ...selected })}>Ricarica accessi selezionati</Button>}
      {catalogue.state === 'error' && <p role="alert">{catalogue.message}</p>}
      {grants && <>
        <h2 className="text-lg font-bold">Permessi di {selected?.username || grants.subject}</h2>
        {(self || protectedTarget) && <p>Account proprio o protetto: le modifiche non sono consentite.</p>}
        <p>Seleziona o deseleziona un permesso diretto, poi conferma la modifica. I permessi ereditati dai gruppi sono in sola lettura: revocare un permesso diretto non rimuove quello ereditato. Puoi delegare soltanto permessi consentiti che possiedi attualmente.</p>
        <Button className={btn.secondary} onPress={() => void login(accountReturnPath(location), { acr_values: 'mfa', max_age: '0', prompt: 'login' })}>Verifica MFA per modificare gli accessi</Button>
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
                disabled={busy || !!pending || !available(permission, action)}
                onChange={() => setPending({ permission: permission.id, action })} />
            </label></td>
            <td className="p-3">{inherited ? 'Ereditato (sola lettura)' : 'No'}</td>
            <td className="p-3">{grants.effectivePermissions.includes(permission.id) ? 'Sì' : 'No'}</td>
          </tr>;
        })}</tbody></table></div>
        <details><summary>Permessi effettivi</summary><ul>{grants.effectivePermissions.map(permission => <li key={permission}>{permission}</li>)}</ul></details>
      </>}
      {pending && <section role="alertdialog" aria-label="Conferma modifica accessi" className="space-y-3 rounded-xl border p-4">
        <p>Confermi {pending.action === 'grant' ? 'la concessione' : 'la revoca'} del permesso diretto {pending.permission}?</p>
        <Button className={btn.danger} isDisabled={busy} onPress={() => void change()}>Conferma modifica</Button>
        <Button className={btn.secondary} isDisabled={busy} onPress={() => setPending(null)}>Annulla</Button>
      </section>}
    </Panel>}
    {canAudit && <Panel className="mt-6 space-y-3 p-5">
      <h2 className="text-lg font-bold">Cronologia modifiche ai permessi</h2>
      <p>Ultime 25 operazioni di concessione o revoca registrate dall’applicazione, con esito e riferimento. Non è l’elenco degli utenti e non include le modifiche effettuate direttamente nell’Identity Provider.</p>
      <Button className={btn.secondary} onPress={reloadAudit}>Ricarica cronologia modifiche</Button>
      {audit.state === 'error' && <p role="alert">{audit.message}</p>}
      {audit.state === 'ready' && <ul>{audit.data.entries.map((entry, index) => <li key={`${entry.correlationId}-${index}`}>{entry.at} · {entry.action} · {entry.permission} · {entry.targetSubject} · {entry.outcome} · {entry.correlationId}</li>)}</ul>}
      {audit.state === 'ready' && audit.data.entries.length === 0 && <p>Nessuna modifica registrata.</p>}
    </Panel>}
  </>;
}

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAccountCapabilities } from '../../account/AccountCapabilities';
import { hasPermission } from '../../account/permissions';
import { useAdminLoad } from '../adminApi';
import { Badge, btn, EmptyState, LoadError, PageHeader, Panel, linkFocus } from '../ui';
import type { Newsletter } from './types';

export default function NewsletterListPage() {
  const { capabilities } = useAccountCapabilities();
  const read = hasPermission(capabilities, 'newsletters.read');
  const manage = read && hasPermission(capabilities, 'newsletters.manage');
  const [load, reload] = useAdminLoad<Newsletter[]>('/newsletters', read);
  const [archived, setArchived] = useState(false);
  if (!read) return <p role="alert">Non disponi del permesso per leggere le newsletter.</p>;
  const newsletters = load.state === 'ready' ? load.data.filter(item => archived || !item.archived) : [];
  return <div className="space-y-6">
    <PageHeader title="Newsletter" description="Prepara più bozze, verifica un invio di prova e sottoponi il messaggio all’appliance SMTP." actions={<>
      <Link className={btn.secondary} to="/admin/newsletter-templates">Template newsletter</Link>
      {manage && <Link className={btn.primary} to="/admin/newsletters/new">Nuova newsletter</Link>}
    </>} />
    <label className={`flex min-h-11 items-center gap-3 rounded-xl font-semibold ${linkFocus}`}><input type="checkbox" checked={archived} onChange={event => setArchived(event.target.checked)} />Mostra anche le archiviate</label>
    {load.state === 'loading' && <p role="status">Caricamento newsletter…</p>}
    {load.state === 'error' && <LoadError message={load.message} onRetry={reload} />}
    {load.state === 'ready' && <Panel>
      {newsletters.length === 0 ? <EmptyState icon="list" title="Nessuna newsletter">Crea una bozza per iniziare. Le newsletter non vengono inviate automaticamente.</EmptyState> :
        <ul className="divide-y divide-line">{newsletters.map(item => <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div className="min-w-0"><Link className={`inline-flex min-h-11 items-center text-lg font-bold text-cyan-700 underline ${linkFocus}`} to={`/admin/newsletters/${encodeURIComponent(item.id)}`}>{item.title}</Link><p className="break-words text-muted">{item.subject}</p><p className="text-sm text-muted">{item.kind === 'event' ? 'Annuncio evento' : 'Generica'} · Revisione {item.version}</p></div>
          <div className="flex flex-wrap gap-2">{item.archived && <Badge kind="done">Archiviata</Badge>}<Badge kind={item.productionStatus === 'accepted' ? 'ok' : ['unknown', 'submitting'].includes(item.productionStatus) ? 'warn' : 'planned'}>{item.productionStatus === 'accepted' ? 'Accettata da SMTP' : item.productionStatus === 'unknown' ? 'Esito da riconciliare' : item.productionStatus === 'submitting' ? 'Sottomissione SMTP in corso' : 'Bozza'}</Badge></div>
        </li>)}</ul>}
    </Panel>}
  </div>;
}

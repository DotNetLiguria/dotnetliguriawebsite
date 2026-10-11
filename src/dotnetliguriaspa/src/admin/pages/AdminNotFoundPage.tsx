import React from 'react';
import { Link } from 'react-router-dom';
import { AdminIcon } from '../icons';
import { EmptyState, Panel, btn } from '../ui';

/** Unknown admin address: stays inside the shell (sign-in when needed) instead of a blank page. */
export default function AdminNotFoundPage() {
  return (
    <Panel className="mt-2">
      <EmptyState icon="search" title="Pagina non trovata" actions={<Link to="/admin" className={btn.primary}><AdminIcon name="home" />Vai alla panoramica</Link>}>
        <p>L'indirizzo non corrisponde a nessuna sezione dell'amministrazione. Usa il menu o la ricerca (⌘K).</p>
      </EmptyState>
    </Panel>
  );
}

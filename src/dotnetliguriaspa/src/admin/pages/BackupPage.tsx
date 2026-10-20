import React, { useCallback, useEffect, useState } from 'react';
import { Button, ProgressBar } from 'react-aria-components';
import { useOidcFetch } from '@axa-fr/react-oidc';
import { useMfaWindow } from '../../account/useMfaWindow';
import MfaVerification from '../MfaVerification';
import { AdminIcon } from '../icons';
import { Badge, EmptyState, LoadError, PageHeader, Panel, btn } from '../ui';
import { AdminLoad } from '../adminApi';
import { notify } from '../toasts';
import { API_BASE_URL } from '../../config/apiConfig';
import { formatDate, formatTime } from '../../site/format';
import { ConfirmDialog, ExtraIcon, Notice, Skeleton, plural, table } from './listUi';
import { useAccountCapabilities } from '../../account/AccountCapabilities';
import { hasPermission, permissionsDenied } from '../../account/permissions';

// Database backups kept on the server: GET /Backup/snapshots, POST /Backup/export,
// POST /Backup/import { snapshotId, confirmReplace: true } after an explicit confirmation.

export interface BackupSnapshotInfo {
  snapshotId: string;
  createdAtUtc: string;
  collectionCount: number;
  documentCount: number;
  isSafetySnapshot: boolean;
  name?: string | null;
}

export interface BackupRestoreResult {
  restoredSnapshotId: string;
  safetySnapshot: BackupSnapshotInfo;
}

type Outcome = { tone: 'ok' | 'danger'; title: string; detail?: string };

/** Error text from the API: the role message for 403, otherwise the ProblemDetails detail or title. */
export async function readBackupError(response: Response, fallback: string) {
  try {
    const problem = await response.json() as { detail?: string; title?: string };
    if (response.status === 403 && problem.title !== 'RecentMfaRequired')
      return 'Accesso negato. Manca il permesso richiesto per questa operazione sui backup.';
    return problem.detail ?? problem.title ?? `${fallback} (HTTP ${response.status}).`;
  } catch {
    if (response.status === 403) return 'Accesso negato. Manca il permesso richiesto per questa operazione sui backup.';
    return `${fallback} (HTTP ${response.status}).`;
  }
}

const when = (iso: string) => `${formatDate(iso)}, ${formatTime(iso)}`;
const contents = (s: BackupSnapshotInfo) => `${plural(s.collectionCount, 'raccolta', 'raccolte')} · ${plural(s.documentCount, 'documento', 'documenti')}`;

export default function BackupPage() {
  const { capabilities } = useAccountCapabilities();
  const canRead = hasPermission(capabilities, 'backups.read');
  const canCreate = hasPermission(capabilities, 'backups.create');
  const canRestore = hasPermission(capabilities, 'backups.restore');
  const mfa = useMfaWindow();
  const { fetch } = useOidcFetch();
  const [load, setLoad] = useState<AdminLoad<BackupSnapshotInfo[]>>({ state: 'loading' });
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState<'export' | 'import' | null>(null);
  const [pending, setPending] = useState<BackupSnapshotInfo | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [name, setName] = useState('');
  const reload = useCallback(() => setVersion(v => v + 1), []);

  useEffect(() => {
    if (!canRead) { setLoad({ state: 'ready', data: [] }); return; }
    let alive = true;
    setLoad(current => (current.state === 'ready' ? current : { state: 'loading' }));
    (async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/Backup/snapshots`, { headers: { 'X-Admin-Request': 'true' } });
        if (response.status === 403) permissionsDenied();
        if (!response.ok) throw new Error(await readBackupError(response, 'Impossibile caricare i backup'));
        const data = await response.json() as BackupSnapshotInfo[];
        if (alive) setLoad({ state: 'ready', data: [...data].sort((a, b) => b.createdAtUtc.localeCompare(a.createdAtUtc)) });
      } catch (error) {
        if (alive) setLoad({ state: 'error', message: error instanceof Error ? error.message : 'Impossibile caricare i backup.' });
      }
    })();
    return () => { alive = false; };
  }, [fetch, version, canRead]);

  const exportDatabase = async () => {
    if (!canCreate) return;
    setBusy('export');
    setOutcome(null);
    try {
      const query = name.trim() ? `?name=${encodeURIComponent(name.trim())}` : '';
      const response = await fetch(`${API_BASE_URL}/Backup/export${query}`, { method: 'POST' });
      if (!response.ok) throw new Error(await readBackupError(response, 'Esportazione non riuscita'));
      const snapshot = await response.json() as BackupSnapshotInfo;
      setOutcome({ tone: 'ok', title: 'Backup creato', detail: `${snapshot.name ? `${snapshot.name} · ` : ''}${when(snapshot.createdAtUtc)} · ${contents(snapshot)} · ${snapshot.snapshotId}` });
      setName('');
      notify('Backup creato', { description: contents(snapshot) });
      reload();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Esportazione non riuscita.';
      setOutcome({ tone: 'danger', title: 'Backup non creato', detail: message });
      notify('Backup non creato', { description: message, kind: 'error' });
    } finally {
      setBusy(null);
    }
  };

  const importDatabase = async (snapshot: BackupSnapshotInfo) => {
    if (!canRestore) return;
    setBusy('import');
    setOutcome(null);
    try {
      const response = await fetch(`${API_BASE_URL}/Backup/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snapshotId: snapshot.snapshotId, confirmReplace: true }),
      });
      if (!response.ok) throw new Error(await readBackupError(response, 'Importazione non riuscita'));
      const result = await response.json() as BackupRestoreResult;
      setPending(null);
      setOutcome({ tone: 'ok', title: 'Importazione completata', detail: `Ripristinato il backup del ${when(snapshot.createdAtUtc)}. Backup di sicurezza creato: ${result.safetySnapshot.snapshotId}.` });
      notify('Importazione completata', { description: `Backup di sicurezza: ${result.safetySnapshot.snapshotId}` });
      reload();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Importazione non riuscita.';
      setPending(null);
      setOutcome({ tone: 'danger', title: 'Importazione non riuscita', detail: message });
      notify('Importazione non riuscita', { description: message, kind: 'error' });
    } finally {
      setBusy(null);
    }
  };

  const snapshots = canRead && load.state === 'ready' ? load.data : null;
  const createButton = (className: string) => (
    <Button onPress={exportDatabase} isDisabled={busy !== null || !canCreate} className={className}>
      <AdminIcon name="database" />{busy === 'export' ? 'Creazione del backup…' : 'Crea backup'}
    </Button>
  );

  return (
    <>
      <PageHeader
        title="Backup e import"
        description="I backup del database restano sul server. Importarne uno sostituisce tutti i dati correnti, dopo aver creato una copia di sicurezza automatica."
      />

      {canRestore && <MfaVerification mfa={mfa} busy={busy !== null} />}
      <Panel className="mt-6 space-y-3 p-5">
        {canCreate && <>
        <label className="grid gap-1 font-semibold">Nome del backup (facoltativo)
          <input className="min-h-11 rounded-lg border border-line p-2" value={name} maxLength={120}
            disabled={busy !== null} onChange={event => setName(event.target.value)} />
        </label>
        <p className="text-sm text-muted">Un nome per riconoscere il backup. Data e identificativo vengono aggiunti automaticamente.</p>
        </>}
        {createButton(btn.primary)}
      </Panel>

      {busy && (
        <div className="mt-6 rounded-2xl border border-line bg-white p-4" role="status">
          <ProgressBar isIndeterminate aria-label={busy === 'export' ? 'Creazione del backup in corso' : 'Importazione in corso'} className="block">
            <p className="font-bold">{busy === 'export' ? 'Creazione del backup in corso…' : 'Importazione in corso…'}</p>
            <p className="text-sm text-muted">{busy === 'export' ? 'Pochi secondi: non chiudere la pagina.' : 'Non modificare i dati finché non è terminata.'}</p>
            <span className="mt-3 block h-1.5 overflow-hidden rounded-full bg-cyan-50"><span className="block h-full w-1/3 animate-pulse rounded-full bg-cyan-700 motion-reduce:animate-none" /></span>
          </ProgressBar>
        </div>
      )}
      {outcome && !busy && <div className="mt-6"><Notice tone={outcome.tone} title={outcome.title}>{outcome.detail}</Notice></div>}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0">
          {load.state === 'error' && <LoadError message={load.message} onRetry={reload} />}
          {load.state === 'loading' && <Skeleton className="h-72" />}
          {snapshots && (
            <Panel className="overflow-hidden" labelledBy="backup-list-title">
              <h2 id="backup-list-title" className="sr-only">Backup disponibili</h2>
              {snapshots.length ? (
                <>
                  <table className={table.el}>
                    <thead className={table.head}>
                      <tr>
                        <th scope="col" className={table.th}>Backup</th>
                        <th scope="col" className={table.th}>Contenuto</th>
                        <th scope="col" className={table.th}>Tipo</th>
                        <th scope="col" className={`${table.th} w-40`}><span className="sr-only">Azioni</span></th>
                      </tr>
                    </thead>
                    <tbody className={table.body}>
                      {snapshots.map(s => (
                        <tr key={s.snapshotId} className={table.row}>
                          <td className={table.td}>
                            {s.name && <span className="block break-words font-bold">{s.name}</span>}
                            <span className="block font-bold leading-snug">{when(s.createdAtUtc)}</span>
                            <span className="block font-mono text-xs text-muted">{s.snapshotId}</span>
                          </td>
                          <td className={`${table.td} text-muted tabular-nums`}>{contents(s)}</td>
                          <td className={table.td}>{s.isSafetySnapshot && <Badge kind="planned">Di sicurezza</Badge>}</td>
                          <td className={table.td}>
                            <span className="flex justify-end">
                              <Button onPress={() => setPending(s)} isDisabled={busy !== null || !canRestore} aria-label={`Ripristina il backup del ${when(s.createdAtUtc)}`} className={`${btn.ghost} text-[#b42318] data-[hovered]:bg-[#fdecea]`}>
                                <ExtraIcon name="restore" />Ripristina…
                              </Button>
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <ul className={table.cards}>
                    {snapshots.map(s => (
                      <li key={s.snapshotId} className="flex flex-wrap items-center gap-3 p-4">
                        <span className="min-w-0 flex-1">
                          {s.name && <span className="block break-words font-bold">{s.name}</span>}
                          <span className="block font-bold leading-snug">{when(s.createdAtUtc)}</span>
                          <span className="block text-sm text-muted">{contents(s)}</span>
                          <span className="block truncate font-mono text-xs text-muted">{s.snapshotId}</span>
                          {s.isSafetySnapshot && <span className="mt-1.5 block"><Badge kind="planned">Di sicurezza</Badge></span>}
                        </span>
                        <Button onPress={() => setPending(s)} isDisabled={busy !== null || !canRestore} aria-label={`Ripristina il backup del ${when(s.createdAtUtc)}`} className={`${btn.ghost} text-[#b42318] data-[hovered]:bg-[#fdecea]`}>
                          <ExtraIcon name="restore" />Ripristina…
                        </Button>
                      </li>
                    ))}
                  </ul>
                  <p className={table.footer}>{plural(snapshots.length, 'backup sul server', 'backup sul server')}</p>
                </>
              ) : (
                <EmptyState icon="database" title="Nessun backup sul server" actions={createButton(btn.secondary)}>
                  <p>Crea il primo backup prima di importare dati o fare modifiche in massa.</p>
                </EmptyState>
              )}
            </Panel>
          )}
        </div>

        <Panel className="h-fit p-5" labelledBy="backup-howto-title">
          <h2 id="backup-howto-title" className="text-sm font-semibold text-muted">Come funziona</h2>
          <ul className="mt-2 space-y-3 text-sm leading-relaxed">
            <li><span className="font-bold">Crea backup</span> salva sul server una copia di tutte le raccolte del database.</li>
            <li><span className="font-bold">Ripristina</span> sostituisce tutti i dati correnti con quelli del backup scelto; prima viene creato automaticamente un backup di sicurezza.</li>
            <li>Esegui backup e ripristino senza modifiche concorrenti ai dati. Lettura, creazione e ripristino richiedono permessi distinti.</li>
          </ul>
        </Panel>
      </div>

      <ConfirmDialog
        isOpen={pending !== null}
        onOpenChange={isOpen => { if (!isOpen) setPending(null); }}
        title="Sostituire tutti i dati?"
        confirmLabel="Conferma importazione"
        busyLabel="Importazione…"
        busy={busy === 'import'}
        onConfirm={() => { if (pending) void importDatabase(pending); }}
      >
        {pending && (
          <>
            {pending.name && <p className="break-words font-bold">{pending.name}</p>}
            <p>Importare il backup del <span className="font-bold">{when(pending.createdAtUtc)}</span> ({contents(pending)}) eliminerà e sostituirà tutte le raccolte correnti del database: eventi, relatori, sedi, board, menu del sito, questionari e risposte.</p>
            <p className="text-sm text-muted">Prima dell'importazione viene creato automaticamente un backup di sicurezza. Non modificare i dati durante l'operazione.</p>
            <p className="font-mono text-xs text-muted">{pending.snapshotId}</p>
          </>
        )}
      </ConfirmDialog>
    </>
  );
}

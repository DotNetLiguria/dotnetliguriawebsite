import React from 'react';
import userEvent from '@testing-library/user-event';
import { useOidc } from '@axa-fr/react-oidc';
import { jsonResponse, mockApi, render, screen, waitFor, within } from '../../test-utils';
import { AdminToastRegion, adminToasts } from '../toasts';
import BackupPage from './BackupPage';

// The toast queue is shared by the whole admin: start every test without leftovers.
beforeEach(() => { for (const toast of adminToasts.visibleToasts) adminToasts.close(toast.key); });

const snapshot = { snapshotId: '20261011T081200000Z-0123abcd', createdAtUtc: '2026-10-11T08:12:00Z', collectionCount: 3, documentCount: 24, isSafetySnapshot: false };
const safety = { ...snapshot, snapshotId: 'safety-20261011T081300000Z-abcdef01', createdAtUtc: '2026-10-11T08:13:00Z', isSafetySnapshot: true };

const renderPage = () => render(<><BackupPage /><AdminToastRegion /></>, { route: '/admin/import-export/' });
const alertsText = async () => (await screen.findAllByRole('alert')).map(alert => alert.textContent).join(' ');

describe('<BackupPage />', () => {
  test('lists the backups kept on the server and creates a new one', async () => {
    const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
    let list = [snapshot, safety];
    const exportCalls: string[] = [];
    mockApi({
      '/Backup/snapshots': () => jsonResponse(list),
      '/Backup/export': (_url: string, init?: RequestInit) => {
        exportCalls.push(init?.method ?? 'GET');
        const created = { ...snapshot, snapshotId: 'new-0001', createdAtUtc: '2026-10-12T09:00:00Z', documentCount: 25 };
        list = [created, ...list];
        return jsonResponse(created);
      },
    });
    renderPage();
    const table = await screen.findByRole('table');
    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(3);
    expect(rows[1]).toHaveTextContent('11 ottobre 2026, 10:13');
    expect(within(rows[1]).getByText('Di sicurezza')).toBeInTheDocument();
    expect(rows[2]).toHaveTextContent('3 raccolte · 24 documenti');
    expect(within(rows[2]).queryByText('Di sicurezza')).not.toBeInTheDocument();
    expect(screen.getByText('2 backup sul server')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Crea backup' }));
    expect(exportCalls).toEqual(['POST']);
    expect(await screen.findByRole('status')).toHaveTextContent('Backup creato');
    await waitFor(() => expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(4));
    expect(screen.getByText(/new-0001/, { selector: 'div' })).toBeInTheDocument();
  });

  test('requires an explicit confirmation before importing and reports the safety backup', async () => {
    const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
    const bodies: unknown[] = [];
    mockApi({
      '/Backup/snapshots': [snapshot],
      '/Backup/import': (_url: string, init?: RequestInit) => {
        bodies.push(JSON.parse(String(init?.body)));
        return jsonResponse({ restoredSnapshotId: snapshot.snapshotId, safetySnapshot: safety });
      },
    });
    renderPage();
    const table = await screen.findByRole('table');
    const restore = within(table).getByRole('button', { name: 'Ripristina il backup del 11 ottobre 2026, 10:12' });

    await user.click(restore);
    let confirmation = await screen.findByRole('alertdialog', { name: 'Sostituire tutti i dati?' });
    await user.click(within(confirmation).getByRole('button', { name: 'Annulla' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog', { name: 'Sostituire tutti i dati?' })).not.toBeInTheDocument());
    expect(bodies).toHaveLength(0);

    await user.click(restore);
    confirmation = await screen.findByRole('alertdialog', { name: 'Sostituire tutti i dati?' });
    expect(confirmation).toHaveTextContent('11 ottobre 2026, 10:12');
    expect(confirmation).toHaveTextContent(/eliminerà e sostituirà tutte le raccolte correnti del database: eventi, relatori, sedi, board, menu del sito, questionari e risposte/);
    expect(confirmation).toHaveTextContent(snapshot.snapshotId);
    await user.click(within(confirmation).getByRole('button', { name: 'Conferma importazione' }));
    await waitFor(() => expect(bodies).toEqual([{ snapshotId: snapshot.snapshotId, confirmReplace: true }]));
    expect(await screen.findByRole('status')).toHaveTextContent('Importazione completata');
    expect(screen.getByRole('status')).toHaveTextContent('Backup di sicurezza creato: safety-20261011T081300000Z-abcdef01');
    await waitFor(() => expect(screen.queryByRole('alertdialog', { name: 'Sostituire tutti i dati?' })).not.toBeInTheDocument());
  });

  test('shows the authorization error from the server and retries', async () => {
    const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
    let calls = 0;
    mockApi({ '/Backup/snapshots': () => (++calls === 1 ? new Response('', { status: 403 }) : jsonResponse([])) });
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('Accesso negato. È richiesto il ruolo backupadmin.');
    await user.click(screen.getByRole('button', { name: 'Riprova' }));
    expect(await screen.findByRole('heading', { name: 'Nessun backup sul server' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  test('reports the problem returned by the server when an import is refused', async () => {
    const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
    mockApi({
      '/Backup/snapshots': [snapshot],
      '/Backup/import': () => new Response(JSON.stringify({ title: 'Backup non valido', detail: 'Il backup selezionato non è integro o non è supportato. Nessun dato è stato sostituito.' }), { status: 400, headers: { 'Content-Type': 'application/problem+json' } }),
    });
    renderPage();
    await user.click(within(await screen.findByRole('table')).getByRole('button', { name: /Ripristina il backup/ }));
    await user.click(within(await screen.findByRole('alertdialog', { name: 'Sostituire tutti i dati?' })).getByRole('button', { name: 'Conferma importazione' }));
    expect(await alertsText()).toContain('Nessun dato è stato sostituito');
    await waitFor(() => expect(screen.queryByRole('alertdialog', { name: 'Sostituire tutti i dati?' })).not.toBeInTheDocument());
  });

  test('MFA step-up preserves the current admin query and fragment without restoring a backup', async () => {
    mockApi({ '/Backup/snapshots': [] });
    render(<BackupPage />, { route: '/admin/import-export/?source=privacy#restore' });
    await screen.findByRole('heading', { name: 'Nessun backup sul server' });
    await userEvent.click(screen.getByRole('button', { name: /Verifica MFA/ }));
    expect(useOidc().login).toHaveBeenCalledWith('/admin/import-export/?source=privacy#restore', {
      acr_values: 'mfa', max_age: '0', prompt: 'login',
    });
    expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes('/Backup/import'))).toBe(false);
  });
});

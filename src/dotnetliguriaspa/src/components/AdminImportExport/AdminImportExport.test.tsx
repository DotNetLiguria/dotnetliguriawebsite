import React from 'react';
import userEvent from '@testing-library/user-event';
import { render, screen, waitFor, within } from '../../test-utils';
import AdminImportExport from './AdminImportExport';

const snapshot = {
    snapshotId: '20261011T081200000Z-0123abcd',
    createdAtUtc: '2026-10-11T08:12:00Z',
    collectionCount: 3,
    documentCount: 24,
    isSafetySnapshot: false,
};

describe('<AdminImportExport />', () => {
    test('requires confirmation before importing the selected snapshot and reports its safety backup', async () => {
        const user = userEvent.setup();
        const requests: { url: string; method: string; body?: unknown }[] = [];
        vi.mocked(fetch).mockImplementation(async (input, init) => {
            const url = String(input);
            const method = init?.method ?? 'GET';
            const body = init?.body ? JSON.parse(String(init.body)) : undefined;
            requests.push({ url, method, body });
            if (url.endsWith('/Backup/snapshots')) {
                return new Response(JSON.stringify([snapshot]), { status: 200 });
            }
            if (url.endsWith('/Backup/import')) {
                return new Response(JSON.stringify({
                    restoredSnapshotId: snapshot.snapshotId,
                    safetySnapshot: { ...snapshot, snapshotId: 'safety-20261011T081300000Z-abcdef01', isSafetySnapshot: true },
                }), { status: 200 });
            }
            return new Response('{}', { status: 200 });
        });

        render(<AdminImportExport />);
        const selection = await screen.findByRole('combobox', { name: 'Backup da importare' });
        await user.click(selection);
        await user.click(await screen.findByRole('option', { name: /2026/ }));
        await user.click(screen.getByRole('button', { name: 'Importa' }));

        const confirmation = await screen.findByRole('dialog', { name: 'Sostituire tutti i dati?' });
        expect(within(confirmation).getByText(/eliminerà e sostituirà tutte le raccolte correnti/)).toBeInTheDocument();
        expect(requests.some(request => request.method === 'POST' && request.url.endsWith('/Backup/import'))).toBe(false);

        await user.click(within(confirmation).getByRole('button', { name: 'Conferma importazione' }));

        expect(await screen.findByText(/Backup di sicurezza creato: safety-20261011T081300000Z-abcdef01/)).toBeInTheDocument();
        await waitFor(() => expect(requests.find(request => request.url.endsWith('/Backup/import'))?.body).toEqual({
            snapshotId: snapshot.snapshotId,
            confirmReplace: true,
        }));
    });

    test('shows authorization errors from the server', async () => {
        vi.mocked(fetch).mockResolvedValue(new Response('', { status: 403 }));
        render(<AdminImportExport />);
        expect(await screen.findByRole('alert')).toHaveTextContent('Accesso negato');
    });
});

import React, { FC, useCallback, useEffect, useState } from 'react';
import { useOidcFetch } from '@axa-fr/react-oidc';
import {
    Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
    FormControl, InputLabel, MenuItem, Paper, Select, Typography,
} from '@mui/material';
import { API_BASE_URL } from '../../config/apiConfig';

interface BackupSnapshotInfo {
    snapshotId: string;
    createdAtUtc: string;
    collectionCount: number;
    documentCount: number;
    isSafetySnapshot: boolean;
}

interface BackupRestoreResult {
    restoredSnapshotId: string;
    safetySnapshot: BackupSnapshotInfo;
}

const readError = async (response: Response, fallback: string) => {
    if (response.status === 403) {
        return 'Accesso negato. È richiesto il ruolo backupadmin.';
    }
    try {
        const problem = await response.json() as { detail?: string; title?: string };
        return problem.detail ?? problem.title ?? `${fallback} (HTTP ${response.status}).`;
    } catch {
        return `${fallback} (HTTP ${response.status}).`;
    }
};

const AdminImportExport: FC = () => {
    const { fetch } = useOidcFetch();
    const [snapshots, setSnapshots] = useState<BackupSnapshotInfo[]>([]);
    const [selectedSnapshotId, setSelectedSnapshotId] = useState('');
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState<'export' | 'import' | null>(null);
    const [confirmImport, setConfirmImport] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const loadSnapshots = useCallback(async () => {
        setLoading(true);
        try {
            const response = await fetch(`${API_BASE_URL}/Backup/snapshots`);
            if (!response.ok) {
                throw new Error(await readError(response, 'Impossibile caricare i backup'));
            }
            setSnapshots(await response.json() as BackupSnapshotInfo[]);
            setError(null);
        } catch (exception) {
            console.error('Error loading database backup snapshots:', exception);
            setError(exception instanceof Error ? exception.message : 'Impossibile caricare i backup.');
        } finally {
            setLoading(false);
        }
    }, [fetch]);

    useEffect(() => {
        void loadSnapshots();
    }, [loadSnapshots]);

    const exportDatabase = async () => {
        setBusy('export');
        setError(null);
        setSuccess(null);
        try {
            const response = await fetch(`${API_BASE_URL}/Backup/export`, { method: 'POST' });
            if (!response.ok) {
                throw new Error(await readError(response, 'Esportazione non riuscita'));
            }
            const snapshot = await response.json() as BackupSnapshotInfo;
            setSelectedSnapshotId(snapshot.snapshotId);
            setSuccess(`Backup creato: ${snapshot.snapshotId} (${snapshot.collectionCount} raccolte, ${snapshot.documentCount} documenti).`);
            await loadSnapshots();
        } catch (exception) {
            console.error('Error exporting database backup:', exception);
            setError(exception instanceof Error ? exception.message : 'Esportazione non riuscita.');
        } finally {
            setBusy(null);
        }
    };

    const importDatabase = async () => {
        setBusy('import');
        setConfirmImport(false);
        setError(null);
        setSuccess(null);
        try {
            const response = await fetch(`${API_BASE_URL}/Backup/import`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ snapshotId: selectedSnapshotId, confirmReplace: true }),
            });
            if (!response.ok) {
                throw new Error(await readError(response, 'Importazione non riuscita'));
            }
            const result = await response.json() as BackupRestoreResult;
            setSuccess(`Importazione completata. Backup di sicurezza creato: ${result.safetySnapshot.snapshotId}.`);
            await loadSnapshots();
        } catch (exception) {
            console.error('Error importing database backup:', exception);
            setError(exception instanceof Error ? exception.message : 'Importazione non riuscita.');
        } finally {
            setBusy(null);
        }
    };

    const selectedSnapshot = snapshots.find(snapshot => snapshot.snapshotId === selectedSnapshotId);

    return (
        <Box sx={{ width: '100%', p: 3 }}>
            <Typography variant="h4" sx={{ mb: 3 }}>Import / Export</Typography>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
            <Paper sx={{ p: 3, maxWidth: 760 }}>
                <Typography variant="h6" sx={{ mb: 1 }}>Backup database</Typography>
                <Typography color="text.secondary" sx={{ mb: 3 }}>
                    I backup sono conservati sul server. L&apos;importazione sostituisce tutte le raccolte MongoDB correnti;
                    prima viene creato automaticamente un backup di sicurezza. Esegui esportazione e importazione senza
                    modifiche concorrenti ai dati.
                </Typography>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 3 }}>
                    <Button variant="contained" onClick={exportDatabase} disabled={busy !== null}>
                        {busy === 'export' ? <CircularProgress size={22} color="inherit" /> : 'Esporta'}
                    </Button>
                    <Button
                        variant="outlined"
                        onClick={() => setConfirmImport(true)}
                        disabled={busy !== null || !selectedSnapshotId || loading}
                    >
                        Importa
                    </Button>
                </Box>
                {busy === 'import' && <CircularProgress aria-label="Importazione in corso" sx={{ mb: 2 }} />}

                {loading ? <CircularProgress aria-label="Caricamento backup" /> : (
                    <FormControl fullWidth>
                        <InputLabel id="backup-snapshot-label">Backup da importare</InputLabel>
                        <Select
                            labelId="backup-snapshot-label"
                            id="backup-snapshot"
                            value={selectedSnapshotId}
                            label="Backup da importare"
                            onChange={event => setSelectedSnapshotId(event.target.value)}
                        >
                            {snapshots.length === 0 && <MenuItem value="" disabled>Nessun backup disponibile</MenuItem>}
                            {snapshots.map(snapshot => (
                                <MenuItem key={snapshot.snapshotId} value={snapshot.snapshotId}>
                                    {snapshot.isSafetySnapshot ? 'Sicurezza · ' : ''}
                                    {new Date(snapshot.createdAtUtc).toLocaleString('it-IT')} · {snapshot.collectionCount} raccolte · {snapshot.snapshotId}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                )}
                {selectedSnapshot && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        {selectedSnapshot.documentCount} documenti
                    </Typography>
                )}
            </Paper>

            <Dialog open={confirmImport} onClose={() => setConfirmImport(false)} aria-labelledby="backup-import-title">
                <DialogTitle id="backup-import-title">Sostituire tutti i dati?</DialogTitle>
                <DialogContent>
                    <Typography>
                        Importare il backup {selectedSnapshotId} eliminerà e sostituirà tutte le raccolte correnti.
                        Non modificare i dati durante l&apos;operazione. Verrà conservata una copia di sicurezza automatica.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setConfirmImport(false)}>Annulla</Button>
                    <Button color="error" variant="contained" onClick={importDatabase} disabled={busy !== null}>
                        Conferma importazione
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default AdminImportExport;

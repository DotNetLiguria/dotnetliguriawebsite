import React, { FC, useEffect, useMemo, useState } from 'react';
import {
  Alert, Autocomplete, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, FormControlLabel,
  Radio, RadioGroup, Stack, TextField, Typography,
} from '@mui/material';
import { DataGrid, GridActionsCellItem, GridColDef } from '@mui/x-data-grid';
import { useNavigate } from 'react-router-dom';
import { useOidcFetch } from '@axa-fr/react-oidc';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import BarChartIcon from '@mui/icons-material/BarChart';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ArchiveOutlinedIcon from '@mui/icons-material/ArchiveOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import { API_BASE_URL } from '../../config/apiConfig';
import { createQuestionnaireAdminApi, QuestionnaireApiError } from '../../questionnaire/api';
import { formatDate, formatDateTime } from '../../questionnaire/format';
import { statusColors, statusLabels } from '../../questionnaire/status';
import type { CreateQuestionnaireRequest, QuestionnaireSummary } from '../../questionnaire/types';

export interface WorkshopOption { workshopId: string; title: string; eventDate?: string }

export interface CreateQuestionnaireDialogProps {
  open: boolean;
  workshops: WorkshopOption[];
  busy?: boolean;
  initialWorkshopId?: string | null;
  onClose: () => void;
  onCreate: (request: CreateQuestionnaireRequest) => void;
}

export const CreateQuestionnaireDialog: FC<CreateQuestionnaireDialogProps> = ({ open, workshops, busy, initialWorkshopId, onClose, onCreate }) => {
  const [template, setTemplate] = useState<CreateQuestionnaireRequest['template']>(initialWorkshopId ? 'workshopFeedback' : 'blank');
  const [title, setTitle] = useState('');
  const [workshopId, setWorkshopId] = useState<string | null>(initialWorkshopId ?? null);
  const workshop = workshops.find(w => w.workshopId === workshopId) ?? null;
  const needsWorkshop = template === 'workshopFeedback';
  const canCreate = !busy && (!needsWorkshop || !!workshopId);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" aria-labelledby="create-questionnaire-title">
      <DialogTitle id="create-questionnaire-title">Nuovo questionario</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <RadioGroup value={template} onChange={e => setTemplate(e.target.value as CreateQuestionnaireRequest['template'])}>
            <FormControlLabel value="workshopFeedback" control={<Radio />} label={
              <Box>
                <Typography>Feedback di un evento</Typography>
                <Typography variant="body2" color="text.secondary">
                  Valutazione complessiva, utilità, voto per ogni sessione dell'evento, argomenti futuri e suggerimenti.
                </Typography>
              </Box>
            } />
            <FormControlLabel value="blank" control={<Radio />} label={
              <Box>
                <Typography>Questionario vuoto</Typography>
                <Typography variant="body2" color="text.secondary">Parti da zero e aggiungi le domande che ti servono.</Typography>
              </Box>
            } />
          </RadioGroup>
          <Autocomplete
            options={workshops}
            value={workshop}
            onChange={(_, value) => setWorkshopId(value?.workshopId ?? null)}
            getOptionLabel={o => `${o.title}${o.eventDate ? ` (${formatDate(o.eventDate)})` : ''}`}
            isOptionEqualToValue={(a, b) => a.workshopId === b.workshopId}
            renderInput={params => (
              <TextField {...params} label={needsWorkshop ? 'Evento' : 'Evento collegato (facoltativo)'} required={needsWorkshop}
                helperText={needsWorkshop ? 'Le sessioni dell\'evento diventano le righe da valutare.' : undefined} />
            )}
          />
          <TextField label="Titolo" value={title} onChange={e => setTitle(e.target.value)}
            helperText="Facoltativo: se vuoto viene proposto un titolo automatico." />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Annulla</Button>
        <Button variant="contained" disabled={!canCreate}
          onClick={() => onCreate({ template, title: title.trim() || null, workshopId })}>
          Crea e modifica
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export interface AdminQuestionnairesProps { pageName?: string }

const AdminQuestionnaires: FC<AdminQuestionnairesProps> = () => {
  const navigate = useNavigate();
  const { fetch } = useOidcFetch();
  const api = useMemo(() => createQuestionnaireAdminApi(fetch), [fetch]);
  const [rows, setRows] = useState<QuestionnaireSummary[]>([]);
  const [workshops, setWorkshops] = useState<WorkshopOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toDelete, setToDelete] = useState<QuestionnaireSummary | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setRows(await api.list());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossibile caricare i questionari.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    void (async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/Workshop/Get?onlyPublished=false`);
        if (!response.ok) return;
        const data = await response.json() as WorkshopOption[];
        setWorkshops(Array.isArray(data)
          ? [...data].sort((a, b) => String(b.eventDate ?? '').localeCompare(String(a.eventDate ?? '')))
          : []);
      } catch {
        setWorkshops([]);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api]);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await action();
      await load();
    } catch (err) {
      setError(err instanceof QuestionnaireApiError || err instanceof Error ? err.message : 'Operazione non riuscita.');
    } finally {
      setBusy(false);
    }
  };

  const create = async (request: CreateQuestionnaireRequest) => {
    setBusy(true);
    try {
      const created = await api.create(request);
      navigate(`/admin/questionnaires/${created.questionnaireId}/edit`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Creazione non riuscita.');
      setCreateOpen(false);
    } finally {
      setBusy(false);
    }
  };

  const duplicate = async (id: string) => {
    setBusy(true);
    try {
      const copy = await api.duplicate(id);
      navigate(`/admin/questionnaires/${copy.questionnaireId}/edit`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Duplicazione non riuscita.');
    } finally {
      setBusy(false);
    }
  };

  const columns: GridColDef<QuestionnaireSummary>[] = [
    { field: 'title', headerName: 'Titolo', flex: 2, minWidth: 220 },
    { field: 'workshopTitle', headerName: 'Evento', flex: 1.5, minWidth: 160, valueGetter: (_, row) => row.workshopTitle ?? '' },
    {
      field: 'status', headerName: 'Stato', width: 130,
      valueGetter: (_, row) => statusLabels[row.status],
      renderCell: ({ row }) => <Chip size="small" label={statusLabels[row.status]} color={statusColors[row.status]} />,
    },
    {
      field: 'window', headerName: 'Periodo di apertura', width: 220, sortable: false,
      valueGetter: (_, row) => row.opensAt || row.closesAt
        ? `${row.opensAt ? formatDateTime(row.opensAt) : '…'} → ${row.closesAt ? formatDateTime(row.closesAt) : '…'}`
        : 'Sempre (quando pubblicato)',
    },
    { field: 'responseCount', headerName: 'Risposte', type: 'number', width: 100 },
    { field: 'updatedAt', headerName: 'Modificato', width: 150, valueGetter: (_, row) => row.updatedAt ? new Date(row.updatedAt) : null, type: 'dateTime' },
    {
      field: 'actions', type: 'actions', width: 200, getActions: ({ row }) => [
        <GridActionsCellItem key="edit" icon={<EditIcon />} label="Modifica" onClick={() => navigate(`/admin/questionnaires/${row.questionnaireId}/edit`)} />,
        <GridActionsCellItem key="results" icon={<BarChartIcon />} label="Risultati" onClick={() => navigate(`/admin/questionnaires/${row.questionnaireId}/results`)} />,
        <GridActionsCellItem key="duplicate" icon={<ContentCopyIcon />} label="Duplica" disabled={busy} onClick={() => void duplicate(row.questionnaireId)} />,
        <GridActionsCellItem key="archive" icon={<ArchiveOutlinedIcon />} label="Archivia" showInMenu
          disabled={busy || row.status === 'Archived'} onClick={() => void run(() => api.archive(row.questionnaireId))} />,
        <GridActionsCellItem key="delete" icon={<DeleteOutlineIcon />} label="Elimina" showInMenu
          disabled={busy || row.responseCount > 0} onClick={() => setToDelete(row)} />,
      ],
    },
  ];

  return (
    <Box sx={{ flex: 1, minWidth: 0, p: 3 }}>
      <Stack direction="row" spacing={2} sx={{ mb: 2, alignItems: 'center' }}>
        <Typography variant="h4" component="h1" sx={{ flex: 1 }}>Questionari</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>Nuovo questionario</Button>
      </Stack>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      <DataGrid
        rows={rows}
        columns={columns}
        getRowId={r => r.questionnaireId}
        loading={loading}
        autoHeight
        disableRowSelectionOnClick
        showToolbar
        onRowDoubleClick={({ row }) => navigate(`/admin/questionnaires/${row.questionnaireId}/edit`)}
        initialState={{ sorting: { sortModel: [{ field: 'updatedAt', sort: 'desc' }] }, pagination: { paginationModel: { pageSize: 25 } } }}
        pageSizeOptions={[25, 50, 100]}
        localeText={{ noRowsLabel: 'Nessun questionario: creane uno con «Nuovo questionario».' }}
      />
      {createOpen && (
        <CreateQuestionnaireDialog open workshops={workshops} busy={busy} onClose={() => setCreateOpen(false)} onCreate={r => void create(r)} />
      )}
      <Dialog open={!!toDelete} onClose={() => setToDelete(null)}>
        <DialogTitle>Eliminare il questionario?</DialogTitle>
        <DialogContent>
          <DialogContentText>«{toDelete?.title}» verrà eliminato definitivamente.</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setToDelete(null)}>Annulla</Button>
          <Button color="error" variant="contained" disabled={busy}
            onClick={() => { const id = toDelete!.questionnaireId; setToDelete(null); void run(() => api.remove(id)); }}>
            Elimina
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdminQuestionnaires;

import React, { FC, useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
  IconButton, InputAdornment, LinearProgress, List, ListItem, ListItemText, Stack, Tab, Tabs, TextField, Tooltip, Typography,
} from '@mui/material';
import { DataGrid, GridActionsCellItem, GridColDef } from '@mui/x-data-grid';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from 'recharts';
import { useNavigate, useParams } from 'react-router-dom';
import { useOidcFetch } from '@axa-fr/react-oidc';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DownloadIcon from '@mui/icons-material/Download';
import EditIcon from '@mui/icons-material/Edit';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import VisibilityIcon from '@mui/icons-material/Visibility';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import { createQuestionnaireAdminApi } from '../../questionnaire/api';
import { formatAnswer, formatDate, formatDateTime } from '../../questionnaire/format';
import { allQuestions } from '../../questionnaire/rules';
import { sourceLabels, statusColors, statusLabels } from '../../questionnaire/status';
import type { Question, Questionnaire, QuestionnaireResponse, QuestionnaireStatistics, QuestionStatistics } from '../../questionnaire/types';

const TEXT_PAGE = 20;

const Kpi: FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <Card variant="outlined" sx={{ flex: '1 1 180px' }}>
    <CardContent>
      <Typography variant="overline" color="text.secondary">{label}</Typography>
      <Typography variant="h5">{value}</Typography>
    </CardContent>
  </Card>
);

const Distribution: FC<{ data: { value: number; count: number }[]; height?: number }> = ({ data, height = 180 }) => (
  <Box sx={{ width: '100%', height }}>
    <ResponsiveContainer>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="value" />
        <YAxis allowDecimals={false} />
        <ChartTooltip formatter={v => [v, 'Risposte']} labelFormatter={l => `Valore ${l}`} />
        <Bar dataKey="count" fill="#1976d2" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  </Box>
);

const OptionBars: FC<{ options: QuestionStatistics['options']; answered: number }> = ({ options, answered }) => (
  <Stack spacing={1}>
    {options.map(o => {
      const percent = answered > 0 ? Math.round((o.count / answered) * 100) : 0;
      return (
        <Box key={o.optionId}>
          <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
            <Typography variant="body2">{o.label}</Typography>
            <Typography variant="body2" color="text.secondary">{o.count} ({percent}%)</Typography>
          </Stack>
          <LinearProgress variant="determinate" value={percent} sx={{ height: 8, borderRadius: 4 }} aria-label={`${o.label}: ${percent}%`} />
        </Box>
      );
    })}
  </Stack>
);

const TextAnswers: FC<{ answers: QuestionStatistics['textAnswers']; filter: string }> = ({ answers, filter }) => {
  const [limit, setLimit] = useState(TEXT_PAGE);
  const needle = filter.trim().toLowerCase();
  const visible = needle ? answers.filter(a => a.text.toLowerCase().includes(needle)) : answers;
  if (visible.length === 0) return <Typography variant="body2" color="text.secondary">{needle ? 'Nessuna risposta corrisponde alla ricerca.' : 'Nessuna risposta.'}</Typography>;
  return (
    <>
      <List dense sx={{ maxHeight: 320, overflowY: 'auto' }}>
        {visible.slice(0, limit).map(a => (
          <ListItem key={`${a.responseId}-${a.text}`} divider>
            <ListItemText primary={a.text} secondary={formatDateTime(a.submittedAt)} sx={{ whiteSpace: 'pre-wrap' }} />
          </ListItem>
        ))}
      </List>
      {visible.length > limit && <Button size="small" onClick={() => setLimit(l => l + TEXT_PAGE)}>Mostra altre ({visible.length - limit})</Button>}
    </>
  );
};

const QuestionResult: FC<{ stats: QuestionStatistics; question?: Question; total: number; filter: string }> = ({ stats, question, total, filter }) => {
  const choice = stats.type === 'SingleChoice' || stats.type === 'MultipleChoice' || stats.type === 'YesNo';
  return (
    <Card variant="outlined">
      <CardContent>
        <Stack direction="row" spacing={1} sx={{ mb: 1, alignItems: 'baseline' }}>
          <Typography variant="subtitle1" sx={{ flex: 1, fontWeight: 600 }}>{stats.title || '(senza titolo)'}</Typography>
          <Typography variant="body2" color="text.secondary">{stats.answeredCount} / {total} risposte</Typography>
        </Stack>
        {(stats.type === 'Rating' || stats.type === 'Scale') && (
          <>
            {stats.average != null && <Typography variant="h6">Media {stats.average.toLocaleString('it-IT')}</Typography>}
            <Distribution data={stats.distribution} />
          </>
        )}
        {stats.type === 'Number' && (
          <Typography>
            {stats.average != null ? `Media ${stats.average.toLocaleString('it-IT')} · min ${stats.min} · max ${stats.max}` : 'Nessuna risposta.'}
          </Typography>
        )}
        {choice && <OptionBars options={stats.options} answered={stats.answeredCount} />}
        {choice && stats.textAnswers.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>{question?.settings.otherLabel ?? 'Altro'}: risposte libere</Typography>
            <TextAnswers answers={stats.textAnswers} filter={filter} />
          </Box>
        )}
        {stats.type === 'Matrix' && (
          <Stack spacing={2}>
            {stats.rows.map(row => (
              <Box key={row.rowId}>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'baseline' }}>
                  <Typography sx={{ flex: 1 }}>{row.label}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {row.average != null ? `media ${row.average.toLocaleString('it-IT')} · ` : ''}{row.answeredCount} risposte
                  </Typography>
                </Stack>
                <Distribution data={row.distribution} height={120} />
              </Box>
            ))}
          </Stack>
        )}
        {['ShortText', 'LongText', 'Email', 'Date'].includes(stats.type) && <TextAnswers answers={stats.textAnswers} filter={filter} />}
      </CardContent>
    </Card>
  );
};

const QuestionnaireResults: FC = () => {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { fetch } = useOidcFetch();
  const api = useMemo(() => createQuestionnaireAdminApi(fetch), [fetch]);
  const [questionnaire, setQuestionnaire] = useState<Questionnaire | null>(null);
  const [stats, setStats] = useState<QuestionnaireStatistics | null>(null);
  const [responses, setResponses] = useState<QuestionnaireResponse[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState(0);
  const [filter, setFilter] = useState('');
  const [detail, setDetail] = useState<QuestionnaireResponse | null>(null);
  const [toDelete, setToDelete] = useState<QuestionnaireResponse | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const [q, s, r] = await Promise.all([api.get(id), api.statistics(id), api.responses(id)]);
      setQuestionnaire(q);
      setStats(s);
      setResponses(r);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossibile caricare i risultati.');
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, id]);

  const questions = useMemo(() => new Map((questionnaire ? allQuestions(questionnaire) : []).map(q => [q.id, q])), [questionnaire]);

  const exportCsv = async () => {
    setBusy(true);
    try {
      const blob = await api.exportCsv(id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${(questionnaire?.title || 'questionario').replace(/[^\w-]+/g, '_')}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Esportazione non riuscita.');
    } finally {
      setBusy(false);
    }
  };

  const deleteResponse = async (response: QuestionnaireResponse) => {
    setBusy(true);
    try {
      await api.removeResponse(id, response.responseId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Eliminazione non riuscita.');
    } finally {
      setBusy(false);
    }
  };

  if (error && !stats) {
    return (
      <Box sx={{ p: 3, flex: 1 }}>
        <Alert severity="error" action={<Button onClick={() => navigate('/admin/questionnaires')}>Torna all'elenco</Button>}>{error}</Alert>
      </Box>
    );
  }
  if (!stats || !questionnaire) {
    return <Box sx={{ p: 6, flex: 1, display: 'flex', justifyContent: 'center' }}><CircularProgress aria-label="Caricamento" /></Box>;
  }

  const identified = responses.some(r => r.respondent);
  const columns: GridColDef<QuestionnaireResponse>[] = [
    { field: 'submittedAt', headerName: 'Inviata', width: 160, type: 'dateTime', valueGetter: (_, r) => new Date(r.submittedAt) },
    ...(identified ? [
      { field: 'respondent', headerName: 'Partecipante', flex: 1, minWidth: 180, valueGetter: (_: unknown, r: QuestionnaireResponse) =>
        [r.respondent?.name, r.respondent?.surname].filter(Boolean).join(' ') },
      { field: 'email', headerName: 'Email', flex: 1, minWidth: 200, valueGetter: (_: unknown, r: QuestionnaireResponse) => r.respondent?.email ?? '' },
    ] as GridColDef<QuestionnaireResponse>[] : []),
    { field: 'answers', headerName: 'Risposte date', width: 130, type: 'number', valueGetter: (_, r) => r.answers.length },
    { field: 'source', headerName: 'Origine', width: 190, valueGetter: (_, r) => sourceLabels[r.source] ?? r.source },
    {
      field: 'actions', type: 'actions', width: 100, getActions: ({ row }) => [
        <GridActionsCellItem key="view" icon={<VisibilityIcon />} label="Dettaglio" onClick={() => setDetail(row)} />,
        <GridActionsCellItem key="delete" icon={<DeleteOutlineIcon />} label="Elimina" disabled={busy} onClick={() => setToDelete(row)} />,
      ],
    },
  ];

  return (
    <Box sx={{ flex: 1, minWidth: 0, p: 3 }}>
      <Stack direction="row" spacing={1} useFlexGap sx={{ mb: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        <Tooltip title="Torna ai questionari">
          <IconButton aria-label="Torna ai questionari" onClick={() => navigate('/admin/questionnaires')}><ArrowBackIcon /></IconButton>
        </Tooltip>
        <Typography variant="h5" component="h1" sx={{ flex: 1 }}>Risultati: {questionnaire.title}</Typography>
        <Chip label={statusLabels[questionnaire.status]} color={statusColors[questionnaire.status]} />
        <Button startIcon={<RefreshIcon />} onClick={() => void load()}>Aggiorna</Button>
        <Button startIcon={<EditIcon />} onClick={() => navigate(`/admin/questionnaires/${id}/edit`)}>Modifica</Button>
        <Button variant="contained" startIcon={<DownloadIcon />} disabled={busy || stats.responseCount === 0} onClick={() => void exportCsv()}>
          Esporta CSV
        </Button>
      </Stack>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      <Stack direction="row" spacing={2} useFlexGap sx={{ mb: 3, flexWrap: 'wrap' }}>
        <Kpi label="Risposte" value={stats.responseCount} />
        <Kpi label="Prima risposta" value={formatDate(stats.firstResponseAt) || '—'} />
        <Kpi label="Ultima risposta" value={formatDate(stats.lastResponseAt) || '—'} />
        <Kpi label="Domande" value={stats.questions.length} />
      </Stack>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Riepilogo" />
        <Tab label={`Risposte (${responses.length})`} />
      </Tabs>

      {tab === 0 && (
        stats.responseCount === 0 ? (
          <Alert severity="info">Non ci sono ancora risposte. Condividi il link o il QR code dalla pagina di modifica.</Alert>
        ) : (
          <Stack spacing={2}>
            {stats.responsesPerDay.length > 1 && (
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Risposte per giorno</Typography>
                  <Box sx={{ width: '100%', height: 200 }}>
                    <ResponsiveContainer>
                      <BarChart data={stats.responsesPerDay} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="date" />
                        <YAxis allowDecimals={false} />
                        <ChartTooltip formatter={v => [v, 'Risposte']} />
                        <Bar dataKey="count" fill="#2e7d32" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </Box>
                </CardContent>
              </Card>
            )}
            <TextField size="small" placeholder="Cerca nelle risposte testuali" value={filter} onChange={e => setFilter(e.target.value)}
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }, htmlInput: { 'aria-label': 'Cerca nelle risposte testuali' } }}
              sx={{ maxWidth: 420 }} />
            {stats.questions.map(s => (
              <QuestionResult key={s.questionId} stats={s} question={questions.get(s.questionId)} total={stats.responseCount} filter={filter} />
            ))}
          </Stack>
        )
      )}

      {tab === 1 && (
        <DataGrid
          rows={responses}
          columns={columns}
          getRowId={r => r.responseId}
          autoHeight
          disableRowSelectionOnClick
          showToolbar
          onRowDoubleClick={({ row }) => setDetail(row)}
          initialState={{ sorting: { sortModel: [{ field: 'submittedAt', sort: 'desc' }] }, pagination: { paginationModel: { pageSize: 25 } } }}
          pageSizeOptions={[25, 50, 100]}
          localeText={{ noRowsLabel: 'Nessuna risposta.' }}
        />
      )}

      <Dialog open={!!detail} onClose={() => setDetail(null)} fullWidth maxWidth="md" aria-labelledby="response-detail-title">
        <DialogTitle id="response-detail-title">Risposta del {formatDateTime(detail?.submittedAt)}</DialogTitle>
        <DialogContent dividers>
          {detail?.respondent && (
            <Typography sx={{ mb: 2 }}>
              {[detail.respondent.name, detail.respondent.surname].filter(Boolean).join(' ')} {detail.respondent.email && `· ${detail.respondent.email}`}
            </Typography>
          )}
          <List dense>
            {detail && allQuestions(questionnaire).filter(q => q.type !== 'InfoText').map(q => {
              const value = formatAnswer(q, detail.answers.find(a => a.questionId === q.id));
              return (
                <ListItem key={q.id} divider>
                  <ListItemText primary={q.title || '(senza titolo)'} secondary={value || '—'} sx={{ whiteSpace: 'pre-wrap' }} />
                </ListItem>
              );
            })}
          </List>
        </DialogContent>
        <DialogActions>
          <Button color="error" disabled={busy} onClick={() => { setToDelete(detail); setDetail(null); }}>Elimina risposta</Button>
          <Button onClick={() => setDetail(null)}>Chiudi</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!toDelete} onClose={() => setToDelete(null)}>
        <DialogTitle>Eliminare la risposta?</DialogTitle>
        <DialogContent>
          <DialogContentText>La risposta del {formatDateTime(toDelete?.submittedAt)} verrà eliminata definitivamente.</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setToDelete(null)}>Annulla</Button>
          <Button color="error" variant="contained" onClick={() => { const r = toDelete!; setToDelete(null); void deleteResponse(r); }}>Elimina</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default QuestionnaireResults;

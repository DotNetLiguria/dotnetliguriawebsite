import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress, Divider, IconButton, Paper, Stack, Tab, Tabs, TextField, Tooltip, Typography, useMediaQuery, useTheme,
} from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import { useOidcFetch } from '@axa-fr/react-oidc';
import {
  closestCenter, CollisionDetection, DndContext, DragEndEvent, DragOverlay, DragStartEvent, KeyboardSensor, PointerSensor, pointerWithin,
  useSensor, useSensors,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import ShareIcon from '@mui/icons-material/Share';
import BarChartIcon from '@mui/icons-material/BarChart';
import CloudDoneIcon from '@mui/icons-material/CloudDone';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import SyncIcon from '@mui/icons-material/Sync';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import SettingsIcon from '@mui/icons-material/Settings';
import DesignerCanvas from './DesignerCanvas';
import QuestionPalette from './QuestionPalette';
import QuestionProperties from './QuestionProperties';
import QuestionnaireSettings from './QuestionnaireSettings';
import PreviewDialog from './PreviewDialog';
import PublishDialog from './PublishDialog';
import ShareDialog from './ShareDialog';
import { QuestionTypeIcon } from './QuestionTypeIcon';
import { locateQuestion, useDesignerStore } from './designerStore';
import { SaveStatus, useAutosave } from './useAutosave';
import { createQuestionnaireAdminApi, QuestionnaireApiError } from '../../questionnaire/api';
import { questionTypeLabel } from '../../questionnaire/factory';
import type { Questionnaire, QuestionType } from '../../questionnaire/types';
import { validateDefinition } from '../../questionnaire/validation';

import { statusColors, statusLabels } from '../../questionnaire/status';

const SaveIndicator: FC<{ status: SaveStatus; onRetry: () => void }> = ({ status, onRetry }) => {
  const map = {
    saved: { icon: <CloudDoneIcon fontSize="small" color="success" />, text: 'Salvato' },
    pending: { icon: <SyncIcon fontSize="small" color="action" />, text: 'Modifiche in corso…' },
    saving: { icon: <SyncIcon fontSize="small" color="primary" />, text: 'Salvataggio…' },
    blocked: { icon: <CloudOffIcon fontSize="small" color="warning" />, text: 'Non salvato' },
    error: { icon: <CloudOffIcon fontSize="small" color="error" />, text: 'Errore di salvataggio' },
    conflict: { icon: <CloudOffIcon fontSize="small" color="error" />, text: 'Conflitto' },
  }[status.kind];
  const message = 'message' in status ? status.message : undefined;
  return (
    <Tooltip title={message ?? ''}>
      <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }} role="status" aria-live="polite" aria-label={`Stato salvataggio: ${map.text}`}>
        {map.icon}
        <Typography variant="body2" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>{map.text}</Typography>
        {status.kind === 'error' && <Button size="small" onClick={onRetry}>Riprova</Button>}
      </Stack>
    </Tooltip>
  );
};

const isEditableTarget = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

const collision: CollisionDetection = args => {
  const within = pointerWithin(args);
  if (within.length > 0) {
    const questions = within.filter(c => !String(c.id).startsWith('drop:'));
    return questions.length > 0 ? questions : within;
  }
  return closestCenter(args);
};

export interface QuestionnaireDesignerProps { autosaveDelayMs?: number }

const QuestionnaireDesigner: FC<QuestionnaireDesignerProps> = ({ autosaveDelayMs }) => {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { fetch } = useOidcFetch();
  const api = useMemo(() => createQuestionnaireAdminApi(fetch), [fetch]);
  const theme = useTheme();
  const wide = useMediaQuery(theme.breakpoints.up('md'));

  const questionnaire = useDesignerStore(s => s.questionnaire);
  const selection = useDesignerStore(s => s.selection);
  const canUndo = useDesignerStore(s => s.past.length > 0);
  const canRedo = useDesignerStore(s => s.future.length > 0);
  const { load, undo, redo, select, addQuestion, moveQuestion, updateSection, acknowledgeSave } = useDesignerStore.getState();

  const [loadError, setLoadError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showIssues, setShowIssues] = useState(false);
  const [mobileTab, setMobileTab] = useState(0);
  const [dragType, setDragType] = useState<QuestionType | null>(null);

  const blockedReason = useCallback((q: Questionnaire) => {
    if (q.status === 'Published' && validateDefinition(q, true).length > 0) {
      return 'Il questionario è pubblicato: le modifiche vengono salvate quando non ci sono errori.';
    }
    return validateDefinition(q, false).length > 0 ? 'Correggi gli errori evidenziati per salvare.' : null;
  }, []);
  const save = useCallback((q: Questionnaire) => api.update(q), [api]);
  const { status: saveStatus, saveNow, reset } = useAutosave({ save, blockedReason, delayMs: autosaveDelayMs });

  const reload = useCallback(async () => {
    setLoadError(null);
    try {
      const loaded = await api.get(id);
      load(loaded);
      reset();
    } catch (err) {
      setLoadError(err instanceof QuestionnaireApiError ? err.message : 'Impossibile caricare il questionario.');
    }
  }, [api, id, load, reset]);

  useEffect(() => {
    useDesignerStore.setState({ questionnaire: null });
    void reload();
  }, [reload]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || isEditableTarget(e.target)) return;
      const key = e.key.toLowerCase();
      if (key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      else if ((key === 'z' && e.shiftKey) || key === 'y') { e.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const definitionErrors = useMemo(() => (questionnaire ? validateDefinition(questionnaire, true) : []), [questionnaire]);
  const questionErrors = useMemo(() => {
    const map = new Map<string, string[]>();
    if (!showIssues && questionnaire?.status !== 'Published') return map;
    for (const e of definitionErrors) {
      if (e.questionId) map.set(e.questionId, [...(map.get(e.questionId) ?? []), e.message]);
    }
    return map;
  }, [definitionErrors, showIssues, questionnaire?.status]);
  const settingsErrors = useMemo(() => (questionnaire
    ? Object.fromEntries(validateDefinition(questionnaire, false).filter(e => !e.questionId).map(e => [e.field, e.message]))
    : {}), [questionnaire]);

  if (loadError) {
    return (
      <Box sx={{ p: 3, flex: 1 }}>
        <Alert severity="error" action={<Button onClick={() => navigate('/admin/questionnaires')}>Torna all'elenco</Button>}>{loadError}</Alert>
      </Box>
    );
  }
  if (!questionnaire) {
    return <Box sx={{ p: 6, flex: 1, display: 'flex', justifyContent: 'center' }}><CircularProgress aria-label="Caricamento" /></Box>;
  }

  const locked = questionnaire.responseCount > 0;
  const selectedQuestion = selection.kind === 'question' ? locateQuestion(questionnaire, selection.id)?.question : undefined;
  const selectedSection = selection.kind === 'section' ? questionnaire.sections.find(s => s.id === selection.id) : undefined;

  const runAction = async (action: () => Promise<Questionnaire>) => {
    setActionError(null);
    setBusy(true);
    try {
      if (!(await saveNow())) throw new Error('Salva le modifiche prima di continuare.');
      acknowledgeSave(await action(), true);
      return true;
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Operazione non riuscita.');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const onDragStart = ({ active }: DragStartEvent) => {
    const data = active.data.current as { kind?: string; type?: QuestionType } | undefined;
    setDragType(data?.kind === 'palette' && data.type ? data.type : null);
  };
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setDragType(null);
    if (!over) return;
    const activeData = active.data.current as { kind: string; type?: QuestionType } | undefined;
    const overData = over.data.current as { kind: string; sectionId: string } | undefined;
    if (!activeData || !overData) return;
    let target: { sectionId: string; index: number } | null;
    if (overData.kind === 'section-end') {
      const section = questionnaire.sections.find(s => s.id === overData.sectionId);
      target = section ? { sectionId: section.id, index: section.questions.length } : null;
    } else {
      const location = locateQuestion(questionnaire, String(over.id));
      target = location ? { sectionId: location.section.id, index: location.index } : null;
    }
    if (!target) return;
    if (activeData.kind === 'palette' && activeData.type) {
      addQuestion(activeData.type, target);
    } else if (activeData.kind === 'question' && active.id !== over.id) {
      moveQuestion(String(active.id), target.sectionId, target.index);
    }
  };

  const onAdd = (type: QuestionType) => {
    addQuestion(type);
    if (!wide) setMobileTab(0);
  };

  const palette = <QuestionPalette disabled={locked} onAdd={onAdd} />;
  const canvas = (
    <>
      {locked && (
        <Alert severity="info" icon={<LockOutlinedIcon />} sx={{ mb: 2 }}
          action={<Button color="inherit" size="small" onClick={() => runDuplicate()}>Duplica</Button>}>
          Il questionario ha {questionnaire.responseCount} risposte: puoi correggere i testi, ma non aggiungere, rimuovere o
          cambiare tipo alle domande. Per modificarne la struttura, duplicalo.
        </Alert>
      )}
      <DesignerCanvas locked={locked} questionErrors={questionErrors} />
    </>
  );
  const properties = (
    <Box>
      <Stack direction="row" spacing={1} sx={{ mb: 2, alignItems: 'center' }}>
        {selectedQuestion ? <QuestionTypeIcon type={selectedQuestion.type} /> : <SettingsIcon fontSize="small" />}
        <Typography variant="subtitle1" sx={{ flex: 1, fontWeight: 700 }}>
          {selectedQuestion ? questionTypeLabel(selectedQuestion.type) : selectedSection ? 'Sezione' : 'Impostazioni questionario'}
        </Typography>
        {selection.kind !== 'questionnaire' && (
          <Button size="small" onClick={() => select({ kind: 'questionnaire' })}>Impostazioni</Button>
        )}
      </Stack>
      {selectedQuestion ? (
        <QuestionProperties key={selectedQuestion.id} question={selectedQuestion} locked={locked}
          errors={showIssues || questionnaire.status === 'Published' ? questionErrors.get(selectedQuestion.id) ?? [] : []} />
      ) : selectedSection ? (
        <Stack spacing={2}>
          <TextField size="small" label="Titolo della sezione" value={selectedSection.title ?? ''}
            onChange={e => updateSection(selectedSection.id, { title: e.target.value }, `section:${selectedSection.id}:title`)} />
          <TextField size="small" label="Descrizione" multiline minRows={3} value={selectedSection.description ?? ''}
            onChange={e => updateSection(selectedSection.id, { description: e.target.value || null }, `section:${selectedSection.id}:description`)} />
          <Typography variant="caption" color="text.secondary">
            Con l'impaginazione «una sezione per pagina» ogni sezione diventa un passo del questionario.
          </Typography>
        </Stack>
      ) : (
        <QuestionnaireSettings errors={settingsErrors} />
      )}
    </Box>
  );

  async function runDuplicate() {
    setBusy(true);
    try {
      const copy = await api.duplicate(questionnaire!.questionnaireId);
      navigate(`/admin/questionnaires/${copy.questionnaireId}/edit`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Duplicazione non riuscita.');
    } finally {
      setBusy(false);
    }
  }

  const status = questionnaire.status;
  return (
    <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: 'calc(100vh - 60px)' }}>
      <Paper square elevation={0} sx={{ px: 2, py: 1, borderBottom: 1, borderColor: 'divider' }}>
        <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
          <Tooltip title="Torna ai questionari">
            <IconButton aria-label="Torna ai questionari" onClick={() => navigate('/admin/questionnaires')}><ArrowBackIcon /></IconButton>
          </Tooltip>
          <Typography variant="h6" noWrap sx={{ maxWidth: { xs: 160, md: 420 } }} title={questionnaire.title}>
            {questionnaire.title || 'Questionario senza titolo'}
          </Typography>
          <Chip size="small" label={statusLabels[status]} color={statusColors[status]} />
          <SaveIndicator status={saveStatus} onRetry={() => void saveNow()} />
          <Box sx={{ flex: 1 }} />
          <Tooltip title="Annulla (Ctrl+Z)"><span><IconButton aria-label="Annulla" disabled={!canUndo} onClick={undo}><UndoIcon /></IconButton></span></Tooltip>
          <Tooltip title="Ripeti (Ctrl+Y)"><span><IconButton aria-label="Ripeti" disabled={!canRedo} onClick={redo}><RedoIcon /></IconButton></span></Tooltip>
          <Divider orientation="vertical" flexItem />
          <Button startIcon={<VisibilityOutlinedIcon />} onClick={() => setPreviewOpen(true)}>Anteprima</Button>
          <Button startIcon={<ShareIcon />} onClick={() => setShareOpen(true)}>Condividi</Button>
          <Button startIcon={<BarChartIcon />} onClick={() => navigate(`/admin/questionnaires/${questionnaire.questionnaireId}/results`)}>Risultati</Button>
          {status === 'Draft' && (
            <Button variant="contained" disabled={busy} onClick={() => { setShowIssues(true); setPublishOpen(true); }}>Pubblica</Button>
          )}
          {status === 'Published' && (
            <Button variant="outlined" color="warning" disabled={busy} onClick={() => void runAction(() => api.close(questionnaire.questionnaireId))}>Chiudi</Button>
          )}
          {(status === 'Closed' || status === 'Archived') && (
            <Button variant="outlined" disabled={busy} onClick={() => void runAction(() => api.reopen(questionnaire.questionnaireId))}>Riapri</Button>
          )}
        </Stack>
        {saveStatus.kind === 'conflict' && (
          <Alert severity="error" sx={{ mt: 1 }} action={<Button color="inherit" onClick={() => void reload()}>Ricarica</Button>}>
            {saveStatus.message}
          </Alert>
        )}
        {saveStatus.kind === 'blocked' && <Alert severity="warning" sx={{ mt: 1 }}>{saveStatus.message}</Alert>}
        {actionError && <Alert severity="error" sx={{ mt: 1 }} onClose={() => setActionError(null)}>{actionError}</Alert>}
      </Paper>

      <DndContext sensors={sensors} collisionDetection={collision} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragType(null)}>
        {wide ? (
          <Box sx={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '220px minmax(0, 1fr) 360px' }}>
            <Box sx={{ overflowY: 'auto', p: 2, borderRight: 1, borderColor: 'divider' }}>{palette}</Box>
            <Box sx={{ overflowY: 'auto', p: 3, bgcolor: 'grey.100' }} onClick={e => { if (e.target === e.currentTarget) select({ kind: 'questionnaire' }); }}>
              <Box sx={{ maxWidth: 820, mx: 'auto' }}>{canvas}</Box>
            </Box>
            <Box sx={{ overflowY: 'auto', p: 2, borderLeft: 1, borderColor: 'divider' }} component="aside" aria-label="Proprietà">{properties}</Box>
          </Box>
        ) : (
          <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <Tabs value={mobileTab} onChange={(_, v) => setMobileTab(v)} variant="fullWidth">
              <Tab label="Struttura" />
              <Tab label="Aggiungi" disabled={locked} />
              <Tab label="Proprietà" />
            </Tabs>
            <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
              {mobileTab === 0 ? canvas : mobileTab === 1 ? palette : properties}
            </Box>
          </Box>
        )}
        <DragOverlay dropAnimation={null}>
          {dragType && <Chip color="primary" icon={<QuestionTypeIcon type={dragType} />} label={questionTypeLabel(dragType)} sx={{ boxShadow: 3 }} />}
        </DragOverlay>
      </DndContext>

      <PreviewDialog open={previewOpen} questionnaire={questionnaire} onClose={() => setPreviewOpen(false)} />
      <ShareDialog open={shareOpen} questionnaire={questionnaire} onClose={() => setShareOpen(false)} />
      <PublishDialog
        open={publishOpen}
        questionnaire={questionnaire}
        errors={definitionErrors}
        busy={busy}
        onClose={() => setPublishOpen(false)}
        onGoTo={questionId => {
          setPublishOpen(false);
          select(questionId ? { kind: 'question', id: questionId } : { kind: 'questionnaire' });
          if (!wide) setMobileTab(2);
        }}
        onPublish={async () => {
          if (await runAction(() => api.publish(questionnaire.questionnaireId))) {
            setPublishOpen(false);
            setShareOpen(true);
          }
        }}
      />
    </Box>
  );
};

export default QuestionnaireDesigner;

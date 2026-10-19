import React, { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button } from 'react-aria-components';
import { useOidcFetch } from '@axa-fr/react-oidc';
import {
  closestCenter, CollisionDetection, DndContext, DragEndEvent, DragOverlay, DragStartEvent, KeyboardSensor, PointerSensor, pointerWithin,
  useSensor, useSensors,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { AdminIcon } from '../../admin/icons';
import { LoadError, PageHeader, btn } from '../../admin/ui';
import { RowMenu, Skeleton } from '../../admin/pages/listUi';
import { notify } from '../../admin/toasts';
import DesignerCanvas from './DesignerCanvas';
import QuestionPalette from './QuestionPalette';
import QuestionProperties from './QuestionProperties';
import QuestionnaireSettings from './QuestionnaireSettings';
import PreviewDialog from './PreviewDialog';
import PublishDialog from './PublishDialog';
import ShareDialog from './ShareDialog';
import { QuestionTypeIcon } from './QuestionTypeIcon';
import { Callout, FieldText, Icon, IconButton, MEDIUM_QUERY, Sheet, StatusBadge, useMediaQuery, WIDE_QUERY } from './designerUi';
import { dragAnnouncements, screenReaderInstructions } from './dragText';
import { locateQuestion, useDesignerStore } from './designerStore';
import { SaveStatus, useAutosave } from './useAutosave';
import { createQuestionnaireAdminApi, QuestionnaireApiError } from '../../questionnaire/api';
import { questionTypeLabel } from '../../questionnaire/factory';
import type { Questionnaire, QuestionnaireValidationError, QuestionType } from '../../questionnaire/types';
import { validateDefinition } from '../../questionnaire/validation';
import { useAccountCapabilities } from '../../account/AccountCapabilities';
import { canPerform, hasAnyPermission, RESULTS_PERMISSIONS } from '../../account/permissions';

const SAVE_TEXT: Record<SaveStatus['kind'], string> = {
  saved: 'Salvato',
  pending: 'Modifiche in corso…',
  saving: 'Salvataggio…',
  blocked: 'Non salvato',
  error: 'Errore di salvataggio',
  conflict: 'Conflitto',
};

/** Quiet autosave state; only problems get a colour. */
const SaveIndicator: FC<{ status: SaveStatus }> = ({ status }) => {
  const problem = status.kind === 'error' || status.kind === 'conflict';
  const tone = problem ? 'text-[#b42318]' : status.kind === 'blocked' ? 'text-[#8a4b00]' : 'text-muted';
  const busy = status.kind === 'pending' || status.kind === 'saving';
  return (
    <p role="status" className={`flex items-center gap-1.5 text-sm ${tone}`}>
      {status.kind === 'saved' ? <AdminIcon name="check" className="size-4 text-basil-700" /> : busy ? <Icon name="sync" className="size-4" /> : <AdminIcon name="todo" className="size-4" />}
      {SAVE_TEXT[status.kind]}
    </p>
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

/** What a draggable or droppable id stands for, for the screen-reader announcements. */
function describeDragId(id: string | number) {
  const key = String(id);
  if (key.startsWith('palette:')) return `nuova domanda ${questionTypeLabel(key.slice('palette:'.length) as QuestionType)}`;
  const questionnaire = useDesignerStore.getState().questionnaire;
  if (key.startsWith('drop:')) {
    const index = questionnaire?.sections.findIndex(s => `drop:${s.id}` === key) ?? -1;
    return index >= 0 ? `fine della sezione ${index + 1}` : 'fine della sezione';
  }
  const location = questionnaire ? locateQuestion(questionnaire, key) : null;
  return location ? `domanda «${location.question.title || questionTypeLabel(location.question.type)}»` : 'elemento';
}

const panel = 'rounded-2xl border border-line bg-white';
const dragAccessibility = { announcements: dragAnnouncements(describeDragId), screenReaderInstructions };

export interface QuestionnaireDesignerProps { autosaveDelayMs?: number }

const QuestionnaireDesigner: FC<QuestionnaireDesignerProps> = ({ autosaveDelayMs }) => {
  const { capabilities } = useAccountCapabilities();
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { fetch } = useOidcFetch();
  const api = useMemo(() => createQuestionnaireAdminApi(fetch), [fetch]);
  const wide = useMediaQuery(WIDE_QUERY);
  const medium = useMediaQuery(MEDIUM_QUERY);

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
  // Without room for three panes the properties and the palette open as sheets over a single column.
  const [propertiesOpen, setPropertiesOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [dragType, setDragType] = useState<QuestionType | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const activeLoad = useRef<AbortController | null>(null);

  const blockedReason = useCallback((q: Questionnaire) => {
    if (!canPerform(capabilities, 'questionnaires.manage', q.workshopId ? q : undefined))
      return 'Sola lettura: manca il permesso di modifica o di gestione degli eventi passati.';
    if (q.status === 'Published' && !canPerform(capabilities, 'questionnaires.publish', q.workshopId ? q : undefined))
      return 'Sola lettura: per modificare un questionario pubblicato serve il permesso di pubblicazione.';
    if (q.status === 'Published' && validateDefinition(q, true).length > 0) {
      return 'Il questionario è pubblicato: le modifiche vengono salvate quando non ci sono errori.';
    }
    return validateDefinition(q, false).length > 0 ? 'Correggi gli errori evidenziati per salvare.' : null;
  }, [capabilities]);
  const save = useCallback(async (q: Questionnaire) => {
    const saved = await api.update(q);
    return saved.authorization ? saved : api.get(q.questionnaireId);
  }, [api]);
  const { status: saveStatus, saveNow, reset } = useAutosave({ save, blockedReason, delayMs: autosaveDelayMs });

  const reload = useCallback(async () => {
    activeLoad.current?.abort();
    const controller = new AbortController();
    activeLoad.current = controller;
    setLoadError(null);
    try {
      const loaded = await api.get(id, { signal: controller.signal });
      if (controller.signal.aborted) return;
      load(loaded);
      reset();
    } catch (err) {
      if (controller.signal.aborted) return;
      setLoadError(err instanceof QuestionnaireApiError ? err.message : 'Impossibile caricare il questionario.');
    }
  }, [api, id, load, reset]);

  useEffect(() => {
    useDesignerStore.setState({ questionnaire: null });
    void reload();
    return () => {
      activeLoad.current?.abort();
      useDesignerStore.setState({ questionnaire: null, past: [], future: [] });
    };
  }, [reload]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const current = useDesignerStore.getState().questionnaire;
      if (!current || !canPerform(capabilities, 'questionnaires.manage', current.workshopId ? current : undefined)) return;
      if (current.status === 'Published' && !canPerform(capabilities, 'questionnaires.publish', current.workshopId ? current : undefined)) return;
      if (!(e.ctrlKey || e.metaKey) || isEditableTarget(e.target)) return;
      const key = e.key.toLowerCase();
      if (key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      else if ((key === 'z' && e.shiftKey) || key === 'y') { e.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo, capabilities]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const definitionErrors = useMemo(() => (questionnaire ? validateDefinition(questionnaire, true) : []), [questionnaire]);
  const questionErrors = useMemo(() => {
    const map = new Map<string, QuestionnaireValidationError[]>();
    if (!showIssues && questionnaire?.status !== 'Published') return map;
    for (const e of definitionErrors) {
      if (e.questionId) map.set(e.questionId, [...(map.get(e.questionId) ?? []), e]);
    }
    return map;
  }, [definitionErrors, showIssues, questionnaire?.status]);
  const settingsErrors = useMemo(() => (questionnaire
    ? Object.fromEntries(validateDefinition(questionnaire, false).filter(e => !e.questionId).map(e => [e.field, e.message]))
    : {}), [questionnaire]);

  if (loadError) {
    return (
      <>
        <PageHeader title="Questionario" back={{ to: '/admin/questionnaires', label: 'Questionari' }} />
        <div className="mt-6"><LoadError message={loadError} onRetry={() => void reload()} /></div>
      </>
    );
  }
  if (!questionnaire) {
    return (
      <>
        <p role="status" className="sr-only">Caricamento del questionario…</p>
        <Skeleton className="h-[32rem]" />
      </>
    );
  }

  const canManage = canPerform(capabilities, 'questionnaires.manage', questionnaire.workshopId ? questionnaire : undefined);
  const canPublish = canPerform(capabilities, 'questionnaires.publish', questionnaire.workshopId ? questionnaire : undefined);
  const canEdit = canManage && (questionnaire.status !== 'Published' || canPublish);
  const canResults = hasAnyPermission(capabilities, RESULTS_PERMISSIONS);
  const locked = questionnaire.responseCount > 0 || !canEdit;
  const status = questionnaire.status;
  const selectedQuestion = selection.kind === 'question' ? locateQuestion(questionnaire, selection.id)?.question : undefined;
  const selectedSection = selection.kind === 'section' ? questionnaire.sections.find(s => s.id === selection.id) : undefined;
  const openProperties = wide ? undefined : () => setPropertiesOpen(true);

  const runAction = async (action: () => Promise<Questionnaire>) => {
    setActionError(null);
    setBusy(true);
    try {
      if (canEdit && !(await saveNow())) throw new Error('Salva le modifiche prima di continuare.');
      const result = await action();
      const updated = result.authorization ? result : await api.get(result.questionnaireId);
      if (activeLoad.current?.signal.aborted) return false;
      acknowledgeSave(updated, true);
      return true;
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Operazione non riuscita.');
      return false;
    } finally {
      setBusy(false);
    }
  };

  async function runDuplicate() {
    setBusy(true);
    try {
      const copy = await api.duplicate(questionnaire!.questionnaireId);
      notify('Questionario duplicato', { description: copy.title });
      navigate(`/admin/questionnaires/${copy.questionnaireId}/edit`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Duplicazione non riuscita.');
    } finally {
      setBusy(false);
    }
  }

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
      setAnnouncement(`Aggiunta una domanda «${questionTypeLabel(activeData.type)}».`);
    } else if (activeData.kind === 'question' && active.id !== over.id) {
      moveQuestion(String(active.id), target.sectionId, target.index);
    }
  };

  const onAdd = (type: QuestionType) => {
    addQuestion(type);
    setAnnouncement(`Aggiunta una domanda «${questionTypeLabel(type)}».`);
    setPaletteOpen(false);
  };

  const propertiesTitle = selectedQuestion ? questionTypeLabel(selectedQuestion.type) : selectedSection ? 'Sezione' : 'Impostazioni questionario';
  const backToSettings = selection.kind !== 'questionnaire' && (
    <Button onPress={() => select({ kind: 'questionnaire' })} className={btn.ghost}><Icon name="sliders" />Impostazioni</Button>
  );
  const propertiesBody = selectedQuestion ? (
    <QuestionProperties key={selectedQuestion.id} question={selectedQuestion} locked={locked} errors={questionErrors.get(selectedQuestion.id) ?? []} />
  ) : selectedSection ? (
    <div className="space-y-4">
      <FieldText label="Titolo della sezione" value={selectedSection.title ?? ''} onChange={title => updateSection(selectedSection.id, { title }, `section:${selectedSection.id}:title`)} />
      <FieldText
        label="Descrizione"
        multiline
        rows={4}
        value={selectedSection.description ?? ''}
        description="Con l'impaginazione «una sezione per pagina» ogni sezione diventa un passo del questionario."
        onChange={description => updateSection(selectedSection.id, { description: description || null }, `section:${selectedSection.id}:description`)}
      />
    </div>
  ) : (
    <QuestionnaireSettings errors={settingsErrors} />
  );

  // Between the phone menu and the three-pane layout the labels give way to icons (the names stay for assistive technology).
  const label = (text: string) => <span className="max-xl:sr-only">{text}</span>;
  const secondaryActions = medium ? (
    <>
      <Button onPress={() => setPreviewOpen(true)} className={btn.ghost}><Icon name="eye" />{label('Anteprima')}</Button>
      <Button onPress={() => setShareOpen(true)} className={btn.ghost}><Icon name="share" />{label('Condividi')}</Button>
      {canResults && <Link to={`/admin/questionnaires/${questionnaire.questionnaireId}/results`} className={btn.ghost}><Icon name="chart" />{label('Risultati')}</Link>}
    </>
  ) : (
    <RowMenu label="Altre azioni" items={[
      { id: 'add', label: 'Aggiungi domanda', icon: <AdminIcon name="plus" className="size-5 text-muted" />, isDisabled: locked, onAction: () => setPaletteOpen(true) },
      { id: 'settings', label: 'Impostazioni', icon: <Icon name="sliders" className="size-5 text-muted" />, onAction: () => { select({ kind: 'questionnaire' }); setPropertiesOpen(true); } },
      { id: 'preview', label: 'Anteprima', icon: <Icon name="eye" className="size-5 text-muted" />, onAction: () => setPreviewOpen(true) },
      { id: 'share', label: 'Condividi', icon: <Icon name="share" className="size-5 text-muted" />, onAction: () => setShareOpen(true) },
      { id: 'results', label: 'Risultati', isDisabled: !canResults, icon: <Icon name="chart" className="size-5 text-muted" />, onAction: () => navigate(`/admin/questionnaires/${questionnaire.questionnaireId}/results`) },
    ]} />
  );

  const canvas = (
    <div className="space-y-4" onClick={event => { if (event.target === event.currentTarget) select({ kind: 'questionnaire' }); }}>
      <h2 className="sr-only">Domande del questionario</h2>
      {locked && (
        <Callout
          tone="info"
          icon={<Icon name="lock" />}
          action={<Button isDisabled={busy} onPress={() => void runDuplicate()} className={btn.secondary}>Duplica</Button>}
        >
          Il questionario ha {questionnaire.responseCount} {questionnaire.responseCount === 1 ? 'risposta' : 'risposte'}: puoi correggere i testi, ma non aggiungere, rimuovere o
          cambiare tipo alle domande. Per modificarne la struttura, duplicalo.
        </Callout>
      )}
      {!wide && (
        <div className="flex flex-wrap gap-2">
          <Button isDisabled={locked} onPress={() => setPaletteOpen(true)} className={btn.secondary}><AdminIcon name="plus" />Aggiungi domanda</Button>
          <Button onPress={() => { select({ kind: 'questionnaire' }); setPropertiesOpen(true); }} className={btn.ghost}><Icon name="sliders" />Impostazioni</Button>
        </div>
      )}
      <DesignerCanvas locked={locked} questionErrors={questionErrors} onOpenProperties={openProperties} announce={setAnnouncement} />
    </div>
  );

  return (
    <div>
      {/* lg: the shell scrolls inside <main>, whose top padding offsets sticky positions: -top-8 cancels its pt-8. */}
      <div className="sticky top-16 z-20 lg:-top-8">
        <div className={`${panel} flex flex-wrap items-center gap-x-3 gap-y-2 bg-white/95 px-3 py-2 backdrop-blur sm:px-4`}>
          <div className="flex min-w-0 flex-1 basis-56 items-center gap-2">
            <Link to="/admin/questionnaires" aria-label="Torna ai questionari" className={btn.icon}><AdminIcon name="back" /></Link>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h1 className="min-w-0 truncate text-xl font-bold leading-tight" title={questionnaire.title}>{questionnaire.title || 'Questionario senza titolo'}</h1>
                <StatusBadge status={status} />
              </div>
              <SaveIndicator status={saveStatus} />
            </div>
          </div>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-x-1 gap-y-1">
            <IconButton label="Annulla" icon={<Icon name="undo" />} isDisabled={!canUndo} onPress={undo} />
            <IconButton label="Ripeti" icon={<Icon name="redo" />} isDisabled={!canRedo} onPress={redo} />
            {secondaryActions}
            {status === 'Draft' && (
              <Button isDisabled={busy || !canPublish} onPress={() => { setShowIssues(true); setActionError(null); setPublishOpen(true); }} className={`${btn.primary} ml-1`}>Pubblica</Button>
            )}
            {status === 'Published' && (
              <Button isDisabled={busy || !canManage} onPress={() => void runAction(() => api.close(questionnaire.questionnaireId)).then(ok => ok && notify('Questionario chiuso', { description: questionnaire.title }))} className={`${btn.secondary} ml-1`}>Chiudi</Button>
            )}
            {(status === 'Closed' || status === 'Archived') && (
              <Button isDisabled={busy || !canPublish} onPress={() => void runAction(() => api.reopen(questionnaire.questionnaireId)).then(ok => ok && notify('Questionario riaperto', { description: questionnaire.title }))} className={`${btn.secondary} ml-1`}>Riapri</Button>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 space-y-3 empty:hidden">
        {saveStatus.kind === 'conflict' && (
          <Callout tone="danger" role="alert" action={<Button onPress={() => void reload()} className={btn.secondary}>Ricarica</Button>}>
            {saveStatus.message}
          </Callout>
        )}
        {saveStatus.kind === 'error' && (
          <Callout tone="danger" role="alert" action={<Button onPress={() => void saveNow()} className={btn.secondary}>Riprova</Button>}>
            {saveStatus.message}
          </Callout>
        )}
        {saveStatus.kind === 'blocked' && <Callout tone="warn" role="status">{saveStatus.message}</Callout>}
        {actionError && !publishOpen && (
          <Callout tone="danger" role="alert" action={<Button onPress={() => setActionError(null)} className={btn.ghost}>Chiudi avviso</Button>}>{actionError}</Callout>
        )}
      </div>

      <p role="status" className="sr-only">{announcement}</p>

      {!canEdit && <p className="mt-4" role="status">Sola lettura: manca il permesso di modifica, di pubblicazione del contenuto già pubblico o di gestione degli eventi passati.</p>}
      <fieldset disabled={!canEdit} className="min-w-0 border-0 p-0">
      <DndContext
        sensors={sensors}
        collisionDetection={collision}
        accessibility={dragAccessibility}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setDragType(null)}
      >
        {wide ? (
          <div className="mt-4 grid grid-cols-[200px_minmax(0,1fr)_340px] items-start gap-5">
            <div className={`${panel} sticky top-12 max-h-[calc(100dvh-10rem)] overflow-y-auto p-3`}>
              <h2 className="mb-3 px-1 text-base font-bold">Aggiungi domanda</h2>
              <QuestionPalette disabled={locked} onAdd={onAdd} />
            </div>
            {canvas}
            <aside aria-label="Proprietà" className={`${panel} sticky top-12 max-h-[calc(100dvh-10rem)] overflow-y-auto p-4`}>
              <div className="mb-4 flex items-center gap-2">
                {selectedQuestion ? <span className="text-cyan-700"><QuestionTypeIcon type={selectedQuestion.type} /></span> : <span className="text-cyan-700"><Icon name="sliders" /></span>}
                <h2 className="min-w-0 flex-1 text-lg font-bold">{propertiesTitle}</h2>
                {backToSettings}
              </div>
              {propertiesBody}
            </aside>
          </div>
        ) : (
          <div className="mt-4 mx-auto max-w-3xl">{canvas}</div>
        )}
        <DragOverlay dropAnimation={null}>
          {dragType && (
            <span className="inline-flex items-center gap-2 rounded-full bg-navy px-4 py-2 font-bold text-white shadow-lift">
              <QuestionTypeIcon type={dragType} />{questionTypeLabel(dragType)}
            </span>
          )}
        </DragOverlay>
      </DndContext>
      </fieldset>

      {!wide && (
        <>
          <Sheet isOpen={propertiesOpen} onOpenChange={setPropertiesOpen} label={`Proprietà: ${propertiesTitle}`} title={propertiesTitle}>
            {backToSettings && <div className="-mt-2 mb-4">{backToSettings}</div>}
            {propertiesBody}
          </Sheet>
          <Sheet isOpen={paletteOpen} onOpenChange={setPaletteOpen} label="Aggiungi domanda" title="Aggiungi domanda">
            <QuestionPalette disabled={locked} draggable={false} onAdd={onAdd} />
          </Sheet>
        </>
      )}

      <PreviewDialog open={previewOpen} questionnaire={questionnaire} onClose={() => setPreviewOpen(false)} />
      <ShareDialog open={shareOpen} questionnaire={questionnaire} onClose={() => setShareOpen(false)} />
      <PublishDialog
        open={publishOpen}
        questionnaire={questionnaire}
        errors={definitionErrors}
        busy={busy}
        error={actionError}
        onClose={() => setPublishOpen(false)}
        onGoTo={questionId => {
          setPublishOpen(false);
          select(questionId ? { kind: 'question', id: questionId } : { kind: 'questionnaire' });
          if (!wide) setPropertiesOpen(true);
        }}
        onPublish={async () => {
          if (await runAction(() => api.publish(questionnaire.questionnaireId))) {
            notify('Questionario pubblicato', { description: questionnaire.title });
            setPublishOpen(false);
            setShareOpen(true);
          }
        }}
      />
    </div>
  );
};

export default QuestionnaireDesigner;

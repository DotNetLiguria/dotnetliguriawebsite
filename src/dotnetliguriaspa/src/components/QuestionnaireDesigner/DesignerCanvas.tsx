import React, { FC } from 'react';
import { Box, Button, IconButton, Paper, Stack, TextField, Tooltip, Typography } from '@mui/material';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import AddIcon from '@mui/icons-material/Add';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import QuestionCard from './QuestionCard';
import { useDesignerStore } from './designerStore';
import { isAnswerable } from '../../questionnaire/rules';
import type { QuestionnaireSection } from '../../questionnaire/types';

const SectionDropZone: FC<{ sectionId: string; empty: boolean; locked: boolean }> = ({ sectionId, empty, locked }) => {
  const { setNodeRef, isOver } = useDroppable({ id: `drop:${sectionId}`, data: { kind: 'section-end', sectionId }, disabled: locked });
  if (locked && !empty) return null;
  return (
    <Box ref={setNodeRef} sx={{
      border: 2, borderStyle: 'dashed', borderColor: isOver ? 'primary.main' : 'divider', borderRadius: 2,
      p: empty ? 3 : 1, textAlign: 'center', color: 'text.secondary', bgcolor: isOver ? 'action.hover' : 'transparent',
    }}>
      <Typography variant="body2">{empty ? 'Sezione vuota: trascina qui un tipo di domanda o cliccalo nella palette.' : 'Rilascia qui per aggiungere in fondo'}</Typography>
    </Box>
  );
};

export interface DesignerCanvasProps {
  locked: boolean;
  questionErrors: Map<string, string[]>;
}

const DesignerCanvas: FC<DesignerCanvasProps> = ({ locked, questionErrors }) => {
  const questionnaire = useDesignerStore(s => s.questionnaire)!;
  const selection = useDesignerStore(s => s.selection);
  const store = useDesignerStore.getState;
  const select = useDesignerStore(s => s.select);
  const multipleSections = questionnaire.sections.length > 1;

  let counter = 0;
  const renderSection = (section: QuestionnaireSection, sectionIndex: number) => {
    const sectionSelected = selection.kind === 'section' && selection.id === section.id;
    return (
      <Paper key={section.id} variant="outlined" component="section" aria-label={section.title || `Sezione ${sectionIndex + 1}`}
        sx={{ p: { xs: 1.5, md: 2 }, borderRadius: 3, bgcolor: 'grey.50', borderColor: sectionSelected ? 'primary.main' : 'divider' }}>
        {(multipleSections || section.title || sectionSelected) && (
          <Stack direction="row" spacing={1} sx={{ mb: 1.5, alignItems: 'flex-start' }} onClick={() => select({ kind: 'section', id: section.id })}>
            <Box sx={{ flex: 1 }}>
              <TextField fullWidth variant="standard" placeholder={`Sezione ${sectionIndex + 1} (titolo facoltativo)`} value={section.title ?? ''}
                onFocus={() => select({ kind: 'section', id: section.id })}
                onChange={e => store().updateSection(section.id, { title: e.target.value }, `section:${section.id}:title`)}
                slotProps={{ htmlInput: { 'aria-label': `Titolo sezione ${sectionIndex + 1}` } }}
                sx={{ '& input': { fontWeight: 700, fontSize: '1.15rem' } }} />
              {section.description && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{section.description}</Typography>}
            </Box>
            <Tooltip title="Sposta sezione su"><span><IconButton size="small" aria-label={`Sposta su sezione ${sectionIndex + 1}`} disabled={locked || sectionIndex === 0} onClick={() => store().moveSection(section.id, sectionIndex - 1)}><ArrowUpwardIcon fontSize="small" /></IconButton></span></Tooltip>
            <Tooltip title="Sposta sezione giù"><span><IconButton size="small" aria-label={`Sposta giù sezione ${sectionIndex + 1}`} disabled={locked || sectionIndex === questionnaire.sections.length - 1} onClick={() => store().moveSection(section.id, sectionIndex + 1)}><ArrowDownwardIcon fontSize="small" /></IconButton></span></Tooltip>
            <Tooltip title="Elimina sezione (le domande passano alla sezione precedente)"><span><IconButton size="small" aria-label={`Elimina sezione ${sectionIndex + 1}`} disabled={locked || !multipleSections} onClick={() => store().removeSection(section.id)}><DeleteOutlinedIcon fontSize="small" /></IconButton></span></Tooltip>
          </Stack>
        )}
        <SortableContext items={section.questions.map(q => q.id)} strategy={verticalListSortingStrategy}>
          <Stack spacing={1.25}>
            {section.questions.map((question, index) => {
              const number = isAnswerable(question.type) ? ++counter : undefined;
              const isFirst = sectionIndex === 0 && index === 0;
              const isLast = sectionIndex === questionnaire.sections.length - 1 && index === section.questions.length - 1;
              return (
                <QuestionCard
                  key={question.id}
                  question={question}
                  sectionId={section.id}
                  number={number}
                  locked={locked}
                  selected={selection.kind === 'question' && selection.id === question.id}
                  hasErrors={questionErrors.has(question.id)}
                  canMoveUp={!isFirst}
                  canMoveDown={!isLast}
                  onSelect={() => { if (!(selection.kind === 'question' && selection.id === question.id)) select({ kind: 'question', id: question.id }); }}
                  onTitleChange={title => store().updateQuestion(question.id, { title }, `${question.id}:title`)}
                  onDuplicate={() => store().duplicateQuestion(question.id)}
                  onRemove={() => store().removeQuestion(question.id)}
                  onMove={delta => {
                    const sections = questionnaire.sections;
                    if (delta === -1 && index === 0) store().moveQuestion(question.id, sections[sectionIndex - 1].id, sections[sectionIndex - 1].questions.length);
                    else if (delta === 1 && index === section.questions.length - 1) store().moveQuestion(question.id, sections[sectionIndex + 1].id, 0);
                    else store().moveQuestion(question.id, section.id, index + delta);
                  }}
                />
              );
            })}
            <SectionDropZone sectionId={section.id} empty={section.questions.length === 0} locked={locked} />
          </Stack>
        </SortableContext>
      </Paper>
    );
  };

  return (
    <Stack spacing={2}>
      {questionnaire.sections.map(renderSection)}
      <Button startIcon={<AddIcon />} variant="outlined" disabled={locked} onClick={() => store().addSection()} sx={{ alignSelf: 'center' }}>
        Aggiungi sezione
      </Button>
    </Stack>
  );
};

export default DesignerCanvas;

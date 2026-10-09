import React, { FC } from 'react';
import { Box, Chip, IconButton, Paper, Stack, TextField, Tooltip, Typography } from '@mui/material';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import CallSplitIcon from '@mui/icons-material/CallSplit';
import { QuestionTypeIcon } from './QuestionTypeIcon';
import QuestionField from '../QuestionnaireRunner/QuestionField';
import { questionTypeLabel } from '../../questionnaire/factory';
import type { Question } from '../../questionnaire/types';

export interface QuestionCardProps {
  question: Question;
  sectionId: string;
  number?: number;
  selected: boolean;
  locked: boolean;
  hasErrors: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onSelect: () => void;
  onTitleChange: (title: string) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onMove: (delta: -1 | 1) => void;
}

const QuestionCard: FC<QuestionCardProps> = ({
  question, sectionId, number, selected, locked, hasErrors, canMoveUp, canMoveDown, onSelect, onTitleChange, onDuplicate, onRemove, onMove,
}) => {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: question.id, data: { kind: 'question', sectionId }, disabled: locked });
  const label = question.title || questionTypeLabel(question.type);

  return (
    <Paper
      ref={setNodeRef}
      variant="outlined"
      onClick={onSelect}
      onFocusCapture={onSelect}
      data-testid={`card-${question.id}`}
      aria-current={selected ? 'true' : undefined}
      sx={{
        p: 1.5, borderRadius: 2, cursor: 'pointer', position: 'relative',
        transform: CSS.Translate.toString(transform), transition, opacity: isDragging ? 0.4 : 1,
        borderColor: selected ? 'primary.main' : hasErrors ? 'warning.main' : 'divider',
        borderWidth: selected ? 2 : 1, borderLeftWidth: 4, borderLeftColor: selected ? 'primary.main' : hasErrors ? 'warning.main' : 'divider',
        '&:hover': { borderColor: selected ? 'primary.main' : 'text.secondary' },
      }}
    >
      <Stack direction="row" spacing={0.5} sx={{ mb: 0.5, alignItems: 'center' }}>
        <IconButton size="small" ref={setActivatorNodeRef} disabled={locked} aria-label={`Trascina: ${label}`}
          sx={{ cursor: locked ? 'default' : 'grab', touchAction: 'none' }} {...attributes} {...listeners}>
          <DragIndicatorIcon fontSize="small" />
        </IconButton>
        <Chip size="small" variant="outlined" icon={<QuestionTypeIcon type={question.type} />} label={questionTypeLabel(question.type)} />
        {question.visibleIf && (
          <Tooltip title="Visibile solo se la condizione è soddisfatta">
            <Chip size="small" color="secondary" variant="outlined" icon={<CallSplitIcon />} label="Condizionale" />
          </Tooltip>
        )}
        {hasErrors && <Chip size="small" color="warning" label="Da completare" />}
        <Box sx={{ flex: 1 }} />
        <Tooltip title="Sposta su"><span><IconButton size="small" aria-label={`Sposta su: ${label}`} disabled={locked || !canMoveUp} onClick={e => { e.stopPropagation(); onMove(-1); }}><ArrowUpwardIcon fontSize="small" /></IconButton></span></Tooltip>
        <Tooltip title="Sposta giù"><span><IconButton size="small" aria-label={`Sposta giù: ${label}`} disabled={locked || !canMoveDown} onClick={e => { e.stopPropagation(); onMove(1); }}><ArrowDownwardIcon fontSize="small" /></IconButton></span></Tooltip>
        <Tooltip title="Duplica"><span><IconButton size="small" aria-label={`Duplica: ${label}`} disabled={locked} onClick={e => { e.stopPropagation(); onDuplicate(); }}><ContentCopyIcon fontSize="small" /></IconButton></span></Tooltip>
        <Tooltip title="Elimina"><span><IconButton size="small" aria-label={`Elimina: ${label}`} disabled={locked} onClick={e => { e.stopPropagation(); onRemove(); }}><DeleteOutlinedIcon fontSize="small" /></IconButton></span></Tooltip>
      </Stack>
      {selected ? (
        <TextField
          fullWidth
          size="small"
          variant="standard"
          placeholder={question.type === 'InfoText' ? 'Titolo del blocco' : 'Scrivi la domanda…'}
          value={question.title}
          autoFocus={!question.title}
          onChange={e => onTitleChange(e.target.value)}
          onClick={e => e.stopPropagation()}
          slotProps={{ htmlInput: { 'aria-label': 'Testo della domanda', maxLength: 500 } }}
          sx={{ mb: 1, '& input': { fontWeight: 600, fontSize: '1.05rem' } }}
        />
      ) : null}
      <Box sx={{ pointerEvents: 'none', px: 1 }} aria-hidden>
        {selected
          ? <QuestionField question={{ ...question, title: '' }} disabled onChange={() => undefined} />
          : <QuestionField question={{ ...question, title: question.title || '(senza titolo)' }} number={number} disabled onChange={() => undefined} />}
      </Box>
      {!selected && question.type !== 'InfoText' && !question.title && (
        <Typography variant="caption" color="warning.main" sx={{ px: 1 }}>Aggiungi il testo della domanda</Typography>
      )}
    </Paper>
  );
};

export default QuestionCard;

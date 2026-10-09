import React, { FC } from 'react';
import { Box, ButtonBase, Stack, Tooltip, Typography } from '@mui/material';
import { useDraggable } from '@dnd-kit/core';
import { QuestionTypeIcon } from './QuestionTypeIcon';
import { questionTypes, QuestionTypeInfo } from '../../questionnaire/factory';
import type { QuestionType } from '../../questionnaire/types';

const PaletteItem: FC<{ info: QuestionTypeInfo; disabled?: boolean; onAdd: (type: QuestionType) => void }> = ({ info, disabled, onAdd }) => {
  const { setNodeRef, listeners, isDragging } = useDraggable({ id: `palette:${info.type}`, data: { kind: 'palette', type: info.type }, disabled });
  // Keyboard users add with Enter/click; only pointer dragging is enabled from the palette.
  const pointerListeners = listeners ? { onPointerDown: listeners.onPointerDown as React.PointerEventHandler<HTMLButtonElement> } : {};
  return (
    <Tooltip title={info.description} placement="right">
      <ButtonBase
        ref={setNodeRef}
        disabled={disabled}
        onClick={() => onAdd(info.type)}
        aria-label={`Aggiungi domanda: ${info.label}`}
        {...pointerListeners}
        sx={{
          width: '100%', justifyContent: 'flex-start', gap: 1, px: 1.25, py: 0.9, borderRadius: 2, border: 1, borderColor: 'divider',
          bgcolor: 'background.paper', opacity: isDragging ? 0.5 : disabled ? 0.5 : 1, cursor: disabled ? 'default' : 'grab', touchAction: 'none',
          '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' },
        }}
      >
        <Box sx={{ color: 'primary.main', display: 'flex' }}><QuestionTypeIcon type={info.type} /></Box>
        <Typography variant="body2">{info.label}</Typography>
      </ButtonBase>
    </Tooltip>
  );
};

const QuestionPalette: FC<{ disabled?: boolean; onAdd: (type: QuestionType) => void }> = ({ disabled, onAdd }) => {
  const groups = [...new Set(questionTypes.map(t => t.group))];
  return (
    <Stack spacing={2} component="nav" aria-label="Tipi di domanda">
      {disabled && (
        <Typography variant="caption" color="text.secondary">
          Struttura bloccata: il questionario ha già delle risposte.
        </Typography>
      )}
      {groups.map(group => (
        <Box key={group}>
          <Typography variant="overline" color="text.secondary">{group}</Typography>
          <Stack spacing={0.75}>
            {questionTypes.filter(t => t.group === group).map(info => (
              <PaletteItem key={info.type} info={info} disabled={disabled} onAdd={onAdd} />
            ))}
          </Stack>
        </Box>
      ))}
      <Typography variant="caption" color="text.secondary">Clicca per aggiungere dopo la domanda selezionata, oppure trascina nel punto desiderato.</Typography>
    </Stack>
  );
};

export default QuestionPalette;

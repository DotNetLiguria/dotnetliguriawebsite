import React, { FC } from 'react';
import {
  Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, List, ListItemButton, ListItemIcon, ListItemText, Typography,
} from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import { allQuestions } from '../../questionnaire/rules';
import type { Questionnaire, QuestionnaireValidationError } from '../../questionnaire/types';

export interface PublishDialogProps {
  open: boolean;
  questionnaire: Questionnaire;
  errors: QuestionnaireValidationError[];
  busy: boolean;
  onClose: () => void;
  onPublish: () => void;
  onGoTo: (questionId: string | null) => void;
}

const PublishDialog: FC<PublishDialogProps> = ({ open, questionnaire, errors, busy, onClose, onPublish, onGoTo }) => {
  const questions = allQuestions(questionnaire);
  const describe = (e: QuestionnaireValidationError) => {
    if (!e.questionId) return 'Impostazioni del questionario';
    const index = questions.findIndex(q => q.id === e.questionId);
    return index >= 0 ? `Domanda ${index + 1}: ${questions[index].title || '(senza titolo)'}` : 'Domanda';
  };
  const answerable = questions.filter(q => q.type !== 'InfoText').length;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" aria-labelledby="publish-title">
      <DialogTitle id="publish-title">Pubblica il questionario</DialogTitle>
      <DialogContent dividers>
        {errors.length === 0 ? (
          <>
            <Alert icon={<CheckCircleOutlinedIcon />} severity="success" sx={{ mb: 2 }}>Tutto pronto: {answerable} domande verificate.</Alert>
            <Typography variant="body2" color="text.secondary">
              Dopo la pubblicazione il questionario è raggiungibile dal link pubblico
              {questionnaire.opensAt ? ' a partire dalla data di apertura' : ''}. Con la prima risposta la struttura si blocca:
              potrai ancora correggere i testi, ma non aggiungere o rimuovere domande.
            </Typography>
          </>
        ) : (
          <>
            <Alert severity="warning" sx={{ mb: 1 }}>Correggi questi punti prima di pubblicare ({errors.length}).</Alert>
            <List dense>
              {errors.map((e, i) => (
                <ListItemButton key={`${e.questionId}-${e.field}-${i}`} onClick={() => onGoTo(e.questionId ?? null)}>
                  <ListItemIcon sx={{ minWidth: 36 }}><WarningAmberIcon color="warning" fontSize="small" /></ListItemIcon>
                  <ListItemText primary={e.message} secondary={describe(e)} />
                </ListItemButton>
              ))}
            </List>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Annulla</Button>
        <Button variant="contained" disabled={errors.length > 0 || busy} onClick={onPublish}>{busy ? 'Pubblicazione…' : 'Pubblica'}</Button>
      </DialogActions>
    </Dialog>
  );
};

export default PublishDialog;

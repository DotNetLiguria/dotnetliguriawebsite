import React, { FC, useState } from 'react';
import { AppBar, Box, Dialog, IconButton, Toolbar, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SmartphoneIcon from '@mui/icons-material/Smartphone';
import DesktopWindowsIcon from '@mui/icons-material/DesktopWindows';
import QuestionnaireRunner from '../QuestionnaireRunner/QuestionnaireRunner';
import type { Questionnaire } from '../../questionnaire/types';

const PreviewDialog: FC<{ open: boolean; questionnaire: Questionnaire; onClose: () => void }> = ({ open, questionnaire, onClose }) => {
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  return (
    <Dialog fullScreen open={open} onClose={onClose} aria-labelledby="preview-title">
      <AppBar position="sticky" color="default" elevation={1}>
        <Toolbar sx={{ gap: 2 }}>
          <IconButton edge="start" onClick={onClose} aria-label="Chiudi anteprima"><CloseIcon /></IconButton>
          <Typography id="preview-title" variant="h6" sx={{ flex: 1 }}>Anteprima — le risposte non vengono salvate</Typography>
          <ToggleButtonGroup exclusive size="small" value={device} onChange={(_, v) => v && setDevice(v)} aria-label="Dispositivo">
            <ToggleButton value="desktop" aria-label="Desktop"><DesktopWindowsIcon fontSize="small" /></ToggleButton>
            <ToggleButton value="mobile" aria-label="Smartphone"><SmartphoneIcon fontSize="small" /></ToggleButton>
          </ToggleButtonGroup>
        </Toolbar>
      </AppBar>
      <Box sx={{ bgcolor: 'grey.100', minHeight: '100%', py: 3, px: 1 }}>
        <Box sx={{
          mx: 'auto', bgcolor: 'background.default', p: device === 'mobile' ? 1.5 : 3,
          width: device === 'mobile' ? 390 : '100%', maxWidth: device === 'mobile' ? '100%' : 900,
          borderRadius: device === 'mobile' ? 4 : 2, border: device === 'mobile' ? 8 : 0, borderColor: 'grey.800',
          minHeight: device === 'mobile' ? 760 : undefined, overflow: 'auto',
        }}>
          {open && <QuestionnaireRunner key={`${device}-${questionnaire.version}`} questionnaire={questionnaire} />}
        </Box>
      </Box>
    </Dialog>
  );
};

export default PreviewDialog;

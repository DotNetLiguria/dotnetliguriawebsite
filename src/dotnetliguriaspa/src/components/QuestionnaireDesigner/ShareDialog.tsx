import React, { FC, useRef, useState } from 'react';
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, InputAdornment, Stack, TextField, Tooltip, Typography,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DownloadIcon from '@mui/icons-material/Download';
import { QRCodeCanvas, QRCodeSVG } from 'qrcode.react';
import { publicQuestionnaireUrl } from '../../questionnaire/api';
import type { Questionnaire } from '../../questionnaire/types';

function download(href: string, filename: string) {
  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

const LinkField: FC<{ label: string; url: string }> = ({ label, url }) => {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return (
    <TextField size="small" fullWidth label={label} value={url}
      slotProps={{
        htmlInput: { readOnly: true },
        input: {
          endAdornment: (
            <InputAdornment position="end">
              <Tooltip title={copied ? 'Copiato!' : 'Copia'}>
                <IconButton aria-label={`Copia ${label.toLowerCase()}`} onClick={copy} size="small"><ContentCopyIcon fontSize="small" /></IconButton>
              </Tooltip>
            </InputAdornment>
          ),
        },
      }} />
  );
};

const ShareDialog: FC<{ open: boolean; questionnaire: Questionnaire; onClose: () => void }> = ({ open, questionnaire, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const url = publicQuestionnaireUrl(questionnaire.questionnaireId);
  const workshopUrl = questionnaire.workshopId ? `${window.location.origin}/feedback/${questionnaire.workshopId}` : null;
  const name = `questionario-${questionnaire.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || questionnaire.questionnaireId}`;

  const downloadPng = () => {
    const canvas = canvasRef.current;
    if (canvas) download(canvas.toDataURL('image/png'), `${name}.png`);
  };
  const downloadSvg = () => {
    const svg = svgRef.current;
    if (!svg) return;
    const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' });
    const href = URL.createObjectURL(blob);
    download(href, `${name}.svg`);
    URL.revokeObjectURL(href);
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" aria-labelledby="share-title">
      <DialogTitle id="share-title">Condividi il questionario</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          {questionnaire.status !== 'Published' && (
            <Alert severity="info">Il link funziona solo quando il questionario è pubblicato.</Alert>
          )}
          <LinkField label="Link pubblico" url={url} />
          {workshopUrl && <LinkField label="Link dell'evento" url={workshopUrl} />}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} sx={{ alignItems: 'center' }}>
            <Box sx={{ p: 2, bgcolor: '#fff', border: 1, borderColor: 'divider', borderRadius: 2 }}>
              <QRCodeCanvas ref={canvasRef} value={url} size={220} marginSize={2} level="M" title="QR code del questionario" />
              <Box sx={{ display: 'none' }}><QRCodeSVG ref={svgRef} value={url} size={1024} marginSize={2} level="M" /></Box>
            </Box>
            <Stack spacing={1}>
              <Typography variant="body2" color="text.secondary">
                Proietta o stampa il QR code durante l'evento: i partecipanti aprono il questionario direttamente dallo smartphone.
              </Typography>
              <Button startIcon={<DownloadIcon />} variant="outlined" onClick={downloadPng}>Scarica PNG</Button>
              <Button startIcon={<DownloadIcon />} variant="outlined" onClick={downloadSvg}>Scarica SVG (stampa)</Button>
            </Stack>
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions><Button onClick={onClose}>Chiudi</Button></DialogActions>
    </Dialog>
  );
};

export default ShareDialog;

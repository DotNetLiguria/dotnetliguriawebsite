import React, { FC, useRef, useState } from 'react';
import { Button, Input, Label, TextField } from 'react-aria-components';
import { QRCodeCanvas, QRCodeSVG } from 'qrcode.react';
import { AdminIcon } from '../../admin/icons';
import { btn } from '../../admin/ui';
import { ExternalLink, ModalHeader, RecordModal, inputCls } from '../../admin/pages/listUi';
import { Callout, Icon, labelCls } from './designerUi';
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
    <div>
      <TextField isReadOnly value={url} className="block">
        <Label className={labelCls}>{label}</Label>
        <div className="mt-1.5 flex gap-2">
          <Input onFocus={event => event.currentTarget.select()} className={`${inputCls} min-w-0 flex-1`} />
          <Button aria-label={`Copia ${label.toLowerCase()}`} onPress={() => void copy()} className={btn.secondary}>
            <Icon name="copy" />{copied ? 'Copiato' : 'Copia'}
          </Button>
        </div>
      </TextField>
      <p role="status" className="sr-only">{copied ? `${label} copiato negli appunti.` : ''}</p>
    </div>
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
    <RecordModal isOpen={open} onOpenChange={isOpen => { if (!isOpen) onClose(); }} label="Condividi il questionario">
      <ModalHeader title="Condividi il questionario" />
      <div className="space-y-5 p-5 sm:p-6">
        {questionnaire.status !== 'Published' && (
          <Callout tone="info" icon={<AdminIcon name="todo" />}>Il link funziona solo quando il questionario è pubblicato.</Callout>
        )}
        <LinkField label="Link pubblico" url={url} />
        {workshopUrl && <LinkField label="Link dell'evento" url={workshopUrl} />}
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
          <div className="shrink-0 rounded-2xl border border-line bg-white p-3">
            <QRCodeCanvas ref={canvasRef} value={url} size={200} marginSize={2} level="M" role="img" aria-label="QR code del questionario" className="size-[200px]" />
            <div className="hidden" aria-hidden="true"><QRCodeSVG ref={svgRef} value={url} size={1024} marginSize={2} level="M" /></div>
          </div>
          <div className="min-w-0 space-y-3">
            <p className="leading-relaxed text-muted">
              Proietta o stampa il QR code durante l'evento: i partecipanti aprono il questionario direttamente dallo smartphone.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button onPress={downloadPng} className={btn.secondary}><AdminIcon name="download" />Scarica PNG</Button>
              <Button onPress={downloadSvg} className={btn.secondary}><AdminIcon name="download" />Scarica SVG (stampa)</Button>
            </div>
            {questionnaire.status === 'Published' && <ExternalLink href={url}>Apri il questionario</ExternalLink>}
          </div>
        </div>
      </div>
    </RecordModal>
  );
};

export default ShareDialog;

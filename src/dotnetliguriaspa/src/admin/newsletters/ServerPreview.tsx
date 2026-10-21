import React, { useEffect, useState } from 'react';
import DOMPurify from 'dompurify';
import type { RenderedPreview } from './types';
import { Panel } from '../ui';

const csp = "default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-src 'none'";

/** Inline raster data survives the opaque sandbox origin; remote resources remain forbidden. */
export function createPreviewDocument(preview: RenderedPreview): { html: string; dispose: () => void } {
    const images = new Map<string, string>();
    for (const image of preview.images) {
      if (!['image/png', 'image/jpeg'].includes(image.contentType) || images.has(image.cid)) continue;
      const bytes = atob(image.base64);
      images.set(image.cid.replace(/^<|>$/g, ''), `data:${image.contentType};base64,${btoa(bytes)}`);
    }
    const html = DOMPurify.sanitize(preview.html, {
      WHOLE_DOCUMENT: false,
      FORBID_TAGS: ['style', 'script', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'video', 'audio', 'source', 'svg', 'math', 'link', 'meta', 'base'],
      FORBID_ATTR: ['srcset', 'background', 'poster', 'ping'],
      ALLOW_DATA_ATTR: false,
    });
    const document = new DOMParser().parseFromString(html, 'text/html');
    for (const element of document.body.querySelectorAll('*')) {
      // Inline email layout is preserved, but CSS URL loads are removed as defense in depth.
      if (/url\s*\(|@import|expression\s*\(/i.test(element.getAttribute('style') ?? '')) element.removeAttribute('style');
      if (element.tagName === 'IMG') {
        const source = element.getAttribute('src') ?? '';
        const url = source.startsWith('cid:') ? images.get(source.slice(4).replace(/^<|>$/g, '')) : undefined;
        if (url) element.setAttribute('src', url);
        else if (source.startsWith('cid:')) throw new Error('Missing preview image');
        else element.removeAttribute('src');
      } else {
        element.removeAttribute('src');
      }
      if (element.tagName === 'A') {
        const href = element.getAttribute('href') ?? '';
        if (!/^(https?:\/\/|mailto:)/i.test(href)) element.removeAttribute('href');
        element.setAttribute('target', '_blank');
        element.setAttribute('rel', 'noopener noreferrer');
      } else {
        element.removeAttribute('href');
      }
    }
    return {
      html: `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><meta name="referrer" content="no-referrer"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>${document.body.innerHTML}</body></html>`,
      dispose: () => {},
    };
}

export default function ServerPreview({ preview, onValidityChange }: { preview: RenderedPreview; onValidityChange?: (valid: boolean) => void }) {
  const [document, setDocument] = useState<{ source: RenderedPreview; html: string } | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    try {
      const rendered = createPreviewDocument(preview);
      setDocument({ source: preview, html: rendered.html });
      setFailed(false);
      onValidityChange?.(true);
      return rendered.dispose;
    } catch {
      setDocument(null);
      setFailed(true);
      onValidityChange?.(false);
    }
  }, [preview, onValidityChange]);
  return <Panel className="space-y-3 p-4" labelledBy="newsletter-preview-heading">
    <h2 id="newsletter-preview-heading" className="text-xl font-bold">Anteprima del server</h2>
    <p><strong>Oggetto:</strong> {preview.subject}</p>
    <p className="text-sm text-muted">Contenuto isolato, senza risorse esterne. Verifica anche il messaggio di prova nel tuo client email.</p>
    {preview.warnings.length > 0 && <ul aria-label="Avvisi dell’anteprima" className="list-disc pl-5">{preview.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>}
    {failed && <p role="alert">Impossibile visualizzare le immagini dell’anteprima. Genera una nuova anteprima prima di proseguire.</p>}
    {document?.source === preview && <iframe title="Anteprima email isolata" sandbox="allow-popups allow-popups-to-escape-sandbox" referrerPolicy="no-referrer" srcDoc={document.html} className="h-[36rem] w-full rounded-xl border border-line bg-white" />}
    <details><summary className="min-h-11 cursor-pointer font-semibold">Versione testo semplice</summary><pre className="whitespace-pre-wrap break-words p-3 text-sm">{preview.plainText}</pre></details>
  </Panel>;
}

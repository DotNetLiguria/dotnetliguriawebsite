import React, { useEffect, useId, useRef, useState } from 'react';
import { Button } from 'react-aria-components';
import { useAccountRequest } from './accountApi';
import { btn, focusRing } from '../admin/ui';
import { profilePhotoUrl } from '../site/speakerPhotos';

export type PhotoStatus = {
  version: string;
  source: 'legacy' | 'account' | 'asset' | 'none';
  url: string | null;
  previewPath: string | null;
  hasAccount: boolean;
  candidates: { key: string; version: string; label: string; url: string | null; previewPath: string | null }[];
  affectedBoards: string[];
};

export function photoFileError(file: File) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return 'Scegli un file JPEG, PNG o WebP.';
  if (!file.size || file.size > 5 * 1024 * 1024) return 'La foto deve avere una dimensione maggiore di zero e non superiore a 5 MiB.';
  return '';
}

function apiPath(path: string) {
  // Authenticated previews must never send a bearer token to an external origin.
  if (!/^\/?(?:api\/)?photos\//.test(path)) throw new Error('Percorso anteprima non valido.');
  return path.replace(/^\/?(?:api\/)?/, '');
}

function PhotoPreview({ url, previewPath, label = 'Foto attuale' }: { url: string | null; previewPath: string | null; label?: string }) {
  const request = useAccountRequest();
  const [preview, setPreview] = useState<{ path: string; url: string } | null>(null);
  const [failedPath, setFailedPath] = useState('');
  const [failedUrl, setFailedUrl] = useState('');
  useEffect(() => {
    if (!previewPath) return;
    const controller = new AbortController();
    let active = true;
    let objectUrl: string | undefined;
    void (async () => {
      try {
        const response = await request(apiPath(previewPath), { signal: controller.signal });
        objectUrl = URL.createObjectURL(await response.blob());
        if (active) setPreview({ path: previewPath, url: objectUrl });
        else URL.revokeObjectURL(objectUrl);
      } catch { if (active) setFailedPath(previewPath); }
    })();
    return () => { active = false; controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [request, previewPath]);
  const src = previewPath ? preview?.path === previewPath ? preview.url : null : profilePhotoUrl(url);
  const failed = !!(failedPath && failedPath === previewPath) || !!(src && failedUrl === src);
  return <>
    {src && !failed ? <img key={src} src={src} alt={label} className="size-40 rounded-xl object-cover" onError={() => setFailedUrl(src)} />
      : <p>{failed ? 'Anteprima non disponibile.' : previewPath ? 'Caricamento anteprima…' : 'Nessuna foto.'}</p>}
  </>;
}

/** Photo mutations are independent of the enclosing profile form and take effect immediately. */
export default function PhotoEditor({ scope, id, onChanged }: {
  scope: 'account' | 'board' | 'speaker';
  id?: string;
  onChanged?: () => void;
}) {
  const request = useAccountRequest();
  const inputId = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const endpoint = `photos/${scope}${scope === 'account' ? '' : `/${encodeURIComponent(id ?? '')}`}`;
  const [status, setStatus] = useState<PhotoStatus | null>(null);
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState({ width: 1, height: 1 });
  const [crop, setCrop] = useState({ x: .5, y: .5, size: 1 });
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    void request(endpoint, { signal: controller.signal }).then(response => response.json()).then((data: PhotoStatus) => {
      if (!data || !Array.isArray(data.candidates) || typeof data.version !== 'string') throw new Error('Stato foto non valido.');
      if (active) { setStatus(data); setError(''); }
    }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'Foto non disponibile.'); });
    return () => { active = false; controller.abort(); };
  }, [request, endpoint, revision]);
  useEffect(() => {
    if (!file) { setLocalPreview(null); return; }
    const url = URL.createObjectURL(file);
    setLocalPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const mutate = async (action: 'select' | 'upload', body: BodyInit) => {
    if (!status || busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await request(`${endpoint}/${action}`, {
        method: 'POST', body,
        ...(action === 'select' ? { headers: { 'Content-Type': 'application/json' } } : {}),
      });
      const updated = await response.json() as PhotoStatus;
      if (!updated || !Array.isArray(updated.candidates) || typeof updated.version !== 'string') throw new Error('Salvataggio foto non verificato.');
      setStatus(updated);
      setFile(null); setConfirmRemove(false); setAcknowledged(false);
      setMessage('Foto aggiornata. La modifica è già effettiva, separatamente da Salva profilo.');
      onChanged?.();
    } catch (reason) {
      setError(`${reason instanceof Error ? reason.message : 'Modifica non completata.'} Ricarica lo stato della foto prima di riprovare.`);
      setStatus(null);
    } finally { setBusy(false); }
  };
  const select = (source: 'account' | 'existing' | 'none', existingKey?: string, confirmed = false, existingVersion?: string) => {
    if (!status) return;
    void mutate('select', JSON.stringify({ version: status.version, source, ...(existingKey ? { existingKey, existingVersion } : {}), confirmUnpublish: confirmed }));
  };
  const upload = () => {
    if (!file || !status) return;
    const body = new FormData();
    body.set('file', file); body.set('version', status.version);
    body.set('cropX', String(crop.x)); body.set('cropY', String(crop.y)); body.set('cropSize', String(crop.size));
    void mutate('upload', body);
  };
  const side = Math.min(dimensions.width, dimensions.height) * crop.size;
  return <section aria-label="Gestione foto" className="space-y-3 rounded-xl border border-line p-4">
    <h3 className="text-lg font-bold">Foto {scope === 'account' ? 'account' : scope === 'board' ? 'Board' : 'speaker'}</h3>
    <p className="text-sm">{scope === 'account'
      ? 'La foto account è privata; diventa pubblica solo nei profili che scelgono di seguirla. Cambiarla aggiorna subito i profili che la seguono. Le copie fisse restano indipendenti.'
      : 'Caricamento e scelta della fonte modificano subito solo questa scheda, non la foto account né gli altri profili. Non serve salvare il profilo per confermare la foto.'}</p>
    {error && <p role="alert">{error}</p>}
    {message && <p role="status">{message}</p>}
    {!status && !error && <p role="status">Caricamento foto…</p>}
    <Button type="button" className={btn.secondary} isDisabled={busy} onPress={() => {
      setStatus(null); setMessage(''); setConfirmRemove(false); setAcknowledged(false); setRevision(value => value + 1);
    }}>Ricarica stato foto</Button>
    {status && <>
      <PhotoPreview key={status.version} url={status.url} previewPath={status.previewPath} />
      <p className="text-sm">Fonte attuale: {({ legacy: 'percorso storico', account: 'segue la foto account', asset: 'copia fissa indipendente', none: 'nessuna foto' })[status.source]}.</p>
      {scope !== 'account' && status.hasAccount && <Button type="button" className={btn.secondary}
        isDisabled={busy || status.source === 'account' || !status.candidates.some(candidate => /^account(?::|$)/.test(candidate.key))}
        onPress={() => select('account')}>Segui la foto account</Button>}
      {scope !== 'account' && status.hasAccount && !status.candidates.some(candidate => /^account(?::|$)/.test(candidate.key)) &&
        <p className="text-sm text-muted">Nessuna foto account disponibile da seguire.</p>}
      {!!status.candidates.length && <fieldset disabled={busy} className="space-y-2">
        <legend className="font-semibold">Usa una foto esistente come copia fissa</legend>
        <p className="text-sm">Le modifiche future alla fonte non cambieranno questa copia.</p>
        {status.candidates.map(candidate => <div key={`${candidate.key}:${candidate.version}`} className="space-y-2">
          <PhotoPreview url={candidate.url} previewPath={candidate.previewPath} label={`Anteprima ${candidate.label}`} />
          <Button type="button" className={btn.secondary}
            onPress={() => select('existing', candidate.key, false, candidate.version)}>Copia {candidate.label}</Button>
        </div>)}
      </fieldset>}
      <fieldset disabled={busy} className="space-y-3">
        <legend className="font-semibold">Carica una foto</legend>
        <label htmlFor={inputId} className="block">File JPEG, PNG o WebP · massimo 5 MiB</label>
        <input ref={fileInput} id={inputId} type="file" accept="image/jpeg,image/png,image/webp" className={`min-h-11 max-w-full ${focusRing}`}
          onChange={event => {
            const chosen = event.target.files?.[0];
            setFile(null); setError(''); setDimensions({ width: 1, height: 1 }); setCrop({ x: .5, y: .5, size: 1 });
            if (chosen) {
              const invalid = photoFileError(chosen);
              if (invalid) setError(invalid); else setFile(chosen);
            }
            event.target.value = '';
          }} />
        {file && localPreview && <>
          <div className="relative aspect-square w-56 max-w-full overflow-hidden rounded-xl bg-cyan-50" aria-label="Anteprima ritaglio quadrato">
            <img src={localPreview} alt="Anteprima del ritaglio" onLoad={event => setDimensions({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
              onError={() => { setError('Il file non è un’immagine leggibile.'); setFile(null); }}
              className="absolute max-w-none" style={{
                width: `${dimensions.width / side * 100}%`, height: `${dimensions.height / side * 100}%`,
                left: `${-(dimensions.width - side) * crop.x / side * 100}%`, top: `${-(dimensions.height - side) * crop.y / side * 100}%`,
              }} />
          </div>
          {(['x', 'y', 'size'] as const).map(key => <label key={key} className="block">
            {key === 'x' ? 'Posizione orizzontale' : key === 'y' ? 'Posizione verticale' : 'Dimensione ritaglio'}: {Math.round(crop[key] * 100)}%
            <input type="range" min={key === 'size' ? .1 : 0} max={1} step={.01} value={crop[key]}
              className={`block min-h-11 w-full ${focusRing}`} onChange={event => setCrop(current => ({ ...current, [key]: Number(event.target.value) }))} />
          </label>)}
          <Button type="button" className={btn.primary} isDisabled={busy} onPress={upload}>Carica e applica foto</Button>
          <Button type="button" className={btn.ghost} isDisabled={busy} onPress={() => {
            setFile(null); setError(''); setCrop({ x: .5, y: .5, size: 1 }); setDimensions({ width: 1, height: 1 });
            fileInput.current?.focus();
          }}>Annulla selezione foto</Button>
        </>}
      </fieldset>
      {busy && <div role="status"><progress aria-label="Invio foto in corso" /> Invio in corso. Attendi la conferma del server.</div>}
      <Button type="button" className={btn.danger} isDisabled={busy || status.source === 'none'} onPress={() => {
        if (scope === 'account' || (scope === 'board' && status.affectedBoards.length > 0)) {
          setConfirmRemove(true); setAcknowledged(false);
        } else select('none');
      }}>Rimuovi foto {scope === 'account' ? 'account' : 'da questa scheda'}</Button>
      {confirmRemove && <div role="alert" className="space-y-3 rounded-xl border border-line p-4">
        <p>{scope === 'account' ? 'Rimuovere la foto account? Le copie fisse restano invariate.'
          : 'Rimuovere la foto da questa scheda Board? La scheda verrà nascosta dal sito. La foto account e gli altri profili restano invariati.'}</p>
        {status.affectedBoards.length ? <>
          <p>{scope === 'account' ? 'Queste schede Board seguono la foto account e verranno nascoste dal sito:'
            : 'Queste schede Board verranno nascoste dal sito:'}</p>
          <ul>{status.affectedBoards.map((name, index) => <li key={`${name}:${index}`}>{name}</li>)}</ul>
          <label className="flex min-h-11 items-center gap-3"><input type="checkbox" checked={acknowledged}
            onChange={event => setAcknowledged(event.target.checked)} />Confermo di nascondere queste schede Board.</label>
        </> : <p>Nessuna scheda Board verrà nascosta.</p>}
        <Button type="button" className={btn.ghost} isDisabled={busy} onPress={() => setConfirmRemove(false)}>Annulla rimozione foto</Button>
        <Button type="button" className={btn.danger} isDisabled={busy || (!!status.affectedBoards.length && !acknowledged)}
          onPress={() => select('none', undefined, !!status.affectedBoards.length)}>Conferma rimozione foto {scope === 'account' ? 'account' : 'Board'}</Button>
      </div>}
    </>}
  </section>;
}

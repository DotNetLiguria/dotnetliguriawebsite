import { useCallback, useEffect, useRef, useState } from 'react';
import { useDesignerStore } from './designerStore';
import { QuestionnaireApiError } from '../../questionnaire/api';
import type { Questionnaire } from '../../questionnaire/types';

export type SaveStatus =
  | { kind: 'saved' }
  | { kind: 'pending' }
  | { kind: 'saving' }
  | { kind: 'blocked'; message: string }
  | { kind: 'error'; message: string }
  | { kind: 'conflict'; message: string };

export interface AutosaveOptions {
  save: (questionnaire: Questionnaire) => Promise<Questionnaire>;
  /** Returns a message when the current state must not be saved yet. */
  blockedReason?: (questionnaire: Questionnaire) => string | null;
  delayMs?: number;
}

export function useAutosave({ save, blockedReason, delayMs = 1200 }: AutosaveOptions) {
  const questionnaire = useDesignerStore(s => s.questionnaire);
  const revision = useDesignerStore(s => s.revision);
  const [savedRevision, setSavedRevision] = useState(0);
  const [status, setStatus] = useState<SaveStatus>({ kind: 'saved' });
  const saving = useRef<Promise<boolean> | null>(null);
  const savedRef = useRef(0);

  const saveNow = useCallback(async (): Promise<boolean> => {
    if (saving.current) await saving.current;
    const state = useDesignerStore.getState();
    const current = state.questionnaire;
    if (!current || state.revision === savedRef.current) return true;
    const blocked = blockedReason?.(current);
    if (blocked) {
      setStatus({ kind: 'blocked', message: blocked });
      return false;
    }
    const sentRevision = state.revision;
    setStatus({ kind: 'saving' });
    const run = (async () => {
      try {
        const saved = await save(current);
        useDesignerStore.getState().acknowledgeSave(saved);
        savedRef.current = sentRevision;
        setSavedRevision(sentRevision);
        setStatus(useDesignerStore.getState().revision === sentRevision ? { kind: 'saved' } : { kind: 'pending' });
        return true;
      } catch (err) {
        if (err instanceof QuestionnaireApiError && err.status === 409) setStatus({ kind: 'conflict', message: err.message });
        else setStatus({ kind: 'error', message: err instanceof Error ? err.message : 'Salvataggio non riuscito.' });
        return false;
      } finally {
        saving.current = null;
      }
    })();
    saving.current = run;
    return run;
  }, [save, blockedReason]);

  useEffect(() => {
    if (!questionnaire || revision === savedRevision || status.kind === 'conflict') return;
    if (status.kind !== 'saving') setStatus({ kind: 'pending' });
    const timer = setTimeout(() => { void saveNow(); }, delayMs);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revision, savedRevision]);

  useEffect(() => {
    const dirty = revision !== savedRevision;
    const handler = (e: BeforeUnloadEvent) => { if (dirty) e.preventDefault(); };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [revision, savedRevision]);

  const reset = useCallback(() => {
    savedRef.current = 0;
    setSavedRevision(0);
    setStatus({ kind: 'saved' });
  }, []);

  return { status, saveNow, dirty: revision !== savedRevision, reset };
}

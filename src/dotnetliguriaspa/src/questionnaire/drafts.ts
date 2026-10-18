import type { AnswerMap } from './types';

const LIFETIME = 30 * 60 * 1000;

export function loadDraft(key?: string, owner = 'anonymous'): AnswerMap {
  if (!key) return {};
  try {
    localStorage.removeItem(key);
    const raw = sessionStorage.getItem(key);
    if (!raw) return {};
    const draft = JSON.parse(raw);
    if (draft?.version !== 1 || (draft.owner ?? 'anonymous') !== owner ||
        !Number.isFinite(draft.expiresAt) || draft.expiresAt <= Date.now() ||
        draft.expiresAt > Date.now() + LIFETIME || !draft.answers || typeof draft.answers !== 'object' ||
        Array.isArray(draft.answers)) {
      sessionStorage.removeItem(key);
      return {};
    }
    return draft.answers;
  } catch {
    console.warn('Impossibile recuperare la bozza temporanea del questionario.');
    return {};
  }
}

export function saveDraft(key: string, answers: AnswerMap, owner = 'anonymous') {
  try {
    sessionStorage.setItem(key, JSON.stringify({ version: 1, owner, expiresAt: Date.now() + LIFETIME, answers }));
  } catch {
    console.warn('Bozza non salvata: memoria temporanea del browser non disponibile.');
  }
}

export function discardDraft(key: string) {
  try {
    sessionStorage.removeItem(key);
    localStorage.removeItem(key);
  } catch {
    console.warn('Impossibile cancellare la bozza dal browser.');
  }
}

export function clearPrivateBrowserState(includeSession = true) {
  try {
    localStorage.removeItem('ACCESS_TOKEN');
    localStorage.removeItem('profileStore');
    for (const storage of includeSession ? [localStorage, sessionStorage] : [localStorage]) {
      for (let i = storage.length - 1; i >= 0; i--) {
        const key = storage.key(i);
        if (key?.startsWith('questionnaire-draft:')) storage.removeItem(key);
      }
    }
  } catch {
    console.warn('Impossibile cancellare lo stato privato del browser.');
  }
}

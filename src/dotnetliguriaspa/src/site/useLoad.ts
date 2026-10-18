import { useCallback, useEffect, useState } from 'react';
import { isAbortError } from './siteApi';

export type Load<T> = { state: 'loading' } | { state: 'ready'; data: T } | { state: 'error'; message: string };

/** Runs an abortable request, restarting when `key` changes; `retry` runs it again. */
export function useLoad<T>(loader: (signal: AbortSignal) => Promise<T>, key: unknown = 0) {
  const [result, setResult] = useState<Load<T>>({ state: 'loading' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setResult({ state: 'loading' });
    loader(controller.signal)
      .then(data => setResult({ state: 'ready', data }))
      .catch(error => {
        if (isAbortError(error)) return;
        console.error('Request failed.');
        setResult({ state: 'error', message: error instanceof Error ? error.message : 'Errore di rete' });
      });
    return () => controller.abort();
    // The loader closes over `key`; key and attempt are the restart triggers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt]);
  const retry = useCallback(() => setAttempt(n => n + 1), []);
  return [result, retry] as const;
}

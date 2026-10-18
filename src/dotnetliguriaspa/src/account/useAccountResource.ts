import { useCallback, useEffect, useState } from 'react';
import { useAccountRequest } from './accountApi';

/** In-memory, caller-scoped resource. Abort also prevents old account results from being rendered. */
export function useAccountResource<T>(path: string, enabled = true) {
  const request = useAccountRequest();
  const [attempt, setAttempt] = useState(0);
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(enabled);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    request(path, { signal: controller.signal })
      .then(response => response.json() as Promise<T>)
      .then(value => { if (!controller.signal.aborted) { setData(value); setError(''); setLoading(false); } })
      .catch(reason => {
        if (!controller.signal.aborted) {
          setError(reason instanceof Error ? reason.message : 'Dati non disponibili.');
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [request, path, attempt, enabled]);
  const reload = useCallback(() => { setLoading(true); setError(''); setAttempt(value => value + 1); }, []);
  return { data, setData, error, loading, reload };
}

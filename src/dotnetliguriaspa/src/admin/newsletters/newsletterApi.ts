import { useCallback } from 'react';
import { useOidcFetch } from '@axa-fr/react-oidc';
import { API_BASE_URL } from '../../config/apiConfig';
import { permissionsDenied } from '../../account/permissions';
import { AdminApiError } from '../adminApi';

/** Multipart and MIME must bypass the JSON helper's Content-Type handling. */
export function useNewsletterBinary() {
  const { fetch } = useOidcFetch();
  return useCallback(async (path: string, init: RequestInit = {}) => {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      cache: 'no-store',
      headers: { 'X-Admin-Request': 'true', ...init.headers },
    });
    if (!response.ok) {
      let code = '';
      let detail = '';
      try {
        const problem = await response.json();
        code = problem.code ?? problem.title ?? '';
        detail = typeof problem.detail === 'string' ? problem.detail : '';
      } catch { /* Proxies can return non-JSON errors. */ }
      if (response.status === 403) permissionsDenied();
      throw new AdminApiError(response.status, undefined, code, detail);
    }
    return response;
  }, [fetch]);
}

export function newsletterError(error: unknown): string {
  if (error instanceof AdminApiError) {
    if (error.status === 409) return 'Conflitto di versione o stato: le tue modifiche sono conservate. Ricarica solo dopo averle copiate, oppure clona la versione salvata.';
    return error.detail || error.code || error.message;
  }
  return error instanceof Error ? error.message : 'Operazione non riuscita. Riprova.';
}

export function isSingleMailbox(value: string): boolean {
  return /^[^\s@<>,;:]+@[^\s@<>,;:]+\.[^\s@<>,;:]+$/.test(value) && !/[\r\n]/.test(value);
}

export const jsonPost = (body: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(body) });

export async function downloadEml(response: Response, id: string) {
  const url = URL.createObjectURL(await response.blob());
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = `newsletter-${id.replace(/[^a-zA-Z0-9_-]/g, '')}-test.eml`;
    document.body.append(link);
    link.click();
    link.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}

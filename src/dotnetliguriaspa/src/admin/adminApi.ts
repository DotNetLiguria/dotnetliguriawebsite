import { useCallback, useEffect, useState } from 'react';
import { useOidcFetch } from '@axa-fr/react-oidc';
import { API_BASE_URL } from '../config/apiConfig';
import { SiteWorkshop } from '../site/siteApi';
import { photoCandidates } from '../site/speakerPhotos';
import { permissionsDenied, ResourceAuthorization } from '../account/permissions';

// Shapes used by the admin, as serialized by DotNetLiguriaCore (fields the admin does not edit are kept as-is).
export interface AdminWorkshop extends SiteWorkshop, ResourceAuthorization {
  published?: boolean;
  in_homepage?: boolean;
  feedbackEnabled?: boolean;
}

export interface AdminSpeaker {
  workshopSpeakerId: string;
  name: string;
  email?: string | null;
  description?: string | null;
  profileImageUrl?: string | null;
  isActive?: boolean;
  sessionizeId?: string | null;
  [key: string]: unknown;
}

export interface AdminVenue {
  venueId: string;
  name: string;
  address?: string | null;
}

export class AdminApiError extends Error {
  readonly status: number;

  constructor(status: number, message?: string) {
    super(message ?? `Errore HTTP: ${status}`);
    this.name = 'AdminApiError';
    this.status = status;
  }
}

/** fetch for the admin API: adds the signed-in user's token (useOidcFetch), parses JSON, throws on errors. */
export function useAdminFetch() {
  const { fetch } = useOidcFetch();
  return useCallback(async <T,>(path: string, init: RequestInit = {}): Promise<T> => {
    const headers: Record<string, string> = { Accept: 'application/json', 'X-Admin-Request': 'true', ...(init.headers as Record<string, string> | undefined) };
    if (init.body) headers['Content-Type'] = 'application/json';
    const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
    if (!response.ok) {
      let code = '';
      try {
        const problem = await response.json() as { code?: string; title?: string };
        code = problem.code ?? problem.title ?? '';
      } catch { /* Reverse proxies may return a non-JSON failure. */ }
      const mfa = code === 'recent_mfa_required' || code === 'RecentMfaRequired';
      if (response.status === 403 && !mfa) permissionsDenied();
      throw new AdminApiError(response.status, mfa ? 'È richiesta una verifica MFA recente tramite l’Identity Provider.' : undefined);
    }
    const text = response.status === 204 ? '' : await response.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }, [fetch]);
}

export type AdminLoad<T> = { state: 'loading' } | { state: 'ready'; data: T } | { state: 'error'; message: string };

/** Loads data with the admin fetch; reload() runs it again (after a save or a failed load). */
export function useAdminLoad<T>(path: string, enabled = true) {
  const api = useAdminFetch();
  const [load, setLoad] = useState<AdminLoad<T>>({ state: 'loading' });
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (!enabled) {
      setLoad({ state: 'ready', data: [] as unknown as T });
      return;
    }
    const controller = new AbortController();
    let alive = true;
    setLoad(current => (current.state === 'ready' ? current : { state: 'loading' }));
    api<T>(path, { signal: controller.signal })
      .then(data => { if (alive) setLoad({ state: 'ready', data }); })
      .catch((error: unknown) => { if (alive) setLoad({ state: 'error', message: error instanceof Error ? error.message : String(error) }); });
    return () => { alive = false; controller.abort(); };
  }, [api, path, version, enabled]);
  const reload = useCallback(() => setVersion(v => v + 1), []);
  return [load, reload] as const;
}

export const clean = (text?: string | null) => (text ?? '').replace(/\s+/g, ' ').trim();
export const nameKey = (name?: string | null) => clean(name).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Speaker names of a workshop: from the agenda talks when present, otherwise from the legacy tracks. */
export function speakerNamesOf(workshop: AdminWorkshop): string[] {
  if (workshop.talks?.length) return workshop.talks.flatMap(talk => (talk.speakers ?? []).map(s => clean(s.name))).filter(Boolean);
  return (workshop.tracks ?? []).flatMap(track => clean(track.speakersName).split(/\s*,\s*/)).filter(Boolean);
}

// Photo candidates: the same rule as the public site's SpeakerAvatar (record first, then shipped /Contents files).
export { photoCandidates };

const photoCache = new Map<string, Promise<string | null>>();

async function firstReachable(urls: string[]) {
  for (const url of urls) {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      if (response.ok && !(response.headers.get('content-type') ?? '').includes('text/html')) return url;
    } catch { /* try the next candidate */ }
  }
  return null;
}

/** Resolves each speaker's usable photo (or null) with lightweight HEAD requests, cached for the session. */
export function useSpeakerPhotos(speakers: AdminSpeaker[] | null) {
  const [photos, setPhotos] = useState<Map<string, string | null> | null>(null);
  useEffect(() => {
    if (!speakers) return;
    let alive = true;
    Promise.all(speakers.map(async speaker => {
      const key = `${speaker.workshopSpeakerId}|${speaker.profileImageUrl ?? ''}|${speaker.name}`;
      if (!photoCache.has(key)) photoCache.set(key, firstReachable(photoCandidates(speaker.name, speaker.profileImageUrl)));
      return [speaker.workshopSpeakerId, await photoCache.get(key)!] as const;
    })).then(entries => { if (alive) setPhotos(new Map(entries)); });
    return () => { alive = false; };
  }, [speakers]);
  return photos;
}

/** Test hook: forget resolved photos between tests. */
export const resetPhotoCache = () => photoCache.clear();

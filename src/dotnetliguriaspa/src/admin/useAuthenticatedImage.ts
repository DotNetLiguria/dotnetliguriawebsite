import { useEffect, useState } from 'react';
import { useOidcFetch } from '@axa-fr/react-oidc';

const PROTECTED_PATH = '/api/WorkshopFile/Download/';

/**
 * The image source to render in the admin. Event assets served by /api/WorkshopFile/Download are readable
 * anonymously only once the event is published: an <img> sends no bearer token, so these are fetched with the
 * signed-in user's token and shown through a blob URL. Any other source is returned unchanged.
 * `failed` is true when the authenticated download did not succeed.
 */
export function useAuthenticatedImage(src: string | null | undefined): { src: string | null; failed: boolean } {
  const { fetch } = useOidcFetch();
  const protectedSource = src && src.includes(PROTECTED_PATH) ? src : null;
  const [loaded, setLoaded] = useState<{ source: string; url: string } | null>(null);
  const [failedSource, setFailedSource] = useState<string | null>(null);

  useEffect(() => {
    if (!protectedSource) return;
    const controller = new AbortController();
    let active = true;
    let objectUrl: string | undefined;
    void (async () => {
      try {
        const response = await fetch(protectedSource, { signal: controller.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        objectUrl = URL.createObjectURL(await response.blob());
        if (active) setLoaded({ source: protectedSource, url: objectUrl });
        else URL.revokeObjectURL(objectUrl);
      } catch {
        if (active) setFailedSource(protectedSource);
      }
    })();
    return () => {
      active = false;
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [fetch, protectedSource]);

  if (!protectedSource) return { src: src || null, failed: false };
  return {
    src: loaded?.source === protectedSource ? loaded.url : null,
    failed: failedSource === protectedSource,
  };
}

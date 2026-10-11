import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import NotFoundPage from '../notfound/NotFoundPage';
import { getPublishedWorkshops, isAbortError } from '../siteApi';
import { looksLegacy, resolveLegacyPath, workshopByOldUrl } from './legacyRoutes';

/**
 * Fallback of the public routes: addresses of the previous site are redirected (replace, so the back
 * button keeps working), everything else is the not-found page. The published list is loaded only when
 * a legacy-looking address needs its OldUrl checked.
 */
export default function LegacyRedirect() {
  const { pathname, search } = useLocation();
  const target = resolveLegacyPath(pathname, search);
  const needsLookup = (target && 'workshopId' in target) || (!target && looksLegacy(pathname));
  const [lookup, setLookup] = useState<{ for: string; to: string | null } | null>(null);
  const key = `${pathname}${search}`;

  useEffect(() => {
    if (!needsLookup) return undefined;
    const controller = new AbortController();
    getPublishedWorkshops(controller.signal)
      .then(workshops => {
        const id = workshopByOldUrl(workshops, pathname, search)
          ?? (target && 'workshopId' in target
            ? workshops.find(w => w.workshopId.toLowerCase() === target.workshopId)?.workshopId ?? null
            : null);
        setLookup({ for: key, to: id ? `/workshop/${id}` : null });
      })
      .catch(error => {
        if (!isAbortError(error)) setLookup({ for: key, to: null });
      });
    return () => controller.abort();
    // target derives from pathname and search.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, needsLookup]);

  if (target && !('workshopId' in target)) return <Navigate to={target.to} replace />;
  if (!needsLookup) return <NotFoundPage />;
  if (!lookup || lookup.for !== key) return null;
  if (lookup.to) return <Navigate to={lookup.to} replace />;
  // Nothing in OldUrl: the direct equivalent still lets the event page say whether the id exists.
  return target ? <Navigate to={target.to} replace /> : <NotFoundPage />;
}

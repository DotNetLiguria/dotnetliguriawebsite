import { SiteWorkshop } from '../siteApi';

// Addresses of the previous dotnetliguria.net (ASP.NET MVC) that search engines and old links still use.
// Paths and query names are matched regardless of case.

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type LegacyTarget =
  /** Static address: go there straight away. */
  | { to: string }
  /** Old event page: the published list may map its id through OldUrl; `to` is the direct equivalent. */
  | { to: string; workshopId: string };

const param = (search: string, name: string) => {
  for (const [key, value] of new URLSearchParams(search)) {
    if (key.toLowerCase() === name) return value.trim();
  }
  return '';
};

/** True for paths under the old site's controllers, which deserve a lookup before the not-found page. */
export const looksLegacy = (pathname: string) => /^\/(workshops|home)(\/|$)/i.test(pathname);

/** New address of a legacy one, or null when the old site had no such page either. */
export function resolveLegacyPath(pathname: string, search: string): LegacyTarget | null {
  const path = pathname.toLowerCase().replace(/\/+$/, '') || '/';
  switch (path) {
    case '/home':
    case '/home/index':
      return { to: '/' };
    case '/home/about':
      return { to: '/#team' };
    case '/workshops':
    case '/workshops/index':
      return { to: '/workshops' };
    case '/workshops/filter': {
      const year = param(search, 'year');
      return { to: /^\d{4}$/.test(year) ? `/workshops?anno=${year}` : '/workshops' };
    }
    case '/workshops/detail': {
      const id = param(search, 'workshopid');
      return GUID.test(id) ? { to: `/workshop/${id.toLowerCase()}`, workshopId: id.toLowerCase() } : { to: '/workshops' };
    }
    default:
      return null;
  }
}

const sameAddress = (a: URL, b: URL) => a.pathname.toLowerCase() === b.pathname.toLowerCase() && a.search.toLowerCase() === b.search.toLowerCase();

/** Id of the published workshop whose OldUrl is the given legacy address, if any. */
export function workshopByOldUrl(workshops: Pick<SiteWorkshop, 'workshopId' | 'oldUrl'>[], pathname: string, search: string) {
  const current = new URL(`${pathname}${search}`, 'https://legacy.invalid');
  for (const workshop of workshops) {
    if (!workshop.oldUrl) continue;
    try {
      if (sameAddress(new URL(workshop.oldUrl, 'https://legacy.invalid'), current)) return workshop.workshopId;
    } catch {
      // Not a URL: nothing to match.
    }
  }
  return null;
}

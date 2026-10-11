// Site-wide SEO constants. The static copies in index.html, public/robots.txt and public/sitemap.xml
// (crawlers that do not run JavaScript read those) are checked against these values by seo.test.ts.

export const SITE_NAME = 'DotNetLiguria';

/** Public origin of the production site; pages themselves use the origin they are served from. */
export const SITE_ORIGIN = 'https://dotnetliguria.net';

export const DEFAULT_TITLE = 'DotNetLiguria · La community .NET della Liguria';

export const DEFAULT_DESCRIPTION =
  'DotNetLiguria è la community .NET della Liguria: dal 2011 eventi e workshop tecnici per sviluppatori a La Spezia, Genova e Imperia. Prossimo incontro, archivio dei talk e materiali.';

/** Square logo used for link previews when a page has no image of its own. */
export const DEFAULT_IMAGE_PATH = '/logo512.png';

/** Public routes that exist regardless of backend data (the legal pages are static too). */
export const STATIC_ROUTES = ['/', '/workshops', '/privacy', '/termini-di-servizio', '/cookie'];

/**
 * Removes the metadata index.html ships for crawlers without JavaScript (tags marked data-fallback).
 * Called once at bootstrap: from then on each page renders its own title, description and Open Graph tags
 * (React 19 hoists them into <head>), so no route ends up with two descriptions.
 */
export function dropFallbackMetadata(doc: Document = document) {
  doc.head.querySelectorAll('[data-fallback]').forEach(tag => tag.remove());
}

/** "Titolo della pagina · DotNetLiguria"; the home keeps the site title alone. */
export const pageTitle = (title?: string) => (title ? `${title} · ${SITE_NAME}` : DEFAULT_TITLE);

/** Absolute URL of a path or URL on the given origin (Open Graph and JSON-LD require absolute URLs). */
export const absoluteUrl = (pathOrUrl: string, origin: string) => new URL(pathOrUrl, origin).href;

/** Cuts a description at a word boundary so it stays within the length search engines display. */
export function summarize(text: string, max = 155) {
  const compact = text.replace(/\s+/g, ' ').trim();
  if (compact.length <= max) return compact;
  const cut = compact.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), 40)).replace(/[\s,;:.]+$/, '')}…`;
}

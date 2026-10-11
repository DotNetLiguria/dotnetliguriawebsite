import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_DESCRIPTION, DEFAULT_IMAGE_PATH, DEFAULT_TITLE, SITE_ORIGIN, STATIC_ROUTES, dropFallbackMetadata, pageTitle, summarize } from './seo';

// Resolved by hand: Vite rewrites `new URL(…, import.meta.url)` into served-asset addresses.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (relative: string) => readFileSync(resolve(root, relative), 'utf8');
const attribute = (tag: string, name: string) => tag.match(new RegExp(`${name}="([^"]*)"`))?.[1];

describe('static SEO files', () => {
  const html = read('index.html');
  const metaTags = [...html.matchAll(/<meta [^>]*>/g)].map(match => match[0]);

  test('index.html is Italian, self-hosts its font and carries the fallback metadata of the home', () => {
    expect(html).toContain('<html lang="it">');
    expect(html).not.toMatch(/fonts\.googleapis\.com|fonts\.gstatic\.com/);
    expect(html).toContain(`<title>${DEFAULT_TITLE}</title>`);
    const description = metaTags.find(tag => tag.includes('name="description"'))!;
    expect(attribute(description, 'content')).toBe(DEFAULT_DESCRIPTION);
    expect(html).toMatch(/<noscript>[^<]*JavaScript[^<]*<\/noscript>/);
    expect(html).not.toContain('og:url');
  });

  test('every fallback tag is marked, so pages can replace it without leaving duplicates', () => {
    const fallbacks = metaTags.filter(tag => /name="(description|robots|twitter:)|property="og:/.test(tag));
    expect(fallbacks.length).toBeGreaterThanOrEqual(8);
    for (const tag of fallbacks) expect(tag).toContain('data-fallback');
    expect(metaTags.filter(tag => tag.includes('name="description"'))).toHaveLength(1);
  });

  test('the Open Graph image is an absolute URL of the production site to a shipped file', () => {
    const image = attribute(metaTags.find(tag => tag.includes('og:image"'))!, 'content')!;
    expect(image).toBe(`${SITE_ORIGIN}${DEFAULT_IMAGE_PATH}`);
    expect(existsSync(resolve(root, `public${DEFAULT_IMAGE_PATH}`))).toBe(true);
  });

  test('robots.txt allows the public site, blocks the admin and the OIDC callbacks and points to the sitemap', () => {
    const robots = read('public/robots.txt');
    expect(robots).toMatch(/^User-agent: \*$/m);
    expect(robots).toMatch(/^Allow: \/$/m);
    expect(robots).toMatch(/^Disallow: \/admin$/m);
    expect(robots).toMatch(/^Disallow: \/authentication$/m);
    expect(robots).toMatch(new RegExp(`^Sitemap: ${SITE_ORIGIN}/sitemap.xml$`, 'm'));
  });

  test('sitemap.xml lists the static public routes on the production origin only', () => {
    const sitemap = read('public/sitemap.xml');
    const locations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
    expect(locations).toEqual(STATIC_ROUTES.map(route => `${SITE_ORIGIN}${route}`));
    expect(sitemap).toContain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
  });
});

describe('seo helpers', () => {
  test('drops only the marked fallback tags', () => {
    document.head.innerHTML = '<meta name="description" content="statica" data-fallback><meta property="og:type" content="website" data-fallback><meta name="viewport" content="width=device-width">';
    dropFallbackMetadata();
    expect(document.head.querySelectorAll('meta')).toHaveLength(1);
    expect(document.head.querySelector('meta[name="viewport"]')).not.toBeNull();
    document.head.innerHTML = '';
  });

  test('builds titles and summaries', () => {
    expect(pageTitle('Eventi passati')).toBe('Eventi passati · DotNetLiguria');
    expect(pageTitle()).toBe(DEFAULT_TITLE);
    expect(summarize('  Breve   testo. ')).toBe('Breve testo.');
    const long = summarize('Parola '.repeat(40), 60);
    expect(long.length).toBeLessThanOrEqual(60);
    expect(long.endsWith('…')).toBe(true);
    expect(long).not.toMatch(/\s…$/);
  });
});

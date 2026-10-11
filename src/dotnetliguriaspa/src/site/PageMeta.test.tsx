import React from 'react';
import { Route, Routes } from 'react-router-dom';
import { render } from '../test-utils';
import PageMeta from './PageMeta';
import { DEFAULT_DESCRIPTION, DEFAULT_TITLE } from './seo';

const head = (selector: string) => document.head.querySelector(selector);
const content = (selector: string) => head(selector)?.getAttribute('content');
const origin = window.location.origin;

describe('<PageMeta />', () => {
  test('hoists a complete set of tags for an indexable page, with the canonical on the pathname', () => {
    render(
      <Routes><Route path="/workshop/:id" element={<PageMeta title="AI Generativa" description="Una giornata sull'AI." image="/Contents/workshops/w40/poster.png" />} /></Routes>,
      { route: '/workshop/abc?utm_source=x' },
    );
    expect(document.title).toBe('AI Generativa · DotNetLiguria');
    expect(content('meta[name="description"]')).toBe("Una giornata sull'AI.");
    expect(head('link[rel="canonical"]')).toHaveAttribute('href', `${origin}/workshop/abc`);
    expect(head('meta[name="robots"]')).toBeNull();
    expect(content('meta[property="og:title"]')).toBe('AI Generativa · DotNetLiguria');
    expect(content('meta[property="og:url"]')).toBe(`${origin}/workshop/abc`);
    expect(content('meta[property="og:image"]')).toBe(`${origin}/Contents/workshops/w40/poster.png`);
    expect(content('meta[property="og:locale"]')).toBe('it_IT');
    expect(content('meta[property="og:site_name"]')).toBe('DotNetLiguria');
    expect(content('meta[name="twitter:card"]')).toBe('summary_large_image');
    expect(document.head.querySelectorAll('meta[name="description"]')).toHaveLength(1);
  });

  test('uses the site defaults on the home and the logo as preview image', () => {
    render(<PageMeta />);
    expect(document.title).toBe(DEFAULT_TITLE);
    expect(content('meta[name="description"]')).toBe(DEFAULT_DESCRIPTION);
    expect(head('link[rel="canonical"]')).toHaveAttribute('href', `${origin}/`);
    expect(content('meta[property="og:image"]')).toBe(`${origin}/logo512.png`);
    expect(content('meta[name="twitter:card"]')).toBe('summary');
  });

  test('replaces the canonical with noindex on private pages and keeps a meaningful query when asked', () => {
    const { unmount } = render(<PageMeta title="Questionario" noindex />, { route: '/q/1' });
    expect(content('meta[name="robots"]')).toBe('noindex');
    expect(head('link[rel="canonical"]')).toBeNull();
    unmount();
    expect(head('meta[name="robots"]')).toBeNull();

    render(<PageMeta title="Eventi 2024" canonicalPath="/workshops?anno=2024" />, { route: '/workshops?anno=2024' });
    expect(head('link[rel="canonical"]')).toHaveAttribute('href', `${origin}/workshops?anno=2024`);
  });
});

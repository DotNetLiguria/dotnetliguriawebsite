import React from 'react';
import { useLocation } from 'react-router-dom';
import { DEFAULT_DESCRIPTION, DEFAULT_IMAGE_PATH, SITE_NAME, absoluteUrl, pageTitle } from './seo';

export interface PageMetaProps {
  /** Title of the page without the site suffix; the home omits it and keeps the site title. */
  title?: string;
  description?: string;
  /** Pages search engines must not index (questionnaires, not found): robots noindex instead of a canonical. */
  noindex?: boolean;
  /** Canonical path, including the query only when it identifies different content; defaults to the pathname. */
  canonicalPath?: string;
  /** Image for link previews, absolute or site-relative; the logo otherwise. */
  image?: string | null;
}

/**
 * Per-route document metadata: title, description, canonical or noindex, Open Graph and Twitter card.
 * React 19 hoists these elements into <head>; the fallback tags of index.html are removed at bootstrap
 * (see dropFallbackMetadata), so each route has exactly one of each.
 */
export default function PageMeta({ title, description = DEFAULT_DESCRIPTION, noindex = false, canonicalPath, image }: PageMetaProps) {
  const { pathname } = useLocation();
  const origin = window.location.origin;
  const url = absoluteUrl(canonicalPath ?? pathname, origin);
  const fullTitle = pageTitle(title);
  const preview = absoluteUrl(image || DEFAULT_IMAGE_PATH, origin);

  return (
    <>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {noindex ? <meta name="robots" content="noindex" /> : <link rel="canonical" href={url} />}
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:locale" content="it_IT" />
      <meta property="og:type" content="website" />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={preview} />
      <meta name="twitter:card" content={image ? 'summary_large_image' : 'summary'} />
    </>
  );
}

// Links stored by hand in the admin are not always complete URLs.

const DOMAIN_LIKE = /^(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)+(:\d+)?(\/\S*)?$/i;
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/**
 * The http(s) URL of a stored link, or null when it is not one. Bare domains ("linkedin.com/in/x",
 * "www.github.com/x") get https://; any other scheme (javascript:, data:, mailto:) is rejected.
 */
export function webUrl(value?: string | null): string | null {
  const text = (value ?? '').trim();
  if (!text) return null;
  let candidate: string;
  if (/^https?:\/\//i.test(text)) candidate = text;
  else if (text.startsWith('//')) candidate = `https:${text}`;
  else if (HAS_SCHEME.test(text)) return null;
  else if (DOMAIN_LIKE.test(text)) candidate = `https://${text}`;
  else return null;
  try {
    const url = new URL(candidate);
    return url.protocol === 'http:' || url.protocol === 'https:' ? candidate : null;
  } catch {
    return null;
  }
}

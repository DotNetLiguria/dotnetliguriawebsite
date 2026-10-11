import { clean } from '../adminApi';
import { contentUrl } from '../../site/siteApi';

/** A board member as serialized by DotNetLiguriaCore (field names, including the historic misspellings, are the API's). */
export interface AdminBoardMember {
  boardId: string;
  name?: string | null;
  description?: string | null;
  email?: string | null;
  profileImageUrl?: string | null;
  shortBio?: string | null;
  fullBio?: string | null;
  blogHtml?: string | null;
  lInkedinUrl?: string | null;
  gitHubUrl?: string | null;
  twitterUrl?: string | null;
  faceboookUrl?: string | null;
  instagramUrl?: string | null;
  isActive?: boolean;
  order?: number | null;
  // The update replaces the whole record: anything the form does not edit travels back untouched.
  [key: string]: unknown;
}

export type LinkKey = 'blogHtml' | 'lInkedinUrl' | 'gitHubUrl' | 'twitterUrl' | 'faceboookUrl' | 'instagramUrl';

export const LINKS: { key: LinkKey; label: string; placeholder: string }[] = [
  { key: 'blogHtml', label: 'Blog', placeholder: 'https://…' },
  { key: 'lInkedinUrl', label: 'LinkedIn', placeholder: 'https://www.linkedin.com/in/…' },
  { key: 'gitHubUrl', label: 'GitHub', placeholder: 'https://github.com/…' },
  { key: 'twitterUrl', label: 'X (Twitter)', placeholder: 'https://x.com/…' },
  { key: 'faceboookUrl', label: 'Facebook', placeholder: 'https://www.facebook.com/…' },
  { key: 'instagramUrl', label: 'Instagram', placeholder: 'https://www.instagram.com/…' },
];

/** http(s) addresses only: it is all the public site renders, and anything else could be a script. */
export const isWebUrl = (value?: string | null) => {
  const text = clean(value);
  if (!/^https?:\/\//i.test(text)) return false;
  try {
    return new URL(text).host !== '';
  } catch {
    return false;
  }
};

/** Validation message for an optional link field, or null when it is empty or fine. */
export const linkError = (value: string) => (!clean(value) || isWebUrl(value) ? null : 'Indica un indirizzo che inizi con http:// o https://.');

/** Where the member's photo is: a full address, or a path under /Contents (older records may repeat "Contents/"). */
export function boardPhoto(profileImageUrl?: string | null) {
  const path = clean(profileImageUrl);
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return contentUrl(path.replace(/^\/?contents\//i, ''));
}

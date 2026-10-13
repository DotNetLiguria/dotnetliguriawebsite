import shippedPhotos from 'virtual:content-photos';
import { contentUrl } from './siteApi';

const shipped = new Set(shippedPhotos);

const slug = (name: string) =>
  name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/['’]/g, '_').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

/**
 * Candidate photo URLs for a speaker. Speaker records still carry legacy /Uploads paths that are no longer
 * served, while the photos live in /Contents/speakers or /Contents/profile named after the speaker:
 * the record first, then those files — only the ones the website ships, so a missing photo costs no request.
 */
export function photoCandidates(name: string, profileImageUrl?: string | null) {
  const list: string[] = [];
  if (profileImageUrl && !/^\/?uploads\//i.test(profileImageUrl)) {
    const url = /^https?:\/\//.test(profileImageUrl) ? profileImageUrl : contentUrl(profileImageUrl);
    if (url) list.push(url);
  }
  const base = slug(name);
  if (base) {
    for (const folder of ['speakers', 'profile']) {
      for (const ext of ['jpg', 'png']) {
        const file = `${folder}/${base}.${ext}`;
        if (shipped.has(file)) list.push(contentUrl(file)!);
      }
    }
  }
  return list;
}

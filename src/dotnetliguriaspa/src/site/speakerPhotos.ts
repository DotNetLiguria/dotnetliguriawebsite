import shippedPhotos from 'virtual:content-photos';
import { contentUrl } from './siteApi';
import { API_BASE_URL } from '../config/apiConfig';

const shipped = new Set(shippedPhotos);

const slug = (name: string) =>
  name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/['’]/g, '_').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

/**
 * Candidate photo URLs for a speaker. Speaker records still carry legacy /Uploads paths that are no longer
 * served, while the photos live in /Contents/speakers or /Contents/profile named after the speaker:
 * the record first, then those files — only the ones the website ships, so a missing photo costs no request.
 */
export function profilePhotoUrl(path?: string | null) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  if (/^\/?api\/media\/photos\//.test(path)) return `${API_BASE_URL.replace(/\/api\/?$/, '')}/${path.replace(/^\/+/, '')}`;
  return contentUrl(path.replace(/^\/?contents\//i, ''));
}

export function photoCandidates(name: string, profileImageUrl?: string | null, photoFallbackDisabled = false) {
  const list: string[] = [];
  if (profileImageUrl && !/^\/?uploads\//i.test(profileImageUrl)) {
    const url = profilePhotoUrl(profileImageUrl);
    if (url) list.push(url);
  }
  if (photoFallbackDisabled) return list;
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

import { contentUrl } from './siteApi';
import { API_BASE_URL } from '../config/apiConfig';

/** Resolve only the photo selected by the API; legacy /Uploads URLs are no longer served. */
export function profilePhotoUrl(path?: string | null) {
  if (!path) return null;
  if (/^\/?uploads\//i.test(path)) return null;
  if (/^https?:\/\//i.test(path)) return path;
  if (/^\/?api\/media\/photos\//.test(path)) return `${API_BASE_URL.replace(/\/api\/?$/, '')}/${path.replace(/^\/+/, '')}`;
  return contentUrl(path.replace(/^\/?contents\//i, ''));
}

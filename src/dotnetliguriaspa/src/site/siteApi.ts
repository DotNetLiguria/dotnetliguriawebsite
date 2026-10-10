import { API_BASE_URL, CONTENT_BASE_URL } from '../config/apiConfig';

// Shapes returned by the public website API (field names as serialized by DotNetLiguriaCore).
export interface SiteTrack {
  workshopTrackId: string;
  title: string;
  startTime: string;
  endTime: string;
  abstract?: string | null;
  speakersName?: string | null;
}

export interface SiteFile {
  workshopFileId: string;
  title?: string | null;
  fileName?: string | null;
  fullPath?: string | null;
  fileType?: number | null;
}

export interface SiteWorkshop {
  workshopId: string;
  title: string;
  description?: string | null;
  eventDate: string;
  image?: string | null;
  blogHtml?: string | null;
  tags?: string | null;
  published?: boolean;
  isExternalEvent?: boolean;
  externalRegistration?: boolean;
  externalRegistrationLink?: string | null;
  location?: { name?: string | null; address?: string | null; coordinates?: string | null } | null;
  tracks?: SiteTrack[] | null;
  materials?: SiteFile[] | null;
  photos?: SiteFile[] | null;
}

export interface SiteSpeaker {
  workshopSpeakerId: string;
  name: string;
  profileImageUrl?: string | null;
  description?: string | null;
}

export interface SiteBoardMember {
  boardId: string;
  name: string;
  description?: string | null;
  profileImageUrl?: string | null;
  shortBio?: string | null;
  fullBio?: string | null;
  blogHtml?: string | null;
  lInkedinUrl?: string | null;
  gitHubUrl?: string | null;
  twitterUrl?: string | null;
  faceboookUrl?: string | null;
  instagramUrl?: string | null;
  order?: number | null;
}

export interface SiteMenuItem {
  topMenuElementId?: string;
  name: string;
  url: string;
  order: number;
  isActive: boolean;
}

export class SiteApiError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`Errore HTTP: ${status}`);
    this.name = 'SiteApiError';
    this.status = status;
  }
}

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, { headers: { Accept: 'application/json' }, signal });
  if (!response.ok) throw new SiteApiError(response.status);
  return (await response.json()) as T;
}

/** The workshop flagged for the home page, or null when none is flagged (404 on a fresh database). */
export async function getFeaturedWorkshop(signal?: AbortSignal): Promise<SiteWorkshop | null> {
  try {
    const data = await getJson<unknown>('/Workshop/GetInHomePage/HomePage', signal);
    // Anything that is not a workshop (empty body, array) means nothing is featured.
    return data && typeof data === 'object' && !Array.isArray(data) && 'workshopId' in data ? (data as SiteWorkshop) : null;
  } catch (error) {
    if (error instanceof SiteApiError && error.status === 404) return null;
    throw error;
  }
}

export const getPublishedWorkshops = (signal?: AbortSignal) =>
  getJson<SiteWorkshop[]>('/Workshop/Get?onlyPublished=true', signal);

export const getActiveBoard = (signal?: AbortSignal) =>
  getJson<SiteBoardMember[]>('/Board/Get?onlyActive=true', signal);

export const getTopMenu = (signal?: AbortSignal) => getJson<SiteMenuItem[]>('/TopMenu', signal);

export const getSpeakers = (signal?: AbortSignal) => getJson<SiteSpeaker[]>('/Speaker/Get', signal);

/**
 * One workshop by id, or null when it does not exist.
 * The single-item endpoint currently answers 404 for workshops stored with legacy GUIDs, so on 404 the
 * published list (same payload) is searched as well; once the backend lookup is fixed this costs nothing.
 */
export async function getWorkshop(id: string, signal?: AbortSignal): Promise<SiteWorkshop | null> {
  // Workshop ids are GUIDs: anything else is simply not an event (the API would answer 400).
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return null;
  try {
    return await getJson<SiteWorkshop>(`/Workshop/Get/${encodeURIComponent(id)}`, signal);
  } catch (error) {
    if (!(error instanceof SiteApiError) || (error.status !== 404 && error.status !== 400)) throw error;
  }
  const published = await getPublishedWorkshops(signal);
  return published.find(workshop => workshop.workshopId.toLowerCase() === id.toLowerCase()) ?? null;
}

/** Absolute URL for a file stored under /Contents (workshop images, board photos). */
export const contentUrl = (path?: string | null) =>
  path ? `${CONTENT_BASE_URL}${path.replace(/^\/+/, '')}` : null;

export const isAbortError = (error: unknown) => error instanceof DOMException && error.name === 'AbortError';

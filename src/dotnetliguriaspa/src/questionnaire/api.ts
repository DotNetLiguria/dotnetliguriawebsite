import { API_BASE_URL } from '../config/apiConfig';
import type {
  CreateQuestionnaireRequest, PublicQuestionnaireView, Questionnaire, QuestionnaireProblem, QuestionnaireResponse,
  QuestionnaireStatistics, QuestionnaireSummary, SubmitQuestionnaireResponseRequest,
} from './types';

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export class QuestionnaireApiError extends Error {
  readonly status: number;
  readonly problem?: QuestionnaireProblem;

  constructor(status: number, problem?: QuestionnaireProblem) {
    super(problem?.message || defaultMessage(status));
    this.name = 'QuestionnaireApiError';
    this.status = status;
    this.problem = problem;
  }
}

function defaultMessage(status: number): string {
  switch (status) {
    case 401: return 'Sessione scaduta: effettua di nuovo il login.';
    case 403: return 'Non hai i permessi per gestire i questionari (ruolo feedbackadmin).';
    case 404: return 'Questionario non trovato.';
    case 429: return 'Troppe richieste: riprova tra qualche istante.';
    default: return `Errore del server (${status}).`;
  }
}

async function request<T>(fetcher: FetchLike, path: string, init?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const response = await fetcher(url, {
    ...init,
    headers: { Accept: 'application/json', ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...init?.headers },
  });
  if (!response.ok) {
    let problem: QuestionnaireProblem | undefined;
    try {
      const body = await response.json();
      if (body && typeof body === 'object' && 'message' in body) problem = { errors: [], code: '', ...body };
    } catch {
      problem = undefined;
    }
    throw new QuestionnaireApiError(response.status, problem);
  }
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  if (!text) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    const responseUrl = response.url || url;
    const responsePath = new URL(responseUrl, globalThis.location?.origin ?? 'https://localhost').pathname;
    const contentType = response.headers.get('Content-Type') || 'sconosciuto';
    const redirect = response.redirected ? ' dopo un reindirizzamento' : '';
    throw new QuestionnaireApiError(response.status, {
      code: 'InvalidResponse',
      message: `Il server ha restituito una risposta non JSON (${contentType})${redirect} all'indirizzo ${responsePath}. Verifica che l'API sia raggiungibile e che l'identificativo dell'evento sia valido.`,
      errors: [],
    });
  }
}

const json = (method: string, body?: unknown): RequestInit =>
  ({ method, body: body === undefined ? undefined : JSON.stringify(body) });

const base = '/Questionnaire';

export function createQuestionnaireAdminApi(fetcher: FetchLike) {
  return {
    list: () => request<QuestionnaireSummary[]>(fetcher, base),
    get: (id: string) => request<Questionnaire>(fetcher, `${base}/${id}`),
    byWorkshop: (workshopId: string) => request<Questionnaire[]>(fetcher, `${base}/by-workshop/${workshopId}`),
    create: (body: CreateQuestionnaireRequest) => request<Questionnaire>(fetcher, base, json('POST', body)),
    update: (questionnaire: Questionnaire) =>
      request<Questionnaire>(fetcher, `${base}/${questionnaire.questionnaireId}`, json('PUT', questionnaire)),
    duplicate: (id: string) => request<Questionnaire>(fetcher, `${base}/${id}/duplicate`, json('POST')),
    publish: (id: string) => request<Questionnaire>(fetcher, `${base}/${id}/publish`, json('POST')),
    close: (id: string) => request<Questionnaire>(fetcher, `${base}/${id}/close`, json('POST')),
    reopen: (id: string) => request<Questionnaire>(fetcher, `${base}/${id}/reopen`, json('POST')),
    archive: (id: string) => request<Questionnaire>(fetcher, `${base}/${id}/archive`, json('POST')),
    remove: (id: string) => request<void>(fetcher, `${base}/${id}`, json('DELETE')),
    statistics: (id: string) => request<QuestionnaireStatistics>(fetcher, `${base}/${id}/statistics`),
    responses: (id: string) => request<QuestionnaireResponse[]>(fetcher, `${base}/${id}/responses`),
    removeResponse: (id: string, responseId: string) =>
      request<void>(fetcher, `${base}/${id}/responses/${responseId}`, json('DELETE')),
    exportCsv: async (id: string) => {
      const response = await fetcher(`${API_BASE_URL}${base}/${id}/export`);
      if (!response.ok) throw new QuestionnaireApiError(response.status);
      return response.blob();
    },
  };
}

export type QuestionnaireAdminApi = ReturnType<typeof createQuestionnaireAdminApi>;

const publicBase = '/PublicQuestionnaire';

export const publicQuestionnaireApi = {
  get: (id: string, fetcher: FetchLike = fetch) => request<PublicQuestionnaireView>(fetcher, `${publicBase}/${id}`),
  byWorkshop: (workshopId: string, fetcher: FetchLike = fetch) =>
    request<PublicQuestionnaireView>(fetcher, `${publicBase}/by-workshop/${workshopId}`),
  submit: (id: string, body: SubmitQuestionnaireResponseRequest, fetcher: FetchLike = fetch) =>
    request<{ responseId: string }>(fetcher, `${publicBase}/${id}/responses`, json('POST', body)),
};

export const publicQuestionnaireUrl = (id: string, origin = window.location.origin) => `${origin}/q/${id}`;

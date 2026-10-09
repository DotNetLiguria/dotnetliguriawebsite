import type { QuestionnaireStatus, ResponseSource } from './types';

export const statusLabels: Record<QuestionnaireStatus, string> = {
  Draft: 'Bozza', Published: 'Pubblicato', Closed: 'Chiuso', Archived: 'Archiviato',
};

export const statusColors: Record<QuestionnaireStatus, 'default' | 'success' | 'warning' | 'info'> = {
  Draft: 'default', Published: 'success', Closed: 'warning', Archived: 'info',
};

export const sourceLabels: Record<ResponseSource, string> = {
  Web: 'Web', LegacyFeedback: 'Feedback React (storico)', LegacySqlServer: 'Blazor Server (storico)', LegacySqlite: 'Blazor WASM (storico)',
};

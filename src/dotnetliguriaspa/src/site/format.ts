// Dates are calendar days of events held in Italy; times are stored as UTC instants.
const ROME = 'Europe/Rome';

const dateFormat = new Intl.DateTimeFormat('it-IT', { timeZone: ROME, day: 'numeric', month: 'long', year: 'numeric' });
const weekdayFormat = new Intl.DateTimeFormat('it-IT', {
  timeZone: ROME, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
});
const timeFormat = new Intl.DateTimeFormat('it-IT', { timeZone: ROME, hour: '2-digit', minute: '2-digit' });
const dayKeyFormat = new Intl.DateTimeFormat('en-CA', { timeZone: ROME, year: 'numeric', month: '2-digit', day: '2-digit' });
const dayFormat = new Intl.DateTimeFormat('it-IT', { timeZone: ROME, day: 'numeric' });
const monthFormat = new Intl.DateTimeFormat('it-IT', { timeZone: ROME, month: 'short' });

/** Day number and short month for date badges ("12", "giu"). */
export const formatDayMonth = (value: string | Date) => ({
  day: dayFormat.format(new Date(value)),
  month: monthFormat.format(new Date(value)).replace('.', ''),
});

export const formatDate = (value: string | Date) => dateFormat.format(new Date(value));
export const formatWeekday = (value: string | Date) => weekdayFormat.format(new Date(value));
export const formatTime = (value: string | Date) => timeFormat.format(new Date(value));
export const formatTimeRange = (start: string, end: string) => `${formatTime(start)}–${formatTime(end)}`;

/** yyyy-mm-dd of the event day in Rome, to compare event days with today. */
export const dayKey = (value: string | Date) => dayKeyFormat.format(new Date(value));

export type EventPhase = 'planned' | 'today' | 'done';

export function eventPhase(eventDate: string, now: Date = new Date()): EventPhase {
  const event = dayKey(eventDate);
  const today = dayKey(now);
  if (event > today) return 'planned';
  if (event === today) return 'today';
  return 'done';
}

export const clean = (text?: string | null) => (text ?? '').replace(/\s+/g, ' ').trim();

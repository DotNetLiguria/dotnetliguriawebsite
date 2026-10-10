import { clean, eventPhase, formatDayMonth, formatTimeRange, formatWeekday } from './format';

describe('site formatting', () => {
  test('shows stored UTC session times in Italian local time', () => {
    // Winter (CET, UTC+1) and summer (CEST, UTC+2) instants.
    expect(formatTimeRange('2025-12-06T14:15:00Z', '2025-12-06T14:55:00Z')).toBe('15:15–15:55');
    expect(formatTimeRange('2026-05-07T12:15:00Z', '2026-05-07T12:45:00Z')).toBe('14:15–14:45');
  });

  test('classifies an event day against the current day in Rome', () => {
    const now = new Date('2026-05-07T21:30:00Z'); // 23:30 in Rome
    expect(eventPhase('2026-05-07T00:00:00+02:00', now)).toBe('today');
    expect(eventPhase('2026-05-08T00:00:00+02:00', now)).toBe('planned');
    expect(eventPhase('2026-05-06T00:00:00+02:00', now)).toBe('done');
  });

  test('formats dates in Italian and normalises whitespace', () => {
    expect(formatWeekday('2025-06-12T00:00:00+02:00')).toBe('giovedì 12 giugno 2025');
    expect(formatDayMonth('2025-06-12T00:00:00+02:00')).toEqual({ day: '12', month: 'giu' });
    expect(clean('  AI   Generativa \r\n ')).toBe('AI Generativa');
    expect(clean(null)).toBe('');
  });
});

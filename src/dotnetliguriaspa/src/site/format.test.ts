import { clean, eventPhase, formatDayMonth, formatTime, formatTimeRange, formatWeekday, fromRomeWallClock } from './format';

describe('site formatting', () => {
  test('shows stored UTC session times in Italian local time', () => {
    // Winter (CET, UTC+1) and summer (CEST, UTC+2) instants.
    expect(formatTimeRange('2025-12-06T14:15:00Z', '2025-12-06T14:55:00Z')).toBe('15:15–15:55');
    expect(formatTimeRange('2026-05-07T12:15:00Z', '2026-05-07T12:45:00Z')).toBe('14:15–14:45');
  });

  test('shows agenda times exactly as entered in the editor, in winter and summer', () => {
    // The editor saves the Rome wall-clock "10:00" as 10:00Z.
    expect(fromRomeWallClock('2025-12-06T10:00:00.000Z')).toBe('2025-12-06T09:00:00.000Z');
    expect(fromRomeWallClock('2026-05-07T10:00:00.000Z')).toBe('2026-05-07T08:00:00.000Z');
    expect(formatTime(fromRomeWallClock('2026-03-29T01:30:00Z'))).toBe('01:30');
    expect(formatTime(fromRomeWallClock('2026-03-29T03:30:00Z'))).toBe('03:30');
    expect(formatTime(fromRomeWallClock('2026-10-25T03:30:00Z'))).toBe('03:30');
    expect(fromRomeWallClock('not a date')).toBe('not a date');
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

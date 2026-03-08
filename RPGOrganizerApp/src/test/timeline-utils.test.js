import { describe, it, expect } from 'vitest';
import { formatDate, formatInGameDate, formatInGameDateRange, nextInGameDay } from '../js/timeline-utils.js';

// ── formatDate ────────────────────────────────────────────────
describe('formatDate', () => {
  it('formats a valid date string to German format', () => {
    expect(formatDate('2024-03-08')).toBe('08.03.2024');
  });

  it('returns empty string for null', () => {
    expect(formatDate(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(formatDate(undefined)).toBe('');
  });

  it('returns empty string for empty string', () => {
    expect(formatDate('')).toBe('');
  });
});

// ── formatInGameDate ──────────────────────────────────────────
describe('formatInGameDate', () => {
  it('formats a full date with day, month and year', () => {
    expect(formatInGameDate(15, 'Peraine', 1040)).toBe('15. Peraine 1040');
  });

  it('formats a date with only month and year', () => {
    expect(formatInGameDate(null, 'Firun', 1040)).toBe('Firun 1040');
  });

  it('formats a date with only month', () => {
    expect(formatInGameDate(null, 'Rahja', null)).toBe('Rahja');
  });

  it('returns — when month is missing', () => {
    expect(formatInGameDate(5, null, 1040)).toBe('—');
  });

  it('returns — when all fields are missing', () => {
    expect(formatInGameDate(null, null, null)).toBe('—');
  });

  it('handles the Namenlose Tage correctly', () => {
    expect(formatInGameDate(3, 'Namenlose Tage', 1040)).toBe('3. Namenlose Tage 1040');
  });
});

// ── formatInGameDateRange ─────────────────────────────────────
describe('formatInGameDateRange', () => {
  it('returns just the start date when no end date is given', () => {
    expect(formatInGameDateRange(15, 'Peraine', 1040, null, null, null)).toBe('15. Peraine 1040');
  });

  it('returns a range when both start and end dates are given', () => {
    expect(formatInGameDateRange(15, 'Peraine', 1040, 3, 'Efferd', 1040)).toBe('15. Peraine 1040 – 3. Efferd 1040');
  });

  it('returns a range spanning two years', () => {
    expect(formatInGameDateRange(28, 'Rahja', 1040, 2, 'Praios', 1041)).toBe('28. Rahja 1040 – 2. Praios 1041');
  });

  it('returns — when start month is missing', () => {
    expect(formatInGameDateRange(null, null, null, null, null, null)).toBe('—');
  });
});

// ── nextInGameDay ─────────────────────────────────────────────
describe('nextInGameDay', () => {
  it('advances day within a month', () => {
    expect(nextInGameDay(15, 'Peraine', 1040)).toEqual({ day: 16, month: 'Peraine', year: 1040 });
  });

  it('advances from day 30 to next month', () => {
    expect(nextInGameDay(30, 'Peraine', 1040)).toEqual({ day: 1, month: 'Ingerimm', year: 1040 });
  });

  it('advances from Rahja day 30 to Namenlose Tage', () => {
    expect(nextInGameDay(30, 'Rahja', 1040)).toEqual({ day: 1, month: 'Namenlose Tage', year: 1040 });
  });

  it('advances within Namenlose Tage', () => {
    expect(nextInGameDay(3, 'Namenlose Tage', 1040)).toEqual({ day: 4, month: 'Namenlose Tage', year: 1040 });
  });

  it('advances from Namenlose Tage day 5 to Praios of next year', () => {
    expect(nextInGameDay(5, 'Namenlose Tage', 1040)).toEqual({ day: 1, month: 'Praios', year: 1041 });
  });

  it('returns same month/year with null day when day is null', () => {
    expect(nextInGameDay(null, 'Efferd', 1040)).toEqual({ day: null, month: 'Efferd', year: 1040 });
  });

  it('returns input unchanged when month is null', () => {
    expect(nextInGameDay(5, null, 1040)).toEqual({ day: 5, month: null, year: 1040 });
  });
});

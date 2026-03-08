/**
 * Pure utility functions for the Timeline feature.
 * Kept separate from Firebase/DOM code so they can be unit tested.
 */

const MONTHS = [
  'Praios', 'Rondra', 'Efferd', 'Travia', 'Boron', 'Hesinde',
  'Firun', 'Tsa', 'Phex', 'Peraine', 'Ingerimm', 'Rahja', 'Namenlose Tage'
];

/**
 * Formats a date string "YYYY-MM-DD" to German format "DD.MM.YYYY".
 * Returns empty string if input is falsy.
 */
export function formatDate(dateStr) {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  return `${day}.${month}.${year}`;
}

/**
 * Formats an in-game date from its parts into a readable string.
 * Day and year are optional — only present parts are included.
 * Example: formatInGameDate(15, 'Peraine', 1040) → "15. Peraine 1040"
 */
export function formatInGameDate(day, month, year) {
  if (!month) return '—';
  const parts = [];
  if (day) parts.push(`${day}.`);
  parts.push(month);
  if (year) parts.push(year);
  return parts.join(' ');
}

/**
 * Formats an in-game date range.
 * If no end month is given, returns the start date only.
 * Example: formatInGameDateRange(15, 'Peraine', 1040, 3, 'Efferd', 1040)
 *          → "15. Peraine 1040 – 3. Efferd 1040"
 */
export function formatInGameDateRange(startDay, startMonth, startYear, endDay, endMonth, endYear) {
  const start = formatInGameDate(startDay, startMonth, startYear);
  if (!endMonth) return start;
  const end = formatInGameDate(endDay, endMonth, endYear);
  return `${start} – ${end}`;
}

/**
 * Returns the next in-game calendar day after the given date.
 * Handles month transitions (30 days each), Namenlose Tage (5 days),
 * and year roll-over (Namenlose Tage day 5 → Praios day 1 of next year).
 * If day is null, returns the same month/year with day still null.
 * If month is unknown or null, returns the input unchanged.
 */
export function nextInGameDay(day, month, year) {
  if (!month) return { day, month, year };

  const monthIndex = MONTHS.indexOf(month);
  if (monthIndex === -1) return { day, month, year };

  if (day === null || day === undefined) {
    return { day: null, month, year };
  }

  const maxDay = month === 'Namenlose Tage' ? 5 : 30;

  if (day < maxDay) {
    return { day: day + 1, month, year };
  }

  // End of Namenlose Tage → Praios, next year
  if (month === 'Namenlose Tage') {
    return { day: 1, month: 'Praios', year: year != null ? year + 1 : null };
  }

  // End of Rahja → Namenlose Tage (same year)
  if (month === 'Rahja') {
    return { day: 1, month: 'Namenlose Tage', year };
  }

  // Regular month transition
  return { day: 1, month: MONTHS[monthIndex + 1], year };
}

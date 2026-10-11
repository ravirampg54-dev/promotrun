/**
 * Date helpers for the engine.
 *
 * Every date in the app is an ISO calendar day string: 'YYYY-MM-DD'.
 * We deliberately avoid local-timezone `Date` parsing (`new Date('2025-01-01')`
 * parses as UTC midnight and shifts a day in negative offsets) so the engine is
 * deterministic in any timezone. All arithmetic is done on UTC midnight.
 */

export type ISODate = string;

const MS_PER_DAY = 86_400_000;
const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isISODate(value: unknown): value is ISODate {
  if (typeof value !== 'string' || !ISO_RE.test(value)) return false;
  const d = parseISODate(value);
  return toISO(d) === value;
}

export function parseISODate(value: ISODate): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
}

export function toISO(date: Date): ISODate {
  const y = date.getUTCFullYear();
  const m = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  const d = `${date.getUTCDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Today as an ISO calendar day in the *local* timezone (what the user sees). */
export function todayISO(now: Date = new Date()): ISODate {
  const y = now.getFullYear();
  const m = `${now.getMonth() + 1}`.padStart(2, '0');
  const d = `${now.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(date: ISODate, days: number): ISODate {
  return toISO(new Date(parseISODate(date).getTime() + days * MS_PER_DAY));
}

/** Whole days from `a` to `b` (b - a). Negative when b is before a. */
export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((parseISODate(b).getTime() - parseISODate(a).getTime()) / MS_PER_DAY);
}

export function compareISO(a: ISODate, b: ISODate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function minISO(a: ISODate, b: ISODate): ISODate {
  return a <= b ? a : b;
}

export function maxISO(a: ISODate, b: ISODate): ISODate {
  return a >= b ? a : b;
}

export function clampISO(date: ISODate, min: ISODate, max: ISODate): ISODate {
  return minISO(maxISO(date, min), max);
}

/** Inclusive list of calendar days. */
export function eachDay(from: ISODate, to: ISODate): ISODate[] {
  const out: ISODate[] = [];
  if (diffDays(from, to) < 0) return out;
  let cursor = from;
  // hard guard against absurd ranges
  for (let i = 0; i < 3660; i += 1) {
    out.push(cursor);
    if (cursor === to) break;
    cursor = addDays(cursor, 1);
  }
  return out;
}

export function startOfMonth(date: ISODate): ISODate {
  return `${date.slice(0, 7)}-01`;
}

/** Day of month, clamped to the length of that month (31 Jan + 1 month => 28/29 Feb). */
export function addMonthsClamped(date: ISODate, months: number): ISODate {
  const base = parseISODate(date);
  const targetMonth = base.getUTCMonth() + months;
  const firstOfTarget = new Date(Date.UTC(base.getUTCFullYear(), targetMonth, 1));
  const daysInTarget = new Date(
    Date.UTC(firstOfTarget.getUTCFullYear(), firstOfTarget.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const day = Math.min(base.getUTCDate(), daysInTarget);
  return toISO(new Date(Date.UTC(firstOfTarget.getUTCFullYear(), firstOfTarget.getUTCMonth(), day)));
}

/** Human label without pulling a date library into the engine. */
const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function formatDayLabel(date: ISODate): string {
  const d = parseISODate(date);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

export function formatFullDate(date: ISODate): string {
  const d = parseISODate(date);
  return `${WEEKDAYS[d.getUTCDay()]}, ${d.getUTCDate()} ${
    MONTHS[d.getUTCMonth()]
  } ${d.getUTCFullYear()}`;
}

export function formatMonthYear(date: ISODate): string {
  const d = parseISODate(date);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}